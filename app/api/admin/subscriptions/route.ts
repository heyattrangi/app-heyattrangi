import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth.config"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PlanType } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const currentUser = await getCurrentUser()

    if (!session?.user || currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "20", 10)))
    const search = searchParams.get("search") || ""
    const plan = searchParams.get("plan") || "all"
    const paymentStatus = searchParams.get("paymentStatus") || "all"
    const subscriptionStatus = searchParams.get("subscriptionStatus") || "all"
    const range = searchParams.get("range") || "all"

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

    // 2. Build where filter for users list
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

    // 3. Query paginated users
    const [users, totalCount] = await Promise.all([
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
      prisma.user.count({ where })
    ])

    // 4. Calculate Aggregate Stats
    const [
      totalUsersCount,
      premiumUsersCount,
      freeUsersCount,
      activeSubsCount,
      revenueAggregation
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: "PREMIUM" } }),
      prisma.user.count({ where: { plan: "FREE" } }),
      prisma.user.count({ where: { plan: { in: ["PREMIUM", "ESSENTIAL", "ORGANIZATION"] } } }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "SUBSCRIPTION", status: "SUCCESS" }
      })
    ])

    const totalRevenue = revenueAggregation._sum.amount || 0

    // 5. Format results
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
        paymentDate: latestTx ? latestTx.createdAt : null,
        startDate: latestTx ? latestTx.createdAt : null,
        renewalDate,
        paymentProvider: latestTx ? "Razorpay" : "N/A",
        paymentId: latestTx ? latestTx.razorpayPaymentId || "N/A" : "N/A",
        orderId: latestTx ? latestTx.razorpayOrderId || "N/A" : "N/A",
        history: u.transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          status: tx.status === "SUCCESS" ? "PAID" : tx.status,
          paymentId: tx.razorpayPaymentId || "N/A",
          orderId: tx.razorpayOrderId || "N/A",
          createdAt: tx.createdAt,
          description: tx.description
        }))
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: totalUsersCount,
        premiumUsers: premiumUsersCount,
        freeUsers: freeUsersCount,
        activeSubscriptions: activeSubsCount,
        totalRevenue
      },
      users: formattedUsers,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalCount / limit))
      }
    })
  } catch (error: any) {
    console.error("[ADMIN_SUBSCRIPTIONS_GET]", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
