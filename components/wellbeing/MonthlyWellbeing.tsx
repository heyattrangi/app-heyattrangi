"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import MoodVisualization from "./MoodVisualization"
import MoodLegend from "./MoodLegend"
import MonthlyEmptyState from "./MonthlyEmptyState"

interface MoodSegment {
  label: string
  value: number
  color: string
  bgClass: string
  image: string
}

interface MonthlyWellbeingProps {
  monthLabel: string
  averageMood: number
  moods: MoodSegment[]
  onPrevMonth: () => void
  onNextMonth: () => void
  isPrevDisabled: boolean
  isNextDisabled: boolean
  hasData?: boolean
  isLoading?: boolean
}

export default function MonthlyWellbeing({
  monthLabel,
  averageMood,
  moods,
  onPrevMonth,
  onNextMonth,
  isPrevDisabled,
  isNextDisabled,
  hasData = true,
  isLoading = false,
}: MonthlyWellbeingProps) {
  return (
    <div className="relative w-full max-w-2xl mx-auto select-none">
      {/* Main White Card */}
      <div
        key={monthLabel}
        className="bg-white rounded-[32px] px-4 min-[360px]:px-6 sm:px-14 py-5 sm:py-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-100/80 w-full flex flex-col gap-4 relative animate-in fade-in slide-in-from-right-3 duration-200"
      >
        {/* Card Header: Month title */}
        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base font-extrabold text-[#7A8B99] tracking-wide">
            {monthLabel}
          </span>
        </div>

        {isLoading ? (
          /* In-card loading shimmer — page shell stays visible */
          <div className="flex flex-col items-center gap-5 py-4 animate-pulse">
            <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] rounded-full bg-slate-100" />
            <div className="flex gap-4 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
                  <div className="w-10 h-3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ) : hasData ? (
          <>
            {/* Circular Mood Visualization */}
            <div className="py-0">
              <MoodVisualization moods={moods} averageMood={averageMood} />
            </div>

            {/* Mood Distribution / Legend */}
            <div className="border-t border-slate-100 pt-3">
              <MoodLegend moods={moods} />
            </div>
          </>
        ) : (
          <MonthlyEmptyState />
        )}
      </div>

      {/* Previous Month Button (Overlayed absolutely on the left border) */}
      <button
        onClick={onPrevMonth}
        disabled={isPrevDisabled || isLoading}
        aria-label="Previous month"
        className={`absolute left-2 sm:left-0 translate-x-0 sm:-translate-x-1/2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-[#FCE8E6] hover:bg-[#FCDAD6] text-[#A53A35] z-20 transition-all duration-200 cursor-pointer shadow-md border border-white/50
          ${(isPrevDisabled || isLoading) ? "opacity-35 pointer-events-none" : "active:scale-90"}
        `}
      >
        <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Next Month Button (Overlayed absolutely on the right border) */}
      <button
        onClick={onNextMonth}
        disabled={isNextDisabled || isLoading}
        aria-label="Next month"
        className={`absolute right-2 sm:right-0 translate-x-0 sm:translate-x-1/2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-[#FCE8E6] hover:bg-[#FCDAD6] text-[#A53A35] z-20 transition-all duration-200 cursor-pointer shadow-md border border-white/50
          ${(isNextDisabled || isLoading) ? "opacity-35 pointer-events-none" : "active:scale-90"}
        `}
      >
        <ChevronRight className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  )
}
