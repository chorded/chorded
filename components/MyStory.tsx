import React from "react";
import Image from "next/image";

export default function MyStory() {
  return (
    <section
      id="story"
      className="w-full py-section-gap bg-surface relative overflow-hidden border-t border-white/5"
      aria-labelledby="story-heading"
    >
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-margin-edge relative z-10">
        {/* Section Header */}
        <div className="flex flex-col items-center gap-3 text-center mb-10 md:mb-14">
          <span className="inline-flex items-center gap-2 text-label-md font-semibold tracking-widest uppercase text-primary bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full shadow-sm">
            My Story
          </span>
          <h2
            id="story-heading"
            className="text-headline-lg md:text-4xl font-bold text-on-surface tracking-tight"
          >
            In sync, on stage, and ready to play
          </h2>
          <p className="text-body-md text-on-surface-variant max-w-xl">
            How CHORDED was built from the perspective of a music director.
          </p>
        </div>

        {/* Story Content Card */}
        <div className="relative bg-surface-container/80 border border-surface-container-high/80 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-md space-y-6 text-on-surface-variant text-body-lg leading-relaxed">
          {/* Decorative watermark background quote */}
          <div className="absolute top-6 right-8 text-primary/10 text-8xl font-serif select-none pointer-events-none leading-none">
            “
          </div>

          <p className="text-on-surface">
            As a music director in our church, one of the biggest challenges I’ve learned to navigate is keeping the entire band in sync. I quickly realized that the key to a tight rehearsal and a smooth worship set is providing clear, reliable chord charts, especially for our newbie musicians who need time to practice during the week.
          </p>

          <p>
            The problem was that chord charts found online are often inaccurate, poorly formatted, or missing the exact keys we need, meaning they always require a little tweaking. For the longest time, I found myself constantly editing them in Microsoft Word. But as any worship leader or musician knows, using a word processor for chord charts is frustrating, and transposing keys is a problem.
          </p>

          {/* Highlighted Quote Box */}
          <div className="my-8 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-primary-container/60 via-primary-container/30 to-surface-container-high/40 border-l-4 border-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
            <p className="text-xl md:text-2xl font-bold text-on-surface tracking-tight italic">
              “We needed something better. So, I built an app.”
            </p>
            <span className="material-symbols-outlined text-primary text-3xl shrink-0 opacity-90">
              music_note
            </span>
          </div>

          <p>
            It is a desktop app designed specifically to feel as familiar and easy to use as Microsoft Word, but built to handle the unique needs of church musicians. It features effortless chord transposing, clean formatting, and best of all, it allows us to share and show the live chart in real-time with the rest of the bandmates. Now, whether they are practicing at home or we're running through a spontaneous set change on stage, we are all looking at the exact same chart, keeping us completely in sync every single time.
          </p>

          <p>
            This tool wasn't designed by a corporate software company that has never run a midweek rehearsal. It was built by a music director who sits right where you sit, trying to get chord charts ready before practice starts so the team can focus on leading worship instead of fighting with formatting.
          </p>

          <p className="text-on-surface font-medium border-l-2 border-primary/40 pl-4 py-1 italic bg-surface-container-high/30 rounded-r-xl">
            If your worship team struggles with messy chord charts or staying in sync, I hope this app helps your band the way it has helped ours.
          </p>

          {/* Author Signature & Profile Card */}
          <div className="pt-8 mt-8 border-t border-outline-variant/30 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-full overflow-hidden shadow-lg ring-2 ring-primary/40 shrink-0 bg-surface-container-high">
                <Image
                  src="/Timothy-Victore.png?v=2"
                  alt="Timothy Victore"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="text-body-lg font-bold text-on-surface leading-snug">
                  Timothy Victore
                </h3>
                <p className="text-body-md text-primary font-semibold">
                  Music Director & Developer
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3.5 py-2 rounded-xl border border-primary/20 shadow-sm">
              <span className="material-symbols-outlined text-base">verified</span>
              <span>Creator of Chorded</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
