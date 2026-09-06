"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import type {
  Activity,
  RegionSpec,
  ScanAnchor,
  ScanDurationId,
  ScanEyes,
  ScanFeeling,
  ScanRegionId,
} from "../types"
import {
  ANCHOR_PROMPTS,
  SCAN_DURATION_OPTIONS,
  SCAN_REGION_SPECS,
  SKIPPABLE_SCAN_REGIONS,
  buildBodyScanTimeline,
  isRegionSpec,
} from "../data/bodyScan"
import { useSessionStore } from "../store/useSessionStore"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import { usePacedTimeline } from "../hooks/usePacedTimeline"
import { useScanAudio } from "../hooks/useScanAudio"
import { useNarration } from "../hooks/useNarration"
import { useWakeLock } from "../hooks/useWakeLock"
import { hapticTick } from "../lib/haptics"
import { BodyFigure, SCAN_REGION_Y } from "./BodyFigure"
import {
  SessionFrame,
  SessionHydrationGate,
  useSessionLifecycle,
  useStoreHydration,
} from "./session/SessionFrame"

const SLUG = "body-scan"
const WANDER_REGIONS = new Set([4, 8]) // 0-based indices 5th and 9th → regions 5 & 9

interface BodyScanSessionProps {
  activity: Activity
  backHref?: string
}

function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator
}

