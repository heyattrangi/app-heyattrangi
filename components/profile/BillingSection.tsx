"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface BillingSectionProps {
    user: any
    isTestMode?: boolean
}

const planBillingMap: Record<string, { label: string; price: string; description: string }> = {
    FREE: {
        label: "Free",
        price: "₹0",
        description: "Default access to core tools and limited daily AI chats.",
    },
    ESSENTIAL: {
        label: "Essential",
        price: "₹49/mo",
        description: "Core self-care tools, AI interactions, and standard support.",
    },
    PREMIUM: {
        label: "Premium",
        price: "₹199/sem",
        description: "Enhanced access, more credits, and premium support.",
    },
    ORGANIZATION: {
        label: "Organization",
        price: "Billed by institution",
        description: "Custom corporate plan with organization-managed billing.",
    },
}

export default function BillingSection({ user, isTestMode = false }: BillingSectionProps) {
    const router = useRouter()
    const [currentPlan, setCurrentPlan] = useState<string>(user.plan || "FREE")
    const [isUpdating, setIsUpdating] = useState<string | null>(null)
    const [transactions, setTransactions] = useState<any[]>([])
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(true)
    const [isMonthly, setIsMonthly] = useState(true)
    const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await fetch('/api/profile/transactions')
                if (!res.ok) {
                    console.warn(`Transactions API returned ${res.status}`)
                    return
                }
                const contentType = res.headers.get("content-type")
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const data = await res.json()
                    if (data.success) {
                        setTransactions(data.transactions)
                    }
                }
            } catch (err) {
                console.error("Failed to fetch transactions:", err)
            } finally {
                setIsLoadingTransactions(false)
            }
        }
        fetchTransactions()
    }, [])

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handleSubscribe = async (plan: string, amount: number) => {
        if (plan === currentPlan) return
        setIsUpdating(plan)
        try {
            const isLoaded = await loadRazorpayScript()
            if (!isLoaded) {
                alert("Razorpay SDK failed to load. Are you online?")
                return
            }

            // Create Order
            const orderRes = await fetch("/api/payments/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan,
                    amount
                })
            })

            const orderData = await orderRes.json()
            if (!orderData.success) throw new Error(orderData.error)

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_T2HN6tpPOHf8Mw',
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Hey Attrangi",
                description: `${plan} Plan Upgrade`,
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    // Verify
                    const verifyRes = await fetch("/api/payments/subscribe/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            plan,
                            amount
                        })
                    })

                    const verifyData = await verifyRes.json()
                    if (verifyData.success) {
                        setCurrentPlan(plan)
                        alert(`Successfully upgraded to ${plan} plan!`)
                        router.refresh()
                        // Reload transactions list
                        try {
                            const res = await fetch('/api/profile/transactions')
                            if (res.ok) {
                                const contentType = res.headers.get("content-type")
                                if (contentType && contentType.indexOf("application/json") !== -1) {
                                    const data = await res.json()
                                    if (data.success) {
                                        setTransactions(data.transactions)
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Failed to reload transactions:", err)
                        }
                    } else {
                        alert(verifyData.error || "Payment verification failed.")
                    }
                },
                prefill: {
                    name: user.name || "",
                    email: user.email || "",
                },
                theme: {
                    color: "#f97316",
                }
            }

            const rzp = new (window as any).Razorpay(options)
            rzp.on('payment.failed', function (response: any) {
                const reason = response?.error?.description || "Payment was declined"
                void fetch("/api/payments/notify-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "FAILED",
                        amount,
                        description: `${plan === "PREMIUM" ? "Companion" : plan === "ESSENTIAL" ? "Listener" : plan} plan subscription`,
                        paymentId: response?.error?.metadata?.payment_id || null,
                        orderId: orderData.orderId,
                        reason,
                    }),
                }).catch(() => {})
                alert(`Payment Failed: ${reason}`)
            })
            rzp.open()

        } catch (error: any) {
            console.error("Subscription error:", error)
            alert(error.message || "Error initiating payment.")
        } finally {
            setIsUpdating(null)
        }
    }

    const handlePlanChange = async (targetPlan: string) => {
        if (targetPlan === currentPlan) return
        setIsUpdating(targetPlan)
        try {
            const res = await fetch("/api/profile/plan", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: targetPlan }),
            })
            if (res.ok) {
                setCurrentPlan(targetPlan)
                alert(`Successfully switched to ${targetPlan} plan! (Test Mode)`)
                router.refresh()
                // Reload transactions list
                try {
                    const txnRes = await fetch('/api/profile/transactions')
                    if (txnRes.ok) {
                        const contentType = txnRes.headers.get("content-type")
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                            const txnData = await txnRes.json()
                            if (txnData.success) {
                                setTransactions(txnData.transactions)
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to reload transactions:", err)
                }
            } else {
                alert("Failed to update plan. Please try again.")
            }
        } catch (err) {
            console.error("Error updating plan:", err)
            alert("Error updating plan. Please try again.")
        } finally {
            setIsUpdating(null)
        }
    }

    const getExpirationDate = () => {
        const date = user.updatedAt ? new Date(user.updatedAt) : new Date()
        if (currentPlan === "ESSENTIAL") {
            date.setMonth(date.getMonth() + 1)
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        } else if (currentPlan === "PREMIUM") {
            date.setMonth(date.getMonth() + 4) // 4 months for semester
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        }
        return null
    }

    const getBillingCycle = () => {
        if (currentPlan === "ESSENTIAL") return "Monthly"
        if (currentPlan === "PREMIUM") return "Semester (4 Months)"
        if (currentPlan === "ORGANIZATION") return "Managed by Institution"
        return "N/A"
    }

    const getButtonState = (plan: string) => {
        const planHierarchy: Record<string, number> = {
            FREE: 0,
            ESSENTIAL: 1,
            PREMIUM: 2,
            ORGANIZATION: 3
        }

        const currentRank = planHierarchy[currentPlan] ?? 0
        const targetRank = planHierarchy[plan] ?? 0

        if (currentPlan === plan) {
            return {
                text: "Current Plan",
                disabled: true,
                className: "bg-[#0f172a] text-white cursor-default border-transparent"
            }
        }

        if (!isTestMode && currentRank > targetRank) {
            return {
                text: "Already Bought",
                disabled: true,
                className: "bg-gray-100 text-gray-400 cursor-default border-transparent"
            }
        }

        // Otherwise, it's an upgrade/switch
        if (plan === "FREE") {
            return {
                text: "Switch to Free",
                disabled: false,
                className: "bg-white hover:bg-gray-50 text-gray-800 border-gray-200 hover:border-gray-300 shadow-sm cursor-pointer"
            }
        } else if (plan === "ESSENTIAL") {
            return {
                text: isTestMode ? "Switch to Listener" : "Buy Now",
                disabled: false,
                className: "bg-white hover:bg-gray-50 text-gray-800 border-gray-200 hover:border-gray-300 shadow-sm cursor-pointer"
            }
        } else if (plan === "PREMIUM") {
            return {
                text: isTestMode ? "Switch to Companion" : "Upgrade to Companion",
                disabled: false,
                className: "bg-orange-500 hover:bg-orange-600 text-white shadow-sm cursor-pointer"
            }
        } else if (plan === "ORGANIZATION") {
            return {
                text: isTestMode ? "Switch to Organization" : "Contact Sales",
                disabled: false,
                className: "bg-[#0f172a] hover:bg-black text-white shadow-sm cursor-pointer"
            }
        }

        return {
            text: "Switch",
            disabled: false,
            className: "bg-white hover:bg-gray-50 text-gray-800 border-gray-200 hover:border-gray-300 shadow-sm cursor-pointer"
        }
    }

    const handleButtonClick = (plan: string) => {
        const state = getButtonState(plan)
        if (state.disabled) return

        if (isTestMode) {
            handlePlanChange(plan)
        } else {
            if (plan === "ESSENTIAL") {
                handleSubscribe("ESSENTIAL", isMonthly ? 49 : 299)
            } else if (plan === "PREMIUM") {
                handleSubscribe("PREMIUM", isMonthly ? 149 : 699)
            } else if (plan === "ORGANIZATION") {
                window.location.href = "mailto:sales@heyattrangi.com?subject=Organization Plan Inquiry"
            } else if (plan === "FREE") {
                handlePlanChange("FREE")
            }
        }
    }

    const billing = planBillingMap[currentPlan] || planBillingMap.FREE
    const isOrg = currentPlan === "ORGANIZATION"

    const handleDownloadReceipt = (txn: any) => {
        const receiptHtml = `
          <html>
            <head>
              <title>Receipt - ${txn.id}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111827; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
                .header img { height: 48px; margin-bottom: 8px; object-fit: contain; }
                .header h1 { font-size: 24px; font-weight: 900; margin: 0; color: #ea580c; display: none; }
                .header p { margin: 5px 0 0; color: #6b7280; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
                .details { margin-bottom: 40px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; border-bottom: 1px solid #f9fafb; padding-bottom: 10px; }
                .label { color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; }
                .value { font-weight: 700; }
                .total { font-size: 20px; font-weight: 900; color: #111827; margin-top: 20px; text-align: right; border-top: 2px solid #e5e7eb; padding-top: 20px; }
                .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #9ca3af; }
              </style>
            </head>
            <body>
              <div class="header">
                <img src="${window.location.origin}/images/logo-main.png" alt="Attrangi" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                <h1>Attrangi</h1>
                <p>Payment Receipt</p>
              </div>
              <div class="details">
                <div class="row">
                  <span class="label">Transaction ID</span>
                  <span class="value">${txn.id}</span>
                </div>
                <div class="row">
                  <span class="label">Date</span>
                  <span class="value">${new Date(txn.createdAt).toLocaleString()}</span>
                </div>
                <div class="row">
                  <span class="label">Service Type</span>
                  <span class="value">${txn.type === 'SUBSCRIPTION' ? 'Platform Subscription' : 'Clinical Consultation'}</span>
                </div>
                <div class="row">
                  <span class="label">Description</span>
                  <span class="value">${txn.description}</span>
                </div>
                <div class="row">
                  <span class="label">Payment Method</span>
                  <span class="value">Online / Razorpay</span>
                </div>
                <div class="row">
                  <span class="label">Status</span>
                  <span class="value" style="color: #059669;">${txn.status}</span>
                </div>
              </div>
              <div class="total">
                Total Paid: &#8377;${txn.amount.toFixed(2)}
              </div>
              <div class="footer">
                <p>Thank you for choosing Attrangi.</p>
                <p>This is a computer-generated receipt.</p>
              </div>
            </body>
          </html>
        `;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    }

    return (
        <div className="space-y-10">
            {/* Active Plan at Top */}
            <div className="bg-white rounded-[24px] p-4 sm:p-8 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-gray-50 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Plan</h2>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${isTestMode ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                        {isTestMode ? "Testing Billing Mode" : "Real Billing Mode"}
                    </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">Current subscription</p>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900">{billing.label}</h3>
                        <p className="text-sm text-gray-500 mt-1">{billing.description}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                        {billing.price}
                    </span>
                </div>
                <div className="mt-6 border-t border-gray-100 pt-5 text-sm text-gray-600 space-y-3">
                    <div className="flex justify-between">
                        <span>Billing cycle</span>
                        <span className="font-semibold text-gray-800">{getBillingCycle()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Plan type</span>
                        <span className="font-semibold text-gray-800">{billing.label}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Payment method</span>
                        <span className="font-semibold text-gray-800">{isOrg ? "Institution billing" : isTestMode ? "Test Mode (No Charge)" : "Razorpay (UPI, Cards, Netbanking)"}</span>
                    </div>
                    {getExpirationDate() && (
                        <div className="flex justify-between border-t border-gray-50 pt-3 text-orange-600 font-bold">
                            <span>Next renewal / expiration</span>
                            <span>{getExpirationDate()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Compare Plans Section Below */}
            <div className="bg-white rounded-[24px] shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-gray-50 overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 sm:p-8 border-b border-gray-50 flex flex-col items-center text-center">
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Compare plans</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Need more details before choosing?{" "}
                        <a href="/pricing" className="font-bold text-gray-900 hover:underline">
                            See feature breakdown &darr;
                        </a>
                    </p>
                    {/* Toggle Switch */}
                    <div className="inline-flex items-center gap-2 bg-gray-100 p-1.5 rounded-full border border-gray-200">
                        <button
                            onClick={() => setIsMonthly(true)}
                            className={`px-6 py-2 rounded-full font-bold text-sm transition-all duration-300 ${isMonthly ? 'bg-white text-[#0c1421] shadow-sm' : 'text-gray-500 hover:text-[#0c1421]'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsMonthly(false)}
                            className={`px-6 py-2 rounded-full font-bold text-sm transition-all duration-300 ${!isMonthly ? 'bg-white text-[#0c1421] shadow-sm' : 'text-gray-500 hover:text-[#0c1421]'}`}
                        >
                            6 Months (Save 20%)
                        </button>
                    </div>
                </div>
                <div className={`grid grid-cols-1 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 ${isTestMode ? "lg:grid-cols-4" : "lg:grid-cols-3"
                    }`}>

                    {/* Free Plan (Shown in Test Mode only) */}
                    {isTestMode && (
                        <div className="p-6 xl:p-8 flex flex-col hover:bg-gray-50/50 transition-colors">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Free</h3>
                            <div className="flex items-baseline mb-2 mt-6">
                                <span className="text-5xl font-black tracking-tight text-gray-900">₹0</span>
                            </div>
                            <p className="text-sm font-black text-teal-600 mb-6 mt-3">Default start</p>
                            <p className="text-sm text-gray-600 mb-8 min-h-[60px]">
                                Default access to core tools and limited daily AI chats.
                            </p>

                            <div className="space-y-3 mb-8 text-xs">
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Chats</span>
                                    <span className="font-bold text-gray-900">10 / day</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Analytics</span>
                                    <span className="font-bold text-gray-900">Basic</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Support</span>
                                    <span className="font-bold text-gray-900">Standard</span>
                                </div>
                            </div>

                            {(() => {
                                const btn = getButtonState("FREE")
                                return (
                                    <button
                                        onClick={() => handleButtonClick("FREE")}
                                        disabled={btn.disabled || isUpdating !== null}
                                        className={`mt-auto w-full py-3.5 px-2 text-sm lg:text-base font-extrabold rounded-xl transition-all border flex items-center justify-center gap-2 select-none ${btn.className}`}
                                    >
                                        {isUpdating === "FREE" ? (
                                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            btn.text
                                        )}
                                    </button>
                                )
                            })()}
                        </div>
                    )}

                    {/* Essential Plan */}
                    <div className="p-6 xl:p-8 flex flex-col hover:bg-gray-50/50 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">🎧 Listener</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm line-through text-gray-400 font-bold">
                                {isMonthly ? '₹149' : '₹899'}
                            </span>
                            <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                SAVE 67%
                            </span>
                        </div>
                        <div className="flex items-baseline mb-2">
                            <span className="text-5xl font-black tracking-tight text-gray-900">
                                {isMonthly ? '₹49' : '₹299'}
                            </span>
                            <span className="text-sm text-gray-500 font-medium ml-1">
                                {isMonthly ? '/mo' : '/6mo'}
                            </span>
                        </div>
                        <p className="text-sm font-black text-orange-500 mb-6">
                            {isMonthly ? 'or ₹299/6 months' : 'or ₹49/month'}
                        </p>
                        <p className="text-sm text-gray-600 mb-8 min-h-[60px]">
                            Daily check-ins, basic mood tracking, and limited voice conversations.
                        </p>

                        <div className="space-y-3 mb-8 text-xs">
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Chats</span>
                                <span className="font-bold text-gray-900">25 / day</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Voice</span>
                                <span className="font-bold text-gray-900">30 min / day</span>
                            </div>
                            <div className="flex justify-between items-center pb-1">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Memory</span>
                                <span className="font-bold text-gray-900">7-Day</span>
                            </div>
                        </div>

                        {(() => {
                            const btn = getButtonState("ESSENTIAL")
                            return (
                                <button
                                    onClick={() => handleButtonClick("ESSENTIAL")}
                                    disabled={btn.disabled || isUpdating !== null}
                                    className={`mt-auto w-full py-3.5 px-2 text-sm lg:text-base font-extrabold rounded-xl transition-all border flex items-center justify-center gap-2 select-none ${btn.className}`}
                                >
                                    {isUpdating === "ESSENTIAL" ? (
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        btn.text
                                    )}
                                </button>
                            )
                        })()}
                        <div className="text-center mt-3">
                            <span className="text-[11px] font-black text-orange-500 tracking-wide">
                                Exclusive Offers Inside
                            </span>
                        </div>
                    </div>

                    {/* Premium Plan (Recommended) */}
                    <div className="p-6 xl:p-8 flex flex-col hover:bg-gray-50/50 transition-colors relative border-2 border-orange-500 rounded-[20px] shadow-sm bg-white lg:-mt-[6px] lg:mb-0 z-10 pt-8 lg:pt-10">
                        <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm z-20 whitespace-nowrap flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                            RECOMMENDED
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">🤝 Companion</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm line-through text-gray-400 font-bold">
                                {isMonthly ? '₹599' : '₹2799'}
                            </span>
                            <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                SAVE 75%
                            </span>
                        </div>
                        <div className="flex items-baseline mb-2">
                            <span className="text-5xl font-black tracking-tight text-gray-900">
                                {isMonthly ? '₹149' : '₹699'}
                            </span>
                            <span className="text-sm text-gray-500 font-medium ml-1">
                                {isMonthly ? '/mo' : '/6mo'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-6 font-medium">
                            {isMonthly ? 'or ₹699/6 months' : 'or ₹149/month'}
                        </p>
                        <p className="text-sm text-gray-600 mb-8 min-h-[60px]">
                            Unlimited AI support, real-time insights, and long-term memory.
                        </p>

                        <div className="space-y-3 mb-8 text-xs">
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Chats</span>
                                <span className="font-bold text-gray-900">Unlimited</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Voice</span>
                                <span className="font-bold text-gray-900">Unlimited</span>
                            </div>
                            <div className="flex justify-between items-center pb-1">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Memory</span>
                                <span className="font-bold text-gray-900">Long-Term</span>
                            </div>
                        </div>

                        {(() => {
                            const btn = getButtonState("PREMIUM")
                            return (
                                <button
                                    onClick={() => handleButtonClick("PREMIUM")}
                                    disabled={btn.disabled || isUpdating !== null}
                                    className={`mt-auto w-full py-3.5 px-2 text-sm xl:text-base font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 select-none ${btn.className}`}
                                >
                                    {isUpdating === "PREMIUM" ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        btn.text
                                    )}
                                </button>
                            )
                        })()}
                        <div className="text-center mt-3">
                            <a href="/pricing" className="text-xs font-black text-gray-400 hover:text-gray-600">
                                View Premium pricing &rsaquo;
                            </a>
                        </div>
                    </div>

                    {/* Organization Plan */}
                    <div className="p-6 xl:p-8 flex flex-col hover:bg-gray-50/50 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">🏢 Organization</h3>
                        <div className="flex items-baseline mb-2 mt-6">
                            <span className="text-5xl font-black tracking-tight text-gray-900 leading-none">Custom</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-6 font-medium mt-3">Billed by institution</p>
                        <p className="text-sm text-gray-600 mb-8 min-h-[60px]">
                            College or corporate plan with organization-managed billing.
                        </p>

                        <div className="space-y-3 mb-8 text-xs">
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Users</span>
                                <span className="font-bold text-gray-900">Managed</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Admin</span>
                                <span className="font-bold text-gray-900">Portal</span>
                            </div>
                            <div className="flex justify-between items-center pb-1">
                                <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Billing</span>
                                <span className="font-bold text-gray-900">Centralized</span>
                            </div>
                        </div>

                        {(() => {
                            const btn = getButtonState("ORGANIZATION")
                            return (
                                <button
                                    onClick={() => handleButtonClick("ORGANIZATION")}
                                    disabled={btn.disabled || isUpdating !== null}
                                    className={`mt-auto w-full py-3.5 px-2 text-sm xl:text-base font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 select-none ${btn.className}`}
                                >
                                    {isUpdating === "ORGANIZATION" ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        btn.text
                                    )}
                                </button>
                            )
                        })()}
                        <div className="text-center mt-3">
                            <a href="/pricing" className="text-xs font-black text-gray-400 hover:text-gray-600">
                                View Org pricing &rsaquo;
                            </a>
                        </div>
                    </div>

                </div>
            </div>

            {/* Transaction History Section */}
            <div className="bg-white rounded-[24px] p-4 sm:p-8 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)] border border-gray-50">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
                        <p className="text-sm text-gray-500">View all your past subscription payments and transactions.</p>
                    </div>
                    <button className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF
                    </button>
                </div>

                <div className="space-y-3">
                    {isLoadingTransactions ? (
                        <div className="p-8 text-center text-gray-500">Loading transactions...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No transactions found.</div>
                    ) : (
                        transactions.map((txn, i) => (
                            <div key={i} onClick={() => setSelectedTransaction(txn)} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.type === 'SUBSCRIPTION' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}>
                                        {txn.type === 'SUBSCRIPTION' ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                                                <rect x="3" y="4" width="18" height="16" rx="2" />
                                                <path d="M7 8h10M7 12h10M7 16h10" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-900 group-hover:text-orange-600 transition-colors">{txn.description}</h4>
                                        <p className="text-xs text-gray-500 font-medium">
                                            {new Date(txn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • TXN-{txn.id.slice(-6).toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block font-bold text-sm text-gray-900">₹{txn.amount.toFixed(2)}</span>
                                    <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wide">{txn.status}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {transactions.length > 0 && (
                    <div className="mt-6 text-center pt-2">
                        <button className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors">Load More Records</button>
                    </div>
                )}
            </div>

            {/* Receipt Modal */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] max-w-md w-full p-8 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-gray-900">Payment Receipt</h3>
                                <p className="text-xs font-bold text-gray-400 mt-1">Attrangi Health</p>
                            </div>
                            <button 
                                onClick={() => setSelectedTransaction(null)}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-50 transition-all"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Transaction ID</span>
                                <span className="font-mono text-gray-900 font-bold">{selectedTransaction.id.slice(-8).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Date</span>
                                <span className="text-gray-900 font-bold">
                                    {new Date(selectedTransaction.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Description</span>
                                <span className="text-gray-900 font-bold text-right max-w-[200px] truncate">{selectedTransaction.description}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500 font-medium">Status</span>
                                <span className="text-teal-600 font-black uppercase">{selectedTransaction.status}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <span className="text-gray-900 font-medium">Total Paid</span>
                            <span className="text-3xl font-black text-gray-900">₹{selectedTransaction.amount.toFixed(2)}</span>
                        </div>

                        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setSelectedTransaction(null)}
                                className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-black rounded-xl text-sm transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleDownloadReceipt(selectedTransaction)}
                                className="flex-1 py-3 bg-[#E36D49] hover:bg-[#c95937] text-white font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
