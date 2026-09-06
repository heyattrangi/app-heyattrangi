"use client"

import React, { useState, useEffect } from "react"
import { format } from "date-fns"
import { X, Copy, Check, Users, Award, ShieldCheck, CreditCard, Calendar } from "lucide-react"
import { toast } from "sonner"
import { createPortal } from "react-dom"

type TransactionHistoryItem = {
  id: string
  amount: number
  status: string
  paymentId: string
  orderId: string
  createdAt: string
  description: string
}

type PremiumUserRow = {
  id: string
  name: string
  email: string
  plan: string
  paymentStatus: string
  subscriptionStatus: string
  amount: number
  currency: string
  paymentDate: string | null
  startDate: string | null
  renewalDate: string | null
  paymentProvider: string
  paymentId: string
  orderId: string
  history: TransactionHistoryItem[]
}

type SubscriptionsClientProps = {
  initialUsers: PremiumUserRow[]
  stats: {
    totalUsers: number
    premiumUsers: number
    freeUsers: number
    activeSubscriptions: number
    totalRevenue: number
  }
  searchParamsValues: {
    search: string
    plan: string
    paymentStatus: string
    subscriptionStatus: string
    range: string
    page: number
    totalPages: number
    total: number
  }
}

export function SubscriptionStatCard({
  label,
  value,
  sublabel,
  icon: Icon
}: {
  label: string
  value: string | number
  sublabel: string
  icon: React.ComponentType<any>
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex items-start justify-between gap-4 h-full min-w-0 w-full transition-all hover:shadow-md duration-200">
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400 truncate">
            {label}
          </p>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 mt-2 truncate">
            {value}
          </div>
        </div>
        <p className="text-[11px] leading-snug text-slate-505 font-medium mt-3.5 line-clamp-2">
          {sublabel}
        </p>
      </div>
      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </div>
    </div>
  )
}

