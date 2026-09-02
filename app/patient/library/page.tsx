"use client"

import React, { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, BookOpen, Newspaper, ShieldCheck, ArrowRight, ExternalLink, Clock, Activity } from "lucide-react"
import BreathingExercise from "@/components/patient/library/BreathingExercise"
import SelfExploreHome from "@/components/patient/library/SelfExploreHome"
import MiniPlayer from "@/components/patient/library/explore/listen/MiniPlayer";
import RecommendedAudios from "@/components/patient/library/explore/listen/RecommendedAudios"
import ListenPlayerProvider from "@/components/patient/library/explore/listen/ListenPlayerContext"
import { ExploreProvider, useExplore } from "@/components/patient/library/explore/ExploreProvider"
import ExploreErrorBoundary from "@/components/patient/library/explore/ExploreErrorBoundary"
import {
    PlayerSkeleton,
} from "@/components/patient/library/explore/ExploreSkeletons"
import { getListenTrackBySlug } from "@/data/listenContent"
import {
    buildExploreHref,
    buildReadItemHref,
    buildListenItemHref,
    parseExploreMode,
    parseExploreCategory,
} from "@/lib/explore/urlState"
import { AnimatePresence } from "framer-motion"

// --- TYPES ---
interface JournalEntry {
    id: string
    date: string
    mood: string
    text: string
}

// --- MOCK DASHBOARD DATA ---
// aiSummary is now a state variable

// mentalHealthNews and latestResearch are now state variables inside the component

const clinicalGuidelines = [
    {
        id: 1,
        org: "APA",
        title: "2026 Guidelines for the Treatment of Depression",
        status: "Updated",
        link: "#"
    },
    {
        id: 2,
        org: "NICE",
        title: "Management of Adult ADHD",
        status: "New Evidence",
        link: "#"
    },
    {
        id: 3,
        org: "WHO",
        title: "Global Protocol on Trauma Support",
        status: "Published",
        link: "#"
    }
]

