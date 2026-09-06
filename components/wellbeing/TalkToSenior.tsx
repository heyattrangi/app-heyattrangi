"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface TalkToSeniorProps {
  isOpen: boolean
  onClose: () => void
}

const seniorContacts = [
  {
    name: "Dr. Sandesh Sanjeev Phalke",
    description: "",
    phone: "9552324069",
    displayPhone: "95523 24069",
  },
  {
    name: "Bharath Reddy",
    description: "",
    phone: "7995736278",
    displayPhone: "7995736278",
  },
  {
    name: "Charan",
    description: "",
    phone: "6305010250",
    displayPhone: "6305010250",
  },
  {
    name: "Kalyan jakkoju",
    description: "",
    phone: "8179004171",
    displayPhone: "8179004171",
  },
  {
    name: "Lakshmi Prasad",
    description: "",
    phone: "9347479413",
    displayPhone: "9347479413",
  },
]

export default function TalkToSenior({ isOpen, onClose }: TalkToSeniorProps) {
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleCopy = (phone: string, name: string) => {
    navigator.clipboard.writeText(phone)
    setCopiedPhone(phone)
    toast.success(`${name}'s phone number copied to clipboard!`)
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />

          {/* Modal Content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="talk-to-senior-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-white rounded-[32px] border border-pink-100/50 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 max-h-[85vh] overflow-y-auto no-scrollbar z-10"
          >
            {/* Close button in top right */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="space-y-1.5 text-left pr-8">
              <h2
                id="talk-to-senior-title"
                className="font-extrabold text-[24px] sm:text-[28px] text-slate-800 tracking-tight leading-tight"
              >
                Talk to a Senior
              </h2>
              <p className="font-sans font-medium text-slate-500 text-sm sm:text-base leading-relaxed">
                Connect with someone from our senior support team.
              </p>
            </div>

            {/* Contact list container */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-1 animate-in fade-in duration-200">
              {seniorContacts.map((contact) => {
                const isCopied = copiedPhone === contact.phone
                return (
                  <div
                    key={contact.phone}
                    className="bg-white border border-slate-100 hover:border-slate-200/80 rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 shadow-[0_4px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.03)]"
                  >
                    <div className="text-left space-y-1">
                      <h3 className="font-extrabold text-[16px] sm:text-[17px] text-slate-800 tracking-tight leading-snug">
                        {contact.name}
                      </h3>
                      {/* Description Area (keep ready, hidden or empty if empty string) */}
                      {contact.description ? (
                        <p className="text-xs text-slate-500 font-medium">
                          {contact.description}
                        </p>
                      ) : (
                        <div className="h-0" />
                      )}
                    </div>

                    {/* Contact Actions Button Group */}
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      {/* Call button */}
                      <a
                        href={`tel:${contact.phone}`}
                        title={`Call ${contact.name}`}
                        className="inline-flex items-center justify-center gap-2 bg-[#1A1A2E] hover:bg-[#2A2A3F] text-white px-4 py-2.5 rounded-full text-xs font-black transition-all duration-200 active:scale-95 shadow-sm shadow-black/5 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{contact.displayPhone}</span>
                      </a>

                      {/* Copy button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(contact.phone, contact.name)}
                        title={`Copy ${contact.name}'s phone number`}
                        className={`inline-flex items-center justify-center p-2.5 rounded-full transition-all duration-200 active:scale-95 border cursor-pointer ${
                          isCopied
                            ? "bg-green-50 border-green-200 text-green-600"
                            : "bg-slate-50 border-slate-100 hover:bg-slate-100 hover:text-slate-800 text-slate-500"
                        }`}
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 animate-in zoom-in duration-150" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <hr className="border-slate-100" />

            {/* Bottom Actions Row */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 active:scale-[0.97] text-slate-700 text-sm font-extrabold px-6 py-3 rounded-full shadow-sm transition-all text-center select-none cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

