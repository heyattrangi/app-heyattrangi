"use client"

import React, { useState, useEffect, useRef } from "react"
import LimitExceededModal, { type LimitExceededInfo } from "@/components/ui/LimitExceededModal"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Activity, AlertTriangle, Brain, ListChecks, MessageSquare, ChevronLeft, Info, Sparkles, ShieldAlert, ShieldCheck, Check } from "lucide-react"
import { triageQuestions, screeners, TriageQuestion, Screener } from "@/lib/data/assessmentEngine"
import { DEFAULT_AVATAR } from "@/lib/avatar"

type ChatMessage = {
    id: string
    role: "bot" | "user"
    text: string
}

type Phase = "intro" | "triage" | "screener" | "calculating" | "results"

// Helper functions for redesigned results screen
function formatDate(dateStr: string) {
    if (!dateStr) return "";
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1; // 0-based
            const d = parseInt(parts[2], 10);
            const utcDate = new Date(Date.UTC(y, m, d));
            return utcDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        }
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
        return dateStr;
    }
}

function getResultStyles(severity: string) {
    const text = severity.toLowerCase();
    if (text.includes("good") || text.includes("stable") || text.includes("high") || text.includes("minimal")) {
        return {
            bgClass: "bg-[#EBF5F3]",
            titleClass: "text-[#2E626A]",
            borderClass: "border-[#D1E7E3]"
        };
    } else if (text.includes("moderate") || text.includes("mild")) {
        return {
            bgClass: "bg-[#FEF7EC]",
            titleClass: "text-[#D97706]",
            borderClass: "border-[#FBE6C6]"
        };
    } else {
        // Poor or Very Poor / Severe
        return {
            bgClass: "bg-[#FDF2EC]",
            titleClass: "text-[#D96E34]",
            borderClass: "border-[#FADCCB]"
        };
    }
}

function getRecommendationDetails(item: string) {
    const text = item.toLowerCase();
    
    if (text.includes("sleep") || text.includes("nutrition") || text.includes("diet") || text.includes("hygiene")) {
        return {
            icon: "✨",
            title: "Sleep & nutrition",
            description: item || "Small changes can support your overall wellbeing."
        };
    }
    if (text.includes("mood") || text.includes("tracking") || text.includes("tracker")) {
        return {
            icon: "📊",
            title: "Mood Tracking",
            description: item || "Tracking your patterns can help identify what helps or hurts."
        };
    }
    if (text.includes("mindfulness") || text.includes("meditation") || text.includes("breathing") || text.includes("grounding") || text.includes("calm")) {
        return {
            icon: "🧘",
            title: "Mindfulness & Grounding",
            description: item || "Simple mental exercises help manage stress in real-time."
        };
    }
    if (text.includes("therapist") || text.includes("counselor") || text.includes("consultation") || text.includes("psychiatrist") || text.includes("session")) {
        return {
            icon: "🤝",
            title: "Professional Support",
            description: item || "Consider talking to a qualified provider for deeper insights."
        };
    }
    if (text.includes("cbt") || text.includes("journal") || text.includes("worksheets") || text.includes("module")) {
        return {
            icon: "✍️",
            title: "Library Worksheets",
            description: item || "Use our self-guided tools and journals to build coping skills."
        };
    }
    
    return {
        icon: "💡",
        title: "Wellbeing Tip",
        description: item
    };
}

