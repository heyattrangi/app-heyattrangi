"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"

function AttrangiLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <div className="w-7.5 h-7.5 grid grid-cols-2 grid-rows-2 gap-[2px] shrink-0">
        <div className="bg-[#FFC107] rounded-tl-[3.5px]" />
        <div className="bg-[#FF5252] rounded-tr-[3.5px]" />
        <div className="bg-[#FF9800] rounded-bl-[3.5px]" />
        <div className="bg-[#E64A19] rounded-br-[3.5px]" />
      </div>
      <span className="font-extrabold text-[21px] sm:text-[22px] tracking-tight text-gray-900 font-sans">
        Hey Attrangi
      </span>
    </div>
  )
}

export default function RedesignedIndividualAuthPage() {
  return (
    <div className="min-h-screen w-full bg-white flex flex-col justify-between font-sans select-none relative overflow-x-hidden">
      
      {/* Centered responsive viewport container */}
      <div className="w-full max-w-[450px] mx-auto flex-grow flex flex-col justify-between min-h-screen bg-white relative">
        
        {/* Floating Back Navigation Button */}
        <Link
          href="/auth"
          aria-label="Back"
          className="absolute left-5 top-5 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200/80 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm text-slate-700 cursor-pointer z-20"
        >
          <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Top Hero Image Section - styled as a floating card matching Image 1 */}
        <div className="px-3 pt-3 shrink-0 w-full">
          <div className="relative w-full h-[280px] sm:h-[320px] overflow-hidden rounded-t-[32px]">
            <Image
              src="https://res.cloudinary.com/dxoiluua8/image/upload/v1786967400/welcome_ndizse.png"
              alt="Hey Attrangi student wellbeing welcome illustration"
              fill
              priority
              className="object-cover object-center rounded-t-[32px]"
            />
          </div>
        </div>

        {/* Middle Content Section */}
        <div className="flex-grow flex flex-col items-center px-6 py-4 text-center justify-center gap-3.5">
          
          {/* Logo Branding Row */}
          <AttrangiLogo />

          {/* Wellbeing Heading */}
          <h2 className="font-extrabold text-[13px] sm:text-[14px] text-[#1E1E1E] tracking-tight text-center">
            Built for student wellbeing
          </h2>

          {/* Incubation Container */}
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <p className="text-[11px] sm:text-[12px] font-medium text-slate-500 tracking-normal text-center">
              Aatrangi is incubated at
            </p>

            {/* IDRP Logo Display */}
            <div className="flex items-center justify-center shrink-0 mt-0.5">
              <Image
                src="https://res.cloudinary.com/dxoiluua8/image/upload/v1786820584/IDRP_hk4gpn.png"
                alt="IIT Dharwad Research Park logo"
                width={230}
                height={68}
                className="w-auto h-14 sm:h-16 object-contain"
                priority
              />
            </div>
          </div>

        </div>

        {/* Bottom CTA Action Buttons */}
        <div className="px-6 pb-10 pt-2 flex flex-col gap-3 shrink-0">
          
          {/* Primary CTA: Create Account */}
          <Link href="/auth/signup" className="w-full block">
            <button
              aria-label="Create an account"
              className="w-full bg-[#E08053] hover:bg-[#D07043] active:scale-98 text-white py-4.5 rounded-full font-bold text-[16px] sm:text-[17px] tracking-tight shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer text-center font-sans"
            >
              Create an account
            </button>
          </Link>

          {/* Secondary CTA: Login */}
          <Link href="/auth/signin" className="w-full block">
            <button
              aria-label="Log in"
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 active:scale-98 text-slate-800 py-4.5 rounded-full font-bold text-[16px] sm:text-[17px] tracking-tight shadow-sm transition-all duration-200 cursor-pointer text-center font-sans"
            >
              Log in
            </button>
          </Link>

        </div>

      </div>

    </div>
  )
}
