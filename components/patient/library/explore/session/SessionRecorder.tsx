"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { ExploreActivity } from "@/data/exploreActivities"
import {
  createInitialSessionState,
  type SessionPhase,
  type SessionState,
} from "@/components/patient/library/explore/session/SessionState"
import { useSessionTimer } from "@/components/patient/library/explore/session/useSessionTimer"
import RecorderHeader from "@/components/patient/library/explore/session/RecorderHeader"
import RecorderBody from "@/components/patient/library/explore/session/RecorderBody"
import RecorderControls from "@/components/patient/library/explore/session/RecorderControls"
import ActivityRenderer from "@/components/patient/library/explore/engines/ActivityRenderer"
import GroundingExercise from "@/features/activities/components/GroundingExercise"
import MicroMovement from "@/features/activities/components/MicroMovement"
import ProgressiveMuscleRelaxation from "@/features/activities/components/ProgressiveMuscleRelaxation"
import JournalReflection from "@/features/activities/components/JournalReflection"
import BellyBreathing from "@/features/activities/components/BellyBreathing"
import FourSevenEightBreathing from "@/features/activities/components/FourSevenEightBreathing"

export type { SessionState, SessionPhase }

interface SessionRecorderProps {
  activity: ExploreActivity
  onExit: () => void
  onFinish: (state: SessionState) => void
  /** Optional override for activity-specific content */
  children?: ReactNode
}

export default function SessionRecorder({
  activity,
  onExit,
  onFinish,
  children,
}: SessionRecorderProps) {
  const [phase, setPhase] = useState<SessionPhase>("running")
  const isRunning = phase === "running"
  const isPaused = phase === "paused"
  const { elapsedMs, reset } = useSessionTimer(isRunning)

  const isEmbedded = typeof window !== 'undefined' && window.location.search.includes('embedded=true')

  const buildState = useCallback(
    (nextPhase: SessionPhase): SessionState => ({
      ...createInitialSessionState(activity),
      phase: nextPhase,
      elapsedMs,
    }),
    [activity, elapsedMs]
  )

  const handleExit = useCallback(() => {
    reset()
    setPhase("idle")
    onExit()
  }, [onExit, reset])

  const handleTogglePause = useCallback(() => {
    setPhase((prev) => {
      if (prev === "running") return "paused"
      if (prev === "paused") return "running"
      return prev
    })
  }, [])

  const handleFinish = useCallback(() => {
    setPhase("finished")
    onFinish(buildState("finished"))
  }, [buildState, onFinish])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        handleExit()
        return
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault()
        handleTogglePause()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleExit, handleTogglePause])

  if (activity.slug === "5-4-3-2-1-grounding" || activity.slug === "grounding-54321") {
    return (
      <div className="relative min-h-[100dvh] w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        {/* Top Header Row with Close button */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
          {!isEmbedded && (
          <button
            onClick={handleExit}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 shadow-sm transition-all"
            aria-label="Exit session"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          )}
        </div>

        <GroundingExercise onExit={handleExit} onDone={handleFinish} />
      </div>
    )
  }

  if (activity.slug === "micro-movement") {
    return (
      <MicroMovement onBack={handleExit} onDone={handleFinish} />
    )
  }

  if (activity.slug === "progressive-muscle-relaxation" || activity.slug === "pmr") {
    return (
      <ProgressiveMuscleRelaxation onBack={handleExit} onDone={handleFinish} />
    )
  }

  if (activity.slug === "journal-reflection") {
    return (
      <JournalReflection onBack={handleExit} onDone={handleFinish} />
    )
  }

  if (activity.slug === "belly-breathing") {
    return (
      <BellyBreathing onBack={handleExit} onDone={handleFinish} />
    )
  }

  if (activity.slug === "breathing-4-7-8") {
    return (
      <FourSevenEightBreathing onBack={handleExit} onDone={handleFinish} />
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="session-recorder"
        role="region"
        aria-label={`${activity.title} session`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 h-full min-h-0 w-full bg-[#FFF9F8] text-slate-800 flex flex-col font-sans"
      >
        <RecorderHeader
          title={activity.title}
          elapsedMs={elapsedMs}
          isPaused={isPaused}
          onExit={handleExit}
        />

        <RecorderBody isPaused={isPaused}>
          {children ?? (
            <ActivityRenderer activity={activity} isPaused={isPaused} />
          )}
        </RecorderBody>

        <RecorderControls
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onFinish={handleFinish}
        />
      </motion.div>
    </AnimatePresence>
  )
}
