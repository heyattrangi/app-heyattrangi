import { NextResponse } from "next/server"
import { auth } from "@/auth.config"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const plan = user.plan
    const isPremium = plan === "PREMIUM" || plan === "ORGANIZATION"

    const now = new Date()
    
    // --- 1. Wellness completions (WELLNESS_COMPLETION_DAILY) ---
    // limit: Free 20, Premium 30. Window: 24 hours.
    const wellnessLimit = isPremium ? 30 : 20
    const wellnessWindowMs = 24 * 60 * 60 * 1000
    const wellnessWindowStart = new Date(now.getTime() - wellnessWindowMs)
    const wellnessUsed = await prisma.technicalLimitLog.count({
      where: {
        userId,
        action: "WELLNESS_COMPLETION_DAILY",
        timestamp: { gte: wellnessWindowStart },
      },
    })
    
    let wellnessResetDate: Date | null = null
    if (wellnessUsed >= wellnessLimit) {
      const oldestLog = await prisma.technicalLimitLog.findFirst({
        where: {
          userId,
          action: "WELLNESS_COMPLETION_DAILY",
          timestamp: { gte: wellnessWindowStart },
        },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true },
      })
      if (oldestLog) {
        wellnessResetDate = new Date(oldestLog.timestamp.getTime() + wellnessWindowMs)
      }
    }

    // --- 2. Assessments submitted (ASSESSMENT_SUBMIT_WEEKLY) ---
    // limit: Free 5, Premium 20. Window: 7 days.
    const assessmentLimit = isPremium ? 20 : 5
    const assessmentWindowMs = 7 * 24 * 60 * 60 * 1000
    const assessmentWindowStart = new Date(now.getTime() - assessmentWindowMs)
    const assessmentUsed = await prisma.technicalLimitLog.count({
      where: {
        userId,
        action: "ASSESSMENT_SUBMIT_WEEKLY",
        timestamp: { gte: assessmentWindowStart },
      },
    })

    let assessmentResetDate: Date | null = null
    if (assessmentUsed >= assessmentLimit) {
      const oldestLog = await prisma.technicalLimitLog.findFirst({
        where: {
          userId,
          action: "ASSESSMENT_SUBMIT_WEEKLY",
          timestamp: { gte: assessmentWindowStart },
        },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true },
      })
      if (oldestLog) {
        assessmentResetDate = new Date(oldestLog.timestamp.getTime() + assessmentWindowMs)
      }
    }

    return NextResponse.json({
      plan,
      usage: {
        activities: {
          used: wellnessUsed,
          limit: wellnessLimit,
          remaining: Math.max(0, wellnessLimit - wellnessUsed),
          resetDate: wellnessResetDate?.toISOString() || null,
        },
        assessments: {
          used: assessmentUsed,
          limit: assessmentLimit,
          remaining: Math.max(0, assessmentLimit - assessmentUsed),
          resetDate: assessmentResetDate?.toISOString() || null,
        },
        read: {
          used: 0,
          limit: "unlimited",
          remaining: "unlimited",
          resetDate: null,
        },
        listen: {
          used: 0,
          limit: "unlimited",
          remaining: "unlimited",
          resetDate: null,
        }
      }
    })
  } catch (error) {
    console.error("GET /api/patient/limits error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
