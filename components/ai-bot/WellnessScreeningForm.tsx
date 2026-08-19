"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import MindMatrixResult from "@/components/ai-bot/MindMatrixResult"

// --- TYPES ---
type ScreeningData = {
    // Section 0
    userContext: { status?: string; ageRange?: string }
    // Section 1
    safety: { harm: string; unsafe: string; psychosis: string }
    // Section 2
    wellbeing: { score?: string; difficultAreas: string[] }
    // Modules (simplified storage)
    modules: Record<string, any>
    // Section 3
    background: { childhood: string; previousSupport: string; willingToSpeak: string }
}

const INITIAL_DATA: ScreeningData = {
    userContext: {},
    safety: { harm: "", unsafe: "", psychosis: "" },
    wellbeing: { difficultAreas: [] },
    modules: {},
    background: { childhood: "", previousSupport: "", willingToSpeak: "" },
}

// --- QUESTIONS CONFIG ---
// (We can extract this to a separate file later if it gets too large)

const STEPS = [
    { id: "context", title: "About You" },
    { id: "safety", title: "Safety Check" },
    { id: "wellbeing", title: "Wellbeing" },
    { id: "modules", title: "Deep Dive" }, // Dynamic based on wellbeing
    { id: "background", title: "Background" },
]

/** Seconds allowed per step — presentation only; does not affect scoring or API payload. */
const STEP_TIMER_SECONDS = 120

