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
  Radio,
  Copy,
  Check,
  Music,
  Loader2,
  XCircle,
  ChevronLeft,
  Users,
  Wifi,
  WifiOff,
  QrCode,
  X,
  Sun,
  Moon,
  Upload,
} from 'lucide-react';

// ── Derive a stable 6-char room PIN from a UUID ────────────────────────────
function deriveRoomCode(uuid: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const hex = uuid.replace(/-/g, '');
  let code = '';
  for (let i = 0; i < 6; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    code += chars[byte % chars.length];
  }
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StagePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, isSubscribed, checkingSubscription } = useAuth();
  const setlistId = params.id as string;

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Live state
  const [isLive, setIsLive] = useState(false);
  const [channelRef] = useState<{ current: any }>({ current: null });
  const [viewerCount, setViewerCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [nashville, setNashville] = useState(false);

  // UI state
  const [showQR, setShowQR] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);

  const roomCode = setlistId ? deriveRoomCode(setlistId) : '';
  const liveUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live?code=${roomCode}`
    : `/live?code=${roomCode}`;

  // ── Load setlist ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/mysetlist'); return; }
    if (!setlistId) return;

    fetchSetlistWithSongs(setlistId).then(data => {
      if (!data) { setError('Setlist not found.'); setLoading(false); return; }
      if (data.user_id !== user.id) { setError('You do not own this setlist.'); setLoading(false); return; }
      setSetlist(data);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load setlist.');
      setLoading(false);
    });
  }, [setlistId, user, authLoading]);

  // ── Build the payload that gets broadcast to viewers ──────────────────
  const buildPayload = useCallback(() => {
    if (!setlist?.songs) return null;
    return {
      songs: setlist.songs.map((s, i) => ({
        songIndex: i,
        title: s.title,
        key: s.current_key || s.original_key || 'C',
        content: (s as any).editorContent || s.content || { type: 'doc', content: [] },
      })),
      nashville,
      isDarkStage: isDarkMode,
    };
  }, [setlist, nashville, isDarkMode]);

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

        if (isLive && channelRef.current) {
          const payload = {
            songs: updatedSongs.map((s, i) => ({
              songIndex: i,
              title: s.title,
              key: s.current_key || s.original_key || 'C',
              content: s.content || { type: 'doc', content: [] },
            })),
            nashville,
            isDarkStage: isDarkMode,
          };
          channelRef.current.send({ type: 'broadcast', event: 'setlist-init', payload }).catch(console.error);
        }
      }
    } catch (err: any) {
      console.error('Failed to sync .crd files:', err);
      alert(`Failed to sync score files: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // ── Go Live ─────────────────────────────────────────────────────────────
  const startLive = useCallback(async () => {
    if (!setlist) return;
    const channel = supabase.channel(`live-${roomCode}`, {
      config: { presence: { key: user!.id } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'request-sync' }, () => {
        const payload = buildPayload();
        if (payload) {
          channel.send({ type: 'broadcast', event: 'setlist-init', payload }).catch(console.error);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewerCount(Object.keys(state).length);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          const payload = buildPayload();
          if (payload) {
            channel.send({ type: 'broadcast', event: 'setlist-init', payload }).catch(console.error);
          }
          setIsLive(true);
        }
      });
  }, [setlist, roomCode, user, buildPayload, channelRef]);

  // ── Stop Live ────────────────────────────────────────────────────────────
  const stopLive = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'live-stopped', payload: {} }).catch(console.error);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsLive(false);
    setViewerCount(0);
  }, [channelRef]);

  // Re-broadcast when dark mode / nashville toggles while live
  useEffect(() => {
    if (!isLive || !channelRef.current) return;
    const payload = buildPayload();
    if (payload) {
      channelRef.current.send({ type: 'broadcast', event: 'setlist-init', payload }).catch(console.error);
    }
  }, [isDarkMode, nashville, isLive, buildPayload, channelRef]);

  // Cleanup on unmount
  useEffect(() => () => { stopLive(); }, [stopLive]);

  // ── Scroll sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isLive || !channelRef.current) return;

    const onScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime.current < 60) return;
      lastScrollTime.current = now;
      const scrollRatio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'scroll-update',
        payload: { scrollRatio, zoom: 1.0 },
      }).catch(console.error);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isLive, channelRef]);

  // ── Copy helpers ──────────────────────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(liveUrl);
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
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-lg w-full bg-[#141417] border border-blue-500/30 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Radio className="w-3.5 h-3.5 animate-pulse text-blue-400" />
            <span>Pro Feature Required</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3 text-white">
            Stage Runner & Live Sync
          </h2>

          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Live setlist broadcasting and stage runner access are reserved for subscribers who purchased a subscription on Gumroad.
          </p>

          {/* Benefits list */}
          <div className="bg-zinc-900/80 border border-white/5 rounded-2xl p-4 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Radio className="w-4 h-4" />
              </div>
              <span>Broadcast live setlist to band members via PIN / QR code</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <Music className="w-4 h-4" />
              </div>
              <span>Real-time Nashville numbering & instant key transposition</span>
            </div>
          </div>

          {/* Actions */}
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
            onClick={() => { stopLive(); router.push('/mysetlist'); }}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            title="Back to MySetlist"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Setlist name */}
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              HOST — STAGE VIEW
            </p>
            <h1 className="text-sm font-bold truncate">{setlist?.title}</h1>
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

            {/* PIN display + copy */}
            <div className={`flex items-center rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`px-3 py-1.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <p className={`text-[9px] font-semibold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>PIN</p>
                <p className="text-base font-black tracking-[0.2em] font-mono">{roomCode}</p>
              </div>
              <button
                onClick={copyCode}
                className={`px-3 py-1.5 h-full transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'}`}
                title="Copy PIN"
              >
                {codeCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Viewer count (when live) */}
            {isLive && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-bold">
                <Users className="w-3.5 h-3.5" />
                {viewerCount}
              </div>
            )}

            {/* Go Live / Stop */}
            {!isLive ? (
              <button
                onClick={startLive}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-600/25"
              >
                <Radio className="w-4 h-4" />
                Go Live
              </button>
            ) : (
              <button
                onClick={stopLive}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-colors border border-red-500/30"
              >
                <WifiOff className="w-4 h-4 text-red-400" />
                Stop Live
              </button>
            )}
          </div>
        </div>

        {/* Live status bar */}
        {isLive && (
          <div className="bg-red-600 px-4 py-1.5 flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">LIVE</span>
            <span className="text-xs text-red-200">Viewers at <strong>/live</strong> with PIN <strong>{roomCode}</strong></span>
            <button
              onClick={copyLink}
              className="ml-2 flex items-center gap-1 text-xs text-red-200 hover:text-white transition-colors"
            >
              {linkCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}
      </header>

      {/* ── QR Panel (slide-in) ── */}
      {showQR && (
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

            <h3 className="text-lg font-bold">Scan to Join Live</h3>
            <p className="text-xs text-zinc-400 text-center -mt-2">
              Scan this QR code or enter the PIN below to join the live session on any device.
            </p>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl">
              <QRCode value={liveUrl} size={180} />
            </div>

            {/* PIN */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">PIN Code</p>
              <p className="text-4xl font-black tracking-[0.3em] font-mono text-white">{roomCode}</p>
            </div>

            {/* Copy link button */}
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Link Copied!' : 'Copy Share Link'}
            </button>

            <p className={`text-[10px] text-center break-all ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{liveUrl}</p>
          </div>
        </div>
      )}

      {/* ── Song Content ── */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto ${isDarkMode ? 'bg-slate-950' : 'bg-slate-200/60'}`}>
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
            {/* "Not live" banner */}
            {!isLive && (
              <div className={`w-full max-w-3xl mb-6 flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl border ${isDarkMode
                  ? 'bg-slate-900/60 border-slate-700 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-500'
                }`}>
                <div className="flex items-center gap-3">
                  <Wifi className="w-4 h-4 shrink-0" />
                  <p className="text-sm">
                    Press <strong>Go Live</strong> to start broadcasting. PIN <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{roomCode}</strong>
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

            {setlist.songs.map((song, i) => (
              <div key={song.id || i} className="w-full max-w-3xl">
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
    </div>
  );
}

// ── Reusable song card (host read-only, same renderer as /live) ─────────────
interface SongData {
  songIndex: number;
  title: string;
  key: string;
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

  useEffect(() => { setLocalKey(song.key); }, [song.key, song.songIndex]);

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
    });
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
        <div className={`px-8 pt-6 pb-4 border-b flex items-center justify-between gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <Music className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <h2 className="text-2xl font-black tracking-tight truncate">{song.title}</h2>
          </div>
          <div className={`flex items-center rounded-lg overflow-hidden border ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <button
              onClick={() => handleTranspose(-1)}
              className={`px-3 py-1 font-bold transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              −
            </button>
            <span className={`px-3 py-1 text-sm font-bold border-x ${isDarkMode ? 'border-slate-700 text-amber-400 bg-slate-950' : 'border-slate-200 text-indigo-700 bg-white'}`}>
              Key: {localKey}
            </span>
            <button
              onClick={() => handleTranspose(1)}
              className={`px-3 py-1 font-bold transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              +
            </button>
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
