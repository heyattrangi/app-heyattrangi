"use client"

import { X } from "lucide-react"
import RecorderTimer from "@/components/patient/library/explore/session/RecorderTimer"

interface RecorderHeaderProps {
  title: string
  elapsedMs: number
  isPaused: boolean
  onExit: () => void
}

export default function RecorderHeader({
  title,
  elapsedMs,
  isPaused,
  onExit,
}: RecorderHeaderProps) {
  const isEmbedded = typeof window !== 'undefined' && window.location.search.includes('embedded=true')

  return (
    <header className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100/80 bg-white/70 backdrop-blur-md">
      {!isEmbedded ? (
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit session"
        className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
      >
        <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
      </button>
      ) : (
        <div className="w-10 h-10" />
      )}

      <h1 className="min-w-0 flex-1 text-center font-bold text-[15px] sm:text-base text-slate-800 tracking-tight truncate px-2">
        {title}
      </h1>

      <div className="w-16 sm:w-20 flex justify-end">
        <RecorderTimer elapsedMs={elapsedMs} isPaused={isPaused} />
      </div>
    </header>
  )
}
