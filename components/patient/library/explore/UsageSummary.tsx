"use client"

import React, { useMemo } from "react"
import useSWR from "swr"
import { Activity, ShieldCheck, BookOpen, Headphones, Info, AlertTriangle, Sparkles } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch limits")
  return res.json()
})

interface UsageItemProps {
  label: string
  used: number | string
  limit: number | string
  resetDate: string | null
  icon: React.ReactNode
  resetCadence?: string
}

function UsageItem({ label, used, limit, resetDate, icon, resetCadence = "daily" }: UsageItemProps) {
  const isUnlimited = limit === "unlimited"

  // Calculate percentage and status colors
  const { percentage, status } = useMemo(() => {
    if (isUnlimited) {
      return { percentage: 100, status: "unlimited" as const }
    }
    const u = Number(used)
    const l = Number(limit)
    if (isNaN(u) || isNaN(l) || l <= 0) {
      return { percentage: 0, status: "available" as const }
    }
    const pct = Math.min(100, (u / l) * 100)
    if (u >= l) {
      return { percentage: pct, status: "limit-reached" as const }
    }
    if (pct >= 80) {
      return { percentage: pct, status: "near-limit" as const }
    }
    return { percentage: pct, status: "available" as const }
  }, [used, limit, isUnlimited])

  // Get status color mappings
  const barColor = useMemo(() => {
    switch (status) {
      case "limit-reached":
        return "bg-rose-500"
      case "near-limit":
        return "bg-amber-500"
      case "unlimited":
        return "bg-[#3d838c]"
      default:
        return "bg-[#3d838c]"
    }
  }, [status])

  const textColor = useMemo(() => {
    switch (status) {
      case "limit-reached":
        return "text-rose-600 font-bold"
      case "near-limit":
        return "text-amber-600 font-semibold"
      default:
        return "text-slate-600 font-medium"
    }
  }, [status])

  const formattedResetDate = useMemo(() => {
    if (!resetDate) return null
    try {
      const date = new Date(resetDate)
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " on " + date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    } catch {
      return null
    }
  }, [resetDate])

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-50 text-slate-600">
            {icon}
          </div>
          <span className="font-bold text-slate-800 text-sm">{label}</span>
        </div>
        <div className="text-right">
          {isUnlimited ? (
            <span className="text-[11px] font-black tracking-widest text-[#3d838c] bg-teal-50 px-2 py-0.5 rounded-md uppercase">
              Unlimited
            </span>
          ) : (
            <span className={`text-xs ${textColor}`}>
              {used} <span className="text-slate-400 font-medium">/ {limit}</span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Progress Bar */}
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Warning & Reset Information */}
        <div className="flex items-center justify-between gap-2 min-h-[16px]">
          {status === "limit-reached" && (
            <span className="flex items-center gap-1 text-[10px] text-rose-500 font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Limit reached
            </span>
          )}
          {status === "near-limit" && (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Running low
            </span>
          )}
          <span className="text-[10px] text-slate-400 font-medium ml-auto">
            {formattedResetDate ? `Resets at ${formattedResetDate}` : isUnlimited ? "Included in plan" : `Resets ${resetCadence}`}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function UsageSummary() {
  const { data, error, isLoading } = useSWR("/api/patient/limits", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 4000,
  })

  if (isLoading) {
    return (
      <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-5 md:p-6 shadow-sm animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-slate-100 rounded w-1/4" />
          <div className="h-4 bg-slate-100 rounded w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
          <div className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
          <div className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
          <div className="h-24 bg-slate-50 border border-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    // Graceful fallback: collapse silently in production
    return null
  }

  const { plan, usage } = data
  const isPremium = plan === "PREMIUM" || plan === "ORGANIZATION"

  return (
    <div className="w-full bg-[#f9f8f6] border border-slate-200/60 rounded-3xl p-5 md:p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-extrabold text-sm md:text-base text-slate-800 tracking-tight">
            Your Account Usage
          </h3>
          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
            isPremium
              ? "bg-amber-50 text-amber-700 border-amber-200/50"
              : "bg-slate-100 text-slate-600 border-slate-200/50"
          }`}>
            {plan} Plan
          </span>
        </div>
        {plan === "FREE" && (
          <a
            href="/dashboard/settings/subscription"
            className="text-[11px] font-black text-[#3d838c] hover:text-[#2d636a] uppercase tracking-widest flex items-center gap-1 transition-colors group"
          >
            Upgrade for higher limits <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {usage?.activities && (
          <UsageItem
            label="Wellness Activities"
            used={usage.activities.used}
            limit={usage.activities.limit}
            resetDate={usage.activities.resetDate}
            icon={<Activity className="w-4 h-4 text-emerald-600" />}
          />
        )}
        {usage?.assessments && (
          <UsageItem
            label="Assessments (Weekly)"
            used={usage.assessments.used}
            limit={usage.assessments.limit}
            resetDate={usage.assessments.resetDate}
            icon={<ShieldCheck className="w-4 h-4 text-indigo-600" />}
            resetCadence="weekly"
          />
        )}
        {usage?.read && (
          <UsageItem
            label="Read Articles"
            used={usage.read.used}
            limit={usage.read.limit}
            resetDate={usage.read.resetDate}
            icon={<BookOpen className="w-4 h-4 text-sky-600" />}
          />
        )}
        {usage?.listen && (
          <UsageItem
            label="Listen Audio"
            used={usage.listen.used}
            limit={usage.listen.limit}
            resetDate={usage.listen.resetDate}
            icon={<Headphones className="w-4 h-4 text-rose-600" />}
          />
        )}
      </div>
    </div>
  )
}
