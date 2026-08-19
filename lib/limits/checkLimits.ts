import { prisma } from "@/lib/prisma"

export interface LimitStatus {
  allowed: boolean
  resetInSeconds?: number
  message?: string
}

function getResetTimeString(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `Reset after ${hours} hour${hours > 1 ? "s" : ""}, ${minutes} minute${minutes > 1 ? "s" : ""}`
  }
  return `Reset after ${minutes} minute${minutes > 1 ? "s" : "s"}`
}

/**
 * Enforce rolling-window limits and record the current request/action.
 */
export async function enforceLimit(
  params: {
    userId?: string | null
    ip?: string | null
    phone?: string | null
    action: string
    plan: string // "FREE" | "PREMIUM" | "ESSENTIAL" | "ORGANIZATION"
    limitFree: number
    limitPremium: number
    windowMs: number // e.g. 60000 for 1 min, 86400000 for 1 day
    errorMessage: string
    meta?: any
  }
): Promise<LimitStatus> {
  const { userId, ip, phone, action, plan, limitFree, limitPremium, windowMs, errorMessage, meta } = params

  const isPremium = plan === "PREMIUM" || plan === "ORGANIZATION"
  const maxLimit = isPremium ? limitPremium : limitFree

  if (maxLimit === Infinity) {
    // Save log asynchronously
    await prisma.technicalLimitLog.create({
      data: { userId, ip, phone, action, meta },
    }).catch(err => console.error("Error creating LimitLog:", err))
    return { allowed: true }
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  // Query logs in the window
  const count = await prisma.technicalLimitLog.count({
    where: {
      action,
      timestamp: { gte: windowStart },
      AND: [
        userId ? { userId } : {},
        ip ? { ip } : {},
        phone ? { phone } : {},
      ],
    },
  })

  if (count >= maxLimit) {
    // Find the oldest record in the window to calculate reset time
    const oldestRecord = await prisma.technicalLimitLog.findFirst({
      where: {
        action,
        timestamp: { gte: windowStart },
        AND: [
          userId ? { userId } : {},
          ip ? { ip } : {},
          phone ? { phone } : {},
        ],
      },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    })

    const oldestTime = oldestRecord?.timestamp ? new Date(oldestRecord.timestamp) : windowStart
    const elapsed = now.getTime() - oldestTime.getTime()
    const timeLeftMs = Math.max(0, windowMs - elapsed)
    const timeLeftSec = Math.ceil(timeLeftMs / 1000)

    return {
      allowed: false,
      resetInSeconds: timeLeftSec,
      message: `${errorMessage}. ${getResetTimeString(timeLeftSec)}`,
    }
  }

  // Allow and log the action
  await prisma.technicalLimitLog.create({
    data: { userId, ip, phone, action, meta },
  }).catch(err => console.error("Error logging action:", err))

  return { allowed: true }
}

/**
 * Enforce a shared rolling-window limit across multiple action types.
 * Useful when multiple actions (e.g. normal + dynamic assessments) draw from
 * the same weekly pool. Usage is counted across ALL actions in `countActions`,
 * but the new request is logged under `action`.
 */
export async function enforceSharedLimit(
  params: {
    userId?: string | null
    ip?: string | null
    phone?: string | null
    /** The action name to log this specific request under */
    action: string
    /** All action names that count towards the shared limit (includes `action`) */
    countActions: string[]
    plan: string // "FREE" | "PREMIUM" | "ESSENTIAL" | "ORGANIZATION"
    limitFree: number
    limitPremium: number
    windowMs: number
    errorMessage: string
    meta?: any
  }
): Promise<LimitStatus> {
  const { userId, ip, phone, action, countActions, plan, limitFree, limitPremium, windowMs, errorMessage, meta } = params

  const isPremium = plan === "PREMIUM" || plan === "ORGANIZATION"
  const maxLimit = isPremium ? limitPremium : limitFree

  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  const userFilter = [
    userId ? { userId } : {},
    ip ? { ip } : {},
    phone ? { phone } : {},
  ]

  // Count usage across all pooled action types
  const count = await prisma.technicalLimitLog.count({
    where: {
      action: { in: countActions },
      timestamp: { gte: windowStart },
      AND: userFilter,
    },
  })

  if (count >= maxLimit) {
    // Find oldest entry in the pool to calculate reset time
    const oldestRecord = await prisma.technicalLimitLog.findFirst({
      where: {
        action: { in: countActions },
        timestamp: { gte: windowStart },
        AND: userFilter,
      },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    })

    const oldestTime = oldestRecord?.timestamp ? new Date(oldestRecord.timestamp) : windowStart
    const elapsed = now.getTime() - oldestTime.getTime()
    const timeLeftMs = Math.max(0, windowMs - elapsed)
    const timeLeftSec = Math.ceil(timeLeftMs / 1000)

    return {
      allowed: false,
      resetInSeconds: timeLeftSec,
      message: `${errorMessage}. ${getResetTimeString(timeLeftSec)}`,
    }
  }

  // Allow and log this action
  await prisma.technicalLimitLog.create({
    data: { userId, ip, phone, action, meta },
  }).catch(err => console.error("Error logging shared limit action:", err))

  return { allowed: true }
}

/**
 * Check if a concurrency limit is exceeded.
 */
export async function checkConcurrency(
  params: {
    userId?: string | null
    ip?: string | null
    action: string
    maxConcurrency: number
    windowMs: number // threshold to consider a request "stuck" / inactive (e.g. 10 seconds)
  }
): Promise<LimitStatus> {
  const { userId, ip, action, maxConcurrency, windowMs } = params
  const now = new Date()
  const activeThreshold = new Date(now.getTime() - windowMs)

  const activeCount = await prisma.technicalLimitLog.count({
    where: {
      action,
      timestamp: { gte: activeThreshold },
      AND: [
        userId ? { userId } : {},
        ip ? { ip } : {},
      ],
    },
  })

  if (activeCount >= maxConcurrency) {
    return {
      allowed: false,
      resetInSeconds: Math.ceil(windowMs / 1000),
      message: "Please wait for your previous request to finish.",
    }
  }

  return { allowed: true }
}