function formatMmSs(totalSeconds: number) {
    const s = Math.max(0, Math.floor(totalSeconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, "0")}`
}

export default function WellnessScreeningForm() {
    const searchParams = useSearchParams()
    const resultParam = searchParams.get("result")
    const router = useRouter()

    const [step, setStep] = useState(0)
    const [secondsRemaining, setSecondsRemaining] = useState(STEP_TIMER_SECONDS)
    const [data, setData] = useState<ScreeningData>(INITIAL_DATA)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showSafetyWarning, setShowSafetyWarning] = useState(false)
    const [submittedRiskLevel, setSubmittedRiskLevel] = useState<string | null>(
        () => (resultParam && resultParam.trim() ? resultParam.trim() : null)
    )
    const [limitExceeded, setLimitExceeded] = useState(false)
    const [limitResetDate, setLimitResetDate] = useState<string | null>(null)

    // Check weekly assessment limit on mount
    useEffect(() => {
        fetch("/api/patient/limits")
            .then((r) => r.json())
            .then((data) => {
                if (data?.usage?.assessments?.remaining === 0) {
                    setLimitExceeded(true)
                    setLimitResetDate(data.usage.assessments.resetDate || null)
                }
            })
            .catch(() => {
                // Silently ignore — allow form to render if check fails
            })
    }, [])

    // --- HANDLERS ---
    const handleNext = () => {
        // Safety Check Logic
        if (step === 1) {
            if (data.safety.harm === "Yes" || data.safety.unsafe === "Yes" || data.safety.psychosis === "Yes") {
                setShowSafetyWarning(true)
                return
            }
        }
        setStep((prev) => Math.min(prev + 1, STEPS.length - 1))
    }

    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 0))
    }

    const updateData = (section: keyof ScreeningData, key: string, value: any) => {
        setData((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value,
            },
        }))
    }

    const toggleArrayItem = (section: keyof ScreeningData, key: string, item: string) => {
        setData((prev) => {
            const currentArray = (prev[section] as any)[key] || []
            const newArray = currentArray.includes(item)
                ? currentArray.filter((i: string) => i !== item)
                : [...currentArray, item]
            return {
                ...prev,
                [section]: {
                    ...prev[section],
                    [key]: newArray,
                },
            }
        })
    }

    useEffect(() => {
        setSecondsRemaining(STEP_TIMER_SECONDS)
    }, [step])

    useEffect(() => {
        const id = window.setInterval(() => {
            setSecondsRemaining((prev) => (prev <= 0 ? 0 : prev - 1))
        }, 1000)
        return () => window.clearInterval(id)
    }, [])

    // Submit Handler
    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            const res = await fetch("/api/ai/wellness-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (res.status === 429) {
                // Limit was hit concurrently — show locked state
                setLimitExceeded(true)
                const json = await res.json().catch(() => ({}))
                setLimitResetDate(null)
                console.warn("Assessment weekly limit reached:", json.message)
                return
            }
            if (res.ok) {
                const json = await res.json()
                const level =
                    typeof json.riskLevel === "string"
                        ? json.riskLevel
                        : "Moderate"
                setSubmittedRiskLevel(level)
            }
        } catch (error) {
            console.error("Submission failed", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Limit-exceeded gate ---
    if (limitExceeded) {
        const formattedReset = limitResetDate
            ? new Date(limitResetDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
              })
            : null

        return (
            <div className="mx-auto max-w-2xl space-y-6 p-8 text-center">
                <div
                    className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
                >
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                    Weekly limit reached
                </h2>
                <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
                    You can take up to <strong>5 assessments per week</strong> (normal + dynamic combined).
                    {formattedReset
                        ? <> Your limit resets on <strong>{formattedReset}</strong>.</>
                        : " Your limit will reset in 7 days from your first assessment this week."}
                </p>
                <button
                    type="button"
                    onClick={() => router.push("/patient/library")}
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "var(--color-brand)" }}
                >
                    Back to Library
                </button>
            </div>
        )
    }

    if (submittedRiskLevel) {
        return <MindMatrixResult riskLevel={submittedRiskLevel} />
    }

    if (showSafetyWarning) {
        return (
            <div className="mx-auto max-w-2xl space-y-6 p-8 text-center">
                <div
                    className="inline-flex h-16 w-16 items-center justify-center rounded-full text-[var(--color-accent)]"
                    style={{ background: "var(--color-accent-light)" }}
                >
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Safety first</h2>
                <p className="text-lg text-[var(--color-text-secondary)]">
                    It looks like you might need immediate support. Please reach out to emergency services or a trusted contact right away.
                </p>
                <div className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] p-6 text-left">
                    <p className="font-semibold text-[var(--color-text-primary)]">Helplines</p>
                    <ul className="list-disc pl-5 text-[var(--color-text-secondary)]">
                        <li>Emergency: 112</li>
                        <li>Suicide prevention: 988</li>
                    </ul>
                </div>
                <button
                    type="button"
                    onClick={() => { window.location.href = "/patient/dashboard" }}
                    className="w-full rounded-[var(--radius-md)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-95"
                    style={{ background: "var(--color-brand)" }}
                >
                    Back to dashboard
                </button>
            </div>
        )
    }

    const timerColor =
        secondsRemaining > 60
            ? "var(--color-accent)"
            : secondsRemaining < 30
              ? "var(--color-warning)"
              : "var(--color-text-secondary)"

    return (
        <div className="mx-auto w-full max-w-3xl pb-12">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <p
                        className="text-[var(--color-text-secondary)]"
                        style={{ fontSize: "var(--text-sm)" }}
                    >
                        Question {step + 1} of {STEPS.length}
                    </p>
                    <div
                        className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--color-border)]"
                        role="progressbar"
                        aria-valuenow={step + 1}
                        aria-valuemin={1}
                        aria-valuemax={STEPS.length}
                    >
                        <motion.div
                            className="h-full bg-[var(--color-brand)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                    </div>
                </div>
                <div
                    className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 tabular-nums"
                    style={{
                        fontSize: "var(--text-base)",
                        fontWeight: 600,
                        color: timerColor,
                    }}
                    aria-label={`Time remaining ${formatMmSs(secondsRemaining)}`}
                >
                    {formatMmSs(secondsRemaining)}
                </div>
            </div>

            <div className="mx-auto max-w-[600px] rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-[32px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="space-y-8"
                    >
                        {step === 0 && (
                            <Section0 data={data} updateData={updateData} />
                        )}
                        {step === 1 && (
                            <Section1 data={data} updateData={updateData} />
                        )}
                        {step === 2 && (
                            <Section2 data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} />
                        )}
                        {step === 3 && (
                            <SectionModules data={data} updateData={updateData} />
                        )}
                        {step === 4 && (
                            <Section3 data={data} updateData={updateData} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="mt-12 flex justify-between border-t border-[var(--color-border)] pt-6">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={step === 0}
                    className="px-6 py-2 font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                    Back
                </button>
                {step === STEPS.length - 1 ? (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 rounded-[var(--radius-md)] px-8 py-2 font-semibold text-white transition-opacity disabled:opacity-70"
                        style={{ background: "var(--color-brand)" }}
                    >
                        {isSubmitting ? "Generating Report..." : "Complete Check-in"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleNext}
                        className="rounded-[var(--radius-md)] px-8 py-2 font-semibold text-white transition-opacity hover:opacity-95"
                        style={{ background: "var(--color-brand)" }}
                    >
                        Next
                    </button>
                )}
            </div>
        </div>
    )
}

// --- SUB-COMPONENTS (Can extract later) ---

function Section0({ data, updateData }: any) {
    return (
        <div className="space-y-6">
            <h2
                className="font-semibold text-[var(--color-text-primary)]"
                style={{ fontSize: "var(--text-2xl)" }}
            >
                Let&apos;s get to know you
            </h2>
            <Question
                label="What best describes you?"
                options={["Student", "Working adult", "Not currently working", "Prefer not to say"]}
                selected={data.userContext.status}
                onSelect={(val) => updateData("userContext", "status", val)}
            />
            <Question
                label="Age range"
                options={["Under 18", "18–24", "25–40", "41–60", "60+"]}
                selected={data.userContext.ageRange}
                onSelect={(val) => updateData("userContext", "ageRange", val)}
            />
        </div>
    )
}

function Section1({ data, updateData }: any) {
    return (
        <div className="space-y-6">
            <div className="bg-amber-50 p-4 rounded-lg text-amber-800 text-sm mb-4">
                We ask these questions to ensure your safety. Your answers are private.
            </div>
            <Question
                label="In the past two weeks, have you had thoughts about harming yourself?"
                options={["No", "Yes"]}
                selected={data.safety.harm}
                onSelect={(val) => updateData("safety", "harm", val)}
                highlight="No"
            />
            <Question
                label="Have you felt unsafe or unable to keep yourself safe?"
                options={["No", "Yes"]}
                selected={data.safety.unsafe}
                onSelect={(val) => updateData("safety", "unsafe", val)}
                highlight="No"
            />
            <Question
                label="Are you experiencing things others don’t seem to (voices, visions)?"
                options={["No", "Yes"]}
                selected={data.safety.psychosis}
                onSelect={(val) => updateData("safety", "psychosis", val)}
                highlight="No"
            />
        </div>
    )
}

function Section2({ data, updateData, toggleArrayItem }: any) {
    return (
        <div className="space-y-6">
            <h2
                className="font-semibold text-[var(--color-text-primary)]"
                style={{ fontSize: "var(--text-2xl)" }}
            >
                How have you been feeling?
            </h2>
            <Question
                label="Over the past two weeks, how would you rate your overall wellbeing?"
                options={["Very good", "Good", "Fair", "Poor"]}
                selected={data.wellbeing.score}
                onSelect={(val) => updateData("wellbeing", "score", val)}
            />

            <div className="space-y-3">
                <label
                    className="block font-medium text-[var(--color-text-primary)]"
                    style={{ fontSize: "var(--text-xl)", lineHeight: "var(--leading-loose)" }}
                >
                    Which areas have been difficult recently? (Select all that apply)
                </label>
                <div className="flex flex-col gap-[10px]">
                    {[
                        "Mood / emotions", "Worry or fear", "Focus or attention", "Sleep",
                        "Stress or burnout", "Trauma or loss", "Eating or body image",
                        "Substance use", "Anger or impulse control"
                    ].map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggleArrayItem("wellbeing", "difficultAreas", opt)}
                            className={`w-full rounded-[var(--radius-md)] px-5 py-[14px] text-left transition-colors ${data.wellbeing.difficultAreas.includes(opt)
                                ? "border-2 border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-text-primary)]"
                                : "border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] hover:border-[var(--color-brand)]"
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

// Module mapping logic is crucial here
const MODULE_QUESTIONS = {
    "Mood / emotions": [
        { q: "How often have you felt low, sad, or down?", key: "q3_1" },
        { q: "How often have you lost interest in things?", key: "q3_2" },
    ],
    "Worry or fear": [
        { q: "How often have you felt nervous, anxious, or on edge?", key: "q4_1" },
        { q: "Hard to stop worrying?", key: "q4_2" },
    ],
    // ... Add more mappings based on request. 
    // For brevity in this initial pass, I'll map a few key modules.
}

function SectionModules({ data, updateData }: any) {
    const selectedAreas: string[] = data.wellbeing.difficultAreas || []

    if (selectedAreas.length === 0) {
        return (
            <div className="py-12 text-center">
                <h3 className="font-medium text-[var(--color-text-primary)]" style={{ fontSize: "var(--text-xl)" }}>
                    Great to hear things are steady.
                </h3>
                <p className="mt-2 text-[var(--color-text-secondary)]" style={{ fontSize: "var(--text-base)" }}>
                    We can skip the deep dive section.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <h2
                className="font-semibold text-[var(--color-text-primary)]"
                style={{ fontSize: "var(--text-2xl)" }}
            >
                Let&apos;s explore a bit more
            </h2>
            {selectedAreas.map((area) => (
                <div key={area} className="border-t border-[var(--color-border)] pt-6 first:border-0 first:pt-0">
                    <h3
                        className="mb-4 font-semibold text-[var(--color-accent)]"
                        style={{ fontSize: "var(--text-lg)" }}
                    >
                        {area}
                    </h3>
                    <div className="space-y-6">
                        <ModuleQuestionsForArea area={area} data={data} updateData={updateData} />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ModuleQuestionsForArea({ area, data, updateData }: any) {
    const commonOptions = ["Not at all", "Several days", "More than half days", "Nearly every day"]

    // Simple switch to render correct questions. In a full app, I'd use the config object above more strictly.
    if (area === "Mood / emotions") {
        return (
            <>
                <Question label="How often have you felt low, sad, or down?" options={commonOptions}
                    selected={data.modules["mood_low"]} onSelect={(v) => updateData("modules", "mood_low", v)} />
                <Question label="Lost interest or pleasure in things you usually enjoy?" options={commonOptions}
                    selected={data.modules["mood_interest"]} onSelect={(v) => updateData("modules", "mood_interest", v)} />
                <Question label="Felt tired or lacking energy?" options={commonOptions}
                    selected={data.modules["mood_energy"]} onSelect={(v) => updateData("modules", "mood_energy", v)} />
                <Question label="How much have these feelings affected your daily life?" options={["Not at all", "A little", "A lot", "Extremely"]}
                    selected={data.modules["mood_impact"]} onSelect={(v) => updateData("modules", "mood_impact", v)} />
            </>
        )
    }
    if (area === "Worry or fear") {
        return (
            <>
                <Question label="How often have you felt nervous, anxious, or on edge?" options={commonOptions}
                    selected={data.modules["anx_nervous"]} onSelect={(v) => updateData("modules", "anx_nervous", v)} />
                <Question label="How often have you found it hard to stop worrying?" options={commonOptions}
                    selected={data.modules["anx_worry"]} onSelect={(v) => updateData("modules", "anx_worry", v)} />
                <Question label="Do you avoid certain situations because of fear or discomfort?" options={["No", "Sometimes", "Often"]}
                    selected={data.modules["anx_avoid"]} onSelect={(v) => updateData("modules", "anx_avoid", v)} />
                <Question label="Have you experienced sudden waves of intense fear or panic?" options={["No", "Yes"]}
                    selected={data.modules["anx_panic"]} onSelect={(v) => updateData("modules", "anx_panic", v)} />
            </>
        )
    }
    if (area === "Stress or burnout") {
        return (
            <>
                <Question label="How often have you felt overwhelmed by responsibilities?" options={["Rarely", "Sometimes", "Often", "Almost always"]}
                    selected={data.modules["stress_overwhelmed"]} onSelect={(v) => updateData("modules", "stress_overwhelmed", v)} />
                <Question label="Do you feel emotionally drained at the end of the day?" options={["No", "Sometimes", "Yes"]}
                    selected={data.modules["stress_drained"]} onSelect={(v) => updateData("modules", "stress_drained", v)} />
                <Question label="Do you feel pressure to perform or meet expectations constantly?" options={["No", "Yes"]}
                    selected={data.modules["stress_pressure"]} onSelect={(v) => updateData("modules", "stress_pressure", v)} />
            </>
        )
    }
    if (area === "Focus or attention") {
        return (
            <>
                <div
                    className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-accent-light)] p-4 text-[var(--color-text-primary)]"
                    style={{ fontSize: "var(--text-sm)" }}
                >
                    Screening only — not an assessment.
                </div>
                <Question label="Do you struggle to stay focused on tasks?" options={["No", "Sometimes", "Often"]}
                    selected={data.modules["focus_struggle"]} onSelect={(v) => updateData("modules", "focus_struggle", v)} />
                <Question label="Do you find it hard to organize tasks or manage time?" options={["No", "Sometimes", "Often"]}
                    selected={data.modules["focus_organize"]} onSelect={(v) => updateData("modules", "focus_organize", v)} />
                <Question label="Have these difficulties been present since childhood?" options={["No", "Yes", "Not sure"]}
                    selected={data.modules["focus_childhood"]} onSelect={(v) => updateData("modules", "focus_childhood", v)} />
            </>
        )
    }
    if (area === "Sleep") {
        return (
            <>
                <Question label="How would you describe your sleep quality?" options={["Good", "Fair", "Poor"]}
                    selected={data.modules["sleep_qual"]} onSelect={(v) => updateData("modules", "sleep_qual", v)} />
                <Question label="Do you have trouble falling or staying asleep?" options={["No", "Yes"]}
                    selected={data.modules["sleep_trouble"]} onSelect={(v) => updateData("modules", "sleep_trouble", v)} />
                <Question label="Do you feel rested during the day?" options={["Yes", "No"]}
                    selected={data.modules["sleep_rested"]} onSelect={(v) => updateData("modules", "sleep_rested", v)} />
            </>
        )
    }
    if (area === "Trauma or loss") {
        return (
            <>
                <Question label="Have you experienced a distressing or traumatic event?" options={["No", "Yes"]}
                    selected={data.modules["trauma_event"]} onSelect={(v) => updateData("modules", "trauma_event", v)} />
                <Question label="Do reminders of that event cause strong emotional reactions?" options={["No", "Sometimes", "Often"]}
                    selected={data.modules["trauma_reaction"]} onSelect={(v) => updateData("modules", "trauma_reaction", v)} />
                <Question label="Do you avoid places, people, or thoughts related to it?" options={["No", "Yes"]}
                    selected={data.modules["trauma_avoid"]} onSelect={(v) => updateData("modules", "trauma_avoid", v)} />
            </>
        )
    }
    if (area === "Eating or body image") {
        return (
            <>
                <Question label="Are you concerned about your eating habits?" options={["No", "Yes"]}
                    selected={data.modules["eating_habits"]} onSelect={(v) => updateData("modules", "eating_habits", v)} />
                <Question label="Do you feel distressed about your body or weight?" options={["No", "Sometimes", "Often"]}
                    selected={data.modules["eating_distress"]} onSelect={(v) => updateData("modules", "eating_distress", v)} />
                <Question label="Have eating habits affected your health or daily life?" options={["No", "Yes"]}
                    selected={data.modules["eating_impact"]} onSelect={(v) => updateData("modules", "eating_impact", v)} />
            </>
        )
    }
    if (area === "Substance use") {
        return (
            <>
                <Question label="Do you use alcohol, tobacco, or other substances?" options={["No", "Occasionally", "Regularly"]}
                    selected={data.modules["substance_use"]} onSelect={(v) => updateData("modules", "substance_use", v)} />
                <Question label="Have you felt a loss of control over use?" options={["No", "Yes"]}
                    selected={data.modules["substance_control"]} onSelect={(v) => updateData("modules", "substance_control", v)} />
                <Question label="Has substance use caused problems in your life?" options={["No", "Yes"]}
                    selected={data.modules["substance_impact"]} onSelect={(v) => updateData("modules", "substance_impact", v)} />
            </>
        )
    }
    if (area === "Anger or impulse control") {
        return (
            <>
                <Question label="How often do you feel intense anger?" options={["Rarely", "Sometimes", "Often"]}
                    selected={data.modules["anger_freq"]} onSelect={(v) => updateData("modules", "anger_freq", v)} />
                <Question label="Do you act impulsively when upset?" options={["No", "Sometimes", "Yes"]}
                    selected={data.modules["anger_impulse"]} onSelect={(v) => updateData("modules", "anger_impulse", v)} />
                <Question label="Have these reactions caused regret or problems?" options={["No", "Yes"]}
                    selected={data.modules["anger_regret"]} onSelect={(v) => updateData("modules", "anger_regret", v)} />
            </>
        )
    }

    return (
        <p className="italic text-[var(--color-text-secondary)]" style={{ fontSize: "var(--text-sm)" }}>
            Questions for {area} will appear here.
        </p>
    )
}


function Section3({ data, updateData }: any) {
    return (
        <div className="space-y-6">
            <h2
                className="font-semibold text-[var(--color-text-primary)]"
                style={{ fontSize: "var(--text-2xl)" }}
            >
                Background
            </h2>
            <Question
                label="Have these challenges been present since childhood?"
                options={["No", "Yes"]}
                selected={data.background.childhood}
                onSelect={(val) => updateData("background", "childhood", val)}
            />
            <Question
                label="Have you ever received mental health support before?"
                options={["No", "Yes"]}
                selected={data.background.previousSupport}
                onSelect={(val) => updateData("background", "previousSupport", val)}
            />
            <Question
                label="Would you consider speaking to a professional if needed?"
                options={["Yes", "Maybe", "No"]}
                selected={data.background.willingToSpeak}
                onSelect={(val) => updateData("background", "willingToSpeak", val)}
            />
        </div>
    )
}

type QuestionProps = {
    label: string
    options: string[]
    selected?: string
    onSelect: (value: string) => void
    highlight?: string
}

function Question({ label, options, selected, onSelect, highlight: _highlight }: QuestionProps) {
    return (
        <div className="space-y-3">
            <label
                className="block text-[var(--color-text-primary)]"
                style={{
                    fontSize: "var(--text-xl)",
                    fontWeight: 500,
                    lineHeight: "var(--leading-loose)",
                }}
            >
                {label}
            </label>
            <div className="flex flex-col gap-[10px]">
                {options.map((opt: string) => {
                    const isSelected = selected === opt
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onSelect(opt)}
                            className={`w-full rounded-[var(--radius-md)] px-5 py-[14px] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                                isSelected
                                    ? "border-2 border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-text-primary)]"
                                    : "border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] hover:border-[var(--color-brand)]"
                            }`}
                        >
                            {opt}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
