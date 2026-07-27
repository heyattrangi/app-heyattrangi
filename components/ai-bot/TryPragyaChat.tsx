"use client"

import { useState, useRef, useEffect, useMemo, type FormEvent } from "react"
import Image from "next/image"
import { useSession } from "next-auth/react"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  isError?: boolean
}

interface ChatMode {
  id: string
  title: string
  description: string
}

const SUGGESTION_POOL = [
  "I'd like to explore this a bit more.",
  "Can you help me understand why I feel this way?",
  "Actually, I just need to vent for a moment.",
  "Let's focus on finding some coping strategies.",
  "I'm feeling a bit overwhelmed right now.",
  "What can I do to feel more grounded?",
  "Can we talk about how to manage this?"
]

const TypewriterText = ({
  text,
  speed = 30,
  onComplete,
  onCharacterTyped
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onCharacterTyped?: () => void;
}) => {
  const [displayedText, setDisplayedText] = useState("")

  useEffect(() => {
    let index = 0
    setDisplayedText("")

    // Dynamically calculate chunk size to ensure typing finishes within ~750ms
    const totalTicks = 50
    const increment = Math.max(1, Math.ceil(text.length / totalTicks))

    const interval = setInterval(() => {
      index += increment
      if (index >= text.length) {
        setDisplayedText(text)
        clearInterval(interval)
        onComplete?.()
      } else {
        setDisplayedText(text.slice(0, index))
        onCharacterTyped?.()
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return <>{displayedText}</>
}

const CHAT_MODES: ChatMode[] = [
  { id: "listen", title: "Just Listen", description: "I'll hear you out and validate your feelings." },
  { id: "reflect", title: "Reflect", description: "I'll help you see patterns and clarify thoughts." },
  { id: "think", title: "Help Me Think", description: "We'll brainstorm or untangle a problem." },
  { id: "direct", title: "Answer Directly", description: "No fluff, just straight answers." },
]

const EXPRESSION_KEYWORDS: Record<string, string[]> = {
  "SAFETY": ["concerned", "helpline", "reach out", "trusted person", "please", "danger", "safe", "crisis", "emergency"],
  "COMFORTING": ["comfort", "here for you", "not alone", "support", "hug", "care", "by your side", "always here"],
  "EMPATHETIC": ["understand", "hear you", "feel", "must be", "sounds", "that's hard", "that must", "empathize"],
  "REFLECTIVE": ["wonder", "reflect", "think about", "perhaps", "maybe", "could it be", "it seems", "ponder"],
  "WARM": ["glad", "happy", "wonderful", "lovely", "beautiful", "warmth", "smile", "joy", "positive"],
  "STRESSED": ["overwhelm", "stress", "anxious", "anxiety", "pressure", "too much", "exhaust", "burden"],
  "TIRED": ["tired", "exhausted", "drained", "fatigue", "worn out", "sleep", "rest", "heavy"],
  "STEADY": ["okay", "alright", "stable", "steady", "manage", "cope", "going through"],
  "TALKING": ["tell me", "share", "want to talk", "what happened", "go on", "listening", "what's going on"],
  "NEUTRAL": ["noted", "sure", "okay", "right", "yes", "no"],
}

const EXPRESSION_FILE_MAP: Record<string, string> = {
  "SAFETY": "steady.png",
  "COMFORTING": "warm.png",
  "EMPATHETIC": "empathy.png",
  "REFLECTIVE": "reflective.png",
  "WARM": "warm.png",
  "STRESSED": "stressed.png",
  "TIRED": "tired.png",
  "STEADY": "steady.png",
  "TALKING": "talking.png",
  "NEUTRAL": "neutral.png",
  "DEFAULT": "neutral.png"
}

const getBotExpression = (text: string): string => {
  const textLower = text.toLowerCase()
  for (const [expression, keywords] of Object.entries(EXPRESSION_KEYWORDS)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      return expression
    }
  }
  return "DEFAULT"
}

const LOADING_MESSAGES = [
  "Listening...",
  "Thinking...",
  "Reflecting...",
  "Typing..."
]

const GUEST_TRIAL_LIMIT = 5
const GUEST_TRIAL_COUNT_KEY = "heyattrangi_guest_trial_count"
const GUEST_TRIAL_EXHAUSTED_KEY = "heyattrangi_guest_trial_exhausted"

const ChatLoadingIndicator = () => {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev))
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex justify-start animate-in fade-in duration-300">
      <div className="bg-white border border-gray-100 rounded-3xl p-5 rounded-tl-sm shadow-sm flex flex-col gap-3 min-w-[200px]">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-orange-400/60 rounded-full animate-bounce"></div>
          <div className="w-2.5 h-2.5 bg-orange-400/80 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
        </div>
        <div className="text-[12px] font-medium text-gray-400 animate-pulse">
          {LOADING_MESSAGES[msgIndex]}
        </div>
      </div>
    </div>
  )
}

export default function TryPragyaChat({
  sessionId,
  initialPlan = "FREE",
  initialChatCount = 0,
  userName = ""
}: {
  sessionId: string;
  initialPlan?: string;
  initialChatCount?: number;
  userName?: string;
}) {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"
  const isGuestSession = !sessionId
  const [guestTrialCount, setGuestTrialCount] = useState(0)
  const [guestTrialHydrated, setGuestTrialHydrated] = useState(false)
  const [guestTrialExhausted, setGuestTrialExhausted] = useState(false)

  useEffect(() => {
    if (!isGuestSession || guestBootstrapAttemptedRef.current) {
      return
    }
    guestBootstrapAttemptedRef.current = true

    fetch("/api/pragya/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {
      // Cookie bootstrap is best-effort; chat requests can still initialize it.
    })
  }, [isGuestSession])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!isGuestSession) {
      setGuestTrialHydrated(true)
      setGuestTrialExhausted(false)
      return
    }

    const storedCount = Number(localStorage.getItem(GUEST_TRIAL_COUNT_KEY) || "0")
    const normalizedCount = Number.isFinite(storedCount) ? Math.max(0, storedCount) : 0
    const storedExhausted = localStorage.getItem(GUEST_TRIAL_EXHAUSTED_KEY) === "true"
    const exhausted = storedExhausted || normalizedCount >= GUEST_TRIAL_LIMIT

    setGuestTrialCount(normalizedCount)
    setGuestTrialExhausted(exhausted)
    setGuestTrialHydrated(true)

    if (exhausted) {
      localStorage.setItem(GUEST_TRIAL_EXHAUSTED_KEY, "true")
    }
  }, [isGuestSession])

  const [hasStarted, setHasStarted] = useState(false)
  const [preferredName, setPreferredName] = useState("")
  const [selectedMode, setSelectedMode] = useState<string | null>("direct")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [botExpression, setBotExpression] = useState("NEUTRAL")
  const [lastUserMessage, setLastUserMessage] = useState("")

  const [summarizing, setSummarizing] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryReport, setSummaryReport] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summarizeHint, setSummarizeHint] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pastMessages, setPastMessages] = useState<ChatMessage[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const [plan, setPlan] = useState(initialPlan)
  const [chatCount, setChatCount] = useState(initialChatCount)
  const [showMemoryPolicy, setShowMemoryPolicy] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const guestBootstrapAttemptedRef = useRef(false)

  useEffect(() => {
    if (initialPlan) setPlan(initialPlan)
  }, [initialPlan])

  useEffect(() => {
    if (initialChatCount !== undefined) setChatCount(initialChatCount)
  }, [initialChatCount])

  const hasUserMessages = useMemo(() => messages.some((m) => m.role === "user"), [messages])

  const limitData = useMemo(() => {
    if (isGuestSession) {
      const remaining = Math.max(0, GUEST_TRIAL_LIMIT - guestTrialCount)
      return {
        isLimitReached: guestTrialExhausted,
        maxChats: GUEST_TRIAL_LIMIT,
        remaining,
      }
    }

    return {
      isLimitReached: false,
      maxChats: Infinity,
      remaining: Infinity,
    }
  }, [guestTrialCount, guestTrialExhausted, isGuestSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Removed auto-start useEffect so the user can see the pre-chat screen.

  const handleStartChat = () => {
    if (selectedMode) {
      setHasStarted(true)
      const modeDetails = CHAT_MODES.find(m => m.id === selectedMode)
      const initialMsg = `Hi! I'm setting my mode to: ${modeDetails?.title}. How can I help you today?`
      setIsTyping(true)
      setMessages([{ role: "assistant", content: initialMsg }])
      setBotExpression("NEUTRAL")
    }
  }

  const handleShowSuggestions = async () => {
    setIsSuggestionsLoading(true)
    setShowSuggestions(true)
    setSuggestions([])
    try {
      const res = await fetch("/api/pragya/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: isAuthenticated ? sessionId : undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      } else {
        const shuffled = [...SUGGESTION_POOL].sort(() => 0.5 - Math.random())
        setSuggestions(shuffled.slice(0, 3))
      }
    } catch {
      const shuffled = [...SUGGESTION_POOL].sort(() => 0.5 - Math.random())
      setSuggestions(shuffled.slice(0, 3))
    } finally {
      setIsSuggestionsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage("")
    setLastUserMessage(suggestion)
    setMessages((prev) => [...prev, { role: "user", content: suggestion }])
    sendMessage(undefined, suggestion)
  }

  const sendMessage = async (e?: FormEvent, retryMsg?: string) => {
    e?.preventDefault()
    if ((!inputMessage.trim() && !retryMsg) || isLoading || !guestTrialHydrated || limitData.isLimitReached) return

    if (!hasStarted) {
      setHasStarted(true)
    }

    const userMsg = retryMsg || inputMessage
    if (!retryMsg) {
      setLastUserMessage(userMsg)
      setInputMessage("")
      setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    }

    setIsLoading(true)
    setSuggestions([])
    setShowSuggestions(false)

    try {
      const res = await fetch("/api/pragya/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: isAuthenticated ? sessionId : undefined,
          message: userMsg,
          generate_suggestions: false
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to connect to the assistant.")
      }

      const data = await res.json() as { reply?: string; currentCount?: number; plan?: string; error?: string; suggestions?: string[] }

      if (data.error === "LIMIT_REACHED" || (data.currentCount !== undefined && data.currentCount > chatCount)) {
        if (typeof data.currentCount === "number") setChatCount(data.currentCount)
        if (typeof data.plan === "string") setPlan(data.plan)
      }

      if (isGuestSession && !retryMsg) {
        const nextCount = guestTrialCount + 1
        const exhausted = nextCount >= GUEST_TRIAL_LIMIT
        setGuestTrialCount(nextCount)
        setGuestTrialExhausted(exhausted)
        localStorage.setItem(GUEST_TRIAL_COUNT_KEY, String(nextCount))
        if (exhausted) {
          localStorage.setItem(GUEST_TRIAL_EXHAUSTED_KEY, "true")
        }
      }

      const reply = typeof data.reply === "string" ? data.reply : "Sorry, I didn't quite get that. Could you please rephrase?"

      setIsTyping(true)
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])
      setBotExpression(getBotExpression(reply))
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions)
      }

    } catch (error: unknown) {
      console.error("Chat error:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, I'm having trouble connecting to the backend right now."
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
          isError: true
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const resetChat = () => {
    setHasStarted(false)
    setSelectedMode("direct")
    setSuggestions([])
    setShowSuggestions(false)
    setMessages([])
    setBotExpression("NEUTRAL")
    setSummaryOpen(false)
    setSummaryReport(null)
    setSummaryError(null)
    setSummarizeHint(null)
  }

  const endAndSummarize = async () => {
    setSummarizeHint(null)
    if (!hasUserMessages) {
      setSummarizeHint("Send at least one message so we can summarize your chat.")
      return
    }
    setSummarizing(true)
    setSummaryError(null)
    try {
      const res = await fetch("/api/pragya/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: isAuthenticated ? sessionId : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { report?: string; error?: string }
      if (!res.ok) {
        setSummaryReport(null)
        setSummaryError(typeof data.error === "string" ? data.error : "Could not load summary.")
        setSummaryOpen(true)
        return
      }
      const report = typeof data.report === "string" ? data.report : "No summary returned."
      setSummaryReport(report)
      setSummaryOpen(true)
    } catch {
      setSummaryReport(null)
      setSummaryError("Network error. Try again in a moment.")
      setSummaryOpen(true)
    } finally {
      setSummarizing(false)
    }
  }

  const closeSummaryOnly = () => {
    setSummaryOpen(false)
  }

  const endSessionAfterSummary = () => {
    setSummaryOpen(false)
    setSummaryReport(null)
    setSummaryError(null)
    resetChat()
  }

  return (
    <>
      <div className="flex flex-col h-full bg-white text-gray-800 overflow-hidden font-sans relative">
        {/* Subtle grid pattern + soft radial ambient glow */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40" style={{
          backgroundImage: `
            radial-gradient(circle at 100% 0%, rgba(254, 215, 170, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(254, 243, 199, 0.15) 0%, transparent 50%),
            radial-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 20px 20px'
        }}></div>
        <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1600px] mx-auto overflow-hidden relative h-full z-10">

          {/* Mobile Header (Visible only on small screens) */}
          <div className="md:hidden w-full relative shrink-0 z-20 overflow-hidden bg-transparent">
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
              {!isAuthenticated && (
                <a
                  href="/auth/signin"
                  title="Sign In"
                  className="p-2 text-gray-500 hover:text-orange-500 rounded-full bg-white/40 backdrop-blur-md hover:bg-white transition-colors border border-white/40 shadow-sm flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </a>
              )}
              <button
                onClick={resetChat}
                title="Reset Chat"
                className="p-2 text-gray-500 hover:text-orange-500 rounded-full bg-white/40 backdrop-blur-md hover:bg-white transition-colors border border-white/40 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button
                onClick={endAndSummarize}
                disabled={summarizing || !hasStarted || messages.length === 0}
                title="End & Summarize"
                className={`p-2 rounded-full transition-colors border shadow-sm backdrop-blur-md ${summarizing || !hasStarted || messages.length === 0
                  ? "text-gray-400 bg-white/30 border-white/20 cursor-not-allowed"
                  : "text-white bg-orange-500 border-orange-400 hover:bg-orange-600"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </button>
            </div>

            <div className="flex px-5 pt-10 pb-8 items-center justify-between relative z-10 max-w-lg mx-auto">
              <div className="relative w-[150px] h-[150px] shrink-0 -ml-6 z-10">
                <Image
                  src={`/new_bot/${EXPRESSION_FILE_MAP[botExpression] || 'neutral.png'}`}
                  alt="Pragya Avatar"
                  fill
                  className="object-cover scale-[1.15]"
                  sizes="150px"
                  priority
                  unoptimized
                  style={{ maskImage: 'radial-gradient(circle, black 60%, transparent 80%)', WebkitMaskImage: 'radial-gradient(circle, black 60%, transparent 80%)' }}
                />
              </div>
              <div className="bg-white p-5 rounded-3xl rounded-tl-sm shadow-[0_8px_30px_rgb(0,0,0,0.1)] flex-1 -ml-4 relative z-30 border border-white">
                <h1 className="text-[17px] font-bold text-[#4a2e5d] mb-1.5 flex items-center gap-1.5">
                  Hey Attrangi! <span className="text-lg">👋</span>
                </h1>
                <p className="text-[13px] text-gray-600 leading-relaxed font-medium pr-2">I'm here to listen, support and help you feel better.</p>
                <div className="absolute bottom-3 right-4 text-[#d9b8f2]">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </div>
              </div>
            </div>
            {/* Chat container top overlap */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-[24px] z-20"></div>
          </div>

          {/* Left Sidebar */}
          <div className="hidden md:flex w-[360px] md:w-[400px] bg-white border-r border-gray-100 flex-col items-center py-8 px-6 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 relative">
            <div className="flex-1 flex flex-col items-center justify-center w-full pb-12">
              <h1 className="text-xl font-bold text-gray-800 tracking-wide mb-8">Hey Attrangi</h1>

              {/* Bot Avatar Container */}
              <div className="relative w-[320px] h-[320px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(249,107,19,0.15)] mb-8 overflow-hidden group border border-orange-50/50">
                <div className="relative w-full h-full transform transition-transform duration-700 ease-out group-hover:scale-105">
                  <Image
                    src={`/new_bot/${EXPRESSION_FILE_MAP[botExpression] || 'neutral.png'}`}
                    alt="Pragya Avatar"
                    fill
                    className="object-cover"
                    sizes="320px"
                    priority
                    unoptimized
                  />
                </div>
              </div>

              {/* Mode Pill */}
              <div className="bg-gray-50 border border-gray-200 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-inner group cursor-default transition-all duration-300 hover:border-orange-200 mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 group-hover:bg-orange-400 transition-colors"></div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-600 transition-colors">{botExpression} MODE</span>
              </div>

              {/* Action Buttons (Added back from previous version) */}
              <div className="w-full max-w-[280px] space-y-3">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setHistoryOpen(true)
                      setIsHistoryLoading(true)
                      try {
                        const res = await fetch("/api/pragya/history")
                        const data = await res.json()
                        if (res.ok && data.messages) {
                          setPastMessages(data.messages)
                        }
                      } catch (e) {
                        console.error("Error fetching history:", e)
                      } finally {
                        setIsHistoryLoading(false)
                      }
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-4 text-[15px] font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Chat History
                  </button>
                ) : (
                  <a
                    href="/auth/signin"
                    className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-orange-500 bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-4 text-[15px] font-bold text-white shadow-md transition-colors hover:from-orange-700 hover:to-orange-600"
                  >
                    <svg className="h-5 w-5 text-orange-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In to Save Chats
                  </a>
                )}
                <button
                  type="button"
                  onClick={resetChat}
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-4 text-[15px] font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset Chat
                </button>
                <button
                  type="button"
                  onClick={endAndSummarize}
                  disabled={summarizing}
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-orange-500 bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-4 text-[15px] font-medium text-white shadow-md transition-colors hover:from-orange-700 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <svg className="h-5 w-5 shrink-0 text-orange-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {summarizing ? "Summarizing…" : "End & Summarize"}
                </button>
                {summarizeHint && (
                  <p className="text-center text-[12px] font-medium text-orange-700">{summarizeHint}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMemoryPolicy(true)}
                className="mt-6 text-[12px] font-bold text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Memory Policy
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className={`flex-1 flex justify-center bg-transparent relative overflow-y-auto ${limitData.isLimitReached ? 'overflow-hidden' : ''}`}>

            {/* LIMIT REACHED MODAL OVERLAY */}
            {limitData.isLimitReached && (
              <div className="absolute inset-0 z-50 backdrop-blur-md bg-white/30 flex items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="bg-white/90 backdrop-blur-xl p-10 rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/50 text-center max-w-md w-full scale-in-center">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Limit Reached</h2>
                  <p className="text-gray-500 mb-8 font-medium">
                    {isGuestSession
                      ? `You've exhausted the free trial on this device. Sign in to continue chatting with Pragya.`
                      : "Chat limit reached."}
                  </p>

                  <div className="space-y-4">
                    <a
                      href={isGuestSession ? "/auth/signin" : "/patient/billing"}
                      className="block w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-1 active:scale-[0.98]"
                    >
                      {isGuestSession ? "Sign In to Continue" : "Upgrade Plan"}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Limit Badge */}
            <div className={`absolute right-4 md:right-8 top-4 md:top-8 z-50 hidden lg:flex items-center transition-all duration-700 ${hasStarted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-full pl-2 pr-5 py-1.5 backdrop-blur-sm bg-white/90 pointer-events-auto">
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Available</span>
                  <span className="text-sm font-bold text-gray-800">
                    {isGuestSession
                      ? `${limitData.remaining} / ${GUEST_TRIAL_LIMIT} Free Trials`
                      : "Unlimited Chats"}
                  </span>
                </div>
              </div>
            </div>

            {/* Unified Chat Layout with Smooth Transitions */}
            <div className="w-full max-w-4xl mx-auto flex flex-col h-full bg-transparent overflow-hidden relative">

              {/* Header / Mode Toggle Area */}
              <div
                className={`transition-all duration-700 ease-in-out w-full flex flex-col shrink-0 relative z-10 ${!hasStarted
                  ? 'flex-1 items-center justify-center mt-[-8vh]'
                  : 'pt-8 pb-4'
                  }`}
              >
                {/* Big Title */}
                <div
                  className={`text-center transition-all duration-700 ease-in-out overflow-hidden ${!hasStarted
                    ? 'opacity-100 max-h-[200px] mb-12 scale-100'
                    : 'opacity-0 max-h-0 mb-0 scale-95 pointer-events-none'
                    }`}
                >
                  <h2 className="text-[14px] md:text-[16px] uppercase tracking-[0.2em] font-black text-gray-700 mb-6">
                    HELLO {userName ? userName.toUpperCase() : "THERE"}!
                  </h2>
                  <h1 className="text-[28px] md:text-[40px] font-bold text-gray-900 leading-tight">
                    I'm here to listen and support you between sessions.
                  </h1>
                  {!isAuthenticated && (
                    <p className="mt-4 text-sm text-gray-500">
                      {guestTrialExhausted ? "Free trial exhausted on this device. " : "Already have an account? "}
                      <a href="/auth/signin" className="text-orange-500 font-bold hover:underline">
                        Sign In
                      </a>
                    </p>
                  )}
                </div>

                {/* Mode Buttons */}
                <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3 w-full pr-16 md:pr-4">
                  {CHAT_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        if (selectedMode !== mode.id) {
                          setSelectedMode(mode.id);
                          if (hasStarted) {
                            setIsTyping(true)
                            setMessages(prev => [...prev, { role: "assistant", content: `I've switched to **${mode.title}** mode. ${mode.description}` }]);
                          }
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-[12px] md:px-4 md:py-2 md:text-[13px] font-medium transition-all duration-300 shadow-sm whitespace-nowrap ${selectedMode === mode.id
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 scale-105'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-orange-200 hover:text-orange-500'
                        }`}
                    >
                      {mode.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Messages */}
              <div
                className={`overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar bg-transparent transition-all duration-700 ease-in-out ${!hasStarted ? 'flex-none opacity-0 h-0 p-0 md:p-0' : 'flex-1 opacity-100'
                  }`}
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-5 text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === "user"
                        ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-tr-sm shadow-[0_4px_14px_rgba(249,107,19,0.25)]"
                        : msg.isError
                          ? "bg-red-50 text-red-800 rounded-tl-sm border border-red-100 shadow-[0_2px_10px_rgba(220,38,38,0.04)]"
                          : "bg-white text-gray-800 rounded-tl-sm border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
                        }`}
                    >
                      {msg.role === "assistant" && !msg.isError && idx === messages.length - 1 ? (
                        <TypewriterText
                          text={msg.content}
                          onCharacterTyped={() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
                          }}
                          onComplete={() => {
                            setIsTyping(false)
                            setTimeout(() => {
                              setShowSuggestions(true)
                            }, 3000)
                          }}
                        />
                      ) : (
                        msg.content
                      )}
                      {msg.isError && lastUserMessage && (
                        <button
                          onClick={() => sendMessage(undefined, lastUserMessage)}
                          className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-red-600 hover:text-red-700 transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-red-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && <ChatLoadingIndicator />}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Chat Input Field */}
              <div className="p-4 md:p-6 pb-8 z-10 bg-transparent shrink-0">
                <div className="max-w-4xl mx-auto relative">
                  {showSuggestions && (isSuggestionsLoading || suggestions.length > 0) && !isTyping && !isLoading && hasStarted ? (
                    <div className="absolute bottom-full mb-3 left-0 right-0 flex items-center justify-between gap-2 px-2 z-20">
                      {isSuggestionsLoading ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-100 rounded-full text-[13px] text-orange-600 font-medium shadow-[0_2px_8px_rgba(249,107,19,0.1)]">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span>Generating suggestions...</span>
                        </div>
                      ) : suggestions.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSuggestionClick(s)}
                              className="whitespace-nowrap px-4 py-2 bg-white border border-orange-200 text-orange-600 rounded-full text-[13px] font-medium shadow-[0_2px_8px_rgba(249,107,19,0.15)] hover:bg-orange-50 hover:-translate-y-0.5 transition-all"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestions([])
                          setShowSuggestions(false)
                        }}
                        className="p-1.5 bg-white border border-orange-200 text-orange-400 hover:text-orange-600 rounded-full shadow-[0_2px_8px_rgba(249,107,19,0.15)] hover:bg-orange-50 transition-all flex items-center justify-center shrink-0"
                        title="Dismiss suggestions"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    !isTyping && !isLoading && hasStarted && (
                      <div className="absolute bottom-full mb-3 left-2 z-20">
                        <button
                          type="button"
                          onClick={handleShowSuggestions}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-orange-200 text-orange-600 rounded-full text-[12px] font-bold shadow-[0_2px_8px_rgba(249,107,19,0.1)] hover:bg-orange-50 hover:-translate-y-0.5 transition-all"
                        >
                          <svg className="w-3.5 h-3.5 text-orange-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          Suggestions ✨
                        </button>
                      </div>
                    )
                  )}

                  <div className={`transition-all duration-700 ${!hasStarted ? 'opacity-0 h-0 overflow-hidden mb-0' : 'flex justify-between items-center mb-2 px-2 md:hidden opacity-100 h-auto'}`}>
                    <span className="text-[12px] text-gray-400 font-bold">
                      {isGuestSession
                        ? `${limitData.remaining} free trial chats remaining`
                        : "Unlimited chats"}
                    </span>
                  </div>

                  <form onSubmit={sendMessage} className="relative flex items-center">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={hasStarted ? "Type your message here..." : "Tell me what's been on your mind..."}
                      className={`w-full bg-white text-gray-800 placeholder-gray-400 py-5 pl-8 pr-16 focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 transition-all text-[15px] ${!hasStarted ? 'rounded-full border border-orange-100 shadow-[0_10px_40px_rgba(249,107,19,0.08)] font-medium' : 'rounded-2xl border border-gray-100 shadow-inner'}`}
                      disabled={isLoading}
                      autoFocus
                    />
                    <div className="absolute right-2 top-2 bottom-2 flex items-center">
                      <button
                        type="submit"
                        disabled={isLoading || !inputMessage.trim()}
                        className={`p-2.5 rounded-[12px] h-full transition-all duration-300 flex items-center justify-center aspect-square ${isLoading || !inputMessage.trim()
                          ? "text-gray-400 bg-transparent"
                          : "text-white bg-orange-500 hover:bg-orange-600 shadow-md hover:-translate-y-0.5 hover:shadow-lg shadow-orange-500/30"
                          }`}
                      >
                        <svg className="w-5 h-5 transform translate-x-[-1px] translate-y-[1px]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </button>
                    </div>
                  </form>
                </div>

                <div className={`transition-all duration-700 ${!hasStarted ? 'opacity-0 h-0 overflow-hidden mt-0' : 'flex justify-center items-center mt-4 text-[11px] text-gray-500 font-medium opacity-100 h-auto'}`}>
                  <p className="hidden md:block">Hey Attrangi may produce inaccurate information about people, places, or facts.</p>
                  <button
                    type="button"
                    onClick={() => setShowMemoryPolicy(true)}
                    className="md:hidden text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Memory Policy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Policy Modal */}
      {showMemoryPolicy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative scale-in-center">
            <button
              onClick={() => setShowMemoryPolicy(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              How your chat is stored
            </h3>
            <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">1</div>
                <div><strong className="text-gray-800">Frontend (Browser Memory):</strong> The messages you see on the screen are stored purely in your browser while the page is open. If you refresh the page, the visible chat history clears.</div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</div>
                <div><strong className="text-gray-800">Backend:</strong> Our server only stores a temporary ID to enforce daily chat limits. It does not save the actual messages.</div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">3</div>
                <div>
                  <strong className="text-gray-800">AI Bot Backend:</strong> The chat is processed securely, and the server maintains short-term context only during your active session.
                  <p className="mt-2 text-orange-700 font-medium">
                    Once you are onboarded, we will take special care of the details you share. Everything is in good hands, and your information will be stored safely.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setShowMemoryPolicy(false)}
                className="bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold py-2.5 px-6 rounded-xl transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Slide-Over */}
      {historyOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 transition-opacity duration-300"
            aria-label="Close history"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="relative z-10 flex w-full max-w-md flex-col bg-white shadow-2xl duration-300 animate-in slide-in-from-right h-full">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-800">Chat History</h2>
              <button
                onClick={() => setHistoryOpen(false)}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-orange-50 hover:text-orange-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto p-6 bg-gray-50/30">

              <div className="space-y-4">
                {isHistoryLoading ? (
                  <div className="flex justify-center p-8">
                    <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                  </div>
                ) : pastMessages.length > 0 ? (
                  pastMessages.map((msg, idx) => (
                    <div key={idx} className={`p-4 rounded-xl shadow-sm border ${msg.role === 'user' ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-orange-600' : 'text-gray-500'}`}>
                          {msg.role === 'user' ? 'You' : 'Pragya'}
                        </span>
                      </div>
                      <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-400">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="mb-1 text-[15px] font-bold text-gray-800">No Past Sessions</h3>
                    <p className="text-[13px] text-gray-500">
                      Your previous chat history will appear here once you've completed some sessions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pragya-summary-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 transition-opacity duration-300"
            aria-label="Close summary"
            onClick={closeSummaryOnly}
          />
          <div className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl duration-300 animate-in fade-in zoom-in-95">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h2 id="pragya-summary-title" className="text-lg font-bold text-gray-800">
                Session summary
              </h2>
              <p className="mt-1 text-[13px] text-gray-500">
                For your reflection only — not a diagnosis or medical record.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {summaryError ? (
                <p className="text-[15px] leading-relaxed text-red-600">{summaryError}</p>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-gray-800">
                  {summaryReport}
                </pre>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeSummaryOnly}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={endSessionAfterSummary}
                className="rounded-xl bg-orange-500 px-4 py-3 text-[15px] font-medium text-white shadow-md transition-colors hover:bg-orange-600"
              >
                End session & reset chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
