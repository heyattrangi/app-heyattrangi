"use client"

import React, { useState } from "react"

interface Step {
  title: string
  instruction: string
  duration: string
}

const steps: readonly Step[] = [
  {
    title: "Feet",
    instruction: "Press your feet gently into the floor. Slowly shift your weight from one foot to the other, or lift one heel at a time. Just notice the small change.",
    duration: "30 sec",
  },
  {
    title: "Shoulders & Neck",
    instruction: "Roll your shoulders slowly, forward then back. Gently tilt your head side to side. Nothing should strain — keep it light.",
    duration: "30 sec",
  },
  {
    title: "Hands",
    instruction: "Open your hands wide, then slowly close them into a loose fist. Repeat a few times, noticing the sensation in your fingers and palms.",
    duration: "30 sec",
  },
  {
    title: "Waist",
    instruction: "Let your body sway gently side to side from the waist, like a soft pendulum. Keep the movement small and easy.",
    duration: "30 sec",
  },
  {
    title: "Breath Awareness",
    instruction: "Place one hand on your heart and one hand on your belly. Notice the rise and fall of your breath under your palms. Stay here for a few slow breaths.",
    duration: "1 min",
  },
]

interface MicroMovementProps {
  onBack?: () => void
  onDone?: () => void
}

export default function MicroMovement({ onBack, onDone }: MicroMovementProps = {}) {
  const [screen, setScreen] = useState<"detail" | "exercise" | "complete">("exercise")
  const [currentStep, setCurrentStep] = useState<number>(0)

  const isEmbedded = typeof window !== 'undefined' && window.location.search.includes('embedded=true')

  const handleBegin = () => {
    setScreen("exercise")
    setCurrentStep(0)
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    } else if (onBack) {
      onBack()
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      setScreen("complete")
    }
  }

  const handleDone = () => {
    if (onDone) {
      onDone()
    } else if (onBack) {
      onBack()
    } else {
      setScreen("exercise")
      setCurrentStep(0)
    }
  }

  const handleDoItAgain = () => {
    setScreen("exercise")
    setCurrentStep(0)
  }

  const activeStep = steps[currentStep]

  return (
    <div style={styles.container}>
      <style>{`
        .mm-btn {
          transition: all 0.2s ease-in-out;
        }
        .mm-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .mm-btn:active {
          transform: translateY(0);
        }
        .mm-back-link {
          transition: color 0.2s;
        }
        .mm-back-link:hover {
          color: #1e293b !important;
        }
      `}</style>

      {/* Screen 1: Detail Screen */}
      {screen === "detail" && (
        <div style={styles.card}>
          {/* Back link */}
          <div style={styles.topRow}>
            {!isEmbedded && (
            <button
              onClick={onBack}
              className="mm-back-link"
              style={styles.backLink}
            >
              ← BACK
            </button>
            )}
          </div>

          {/* Icon box */}
          <div style={styles.iconBoxContainer}>
            <div style={styles.iconBox}>
              <svg style={styles.boltIcon} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          {/* Badges */}
          <div style={styles.badgesRow}>
            <span style={styles.badge}>Grounding</span>
            <span style={styles.badge}>
              <svg style={styles.clockIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              3 min
            </span>
          </div>

          {/* Title and subtitle */}
          <h1 style={styles.title}>Micro Movement</h1>
          <p style={styles.subtitle}>Tiny, gentle movements to reconnect with your body.</p>

          {/* About section */}
          <div style={styles.sectionHeader}>ABOUT THIS ACTIVITY</div>
          <p style={styles.aboutText}>
            Small, easy movements you can do almost anywhere. A way to reconnect with your body through soft stretches and shifts, without strain or pressure.
          </p>

          {/* Info Card */}
          <div style={styles.infoCard}>
            <div style={styles.sectionHeader}>ACTIVITY INFORMATION</div>
            <div style={styles.infoGrid}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Category:</span>
                <span style={styles.infoValue}>Grounding</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Estimated Duration:</span>
                <span style={styles.infoValue}>3 min</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Difficulty:</span>
                <span style={styles.infoValue}>Gentle</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Audio Available:</span>
                <span style={styles.infoValue}>No</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Type:</span>
                <span style={styles.infoValue}>Body awareness</span>
              </div>
            </div>
          </div>

          {/* Begin button */}
          <button className="mm-btn" style={styles.beginBtn} onClick={handleBegin}>
            Begin
          </button>
        </div>
      )}

      {/* Screen 2: Exercise Screen */}
      {screen === "exercise" && (
        <div style={styles.card}>
          {/* Back link */}
          <div style={styles.topRow}>
            <button
              onClick={onBack}
              className="mm-back-link"
              style={styles.backLink}
            >
              ← BACK
            </button>
          </div>

          {/* Progress Dots */}
          <div style={styles.progressContainer}>
            {steps.map((_, idx) => {
              let dotStyle = { ...styles.dot }
              if (idx === currentStep) {
                dotStyle = { ...dotStyle, ...styles.dotActive }
              } else if (idx < currentStep) {
                dotStyle = { ...dotStyle, ...styles.dotCompleted }
              } else {
                dotStyle = { ...dotStyle, ...styles.dotUpcoming }
              }
              return <div key={idx} style={dotStyle} />
            })}
          </div>

          {/* Step content */}
          <div style={styles.stepContent}>
            <div style={styles.stepCount}>
              {currentStep + 1} / {steps.length}
            </div>
            <h2 style={styles.stepTitle}>{activeStep.title}</h2>
            <div style={styles.durationBadge}>
              <svg style={styles.clockIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {activeStep.duration}
            </div>
            <p style={styles.instruction}>{activeStep.instruction}</p>
          </div>

          {/* Navigation Buttons */}
          <div style={styles.navRow}>
            <button
              className="mm-btn"
              style={styles.secondaryBtn}
              onClick={handleBack}
            >
              Back
            </button>
            <button className="mm-btn" style={styles.primaryBtn} onClick={handleNext}>
              {currentStep === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      )}

      {/* Screen 3: Complete Screen */}
      {screen === "complete" && (
        <div style={styles.card}>
          <div style={styles.completeContent}>
            <div style={styles.iconContainer}>
              <span style={styles.icon}>🌿</span>
            </div>
            <h1 style={styles.completeTitle}>Nice work.</h1>
            <p style={styles.completeText}>
              You've moved gently through your body. Notice how you feel right now before moving on.
            </p>
            <div style={styles.completeButtons}>
              <button className="mm-btn" style={styles.secondaryBtn} onClick={handleDone}>
                Done
              </button>
              <button className="mm-btn" style={styles.primaryBtn} onClick={handleDoItAgain}>
                Do It Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
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
  boltIcon: {
    width: "22px",
    height: "22px",
    color: "#16a34a", // Green bolt
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
    backgroundColor: "#f8fafc", // White rounded activity info card styling
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
  progressContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "32px",
    justifyContent: "center",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    transition: "all 0.3s ease",
  },
  dotActive: {
    backgroundColor: "#4a90a4",
    transform: "scale(1.25)",
  },
  dotCompleted: {
    backgroundColor: "#82b7c6",
  },
  dotUpcoming: {
    backgroundColor: "#e2e8f0",
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    flex: 1,
    marginBottom: "32px",
  },
  stepCount: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#ea580c",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "6px",
  },
  stepTitle: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 10px 0",
    lineHeight: "1.25",
  },
  durationBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#fff7ed",
    color: "#c2410c",
    fontSize: "12px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "12px",
    marginBottom: "20px",
  },
  instruction: {
    fontSize: "16px",
    color: "#334155",
    lineHeight: "1.6",
    margin: "0",
  },
  navRow: {
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
  disabledBtn: {
    minWidth: "100px",
    padding: "12px 20px",
    backgroundColor: "#f1f5f9",
    color: "#94a3b8",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "not-allowed",
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