export function BodyScanSession({
  activity,
  backHref = "/patient/library",
}: BodyScanSessionProps) {
  const hydrated = useStoreHydration()
  const prefs = useSessionStore((s) => s.prefs)
  const setPref = useSessionStore((s) => s.setPref)
  const addSession = useSessionStore((s) => s.addSession)
  const reducedMotion = usePrefersReducedMotion()

  const [eyes, setEyes] = useState<ScanEyes>(prefs.scanEyes ?? "closed")
  const [anchor, setAnchor] = useState<ScanAnchor>(prefs.scanAnchor ?? "hands")
  const [skipRegions, setSkipRegions] = useState<string[]>(
    () => [...(prefs.scanSkipRegions ?? [])]
  )
  const [durationId, setDurationId] = useState<ScanDurationId>("5min")
  const [ambience, setAmbience] = useState(prefs.scanAmbience ?? false)
  const [phase, setPhase] = useState<"pre" | "session" | "complete">("pre")
  const [eyesMode, setEyesMode] = useState<ScanEyes>("closed")
  const [screenDimmed, setScreenDimmed] = useState(false)
  const [audioFallbackNote, setAudioFallbackNote] = useState<string | null>(
    null
  )
  const [wakeLockNote, setWakeLockNote] = useState(false)
  const [anchorHold, setAnchorHold] = useState(false)
  const [wanderVisible, setWanderVisible] = useState(false)
  const [liveAnnounce, setLiveAnnounce] = useState("")
  const [feeling, setFeeling] = useState<ScanFeeling | null>(null)
  const [endedEarly, setEndedEarly] = useState(false)

  const isEmbedded = typeof window !== 'undefined' && window.location.search.includes('embedded=true')

  const startedAtIsoRef = useRef("")
  const savedRef = useRef(false)
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wanderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wanderShownRef = useRef<Set<number>>(new Set())
  const keyboardFocusRef = useRef(false)

  const totalSeconds =
    SCAN_DURATION_OPTIONS.find((d) => d.id === durationId)?.totalSeconds ??
    300

  const timeline = useMemo(
    () => buildBodyScanTimeline(totalSeconds, skipRegions),
    [totalSeconds, skipRegions]
  )

  const activeCount = timeline.segments.length
  const beginBlocked = activeCount === 0

  const soundOn = true
  const audio = useScanAudio(
    phase === "session" && soundOn,
    phase === "session" && ambience
  )
  const narration = useNarration(phase === "session")

  const persistSession = useCallback(
    (opts: {
      durationMs: number
      completed: boolean
      endedEarly?: boolean
      scanFeeling?: ScanFeeling
    }) => {
      if (savedRef.current) return
      savedRef.current = true
      addSession({
        activitySlug: SLUG,
        startedAt: startedAtIsoRef.current || new Date().toISOString(),
        durationMs: opts.durationMs,
        cyclesCompleted: opts.completed && !opts.endedEarly ? 1 : 0,
        cyclesPlanned: 1,
        completed: opts.completed,
        endedEarly: opts.endedEarly,
        kind: "paced",
        scanFeeling: opts.scanFeeling,
        mood:
          opts.scanFeeling === "calm"
            ? 2
            : opts.scanFeeling === "restless"
              ? 3
              : opts.scanFeeling === "hard-to-tell"
                ? 2
                : undefined,
      })
    },
    [addSession]
  )

  const totalSecondsRef = useRef(totalSeconds)
  const timelineRef = useRef(timeline)
  const audioRef = useRef(audio)
  const narrationRef = useRef(narration)
  const persistRef = useRef(persistSession)
  const hapticsRef = useRef(prefs.haptics)

  useEffect(() => {
    totalSecondsRef.current = totalSeconds
    timelineRef.current = timeline
    audioRef.current = audio
    narrationRef.current = narration
    persistRef.current = persistSession
    hapticsRef.current = prefs.haptics
  }, [
    totalSeconds,
    timeline,
    audio,
    narration,
    persistSession,
    prefs.haptics,
  ])

  const engine = usePacedTimeline({
    timeline,
    renderPolicy: "phase",
    visibilityMode: "pause",
    onSegmentChange: (id, _cycle, detail) => {
      const tl = timelineRef.current
      const idx = detail?.index ?? 0
      const seg = tl.segments[idx]
      const region: RegionSpec | null = isRegionSpec(seg?.meta)
        ? seg.meta
        : SCAN_REGION_SPECS.find((r) => r.id === id) ?? null
      const prompt = region?.prompt ?? seg?.hint ?? seg?.label ?? ""
      setLiveAnnounce(prompt)
      audioRef.current.cueRegion()
      hapticTick(hapticsRef.current, 10)
      void narrationRef.current.play(region?.narrationUrl)
      if (region?.narrationUrl) {
        const next = tl.segments[idx + 1]
        if (isRegionSpec(next?.meta)) {
          narrationRef.current.preload(next.meta.narrationUrl)
        }
      }

      if (WANDER_REGIONS.has(idx) && !wanderShownRef.current.has(idx)) {
        wanderShownRef.current.add(idx)
        setWanderVisible(true)
        if (wanderTimerRef.current) clearTimeout(wanderTimerRef.current)
        wanderTimerRef.current = setTimeout(() => setWanderVisible(false), 6000)
      }
    },
    onComplete: () => {
      void audioRef.current.cueSessionEnd()
      setPhase("complete")
      setScreenDimmed(false)
      setEndedEarly(false)
      persistRef.current({
        durationMs: totalSecondsRef.current * 1000,
        completed: true,
        endedEarly: false,
      })
    },
  })

  useSessionLifecycle({
    active: phase === "session",
    wakeLock: phase === "session" && engine.status === "running",
  })
  useWakeLock(phase === "session" && engine.status === "running")

  // Background resume prompt — derived, dismissible
  const [bgPromptDismissed, setBgPromptDismissed] = useState(false)
  const bgResumePrompt =
    phase === "session" &&
    engine.awaitingResume &&
    engine.status === "paused" &&
    !anchorHold &&
    !bgPromptDismissed
      ? `You were at your ${(engine.segment?.label ?? engine.phaseSpec.label).toLowerCase()}.`
      : null

  const scheduleDim = useCallback(() => {
    if (dimTimerRef.current) clearTimeout(dimTimerRef.current)
    if (eyesMode !== "closed" || reducedMotion || keyboardFocusRef.current) {
      return
    }
    dimTimerRef.current = setTimeout(() => setScreenDimmed(true), 5000)
  }, [eyesMode, reducedMotion])

  const bumpBrightness = useCallback(() => {
    if (eyesMode !== "closed") return
    setScreenDimmed(false)
    scheduleDim()
  }, [eyesMode, scheduleDim])

  useEffect(() => {
    if (phase !== "session" || eyesMode !== "closed" || reducedMotion) {
      return
    }
    // Initial fade after 3s
    const t = setTimeout(() => {
      if (!keyboardFocusRef.current) setScreenDimmed(true)
    }, 3000)
    return () => clearTimeout(t)
  }, [phase, eyesMode, reducedMotion])

  useEffect(() => {
    if (phase !== "session" || eyesMode !== "closed") return
    const onPtr = () => bumpBrightness()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") keyboardFocusRef.current = true
      bumpBrightness()
    }
    window.addEventListener("pointermove", onPtr)
    window.addEventListener("pointerdown", onPtr)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointermove", onPtr)
      window.removeEventListener("pointerdown", onPtr)
      window.removeEventListener("keydown", onKey)
    }
  }, [phase, eyesMode, bumpBrightness])

  const travelYs = useMemo(() => {
    return timeline.segments.map((s) => {
      const id = s.id as ScanRegionId
      return SCAN_REGION_Y[id] ?? 200
    })
  }, [timeline.segments])

  const onBegin = async () => {
    if (beginBlocked) return
    setPref("scanEyes", eyes)
    setPref("scanAnchor", anchor)
    setPref("scanSkipRegions", skipRegions)
    setPref("scanAmbience", ambience)
    setAudioFallbackNote(null)
    savedRef.current = false
    startedAtIsoRef.current = new Date().toISOString()
    wanderShownRef.current = new Set()
    setFeeling(null)
    setEndedEarly(false)
    setBgPromptDismissed(false)

    if (!wakeLockSupported()) setWakeLockNote(true)

    let mode: ScanEyes = eyes
    if (eyes === "closed") {
      const unlocked = await audio.unlock()
      if (!unlocked) {
        mode = "open"
        setAudioFallbackNote(
          "Sound couldn’t start, so we’re keeping the screen visible."
        )
      }
    } else {
      await audio.unlock()
    }
    setEyesMode(mode)
    setPhase("session")
    engine.start()
  }

  const stopEarly = () => {
    const { elapsedMs } = engine.end()
    setEndedEarly(true)
    setPhase("complete")
    setScreenDimmed(false)
    void audio.cueSessionEnd()
    persistSession({
      durationMs: elapsedMs,
      completed: true,
      endedEarly: true,
    })
  }

  const goToAnchor = () => {
    engine.pause()
    setAnchorHold(true)
    audio.cueAnchor()
    setLiveAnnounce(ANCHOR_PROMPTS[anchor])
  }

  const carryOn = () => {
    setAnchorHold(false)
    engine.resume()
  }

  const toggleSkip = (id: string) => {
    setSkipRegions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (phase === "complete") {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          {endedEarly
            ? "Stopping when you need to is part of the practice, not a failure of it."
            : "How was that?"}
        </h1>

        {!endedEarly ? (
          <div
            className="mt-8 flex w-full max-w-sm flex-col gap-3"
            role="group"
            aria-label="How was that"
          >
            {(
              [
                ["calm", "Calm"],
                ["restless", "Restless"],
                ["hard-to-tell", "Hard to tell"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  feeling === id
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-hairline bg-surface text-ink"
                }`}
                onClick={() => {
                  setFeeling(id)
                  useSessionStore.setState((s) => {
                    const hist = [...s.history]
                    const idx = hist.findIndex((h) => h.activitySlug === SLUG)
                    if (idx < 0) return s
                    hist[idx] = {
                      ...hist[idx],
                      scanFeeling: id,
                      mood:
                        id === "calm" ? 2 : id === "restless" ? 3 : 2,
                    }
                    return { history: hist }
                  })
                }}
                data-testid={`feeling-${id}`}
              >
                {label}
              </button>
            ))}
            {feeling === "restless" ? (
              <p
                className="mt-2 text-[15px] leading-relaxed text-ink-muted"
                data-testid="restless-copy"
              >
                Restless is really common, especially early on.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-8 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Done
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline bg-surface text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              setPhase("pre")
              setFeeling(null)
              setEndedEarly(false)
              savedRef.current = false
            }}
          >
            Go again
          </button>
        </div>
      </div>
    )
  }

  if (phase === "pre") {
    return (
      <SessionHydrationGate hydrated={hydrated}>
        <div className="mx-auto min-h-[100dvh] max-w-lg bg-canvas px-5 pb-10 pt-10">
          {!isEmbedded && (
          <Link
            href={backHref}
            className="mb-6 inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Explore
          </Link>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            {activity.title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            {activity.longDescription}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            Your mind will wander off. That&apos;s not a problem — noticing
            you&apos;ve wandered and coming back is the actual exercise.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-subtle">
            Guided audio is coming. For now, follow the words on screen.
          </p>
          {wakeLockNote || !wakeLockSupported() ? (
            <p className="mt-3 text-sm text-ink-subtle">
              Your screen may dim — the audio will keep going.
            </p>
          ) : null}

          {/* Eyes */}
          <fieldset className="mt-8">
            <legend className="text-sm font-medium text-ink">
              How would you like to look?
            </legend>
            <p id="eyes-help" className="mt-1 text-sm text-ink-subtle">
              Closing your eyes isn&apos;t comfortable for everyone — either is
              fine.
            </p>
            <div
              role="radiogroup"
              aria-describedby="eyes-help"
              className="mt-3 flex flex-col gap-2"
            >
              {(
                [
                  ["closed", "Eyes closed"],
                  ["open", "Eyes open, softly focused"],
                ] as const
              ).map(([id, label]) => (
                <label
                  key={id}
                  className="flex min-h-11 cursor-pointer items-center gap-3"
                >
                  <input
                    type="radio"
                    name="scan-eyes"
                    className="h-5 w-5 accent-[var(--color-accent)]"
                    checked={eyes === id}
                    onChange={() => setEyes(id)}
                  />
                  <span className="text-[15px] text-ink">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Anchor */}
          <fieldset className="mt-8">
            <legend className="text-sm font-medium text-ink">
              Pick an anchor
            </legend>
            <p id="anchor-help" className="mt-1 text-sm text-ink-subtle">
              Somewhere that feels neutral or okay — your hands or your feet
              are common choices. If anything gets uncomfortable, you can bring
              your attention back there.
            </p>
            <div
              role="radiogroup"
              aria-describedby="anchor-help"
              className="mt-3 flex flex-col gap-2"
            >
              {(
                [
                  ["hands", "Hands"],
                  ["feet", "Feet"],
                  ["breath", "Breath"],
                  ["sound", "The sound of the room"],
                ] as const
              ).map(([id, label]) => (
                <label
                  key={id}
                  className="flex min-h-11 cursor-pointer items-center gap-3"
                >
                  <input
                    type="radio"
                    name="scan-anchor"
                    className="h-5 w-5 accent-[var(--color-accent)]"
                    checked={anchor === id}
                    onChange={() => setAnchor(id)}
                  />
                  <span className="text-[15px] text-ink">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Skip regions */}
          <fieldset className="mt-8">
            <legend className="text-sm font-medium text-ink">
              Leave anything out?
            </legend>
            <p id="skip-help" className="mt-1 text-sm text-ink-subtle">
              You can leave out any part of the body you&apos;d rather not
              focus on.
            </p>
            <div
              role="group"
              aria-describedby="skip-help"
              className="mt-3 flex flex-wrap gap-2"
            >
              {SKIPPABLE_SCAN_REGIONS.map((id) => {
                const spec = SCAN_REGION_SPECS.find((r) => r.id === id)!
                const checked = skipRegions.includes(id)
                return (
                  <label
                    key={id}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm focus-within:ring-2 focus-within:ring-accent ${
                      checked
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-hairline bg-surface text-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleSkip(id)}
                    />
                    {spec.label}
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Duration */}
          <fieldset className="mt-8">
            <legend className="text-sm font-medium text-ink">Duration</legend>
            <div role="radiogroup" className="mt-3 flex flex-col gap-2">
              {SCAN_DURATION_OPTIONS.map((d) => (
                <label
                  key={d.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3"
                >
                  <input
                    type="radio"
                    name="scan-duration"
                    className="h-5 w-5 accent-[var(--color-accent)]"
                    checked={durationId === d.id}
                    onChange={() => setDurationId(d.id)}
                  />
                  <span className="text-[15px] text-ink">{d.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Ambience */}
          <label className="mt-8 flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[var(--color-accent)]"
              checked={ambience}
              onChange={(e) => setAmbience(e.target.checked)}
              aria-describedby="ambience-help"
            />
            <span>
              <span className="block text-[15px] font-medium text-ink">
                Soft background sound
              </span>
              <span
                id="ambience-help"
                className="mt-0.5 block text-sm text-ink-subtle"
              >
                Optional. Some people find silence with eyes closed activating.
              </span>
            </span>
          </label>

          {beginBlocked ? (
            <p
              className="mt-6 text-[15px] text-ink-muted"
              data-testid="begin-blocked"
            >
              Pick at least one part of the body to start with.
            </p>
          ) : null}

          <button
            type="button"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-8 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={beginBlocked}
            onClick={() => void onBegin()}
          >
            Begin
          </button>
        </div>
      </SessionHydrationGate>
    )
  }

  // Session
  const currentPrompt = anchorHold
    ? ANCHOR_PROMPTS[anchor]
    : engine.segment?.hint ??
      engine.phaseSpec.label

  const regionId = (engine.segment?.id ?? engine.phase) as ScanRegionId

  return (
    <SessionHydrationGate hydrated={hydrated}>
      <style>{`
        @keyframes scan-drift {
          0%, 100% { transform: translate(-50%, -8%) scale(1); }
          50% { transform: translate(-46%, -4%) scale(1.03); }
        }
      `}</style>
      {audioFallbackNote ? (
        <p className="bg-accent-soft px-5 py-2 text-center text-sm text-ink" role="status">
          {audioFallbackNote}
        </p>
      ) : null}

      <SessionFrame liveAnnounce={liveAnnounce} ariaLive="polite">
        <div className="relative flex min-h-[100dvh] flex-col px-5 pb-10 pt-6">
          {!reducedMotion ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div
                className="absolute left-1/2 top-0 h-[70vmax] w-[70vmax] -translate-x-1/2"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 5%, transparent), transparent 70%)",
                  animation: "scan-drift 32s ease-in-out infinite",
                }}
              />
            </div>
          ) : null}

          {eyesMode === "closed" &&
          screenDimmed &&
          !reducedMotion &&
          phase === "session" ? (
            <div
              aria-hidden
              data-testid="scan-eyes-overlay"
              className="pointer-events-none absolute inset-0 z-10 bg-ink/92 transition-opacity duration-[3000ms]"
            />
          ) : null}

          {bgResumePrompt && engine.status === "paused" && !anchorHold ? (
            <div
              className="relative z-30 mb-4 rounded-2xl border border-hairline bg-surface px-4 py-3 text-center"
              role="status"
            >
              <p className="text-sm text-ink">{bgResumePrompt}</p>
              <button
                type="button"
                className="mt-2 min-h-11 text-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => {
                  setBgPromptDismissed(true)
                  engine.resume()
                }}
              >
                Continue
              </button>
            </div>
          ) : null}

          <div
            className={`relative z-20 mx-auto flex w-full max-w-lg flex-1 flex-col ${
              eyesMode === "closed" && screenDimmed ? "opacity-40" : ""
            }`}
          >
            <BodyFigure
              travelProgressMv={
                reducedMotion ? undefined : engine.cycleProgressMv
              }
              region={reducedMotion ? regionId : undefined}
              travelYs={travelYs}
              showTrail
              activeIndex={engine.segmentIndex}
              blurPx={48}
              pulseDurationSec={6}
              glowPeakOpacity={0.45}
              testId="scan-figure"
            />

            <div className="mt-8 text-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentPrompt}
                  className="mx-auto max-w-[34ch] text-xl font-light leading-relaxed text-ink"
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.2 : 0.9 }}
                >
                  {currentPrompt}
                </motion.p>
              </AnimatePresence>

              {wanderVisible && !anchorHold ? (
                <p
                  className="mt-4 text-sm text-ink-subtle"
                  data-testid="wander-reminder"
                >
                  If you&apos;ve drifted, just come back. No need to start over.
                </p>
              ) : null}
            </div>

            <div className="relative z-30 mt-auto flex flex-col gap-3 pt-10">
              {anchorHold ? (
                <>
                  <button
                    type="button"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-8 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    onClick={carryOn}
                  >
                    Carry on
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-full items-center justify-center text-sm text-ink-subtle underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={stopEarly}
                  >
                    That&apos;s enough for today
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label="Back to my anchor"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-hairline bg-surface/80 px-6 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    onClick={goToAnchor}
                    data-testid="back-to-anchor"
                  >
                    Back to my anchor
                  </button>
                  <button
                    type="button"
                    aria-label="Stop session"
                    className="inline-flex min-h-11 w-full items-center justify-center text-sm text-ink-subtle underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={stopEarly}
                    data-testid="scan-stop"
                  >
                    Stop anytime
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </SessionFrame>
    </SessionHydrationGate>
  )
}
