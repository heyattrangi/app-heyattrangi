import ExploreDashboardSidebar from "./ExploreDashboardSidebar"
import LoadingBar from "@/components/ui/LoadingBar"
import { Suspense } from "react"

export default function ExploreDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden relative">
      <LoadingBar />
      <Suspense fallback={<div className="w-64 bg-white" />}>
        <ExploreDashboardSidebar />
      </Suspense>
      <div className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden">
        {children}
      </div>
    </div>
  )
}
