"use client";

import { useState, useEffect } from "react";

const GUMROAD_YEARLY_URL =
  process.env.NEXT_PUBLIC_GUMROAD_YEARLY_URL ?? "https://chorded.gumroad.com/l/1year";

// Launch Sale expiration date: Nov 1st, 2026 at 01:00:00 AM (ends after Oct 31st midnight hour)
const SALE_END_DATE = new Date("2026-11-01T01:00:00");

interface FeatureItemProps {
  text: string;
  included: boolean;
  highlighted?: boolean;
}

function FeatureItem({ text, included, highlighted = false }: FeatureItemProps) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <span
          className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${highlighted ? "text-blue-300" : "text-emerald-400"
            }`}
        >
          check_circle
        </span>
      ) : (
        <span className="material-symbols-outlined text-base mt-0.5 shrink-0 text-red-400/60">
          cancel
        </span>
      )}
      <span
        className={`text-body-md ${included
          ? "text-blue-50"
          : "text-blue-200/50 line-through decoration-blue-300/30"
          }`}
      >
        {text}
      </span>
    </li>
  );
}

export default function Pricing() {
  const [isSaleActive, setIsSaleActive] = useState<boolean>(true);

  useEffect(() => {
    const checkSaleStatus = () => {
      setIsSaleActive(new Date() < SALE_END_DATE);
    };
    checkSaleStatus();
    const interval = setInterval(checkSaleStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="pricing"
      className="w-full py-section-gap bg-gradient-to-b from-[#12194d] via-[#172259] to-[#0f163d] relative overflow-hidden border-t border-blue-400/20"
      aria-labelledby="pricing-heading"
    >
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/15 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-container-max-width mx-auto px-margin-edge flex flex-col items-center gap-12 relative z-10">
        <div className="flex flex-col items-center gap-4 text-center max-w-2xl">
          <span className="text-label-md font-semibold tracking-widest uppercase text-blue-200 bg-blue-500/20 border border-blue-400/30 px-4 py-1.5 rounded-full shadow-sm">
            Pricing Plans
          </span>
          <h2
            id="pricing-heading"
            className="text-headline-lg font-bold text-white"
          >
            Simple, Transparent Pricing
          </h2>
          <p className="text-body-lg text-blue-100/80">
            Choose the plan that fits your music workflow — start free or upgrade to ChordedPro for full power.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl items-stretch">
          {/* FREEMIUM PLAN */}
          <div className="relative flex flex-col rounded-3xl p-8 gap-6 bg-[#0f1638]/80 border border-blue-400/20 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/40">
            <div className="flex flex-col gap-2">
              <span className="text-label-md font-semibold tracking-widest uppercase text-blue-300">
                Freemium
              </span>
              <div className="flex items-end gap-2">
                <span className="text-display-lg font-bold text-white">
                  $0
                </span>
                <span className="text-body-md text-blue-200/70 mb-2">
                  / free forever
                </span>
              </div>
              <p className="text-body-md text-blue-100/80">
                Essential tools for formatting and transposing chord charts on desktop.
              </p>
            </div>

            <div className="border-t border-blue-400/20" />

            <div className="flex flex-col gap-4 flex-grow">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-3 block">
                  Features
                </span>
                <ul className="flex flex-col gap-3">
                  <FeatureItem text="Smart Paste & Auto Formatting" included={true} />
                  <FeatureItem text="Real-time Key Transposition" included={true} />
                  <FeatureItem text="10 PDF / JPG exports per month" included={true} />
                  <FeatureItem text="10 saved .crd song files per month" included={true} />
                  <FeatureItem text="1 active setlist draft" included={true} />
                  <FeatureItem text="Nashville Number System" included={false} />
                  <FeatureItem text="Lyrics Only View" included={false} />
                  <FeatureItem text="Find & Replace Chords" included={false} />
                </ul>
              </div>

              {/* ONLINE SETLIST BUILDER LOCKED COUNTERPART HIGHLIGHT */}
              <div className="p-4 rounded-2xl bg-blue-950/60 border border-blue-400/20 flex flex-col gap-2 mt-1 opacity-80">
                <div className="flex items-center gap-2 text-red-300 font-semibold text-xs tracking-wider uppercase">
                  <span className="material-symbols-outlined text-sm text-red-400">lock</span>
                  <span>Pro Feature Locked</span>
                </div>
                <p className="text-body-md text-blue-200/60 font-medium leading-snug line-through decoration-blue-300/40">
                  Create setlists online and host your live show right from your phone, tablet, or iPad.
                </p>
              </div>
            </div>

            <a
              href="#hero"
              id="pricing-cta-freemium"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-label-md tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200 hover:scale-95 active:scale-100 shadow-md"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download Freemium
            </a>
          </div>

          {/* CHORDED PRO PLAN */}
          <div
            className={`relative flex flex-col rounded-3xl p-8 gap-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${
              isSaleActive
                ? "bg-gradient-to-b from-[#231b57]/95 via-[#1a2266]/95 to-[#121a4d]/95 border-2 border-amber-400/80 shadow-2xl shadow-amber-500/20 hover:shadow-amber-400/35 hover:border-amber-300"
                : "bg-gradient-to-b from-[#1d2a6b]/90 to-[#121c4d]/90 border-2 border-blue-400 shadow-2xl shadow-blue-500/25 hover:shadow-blue-400/40 hover:border-blue-300"
            }`}
          >
            {/* TOP BADGE */}
            {isSaleActive ? (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-max">
                <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 text-xs font-extrabold px-4 py-1 rounded-full tracking-wide shadow-lg shadow-orange-500/30 uppercase border border-amber-200 animate-pulse">
                  <span className="material-symbols-outlined text-sm">local_fire_department</span>
                  Launch Sale — Save $10
                </span>
              </div>
            ) : (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wide shadow-lg uppercase border border-blue-300/40">
                1-Year Full Access
              </span>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-label-md font-semibold tracking-widest uppercase text-blue-300">
                  ChordedPro
                </span>
                {isSaleActive && (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    Save 33%
                  </span>
                )}
              </div>

              {/* PRICE DISPLAY */}
              {isSaleActive ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base text-blue-200/50 line-through decoration-rose-400 decoration-2 font-bold">
                      $29.99
                    </span>
                    <span className="text-xs font-medium text-amber-200/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-400/20">
                      Launch Special
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-display-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-100 to-white">
                      $19.99
                    </span>
                    <span className="text-body-md text-blue-200/80 mb-2">
                      / 1 year license
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <span className="text-display-lg font-bold text-white">
                    $29.99
                  </span>
                  <span className="text-body-md text-blue-200/80 mb-2">
                    / 1 year license
                  </span>
                </div>
              )}

              <p className="text-body-md text-blue-100">
                Unlock all features, unlimited saves & live online setlist stage runner.
              </p>
            </div>

            {/* LAUNCH SALE TIMED BANNER */}
            {isSaleActive && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 border border-amber-400/30 flex items-center gap-2 text-amber-200 text-xs">
                <span className="material-symbols-outlined text-amber-400 text-base shrink-0">timer</span>
                <span>Launch price available through <strong>October 31</strong></span>
              </div>
            )}

            <div className="border-t border-blue-400/30" />

            <div className="flex flex-col gap-4 flex-grow">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-3 block">
                  All Features Unlocked
                </span>
                <ul className="flex flex-col gap-3">
                  <FeatureItem text="Smart Paste & Auto Formatting" included={true} highlighted={true} />
                  <FeatureItem text="Real-time Key Transposition" included={true} highlighted={true} />
                  <FeatureItem text="Unlimited PDF / JPG Exports" included={true} highlighted={true} />
                  <FeatureItem text="Unlimited Saved .crd Songs & Cloud Sync" included={true} highlighted={true} />
                  <FeatureItem text="Full Setlist Builder & Unlimited Setlists" included={true} highlighted={true} />
                  <FeatureItem text="Nashville Number System" included={true} highlighted={true} />
                  <FeatureItem text="Lyrics Only View" included={true} highlighted={true} />
                  <FeatureItem text="Find & Replace Chords" included={true} highlighted={true} />
                </ul>
              </div>

              {/* ONLINE SETLIST BUILDER EXCLUSIVE FEATURE HIGHLIGHT */}
              <div className="p-4 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-2 text-blue-200 font-semibold text-xs tracking-wider uppercase">
                  <span className="material-symbols-outlined text-sm text-blue-300">cell_tower</span>
                  <span>Pro Live Web Sync</span>
                </div>
                <p className="text-body-md text-white font-medium leading-snug">
                  Create setlists online and host your live show right from your phone, tablet, or iPad.
                </p>
              </div>
            </div>

            <a
              href={GUMROAD_YEARLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="pricing-cta-chordedpro"
              className={`mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-bold text-label-md tracking-wide transition-all duration-200 hover:scale-95 active:scale-100 ${
                isSaleActive
                  ? "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-orange-300 shadow-xl shadow-orange-500/25"
                  : "bg-gradient-to-r from-blue-400 to-blue-500 text-slate-950 hover:from-blue-300 hover:to-blue-400 shadow-xl shadow-blue-500/30"
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {isSaleActive ? "rocket_launch" : "verified"}
              </span>
              {isSaleActive ? "Claim Launch Sale — $19.99" : "Get ChordedPro (1-Year Pass)"}
            </a>
          </div>
        </div>

        <p className="text-label-sm text-blue-200/70 text-center max-w-xl">
          Payments processed securely via{" "}
          <span className="text-white font-medium">Gumroad</span>. Your license key activates all features instantly for 1 full year.
        </p>
      </div>
    </section>
  );
}


