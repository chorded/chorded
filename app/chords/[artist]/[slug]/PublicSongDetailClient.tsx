'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import { PublicSong, getUploaderName } from '@/lib/library-service';
import ChordChartView from '@/components/ChordChartView';
import { useAuth } from '@/context/AuthContext';

interface PublicSongDetailClientProps {
  song: PublicSong;
}

export default function PublicSongDetailClient({ song }: PublicSongDetailClientProps) {
  const { user } = useAuth();
  const artistName = song.artist || 'Traditional';
  const uploaderName = getUploaderName(song, user?.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500/30">
      {/* Header bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <Link
          href="/chords"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-amber-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
            Public .crd Chart
          </span>
          <Link
            href="/library"
            className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition"
          >
            Open in My Library
          </Link>
        </div>
      </header>

      {/* Main Content Area using ChordChartView (Live Projection Viewer) */}
      <main className="flex-1 py-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {song.title} <span className="text-slate-400 font-normal">Chords</span>
              </h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-lg text-slate-400 font-medium">
                  By <span className="text-amber-400 font-semibold">{artistName}</span>
                </p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                  <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                  Uploaded by <strong className="text-amber-300 font-semibold">{uploaderName}</strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                Original Key: <strong className="text-slate-200">{song.original_key || 'C'}</strong>
              </span>
              {song.bpm && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                  BPM: <strong className="text-slate-200">{song.bpm}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Existing Live Projection Chart View Component */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-4 sm:p-8 shadow-2xl">
            <ChordChartView
              song={song}
              initialDarkMode={true}
              maxWidthClass="max-w-3xl"
            />
          </div>
        </div>

        {/* Static HTML crawlable fallback section for Google Search crawlers */}
        {song.raw_text && (
          <article className="sr-only" aria-hidden="false">
            <h2>{song.title} Chords and Lyrics by {artistName}</h2>
            <pre>{song.raw_text}</pre>
          </article>
        )}
      </main>
    </div>
  );
}
