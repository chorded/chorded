import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { fetchPublicSongs } from '@/lib/library-service';
import PublicChordsClient from './PublicChordsClient';

export const metadata: Metadata = {
  title: 'Guitar Chords & Lyrics Directory | CHORDED',
  description: 'Search guitar chord charts from the CHORDED community. Transpose keys instantly, use Nashville numbers, and stream live chord charts.',
  openGraph: {
    title: 'Guitar Chords & Lyrics Directory | CHORDED',
    description: 'Accurate guitar chord charts with live key transposition and auto-scroll.',
    type: 'website',
  },
};

export const revalidate = 60; // Revalidate every 60s

export default async function PublicChordsPage() {
  const songs = await fetchPublicSongs();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30">
      {/* Top Banner & Search */}
      <section className="relative border-b border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
            Public Song Directory
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Find & Play <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">Guitar Chords</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Browse accurate chord charts from the CHORDED community. Transpose keys with one click, or publish your own from your Library.
          </p>

          <PublicChordsClient initialSongs={songs} />
        </div>
      </section>
    </div>
  );
}
