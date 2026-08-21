"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import TermsAndConditionsContent from "@/components/legal/TermsAndConditionsContent"
import AiTransparencyStatementContent from "@/components/legal/AiTransparencyStatementContent"
import DataProcessingConsentContent from "@/components/legal/DataProcessingConsentContent"
import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent"

type OnboardingData = {
    dob: string
    age: string
    orgId: string
    mood: string
    experience: string
    reasons: string[]
    emergencyContact: string
    emergencyPhone: string
    consentAgreed: boolean
    name?: string
    preferredLanguage?: string
    heardAboutUs?: string
    ageRange?: "16-17" | "18-20" | "21-24" | "25+"
}

export default function PatientOnboarding() {
    const router = useRouter()
    const { data: session } = useSession()

    const [step, setStep] = useState(0)
    const [data, setData] = useState<OnboardingData>({
        dob: "",
        age: "",
        orgId: "",
        mood: "",
        experience: "",
        reasons: [],
        emergencyContact: "",
        emergencyPhone: "",
        consentAgreed: false,
        name: "",
        preferredLanguage: "English",
        heardAboutUs: "",
    })

    useEffect(() => {
        if (session?.user?.name) {
            setData((prev) => ({
                ...prev,
                name: prev.name || session.user.name || ""
            }))
        }
    }, [session])
    const [isLoading, setIsLoading] = useState(false)
    const [showTermsModal, setShowTermsModal] = useState(false)
    const [showPrivacyModal, setShowPrivacyModal] = useState(false)
    const [showAiModal, setShowAiModal] = useState(false)
    const [showDataConsentModal, setShowDataConsentModal] = useState(false)
    const [showTrustSafetyModal, setShowTrustSafetyModal] = useState(false)
    const [showAllPolicies, setShowAllPolicies] = useState(false)

    // Pricing & Payment State
    const [selectedPlan, setSelectedPlan] = useState<"ESSENTIAL" | "PREMIUM">("PREMIUM")
    const [isProcessingPayment, setIsProcessingPayment] = useState(false)

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script")
            script.src = "https://checkout.razorpay.com/v1/checkout.js"
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handlePayment = async (amount: number) => {
        setIsProcessingPayment(true)
        try {
            const isLoaded = await loadRazorpayScript()
            if (!isLoaded) {
                alert("Razorpay SDK failed to load. Are you online?")
                return
            }

            const orderRes = await fetch("/api/payments/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan: "PREMIUM",
                    amount,
                }),
            })

            const orderData = await orderRes.json()
            if (!orderData.success) throw new Error(orderData.error || "Failed to initiate payment")

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_T2HN6tpPOHf8Mw",
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Hey Attrangi",
                description: `PREMIUM Plan Subscription`,
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    try {
                        const verifyRes = await fetch("/api/payments/subscribe/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                plan: "PREMIUM",
                                amount,
                            }),
                        })

                        const verifyData = await verifyRes.json()
                        if (verifyData.success) {
                            alert(`Successfully subscribed to PREMIUM plan!`)
                            setStep(4)
                        } else {
                            alert(verifyData.error || "Payment verification failed.")
                        }
                    } catch (err: any) {
                        console.error("Verification error:", err)
                        alert(err.message || "Failed to verify payment.")
                    }
                },
                prefill: {
                    name: session?.user?.name || "",
                    email: session?.user?.email || "",
                },
                theme: {
                    color: "#e26843",
                },
            }

            const rzp = new (window as any).Razorpay(options)
            rzp.on("payment.failed", function (response: any) {
                const reason = response?.error?.description || "Payment was declined"
                void fetch("/api/payments/notify-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "FAILED",
                        amount,
                        description: `PREMIUM plan subscription`,
                        paymentId: response?.error?.metadata?.payment_id || null,
                        orderId: orderData.orderId,
                        reason,
                    }),
                }).catch(() => {})
                alert(`Payment Failed: ${reason}`)
            })
            rzp.open()
        } catch (error: any) {
            console.error("Payment error:", error)
            alert(error.message || "An error occurred during payment initiation.")
        } finally {
            setIsProcessingPayment(false)
        }
    }

    const handleNext = () => {
        setStep((s) => s + 1)
    }

    const handleBack = () => {
        setStep((s) => s - 1)
    }

    const handleFinish = async (action: "chat" | "dashboard") => {
        setIsLoading(true)

        // Specifically handle the already-onboarded case so it does not block navigation
        if ((session?.user as any)?.role === "PATIENT") {
            if (action === "chat") {
                router.push("/patient/ai-bot")
            } else {
                router.push("/patient/dashboard")
            }
            return
        }

        try {
            const response = await fetch("/api/onboarding/patient", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    age: data.age,
                    dob: data.dob,
                    orgId: data.orgId === "none" ? undefined : data.orgId,
                    gender: "Not specified",
                    healthConcerns: data.reasons,
                    emergencyContact: data.emergencyContact,
                    emergencyPhone: data.emergencyPhone,
                    preferredLanguage: data.preferredLanguage,
                    heardAboutUs: data.heardAboutUs,
                }),
            })

            if (response.ok) {
                if (action === "chat") {
                    router.push("/patient/ai-bot")
                } else {
                    router.push("/patient/dashboard")
                }
            } else {
                alert("Something went wrong.")
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    const userName = data.name?.split(" ")[0] || session?.user?.name?.split(" ")[0] || "Sam"

    const isContinueDisabled =
        (step === 0 && (!data.name?.trim() || !data.ageRange)) ||
        (step === 1 && (!data.emergencyContact || !data.emergencyPhone || data.emergencyPhone.length !== 10 || !data.consentAgreed))

    if (step === 3) {
        return (
            <OnboardingCompanionScreen 
                userName={userName}
                isLoading={isLoading}
                handleFinish={handleFinish}
            />
        )
    }

    return (
        <div className="min-h-screen w-full flex bg-white font-sans relative overflow-hidden">
            {/* Left Branding Panel */}
            <div className="hidden lg:flex lg:w-[60%] xl:w-[65%] relative overflow-hidden flex-col justify-between p-12 xl:p-16 bg-[#fafafa]">
                {/* Animated glowing background lines - Attrangi style */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <style dangerouslySetInnerHTML={{__html: `
                        @keyframes shine-sweep {
                            0% { transform: translateX(-100vw) rotate(-15deg); }
                            100% { transform: translateX(100vw) rotate(-15deg); }
                        }
                    `}} />
                    {/* Base gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white via-[#fff4ec] to-[#ffe8d6] opacity-80"></div>
                    
                    {/* Animated floating blobs (shine effect) */}
                    <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-br from-[#ff6b00]/20 to-transparent rounded-full blur-[80px] animate-[pulse_4s_ease-in-out_infinite]"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-[#ff9800]/20 to-transparent rounded-full blur-[80px] animate-[pulse_5s_ease-in-out_infinite] [animation-delay:2s]"></div>
                    <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-[#ff5252]/10 rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite] [animation-delay:1s]"></div>
                    
                    {/* Static Diagonal bands for structure */}
                    <div className="absolute top-[-50%] left-[0%] w-[15%] h-[200%] bg-white/30 -rotate-[15deg] mix-blend-overlay"></div>
                    <div className="absolute top-[-50%] left-[25%] w-[8%] h-[200%] bg-white/40 -rotate-[15deg] mix-blend-overlay"></div>
                    <div className="absolute top-[-50%] left-[45%] w-[12%] h-[200%] bg-white/20 -rotate-[15deg] mix-blend-overlay"></div>
                    <div className="absolute top-[-50%] left-[70%] w-[20%] h-[200%] bg-white/30 -rotate-[15deg] mix-blend-overlay"></div>

                    {/* Sweeping shining lights perfectly matching the band tilt */}
                    <div className="absolute top-[-50%] bottom-[-50%] w-[40%] h-[200%] bg-gradient-to-r from-transparent via-white/50 to-transparent mix-blend-overlay animate-[shine-sweep_7s_infinite_linear]"></div>
                    <div className="absolute top-[-50%] bottom-[-50%] w-[20%] h-[200%] bg-gradient-to-r from-transparent via-white/70 to-transparent mix-blend-overlay animate-[shine-sweep_11s_infinite_linear_3s]"></div>
                </div>

                <div className="relative z-10 w-fit flex items-center gap-3">
                    <div className="w-8 h-8 grid grid-cols-2 grid-rows-2 gap-[2px]">
                        <div className="bg-[#FFC107] rounded-tl-[4px]"></div>
                        <div className="bg-[#FF5252] rounded-tr-[4px]"></div>
                        <div className="bg-[#FF9800] rounded-bl-[4px]"></div>
                        <div className="bg-[#E64A19] rounded-br-[4px]"></div>
                    </div>
                    <span className="font-extrabold text-2xl tracking-tighter text-gray-900">Hey Attrangi!</span>
                </div>

                <div className="relative z-10 mt-auto">
                    <h2 className="text-2xl xl:text-[28px] font-bold text-[#14293f] leading-snug tracking-tight mb-6 max-w-2xl">
                        Join the community with thousands of people already trusting the website
                    </h2>
                    <div className="flex flex-wrap items-center gap-8 text-[15px] font-semibold text-[#14293f]">
                         <div className="flex items-center gap-2">
                            <span className="text-xl leading-none font-light text-[#ff6b00]">✧</span> 24/7 AI Companion
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-xl leading-none font-light text-[#ff6b00]">✧</span> Verified Therapists
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-xl leading-none font-light text-[#ff6b00]">✧</span> Personalized Care
                         </div>
                    </div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className={`w-full lg:w-[40%] xl:w-[35%] flex items-start lg:items-center justify-center px-5 pt-4 pb-6 sm:px-10 sm:py-10 md:p-12 bg-white relative overflow-y-auto min-h-screen ${step === 2 ? "lg:overflow-hidden" : ""}`}>
                <div className={`w-full max-w-[450px] flex flex-col ${step === 2 ? "min-h-0 lg:min-h-0 gap-3" : "min-h-[calc(100dvh-2rem)] lg:min-h-[550px] gap-8"}`}>
                    <div className={`w-full ${step === 2 ? "flex flex-col" : "flex-1"}`}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="w-full"
                            >
                                <div className="w-full z-10 text-left">
                                    {step === 0 && (
                                        <PersonalizationScreen
                                            data={data}
                                            onChange={(fields) => setData({ ...data, ...fields })}
                                            onBack={() => router.back()}
                                        />
                                    )}
                                    {step === 1 && (
                                        <ConsentScreen
                                            data={data}
                                            onChange={(fields) => setData({ ...data, ...fields })}
                                        />
                                    )}
                                    {step === 2 && (
                                        <PricingScreen
                                            onOpenTerms={() => setShowTermsModal(true)}
                                            onOpenPrivacy={() => setShowPrivacyModal(true)}
                                            handlePayment={handlePayment}
                                            isProcessingPayment={isProcessingPayment}
                                        />
                                    )}
                                    {step === 3 && <FinalScreen userName={userName} />}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Navigation Buttons and Dots Indicator */}
                    <div className={`z-10 w-full shrink-0 ${step === 2 ? "pt-2" : ""}`}>
                        {step === 1 && (
                            <div className="mb-5 flex flex-col gap-3 font-sans w-full text-left">
                                <label className="flex items-start gap-3.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={data.consentAgreed}
                                        onChange={(e) => setData({ ...data, consentAgreed: e.target.checked })}
                                        className="w-[18px] h-[18px] mt-1 shrink-0 rounded text-[#e26843] focus:ring-[#e26843] border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-[13px] text-gray-600 font-medium leading-relaxed">
                                        I agree to the{" "}
                                        <button
                                            type="button"
                                            onClick={() => setShowTermsModal(true)}
                                            className="inline font-bold text-gray-800 hover:text-[#e26843] cursor-pointer bg-transparent border-none p-0 outline-none"
                                        >
                                            Terms &amp; Conditions
                                        </button>{" "}
                                        and acknowledge Attrangi&apos;s{" "}
                                        <button
                                            type="button"
                                            onClick={() => setShowPrivacyModal(true)}
                                            className="inline font-bold text-gray-800 hover:text-[#e26843] cursor-pointer bg-transparent border-none p-0 outline-none"
                                        >
                                            Privacy
                                        </button>
                                        ,{" "}
                                        <button
                                            type="button"
                                            onClick={() => setShowAiModal(true)}
                                            className="inline font-bold text-gray-800 hover:text-[#e26843] cursor-pointer bg-transparent border-none p-0 outline-none"
                                        >
                                            AI Transparency
                                        </button>{" "}
                                        and{" "}
                                        <button
                                            type="button"
                                            onClick={() => setShowTrustSafetyModal(true)}
                                            className="inline font-bold text-gray-800 hover:text-[#e26843] cursor-pointer bg-transparent border-none p-0 outline-none"
                                        >
                                            Safety policies
                                        </button>
                                        .
                                    </span>
                                </label>

                                <div className="pl-[32px]">
                                    <button
                                        type="button"
                                        onClick={() => setShowAllPolicies(!showAllPolicies)}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer bg-transparent border-none p-0 outline-none"
                                    >
                                        {showAllPolicies ? "Hide all policies" : "Read all policies"}
                                    </button>
                                </div>

                                {showAllPolicies && (
                                    <div className="pl-[32px] mt-2 py-3 px-4 bg-white rounded-lg border border-gray-150 animate-fadeIn">
                                        <h4 className="font-bold text-[12px] text-gray-700 mb-2">Available Documents:</h4>
                                        <ul className="space-y-2 text-[12px] font-semibold text-gray-500">
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTermsModal(true)}
                                                    className="text-[#e26843] hover:underline text-left cursor-pointer outline-none bg-transparent font-semibold"
                                                >
                                                    Terms &amp; Conditions
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPrivacyModal(true)}
                                                    className="text-[#e26843] hover:underline text-left cursor-pointer outline-none bg-transparent font-semibold"
                                                >
                                                    Privacy Policy
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAiModal(true)}
                                                    className="text-[#e26843] hover:underline text-left cursor-pointer outline-none bg-transparent font-semibold"
                                                >
                                                    AI Transparency Statement
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTrustSafetyModal(true)}
                                                    className="text-[#e26843] hover:underline text-left cursor-pointer outline-none bg-transparent font-semibold"
                                                >
                                                    Trust, Safety &amp; Acceptable Use Policy
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDataConsentModal(true)}
                                                    className="text-[#e26843] hover:underline text-left cursor-pointer outline-none bg-transparent font-semibold"
                                                >
                                                    Data Processing Consent
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex w-full gap-3">
                            {step > 0 && step < 2 && (
                                <button
                                    onClick={handleBack}
                                    className="flex-1 flex items-center justify-center border border-gray-300 hover:bg-gray-50 text-gray-700 transition-all rounded-full py-3.5 font-semibold text-[15px] lg:font-bold lg:text-sm lg:uppercase lg:tracking-wider cursor-pointer"
                                >
                                    Back
                                </button>
                            )}

                            {step < 3 ? (
                                step === 2 ? null : (
                                    <button
                                        onClick={handleNext}
                                        disabled={isContinueDisabled}
                                        className={`${step > 0 && step !== 2 ? "flex-1" : "w-full"} flex items-center justify-center bg-[#e26843] hover:bg-[#d05732] text-white transition-all rounded-full py-3.5 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[16px] lg:font-bold lg:text-sm lg:uppercase lg:tracking-wider cursor-pointer`}
                                    >
                                        {(step === 0 || step === 1) ? "Continue →" : "Continue"}
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={() => handleFinish("dashboard")}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center bg-[#e26843] hover:bg-[#d05732] text-white transition-all rounded-full py-3.5 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[16px] lg:font-bold lg:text-sm lg:uppercase lg:tracking-wider cursor-pointer"
                                >
                                    {isLoading ? "Starting..." : "Welcome to Attrangi!"}
                                </button>
                            )}
                        </div>

                        {/* Skip under full-width Subscribe CTA */}
                        {step === 2 && (
                            <button
                                onClick={() => setStep(3)}
                                className="mt-4 w-full text-center text-sm font-semibold text-[#e26843] hover:text-[#d05732] underline transition-all bg-transparent border-none cursor-pointer"
                            >
                                Skip, continue with Free Plan
                            </button>
                        )}

                        {/* Progress Dots — desktop only; mobile matches Figma without dots */}
                        {step < 4 && (
                            <div className="hidden lg:flex gap-2.5 justify-center mt-6">
                                {[...Array(4)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-2 w-2 rounded-full transition-all duration-300 ${i === step ? "bg-[#e26843] w-4" : "bg-[#ffe8d6]"}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Terms & Conditions Modal Overlay */}
            {showTermsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 relative"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center bg-gray-50/50 relative">
                            <div className="text-center w-full">
                                <h1 className="font-poppins text-[18px] lg:text-[25px] font-bold text-[#243460]">
                                    Terms & Conditions
                                </h1>
                            </div>
                            <button
                                onClick={() => setShowTermsModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 absolute right-6 top-6"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-gray-50/20">
                            <TermsAndConditionsContent />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowTermsModal(false)}
                                className="px-6 py-2.5 bg-[#e26843] hover:bg-[#d05732] text-white rounded-[30px] font-bold text-sm transition-all cursor-pointer"
                            >
                                I Understand
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Privacy Policy Modal Overlay */}
            {showPrivacyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 relative"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center bg-gray-50/50 relative">
                            <div className="text-center w-full">
                                <h1 className="font-poppins text-[18px] lg:text-[25px] font-bold text-[#243460]">
                                    Privacy Policy
                                </h1>
                            </div>
                            <button
                                onClick={() => setShowPrivacyModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 absolute right-6 top-6"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-gray-50/20">
                            <PrivacyPolicyContent />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowPrivacyModal(false)}
                                className="px-6 py-2.5 bg-[#e26843] hover:bg-[#d05732] text-white rounded-[30px] font-bold text-sm transition-all cursor-pointer"
                            >
                                I Understand
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* AI Transparency Statement Modal Overlay */}
            {showAiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 relative"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center bg-gray-50/50 relative">
                            <div className="text-center w-full">
                                <h1 className="font-poppins text-[16px] lg:text-[22px] font-bold text-[#243460]">
                                    AI Transparency, Safety &amp; Responsible AI Statement
                                </h1>
                            </div>
                            <button
                                onClick={() => setShowAiModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 absolute right-6 top-6"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-gray-50/20">
                            <AiTransparencyStatementContent />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowAiModal(false)}
                                className="px-6 py-2.5 bg-[#e26843] hover:bg-[#d05732] text-white rounded-[30px] font-bold text-sm transition-all cursor-pointer"
                            >
                                I Understand
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Data Processing Consent Modal Overlay */}
            {showDataConsentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 relative"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center bg-gray-50/50 relative">
                            <div className="text-center w-full">
                                <h1 className="font-poppins text-[18px] lg:text-[25px] font-bold text-[#243460]">
                                    Data Processing Consent
                                </h1>
                            </div>
                            <button
                                onClick={() => setShowDataConsentModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 absolute right-6 top-6"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-gray-50/20">
                            <DataProcessingConsentContent />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowDataConsentModal(false)}
                                className="px-6 py-2.5 bg-[#e26843] hover:bg-[#d05732] text-white rounded-[30px] font-bold text-sm transition-all cursor-pointer"
                            >
                                I Understand
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Trust, Safety & Acceptable Use Policy Modal Overlay */}
            {showTrustSafetyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100 relative"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center bg-gray-50/50 relative">
                            <div className="text-center w-full">
                                <h1 className="font-poppins text-[16px] lg:text-[22px] font-bold text-[#243460]">
                                    Trust, Safety &amp; Acceptable Use Policy
                                </h1>
                            </div>
                            <button
                                onClick={() => setShowTrustSafetyModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 absolute right-6 top-6"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-gray-50/20">
                            <div className="font-poppins text-[12px] lg:text-[16px] text-justify bg-white p-8 rounded-xl shadow-lg border border-gray-200 space-y-6 text-gray-800 leading-relaxed">

                                {/* Effective Dates */}
                                <div className="text-center border-b border-gray-100 pb-4 mb-6">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        Effective Date: 23 JUL 2026 | Last Updated: 23 JUL 2026
                                    </p>
                                </div>

                                {/* SECTION I: SCOPE & PROHIBITED ACTIVITIES */}
                                <div className="space-y-6">
                                    <h3 className="text-center font-bold text-[#243460] border-y border-gray-200 py-2 text-[14px] lg:text-[16px] uppercase tracking-widest bg-gray-50/50 rounded-lg">
                                        Section I - Introduction, Scope &amp; General Rules
                                    </h3>

                                    {/* 1. Introduction */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">1. Introduction</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2">
                                            <p>
                                                Welcome to Hey Attrangi. This Trust, Safety &amp; Acceptable Use Policy (&quot;Policy&quot;) sets forth the standards of conduct, safety expectations, and prohibited activities governing your use of our Platform.
                                            </p>
                                            <p>
                                                This Policy is designed to protect the safety, integrity, and trustworthiness of our Platform; to ensure compliance with applicable laws; and to promote a respectful, secure, and therapeutic environment for all Users.
                                            </p>
                                            <p className="text-xs text-gray-400 italic">
                                                We are committed to the principles of an Open, Safe &amp; Trusted, and Accountable internet. Our role as an intermediary under the Information Technology Act, 2000 carries with it the obligation to exercise due diligence in hosting and managing User content.
                                            </p>
                                        </div>
                                    </div>

                                    {/* 2 & 3. Who This Policy Applies To & Responsible Use */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">2. Who This Policy Applies To &amp; Responsible Use</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2">
                                            <p>This Policy applies universally to all adult users, minor users (through caregivers), licensed therapists, institutional administrators, and support personnel. Responsible use means respecting the rights and wellbeing of others, protecting Platform security, and upholding the integrity of clinical treatment.</p>
                                        </div>
                                    </div>

                                    {/* 4. Prohibited Activities */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">3. Prohibited Activities</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2">
                                            <p>Users shall not:</p>
                                            <ul className="list-disc pl-6 space-y-1">
                                                <li>Harass, threaten, stalk, bully, or abuse any individual.</li>
                                                <li>Post or transmit Content that is defamatory, obscene, or hateful.</li>
                                                <li>Manipulate, deceive, or exploit AI Systems, or engage in prompt injection/jailbreaking.</li>
                                                <li>Violate privacy rights or access other users' personal info without authorization.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION II: SPECIFIC ACTIONS */}
                                <div className="space-y-6 pt-6">
                                    <h3 className="text-center font-bold text-[#243460] border-y border-gray-200 py-2 text-[14px] lg:text-[16px] uppercase tracking-widest bg-gray-50/50 rounded-lg">
                                        Section II - AI Safety &amp; Therapist Protections
                                    </h3>

                                    {/* AI Safety & Misuse */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">4. AI Safety &amp; Misuse</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2 text-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
                                                <strong>Anti-Jailbreaking:</strong> Attempting to bypass or override AI system restrictions, safety filters, or content moderation is strictly prohibited.
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
                                                <strong>Prompt Injection:</strong> Attempting to manipulate AI behavior or extract instructions through injection scripts is prohibited.
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
                                                <strong>Reverse Engineering:</strong> Decompiling underlying algorithms or tracking patterns to copy AI logic is prohibited.
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
                                                <strong>Malicious Content:</strong> Using AI conversational systems to generate harmful or discriminatory text is prohibited.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Therapist Protection */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">5. Therapist Safeguards</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2">
                                            <p>Licensed Therapists must be treated with professional respect. Users are prohibited from recording sessions without authorization, sharing a therapist's personal contact details, attempting to circumvent the Platform booking process, or offering off-platform payments to avoid platform fees.</p>
                                        </div>
                                    </div>

                                    {/* Minor Safety */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">6. Minor Safety &amp; Safeguarding</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2">
                                            <p>We enforce a zero-tolerance policy against any conduct that exploits or harms minors. We comply with the Protection of Children from Sexual Offences (POCSO) Act, 2012, and will escalate any child abuse material or predatory behavior directly to legal authorities.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION III: SECURITY & ENFORCEMENT */}
                                <div className="space-y-6 pt-6">
                                    <h3 className="text-center font-bold text-[#243460] border-y border-gray-200 py-2 text-[14px] lg:text-[16px] uppercase tracking-widest bg-gray-50/50 rounded-lg">
                                        Section III - Security, Responsible Research &amp; Enforcement
                                    </h3>

                                    {/* Platform Security */}
                                    <div>
                                        <h4 className="font-bold text-[#243460] mb-2 uppercase text-[13px] lg:text-[15px]">7. Platform Security &amp; Credentials</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 space-y-2">
                                            <p>Users must maintain account security by using strong credentials and not sharing log-ins. The following are strictly prohibited: data scraping, reverse-engineering the codebase, introducing malware, phishing, spoofing, or launching DDoS/DoS attacks.</p>
                                        </div>
                                    </div>

                                    {/* Responsible Security Research */}
                                    <div>
                                        <h4 className="font-bold text-[#3d838c] mb-2 uppercase text-[13px] lg:text-[15px]">8. Responsible Security Research</h4>
                                        <div className="pl-6 border-l-4 border-[#3d838c]/40 text-gray-700 bg-teal-50/30 p-4 rounded-xl border border-teal-100 text-justify space-y-2">
                                            <p>We welcome white-hat disclosures. Researchers who identify vulnerabilities should report them responsibly to: <span className="font-bold text-[#3d838c]">support@heyattrangi.com</span>. Please include steps to reproduce and do not exfiltrate user data, disrupt services, or make public disclosures before remediation.</p>
                                        </div>
                                    </div>

                                    {/* Enforcement & Warnings */}
                                    <div>
                                        <h4 className="font-bold text-red-600 mb-2 uppercase text-[13px] lg:text-[15px]">9. Policy Enforcement &amp; Appeals</h4>
                                        <div className="pl-6 border-l-4 border-red-500 text-red-700 bg-red-50 p-4 rounded-xl border border-red-100 text-justify space-y-2">
                                            <p>Violations will result in proportionate action, including formal warnings, temporary feature restrictions, content removal, or permanent account ban. Appeals can be requested by emailing us within 30 days, except where clinical safety or emergency legal holds are involved.</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowTrustSafetyModal(false)}
                                className="px-6 py-2.5 bg-[#e26843] hover:bg-[#d05732] text-white rounded-[30px] font-bold text-sm transition-all cursor-pointer"
                            >
                                I Understand
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}

// --- SCREEN COMPONENTS ---

function ConsentScreen({
    data,
    onChange,
}: {
    data: OnboardingData
    onChange: (fields: Partial<OnboardingData>) => void
}) {
    return (
        <div className="w-full max-w-xl text-left space-y-6">
            <h2 className="text-[32px] font-bold text-gray-900 tracking-tight leading-[1.2] mb-2 text-left font-sans">
                A little safety setup
            </h2>
            <p className="text-gray-500 text-sm font-normal leading-relaxed text-left mb-6 font-sans">
                Your wellbeing matters to us. Here's where you can choose how we'd reach someone you trust if needed.
            </p>

            {/* Emergency Contact Fields */}
            <div className="bg-gray-50/50 p-5 rounded-[16px] border border-gray-100 space-y-4">
                <h3 className="font-bold text-gray-800 text-[15px] uppercase tracking-wider font-sans">
                    Emergency contact
                </h3>
                <p className="text-gray-500 text-[13px] font-semibold -mt-2 mb-2 font-sans">
                    Someone we can reach if there's an emergency
                </p>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 font-sans">
                            Name &amp; relationship
                        </label>
                        <input
                            type="text"
                            value={data.emergencyContact}
                            onChange={(e) => onChange({ emergencyContact: e.target.value })}
                            className="w-full px-4 py-3.5 rounded-[8px] border border-gray-300 focus:ring-1 focus:ring-[#e26843] focus:border-[#e26843] outline-none transition-all text-[15px] text-gray-800 placeholder-gray-400 font-sans"
                            placeholder="e.g. Mom, Brother, Friend"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 font-sans">
                            Phone number
                        </label>
                        <div className="flex rounded-[8px] border border-gray-300 focus-within:ring-1 focus-within:ring-[#e26843] focus-within:border-[#e26843] overflow-hidden transition-all bg-white font-sans">
                            <span className="flex items-center justify-center bg-gray-50 px-4 text-gray-500 text-[15px] font-semibold border-r border-gray-200 select-none">
                                +91
                            </span>
                            <input
                                type="tel"
                                maxLength={10}
                                value={data.emergencyPhone}
                                onChange={(e) => onChange({ emergencyPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                                className="flex-1 px-4 py-3.5 outline-none text-[15px] text-gray-800 placeholder-gray-400 bg-transparent"
                                placeholder="XXXXX XXXXX"
                                required
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CustomDropdown({
    value,
    options,
    placeholder,
    onChange,
}: {
    value: string
    options: { code: string; name: string }[]
    placeholder?: string
    onChange: (val: string) => void
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="relative w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3.5 rounded-[10px] border border-gray-300 focus:ring-1 focus:ring-[#e26843] focus:border-[#e26843] outline-none transition-all text-[15px] text-left text-gray-900 bg-white flex items-center justify-between cursor-pointer select-none"
            >
                <span className={!value && placeholder ? "text-gray-400 font-normal" : "text-gray-900 font-semibold"}>
                    {value ? options.find((o) => o.code === value)?.name || value : placeholder || "Select..."}
                </span>
                <svg
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div
                        className="fixed inset-0 z-20 cursor-default bg-transparent"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Strictly downward opening overlay */}
                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-[10px] shadow-lg z-30 mt-1.5 max-h-[220px] overflow-y-auto py-1">
                        {options.map((option) => {
                            const isSelected = value === option.code
                            return (
                                <button
                                    key={option.code}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.code)
                                        setIsOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-3 text-[14px] hover:bg-slate-50 transition-colors cursor-pointer select-none font-semibold ${
                                        isSelected ? "bg-slate-50/80 text-[#e26843] font-bold" : "text-gray-700"
                                    }`}
                                >
                                    {option.name}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

function PersonalizationScreen({
    data,
    onChange,
    onBack,
}: {
    data: OnboardingData
    onChange: (fields: Partial<OnboardingData>) => void
    onBack?: () => void
}) {
    const handleAgeRangeSelect = (range: "16-17" | "18-20" | "21-24" | "25+") => {
        let nominalAge = "19"
        let nominalDob = "2007-01-01"
        if (range === "16-17") {
            nominalAge = "17"
            nominalDob = "2009-01-01"
        } else if (range === "18-20") {
            nominalAge = "19"
            nominalDob = "2007-01-01"
        } else if (range === "21-24") {
            nominalAge = "22"
            nominalDob = "2004-01-01"
        } else if (range === "25+") {
            nominalAge = "26"
            nominalDob = "2000-01-01"
        }
        onChange({ ageRange: range, age: nominalAge, dob: nominalDob })
    }

    const languages = [
        { code: "English", name: "English" },
        { code: "Hindi", name: "Hindi" },
        { code: "Telugu", name: "Telugu" },
        { code: "Tamil", name: "Tamil" },
        { code: "Kannada", name: "Kannada" },
        { code: "Malayalam", name: "Malayalam" },
        { code: "Marathi", name: "Marathi" },
        { code: "Bengali", name: "Bengali" },
    ]

    const heardAboutOptions = [
        "Instagram",
        "LinkedIn",
        "WhatsApp",
        "Google Search",
        "Friend / Family",
        "Workplace",
        "Other",
    ]

    const fieldClass =
        "w-full px-4 py-3.5 rounded-[10px] border border-gray-300 focus:ring-1 focus:ring-[#e26843] focus:border-[#e26843] outline-none transition-all text-[15px] text-gray-900 placeholder:text-gray-400 bg-white appearance-none"

    return (
        <div className="w-full max-w-xl text-left">
            {/* Mobile back chevron — matches Figma */}
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Go back"
                    className="lg:hidden mb-5 -ml-1 p-1 text-gray-900 hover:text-gray-600 transition-colors bg-transparent border-none cursor-pointer"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            <h2 className="text-[32px] font-bold text-gray-900 tracking-tight leading-[1.2] text-left mb-2">
                Let's make Attrangi yours 💛
            </h2>
            <p className="text-gray-500 text-[15px] font-normal leading-relaxed text-left mb-8">
                Just a few things to help us get to know you.
            </p>

            <div className="space-y-6">
                {/* 1. Name */}
                <div>
                    <label className="block text-[15px] font-bold text-gray-900 mb-2">
                        What should we call you?
                    </label>
                    <input
                        type="text"
                        value={data.name || ""}
                        onChange={(e) => onChange({ name: e.target.value })}
                        className={fieldClass}
                        placeholder="Your name"
                        required
                    />
                </div>

                {/* 2. Age Range Select (replaces DOB date input) */}
                <div>
                    <label className="block text-[15px] font-bold text-gray-900 mb-2">
                        How old are you?
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(["16-17", "18-20", "21-24", "25+"] as const).map((range) => {
                            const isSelected = data.ageRange === range
                            const displayLabel = range === "25+" ? "25+" : range.replace("-", "–")
                            return (
                                <button
                                    key={range}
                                    type="button"
                                    onClick={() => handleAgeRangeSelect(range)}
                                    className={`py-3.5 px-4 rounded-[10px] border text-center font-semibold text-[15px] transition-all duration-200 select-none cursor-pointer active:scale-98 ${
                                        isSelected
                                            ? "bg-[#e26843] text-white border-[#e26843] shadow-sm font-bold"
                                            : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-slate-50"
                                    }`}
                                >
                                    {displayLabel}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 3. Language Custom Dropdown */}
                <div>
                    <label className="block text-[15px] font-bold text-gray-900 mb-2">
                        Which language feels most comfortable?
                    </label>
                    <CustomDropdown
                        value={data.preferredLanguage || "English"}
                        options={languages}
                        onChange={(val) => onChange({ preferredLanguage: val })}
                    />
                </div>

                {/* 4. Heard About Us Custom Dropdown */}
                <div>
                    <label className="block text-[15px] font-bold text-gray-900 mb-2">
                        How did you find Attrangi? <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <CustomDropdown
                        value={data.heardAboutUs || ""}
                        options={heardAboutOptions.map((o) => ({ code: o, name: o }))}
                        placeholder="A friend, college, Instagram..."
                        onChange={(val) => onChange({ heardAboutUs: val })}
                    />
                </div>
            </div>
        </div>
    )
}

function OrganizationScreen({ selected, onSelect }: { selected: string; onSelect: (o: string) => void }) {
    const [orgs, setOrgs] = useState<{ id: string, name: string }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/public/organizations")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setOrgs(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    return (
        <div className="w-full max-w-lg text-left">
            <h2 className="text-[22px] font-semibold text-gray-800 tracking-tight text-left mb-2">Are you joining from an institution?</h2>
            <p className="text-gray-500 text-sm font-normal leading-relaxed text-left mb-6">Select your organization to access premium benefits.</p>

            {loading ? (
                <p className="text-gray-400 animate-pulse">Loading organizations...</p>
            ) : (
                <div className="space-y-4 text-left">
                    <select
                        className="w-full px-4 py-3.5 rounded-[8px] border border-gray-300 focus:ring-1 focus:ring-[#e26843] focus:border-[#e26843] outline-none transition-all text-[15px] text-gray-800 bg-white font-medium cursor-pointer"
                        value={selected}
                        onChange={(e) => onSelect(e.target.value)}
                    >
                        <option value="" disabled>Select your organization</option>
                        <option value="none">I am not part of an organization</option>
                        {orgs.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                    {selected === "none" && (
                        <p className="text-sm text-gray-400 pl-2">You will continue with a standard account.</p>
                    )}
                </div>
            )}
        </div>
    )
}

function MoodScreen({ selected, onSelect }: { selected: string; onSelect: (m: string) => void }) {
    const moods = [
        { label: "Cry", icon: "😭" },
        { label: "Angry", icon: "😠" },
        { label: "Neutral", icon: "😐" },
        { label: "Sad", icon: "😔" },
        { label: "Smile", icon: "😊" },
    ]

    return (
        <div className="w-full text-left">
            <h2 className="text-[22px] font-semibold text-gray-800 tracking-tight text-left mb-6">How are you feeling today?</h2>
            <div className="flex flex-wrap justify-center gap-3">
                {moods.map((m) => (
                    <button
                        key={m.label}
                        onClick={() => onSelect(m.label)}
                        className={`w-20 h-20 rounded-[20px] flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${selected === m.label
                            ? "bg-[#e26843] text-white shadow-[0_8px_30px_rgb(226,104,67,0.15)] scale-105"
                            : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                    >
                        <span className="text-3xl mb-1">{m.icon}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${selected === m.label ? "text-white" : "text-gray-400"}`}>
                            {m.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

function ExperienceScreen({ selected, onSelect }: { selected: string; onSelect: (e: string) => void }) {
    const options = [
        { id: "new", title: "Just Getting Started", sub: "First time trying therapy" },
        { id: "some", title: "Some experience", sub: "Been to a few sessions before" },
        { id: "pro", title: "Veteran", sub: "Regular therapy participant" },
    ]

    return (
        <div className="w-full max-w-2xl text-left">
            <h2 className="text-[22px] font-semibold text-gray-800 tracking-tight text-left mb-6">What is your experience level with therapy?</h2>
            <div className="grid grid-cols-1 gap-3.5">
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onSelect(opt.id)}
                        className={`w-full p-5 rounded-[16px] text-left transition-all duration-300 border-2 cursor-pointer ${selected === opt.id
                            ? "bg-white border-[#e26843] text-[#e26843] shadow-[0_8px_30px_rgb(226,104,67,0.08)] scale-[1.02]"
                            : "bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200"
                            }`}
                    >
                        <h4 className={`font-bold text-base mb-1 ${selected === opt.id ? "text-[#e26843]" : "text-gray-800"}`}>{opt.title}</h4>
                        <p className={`text-xs ${selected === opt.id ? "text-[#e26843]/80" : "text-gray-400"}`}>{opt.sub}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}

function PricingScreen({
    onOpenTerms,
    onOpenPrivacy,
    handlePayment,
    isProcessingPayment,
}: {
    onOpenTerms: () => void
    onOpenPrivacy: () => void
    handlePayment: (amount: number) => void
    isProcessingPayment: boolean
}) {
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "semester" | "annual">("monthly")

    const getPriceDetails = () => {
        switch (billingPeriod) {
            case "semester":
                return { price: "₹134", label: "/ month", subtext: "Billed ₹805 every 6 months", amount: 805 }
            case "annual":
                return { price: "₹119", label: "/ month", subtext: "Billed ₹1430 every year", amount: 1430 }
            case "monthly":
            default:
                return { price: "₹149", label: "/ month", subtext: "Billed monthly", amount: 149 }
        }
    }

    const { price, label, subtext, amount } = getPriceDetails()

    return (
        <div className="w-full max-w-md mx-auto flex flex-col gap-4 text-left">
            {/* Card 2: PREMIUM */}
            <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-zinc-100/60 p-4 sm:p-5 flex flex-col gap-4 w-full">
                {/* Nested Rounded Gradient Box */}
                <div 
                    className="rounded-[24px] p-4 sm:p-5 flex flex-col justify-between min-h-[295px] sm:min-h-[305px] relative overflow-hidden bg-cover bg-center"
                    style={{
                        backgroundImage: "url('https://res.cloudinary.com/dxoiluua8/image/upload/v1786789037/Banner_bg_rrixld.png')",
                    }}
                >
                    <div className="flex flex-col gap-2.5">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-800 flex items-center gap-1 font-sans">
                            ✦ PREMIUM
                        </h3>
                        
                        {/* Segmented control billing toggle */}
                        <div className="flex items-center bg-zinc-950/5 p-1 rounded-full w-full max-w-[340px] select-none">
                            <button
                                type="button"
                                onClick={() => setBillingPeriod("monthly")}
                                className={`flex-1 py-1.5 rounded-full font-extrabold text-[10px] sm:text-[11px] transition-all duration-300 cursor-pointer ${
                                    billingPeriod === "monthly" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-950"
                                }`}
                            >
                                Monthly
                            </button>
                            <button
                                type="button"
                                onClick={() => setBillingPeriod("semester")}
                                className={`flex-1 py-1.5 rounded-full font-extrabold text-[10px] sm:text-[11px] transition-all duration-300 cursor-pointer flex items-center justify-center ${
                                    billingPeriod === "semester" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-950"
                                }`}
                            >
                                Semester
                                <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1 py-0.5 rounded-full font-black ml-1 scale-90 sm:scale-100">
                                    10%
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBillingPeriod("annual")}
                                className={`flex-1 py-1.5 rounded-full font-extrabold text-[10px] sm:text-[11px] transition-all duration-300 cursor-pointer flex items-center justify-center ${
                                    billingPeriod === "annual" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-950"
                                }`}
                            >
                                Annual
                                <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1 py-0.5 rounded-full font-black ml-1 scale-90 sm:scale-100">
                                    20%
                                </span>
                            </button>
                        </div>

                        {/* Price displays */}
                        <div className="flex flex-col mt-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-[36px] sm:text-[40px] font-black tracking-tight text-zinc-950 leading-none font-sans">
                                    {price}
                                </span>
                                <span className="text-xs text-zinc-500 font-bold font-sans">
                                    {label}
                                </span>
                            </div>
                            <span className="text-[9px] text-zinc-500 font-bold font-sans mt-0.5">
                                {subtext}
                            </span>
                        </div>

                        <p className="text-xs sm:text-[12px] text-zinc-700 font-medium leading-relaxed font-sans mt-1">
                            More space to understand yourself - with longer continuity and personalized support.
                        </p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={() => handlePayment(amount)}
                        disabled={isProcessingPayment}
                        className="w-full mt-4 py-3 px-4 bg-zinc-950 hover:bg-zinc-900 text-white text-xs sm:text-[13px] font-extrabold rounded-full transition-all flex items-center justify-center gap-2 select-none shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 cursor-pointer"
                    >
                        {isProcessingPayment ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            "Get Premium"
                        )}
                    </button>
                </div>

                {/* Features section */}
                <div className="flex flex-col gap-2.5 px-1 mt-2">
                    <h4 className="text-xs sm:text-sm font-extrabold text-zinc-900 font-sans">
                        Includes
                    </h4>
                    <ul className="space-y-2 text-xs sm:text-[13px] font-bold text-zinc-700">
                        <li className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>150 AI messages/day</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Full listening library</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Unlimited assessments</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>1 year of history</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Personalized reminders</span>
                        </li>
                    </ul>

                    <div className="text-center mt-3">
                        <span className="text-[11px] font-bold text-zinc-400 font-sans">
                            Cancel anytime.
                        </span>
                    </div>

                    <div className="flex gap-5 justify-center mt-2 text-[10px] font-semibold text-gray-400">
                        <button onClick={onOpenTerms} className="underline hover:text-gray-600 transition-colors bg-transparent border-none cursor-pointer">
                            Terms
                        </button>
                        <button onClick={onOpenPrivacy} className="underline hover:text-gray-600 transition-colors bg-transparent border-none cursor-pointer">
                            Privacy Policy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function FinalScreen({ userName }: { userName: string }) {
    return (
        <div className="w-full text-left">
            <h2 className="text-[22px] font-bold text-gray-800 text-left leading-[1.3] mb-6">
                Thanks for sharing, {userName}.<br />We&apos;re here with you.
            </h2>
        </div>
    )
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.1,
        }
    }
} as const

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring" as const,
            stiffness: 110,
            damping: 18,
        }
    }
} as const

function OnboardingCompanionScreen({
    userName,
    isLoading,
    handleFinish
}: {
    userName: string
    isLoading: boolean
    handleFinish: (action: "chat" | "dashboard") => void
}) {
    return (
        <main className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-x-hidden select-none bg-gradient-to-b from-[#FFA36C] via-[#FFF7F2] to-[#FFF9F6]">
            {/* Desktop wrapper to restrict width and center content */}
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-[430px] min-h-screen px-6 py-6 flex flex-col justify-between relative z-10 font-sans"
            >
                {/* 1. Header Text section */}
                <div className="text-left mt-6">
                    <motion.p 
                        variants={itemVariants} 
                        className="text-white text-lg min-[360px]:text-xl font-bold tracking-tight opacity-90"
                    >
                        I'm Your Companion
                    </motion.p>
                    <motion.p 
                        variants={itemVariants} 
                        className="text-white text-2xl min-[360px]:text-3xl font-bold tracking-tight mt-1 opacity-95"
                    >
                        You Can Call Me
                    </motion.p>
                    <motion.h1 
                        variants={itemVariants} 
                        className="text-white text-[38px] min-[360px]:text-[46px] font-black leading-tight tracking-tight mt-1"
                    >
                        Hey Attrangi
                    </motion.h1>
                </div>

                {/* 2. Main Visual Area (Bubble, Bot image, Chat preview) */}
                <div className="relative w-full flex-1 flex flex-col items-center justify-center my-4 min-h-[340px]">
                    <div className="relative w-full max-w-[340px] aspect-[1/1] flex flex-col items-center justify-end pb-2">
                        {/* "Hello Buddy" speech bubble - placed relative to the visual container */}
                        <motion.div 
                            variants={itemVariants}
                            className="absolute left-[5%] top-[5%] z-30"
                        >
                            <div className="relative bg-white text-slate-800 text-[12px] font-extrabold px-4 py-2 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-100/50">
                                Hello Buddy
                                {/* Tail pointing down-right towards the bot */}
                                <div className="absolute bottom-[-4px] right-[16px] w-2.5 h-2.5 bg-white rotate-45 border-r border-b border-slate-100/50"></div>
                            </div>
                        </motion.div>

                        {/* Companion Image */}
                        <motion.div 
                            variants={itemVariants}
                            className="w-[235px] h-[235px] min-[360px]:w-[265px] min-[360px]:h-[265px] min-[400px]:w-[290px] min-[400px]:h-[290px] z-20 relative -right-[20px]"
                        >
                            <img 
                                src="https://res.cloudinary.com/dxoiluua8/image/upload/v1786966299/bot_welcome_m2mnkm.png"
                                alt="Hey Attrangi Companion"
                                className="w-full h-full object-contain pointer-events-none"
                            />
                        </motion.div>

                    </div>
                </div>

                {/* 3. Actions section */}
                <div className="flex flex-col gap-4 w-full px-2 mb-4">
                    {/* Primary Button */}
                    <motion.button 
                        variants={itemVariants}
                        onClick={() => handleFinish("chat")}
                        disabled={isLoading}
                        className="w-full py-4 bg-white text-slate-900 font-extrabold text-[15px] min-[360px]:text-base rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:bg-slate-50 transition-colors border border-slate-900 active:scale-98 flex items-center justify-center cursor-pointer select-none disabled:opacity-50"
                    >
                        {isLoading ? "Starting..." : "Continue talking"}
                    </motion.button>

                    {/* Secondary Button */}
                    <motion.button 
                        variants={itemVariants}
                        onClick={() => handleFinish("dashboard")}
                        className="w-full text-center text-[13px] min-[360px]:text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer select-none"
                    >
                        Maybe later
                    </motion.button>
                </div>
            </motion.div>
        </main>
    )
}
