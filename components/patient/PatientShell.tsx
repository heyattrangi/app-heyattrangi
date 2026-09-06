"use client"

import Sidebar from "@/components/patient/Sidebar"
import LoadingBar from "@/components/ui/LoadingBar"
import { QuickBreatheButton } from "@/features/activities/components/QuickBreatheButton"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"

/**
 * Patient chrome (sidebar + shell). Uses client pathname so assessment
 * take-pages hide the sidebar on both SSR and client navigations without
 * hydration mismatches from stale server layout headers.
 */
export default function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const searchParams = useSearchParams()
  const isEmbedded = searchParams?.get("embedded") === "true";
  const hideSidebar = pathname.startsWith("/patient/assessments/") || isEmbedded;
  const showMobileNav = !isEmbedded && false // keeping original false but ensuring it respects embedded

  const isHomeActive = pathname === "/patient/dashboard"
  const isExploreActive = pathname.startsWith("/patient/library") || pathname.startsWith("/explore") || pathname.startsWith("/listen") || pathname.startsWith("/read")

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden relative">
      <LoadingBar />
      {!hideSidebar && <Sidebar />}
      <div className={`flex-1 min-w-0 h-full flex flex-col relative overflow-hidden ${showMobileNav ? "pb-[72px] md:pb-0" : ""}`}>
        <div className="flex-1 overflow-y-auto min-h-0 min-w-0 flex flex-col">
          {children}
        </div>
        
        {/* Global Mobile Navigation Tab Bar */}
        {showMobileNav && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100/80 flex justify-around items-center py-3.5 shadow-[0_-8px_30px_rgba(0,0,0,0.03)]">
            <Link 
              href="/patient/dashboard" 
              className={`flex flex-col items-center gap-1 transition-colors ${
                isHomeActive ? "text-[#E8722A]" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <svg className="w-5 h-5" fill={isHomeActive ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isHomeActive ? 0 : 2.5}>
                {isHomeActive ? (
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                )}
              </svg>
              <span className="text-[10px] font-bold">Home</span>
            </Link>
            
            <Link 
              href="/patient/library" 
              className={`flex flex-col items-center gap-1 transition-colors ${
                isExploreActive ? "text-[#E8722A]" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span className="text-[10px] font-bold">Explore</span>
            </Link>
          </div>
        )}
      </div>
      <QuickBreatheButton />
    </div>
  )
}
