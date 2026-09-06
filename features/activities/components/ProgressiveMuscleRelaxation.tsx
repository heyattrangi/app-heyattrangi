"use client"

import React, { useState } from "react"

interface MuscleStep {
  name: string
  tense: string
  release: string
}

const steps: readonly MuscleStep[] = [
  {
    name: "Feet",
    tense: "Curl your toes tightly and tense your feet.",
    release: "Let your feet go completely loose. Notice the difference.",
  },
  {
    name: "Calves",
    tense: "Point your toes up toward you, tightening your calves.",
    release: "Let your calves fully relax.",
  },
  {
    name: "Thighs",
    tense: "Squeeze your thigh muscles tight.",
    release: "Let your thighs go soft and heavy.",
  },
  {
    name: "Glutes",
    tense: "Clench your glutes.",
    release: "Release and let go.",
  },
  {
    name: "Abdomen",
    tense: "Tighten your stomach muscles.",
    release: "Let your belly soften completely.",
  },
  {
    name: "Hands & Forearms",
    tense: "Make tight fists and tense your forearms.",
    release: "Let your hands go completely limp.",
  },
  {
    name: "Upper Arms",
    tense: "Bend your elbows and tense your biceps.",
    release: "Let your arms fall loose.",
  },
  {
    name: "Shoulders",
    tense: "Raise your shoulders up toward your ears.",
    release: "Let them drop and relax.",
  },
  {
    name: "Neck",
    tense: "Gently press your head back and tense your neck.",
    release: "Let your neck go soft.",
  },
  {
    name: "Face",
    tense: "Scrunch your whole face — eyes, forehead, jaw.",
    release: "Let your face go completely smooth and relaxed.",
  },
]

interface ProgressiveMuscleRelaxationProps {
  onBack?: () => void
  onDone?: () => void
}

export default function ProgressiveMuscleRelaxation({
  onBack,
  onDone,
}: ProgressiveMuscleRelaxationProps = {}) {
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
    } else {
      setScreen("detail")
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
        .pmr-btn {
          transition: all 0.2s ease-in-out;
        }
        .pmr-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .pmr-btn:active {
          transform: translateY(0);
        }
        .pmr-back-link {
          transition: color 0.2s;
        }
        .pmr-back-link:hover {
          color: #1e293b !important;
        }
      `}</style>

      {/* Detail Screen */}
      {screen === "detail" && (
        <div style={styles.card}>
          <div style={styles.topRow}>
            {!isEmbedded && (
            <button onClick={onBack} className="pmr-back-link" style={styles.backLink}>
              ← BACK
            </button>
            )}
          </div>

          <div style={styles.iconBoxContainer}>
            <div style={styles.iconBox}>
              <svg style={styles.bodyIcon} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

          <div style={styles.badgesRow}>
            <span style={styles.badge}>Relaxation</span>
            <span style={styles.badge}>
              <svg style={styles.clockIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              8 min
            </span>
          </div>

          <h1 style={styles.title}>Progressive Muscle Relaxation</h1>
          <p style={styles.subtitle}>Tense and release each muscle group to let go of physical tension.</p>

          <div style={styles.sectionHeader}>ABOUT THIS ACTIVITY</div>
          <p style={styles.aboutText}>
            A structured technique where you tense each muscle group briefly, then release it — helping your body learn the difference between tension and relaxation.
          </p>

          <div style={styles.infoCard}>
            <div style={styles.sectionHeader}>ACTIVITY INFORMATION</div>
            <div style={styles.infoGrid}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Category:</span>
                <span style={styles.infoValue}>Relaxation</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Estimated Duration:</span>
                <span style={styles.infoValue}>8 min</span>
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
                <span style={styles.infoValue}>Muscle relaxation</span>
              </div>
            </div>
          </div>

          <button className="pmr-btn" style={styles.beginBtn} onClick={handleBegin}>
            Begin
          </button>
        </div>
      )}

      {/* Exercise Screen */}
      {screen === "exercise" && (
        <div style={styles.card}>
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

          <div style={styles.stepContent}>
            <div style={styles.stepCount}>
              {currentStep + 1} / {steps.length}
            </div>
            <h2 style={styles.stepTitle}>{activeStep.name}</h2>

            <div style={styles.subCardsContainer}>
              {/* Tense Card */}
              <div style={styles.tenseSubCard}>
                <span style={styles.tenseBadge}>1. Tense</span>
                <p style={styles.instructionText}>{activeStep.tense}</p>
              </div>

              {/* Release Card */}
              <div style={styles.releaseSubCard}>
                <span style={styles.releaseBadge}>2. Release</span>
                <p style={styles.instructionText}>{activeStep.release}</p>
              </div>
            </div>
          </div>

          <div style={styles.navRow}>
            <button
              className="pmr-btn"
              style={styles.secondaryBtn}
              onClick={handleBack}
            >
              Back
            </button>
            <button className="pmr-btn" style={styles.primaryBtn} onClick={handleNext}>
              {currentStep === steps.length - 1 ? "Finish" : "Next"}
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
              You've released tension through your whole body. Take a moment to notice how relaxed you feel.
            </p>
            <div style={styles.completeButtons}>
              <button className="pmr-btn" style={styles.secondaryBtn} onClick={handleDone}>
                Done
              </button>
              <button className="pmr-btn" style={styles.primaryBtn} onClick={handleDoItAgain}>
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
  bodyIcon: {
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
  progressContainer: {
    display: "flex",
    gap: "6px",
    marginBottom: "32px",
    justifyContent: "center",
  },
  dot: {
    width: "6px",
    height: "6px",
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
    width: "100%",
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
    margin: "0 0 20px 0",
    lineHeight: "1.25",
  },
  subCardsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
  },
  tenseSubCard: {
    backgroundColor: "#fff7ed", // Light orange background
    border: "1px solid #ffedd5",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "left",
    boxSizing: "border-box",
  },
  tenseBadge: {
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    color: "#c2410c",
    display: "inline-block",
    marginBottom: "8px",
  },
  releaseSubCard: {
    backgroundColor: "#f0fdf4", // Light green background
    border: "1px solid #dcfce7",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "left",
    boxSizing: "border-box",
  },
  releaseBadge: {
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    color: "#16a34a",
    display: "inline-block",
    marginBottom: "8px",
  },
  instructionText: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#334155",
    margin: "0",
    lineHeight: "1.5",
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
