"use client"

import React, { useState, useEffect, useRef } from "react"

interface BellyBreathingProps {
  onBack?: () => void
  onDone?: () => void
}

type Phase = "inhale" | "hold" | "exhale"

export default function BellyBreathing({
  onBack,
  onDone,
}: BellyBreathingProps = {}) {
  const [screen, setScreen] = useState<"detail" | "exercise" | "complete">("detail")
  const [cycle, setCycle] = useState<number>(1)
  const [phase, setPhase] = useState<Phase>("inhale")
  const [secondsRemaining, setSecondsRemaining] = useState<number>(4)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const isEmbedded = typeof window !== 'undefined' && window.location.search.includes('embedded=true')


  // Ref to hold the current phase value for the timer callback to avoid closure staleness
  const phaseRef = useRef<Phase>(phase)
  const cycleRef = useRef<number>(cycle)
  const isPausedRef = useRef<boolean>(isPaused)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    cycleRef.current = cycle
  }, [cycle])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const handleBegin = () => {
    setScreen("exercise")
    setCycle(1)
    setPhase("inhale")
    setSecondsRemaining(4)
    setIsPaused(false)
  }

  const handlePauseToggle = () => {
    setIsPaused((prev) => !prev)
  }

  const handleEndEarly = () => {
    setScreen("complete")
  }

  const handleDone = () => {
    if (onDone) {
      onDone()
    } else {
      setScreen("detail")
    }
  }

  const handleDoItAgain = () => {
    handleBegin()
  }

  // Paced Breathing Timer Loop
  useEffect(() => {
    if (screen !== "exercise") return

    const timer = setInterval(() => {
      if (isPausedRef.current) return

      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Transition phase
          let nextPhase: Phase = "inhale"
          let nextSec = 4

          if (phaseRef.current === "inhale") {
            nextPhase = "hold"
            nextSec = 4
          } else if (phaseRef.current === "hold") {
            nextPhase = "exhale"
            nextSec = 6
          } else {
            // Exhale is complete, start new cycle
            if (cycleRef.current >= 5) {
              clearInterval(timer)
              setScreen("complete")
              return 0
            }
            setCycle((c) => c + 1)
            nextPhase = "inhale"
            nextSec = 4
          }

          setPhase(nextPhase)
          return nextSec
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [screen])

  // Get Phase visual styling & label
  const getPhaseInfo = () => {
    if (phase === "inhale") {
      return {
        label: "Breathe in...",
        transform: "scale(1.6)",
        transition: "transform 4s ease-in-out",
        color: "#c2410c",
      }
    }
    if (phase === "hold") {
      return {
        label: "Hold...",
        transform: "scale(1.6)",
        transition: "none",
        color: "#b45309",
      }
    }
    // exhale
    return {
      label: "Breathe out...",
      transform: "scale(1.0)",
      transition: "transform 6s ease-in-out",
      color: "#047857",
    }
  }

  const phaseInfo = getPhaseInfo()

  return (
    <div style={styles.container}>
      <style>{`
        .bb-btn {
          transition: all 0.2s ease-in-out;
        }
        .bb-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .bb-btn:active {
          transform: translateY(0);
        }
        .bb-back-link {
          transition: color 0.2s;
        }
        .bb-back-link:hover {
          color: #1e293b !important;
        }
      `}</style>

      {/* Detail Screen */}
      {screen === "detail" && (
        <div style={styles.card}>
          <div style={styles.topRow}>
            {!isEmbedded && (
            <button onClick={onBack} className="bb-back-link" style={styles.backLink}>
              ← BACK
            </button>
            )}
          </div>

          <div style={styles.iconBoxContainer}>
            <div style={styles.iconBox}>
              <svg style={styles.windIcon} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16M4 14h12M4 18h8" strokeDasharray="3 3" />
              </svg>
            </div>
          </div>

          <div style={styles.badgesRow}>
            <span style={styles.badge}>Breathing</span>
            <span style={styles.badge}>
              <svg style={styles.clockIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              4 min
            </span>
          </div>

          <h1 style={styles.title}>Belly Breathing</h1>
          <p style={styles.subtitle}>Slow, deep breaths to calm your body.</p>

          <div style={styles.sectionHeader}>ABOUT THIS ACTIVITY</div>
          <p style={styles.aboutText}>
            Breathe deeply into your belly instead of your chest. This slows your heart rate and signals your body it's safe to relax.
          </p>

          <div style={styles.infoCard}>
            <div style={styles.sectionHeader}>ACTIVITY INFORMATION</div>
            <div style={styles.infoGrid}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Category:</span>
                <span style={styles.infoValue}>Breathing</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Estimated Duration:</span>
                <span style={styles.infoValue}>4 min</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Difficulty:</span>
                <span style={styles.infoValue}>Easy</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Audio Available:</span>
                <span style={styles.infoValue}>No</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Type:</span>
                <span style={styles.infoValue}>Paced breathing</span>
              </div>
            </div>
          </div>

          <button className="bb-btn" style={styles.beginBtn} onClick={handleBegin}>
            Begin
          </button>
        </div>
      )}

      {/* Exercise Screen */}
      {screen === "exercise" && (
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <span style={styles.cycleCounter}>Breath {cycle} of 5</span>
            <span style={{ ...styles.countdownText, color: phaseInfo.color }}>
              {secondsRemaining}s
            </span>
          </div>

          <div style={styles.circleContainer}>
            <div
              style={{
                ...styles.breathingCircle,
                transform: phaseInfo.transform,
                transition: isPaused ? "none" : phaseInfo.transition,
                backgroundColor: phase === "inhale" ? "#ffedd5" : phase === "hold" ? "#fef3c7" : "#d1fae5",
                borderColor: phase === "inhale" ? "#ea580c" : phase === "hold" ? "#d97706" : "#059669",
              }}
            >
              <span style={{ ...styles.circleLabel, color: phaseInfo.color }}>
                {phaseInfo.label}
              </span>
            </div>
          </div>

          <div style={styles.controlsRow}>
            <button className="bb-btn" style={styles.secondaryBtn} onClick={handlePauseToggle}>
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button className="bb-btn" style={styles.endBtn} onClick={handleEndEarly}>
              End Session
            </button>
          </div>
        </div>
      )}

      {/* Complete Screen */}
      {screen === "complete" && (
        <div style={styles.card}>
          <div style={styles.completeContent}>
            <div style={styles.iconContainer}>
              <span style={styles.icon}>🌿</span>
            </div>
            <h1 style={styles.completeTitle}>Nice work.</h1>
            <p style={styles.completeText}>
              You've completed 5 rounds of belly breathing. Notice how your body feels now compared to when you started.
            </p>
            <div style={styles.completeButtons}>
              <button className="bb-btn" style={styles.secondaryBtn} onClick={handleDone}>
                Done
              </button>
              <button className="bb-btn" style={styles.primaryBtn} onClick={handleDoItAgain}>
                Do It Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.footer}>
        If anxiety is a frequent or intense struggle, consider talking to a therapist or counselor.
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "24px 16px",
    boxSizing: "border-box",
    backgroundColor: "#fdf1ee", // Soft pink/cream background
    minHeight: "100dvh",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
    border: "1px solid #f1f5f9",
    padding: "36px 32px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    minHeight: "440px",
  },
  topRow: {
    display: "flex",
    width: "100%",
    marginBottom: "20px",
  },
  backLink: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0",
    letterSpacing: "0.05em",
  },
  iconBoxContainer: {
    display: "flex",
    marginBottom: "16px",
  },
  iconBox: {
    width: "48px",
    height: "48px",
    backgroundColor: "#f0fdf4", // Light green background
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  windIcon: {
    width: "22px",
    height: "22px",
    color: "#16a34a",
  },
  badgesRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: "20px",
  },
  clockIcon: {
    width: "14px",
    height: "14px",
    color: "#64748b",
  },
  title: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 8px 0",
    lineHeight: "1.2",
    textAlign: "left",
  },
  subtitle: {
    fontSize: "15px",
    color: "#64748b",
    margin: "0 0 24px 0",
    lineHeight: "1.5",
    fontWeight: 500,
    textAlign: "left",
  },
  sectionHeader: {
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.1em",
    color: "#94a3b8",
    marginBottom: "8px",
    textTransform: "uppercase",
    textAlign: "left",
  },
  aboutText: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: "1.6",
    margin: "0 0 24px 0",
    textAlign: "left",
  },
  infoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "28px",
  },
  infoGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    lineHeight: "1.4",
  },
  infoLabel: {
    color: "#64748b",
    fontWeight: 500,
  },
  infoValue: {
    color: "#1e293b",
    fontWeight: 700,
  },
  beginBtn: {
    width: "100%",
    padding: "14px 24px",
    backgroundColor: "#4a90a4", // Full-width brand teal Begin button
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(74, 144, 164, 0.2)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: "24px",
  },
  cycleCounter: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#4a90a4",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  countdownText: {
    fontSize: "14px",
    fontWeight: 700,
  },
  circleContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "40px 0",
  },
  breathingCircle: {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    borderWidth: "4px",
    borderStyle: "solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  circleLabel: {
    fontSize: "14px",
    fontWeight: 700,
    textAlign: "center",
  },
  controlsRow: {
    display: "flex",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginTop: "auto",
  },
  primaryBtn: {
    minWidth: "120px",
    padding: "12px 24px",
    backgroundColor: "#4a90a4",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgba(74, 144, 164, 0.2)",
  },
  secondaryBtn: {
    minWidth: "100px",
    padding: "12px 20px",
    backgroundColor: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  endBtn: {
    minWidth: "120px",
    padding: "12px 20px",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.2)",
  },
  completeContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  iconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "64px",
    height: "64px",
    backgroundColor: "#f0fdf4",
    borderRadius: "50%",
    marginBottom: "20px",
  },
  icon: {
    fontSize: "32px",
  },
  completeTitle: {
    fontSize: "26px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 12px 0",
  },
  completeText: {
    fontSize: "15px",
    color: "#475569",
    margin: "0 0 28px 0",
    lineHeight: "1.6",
  },
  completeButtons: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    width: "100%",
  },
  footer: {
    marginTop: "16px",
    fontSize: "12px",
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: "400px",
    lineHeight: "1.5",
  },
}
