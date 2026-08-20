import Link from "next/link"
import SignOutButton from "@/components/auth/SignOutButton"
import type { ReactNode } from "react"
import AdminFilters from "@/components/admin/AdminFilters"

type NavItem = {
  label: string
  href: string
  description: string
}

type AdminShellProps = {
  pathname: string
  userName?: string | null
  organizations: { id: string; name: string }[]
  children: ReactNode
}

const primaryNav: NavItem[] = [
  {
    label: "Overview",
    href: "/admin/dashboard",
    description: "Executive snapshot",
  },
  {
    label: "Engagement",
    href: "/admin/engagement",
    description: "Product usage",
  },
  {
    label: "Institutions",
    href: "/admin/institutions",
    description: "Cohort comparison",
  },
  {
    label: "Users",
    href: "/admin/users",
    description: "Operational lookup",
  },
  {
    label: "Subscriptions",
    href: "/admin/subscriptions",
    description: "Paid user management",
  },
]

const legacyNav: NavItem[] = [
  {
    label: "Doctors",
    href: "/admin/doctors",
    description: "Verification workflow",
  },
  {
    label: "Patients",
    href: "/admin/patients",
    description: "Account lookup",
  },
  {
    label: "Support",
    href: "/admin/support-messages",
    description: "Inbox triage",
  },
  {
    label: "Payments",
    href: "/admin/payments",
    description: "Financial tools",
  },
  {
    label: "Profile",
    href: "/admin/profile",
    description: "Admin settings",
  },
]

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href))
}

function AdminNavSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <div className="space-y-2">
      <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-2xl border px-3 py-3 transition-all ${
                active
                  ? "border-[#f5b46a] bg-[#fff7ef] text-slate-950 shadow-sm"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{item.label}</div>
                  <div className="text-[12px] text-slate-500">{item.description}</div>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    active ? "bg-[#f59e0b]" : "bg-slate-200"
                  }`}
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminShell({ pathname, userName, organizations, children }: AdminShellProps) {
  const activeSection =
    primaryNav.find((item) => isActive(pathname, item.href))?.label || "Overview"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,243,224,0.8),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#f3f5fb_100%)] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-white/70 bg-white/70 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
          <div className="grid h-11 w-11 grid-cols-2 grid-rows-2 gap-[2px] rounded-2xl shadow-sm">
            <div className="rounded-tl-lg bg-[#FFC107]" />
            <div className="rounded-tr-lg bg-[#FF5252]" />
            <div className="rounded-bl-lg bg-[#FF9800]" />
            <div className="rounded-br-lg bg-[#E64A19]" />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
              Attrangi
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              Admin Panel
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <AdminNavSection title="Primary" items={primaryNav} pathname={pathname} />
            <AdminNavSection title="Operations" items={legacyNav} pathname={pathname} />
          </div>
        </div>

        <div className="border-t border-slate-100 p-5">
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
              Signed in as
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900">
              {userName || "Admin"}
            </div>
            <div className="mt-4">
              <SignOutButton className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800" />
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-80">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                {activeSection}
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Attrangi Admin
              </h2>
            </div>

            <AdminFilters userName={userName} organizations={organizations} />

            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <SignOutButton className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm" />
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
