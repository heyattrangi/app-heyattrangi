import { redirect } from "next/navigation"
import { auth } from "@/auth.config"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import AdminShell from "@/components/admin/AdminShell"
import SubscriptionsClient from "@/components/admin/SubscriptionsClient"
import { PlanType } from "@prisma/client"

type SearchParamsValue = Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>

function readParams(searchParams?: SearchParamsValue) {
  return Promise.resolve(searchParams).then((resolved) => {
    const params = new URLSearchParams()
    if (!resolved) return params
    for (const [key, value] of Object.entries(resolved)) {
      if (Array.isArray(value)) {
        if (value[0]) params.set(key, value[0])
      } else if (typeof value === "string" && value) {
        params.set(key, value)
      }
    }
    return params
  })
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams?: SearchParamsValue
}) {
  const session = await auth()
  const user = await getCurrentUser()

  if (!session?.user || user?.role !== "ADMIN") {
    redirect("/auth/unauthorized")
  }

  // Parse parameters
  const params = await readParams(searchParams)
  const search = params.get("search") || ""
  const plan = params.get("plan") || "all"
  const paymentStatus = params.get("paymentStatus") || "all"
  const subscriptionStatus = params.get("subscriptionStatus") || "all"
  const range = params.get("range") || "all"
  const page = Math.max(1, parseInt(params.get("page") || "1", 10))
  const limit = Math.min(100, Math.max(10, parseInt(params.get("limit") || "20", 10)))

  // 1. Calculate Date Threshold
  const now = new Date()
  let dateThreshold: Date | undefined
  if (range === "today") {
    dateThreshold = new Date(now.setHours(0, 0, 0, 0))
  } else if (range === "last7") {
    dateThreshold = new Date(now.setDate(now.getDate() - 7))
    dateThreshold.setHours(0, 0, 0, 0)
  } else if (range === "last30") {
    dateThreshold = new Date(now.setDate(now.getDate() - 30))
    dateThreshold.setHours(0, 0, 0, 0)
  } else if (range === "last90") {
    dateThreshold = new Date(now.setDate(now.getDate() - 90))
    dateThreshold.setHours(0, 0, 0, 0)
  }

  // 2. Build Prisma Filter
  const baseWhere = {
    OR: [
      { plan: { not: "FREE" as const } },
      { transactions: { some: { type: "SUBSCRIPTION" } } }
    ]
  }

  const filterConditions: any[] = [baseWhere]

  if (search) {
    filterConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } }
      ]
    })
  }

  if (plan && plan !== "all") {
    filterConditions.push({ plan: plan as PlanType })
  }

  if (paymentStatus && paymentStatus !== "all") {
    filterConditions.push({
      transactions: {
        some: {
          type: "SUBSCRIPTION",
          status: paymentStatus === "paid" ? "SUCCESS" : paymentStatus === "failed" ? "FAILED" : "PENDING"
        }
      }
    })
  }

  if (subscriptionStatus && subscriptionStatus !== "all") {
    if (subscriptionStatus === "active") {
      filterConditions.push({ plan: { not: "FREE" as const } })
    } else if (subscriptionStatus === "expired") {
      filterConditions.push({
        plan: "FREE" as const,
        transactions: {
          some: {
            type: "SUBSCRIPTION",
            status: "SUCCESS"
          }
        }
      })
    }
  }

  if (dateThreshold) {
    filterConditions.push({
      transactions: {
        some: {
          type: "SUBSCRIPTION",
          createdAt: { gte: dateThreshold }
        }
      }
    })
  }

  const where = { AND: filterConditions }

  // 3. Query Paginated Users and aggregate statistics
  const [
    users,
    totalCount,
    totalUsersCount,
    premiumUsersCount,
    freeUsersCount,
    activeSubsCount,
    revenueAggregation,
    organizations
  ] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        transactions: {
          where: { type: "SUBSCRIPTION" },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { plan: "PREMIUM" } }),
    prisma.user.count({ where: { plan: "FREE" } }),
    prisma.user.count({ where: { plan: { in: ["PREMIUM", "ESSENTIAL", "ORGANIZATION"] } } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "SUBSCRIPTION", status: "SUCCESS" }
    }),
    prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ])

  const totalRevenue = revenueAggregation._sum.amount || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  // 4. Format row details
  const formattedUsers = users.map((u) => {
    const latestTx = u.transactions[0] || null
    const payStatus = latestTx ? (latestTx.status === "SUCCESS" ? "PAID" : latestTx.status) : "N/A"
    
    let subStatus = "INACTIVE"
    if (u.plan !== "FREE") {
      subStatus = "ACTIVE"
    } else if (latestTx && latestTx.status === "SUCCESS") {
      subStatus = "EXPIRED"
    }

    let renewalDate: Date | null = null
    if (latestTx && latestTx.status === "SUCCESS") {
      renewalDate = new Date(latestTx.createdAt)
      renewalDate.setDate(renewalDate.getDate() + 30)
    }

    return {
      id: u.id,
      name: u.name || "Unnamed user",
      email: u.email || "No email",
      plan: u.plan,
      paymentStatus: payStatus,
      subscriptionStatus: subStatus,
      amount: latestTx ? latestTx.amount : 0,
      currency: "INR",
      paymentDate: latestTx ? latestTx.createdAt.toISOString() : null,
      startDate: latestTx ? latestTx.createdAt.toISOString() : null,
      renewalDate: renewalDate ? renewalDate.toISOString() : null,
      paymentProvider: latestTx ? "Razorpay" : "N/A",
      paymentId: latestTx ? latestTx.razorpayPaymentId || "N/A" : "N/A",
      orderId: latestTx ? latestTx.razorpayOrderId || "N/A" : "N/A",
      history: u.transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        status: tx.status === "SUCCESS" ? "PAID" : tx.status,
        paymentId: tx.razorpayPaymentId || "N/A",
        orderId: tx.razorpayOrderId || "N/A",
        createdAt: tx.createdAt.toISOString(),
        description: tx.description
      }))
    }
  })

  const stats = {
    totalUsers: totalUsersCount,
    premiumUsers: premiumUsersCount,
    freeUsers: freeUsersCount,
    activeSubscriptions: activeSubsCount,
    totalRevenue
  }

  const searchParamsValues = {
    search,
    plan,
    paymentStatus,
    subscriptionStatus,
    range,
    page,
    totalPages,
    total: totalCount
  }

  return (
    <AdminShell pathname="/admin/subscriptions" userName={user?.name} organizations={organizations}>
      <section className="grid gap-6 w-full min-w-0">
        <div className="w-full min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-left animate-in fade-in duration-300">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
            Subscriptions
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
            Premium Subscription Panel
          </h1>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-slate-500 font-medium">
            Audit paid users, track transaction records, monitor revenue, and manage platform access.
          </p>
        </div>

        <SubscriptionsClient
          initialUsers={formattedUsers}
          stats={stats}
          searchParamsValues={searchParamsValues}
        />
      </section>
    </AdminShell>
  )
}
