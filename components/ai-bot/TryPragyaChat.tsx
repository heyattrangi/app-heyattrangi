"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBotAvatar } from "@/lib/avatar";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import LimitExceededModal, { type LimitExceededInfo } from "@/components/ui/LimitExceededModal";
import PremiumChatModal from "./PremiumChatModal";
import PremiumVoiceModal from "./PremiumVoiceModal";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    isError?: boolean;
    action?: {
        type: string;
        title: string;
        url: string;
    };
}

interface ChatMode {
    id: string;
    title: string;
    description: string;
}

const SUGGESTION_POOL = [
    "I'd like to explore this a bit more.",
    "Can you help me understand why I feel this way?",
    "Actually, I just need to vent for a moment.",
    "Let's focus on finding some coping strategies.",
    "I'm feeling a bit overwhelmed right now.",
    "What can I do to feel more grounded?",
    "Can we talk about how to manage this?",
];

const TypewriterText = ({
    text,
    speed = 30,
    onComplete,
    onCharacterTyped,
}: {
    text: string;
    speed?: number;
    onComplete?: () => void;
    onCharacterTyped?: () => void;
}) => {
    const [displayedText, setDisplayedText] = useState("");

    useEffect(() => {
        let index = 0;
        setDisplayedText("");

        // Dynamically calculate chunk size to ensure typing finishes within ~750ms
        const totalTicks = 50;
        const increment = Math.max(1, Math.ceil(text.length / totalTicks));

        const interval = setInterval(() => {
            index += increment;
            if (index >= text.length) {
                setDisplayedText(text);
                clearInterval(interval);
                onComplete?.();
            } else {
                setDisplayedText(text.slice(0, index));
                onCharacterTyped?.();
            }
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed]);

    return <>{displayedText}</>;
};

const CHAT_MODES: ChatMode[] = [
    {
        id: "listen",
        title: "Just Listen",
        description: "I'll hear you out and validate your feelings.",
    },
    {
        id: "reflect",
        title: "Reflect",
        description: "I'll help you see patterns and clarify thoughts.",
    },
    {
        id: "think",
        title: "Help Me Think",
        description: "We'll brainstorm or untangle a problem.",
    },
    {
        id: "direct",
        title: "Answer Directly",
        description: "No fluff, just straight answers.",
    },
];

const EXPRESSION_KEYWORDS: Record<string, string[]> = {
    SAFETY: [
        "concerned",
        "helpline",
        "reach out",
        "trusted person",
        "please",
        "danger",
        "safe",
        "crisis",
        "emergency",
    ],
    COMFORTING: [
        "comfort",
        "here for you",
        "not alone",
        "support",
        "hug",
        "care",
        "by your side",
        "always here",
    ],
    EMPATHETIC: [
        "understand",
        "hear you",
        "feel",
        "must be",
        "sounds",
        "that's hard",
        "that must",
        "empathize",
    ],
    REFLECTIVE: [
        "wonder",
        "reflect",
        "think about",
        "perhaps",
        "maybe",
        "could it be",
        "it seems",
        "ponder",
    ],
    WARM: [
        "glad",
        "happy",
        "wonderful",
        "lovely",
        "beautiful",
        "warmth",
        "smile",
        "joy",
        "positive",
    ],
    STRESSED: [
        "overwhelm",
        "stress",
        "anxious",
        "anxiety",
        "pressure",
        "too much",
        "exhaust",
        "burden",
    ],
    TIRED: [
        "tired",
        "exhausted",
        "drained",
        "fatigue",
        "worn out",
        "sleep",
        "rest",
        "heavy",
    ],
    STEADY: [
        "okay",
        "alright",
        "stable",
        "steady",
        "manage",
        "cope",
        "going through",
    ],
    TALKING: [
        "tell me",
        "share",
        "want to talk",
        "what happened",
        "go on",
        "listening",
        "what's going on",
    ],
    NEUTRAL: ["noted", "sure", "okay", "right", "yes", "no"],
};

const getBotExpression = (text: string): string => {
    const textLower = text.toLowerCase();
    for (const [expression, keywords] of Object.entries(EXPRESSION_KEYWORDS)) {
        if (keywords.some((kw) => textLower.includes(kw))) {
            return expression;
        }
    }
    return "DEFAULT";
};

const LOADING_MESSAGES = [
    "Listening...",
    "Thinking...",
    "Reflecting...",
    "Typing...",
];

const GUEST_TRIAL_LIMIT = 5;
const GUEST_TRIAL_COUNT_KEY = "heyattrangi_guest_trial_count";
const GUEST_TRIAL_EXHAUSTED_KEY = "heyattrangi_guest_trial_exhausted";

const ChatLoadingIndicator = () => {
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) =>
                prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev,
            );
        }, 600);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex flex-col gap-3 min-w-[150px]">
                <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 bg-orange-400/60 rounded-full animate-bounce"></div>
                    <div
                        className="w-2.5 h-2.5 bg-orange-400/80 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                        className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                    ></div>
                </div>
                <div className="text-[12px] font-medium text-[#004f69]/80 animate-pulse">
                    {LOADING_MESSAGES[msgIndex]}
                </div>
            </div>
        </div>
    );
};

const HOME_GREETINGS = [
    "Greetings of the Day 👋",
    "Good to See You! 👋",
    "How Can I Help You Today? 😊",
    "Welcome Back! 👋",
    "What's on Your Mind Today? 💬",
    "Let's Talk! 👋",
    "Ready When You Are! ✨"
];

