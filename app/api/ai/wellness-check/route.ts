import { NextResponse } from "next/server"
import { auth } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { enforceSharedLimit } from "@/lib/limits/checkLimits"

/**
 * POST /api/ai/wellness-check
 *
 * Handles the dynamic Mind Matrix / Wellness Screening Form submission.
 * Enforces a shared 5/week assessment pool together with normal assessments
 * (ASSESSMENT_SUBMIT_WEEKLY) so both types draw from the same limit.
 */
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch user plan for limit check
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const plan = dbUser?.plan || "FREE"

    // Enforce combined weekly assessment limit (normal + dynamic = max 5/week)
    const weeklyCheck = await enforceSharedLimit({
      userId,
      action: "DYNAMIC_ASSESSMENT_WEEKLY",
      countActions: ["ASSESSMENT_SUBMIT_WEEKLY", "DYNAMIC_ASSESSMENT_WEEKLY"],
      plan,
      limitFree: 5,
      limitPremium: 5,
      windowMs: 7 * 24 * 60 * 60 * 1000,
      errorMessage:
        "Weekly assessment limit reached. You can take up to 5 assessments per week (normal + dynamic combined).",
    })

    if (!weeklyCheck.allowed) {
      return NextResponse.json(
        {
          error: "LIMIT_EXCEEDED",
          message: weeklyCheck.message,
          resetInSeconds: weeklyCheck.resetInSeconds,
        },
        { status: 429 }
      )
    }

    const body = await req.json()

    // --- Compute risk level from screening answers ---
    const riskLevel = computeRiskLevel(body)

    return NextResponse.json({ success: true, riskLevel })
  } catch (error) {
    console.error("Error processing wellness check:", error)
    return NextResponse.json({ error: "Failed to process wellness check" }, { status: 500 })
  }
}

/**
 * Derives a simple risk band from the wellness screening payload.
 * Returns one of: "Low" | "Moderate" | "High" | "Urgent"
 */
function computeRiskLevel(data: any): string {
  // Immediate escalation if safety flags are set
  if (
    data?.safety?.harm === "Yes" ||
    data?.safety?.unsafe === "Yes" ||
    data?.safety?.psychosis === "Yes"
  ) {
    return "Urgent"
  }

  const difficultAreas: string[] = data?.wellbeing?.difficultAreas || []
  const wellbeingScore: string = data?.wellbeing?.score || ""

  // Map wellbeing score
  const scoreWeightMap: Record<string, number> = {
    "Very good": 0,
    Good: 1,
    Fair: 2,
    Poor: 3,
  }
  const scoreWeight = scoreWeightMap[wellbeingScore] ?? 1

  // Each difficult area adds 1 point; Poor wellbeing + many areas = High/Urgent
  const areaWeight = difficultAreas.length

  const totalWeight = scoreWeight + areaWeight

  if (totalWeight <= 1) return "Low"
  if (totalWeight <= 3) return "Moderate"
  if (totalWeight <= 5) return "High"
  return "Urgent"
}
