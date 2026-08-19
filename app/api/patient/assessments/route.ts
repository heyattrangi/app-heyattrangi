import { NextResponse } from 'next/server'
import { auth } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { enforceLimit } from "@/lib/limits/checkLimits"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        const userId = session.user.id

        const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        })
        const plan = dbUser?.plan || "FREE"

        const weeklyCheck = await enforceLimit({
            userId,
            action: "ASSESSMENT_SUBMIT_WEEKLY",
            plan,
            limitFree: 5,
            limitPremium: 20,
            windowMs: 7 * 24 * 60 * 60 * 1000,
            errorMessage: "Weekly assessment limit reached. You can take 5 assessments per week on the free plan.",
        })
        if (!weeklyCheck.allowed) {
            return NextResponse.json(
                { error: "LIMIT_EXCEEDED", message: weeklyCheck.message, resetInSeconds: weeklyCheck.resetInSeconds },
                { status: 429 }
            )
        }

        const body = await req.json()
        
        console.log("Saving Assessment Result:", body)

        // Save completed assessment results to MongoDB for future personalization
        const db: any = prisma
        const saved = await db.patientAssessmentResult.create({
            data: {
                userId,
                assessmentId: body.assessmentId || "unknown",
                date: body.date || new Date().toISOString().split('T')[0],
                results: body, // store full payload
            }
        })

        return NextResponse.json({ success: true, message: "Assessment saved successfully.", id: saved.id })
    } catch (error) {
        console.error("Error saving assessment:", error)
        return NextResponse.json({ error: "Failed to save assessment" }, { status: 500 })
    }
}