export default function TryPragyaChat({
    sessionId,
    initialPlan = "FREE",
    initialChatCount = 0,
    userName = "",
    onBack,
    initialEntryMode = "text",
}: {
    sessionId: string;
    initialPlan?: string;
    initialChatCount?: number;
    userName?: string;
    onBack?: () => void;
    initialEntryMode?: "text" | "voice";
}) {
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isAuthenticated = status === "authenticated";
    const isGuestSession = !sessionId;

    const [guestTrialCount, setGuestTrialCount] = useState(0);
    const [guestTrialHydrated, setGuestTrialHydrated] = useState(false);
    const [guestTrialExhausted, setGuestTrialExhausted] = useState(false);
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [showPremiumVoiceModal, setShowPremiumVoiceModal] = useState(false);
    const [cumulativeVoiceUsed, setCumulativeVoiceUsed] = useState(0);

    const [activeSessionId, setActiveSessionId] = useState(() => {
        const uniqueId = Math.random().toString(36).substring(2, 10);
        return `${sessionId}_${uniqueId}`;
    });

    useEffect(() => {
        const uniqueId = Math.random().toString(36).substring(2, 10);
        setActiveSessionId(`${sessionId}_${uniqueId}`);
    }, [sessionId]);

    const companionAreaRef = useRef<HTMLDivElement>(null);
    const companionGreetingRef = useRef<HTMLDivElement>(null);
    const [companionScale, setCompanionScale] = useState(1);

    useEffect(() => {
        if (!companionAreaRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                const availableHeight = entry.contentRect.height;
                const greetingHeight = companionGreetingRef.current ? companionGreetingRef.current.getBoundingClientRect().height : 110;
                // Avatar wrapper requires 30px (mt-offset) + 300px (avatar) + 32px (mb-8) = 362px minimum space to not scale.
                const requiredHeight = greetingHeight + 362;
                if (availableHeight > 0 && availableHeight < requiredHeight) {
                    // Reserve the greeting and the 30px offset organically. Scale maps to the remainder.
                    const spaceForAvatar = Math.max(0, availableHeight - greetingHeight - 30);
                    // Use exact 300px height for calculation, extracting uniform margin correctly.
                    const scale = Math.min(1, Math.max(0.5, (spaceForAvatar - 32) / 300));
                    setCompanionScale(scale);
                } else {
                    setCompanionScale(1);
                }
            }
        });
        observer.observe(companionAreaRef.current);
        return () => observer.disconnect();
    }, []);

    const guestBootstrapAttemptedRef = useRef(false);

    useEffect(() => {
        if (!isGuestSession || guestBootstrapAttemptedRef.current) {
            return;
        }
        guestBootstrapAttemptedRef.current = true;

        fetch("/api/pragya/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        }).catch(() => {
            // Cookie bootstrap is best-effort; chat requests can still initialize it.
        });
    }, [isGuestSession]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (!isGuestSession) {
            setGuestTrialHydrated(true);
            setGuestTrialExhausted(false);
            return;
        }

        const storedCount = Number(localStorage.getItem(GUEST_TRIAL_COUNT_KEY) || "0");
        const normalizedCount = Number.isFinite(storedCount) ? Math.max(0, storedCount) : 0;
        const storedExhausted = localStorage.getItem(GUEST_TRIAL_EXHAUSTED_KEY) === "true";
        const exhausted = storedExhausted || normalizedCount >= GUEST_TRIAL_LIMIT;

        setGuestTrialCount(normalizedCount);
        setGuestTrialExhausted(exhausted);
        setGuestTrialHydrated(true);

        if (exhausted) {
            localStorage.setItem(GUEST_TRIAL_EXHAUSTED_KEY, "true");
        }
    }, [isGuestSession]);

    const [currentGreeting, setCurrentGreeting] = useState("Hi There! 👋");

    useEffect(() => {
        setCurrentGreeting(HOME_GREETINGS[Math.floor(Math.random() * HOME_GREETINGS.length)]);
    }, []);

    const [hasStarted, setHasStarted] = useState(false);
    const [conversationStarted, setConversationStarted] = useState(false);
    const [preferredName, setPreferredName] = useState("");
    const [selectedMode, setSelectedMode] = useState<string | null>("direct");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [botExpression, setBotExpression] = useState("NEUTRAL");
    const [limitInfo, setLimitInfo] = useState<LimitExceededInfo | null>(null);
    const [lastUserMessage, setLastUserMessage] = useState("");

    const [summarizing, setSummarizing] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [summaryReport, setSummaryReport] = useState<string | null>(null);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [summarizeHint, setSummarizeHint] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [pastMessages, setPastMessages] = useState<ChatMessage[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [plan, setPlan] = useState(initialPlan);
    const [chatCount, setChatCount] = useState(initialChatCount);
    const [showMemoryPolicy, setShowMemoryPolicy] = useState(false);
    const [voiceLimitReached, setVoiceLimitReached] = useState(false);

    // Inline media recording state extracted to useSpeechToText hooks

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isSendingRef = useRef(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (initialPlan) setPlan(initialPlan);
    }, [initialPlan]);

    useEffect(() => {
        if (initialChatCount !== undefined) setChatCount(initialChatCount);
    }, [initialChatCount]);


    const hasUserMessages = useMemo(
        () => messages.some((m) => m.role === "user"),
        [messages],
    );

    const limitData = useMemo(() => {
        if (isGuestSession) {
            const remaining = Math.max(0, GUEST_TRIAL_LIMIT - guestTrialCount);
            return {
                isLimitReached: guestTrialExhausted,
                maxChats: GUEST_TRIAL_LIMIT,
                remaining,
            };
        }
        const isFree = plan === "FREE";
        const isEssential = plan === "ESSENTIAL";
        const maxChats = isFree ? 30 : isEssential ? 25 : Infinity;
        const remaining = Math.max(0, maxChats - chatCount);
        const isLimitReached = maxChats !== Infinity && remaining <= 0;
        return { isLimitReached, maxChats, remaining };
    }, [plan, chatCount, isGuestSession, guestTrialCount, guestTrialExhausted]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input field when loading/typing resolves
    useEffect(() => {
        if (!isLoading && !isTyping) {
            inputRef.current?.focus();
        }
    }, [isLoading, isTyping]);

    const handleStartChat = () => {
        if (selectedMode) {
            setHasStarted(true);
            const modeDetails = CHAT_MODES.find((m) => m.id === selectedMode);
            const initialMsg = `Hi! I'm setting my mode to: ${modeDetails?.title}. How can I help you today?`;
            setIsTyping(true);
            setMessages([{ role: "assistant", content: initialMsg }]);
            setBotExpression("NEUTRAL");
        }
    };

    const handleShowSuggestions = async () => {
        setIsSuggestionsLoading(true);
        setShowSuggestions(true);
        setSuggestions([]);
        try {
            const res = await fetch("/api/pragya/suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: isGuestSession ? undefined : activeSessionId,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions || []);
            } else {
                const shuffled = [...SUGGESTION_POOL].sort(() => 0.5 - Math.random());
                setSuggestions(shuffled.slice(0, 3));
            }
        } catch {
            const shuffled = [...SUGGESTION_POOL].sort(() => 0.5 - Math.random());
            setSuggestions(shuffled.slice(0, 3));
        } finally {
            setIsSuggestionsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        if (isLoading || isSendingRef.current) return;
        setInputMessage("");
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
        }
        setLastUserMessage(suggestion);
        setMessages((prev) => [...prev, { role: "user", content: suggestion }]);
        sendMessage(undefined, suggestion);
    };

    const sendMessage = async (e?: FormEvent, retryMsg?: string) => {
        e?.preventDefault();
        if (
            (!inputMessage.trim() && !retryMsg) ||
            isLoading ||
            isSendingRef.current ||
            !guestTrialHydrated
        )
            return;

        if (!isGuestSession && limitData.isLimitReached) {
            setShowPremiumModal(true);
            return;
        }

        if (isGuestSession && limitData.isLimitReached) {
            const userMsg = retryMsg || inputMessage;
            if (!retryMsg) {
                setLastUserMessage(userMsg);
                setInputMessage("");
                if (inputRef.current) {
                    inputRef.current.style.height = "auto";
                }
                setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
            }

            setMessages((prev) => [...prev, { 
                role: "assistant", 
                content: "You've reached the free chat limit. Please join to continue chatting." 
            }]);
            return;
        }

        isSendingRef.current = true;

        if (!hasStarted) {
            setHasStarted(true);
        }

        const userMsg = retryMsg || inputMessage;

        // Force user message update unconditionally. If retryMsg is present, suggestion logic handles its own append.
        if (!retryMsg) {
            setLastUserMessage(userMsg);
            setInputMessage("");
            if (inputRef.current) {
                inputRef.current.style.height = "auto";
            }
            // Explicitly force userMsg into UI immediately regardless of logical scope issues.
            setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
            setCumulativeVoiceUsed(0);
        }


        setIsLoading(true);
        setSuggestions([]);
        setShowSuggestions(false);

        try {
            const isFirstMsg = !hasUserMessages;
            const res = await fetch("/api/pragya/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: isGuestSession ? undefined : activeSessionId,
                    message: userMsg,
                    generate_suggestions: false,
                    is_new_session: isFirstMsg,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                if (res.status === 429 || errorData.error === "LIMIT_EXCEEDED") {
                    if (!isGuestSession && plan === "FREE") {
                        setShowPremiumModal(true);
                        setIsLoading(false);
                        setIsTyping(false);
                        return;
                    }
                    
                    setLimitInfo({
                        feature: "AI Companion",
                        message: errorData.message || "You have reached your usage limit for the AI Companion.",
                        resetInSeconds: errorData.resetInSeconds,
                        upgradeable: true,
                    })
                    setIsLoading(false)
                    setIsTyping(false)
                    return
                }
                throw new Error(
                    errorData.error || "Failed to connect to the assistant.",
                );
            }

            const data = (await res.json()) as {
                reply?: string;
                currentCount?: number;
                plan?: string;
                error?: string;
                suggestions?: string[];
                action?: {
                    type: string;
                    title: string;
                    url: string;
                };
            };

            // DEBUG - REMOVE AFTER TESTING
            console.log("--- [DEBUG Frontend TryPragyaChat] RECEIVED CHAT RESPONSE ---");
            console.log("Response data:", data);
            console.log("Action field:", data.action);
            // END DEBUG

            if (
                data.error === "LIMIT_REACHED" ||
                (data.currentCount !== undefined && data.currentCount > chatCount)
            ) {
                if (typeof data.currentCount === "number")
                    setChatCount(data.currentCount);
                if (typeof data.plan === "string") setPlan(data.plan);
            }

            if (isGuestSession && !retryMsg) {
                const nextCount = guestTrialCount + 1;
                const exhausted = nextCount >= GUEST_TRIAL_LIMIT;
                setGuestTrialCount(nextCount);
                setGuestTrialExhausted(exhausted);
                localStorage.setItem(GUEST_TRIAL_COUNT_KEY, String(nextCount));
                if (exhausted) {
                    localStorage.setItem(GUEST_TRIAL_EXHAUSTED_KEY, "true");
                }
            }

            const reply =
                typeof data.reply === "string"
                    ? data.reply
                    : "Sorry, I didn't quite get that. Could you please rephrase?";

            setIsTyping(true);
            setMessages((prev) => [...prev, { role: "assistant", content: reply, action: data.action }]);
            setBotExpression(getBotExpression(reply));
            setConversationStarted(true);
            if (data.suggestions && Array.isArray(data.suggestions)) {
                setSuggestions(data.suggestions);
            }
        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMessage =
                error.message ||
                "Sorry, I'm having trouble connecting to the backend right now.";
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: errorMessage,
                    isError: true,
                },
            ]);
        } finally {
            isSendingRef.current = false;
            setIsLoading(false);
        }
    };

    const queryMessage = searchParams ? searchParams.get("q") : null;
    const initAttemptedRef = useRef(false);

    useEffect(() => {
        if (
            queryMessage &&
            queryMessage.trim() &&
            !initAttemptedRef.current &&
            guestTrialHydrated &&
            !limitData.isLimitReached
        ) {
            initAttemptedRef.current = true;
            setHasStarted(true);
            setLastUserMessage(queryMessage);
            setMessages([{ role: "user", content: queryMessage }]);
            sendMessage(undefined, queryMessage);
        }
    }, [queryMessage, guestTrialHydrated, limitData.isLimitReached]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputMessage(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const resetChat = () => {
        const uniqueId = Math.random().toString(36).substring(2, 10);
        setActiveSessionId(`${sessionId}_${uniqueId}`);
        setHasStarted(false);
        setConversationStarted(false);
        setSelectedMode("direct");
        setSuggestions([]);
        setShowSuggestions(false);
        setMessages([]);
        setBotExpression("NEUTRAL");
        setSummaryOpen(false);
        setSummaryReport(null);
        setSummaryError(null);
        setSummarizeHint(null);
        setCurrentGreeting(HOME_GREETINGS[Math.floor(Math.random() * HOME_GREETINGS.length)]);
    };

    const endAndSummarize = async () => {
        setSummarizeHint(null);
        if (!hasUserMessages) {
            setSummarizeHint(
                "Send at least one message so we can summarize your chat.",
            );
            return;
        }
        setSummarizing(true);
        setSummaryError(null);
        try {
            const res = await fetch("/api/pragya/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: isGuestSession ? undefined : activeSessionId,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as {
                report?: string;
                error?: string;
            };
            if (!res.ok) {
                setSummaryReport(null);
                setSummaryError(
                    typeof data.error === "string"
                        ? data.error
                        : "Could not load summary.",
                );
                setSummaryOpen(true);
                return;
            }
            const report =
                typeof data.report === "string" ? data.report : "No summary returned.";
            setSummaryReport(report);
            setSummaryOpen(true);
        } catch {
            setSummaryReport(null);
            setSummaryError("Network error. Try again in a moment.");
            setSummaryOpen(true);
        } finally {
            setSummarizing(false);
        }
    };

    const closeSummaryOnly = () => {
        setSummaryOpen(false);
    };

    const endSessionAfterSummary = () => {
        setSummaryOpen(false);
        setSummaryReport(null);
        setSummaryError(null);
        resetChat();
    };

    const handleTranscript = useCallback((text: string) => {
        setInputMessage((prev) => {
            const newText = prev.trim() ? `${prev} ${text}` : text;
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 50);
            return newText;
        });
    }, []);

    const limitMaxDurationSeconds = plan === "PREMIUM" ? 180 : (isGuestSession ? 60 : 120);
    const remainingVoiceSeconds = Math.max(0, limitMaxDurationSeconds - cumulativeVoiceUsed);

    const {
        isRecording,
        isTranscribing,
        recordingTime,
        startRecording,
        stopRecording,
        toggleRecording,
        formatTime,
    } = useSpeechToText(handleTranscript, (info) => {
        setVoiceLimitReached(true);
        if (!isGuestSession && plan === "FREE") {
            setShowPremiumVoiceModal(true);
        } else {
            setLimitInfo({ feature: "Voice Input", message: info.message, resetInSeconds: info.resetInSeconds, upgradeable: true })
        }
    }, remainingVoiceSeconds, (duration) => {
        setCumulativeVoiceUsed(prev => prev + duration);
    });

    const handleMicClick = () => {
        if (remainingVoiceSeconds <= 0) {
            setVoiceLimitReached(true);
            if (!isGuestSession && plan === "FREE") {
                setShowPremiumVoiceModal(true);
            } else {
                setLimitInfo({ feature: "Voice Input", message: `You have reached the voice limit of ${limitMaxDurationSeconds} seconds for this message.`, upgradeable: true });
            }
            return;
        }

        if (voiceLimitReached) {
            if (!isGuestSession && plan === "FREE") {
                setShowPremiumVoiceModal(true);
            } else {
                setLimitInfo({ feature: "Voice Input", message: "Daily voice message limit reached.", upgradeable: true });
            }
        } else {
            toggleRecording();
        }
    };

    const initialEntryModeAttemptedRef = useRef(false);

    useEffect(() => {
        if (!initialEntryModeAttemptedRef.current) {
            initialEntryModeAttemptedRef.current = true;
            if (initialEntryMode === "voice") {
                // Safely wait for full component readiness before engaging the browser media capture
                setTimeout(() => {
                    startRecording();
                }, 200);
            } else if (initialEntryMode === "text") {
                // Text mode, autofocus the chat box so typing can begin immediately
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                    }
                }, 100);
            }
        }
    }, [initialEntryMode]);

    // Removed redundant toggle/stop/format functions

    return (
        <>
            <motion.div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#8BC8DF]/90 to-[#C8E2EF]/90 text-gray-800 overflow-hidden font-sans">
                <div className="flex-1 min-h-0 flex flex-col w-full max-w-4xl mx-auto overflow-hidden relative z-10 px-4 md:px-8">
                    {/* Top Navigation */}
                    <motion.div 
                        className="w-full flex items-center justify-between py-6 shrink-0 z-20"
                    >
                        {/* Back Arrow and Avatar */}
                        <div className="flex items-center gap-2">
                            <a
                                href={isGuestSession ? "https://heyattrangi.com" : "/patient/dashboard"}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (onBack) {
                                        onBack();
                                        return;
                                    }
                                    if (isGuestSession) {
                                        if (window.history.length > 2) {
                                            router.back();
                                        } else {
                                            window.location.href = "https://heyattrangi.com";
                                        }
                                    } else {
                                        router.push("/patient/dashboard");
                                    }
                                }}
                                className="p-2 text-[#004f69] hover:text-[#00384d] hover:bg-white/20 transition-colors rounded-full ml-0 min-[360px]:-ml-3"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                </svg>
                            </a>
                            {hasStarted && (
                                <Image
                                    src={"/bot_expressions/Attrangi_s_HQ/NEUTRAL 1.png"}
                                    alt="Pragya Bot"
                                    width={36}
                                    height={36}
                                    className="object-contain"
                                    priority
                                />
                            )}
                        </div>
                        
                        {/* Right side: History */}
                        <div className="flex items-center gap-4">
                            {isGuestSession && (
                                <div className="flex items-center">
                                    <Link
                                        href="/auth"
                                        className="px-5 py-1.5 text-[13px] sm:text-[14px] font-extrabold text-white bg-[#f4a261] hover:bg-[#e39454] transition-colors rounded-full shadow-sm whitespace-nowrap"
                                    >
                                        Join
                                    </Link>
                                </div>
                            )}
                            <button
                                onClick={async () => {
                                    setHistoryOpen(true);
                                    setIsHistoryLoading(true);
                                    try {
                                        const res = await fetch("/api/pragya/history");
                                        const data = await res.json();
                                        if (res.ok && data.messages) {
                                            setPastMessages(data.messages);
                                        }
                                    } catch (e) {
                                        console.error("Error fetching history:", e);
                                    } finally {
                                        setIsHistoryLoading(false);
                                    }
                                }}
                                className="hidden p-2 text-gray-800 hover:text-black hover:bg-gray-100 transition-colors rounded-full items-center justify-center -mr-3"
                                title="Chat History"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3" />
                                </svg>
                            </button>
                        </div>
                    </motion.div>

                    {/* LIMIT REACHED MODAL OVERLAY (Removed, replaced by dynamic PremiumChatModal at button interaction) */}

                    {/* Chat Limit Badge Hidden as per UI requirement */}
                    {/* Unified Chat Layout with Smooth Transitions */}
                    <div className="w-full flex-1 min-h-0 flex flex-col bg-transparent overflow-hidden relative">
                        {/* Header / Mode Toggle Area */}
                        <div
                            ref={companionAreaRef}
                            className={`transition-all duration-700 ease-in-out w-full flex flex-col items-center shrink-0 min-h-0 relative z-10 pt-4 md:pt-8 ${!hasStarted ? "flex-1" : "pb-2"}`}
                        >
                            {/* Greeting & Title (Hides on start) */}
                            <div
                                ref={companionGreetingRef}
                                className={`flex flex-col items-center transition-all duration-700 ease-in-out overflow-hidden w-full max-w-[500px] ${!hasStarted
                                    ? "opacity-100 max-h-[200px] scale-100"
                                    : "opacity-0 max-h-0 scale-95 pointer-events-none"
                                    }`}
                            >
                                <motion.h2 
                                    className="text-[13px] uppercase tracking-[0.08em] font-bold text-[#004f69]/80 mb-2 font-sans mt-2"
                                >
                                    HELLO {userName ? userName.toUpperCase() : "THERE"}!
                                </motion.h2>
                                <motion.h1 layoutId="chat-greeting" transition={{ layout: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }} className="text-[28px] md:text-[34px] font-extrabold text-[#004f69] leading-tight text-center font-sans tracking-tight mb-8">
                                    {currentGreeting}
                                </motion.h1>
                            </div>

                            {/* Center Avatar with Surrounding Bubbles */}
                            <div
                                className={`flex flex-col flex-1 items-center justify-center transition-all duration-700 ease-in-out overflow-hidden w-full ${!hasStarted
                                    ? "opacity-100 max-h-[800px] mb-8 mt-[30px] scale-100"
                                    : "opacity-0 max-h-0 mb-0 mt-0 scale-95 pointer-events-none"
                                    }`}
                            >
                                <div 
                                    className="relative flex items-start justify-center transition-all duration-75 px-2 min-[360px]:px-0"
                                    style={{ height: `${300 * companionScale}px`, width: '100%', maxWidth: `${340 * companionScale}px` }}
                                >
                                    <div 
                                        className="absolute w-[340px] h-[300px] flex items-center justify-center"
                                        style={{ transform: `scale(${companionScale})`, transformOrigin: 'top center' }}
                                    >
                                        <motion.div layoutId="chat-avatar" transition={{ layout: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }} className="relative z-10 flex items-center justify-center shrink-0 transition-transform duration-700 ease-in-out pointer-events-none">
                                        <Image
                                            src={botExpression === "NEUTRAL" ? "/bot_expressions/Attrangi_s_HQ/NEUTRAL.png" : getBotAvatar(botExpression)}
                                            alt="Pragya Bot"
                                            width={140}
                                            height={140}
                                            className="object-contain w-[100px] min-[360px]:w-[120px] min-[390px]:w-[140px] h-auto"
                                            priority
                                        />
                                    </motion.div>

                                    {!hasStarted && (
                                        <>
                                            {/* Help Me Think - Top Left */}
                                            <button
                                                onClick={() => {
                                                    if (selectedMode !== "think") setSelectedMode("think");
                                                }}
                                                className={`absolute top-0 left-[-10px] max-[389px]:left-[6px] max-[359px]:left-[12px] rounded-full px-5 py-3 max-[389px]:px-4 max-[389px]:py-2.5 max-[359px]:px-3 max-[359px]:py-2 shadow-sm hover:shadow-md hover:scale-105 transition-all text-[13px] max-[389px]:text-[12px] max-[359px]:text-[11px] font-extrabold flex items-center justify-center z-20 ${selectedMode === "think" ? "bg-[#004f69] text-white" : "bg-white text-[#004f69]"}`}
                                            >
                                                <span>Help Me Think</span>
                                                {/* Tail pointing bottom-right */}
                                                <div className={`absolute right-5 max-[359px]:right-4 -bottom-1.5 w-3 h-3 rotate-45 rounded-[2px] ${selectedMode === "think" ? "bg-[#004f69]" : "bg-white"}`} style={{ boxShadow: selectedMode === "think" ? "none" : "1px 1px 1px rgba(0,0,0,0.02)" }}></div>
                                            </button>

                                            {/* Answer Directly - Top Right */}
                                            <button
                                                onClick={() => {
                                                    if (selectedMode !== "direct") setSelectedMode("direct");
                                                }}
                                                className={`absolute top-3 right-[-10px] max-[389px]:right-[6px] max-[359px]:right-[12px] rounded-full px-5 py-3 max-[389px]:px-4 max-[389px]:py-2.5 max-[359px]:px-3 max-[359px]:py-2 shadow-sm hover:shadow-md hover:scale-105 transition-all text-[13px] max-[389px]:text-[12px] max-[359px]:text-[11px] font-extrabold flex items-center justify-center z-20 ${selectedMode === "direct" ? "bg-[#004f69] text-white" : "bg-white text-[#004f69]"}`}
                                            >
                                                <span>Answer Directly</span>
                                                {/* Tail pointing bottom-left */}
                                                <div className={`absolute left-6 max-[359px]:left-4 -bottom-1.5 w-3 h-3 rotate-45 rounded-[2px] ${selectedMode === "direct" ? "bg-[#004f69]" : "bg-white"}`} style={{ boxShadow: selectedMode === "direct" ? "none" : "-1px 1px 1px rgba(0,0,0,0.02)" }}></div>
                                            </button>

                                            {/* Just Listen - Top Left (Lower) */}
                                            <button
                                                onClick={() => {
                                                    if (selectedMode !== "listen") setSelectedMode("listen");
                                                }}
                                                className={`absolute top-[75px] left-[-30px] max-[389px]:left-[2px] max-[359px]:left-[6px] rounded-full px-5 py-3 max-[389px]:px-4 max-[389px]:py-2.5 max-[359px]:px-3 max-[359px]:py-2 shadow-sm hover:shadow-md hover:scale-105 transition-all text-[13px] max-[389px]:text-[12px] max-[359px]:text-[11px] font-extrabold flex items-center justify-center z-20 ${selectedMode === "listen" ? "bg-[#004f69] text-white" : "bg-white text-[#004f69]"}`}
                                            >
                                                <span>Just Listen</span>
                                                {/* Tail pointing bottom-right */}
                                                <div className={`absolute right-5 max-[359px]:right-4 -bottom-1.5 w-3 h-3 rotate-45 rounded-[2px] ${selectedMode === "listen" ? "bg-[#004f69]" : "bg-white"}`} style={{ boxShadow: selectedMode === "listen" ? "none" : "1px 1px 1px rgba(0,0,0,0.02)" }}></div>
                                            </button>

                                            {/* Reflect - Top Right (Lower) */}
                                            <button
                                                onClick={() => {
                                                    if (selectedMode !== "reflect") setSelectedMode("reflect");
                                                }}
                                                className={`absolute top-[85px] right-[-30px] max-[389px]:right-[2px] max-[359px]:right-[6px] rounded-full px-5 py-3 max-[389px]:px-4 max-[389px]:py-2.5 max-[359px]:px-3 max-[359px]:py-2 shadow-sm hover:shadow-md hover:scale-105 transition-all text-[13px] max-[389px]:text-[12px] max-[359px]:text-[11px] font-extrabold flex items-center justify-center z-20 ${selectedMode === "reflect" ? "bg-[#004f69] text-white" : "bg-white text-[#004f69]"}`}
                                            >
                                                <span>Reflect</span>
                                                {/* Tail pointing bottom-left */}
                                                <div className={`absolute left-5 max-[359px]:left-4 -bottom-1.5 w-3 h-3 rotate-45 rounded-[2px] ${selectedMode === "reflect" ? "bg-[#004f69]" : "bg-white"}`} style={{ boxShadow: selectedMode === "reflect" ? "none" : "-1px 1px 1px rgba(0,0,0,0.02)" }}></div>
                                            </button>
                                        </>
                                    )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chat Messages */}
                            <div
                                className={`overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar bg-transparent min-h-0 transition-all duration-700 ease-in-out ${!hasStarted
                                    ? "flex-none opacity-0 h-0 p-0 md:p-0"
                                    : "flex-1 opacity-100"
                                    }`}
                            >
                                {messages.map((msg, idx) => {
                                    const isCrisis = msg.content && (
                                        msg.content.includes("988") ||
                                        msg.content.includes("International Helplines") ||
                                        msg.content.toLowerCase().includes("emergency services") ||
                                        msg.content.toLowerCase().includes("trusted person") ||
                                        msg.content.toLowerCase().includes("suicide hotline")
                                    );
                                    const cleanContent = isCrisis && typeof msg.content === "string"
                                        ? msg.content.split("**International Helplines:**")[0].trim()
                                        : msg.content;

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-300`}
                                        >
                                            <div
                                                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl text-[16px] leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                                                    ? "bg-white/30 backdrop-blur-md border border-white/40 text-[#004f69] rounded-tr-sm p-4 shadow-sm"
                                                    : msg.isError
                                                        ? "bg-red-50/50 backdrop-blur-md text-red-800 rounded-tl-sm border border-red-100 p-4 shadow-sm"
                                                        : "bg-transparent text-[#004f69] font-medium p-2"
                                                    }`}
                                            >
                                                {msg.role === "assistant" &&
                                                    !msg.isError &&
                                                    idx === messages.length - 1 ? (
                                                    <TypewriterText
                                                        text={cleanContent}
                                                        onCharacterTyped={() => {
                                                            messagesEndRef.current?.scrollIntoView({
                                                                behavior: "auto",
                                                            });
                                                        }}
                                                        onComplete={() => {
                                                            setIsTyping(false);
                                                            setTimeout(() => {
                                                                setShowSuggestions(true);
                                                            }, 3000);
                                                        }}
                                                    />
                                                ) : (
                                                    cleanContent
                                                )}
                                                {isCrisis && (!isTyping || idx < messages.length - 1) && (
                                                    <div className="mt-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                        {[
                                                            { name: "Tele MANAS Helpline", number: "14416", desc: "Available 24/7. National crisis response support.", label: "Phone" },
                                                            { name: "KIRAN Support", number: "1800-599-0019", desc: "Government mental health service.", label: "SOS" },
                                                            { name: "Vandrevala Foundation", number: "9999 666 555", desc: "Crisis and trauma counseling helpline.", label: "Support" }
                                                        ].map((line, hidx) => (
                                                            <div key={hidx} className="p-5 rounded-[20px] bg-white/30 backdrop-blur-md border border-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white/40 transition-all font-sans text-[#004f69]">
                                                                <div className="flex items-start gap-4">
                                                                    <div className="w-10 h-10 rounded-full bg-red-100/50 text-red-600 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-bold text-[15px]">{line.name}</h4>
                                                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-red-100 text-red-700">{line.label}</span>
                                                                        </div>
                                                                        <p className="text-[13px] text-[#004f69]/80 font-medium leading-relaxed">{line.desc}</p>
                                                                        <p className="text-lg font-black text-red-600 tracking-wide mt-1">{line.number}</p>
                                                                    </div>
                                                                </div>
                                                                <a href={`tel:${line.number.replace(/\s+/g, '')}`} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[13px] font-black tracking-widest uppercase transition-all shadow-md hover:shadow-red-500/20 whitespace-nowrap text-center self-stretch sm:self-center flex flex-1 sm:flex-none items-center justify-center">
                                                                    Call Now
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {(msg.action?.type === "ATTENTION_ASSESSMENT" || msg.action?.type === "ASSESSMENT" || (msg.action?.type === "ACTIVITY" && !isCrisis)) && (!isTyping || idx < messages.length - 1) && (
                                                    <div className="mt-4 p-5 rounded-[24px] rounded-tl-sm bg-white/30 backdrop-blur-md border border-white/40 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#004f69] font-sans shadow-sm">
                                                        <div className="flex items-start gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-white/50 text-[#FF6812] flex items-center justify-center shrink-0 mt-0.5">
                                                                <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-bold text-base text-[#004f69]">{msg.action.title}</h4>
                                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${(msg.action as any).severity === "severe" ? "bg-red-100 text-red-700" :
                                                                        (msg.action as any).severity === "moderate" ? "bg-orange-100 text-orange-700" :
                                                                            (msg.action as any).severity === "mild" ? "bg-yellow-100 text-yellow-700" :
                                                                                "bg-green-100 text-green-700"
                                                                        }`}>
                                                                        {(msg.action as any).severity || "info"}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[13px] text-[#004f69]/80 font-medium leading-relaxed">
                                                                    {(msg.action as any).rationale || (msg.action.type === "ACTIVITY" ? "We recommend trying this activity based on your thoughts." : "Based on your discussion, a structured evaluation is recommended.")}
                                                                </p>
                                                                <p className="text-[11px] text-[#004f69]/60 font-medium">
                                                                    Selection Confidence: {Math.round(((msg.action as any).confidence || 0.70) * 100)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Link
                                                            href={isGuestSession ? `/auth/signin?callbackUrl=${encodeURIComponent(msg.action.url)}` : msg.action.url}
                                                            className="px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[12px] font-black tracking-widest uppercase transition-all shadow-md hover:shadow-orange-500/20 whitespace-nowrap text-center self-stretch md:self-center flex items-center justify-center"
                                                        >
                                                            {msg.action.type === "ACTIVITY" ? "Start Activity" : "Start Recommended Task"}
                                                        </Link>
                                                    </div>
                                                )}
                                                {msg.isError && lastUserMessage && (
                                                    <button
                                                        onClick={() =>
                                                            sendMessage(undefined, lastUserMessage)
                                                        }
                                                        className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-red-600 hover:text-red-700 transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-red-100"
                                                    >
                                                        <svg
                                                            className="w-3.5 h-3.5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2.5}
                                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                            />
                                                        </svg>
                                                        Retry
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {isLoading && <ChatLoadingIndicator />}
                                <div ref={messagesEndRef} className="h-4" />
                            </div>

                            {/* Chat Input Field */}
                            <div className="p-4 md:p-6 pb-8 z-10 bg-transparent shrink-0">
                                <div className="max-w-4xl mx-auto relative">
                                    {showSuggestions &&
                                        (isSuggestionsLoading || suggestions.length > 0) &&
                                        !isTyping &&
                                        !isLoading &&
                                        hasStarted ? (
                                        <div className="absolute bottom-full mb-3 left-0 right-0 flex items-center justify-between gap-2 px-2 z-20">
                                            {isSuggestionsLoading ? (
                                                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-100 rounded-full text-[13px] text-orange-600 font-medium shadow-[0_2px_8px_rgba(249,107,19,0.1)]">
                                                    <div className="flex gap-1">
                                                        <span
                                                            className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                                                            style={{ animationDelay: "0ms" }}
                                                        ></span>
                                                        <span
                                                            className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                                                            style={{ animationDelay: "150ms" }}
                                                        ></span>
                                                        <span
                                                            className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                                                            style={{ animationDelay: "300ms" }}
                                                        ></span>
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
                                                    setSuggestions([]);
                                                    setShowSuggestions(false);
                                                }}
                                                className="p-1.5 bg-white border border-orange-200 text-orange-400 hover:text-orange-600 rounded-full shadow-[0_2px_8px_rgba(249,107,19,0.15)] hover:bg-orange-50 transition-all flex items-center justify-center shrink-0"
                                                title="Dismiss suggestions"
                                            >
                                                <svg
                                                    className="w-3.5 h-3.5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : null}

                                    <div
                                        className={`transition-all duration-700 ${!hasStarted ? "opacity-0 h-0 overflow-hidden mb-0" : "flex justify-between items-center mb-2 px-2 md:hidden opacity-100 h-auto"}`}
                                    >
                                        <span className="text-[12px] text-gray-400 font-bold hidden">
                                            {isGuestSession
                                                ? `${limitData.remaining} free trial chats remaining`
                                                : plan !== "PRO"
                                                    ? `${limitData.remaining} chats remaining today`
                                                    : ""}
                                        </span>
                                    </div>

                                    <form
                                        onSubmit={sendMessage}
                                        className="w-full flex items-end gap-2 min-[360px]:gap-3"
                                    >
                                        <div className={`flex-1 overflow-hidden bg-white/95 backdrop-blur-xl text-[#004f69] transition-colors duration-300 flex items-end gap-2 border border-white/80 shadow-lg rounded-3xl py-1 min-[360px]:py-1.5 pl-3.5 min-[360px]:pl-5 pr-1.5`}>
                                            {isRecording ? (
                                                <div className="flex-1 flex items-center justify-center gap-3 py-3 min-h-[38px] min-[360px]:min-h-[44px]">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                                                    <span className="text-red-500 font-bold text-sm tracking-wider">
                                                        Recording {formatTime(recordingTime)}
                                                    </span>
                                                </div>
                                            ) : isTranscribing ? (
                                                <div className="flex-1 flex items-center justify-center gap-3 py-3 min-h-[38px] min-[360px]:min-h-[44px]">
                                                    <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                                                    <span className="text-orange-500 font-bold text-[13px] tracking-widest uppercase">
                                                        Transcribing...
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex-1 relative">
                                                     <div 
                                                         className="invisible whitespace-pre-wrap break-words py-2.5 min-[360px]:py-3 leading-relaxed text-[13px] min-[360px]:text-[14px] min-[390px]:text-[15px] min-h-[38px] min-[360px]:min-h-[44px] max-h-[200px] pointer-events-none"
                                                         aria-hidden="true"
                                                     >
                                                         {inputMessage + " "}
                                                     </div>
                                                     <textarea
                                                         ref={inputRef}
                                                         value={inputMessage}
                                                         onChange={handleInputChange}
                                                         onKeyDown={handleKeyDown}
                                                         placeholder="Tell me what's on your mind..."
                                                         rows={1}
                                                         className="absolute inset-0 w-full h-full bg-transparent text-gray-800 placeholder-gray-400 py-2.5 min-[360px]:py-3 focus:outline-none resize-none leading-relaxed text-[13px] min-[360px]:text-[14px] min-[390px]:text-[15px] overflow-y-auto style-scrollbar placeholder:truncate"
                                                         disabled={isLoading || isRecording || isTranscribing}
                                                         autoFocus
                                                      />
                                                </div>
                                            )}

                                            {/* Microhpone button swapped into the inner input structure */}
                                            {!isRecording && (
                                                <button
                                                    type="button"
                                                    onClick={handleMicClick}
                                                    disabled={isLoading || isTranscribing}
                                                    className={`p-2 rounded-full h-[36px] w-[36px] max-[359px]:h-[32px] max-[359px]:w-[32px] shrink-0 mb-1 transition-all duration-300 flex items-center justify-center ${isLoading || isTranscribing
                                                        ? "text-gray-400 bg-[#f4f4f5]"
                                                        : "text-gray-700 bg-[#f4f4f5] hover:bg-[#e4e4e7]"
                                                        }`}
                                                    title="Start Voice Input"
                                                >
                                                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Outer button position: Send button (normal) or Stop button (recording) */}
                                        {isRecording ? (
                                            <button
                                                type="button"
                                                onClick={handleMicClick}
                                                disabled={isLoading || isTranscribing}
                                                className={`rounded-full w-[54px] h-[54px] max-[389px]:w-[48px] max-[389px]:h-[48px] max-[359px]:w-[42px] max-[359px]:h-[42px] shrink-0 mb-1 transition-all duration-300 flex items-center justify-center font-bold text-[14px] bg-[#f4a261] text-white hover:bg-[#e39454] shadow-[0_2px_8px_rgba(244,162,97,0.4)]`}
                                                title="Stop Recording"
                                            >
                                                <svg className="w-[20px] h-[20px]" fill="currentColor" viewBox="0 0 24 24">
                                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                                </svg>
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={isLoading || !inputMessage.trim() || isTranscribing}
                                                className={`rounded-full w-[54px] h-[54px] max-[389px]:w-[48px] max-[389px]:h-[48px] max-[359px]:w-[42px] max-[359px]:h-[42px] shrink-0 mb-1 transition-all duration-300 flex items-center justify-center font-bold text-[14px] ${
                                                    (isLoading || !inputMessage.trim() || isTranscribing) ? "bg-orange-300 text-white" :
                                                    "bg-[#f4a261] text-white hover:bg-[#e39454] shadow-[0_2px_8px_rgba(244,162,97,0.4)]"
                                                }`}
                                                title="Send Message"
                                            >
                                                <svg
                                                    className="w-[20px] h-[20px] transform translate-x-[-1px] translate-y-[1px]"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            </button>
                                        )}
                                    </form>
                                 </div>
                             </div>
                         </div>
                     </div>
                </motion.div>

                {/* Memory Policy Modal */}
            {showMemoryPolicy && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative scale-in-center">
                        <button
                            onClick={() => setShowMemoryPolicy(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <svg
                                className="w-6 h-6 text-orange-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                />
                            </svg>
                            How your chat is stored
                        </h3>
                        <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                    1
                                </div>
                                <div>
                                    <strong className="text-gray-800">
                                        Frontend (Browser Memory):
                                    </strong>{" "}
                                    The messages you see on the screen are stored purely in your
                                    browser while the page is open. If you refresh the page, the
                                    visible chat history clears.
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                    2
                                </div>
                                <div>
                                    <strong className="text-gray-800">Backend:</strong> Our server
                                    only stores a temporary ID to enforce daily chat limits. It
                                    does not save the actual messages.
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                    3
                                </div>
                                <div>
                                    <strong className="text-gray-800">AI Bot Backend:</strong> The
                                    chat is processed securely, and the server maintains
                                    short-term context only during your active session.
                                    <p className="mt-2 text-orange-700 font-medium">
                                        Once you are onboarded, we will take special care of the
                                        details you share. Everything is in good hands, and your
                                        information will be stored safely.
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
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
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
                                        <div
                                            key={idx}
                                            className={`p-4 rounded-xl shadow-sm border ${msg.role === "user" ? "bg-orange-50 border-orange-100" : "bg-white border-gray-200"}`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-wider ${msg.role === "user" ? "text-orange-600" : "text-gray-500"}`}
                                                >
                                                    {msg.role === "user" ? "You" : "Pragya"}
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
                                            <svg
                                                className="h-6 w-6"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                        </div>
                                        <h3 className="mb-1 text-[15px] font-bold text-gray-800">
                                            No Past Sessions
                                        </h3>
                                        <p className="text-[13px] text-gray-500">
                                            Your previous chat history will appear here once you've
                                            completed some sessions.
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
                            <h2
                                id="pragya-summary-title"
                                className="text-lg font-bold text-gray-800"
                            >
                                Session summary
                            </h2>
                            <p className="mt-1 text-[13px] text-gray-500">
                                For your reflection only — not a diagnosis or medical record.
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                            {summaryError ? (
                                <p className="text-[15px] leading-relaxed text-red-600">
                                    {summaryError}
                                </p>
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
            <PremiumChatModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
            <PremiumVoiceModal isOpen={showPremiumVoiceModal} onClose={() => setShowPremiumVoiceModal(false)} />
            <LimitExceededModal info={limitInfo} onClose={() => setLimitInfo(null)} />
        </>
    );
}