export default function AssessmentEngine() {
    const router = useRouter()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Flow State
    const [phase, setPhase] = useState<Phase>("intro")
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
        { id: "intro_1", role: "bot", text: "Hey 👋" },
        { id: "intro_2", role: "bot", text: "Let's understand how you're doing today. This takes about 5-10 minutes." }
    ])
    
    // Triage State
    const [triageIndex, setTriageIndex] = useState(0)
    const [triggeredScreeners, setTriggeredScreeners] = useState<Set<string>>(new Set())
    const [who5Score, setWho5Score] = useState(0)
    
    // Screener State
    const [activeScreenerQueue, setActiveScreenerQueue] = useState<string[]>([])
    const [currentScreenerId, setCurrentScreenerId] = useState<string | null>(null)
    const [screenerQuestionIndex, setScreenerQuestionIndex] = useState(0)
    const [screenerScores, setScreenerScores] = useState<Record<string, number>>({})

    // Results State
    const [finalResults, setFinalResults] = useState<any>(null)
    const [limitInfo, setLimitInfo] = useState<LimitExceededInfo | null>(null)
    const [isEmbedded, setIsEmbedded] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.search.includes('embedded=true')) {
            setIsEmbedded(true)
        }
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [chatHistory, phase])

    // Delay helper to make it feel conversational
    const addBotMessage = (text: string, delayMs = 600) => {
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                setChatHistory(prev => [...prev, { id: Date.now().toString(), role: "bot", text }])
                resolve()
            }, delayMs)
        })
    }

    const handleStartTriage = async () => {
        setPhase("triage")
        await addBotMessage(triageQuestions[0].text, 400)
    }

    const handleTriageAnswer = async (option: any) => {
        // Record user answer
        setChatHistory(prev => [...prev, { id: Date.now().toString(), role: "user", text: option.label }])
        
        // Track triggered screeners
        if (option.triggerScreener) {
            setTriggeredScreeners(prev => new Set(prev).add(option.triggerScreener))
        }

        // Track WHO-5 Score
        if (option.who5Value !== undefined) {
            setWho5Score(prev => prev + option.who5Value)
        }

        const nextIndex = triageIndex + 1
        if (nextIndex < triageQuestions.length) {
            setTriageIndex(nextIndex)
            await addBotMessage(triageQuestions[nextIndex].text, 600)
        } else {
            // Triage complete
            const queue = Array.from(triggeredScreeners)
            if (queue.length > 0) {
                setActiveScreenerQueue(queue)
                const firstScreener = queue[0]
                setCurrentScreenerId(firstScreener)
                setScreenerQuestionIndex(0)
                setPhase("screener")
                
                await addBotMessage("Thanks for sharing that.", 600)
                await addBotMessage(screeners[firstScreener].intro, 800)
                await addBotMessage(screeners[firstScreener].questions[0].text, 800)
            } else {
                // No screeners triggered, go straight to results
                await addBotMessage("Thank you for sharing. Based on your answers, you seem to be doing relatively okay right now.", 600)
                finishAssessment()
            }
        }
    }

    const handleScreenerAnswer = async (option: { label: string, value: number }) => {
        if (!currentScreenerId) return

        // Record user answer
        setChatHistory(prev => [...prev, { id: Date.now().toString(), role: "user", text: option.label }])
        
        // Update score for current screener
        setScreenerScores(prev => ({
            ...prev,
            [currentScreenerId]: (prev[currentScreenerId] || 0) + option.value
        }))

        const currentScreener = screeners[currentScreenerId]
        const nextIndex = screenerQuestionIndex + 1

        if (nextIndex < currentScreener.questions.length) {
            setScreenerQuestionIndex(nextIndex)
            await addBotMessage(currentScreener.questions[nextIndex].text, 500)
        } else {
            // Finished current screener, move to next in queue if exists
            const currentQueueIndex = activeScreenerQueue.indexOf(currentScreenerId)
            const nextQueueIndex = currentQueueIndex + 1

            if (nextQueueIndex < activeScreenerQueue.length) {
                const nextScreener = activeScreenerQueue[nextQueueIndex]
                setCurrentScreenerId(nextScreener)
                setScreenerQuestionIndex(0)
                await addBotMessage("Got it. Let's move on to the next set of questions.", 600)
                await addBotMessage(screeners[nextScreener].intro, 800)
                await addBotMessage(screeners[nextScreener].questions[0].text, 800)
            } else {
                finishAssessment()
            }
        }
    }

    const finishAssessment = async () => {
        setPhase("calculating")
        await addBotMessage("Thank you for completing the assessment. I'm analyzing your responses now...", 800)
        
        setTimeout(() => {
            calculateFinalResults()
            setPhase("results")
        }, 2000)
    }

    const calculateFinalResults = async () => {
        const rawFindings: any[] = []

        // 1. Collect all findings (WHO-5 is treated separately or as a base finding)
        let who5Interpretation = "Good Wellbeing"
        if (who5Score < 13) who5Interpretation = "Poor Wellbeing"
        if (who5Score < 5) who5Interpretation = "Very Poor Wellbeing"

        rawFindings.push({
            id: 'who5',
            name: "WHO-5 Wellbeing",
            fullName: "WHO-5 Wellbeing Index",
            score: who5Score,
            severity: who5Interpretation,
            priorityWeight: 20,
            confidenceLevel: "High",
            recommendations: who5Interpretation.includes("Poor") ? ["Consider tracking your mood daily", "Focus on sleep and nutrition"] : []
        })

        for (const [screenerId, score] of Object.entries(screenerScores)) {
            const screener = screeners[screenerId]
            const rule = screener.scoring.find(r => score >= r.min && score <= r.max)
            
            // Add if it's flagged or we want to record it
            if (rule && rule.severity !== "Minimal") {
                rawFindings.push({
                    id: screenerId,
                    name: screener.name.split(" ")[0], // e.g. "PHQ-9" or "PTSD"
                    fullName: screener.name,
                    score,
                    severity: rule.severity,
                    priorityWeight: screener.priorityWeight,
                    confidenceLevel: screener.confidenceLevel,
                    recommendations: rule.recommendations || []
                })
            }
        }

        // 2. Sort findings by priority weight (highest first)
        rawFindings.sort((a, b) => b.priorityWeight - a.priorityWeight)

        // 3. Generate Overall Assessment Sentence
        let overallAssessment = "Your responses indicate generally stable wellbeing with no major clinical flags."
        const flaggedClinical = rawFindings.filter(f => f.id !== 'who5' && f.severity !== "Minimal")
        
        if (flaggedClinical.length > 0) {
            const topNames = flaggedClinical.slice(0, 2).map(f => `${f.severity.toLowerCase()} ${f.name} symptoms`)
            overallAssessment = `Your responses suggest symptoms that may be consistent with ${topNames.join(" together with ")}.`
            if (flaggedClinical.length > 2) {
                overallAssessment += ` Some of your answers also indicate other areas that should be explored further.`
            }
            overallAssessment += " These screening results are not a diagnosis, but they help identify which areas may benefit from further evaluation."
        } else if (who5Score < 13) {
            overallAssessment = "While no specific clinical domains were strongly flagged, your overall wellbeing score suggests you are currently going through a difficult time."
        }

        // 4. Generate AI Interpretation
        let aiInterpretation = "No significant clinical symptoms were detected. Continue to monitor your wellbeing."
        if (flaggedClinical.length > 0) {
            aiInterpretation = `The combination of ${flaggedClinical.slice(0, 2).map(f => f.name).join(" and ")} symptoms is notable. `
            if (flaggedClinical.some(f => f.confidenceLevel === "Screening only")) {
                aiInterpretation += `Several screening questions also suggest additional areas of concern. Because these were identified by brief screeners, a comprehensive clinical assessment is recommended before drawing conclusions.`
            } else {
                aiInterpretation += `Please discuss these results with a healthcare provider to determine an appropriate care plan.`
            }
        }

        // 5. Structure Prioritized Action Plan
        const topPriorities: any[] = []
        const additionalFindings: any[] = []
        const selfHelp: string[] = []
        
        rawFindings.forEach((finding, idx) => {
            if (finding.id === 'who5' && finding.severity === "Good Wellbeing") return;
            
            if (topPriorities.length < 3 && finding.id !== 'who5') {
                topPriorities.push({
                    condition: finding.fullName,
                    status: finding.severity,
                    recommendation: finding.recommendations[0] || "Requires further evaluation."
                })
            } else if (finding.id !== 'who5') {
                additionalFindings.push({
                    condition: finding.fullName,
                    status: finding.severity,
                    recommendation: finding.recommendations[0] || "Monitor symptoms."
                })
            }
            
            // Add remaining recommendations to self-help if applicable
            if (finding.recommendations.length > 1) {
                selfHelp.push(...finding.recommendations.slice(1))
            }
        })

        const payload = {
            assessmentId: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            overallAssessment,
            confidenceLevels: rawFindings,
            topPriorities,
            additionalFindings,
            selfHelp: Array.from(new Set(selfHelp)),
            aiInterpretation
        }

        setFinalResults(payload)

        // Save to DB
        try {
            const res = await fetch('/api/patient/assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                if (res.status === 429 || errData.error === "LIMIT_EXCEEDED") {
                    setLimitInfo({
                        feature: "Assessments",
                        message: errData.message || "You have reached your weekly assessment limit.",
                        resetInSeconds: errData.resetInSeconds,
                        upgradeable: true,
                    })
                }
            }
        } catch (e) {
            console.error("Failed to save assessment", e)
        }
    }

    const handleExit = (completed: boolean = false) => {
        if (typeof window !== 'undefined' && window.location.search.includes('embedded=true')) {
            if (completed) {
                window.parent.postMessage({ type: 'TASK_COMPLETED', actionType: 'ASSESSMENT', result: finalResults }, '*');
            } else {
                window.parent.postMessage({ type: 'TASK_CANCELLED' }, '*');
            }
        } else {
            router.push('/patient/library');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 relative rounded-full overflow-hidden flex items-center justify-center bg-orange-50/50 flex-shrink-0">
                        <Image src={DEFAULT_AVATAR} alt="Bot" fill className="object-contain p-1" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-[17px] sm:text-lg md:text-xl leading-tight">Assessment Engine</h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Guided clinical screener</p>
                    </div>
                </div>
                {!isEmbedded && (
                <button 
                    onClick={() => handleExit(false)}
                    className="text-[11px] sm:text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider whitespace-nowrap flex-shrink-0 ml-4"
                >
                    Cancel
                </button>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-5 sm:space-y-6 md:space-y-8 bg-white relative scroll-smooth">
                {chatHistory.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'bot' && (
                             <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex-shrink-0 mr-2.5 sm:mr-4 mt-1 bg-orange-50/50 rounded-full">
                                 <Image src={DEFAULT_AVATAR} alt="Bot" fill className="object-contain p-1" />
                              </div>
                        )}
                        <div className={`w-fit max-w-[85%] md:max-w-[75%] p-3.5 sm:p-5 rounded-2xl leading-normal sm:leading-relaxed ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm text-sm sm:text-base font-semibold' 
                                : 'bg-white text-slate-900 border border-slate-100 shadow-md rounded-tl-sm text-lg sm:text-xl md:text-2xl font-bold tracking-tight'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                
                {phase === "calculating" && (
                     <div className="flex justify-start animate-pulse">
                         <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex-shrink-0 mr-2.5 sm:mr-4 mt-1 bg-orange-50/50 rounded-full">
                             <Image src={DEFAULT_AVATAR} alt="Bot" fill className="object-contain p-1" />
                         </div>
                         <div className="bg-white text-slate-400 p-3.5 sm:p-5 rounded-2xl rounded-tl-sm border border-slate-100 shadow-md text-base sm:text-lg font-medium">
                             typing...
                         </div>
                     </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input / Options Area */}
            <div className="bg-white border-t border-slate-200 p-4 md:p-6 z-10 min-h-[110px] sm:min-h-[140px] flex flex-col justify-center">
                {phase === "intro" && (
                    <div className="flex justify-center">
                        <button 
                            onClick={handleStartTriage}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-md transition-all uppercase tracking-wider text-xs sm:text-sm"
                        >
                            Start Assessment
                        </button>
                    </div>
                )}

                {phase === "triage" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                        {triageQuestions[triageIndex]?.options.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => handleTriageAnswer(opt)}
                                className="bg-white border-2 border-indigo-100 hover:border-indigo-600 hover:bg-indigo-50 hover:shadow-md text-slate-800 font-bold py-3.5 px-4 sm:py-5 sm:px-6 rounded-2xl transition-all text-base sm:text-lg text-left"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {phase === "screener" && currentScreenerId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                        {screeners[currentScreenerId].questions[screenerQuestionIndex]?.options.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => handleScreenerAnswer(opt)}
                                className="bg-white border-2 border-indigo-100 hover:border-indigo-600 hover:bg-indigo-50 hover:shadow-md text-slate-800 font-bold py-3.5 px-4 sm:py-5 sm:px-6 rounded-2xl transition-all text-base sm:text-lg text-left"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {phase === "results" && finalResults && (
                    <div className="max-w-2xl mx-auto w-full text-center">
                        <button 
                            onClick={() => handleExit(true)}
                            className="bg-slate-800 hover:bg-black text-white font-bold py-3 px-8 rounded-full shadow-md transition-all uppercase tracking-wider text-xs sm:text-sm"
                        >
                            {isEmbedded ? "Back to Chatbot" : "Return to Library"}
                        </button>
                    </div>
                )}
            </div>

            {/* Results Overlay overlay on top if finished */}
            {phase === "results" && finalResults && (
                <div className="absolute inset-0 bg-[#FCFAF7] text-[#1E2429] z-20 overflow-y-auto p-4 sm:p-8 md:p-12 flex flex-col items-center">
                    <div className="w-full max-w-xl mx-auto flex flex-col">
                        {/* Header Navigation */}
                        <div className="mb-6 flex flex-col items-start">
                            {!isEmbedded && (
                            <button
                                onClick={() => handleExit(true)}
                                className="inline-flex items-center gap-1.5 text-[#2E626A] hover:text-[#204a50] font-semibold text-sm transition-colors mb-4 focus:outline-none focus:ring-2 focus:ring-[#2E626A] focus:ring-offset-2 rounded"
                            >
                                <ChevronLeft className="w-4 h-4" strokeWidth={3} /> Back to Assessments
                            </button>
                            )}
                            <h2 className="text-3xl font-bold text-[#1E2429] leading-tight mb-1">Assessment Results</h2>
                            <p className="text-[#7A828A] text-sm font-normal">Completed {formatDate(finalResults.date)}</p>
                        </div>

                        {/* Primary Result Card */}
                        {(() => {
                            const who5Finding = finalResults.confidenceLevels.find((f: any) => f.id === 'who5');
                            const who5Severity = who5Finding ? who5Finding.severity : "Good Wellbeing";
                            const who5Confidence = who5Finding ? who5Finding.confidenceLevel : "High";
                            const styles = getResultStyles(who5Severity);
                            
                            // Determine a short description based on severity
                            let who5Desc = "Your responses suggest generally stable and positive wellbeing.";
                            if (who5Severity.toLowerCase().includes("very poor")) {
                                who5Desc = "Your responses suggest that you may be going through a very difficult period right now.";
                            } else if (who5Severity.toLowerCase().includes("poor")) {
                                who5Desc = "Your responses suggest that you may be going through a difficult period right now.";
                            }
                            
                            return (
                                <>
                                    <div className={`w-full rounded-[28px] p-6 sm:p-8 ${styles.bgClass} border ${styles.borderClass} shadow-sm mb-4 transition-all duration-300`}>
                                        <h3 className={`text-3xl font-bold ${styles.titleClass} mb-2 leading-tight`}>
                                            {who5Severity}
                                        </h3>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                                            WHO-5 Wellbeing Index
                                        </p>
                                        <p className="text-[#1E2429] text-base leading-relaxed font-medium">
                                            {who5Desc}
                                        </p>
                                    </div>
                                    
                                    <p className="text-center text-[#7A828A] text-sm font-medium mb-6">
                                        Confidence: {who5Confidence}
                                    </p>
                                </>
                            );
                        })()}

                        {/* What This Means Card */}
                        <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#EAE5DB]/60 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-[#EBF5F3] flex items-center justify-center text-[#2E626A] flex-shrink-0">
                                    <Info className="w-4 h-4" strokeWidth={2.5} />
                                </div>
                                <h3 className="font-bold text-[#1E2429] text-lg">What this means</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[#5C6670] leading-relaxed text-sm sm:text-base font-medium">
                                    {finalResults.overallAssessment}
                                </p>
                                {finalResults.aiInterpretation && (
                                    <div className="text-[#5C6670] leading-relaxed text-sm sm:text-base italic border-l-2 border-[#2E626A] pl-4 bg-[#FBF9F6]/50 py-2.5 rounded-r-xl">
                                        "{finalResults.aiInterpretation}"
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 w-full mb-6">
                            <button
                                onClick={() => handleExit(true)}
                                className="w-full h-14 bg-[#2E626A] hover:bg-[#204a50] active:scale-[0.99] text-white rounded-full font-semibold text-base transition-all flex items-center justify-center shadow-sm"
                            >
                                {isEmbedded ? "Back to Chatbot" : "Return to Assessments"}
                            </button>
                            {!isEmbedded && (
                            <button
                                onClick={() => router.push('/patient/wellbeing')}
                                className="w-full h-14 bg-transparent border-2 border-[#2E626A] hover:bg-[#2E626A]/5 active:scale-[0.99] text-[#2E626A] rounded-full font-semibold text-base transition-all flex items-center justify-center"
                            >
                                Explore wellbeing tools
                            </button>
                            )}
                        </div>

                        {/* Recommendations */}
                        {finalResults.selfHelp && finalResults.selfHelp.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-[#1E2429] font-bold text-lg mb-3">A few things that may help</h3>
                                <div className="space-y-4">
                                    {finalResults.selfHelp.map((item: string, idx: number) => {
                                        const rec = getRecommendationDetails(item);
                                        return (
                                            <div key={idx} className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#EAE5DB]/60 flex gap-4 items-start">
                                                <div className="w-12 h-12 rounded-2xl bg-[#FBF9F6] border border-[#EAE5DB]/40 flex items-center justify-center text-xl flex-shrink-0">
                                                    {rec.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-[#1E2429] text-base mb-1">{rec.title}</h4>
                                                    <p className="text-[#5C6670] text-sm leading-relaxed">{rec.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Domain Analysis / Detailed Findings */}
                        {finalResults.confidenceLevels && finalResults.confidenceLevels.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-[#1E2429] mb-3">Domain Analysis</h3>
                                <div className="space-y-3">
                                    {finalResults.confidenceLevels.map((finding: any, idx: number) => {
                                        const styles = getResultStyles(finding.severity);
                                        return (
                                            <div key={idx} className="bg-white rounded-[24px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] border border-[#EAE5DB]/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div>
                                                    <h4 className="font-bold text-[#1E2429] text-base">{finding.fullName}</h4>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full font-bold text-[11px] ${styles.bgClass} ${styles.titleClass} ${styles.borderClass} border`}>
                                                            {finding.severity}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium">
                                                            Score: {finding.score}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-[#5C6670] font-medium sm:text-right">
                                                    <span className="text-slate-400">Confidence:</span>
                                                    <span className="inline-flex items-center gap-1">
                                                        {finding.confidenceLevel === "High" && <div className="w-1.5 h-1.5 rounded-full bg-[#2E626A]"></div>}
                                                        {finding.confidenceLevel}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Additional Recommended Assessments */}
                        {finalResults.additionalFindings && finalResults.additionalFindings.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-[#1E2429] mb-3">Additional Recommended Assessments</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {finalResults.additionalFindings.map((item: any, idx: number) => (
                                        <div key={idx} className="bg-white rounded-xl p-4 border border-[#EAE5DB]/60 flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#2E626A]"></div>
                                            <span className="font-semibold text-[#1E2429] text-sm">{item.condition}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Prioritized Action Plan Status */}
                        {finalResults.topPriorities && finalResults.topPriorities.length > 0 ? (
                            <div className="mb-6 bg-[#FDF2EC] border border-[#FADCCB] rounded-[24px] p-6">
                                <h4 className="text-[#D96E34] font-bold text-base mb-3 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5" /> Priorities & Clinical Actions
                                </h4>
                                <ul className="space-y-3">
                                    {finalResults.topPriorities.map((item: any, idx: number) => (
                                        <li key={idx} className="bg-white rounded-xl p-4 border border-[#FADCCB]/40">
                                            <div className="font-bold text-[#1E2429] text-sm mb-1">{item.recommendation}</div>
                                            <div className="text-xs text-[#5C6670]">
                                                Screener: <span className="font-semibold text-[#1E2429]">{item.condition} ({item.status})</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-[#2E626A] font-semibold text-sm mb-8 py-3.5 bg-[#EBF5F3] rounded-full border border-[#D1E7E3] w-fit mx-auto px-6">
                                <ShieldCheck className="w-5 h-5 text-[#2E626A]" /> No urgent clinical actions required.
                            </div>
                        )}

                        {/* Disclaimer */}
                        <p className="text-center text-xs text-[#7A828A] leading-relaxed max-w-md mx-auto mt-6 mb-12">
                            This assessment is a screening tool and is not a diagnostic instrument. If you have concerns about your wellbeing, consider speaking with a qualified healthcare professional.
                        </p>
                    </div>
                </div>
            )}
            <LimitExceededModal info={limitInfo} onClose={() => setLimitInfo(null)} />
        </div>
    )
}
