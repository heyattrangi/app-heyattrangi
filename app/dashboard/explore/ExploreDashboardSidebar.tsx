"use client"

import { useSearchParams } from "next/navigation"
import Sidebar from "@/components/patient/Sidebar"

export default function ExploreDashboardSidebar() {
  const searchParams = useSearchParams()
  const isEmbedded = searchParams?.get("embedded") === "true"

  if (isEmbedded) {
    return null
  }

  return <Sidebar />
}