function LibraryPageContent() {
    const [activeTab, setActiveTab] = useState<string>("discover") // discover | wellness | distress | illness | stories | selfhelp | brainfood
    const [searchQuery, setSearchQuery] = useState<string>("")
    const router = useRouter()
    const searchParams = useSearchParams()
    const tabParam = searchParams.get("tab")
    const rawMode = searchParams.get("mode")
    const rawCategory = searchParams.get("category")
    const rawItem = searchParams.get("item")?.trim() || null
    const { goExploreHome } = useExplore()

    useEffect(() => {
        if (tabParam) {
            setActiveTab(tabParam)
        }
    }, [tabParam])

    useEffect(() => {
        const assessmentParam = searchParams.get("assessment")
        if (activeTab === "self_assignments" && assessmentParam) {
            const targetId = `card-${assessmentParam.toLowerCase()}`
            const timer = setTimeout(() => {
                const el = document.getElementById(targetId)
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" })
                }
            }, 100)

            return () => clearTimeout(timer)
        }
    }, [activeTab, searchParams])

    // Canonicalize invalid mode/category in the URL
    useEffect(() => {
        const mode = parseExploreMode(rawMode)
        const category = parseExploreCategory(rawCategory)
        let dirty = false
        if (rawMode && rawMode !== mode) dirty = true
        if (rawCategory && rawCategory !== category) dirty = true
        if (!dirty) return
        const href = buildExploreHref({
            mode,
            category: mode === "activities" ? category : "all",
            item: null,
        })
        router.replace(href, { scroll: false })
    }, [rawMode, rawCategory, router])

    const mode = parseExploreMode(rawMode)
    const readMode = mode === "read"
    const listenMode = mode === "listen"
    const readItem = rawItem

    const [news, setNews] = useState<any[]>([])
    const [research, setResearch] = useState<any[]>([])
    const [summary, setSummary] = useState<any>(null)
    const [loadingData, setLoadingData] = useState(true)

    // Fetch live data
    useEffect(() => {
        const fetchLiveData = async () => {
            try {
                const [newsRes, researchRes, summaryRes] = await Promise.all([
                    fetch('/api/library/news'),
                    fetch('/api/library/research'),
                    fetch('/api/library/summary')
                ])

                if (newsRes.ok) {
                    const newsData = await newsRes.json()
                    setNews(newsData.news || [])
                }

                if (researchRes.ok) {
                    const researchData = await researchRes.json()
                    setResearch(researchData.research || [])
                }

                if (summaryRes.ok) {
                    const summaryData = await summaryRes.json()
                    setSummary(summaryData.summary)
                }
            } catch (error) {
                console.error("Failed to fetch library live data", error)
            } finally {
                setLoadingData(false)
            }
        }

        fetchLiveData()
    }, [])

    // --- Interactive States ---
    // Breathing exercise
    const [breathState, setBreathState] = useState<"Inhale" | "Hold" | "Exhale">("Inhale")
    const [breathProgress, setBreathProgress] = useState<number>(0)
    const [isBreathingActive, setIsBreathingActive] = useState<boolean>(false)



    // Mood Journal
    const [journalText, setJournalText] = useState<string>("")
    const [selectedMood, setSelectedMood] = useState<string>("Calm")
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([
        { id: "1", date: "July 9, 2026", mood: "Peaceful", text: "Had a great walk outside. Feeling grounded and clear-headed today." },
        { id: "2", date: "July 8, 2026", mood: "Anxious", text: "A bit overwhelmed with work today, but took a few deep breaths to reset." }
    ])

    // Self Assessment Quiz
    const [quizScore, setQuizScore] = useState<number | null>(null)
    const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})

    // Sudoku State (Brain Busters)
    const [sudokuGrid, setSudokuGrid] = useState<number[][]>([
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ])
    const [sudokuInitial] = useState<boolean[][]>([
        [true, true, false, false, true, false, false, false, false],
        [true, false, false, true, true, true, false, false, false],
        [false, true, true, false, false, false, false, true, false],
        [true, false, false, false, true, false, false, false, true],
        [true, false, false, true, false, true, false, false, true],
        [true, false, false, false, true, false, false, false, true],
        [false, true, false, false, false, false, true, true, false],
        [false, false, false, true, true, true, false, false, true],
        [false, false, false, false, true, false, false, true, true]
    ])

    // --- Breath cycle logic ---
    useEffect(() => {
        let timer: NodeJS.Timeout
        if (isBreathingActive) {
            timer = setInterval(() => {
                setBreathProgress((prev) => {
                    if (prev >= 100) {
                        setBreathState((currentState) => {
                            if (currentState === "Inhale") return "Hold"
                            if (currentState === "Hold") return "Exhale"
                            return "Inhale"
                        })
                        return 0
                    }
                    return prev + 2.5
                })
            }, 100)
        } else {
            setBreathProgress(0)
            setBreathState("Inhale")
        }
        return () => clearInterval(timer)
    }, [isBreathingActive])

    // --- Handlers ---
    const handleSudokuChange = (row: number, col: number, val: string) => {
        if (sudokuInitial[row][col]) return
        const num = parseInt(val) || 0
        if (num >= 0 && num <= 9) {
            const newGrid = [...sudokuGrid]
            newGrid[row][col] = num
            setSudokuGrid(newGrid)
        }
    }

    const handleJournalSave = (e: React.FormEvent) => {
        e.preventDefault()
        if (!journalText.trim()) return
        const newEntry: JournalEntry = {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            mood: selectedMood,
            text: journalText
        }
        setJournalEntries([newEntry, ...journalEntries])
        setJournalText("")
    }

    const handleQuizSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        let score = 0
        Object.values(quizAnswers).forEach((val) => {
            score += val
        })
        setQuizScore(score)
    }

    // Legacy ?mode=read&item=slug → canonical /read/[slug]
    useEffect(() => {
        if (readMode && readItem) {
            router.replace(buildReadItemHref(readItem))
        }
    }, [readMode, readItem, router])

    // Legacy ?mode=listen&item=slug → canonical /listen/[slug]
    useEffect(() => {
        if (listenMode && readItem && getListenTrackBySlug(readItem)) {
            router.replace(buildListenItemHref(readItem))
        }
    }, [listenMode, readItem, router])

    // Invalid listen item slug → return to Explore safely
    useEffect(() => {
        if (listenMode && readItem && !getListenTrackBySlug(readItem)) {
            router.replace(buildExploreHref({ mode: "listen", item: null }))
        }
    }, [listenMode, readItem, router])

    if (readMode && readItem) {
        return (
            <div className="flex-1 h-full flex items-center justify-center bg-[#FFF9F8]">
                <PlayerSkeleton />
            </div>
        )
    }

    if (listenMode && readItem) {
        return (
            <div className="flex-1 h-full flex items-center justify-center bg-[#FFF9F8]">
                <PlayerSkeleton />
            </div>
        )
    }

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto w-full bg-[#FFF9F8] text-slate-800 flex flex-col font-sans relative">



            <div className="p-4 min-[360px]:p-5 min-[390px]:p-6 md:p-8 flex-1 w-full max-w-6xl mx-auto">
                {activeTab !== "discover" && (
                    <button
                        onClick={() => setActiveTab("discover")}
                        className="text-[11px] font-black text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest flex items-center gap-1 mb-6 group"
                    >
                        ← Back to Library
                    </button>
                )}

                {/* --- DISCOVER HOME PAGE (Self Explore) --- */}
                {activeTab === "discover" && (
                    <div className="space-y-10 animate-in fade-in duration-300 w-full pb-20">
                        <ExploreErrorBoundary onReset={() => goExploreHome("activities")}>
                            <SelfExploreHome onNavigateLibraryTab={setActiveTab} />
                        </ExploreErrorBoundary>

                        {/* Mental Health Dashboard section — temporarily hidden */}
                        {false && (
                            <div className="mt-12 border-t border-slate-100 pt-16">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                                    <div>
                                        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                            <Activity className="w-6 h-6 text-indigo-600" /> Mental Health Dashboard
                                        </h3>
                                        <p className="text-slate-500 font-medium mt-1">Live updates on research, clinical guidelines, and news.</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                        Live Feed
                                    </div>
                                </div>

                                {/* 1. AI Summary Hero */}
                                <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                                    <div className="flex items-start gap-4 relative z-10">
                                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                            <Sparkles className="w-6 h-6 text-indigo-100" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-indigo-200 uppercase tracking-widest mb-1">
                                                AI Daily Summary • {summary ? summary.date : "Loading..."}
                                            </h4>
                                            {loadingData || !summary ? (
                                                <div className="mt-4 space-y-3">
                                                    <div className="h-4 bg-indigo-800/50 rounded w-3/4 animate-pulse"></div>
                                                    <div className="h-4 bg-indigo-800/50 rounded w-2/3 animate-pulse"></div>
                                                    <div className="h-4 bg-indigo-800/50 rounded w-5/6 animate-pulse"></div>
                                                </div>
                                            ) : (
                                                <ul className="mt-4 space-y-3">
                                                    {summary.highlights.map((highlight: string, idx: number) => (
                                                        <li key={idx} className="flex items-start gap-3">
                                                            <span className="text-indigo-300 mt-1">●</span>
                                                            <span className="text-white/90 font-medium leading-relaxed">{highlight}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 3-Column Grid for Research, News, Guidelines */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                    {/* Column 1: Latest Research (PubMed) */}
                                    <div className="lg:col-span-1 flex flex-col h-full">
                                        <div className="flex items-center justify-between mb-5">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                <BookOpen className="w-5 h-5 text-indigo-500" /> Latest Research
                                            </h4>
                                            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">PubMed</span>
                                        </div>
                                        <div className="flex-1 flex flex-col gap-4">
                                            {loadingData ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center text-slate-400 text-xs flex-1 flex items-center justify-center">Loading latest research...</div>
                                            ) : research.length === 0 ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center text-slate-400 text-xs flex-1 flex items-center justify-center">No research articles found.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {research.slice(0, 4).map((item, idx) => (
                                                        <div key={item.id} className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md p-5 rounded-2xl transition-all group flex flex-col h-full">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md truncate pr-2 max-w-[70%]">{item.journal}</span>
                                                                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {item.date}</span>
                                                            </div>
                                                            <h5 className="font-bold text-slate-800 text-[14px] leading-snug mb-4 group-hover:text-indigo-600 transition-colors flex-1">{item.title}</h5>
                                                            <div className="flex justify-between items-center mt-auto">
                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{item.tag}</span>
                                                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 bg-slate-50 hover:bg-indigo-50 rounded-full">
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <button className="w-full mt-auto py-3 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                View all research <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Column 2: Mental Health News */}
                                    <div className="lg:col-span-1 flex flex-col h-full">
                                        <div className="flex items-center justify-between mb-5">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                <Newspaper className="w-5 h-5 text-blue-500" /> Health News
                                            </h4>
                                            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">NewsAPI</span>
                                        </div>
                                        <div className="flex-1 flex flex-col gap-4">
                                            {loadingData ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center text-slate-400 text-xs flex-1 flex items-center justify-center">Loading news...</div>
                                            ) : news.length === 0 ? (
                                                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center text-slate-400 text-xs flex-1 flex items-center justify-center">No news articles found.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {news.slice(0, 4).map((item, idx) => (
                                                        <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" className={`group cursor-pointer rounded-2xl p-5 transition-all border ${idx === 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 hover:border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                                                            <div className="flex flex-col h-full">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider truncate max-w-[60%] px-2 py-1 rounded-md ${idx === 0 ? 'text-blue-700 bg-blue-100/50' : 'text-blue-600 bg-blue-50'}`}>{item.source}</span>
                                                                    <span className={`text-[10px] font-semibold whitespace-nowrap ${idx === 0 ? 'text-blue-400' : 'text-slate-400'}`}>{item.time}</span>
                                                                </div>
                                                                <h5 className={`font-bold text-[14px] leading-snug line-clamp-3 transition-colors ${idx === 0 ? 'text-blue-900 group-hover:text-blue-700' : 'text-slate-800 group-hover:text-blue-600'}`}>{item.title}</h5>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <button className="w-full mt-auto py-3 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                Load more stories <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Column 3: Clinical Guidelines */}
                                    <div className="lg:col-span-1 flex flex-col h-full">
                                        <div className="flex items-center justify-between mb-5">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5 text-emerald-500" /> Guidelines
                                            </h4>
                                            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">Official</span>
                                        </div>
                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="grid grid-cols-1 gap-4">
                                                {clinicalGuidelines.map((guideline) => (
                                                    <div key={guideline.id} className="bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md p-5 rounded-2xl transition-all group flex flex-col h-full">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 text-emerald-600 font-black text-xs border border-emerald-100 shadow-sm">
                                                                {guideline.org}
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${guideline.status === 'Updated' ? 'bg-orange-50 text-orange-600' :
                                                                guideline.status === 'New Evidence' ? 'bg-blue-50 text-blue-600' :
                                                                    'bg-emerald-50 text-emerald-600'
                                                                }`}>{guideline.status}</span>
                                                        </div>
                                                        <h5 className="font-bold text-slate-800 text-[14px] leading-tight group-hover:text-emerald-600 transition-colors mt-auto pr-2">{guideline.title}</h5>
                                                    </div>
                                                ))}
                                            </div>
                                            <button className="w-full mt-auto py-3 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                View full directory <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* --- BREATHING EXERCISE --- */}
                {activeTab === "breathing" && <BreathingExercise />}

                {/* --- SELF ASSIGNMENTS MODULE --- */}
                {activeTab === "self_assignments" && (
                    <div className="space-y-12 animate-in fade-in duration-300">
                        <div className="space-y-6 mb-12">
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-10">
                                <div className="max-w-2xl">
                                    <h3 className="font-extrabold text-[32px] text-slate-700 mb-2 font-sans tracking-tight">Self Assignments</h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        Gain insight into your mental and emotional health and find ways to support yourself
                                    </p>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search resources"
                                        className="pl-4 pr-10 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-rose-200 text-sm w-full md:w-64 bg-white font-medium text-slate-600 placeholder:text-slate-400"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <svg className="w-5 h-5 text-rose-400 absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[
                                    {
                                        title: "Adult ADHD Self-Report Scale",
                                        shortName: "ASRS-v1.1",
                                        desc: "Start the assessment to know if your struggles with attention and focus might be more than occasional distractions.",
                                        time: "3 mins quiz",
                                        image: "/assessments/adhd.png",
                                        link: "/patient/assessments/asrs"
                                    },
                                    {
                                        title: "How severe are my OCD symptoms?",
                                        shortName: "OCI-R",
                                        desc: "Start the assessment to understand whether your thoughts or behaviours might be signs of OCD.",
                                        time: "5 mins quiz",
                                        image: "/assessments/ocd.png",
                                        link: "/patient/assessments/ocd"
                                    },
                                    {
                                        title: "Am I Sad or Depressed?",
                                        shortName: "PHQ-9",
                                        desc: "Start with the assessment to understand whether your feelings of sadness may be more than a temporary mood.",
                                        time: "5 mins quiz",
                                        image: "/assessments/depression.png",
                                        link: "/patient/assessments/phq-9"
                                    },
                                    {
                                        title: "Am I Anxious?",
                                        shortName: "GAD-7",
                                        desc: "Take this quick assessment to understand if your feelings of worry or stress indicate anxiety.",
                                        time: "3 mins quiz",
                                        image: "/assessments/anxiety.png",
                                        link: "/patient/assessments/gad-7"
                                    },
                                    {
                                        title: "Primary Care PTSD Screen",
                                        shortName: "PC-PTSD-5",
                                        desc: "Start the assessment to understand if you might be experiencing signs of Post-Traumatic Stress.",
                                        time: "4 mins quiz",
                                        image: "/assessments/ptsd.png",
                                        link: "/patient/assessments/ptsd"
                                    }
                                ].filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.desc.toLowerCase().includes(searchQuery.toLowerCase()) || item.shortName.toLowerCase().includes(searchQuery.toLowerCase())).map((item, idx) => (
                                    <div key={idx} className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-all">
                                        <h4 className="font-bold text-xl text-slate-700 mb-1 tracking-tight pr-4">{item.title}</h4>
                                        <p className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-4">{item.shortName}</p>
                                        <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-grow">{item.desc}</p>

                                        <div className="flex items-end justify-between mt-auto">
                                            <div className="w-24 h-24 relative rounded-xl overflow-hidden shadow-sm">
                                                <img src={item.image} alt={item.title} className="object-cover w-full h-full" />
                                            </div>

                                            <div className="flex flex-col items-end gap-5">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                    </svg>
                                                    <span className="text-xs font-semibold">{item.time}</span>
                                                </div>
                                                <Link href={item.link} className="text-[11px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest border-b-[1.5px] border-rose-200 hover:border-rose-500 pb-0.5 transition-all">
                                                    TAKE ASSESSMENT
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 1. MENTAL WELLNESS MODULE --- */}
                {activeTab === "wellness" && (
                    <div className="space-y-10 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Interactive Breathing Tool */}
                            <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center justify-center min-h-[380px] group">
                                <div className="absolute inset-0 opacity-5 rounded-3xl" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #3b82f6 0%, transparent 70%)" }}></div>
                                <div className="relative z-10 text-center flex flex-col items-center h-full">
                                    <div className="mb-2">
                                        <h3 className="font-extrabold text-2xl text-slate-900">Guided Breath Calmer</h3>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mt-2">Breathing Exercise</span>
                                    </div>

                                    {/* Breathing Ball with enhanced animation */}
                                    <div className="relative flex-1 w-48 flex items-center justify-center my-6">
                                        <div
                                            className={`absolute rounded-full transition-all duration-[4000ms] flex flex-col items-center justify-center font-black text-sm tracking-widest text-white ${isBreathingActive && breathState === "Inhale"
                                                ? "w-44 h-44 bg-gradient-to-br from-blue-400 to-blue-500 border-4 border-blue-300 shadow-xl shadow-blue-300/50"
                                                : isBreathingActive && breathState === "Hold"
                                                    ? "w-44 h-44 bg-gradient-to-br from-emerald-400 to-emerald-500 border-4 border-emerald-300 shadow-xl shadow-emerald-300/50"
                                                    : "w-32 h-32 bg-gradient-to-br from-slate-300 to-slate-400 border-4 border-slate-300 shadow-lg"
                                                }`}
                                        >
                                            <span className="text-xs font-black uppercase tracking-widest">
                                                {isBreathingActive ? breathState : "Ready"}
                                            </span>
                                            {isBreathingActive && <span className="text-[10px] mt-1 opacity-80">{Math.round(breathProgress)}%</span>}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setIsBreathingActive(!isBreathingActive)}
                                        className={`px-10 py-3.5 rounded-full font-black text-xs uppercase tracking-wider transition-all shadow-lg ${isBreathingActive
                                            ? "bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white scale-[0.98] hover:scale-100"
                                            : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white scale-100 hover:scale-105"
                                            }`}
                                    >
                                        {isBreathingActive ? "Stop Exercise" : "Start Exercise"}
                                    </button>
                                </div>
                            </div>

                            <RecommendedAudios />
                            <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow space-y-6">
                                <div>
                                    <h3 className="font-extrabold text-2xl text-slate-900">Recommended Audio Sessions</h3>
                                    <p className="text-slate-400 text-xs font-medium mt-1">Curated for relaxation & focus</p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { title: "Calming Storm & Ocean Waves", duration: "12 mins", category: "Ambient", label: "Ambient" },
                                        { title: "Deep Muscle Relaxation (PMR)", duration: "18 mins", category: "Guided", label: "Guided" },
                                        { title: "Morning Mindfulness Routine", duration: "5 mins", category: "Quick Reset", label: "Reset" }
                                    ].map((audio, i) => (
                                        <div key={i} className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200/50 flex items-center justify-between gap-4 group hover:shadow-md transition-all hover:border-blue-300">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="text-xs uppercase tracking-[0.2em] font-black text-slate-500">{audio.label}</div>
                                                <div>
                                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">{audio.duration} • {audio.category}</span>
                                                    <h4 className="font-bold text-slate-900 mt-1.5 text-sm">{audio.title}</h4>
                                                </div>
                                            </div>
                                            <button className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform group-hover:scale-110">
                                                <svg className="w-4 h-4 fill-white ml-0.5" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 2. DISTRESS SIGNALS MODULE --- */}
                {activeTab === "distress" && (
                    <div className="space-y-10 animate-in fade-in duration-300">
                        <div className="max-w-3xl mx-auto">
                            {/* Support Hotlines with enhanced design */}
                            <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow space-y-6">
                                <div>
                                    <h3 className="font-extrabold text-2xl text-slate-900">Verified Support Lines</h3>
                                    <p className="text-slate-400 text-xs font-medium mt-2">24/7 availability for crisis support</p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { name: "Tele MANAS Helpline", number: "14416", desc: "Available 24/7. National crisis response support.", label: "Phone" },
                                        { name: "Vandrevala Foundation", number: "9999 666 555", desc: "Crisis and trauma counseling helpline.", label: "Support" }
                                    ].map((line, idx) => (
                                        <div key={idx} className="p-5 rounded-2xl bg-gradient-to-r from-orange-50 to-red-50/50 border border-orange-200/50 flex items-center justify-between gap-4 group hover:shadow-md hover:border-orange-300 transition-all">
                                            <div className="flex items-start gap-4">
                                                <span className="text-xs uppercase tracking-[0.2em] font-black text-orange-600 mt-1">{line.label}</span>
                                                <div>
                                                    <h4 className="font-black text-slate-900 text-sm">{line.name}</h4>
                                                    <span className="text-lg font-black text-orange-600 mt-1.5 block">{line.number}</span>
                                                    <p className="text-[10px] text-slate-500 font-medium mt-1.5">{line.desc}</p>
                                                </div>
                                            </div>
                                            <a
                                                href={`tel:${line.number.replace(/\s+/g, "")}`}
                                                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full font-black text-xs tracking-wider shadow-md hover:shadow-lg transition-all whitespace-nowrap transform group-hover:scale-105"
                                            >
                                                CALL NOW
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 3. UNDERSTANDING MENTAL ILLNESS MODULE --- */}
                {activeTab === "illness" && (
                    <div className="space-y-10 animate-in fade-in duration-300">

                        {/* Special Populations */}
                        <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow">
                            <h3 className="font-extrabold text-2xl mb-8 text-slate-900">Tips for Special Populations</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50 hover:shadow-lg transition-shadow group">
                                    <div className="mb-3"></div>
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block mb-2">Adolescents</span>
                                    <h4 className="font-black text-slate-900 text-lg mb-3">Children & Teenagers</h4>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        Identify developmental mood shifts, foster verbal emotional outlets, and support structured home patterns.
                                    </p>
                                </div>

                                <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200/50 hover:shadow-lg transition-shadow group">
                                    <div className="mb-3"></div>
                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider block mb-2">Geriatric</span>
                                    <h4 className="font-black text-slate-900 text-lg mb-3">Elders & Seniors</h4>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        Address retirement isolation, early-stage cognitive memory shifts, and routine physical checks.
                                    </p>
                                </div>

                            </div>
                        </div>

                        {/* Reference Articles */}
                        <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow">
                            <h3 className="font-extrabold text-2xl mb-8 text-slate-900">Condition Reference Articles</h3>
                            <div className="divide-y divide-slate-200">
                                {[
                                    { title: "Gender Patterns in Mental Health", desc: "Understanding the unique socio-cultural and diagnostic trends in mental health.", label: "Community" },
                                    { title: "Active Listening and Peer Support", desc: "How to effectively listen and support someone struggling with their mental health.", label: "Listening" }
                                ].map((article, i) => (
                                    <div key={i} className="py-5 first:pt-0 last:pb-0 flex justify-between items-start gap-6 group hover:bg-slate-50/50 px-3 -mx-3 rounded-lg transition-all">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.2em] font-black text-slate-500 mb-2">{article.label}</div>
                                            <h4 className="font-black text-slate-900 hover:text-teal-600 transition-colors cursor-pointer text-base">{article.title}</h4>
                                            <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">{article.desc}</p>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 hover:text-slate-700 cursor-pointer uppercase tracking-wider whitespace-nowrap px-4 py-2 bg-slate-100 rounded-lg group-hover:bg-teal-100 group-hover:text-teal-700 transition-all">Read File</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Symptom Clusters */}
                        <div className="space-y-6">
                            <h3 className="font-extrabold text-2xl text-slate-900">Recognizing Symptom Clusters</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[
                                    { label: "Behavioral Problems", desc: "Noticeable shifts in sleep pattern, dietary logs, and routine participation.", badge: "Behavior", color: "from-red-50 to-red-100/50 border-red-200/50" },
                                    { label: "Physical Symptoms", desc: "Chest compression feelings, continuous muscle tension, heart rate spikes.", badge: "Physical", color: "from-orange-50 to-orange-100/50 border-orange-200/50" },
                                    { label: "Social Withdrawal", desc: "Hesitation to return texts, avoidance of team sessions or family calls.", badge: "Social", color: "from-yellow-50 to-yellow-100/50 border-yellow-200/50" },
                                    { label: "Substance Dependence", desc: "Relying on escape behaviors or dependencies to manage daily stress.", badge: "Substance", color: "from-purple-50 to-purple-100/50 border-purple-200/50" },
                                    { label: "Cognitive Dissociation", desc: "Feeling detached from environments or losing touch with immediate tasks.", badge: "Cognitive", color: "from-blue-50 to-blue-100/50 border-blue-200/50" },
                                    { label: "Executive Dysfunction", desc: "Continuous memory blocks, daily plan delays, high overwhelm.", badge: "Executive", color: "from-teal-50 to-teal-100/50 border-teal-200/50" }
                                ].map((symptom, i) => (
                                    <div key={i} className={`bg-gradient-to-br ${symptom.color} rounded-2xl p-6 border hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group`}>
                                        <div className="mb-3"></div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Category {i + 1}</span>
                                        <h4 className="font-black text-slate-900 text-base mb-2 group-hover:text-slate-800 transition-colors">{symptom.label}</h4>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{symptom.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}

                {/* --- 4. SUCCESS STORIES --- */}
                {activeTab === "stories" && (
                    <div className="space-y-10 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                { name: "Rahul S.", age: "28", text: "Daily mindfulness work completely resolved my workplace anxiety cycles. I feel so much more at ease now.", tag: "Recovered", color: "from-blue-500 to-cyan-500" },
                                { name: "Priya M.", age: "34", text: "Revisiting visual grounding steps helped me manage panic triggers. I feel in control again and can face my days.", tag: "Resilient", color: "from-purple-500 to-pink-500" },
                                { name: "Anil K.", age: "42", text: "Finding clinical counseling options early gave me strong coping tools for burnout. My life has transformed.", tag: "Balanced", color: "from-green-500 to-emerald-500" }
                            ].map((story, idx) => (
                                <div key={idx} className="group bg-white rounded-3xl p-8 border border-slate-200/80 shadow-lg hover:shadow-2xl transition-all flex flex-col justify-between hover:scale-[1.02]">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="text-xs uppercase tracking-[0.2em] font-black text-slate-500">Story</div>
                                        <span className={`px-4 py-2 rounded-full bg-gradient-to-r ${story.color} text-white text-[10px] font-black uppercase tracking-wider shadow-lg`}>
                                            {story.tag}
                                        </span>
                                    </div>

                                    <p className="text-slate-600 font-medium italic leading-relaxed mb-6 text-sm flex-grow">
                                        "{story.text}"
                                    </p>

                                    <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                                        <div>
                                            <h4 className="font-black text-slate-900 text-base">{story.name}</h4>
                                            <span className="text-xs text-slate-400 font-bold">Age {story.age}</span>
                                        </div>
                                        <div className="text-right text-[10px] font-semibold text-slate-400">Real Story</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- 5. SELF HELP MODULE --- */}
                {activeTab === "selfhelp" && (
                    <div className="space-y-10 animate-in fade-in duration-300">


                        {/* PDF Downloads with enhanced design */}
                        <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow space-y-8">
                            <div>
                                <h3 className="font-extrabold text-2xl text-slate-900">Worksheet Files</h3>
                                <p className="text-slate-400 text-xs font-medium mt-2">Downloadable resources & worksheets</p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { title: "Cognitive Distortions Guide", size: "1.2 MB", label: "Guide", color: "from-blue-500 to-cyan-500" },
                                    { title: "Daily Anxiety Tracker Log", size: "640 KB", label: "Tracker", color: "from-purple-500 to-pink-500" },
                                    { title: "Sleep Hygiene Check-list", size: "820 KB", label: "Checklist", color: "from-indigo-500 to-blue-500" }
                                ].map((doc, idx) => (
                                    <div key={idx} className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/50 flex items-center justify-between gap-4 group hover:shadow-lg hover:border-slate-300 transition-all">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="text-xs uppercase tracking-[0.2em] font-black text-slate-600">{doc.label}</div>
                                            <div>
                                                <h4 className="font-black text-slate-900 text-sm">{doc.title}</h4>
                                                <span className="text-[9px] text-slate-500 font-bold mt-1 block">{doc.size}</span>
                                            </div>
                                        </div>
                                        <button className={`px-6 py-3 bg-gradient-to-r ${doc.color} text-white rounded-full font-black text-[10px] uppercase tracking-wider flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform group-hover:scale-105`}>
                                            Download
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 6. BRAIN FOOD ROOM --- */}
                {activeTab === "brainfood" && (
                    <div className="space-y-10 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Sudoku with enhanced design */}
                            <div className="bg-white rounded-3xl p-4 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow flex flex-col items-center">
                                <div className="text-center mb-8">
                                    <h3 className="font-extrabold text-2xl text-slate-900">Brain Busters: Sudoku</h3>
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mt-2">Cognitive Focus</span>
                                    <p className="text-xs text-slate-500 font-medium mt-3">Challenge your mind and improve focus</p>
                                </div>

                                {/* Grid with enhanced styling */}
                                <div className="grid grid-cols-9 gap-0.5 border-4 border-slate-900 p-2 bg-slate-900 rounded-xl shadow-2xl mb-8 w-full max-w-[360px]">
                                    {sudokuGrid.map((row, rIdx) =>
                                        row.map((val, cIdx) => (
                                            <input
                                                key={`${rIdx}-${cIdx}`}
                                                type="text"
                                                maxLength={1}
                                                value={val === 0 ? "" : val}
                                                onChange={(e) => handleSudokuChange(rIdx, cIdx, e.target.value)}
                                                className={`w-full aspect-square text-center font-black text-xs min-[360px]:text-sm focus:ring-2 focus:ring-rose-400 rounded border-[1px] transition-all ${sudokuInitial[rIdx][cIdx]
                                                    ? "bg-slate-200 text-slate-900 font-extrabold cursor-not-allowed border-slate-300"
                                                    : "bg-white text-rose-600 font-bold border-slate-200 hover:bg-rose-50"
                                                    }`}
                                            />
                                        ))
                                    )}
                                </div>

                                <div className="flex gap-3 w-full">
                                    <button className="flex-1 py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all">
                                        Reset
                                    </button>
                                    <button className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all">
                                        Validate
                                    </button>
                                </div>
                            </div>

                            {/* Thought Diary with enhanced design */}
                            <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-lg hover:shadow-xl transition-shadow flex flex-col">
                                <div className="mb-8">
                                    <h3 className="font-extrabold text-2xl text-slate-900">Thought Diary</h3>
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mt-2">Local Journal Log</span>
                                    <p className="text-xs text-slate-500 font-medium mt-3">Capture and reflect on your thoughts</p>
                                </div>

                                <form onSubmit={handleJournalSave} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-3">
                                            Current Mood State
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Calm", "Happy", "Tired", "Anxious", "Sad"].map((mood) => (
                                                <button
                                                    key={mood}
                                                    type="button"
                                                    onClick={() => setSelectedMood(mood)}
                                                    className={`py-2 px-4 rounded-full text-[11px] font-black border-2 transition-all ${selectedMood === mood
                                                        ? "bg-rose-500 text-white border-rose-500 shadow-lg scale-105"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                                        }`}
                                                >
                                                    {mood}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-3">
                                            Observations & Reflections
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={journalText}
                                            onChange={(e) => setJournalText(e.target.value)}
                                            placeholder="Write whatever is on your mind..."
                                            className="w-full bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent placeholder:text-slate-400 resize-none"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shadow-lg"
                                    >
                                        Save Entry
                                    </button>
                                </form>

                                {/* Diary History */}
                                <div className="mt-8 flex-1 flex flex-col">
                                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-4">Diary History</h4>
                                    <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                                        {journalEntries.map((entry) => (
                                            <div key={entry.id} className="p-4 bg-gradient-to-br from-rose-50/50 to-pink-50/30 border border-rose-200/50 rounded-xl hover:shadow-md transition-all">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[9px] font-bold text-slate-500">{entry.date}</span>
                                                    <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">{entry.mood}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 font-medium leading-relaxed">{entry.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>
                )}

            </div>

            <AnimatePresence>
                <LibraryMiniPlayer
                    onExpand={(slug) => router.push(buildListenItemHref(slug))}
                />
            </AnimatePresence>
        </div>
    )
}

function LibraryMiniPlayer({
    onExpand,
}: {
    onExpand: (slug: string) => void
}) {
    return (
        <MiniPlayer onExpand={(track) => onExpand(track.slug)} />
    )
}


export default function LibraryPage() {
    return (
        <Suspense
            fallback={
                <div className="flex-1 h-full w-full bg-[#FFF9F8]" aria-hidden />
            }
        >
            <ListenPlayerProvider>
                <ExploreProvider>
                    <LibraryPageContent />
                </ExploreProvider>
            </ListenPlayerProvider>
        </Suspense>
    )
}
