"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import type { ExploreActivity } from "@/data/exploreActivities"
import ActivityHero from "@/components/patient/library/explore/detail/ActivityHero"
import ActivityDescription from "@/components/patient/library/explore/detail/ActivityDescription"
import ActivityInfoCard from "@/components/patient/library/explore/detail/ActivityInfoCard"
import BeginButton from "@/components/patient/library/explore/detail/BeginButton"
import ExploreErrorBoundary from "@/components/patient/library/explore/ExploreErrorBoundary"
import { ActivityDetailSkeleton } from "@/components/patient/library/explore/ExploreSkeletons"
import type { SessionState } from "@/components/patient/library/explore/session/SessionState"
import {
  buildActivityDetailHref,
  buildExploreHref,
} from "@/lib/explore/urlState"

const SessionRecorder = dynamic(
  () => import("@/components/patient/library/explore/session/SessionRecorder"),
  { loading: () => <ActivityDetailSkeleton />, ssr: false }
)

const CompletionPage = dynamic(
  () => import("@/components/patient/library/explore/completion/CompletionPage"),
  { loading: () => <ActivityDetailSkeleton />, ssr: false }
)

type DetailView = "detail" | "session" | "complete"

interface ActivityDetailPageProps {
  activity: ExploreActivity
}

/**
 * Activity detail → session recorder → completion. View state is local (session UX).
 */
export default function ActivityDetailPage({
  activity,
}: ActivityDetailPageProps) {
  const router = useRouter()
  const [view, setView] = useState<DetailView>("detail")
  const [completedSession, setCompletedSession] = useState<SessionState | null>(
    null
  )
  const [isEmbedded, setIsEmbedded] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('embedded=true')) {
      setIsEmbedded(true)
    }
  }, [])

  useEffect(() => {
    setView("detail")
    setCompletedSession(null)
  }, [activity.id])

  const goBack = () => {
    if (typeof window !== 'undefined' && window.location.search.includes('embedded=true')) {
       window.parent.postMessage({ type: 'TASK_CANCELLED' }, '*');
    } else {
       router.push(buildExploreHref({ mode: "activities" }))
    }
  }

  const openActivity = (next: ExploreActivity) => {
    setView("detail")
    setCompletedSession(null)
    router.push(buildActivityDetailHref(next.slug))
  }

  const beginSession = () => {
    setCompletedSession(null)
    setView("session")
  }

  const exitSession = () => {
    if (isEmbedded) {
        window.parent.postMessage({ type: 'TASK_CANCELLED' }, '*');
    } else {
        setCompletedSession(null)
        setView("detail")
    }
  }

  const searchParams = useSearchParams()

  const finishSession = (state: SessionState) => {
    setCompletedSession(state)
    if (!isEmbedded) {
        setView("complete")
    }

    const mode = searchParams.get("mode")
    let dbSlug = activity.slug

    if (activity.slug === "breathing") {
      if (mode === "478") {
        dbSlug = "breathing-4-7-8"
      } else if (mode === "belly") {
        dbSlug = "belly-breathing"
      } else if (mode === "sigh") {
        dbSlug = "physiological-sigh"
      } else {
        dbSlug = "box-breathing"
      }
    } else if (activity.slug === "5-4-3-2-1-grounding") {
      dbSlug = "grounding-54321"
    } else if (activity.slug === "progressive-muscle-relaxation") {
      dbSlug = "pmr"
    } else if (activity.slug === "journal-reflection") {
      dbSlug = "open-reflection"
    }

    // Log activity completion to DB
    fetch("/api/wellness-activities/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wellnessActivitySlug: dbSlug,
        durationMs: state.elapsedMs,
      }),
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => {
            console.error("Failed to log wellness activity:", err);
          });
        }
      })
      .catch(err => console.error("Network error logging wellness activity:", err))
      .finally(() => {
          if (isEmbedded) {
              window.parent.postMessage({ type: 'TASK_COMPLETED', actionType: 'ACTIVITY', result: state }, '*');
          }
      });
  }

  const goToExplore = () => {
    if (typeof window !== 'undefined' && window.location.search.includes('embedded=true')) {
        window.parent.postMessage({ type: 'TASK_COMPLETED', actionType: 'ACTIVITY', result: completedSession }, '*');
    } else {
        setCompletedSession(null)
        router.push(buildExploreHref({ mode: "activities" }))
    }
  }

  return (
    <ExploreErrorBoundary onReset={goBack}>
      <AnimatePresence mode="wait">
        {view === "session" ? (
          <SessionRecorder
            key={`session-${activity.id}`}
            activity={activity}
            onExit={exitSession}
            onFinish={finishSession}
          />
        ) : view === "complete" && completedSession ? (
          <CompletionPage
            key={`complete-${activity.id}`}
            activity={activity}
            elapsedMs={completedSession.elapsedMs}
            onDone={goToExplore}
            onTryAnother={goToExplore}
          />
        ) : (
          <motion.div
            key={`detail-${activity.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 h-full min-h-0 w-full bg-[#FFF9F8] text-slate-800 flex flex-col font-sans"
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-6 md:p-8 w-full max-w-2xl mx-auto pb-10 md:pb-16">
                {!isEmbedded && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Back to Explore"
                  className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 rounded-md"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                  Back
                </button>
                )}

                <div className="space-y-8 md:space-y-10">
                  <ActivityHero activity={activity} />
                  <ActivityDescription text={activity.longDescription} />
                  <ActivityInfoCard activity={activity} />

                  <BeginButton
                    activityTitle={activity.title}
                    onBegin={beginSession}
                  />

                </div>
              </div>
            </div>

            {/* Mobile sticky begin button commented out to prevent duplicate button on mobile view
            <div className="md:hidden shrink-0 z-20 w-full bg-[#FFF9F8]/95 backdrop-blur-md border-t border-slate-100/80 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <BeginButton
                activityTitle={activity.title}
                onBegin={beginSession}
              />
            </div>
            */}
          </motion.div>
        )}
      </AnimatePresence>
    </ExploreErrorBoundary>
  )
}
