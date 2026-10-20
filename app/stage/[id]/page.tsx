'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchSetlistWithSongs, parseUploadedSetlistFile, Setlist } from '@/lib/setlist-service';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HardBreak from '@tiptap/extension-hard-break';
import { ChordExtension, resolveChordOverlaps } from '@/components/tiptap/ChordExtension';
import { SectionHeaderExtension } from '@/components/tiptap/SectionHeaderExtension';
import { normalizeContent } from '@/utils/normalize';
import { LiveViewerProvider } from '@/components/tiptap/LiveViewerContext';
import QRCode from 'react-qr-code';
import {
  Copy,
  Check,
  Music,
  Loader2,
  XCircle,
  ChevronLeft,
  Wifi,
  WifiOff,
  QrCode,
  X,
  Sun,
  Moon,
  Upload,
  Radio,
  Share2,
  Save,
  RotateCcw,
  ListMusic,
  ChevronDown,
  Search,
  ArrowUp,
} from 'lucide-react';

export default function StagePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, isSubscribed, checkingSubscription } = useAuth();
  const setlistId = params.id as string;

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Share state
  const [isShared, setIsShared] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [nashville, setNashville] = useState(false);

  // UI state
  const [showQR, setShowQR] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Song jump state
  const [activeSongIndex, setActiveSongIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const [songFilter, setSongFilter] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const scrollToSong = (index: number) => {
    setActiveSongIndex(index);
    setHighlightedIndex(index);
    setSongMenuOpen(false);
    setSongFilter('');

    const el = document.getElementById(`song-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      setHighlightedIndex((cur) => (cur === index ? null : cur));
    }, 1800);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSongMenuOpen(false);
      }
    };
    if (songMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [songMenuOpen]);

  const handleScroll = () => {
    if (scrollRef.current) {
      setShowScrollTop(scrollRef.current.scrollTop > 350);
    }
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/setlist/${setlistId}/view`
    : `/setlist/${setlistId}/view`;

  // ── Load setlist ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/mysetlist'); return; }
    if (!setlistId) return;

    fetchSetlistWithSongs(setlistId).then(data => {
      if (!data) { setError('Setlist not found.'); setLoading(false); return; }
      if (data.user_id !== user.id) { setError('You do not own this setlist.'); setLoading(false); return; }
      setSetlist(data);
      // Load current share state from DB
      setIsShared(!!(data as any).is_shared);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load setlist.');
      setLoading(false);
    });
  }, [setlistId, user, authLoading]);

  // Auto-scroll to song if URL contains #song-N
  useEffect(() => {
    if (!loading && setlist && setlist.songs && setlist.songs.length > 0) {
      const songs = setlist.songs;
      const handleHash = () => {
        if (typeof window !== 'undefined' && window.location.hash) {
          const match = window.location.hash.match(/^#song-(\d+)$/);
          if (match) {
            const idx = parseInt(match[1], 10);
            if (!isNaN(idx) && idx >= 0 && idx < songs.length) {
              setTimeout(() => scrollToSong(idx), 350);
            }
          }
        }
      };
      handleHash();
      window.addEventListener('hashchange', handleHash);
      return () => window.removeEventListener('hashchange', handleHash);
    }
  }, [loading, setlist]);

  // ── Toggle share state ───────────────────────────────────────────────────
  const toggleShare = useCallback(async () => {
    if (!setlist) return;
    const next = !isShared;
    setSharingLoading(true);
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ is_shared: next } as any)
        .eq('id', setlistId);
      if (error) throw error;
      setIsShared(next);
    } catch (err: any) {
      console.error('Failed to update share state:', err);
      alert(`Failed to ${next ? 'share' : 'unshare'} setlist: ${err.message}`);
    } finally {
      setSharingLoading(false);
    }
  }, [setlist, isShared, setlistId]);

  // ── Sync / Upload .crd files directly on Stage page ─────────────────────
  const handleSyncCrdFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !setlist) return;

    try {
      const fileList = Array.from(files);
      const fileContents = await Promise.all(
        fileList.map(
          file =>
            new Promise<{ name: string; content: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: file.name, content: reader.result as string });
              reader.onerror = reject;
              reader.readAsText(file);
            })
        )
      );

      const updatedSongs = [...(setlist.songs || [])];
      let hasChanges = false;

      for (const fc of fileContents) {
        const parsed = parseUploadedSetlistFile(fc.content, fc.name);
        for (const s of parsed.songs) {
          const title = s.title || '';
          // Normalize string to match titles with or without parentheticals/punctuation
          const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchIndex = updatedSongs.findIndex(
            cur => clean(cur.title) === clean(title)
          );

          if (matchIndex >= 0) {
            const currentSong = updatedSongs[matchIndex];
            const newContent = s.content || { type: 'doc', content: [] };
            const newKey = s.current_key || s.original_key || currentSong.current_key || 'C';

            updatedSongs[matchIndex] = {
              ...currentSong,
              content: newContent,
              original_key: s.original_key || currentSong.original_key,
              current_key: newKey,
              bpm: s.bpm ?? currentSong.bpm,
              time_signature: s.time_signature ?? currentSong.time_signature,
              raw_text: s.raw_text || currentSong.raw_text,
            };
            hasChanges = true;

            if (currentSong.id) {
              await supabase
                .from('setlist_songs')
                .update({
                  content: newContent,
                  original_key: s.original_key || currentSong.original_key,
                  current_key: newKey,
                  bpm: s.bpm ?? currentSong.bpm,
                  time_signature: s.time_signature ?? currentSong.time_signature,
                  raw_text: s.raw_text || currentSong.raw_text,
                })
                .eq('id', currentSong.id);
            }
          }
        }
      }

      if (hasChanges) {
        setSetlist({ ...setlist, songs: updatedSongs });
      }

    } catch (err: any) {
      console.error('Failed to sync .crd files:', err);
      alert(`Failed to sync score files: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // ── Copy share link ──────────────────────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (authLoading || loading || checkingSubscription) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center gap-4 text-white p-6">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg font-bold">{error}</p>
        <button onClick={() => router.push('/mysetlist')} className="text-blue-400 hover:underline text-sm">
          ← Back to MySetlist
        </button>
      </div>
    );
  }

  if (isSubscribed === false) {
    const gumroadUrl = process.env.NEXT_PUBLIC_GUMROAD_YEARLY_URL || process.env.NEXT_PUBLIC_GUMROAD_MONTHLY_URL || "https://chorded.gumroad.com/l/1year";
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-lg w-full bg-[#141417] border border-blue-500/30 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Share2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Pro Feature Required</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3 text-white">
            Stage Runner & Shared Setlists
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Shared setlist links and stage runner access are reserved for subscribers.
          </p>
          <div className="bg-zinc-900/80 border border-white/5 rounded-2xl p-4 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Share2 className="w-4 h-4" />
              </div>
              <span>Share a link — anyone with it can view your setlist instantly</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <Music className="w-4 h-4" />
              </div>
              <span>Nashville numbering & instant key transposition for viewers</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <a
              href={gumroadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition duration-200 shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              Upgrade on Gumroad →
            </a>
            <button
              onClick={() => router.push('/mysetlist')}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl transition duration-200"
            >
              ← Back to My Setlists
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>

      {/* ── Host Control Bar ── */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-md ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">

          {/* Back */}
          <button
            onClick={() => router.push('/mysetlist')}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            title="Back to MySetlist"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Setlist name & song dropdown */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                HOST — STAGE VIEW
              </p>
              <h1 className="text-sm font-bold truncate">{setlist?.title}</h1>
            </div>

            {setlist?.songs && setlist.songs.length > 0 && (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  onClick={() => setSongMenuOpen(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                    songMenuOpen
                      ? isDarkMode ? 'bg-slate-800 border-indigo-500/50 text-white' : 'bg-indigo-50 border-indigo-300 text-indigo-950'
                      : isDarkMode ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                  title="Jump to a specific song"
                >
                  <ListMusic className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline truncate max-w-[130px]">
                    {activeSongIndex !== null && setlist.songs[activeSongIndex]
                      ? `${activeSongIndex + 1}. ${setlist.songs[activeSongIndex].title}`
                      : 'Jump to song'}
                  </span>
                  <span className="sm:hidden">Songs</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${songMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {songMenuOpen && (
                  <div className={`absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl shadow-2xl border p-2 z-50 backdrop-blur-xl animate-in fade-in duration-150 ${
                    isDarkMode ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
                  }`}>
                    <div className="px-2 py-1.5 flex items-center justify-between border-b border-inherit mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Jump to Song</span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                        {setlist.songs.length} total
                      </span>
                    </div>

                    {setlist.songs.length > 4 && (
                      <div className="px-1 mb-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search songs..."
                            value={songFilter}
                            onChange={(e) => setSongFilter(e.target.value)}
                            className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none ${
                              isDarkMode
                                ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500'
                                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                            }`}
                            autoFocus
                          />
                        </div>
                      </div>
                    )}

                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {(setlist.songs || [])
                        .map((song, i) => ({ song, index: i }))
                        .filter(({ song }) => !songFilter || song.title.toLowerCase().includes(songFilter.toLowerCase()))
                        .map(({ song, index }) => (
                          <button
                            key={song.id || index}
                            onClick={() => scrollToSong(index)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer group ${
                              activeSongIndex === index
                                ? isDarkMode ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                                : isDarkMode ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[10px] shrink-0 ${
                                activeSongIndex === index
                                  ? 'bg-indigo-500 text-white font-bold'
                                  : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {index + 1}
                              </span>
                              <span className="truncate">{song.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-indigo-700'
                              }`}>
                                {song.current_key || song.original_key || 'C'}
                              </span>
                              {activeSongIndex === index && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Nashville toggle */}
            <button
              onClick={() => setNashville(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${nashville
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
            >
              Nashville
            </button>

            {/* Dark mode */}
            <button
              onClick={() => setIsDarkMode(v => !v)}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500'}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* QR code toggle */}
            {isShared && (
              <button
                onClick={() => setShowQR(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${showQR
                    ? isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                    : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR
              </button>
            )}

            {/* Sync / Upload .crd files */}
            <label
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                isDarkMode ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700 hover:text-white' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
              }`}
              title="Import .crd score files to populate chords & lyrics"
            >
              <Upload className="w-3.5 h-3.5" />
              Sync .crd
              <input
                type="file"
                multiple
                accept=".crd,.json"
                className="hidden"
                onChange={handleSyncCrdFiles}
              />
            </label>

            {/* Share toggle */}
            <button
              onClick={toggleShare}
              disabled={sharingLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg ${
                isShared
                  ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/25'
                  : isDarkMode
                    ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-slate-200'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              title={isShared ? 'Click to stop sharing' : 'Click to share with band'}
            >
              {isShared
                ? <Wifi className="w-4 h-4" />
                : <WifiOff className="w-4 h-4" />}
              {isShared ? 'Shared' : 'Share'}
            </button>

            {/* Copy link (only when shared) */}
            {isShared && (
              <button
                onClick={copyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Copy share link"
              >
                {linkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            )}
          </div>
        </div>

        {/* Share status banner */}
        {isShared && (
          <div className={`px-4 py-1.5 flex items-center justify-center gap-3 ${
            isDarkMode ? 'bg-green-900/40 border-b border-green-800/50' : 'bg-green-50 border-b border-green-200'
          }`}>
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className={`text-xs font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>SHARED</span>
            <span className={`text-xs truncate max-w-xs ${isDarkMode ? 'text-green-500' : 'text-green-600'}`}>{shareUrl}</span>
            <button
              onClick={copyLink}
              className={`ml-1 flex items-center gap-1 text-xs transition-colors ${
                isDarkMode ? 'text-green-500 hover:text-green-300' : 'text-green-600 hover:text-green-800'
              }`}
            >
              {linkCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </header>

      {/* ── QR Panel (slide-in) ── */}
      {showQR && isShared && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" onClick={() => setShowQR(false)}>
          <div
            className="relative bg-[#161618] border border-white/10 rounded-2xl p-8 shadow-2xl text-white flex flex-col items-center gap-5 max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold">Share Setlist</h3>
            <p className="text-xs text-zinc-400 text-center -mt-2">
              Scan this QR code or copy the link below to share your setlist.
            </p>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl">
              <QRCode value={shareUrl} size={180} />
            </div>

            {/* Copy link button */}
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Link Copied!' : 'Copy Share Link'}
            </button>

            <p className="text-[10px] text-center break-all text-slate-500">{shareUrl}</p>
          </div>
        </div>
      )}

      {/* ── Song Content ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto ${isDarkMode ? 'bg-slate-950' : 'bg-slate-200/60'}`}
      >
        {!setlist?.songs || setlist.songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
            <Music className={`w-12 h-12 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`text-lg font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              This setlist has no songs yet.
            </p>
            <button
              onClick={() => router.push('/mysetlist')}
              className="text-blue-400 hover:underline text-sm"
            >
              ← Back to add songs
            </button>
          </div>
        ) : (
          <div className="py-8 px-4 flex flex-col items-center gap-0">
            {/* Share status hint banner */}
            {!isShared && (
              <div className={`w-full max-w-3xl mb-6 flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl border ${isDarkMode
                  ? 'bg-slate-900/60 border-slate-700 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-500'
                }`}>
                <div className="flex items-center gap-3">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <p className="text-sm">
                    Press <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>Share</strong> in the toolbar to let your band view this setlist.
                  </p>
                </div>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold rounded-lg cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  Sync .crd Scores
                  <input
                    type="file"
                    multiple
                    accept=".crd,.json"
                    className="hidden"
                    onChange={handleSyncCrdFiles}
                  />
                </label>
              </div>
            )}

            {/* Setlist Overview / Song Index Header */}
            {setlist.songs.length > 1 && (
              <div className={`w-full max-w-3xl mb-8 p-4 sm:p-5 rounded-2xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900/60 border-slate-800 text-white shadow-xl'
                  : 'bg-white border-slate-200 text-slate-900 shadow-sm'
              }`}>
                <div className="flex items-center justify-between gap-3 mb-3 pb-2.5 border-b border-inherit">
                  <div className="flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Setlist Songs</span>
                  </div>
                  <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Click any song title to jump directly to it
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {setlist.songs.map((song, i) => (
                    <button
                      key={song.id || i}
                      onClick={() => scrollToSong(i)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                        activeSongIndex === i
                          ? isDarkMode
                            ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                            : 'bg-indigo-50 border-indigo-300 text-indigo-950'
                          : isDarkMode
                            ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200'
                            : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className={`font-mono text-xs font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          activeSongIndex === i
                            ? 'bg-indigo-500 text-white'
                            : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-xs font-semibold truncate group-hover:text-indigo-400 transition-colors">
                          {song.title}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-indigo-700'
                      }`}>
                        {song.current_key || song.original_key || 'C'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Song Cards */}
            {setlist.songs.map((song, i) => (
              <div
                key={song.id || i}
                id={`song-${i}`}
                className={`w-full max-w-3xl scroll-mt-6 transition-all duration-300 ${
                  highlightedIndex === i ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-950 rounded-2xl shadow-2xl scale-[1.008]' : ''
                }`}
              >
                {i > 0 && (
                  <div className="flex items-center gap-4 my-10">
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      ♪ Next Song
                    </span>
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
                  </div>
                )}
                <SongCard
                  song={{
                    songIndex: i,
                    title: song.title,
                    key: song.current_key || song.original_key || 'C',
                    originalKey: song.original_key || song.current_key || 'C',
                    content: (song as any).editorContent || song.content,
                    id: song.id,
                    raw_text: song.raw_text,
                  }}
                  nashville={nashville}
                  isDarkMode={isDarkMode}
                  onSongUpdate={(updatedSong) => {
                    const newSongs = [...setlist.songs!];
                    newSongs[i] = { ...newSongs[i], ...updatedSong };
                    setSetlist({ ...setlist, songs: newSongs });
                  }}
                />
              </div>
            ))}
            <div className="h-32 shrink-0" />
          </div>
        )}
      </div>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`fixed bottom-6 right-6 p-3 rounded-full shadow-2xl border transition-all duration-200 cursor-pointer z-40 ${
            isDarkMode
              ? 'bg-slate-800/95 hover:bg-slate-700 text-white border-slate-700 shadow-black/50'
              : 'bg-white hover:bg-slate-100 text-slate-900 border-slate-200 shadow-slate-400/30'
          }`}
          title="Back to Top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ── Reusable song card (host read-only, same renderer as /live) ─────────────
const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

interface SongData {
  songIndex: number;
  title: string;
  key: string;
  originalKey: string;
  content: object;
  id?: string;
  raw_text?: string;
}

const SongCard: React.FC<{
  song: SongData;
  nashville: boolean;
  isDarkMode: boolean;
  onSongUpdate?: (updatedSong: any) => void;
}> = ({ song, nashville, isDarkMode, onSongUpdate }) => {
  const [localKey, setLocalKey] = useState(song.key);
  const [savedKey, setSavedKey] = useState(song.key);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLocalKey(song.key);
    setSavedKey(song.key);
  }, [song.key, song.songIndex]);

  const rawDoc = (song as any).editorContent || song.content || {};
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false }),
      Underline,
      HardBreak,
      ChordExtension,
      SectionHeaderExtension,
    ],
    content: normalizeContent(rawDoc),
  });

  useEffect(() => {
    if (editor && song.content) {
      const normalized = normalizeContent((song as any).editorContent || song.content);
      editor.commands.setContent(normalized);
    }
  }, [editor, song.content]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const update = () => resolveChordOverlaps(dom);
    const timer = setTimeout(update, 60);
    editor.on('update', update);
    return () => { clearTimeout(timer); editor.off('update', update); };
  }, [editor]);

  const handleTranspose = (semitones: number) => {
    if (!editor) return;
    editor.commands.transposeAllChords(semitones);
    import('@/utils/transposer').then(({ transposeKey }) => {
      setLocalKey(prev => transposeKey(prev, semitones));
      setSaveSuccess(false);
    });
  };

  const handleDirectKeySelect = (newKey: string) => {
    if (!editor || newKey === localKey) return;
    import('@/utils/transposer').then(({ getSemitoneDifference }) => {
      const diff = getSemitoneDifference(localKey, newKey);
      if (diff !== 0) {
        editor.commands.transposeAllChords(diff);
      }
      setLocalKey(newKey);
      setSaveSuccess(false);
    });
  };

  const handleResetOriginalKey = () => {
    const orig = song.originalKey || 'C';
    if (!editor || localKey === orig) return;
    import('@/utils/transposer').then(({ getSemitoneDifference }) => {
      const diff = getSemitoneDifference(localKey, orig);
      if (diff !== 0) {
        editor.commands.transposeAllChords(diff);
      }
      setLocalKey(orig);
      setSaveSuccess(false);
    });
  };

  const handleSaveKey = async () => {
    if (!song.id) return;
    setIsSavingKey(true);
    try {
      const newContent = editor ? editor.getJSON() : song.content;
      const { error } = await supabase
        .from('setlist_songs')
        .update({
          current_key: localKey,
          content: newContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', song.id);

      if (error) throw error;

      setSavedKey(localKey);
      setSaveSuccess(true);
      if (onSongUpdate) {
        onSongUpdate({
          ...song,
          key: localKey,
          current_key: localKey,
          content: newContent,
        });
      }
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to save key to setlist:', err);
      alert(`Failed to save key: ${err.message}`);
    } finally {
      setIsSavingKey(false);
    }
  };

  const hasContent = Boolean(
    song.content &&
    (
      Array.isArray((song.content as any).content)
        ? (song.content as any).content.length > 0
        : Array.isArray(song.content)
        ? (song.content as any).length > 0
        : false
    )
  );

  const handleSingleSongUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const parsed = parseUploadedSetlistFile(text, file.name);
        const first = parsed.songs[0];
        if (first) {
          const newContent = first.content || { type: 'doc', content: [] };
          const newKey = first.current_key || song.key;
          if (song.id) {
            await supabase
              .from('setlist_songs')
              .update({
                content: newContent,
                original_key: first.original_key || song.key,
                current_key: newKey,
                raw_text: first.raw_text || '',
              })
              .eq('id', song.id);
          }
          if (editor) {
            editor.commands.setContent(normalizeContent(newContent));
          }
          if (onSongUpdate) {
            onSongUpdate({ ...song, content: newContent, current_key: newKey, key: newKey });
          }
        }
      } catch (err: any) {
        alert(`Error loading .crd file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <LiveViewerProvider nashville={nashville} songKey={localKey}>
      <div className={`rounded-xl shadow-lg overflow-hidden ${isDarkMode ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-white text-slate-900 border border-slate-200'
        }`}>
        {/* Song header */}
        <div className={`px-8 pt-6 pb-4 border-b flex items-center justify-between gap-4 flex-wrap ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <Music className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <div>
              <h2 className="text-2xl font-black tracking-tight truncate">{song.title}</h2>
              {song.originalKey && song.originalKey !== localKey && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Orig: <strong className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{song.originalKey}</strong>
                  </span>
                  <button
                    onClick={handleResetOriginalKey}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium underline transition-colors cursor-pointer ${
                      isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                    }`}
                    title={`Reset to original key (${song.originalKey})`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Key Transpose Control */}
            <div className={`flex items-center rounded-lg overflow-hidden border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <button
                onClick={() => handleTranspose(-1)}
                className={`px-3 py-1 font-bold transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
                title="Transpose Down (-1 semitone)"
              >
                −
              </button>
              
              <div className={`relative border-x flex items-center ${isDarkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                <span className={`pl-2.5 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Key:</span>
                <select
                  value={localKey}
                  onChange={(e) => handleDirectKeySelect(e.target.value)}
                  className={`bg-transparent py-1 pl-1 pr-2 text-sm font-bold font-mono focus:outline-none cursor-pointer ${
                    isDarkMode ? 'text-amber-400' : 'text-indigo-700'
                  }`}
                  title="Select key directly"
                >
                  {MUSICAL_KEYS.map((k) => (
                    <option key={k} value={k} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleTranspose(1)}
                className={`px-3 py-1 font-bold transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
                title="Transpose Up (+1 semitone)"
              >
                +
              </button>
            </div>

            {/* Save Key to Setlist Button */}
            {localKey !== savedKey ? (
              <button
                onClick={handleSaveKey}
                disabled={isSavingKey}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer animate-pulse hover:animate-none disabled:opacity-50"
                title="Save this new key to the setlist"
              >
                {isSavingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Key</span>
              </button>
            ) : saveSuccess ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Key Saved!</span>
              </div>
            ) : (
              <button
                onClick={handleSaveKey}
                disabled={isSavingKey}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Key is saved for this setlist. Click to re-save."
              >
                <Save className="w-3 h-3 text-slate-400" />
                <span>Save Key</span>
              </button>
            )}
          </div>
        </div>

        {/* Song body */}
        <div
          className={isDarkMode ? 'presenter-dark-stage' : ''}
          style={{
            '--page-margin-top': '32px',
            '--page-margin-bottom': '48px',
            '--page-margin-left': '48px',
            '--page-margin-right': '48px',
          } as React.CSSProperties}
        >
          {!hasContent ? (
            <div className={`py-12 px-6 flex flex-col items-center justify-center gap-3 text-center rounded-xl border border-dashed my-4 ${
              isDarkMode ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500'
            }`}>
              <Music className="w-8 h-8 opacity-40" />
              <p className="text-sm font-semibold">
                No chords or lyrics loaded for &ldquo;{song.title}&rdquo; yet.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-md shadow-blue-600/20">
                <Upload className="w-3.5 h-3.5" />
                Select &ldquo;{song.title}.crd&rdquo; file
                <input
                  type="file"
                  accept=".crd,.json"
                  className="hidden"
                  onChange={handleSingleSongUpload}
                />
              </label>
              <p className="text-[11px] opacity-60">
                Or click &ldquo;Sync .crd&rdquo; in the top bar to select your .crd files all at once.
              </p>
            </div>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>
    </LiveViewerProvider>
  );
};