export default function SubscriptionsClient({
  initialUsers,
  stats,
  searchParamsValues
}: SubscriptionsClientProps) {
  const [selectedUser, setSelectedUser] = useState<PremiumUserRow | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
      case "PAID":
      case "SUCCESS":
        return "bg-emerald-50 text-emerald-700 border-emerald-100"
      case "EXPIRED":
      case "CANCELLED":
        return "bg-amber-50 text-amber-700 border-amber-100"
      case "FAILED":
        return "bg-rose-50 text-rose-700 border-rose-100"
      case "PENDING":
      default:
        return "bg-slate-50 text-slate-600 border-slate-100"
    }
  }

  const getPlanBadge = (plan: string) => {
    switch (plan.toUpperCase()) {
      case "PREMIUM":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200/60 shadow-sm">
            ★ PREMIUM
          </span>
        )
      case "ESSENTIAL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800 border border-blue-200/60">
            ESSENTIAL
          </span>
        )
      case "ORGANIZATION":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-800 border border-indigo-200/60">
            ORGANIZATION
          </span>
        )
      case "FREE":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
            FREE
          </span>
        )
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    const norm = status.toUpperCase()
    if (norm === "PAID" || norm === "SUCCESS") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          PAID
        </span>
      )
    }
    if (norm === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          FAILED
        </span>
      )
    }
    if (norm === "PENDING") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          PENDING
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500 border border-slate-200">
        N/A
      </span>
    )
  }

  const getSubscriptionStatusBadge = (status: string) => {
    const norm = status.toUpperCase()
    if (norm === "ACTIVE") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-extrabold shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          ACTIVE
        </span>
      )
    }
    if (norm === "EXPIRED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500 border border-slate-200">
          EXPIRED
        </span>
      )
    }
    if (norm === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200/60">
          CANCELLED
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-400 border border-slate-100">
        {status}
      </span>
    )
  }

  const modalContent = selectedUser && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Subscription Profile</span>
            <h2 className="text-xl font-black text-slate-900 mt-1">{selectedUser.name}</h2>
          </div>
          <button 
            onClick={() => setSelectedUser(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-left">
          {/* USER SECTION */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">User Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Full Name</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{selectedUser.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Email Address</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{selectedUser.email}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Account ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-full">
                    {selectedUser.id}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedUser.id, "User ID")}
                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-md transition-colors"
                  >
                    {copiedId === selectedUser.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SUBSCRIPTION SECTION */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Subscription Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Tier / Plan</p>
                <div className="mt-1.5">{getPlanBadge(selectedUser.plan)}</div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</p>
                <div className="mt-1.5">{getSubscriptionStatusBadge(selectedUser.subscriptionStatus)}</div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Amount</p>
                <p className="text-sm font-bold text-slate-900 mt-1.5">₹{selectedUser.amount}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Payment</p>
                <div className="mt-1.5">{getPaymentStatusBadge(selectedUser.paymentStatus)}</div>
              </div>
              <div className="col-span-2 mt-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Start Date</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {selectedUser.startDate ? format(new Date(selectedUser.startDate), "dd MMM yyyy HH:mm") : "N/A"}
                </p>
              </div>
              <div className="col-span-2 mt-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Next Renewal Date</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {selectedUser.renewalDate ? format(new Date(selectedUser.renewalDate), "dd MMM yyyy") : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* PAYMENT SECTION */}
          {selectedUser.paymentId !== "N/A" && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Payment Gateway Identifiers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 uppercase font-sans text-[10px] font-bold block">Payment ID</span>
                    <span className="text-slate-700 font-bold block mt-0.5 truncate max-w-[200px]">{selectedUser.paymentId}</span>
                  </div>
                  <button 
                    onClick={() => handleCopy(selectedUser.paymentId, "Payment ID")} 
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200/50 rounded-lg shrink-0"
                  >
                    {copiedId === selectedUser.paymentId ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 uppercase font-sans text-[10px] font-bold block">Order ID</span>
                    <span className="text-slate-700 font-bold block mt-0.5 truncate max-w-[200px]">{selectedUser.orderId}</span>
                  </div>
                  <button 
                    onClick={() => handleCopy(selectedUser.orderId, "Order ID")} 
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200/50 rounded-lg shrink-0"
                  >
                    {copiedId === selectedUser.orderId ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BILLING HISTORY */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Billing History</h3>
            {selectedUser.history.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No billing history found.</p>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                {selectedUser.history.map((tx) => (
                  <div key={tx.id} className="p-4 bg-slate-50/20 hover:bg-slate-50/60 flex items-center justify-between gap-4 transition-colors">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800">{tx.description || "Subscription upgrade"}</div>
                      <div className="text-slate-400 font-medium">
                        {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")} &bull; ID: {tx.paymentId}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-slate-900 text-sm">₹{tx.amount}</div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold mt-1 ${getStatusBadgeClass(tx.status)}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={() => setSelectedUser(null)}
            className="px-6 py-3 bg-slate-950 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="grid gap-6 w-full min-w-0">
      {/* 1. Summary Cards Row */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 w-full min-w-0">
        <SubscriptionStatCard
          label="Total Registered"
          value={stats.totalUsers}
          sublabel="Total accounts in database"
          icon={Users}
        />
        <SubscriptionStatCard
          label="Premium Active"
          value={stats.premiumUsers}
          sublabel="Active premium members"
          icon={Award}
        />
        <SubscriptionStatCard
          label="Free Accounts"
          value={stats.freeUsers}
          sublabel="Standard tier members"
          icon={Users}
        />
        <SubscriptionStatCard
          label="Active Subscriptions"
          value={stats.activeSubscriptions}
          sublabel="Currently active memberships"
          icon={ShieldCheck}
        />
        <SubscriptionStatCard
          label="Total Revenue"
          value={`₹${stats.totalRevenue}`}
          sublabel="Successful subscription revenue"
          icon={CreditCard}
        />
      </section>

      {/* 2. Filters Form */}
      <form className="w-full min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm text-left" method="get">
        <input type="hidden" name="range" value={searchParamsValues.range} />
        
        {/* 4 columns layout on desktop */}
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full min-w-0">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 ml-1">Search user</label>
            <input
              name="search"
              defaultValue={searchParamsValues.search}
              placeholder="Search by name or email"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-slate-50/50 hover:bg-slate-50/20"
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 ml-1">Plan tier</label>
            <select
              name="plan"
              defaultValue={searchParamsValues.plan}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none bg-slate-50/50 hover:bg-slate-50/20 text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer"
            >
              <option value="all">All plans</option>
              <option value="FREE">Free</option>
              <option value="ESSENTIAL">Essential</option>
              <option value="PREMIUM">Premium</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 ml-1">Payment Status</label>
            <select
              name="paymentStatus"
              defaultValue={searchParamsValues.paymentStatus}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none bg-slate-50/50 hover:bg-slate-50/20 text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer"
            >
              <option value="all">All payments</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 ml-1">Subscription Status</label>
            <select
              name="subscriptionStatus"
              defaultValue={searchParamsValues.subscriptionStatus}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none bg-slate-50/50 hover:bg-slate-50/20 text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer"
            >
              <option value="all">All subscription states</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Separator and Buttons row */}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <a
            href="/admin/subscriptions"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-all select-none text-center min-w-[120px]"
          >
            Clear filters
          </a>
          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm cursor-pointer min-w-[120px] text-center"
          >
            Apply filters
          </button>
        </div>
      </form>

      {/* 3. Table Card */}
      <div className="w-full min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
              Subscription Registry
            </p>
            <h2 className="mt-1.5 text-xl font-black tracking-tight text-slate-950">
              {searchParamsValues.total} Premium records matching
            </h2>
          </div>
          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-100 shrink-0 self-start sm:self-auto">
            Page {searchParamsValues.page} of {searchParamsValues.totalPages}
          </div>
        </div>

        {initialUsers.length === 0 ? (
          /* Clean custom Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-slate-100 shadow-inner shrink-0">
              <Award className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No subscriptions found</h3>
            <p className="text-sm text-slate-505 mt-1 max-w-sm">
              Try adjusting your search query or filters to view other user records.
            </p>
            <a
              href="/admin/subscriptions"
              className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-bold text-white hover:bg-slate-800 transition-colors select-none shadow-sm cursor-pointer"
            >
              Reset all filters
            </a>
          </div>
        ) : (
          /* Responsive Table Wrapper (scrolls horizontally internally if needed) */
          <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="w-full overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap table-auto">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4">Name</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Plan</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Amount</th>
                    <th className="px-5 py-4">Start Date</th>
                    <th className="px-5 py-4">Expiry Date</th>
                    <th className="px-5 py-4">Reference</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialUsers.map((row) => (
                    <tr 
                      key={row.id} 
                      className="hover:bg-slate-50/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedUser(row)}
                    >
                      <td className="px-5 py-4 font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                        <span title={row.name} className="truncate block max-w-[150px] sm:max-w-[200px]">
                          {row.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">
                        <span title={row.email} className="truncate block max-w-[180px] sm:max-w-[220px]">
                          {row.email}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold">
                        {getPlanBadge(row.plan)}
                      </td>
                      <td className="px-5 py-4">
                        {getPaymentStatusBadge(row.paymentStatus)}
                      </td>
                      <td className="px-5 py-4">
                        {getSubscriptionStatusBadge(row.subscriptionStatus)}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-slate-900">
                        ₹{row.amount}
                      </td>
                      <td className="px-5 py-4 text-slate-505 font-medium">
                        {row.startDate ? format(new Date(row.startDate), "dd MMM yyyy") : "N/A"}
                      </td>
                      <td className="px-5 py-4 text-slate-505 font-medium">
                        {row.renewalDate ? format(new Date(row.renewalDate), "dd MMM yyyy") : "N/A"}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-400">
                        <span title={row.paymentId !== "N/A" ? row.paymentId : ""} className="truncate block max-w-[100px]">
                          {row.paymentId !== "N/A" ? row.paymentId : "N/A"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedUser(row)}
                          className="inline-flex rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-all active:scale-[0.96] select-none"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Row */}
        {searchParamsValues.totalPages > 1 && (
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="text-xs font-bold text-slate-505 text-center sm:text-left">
              Showing {initialUsers.length} of {searchParamsValues.total} records
            </div>
            <div className="flex items-center gap-2">
              <a
                href={makePageHref(searchParamsValues.page - 1, searchParamsValues)}
                className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all active:scale-[0.97] ${
                  searchParamsValues.page <= 1
                    ? "pointer-events-none border-slate-200 text-slate-300 bg-slate-50"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Previous
              </a>
              <a
                href={makePageHref(searchParamsValues.page + 1, searchParamsValues)}
                className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all active:scale-[0.97] ${
                  searchParamsValues.page >= searchParamsValues.totalPages
                    ? "pointer-events-none border-slate-200 text-slate-300 bg-slate-50"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Next
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Render Portal modal */}
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </div>
  )
}

function makePageHref(nextPage: number, currentValues: any) {
  const params = new URLSearchParams()
  params.set("page", String(nextPage))
  if (currentValues.search) params.set("search", currentValues.search)
  if (currentValues.plan !== "all") params.set("plan", currentValues.plan)
  if (currentValues.paymentStatus !== "all") params.set("paymentStatus", currentValues.paymentStatus)
  if (currentValues.subscriptionStatus !== "all") params.set("subscriptionStatus", currentValues.subscriptionStatus)
  if (currentValues.range !== "all") params.set("range", currentValues.range)
  return `/admin/subscriptions?${params.toString()}`
}
