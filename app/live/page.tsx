'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Radio, Music, Lock, Moon, Sun } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HardBreak from '@tiptap/extension-hard-break';
import { ChordExtension, resolveChordOverlaps } from '@/components/tiptap/ChordExtension';
import { SectionHeaderExtension } from '@/components/tiptap/SectionHeaderExtension';
import { normalizeContent } from '@/utils/normalize';
import { LiveViewerProvider } from '@/components/tiptap/LiveViewerContext';

interface SongData {
  songIndex: number;
  title: string;
  key: string;
  content: object;
}

interface PagePayload {
  songs: SongData[];
  nashville: boolean;
  isDarkStage: boolean;
}

export default function LiveSessionPage() {
  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState('');
  const [songsData, setSongsData] = useState<SongData[] | null>(null);
  const [nashville, setNashville] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [zoom, setZoom] = useState(1.0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Client side dark mode toggle
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // initialize from system preference
    if (typeof window !== 'undefined') {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }
    setError('');
    setIsJoined(true);
  };

  const handleLeave = () => {
    setIsJoined(false);
    setRoomCode('');
    setSongsData(null);
  };

  useEffect(() => {
    if (!isJoined) return;

    setConnectionStatus('connecting');
    const channel = supabase.channel(`live-${roomCode.toUpperCase()}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'setlist-init' }, (payload) => {
        const data = payload.payload as PagePayload;
        setSongsData(data.songs);
        setNashville(data.nashville);
        if (typeof data.isDarkStage === 'boolean') {
          setIsDarkMode(data.isDarkStage);
        }
      })
      .on('broadcast', { event: 'live-stopped' }, () => {
        alert('The host has ended the Live Show.');
        handleLeave();
      })
      .on('broadcast', { event: 'scroll-update' }, (payload) => {
        const { scrollRatio, zoom: newZoom } = payload.payload;
        setZoom(newZoom);
        
        // Apply scroll ratio
        const el = scrollContainerRef.current;
        if (el) {
          const targetScroll = scrollRatio * Math.max(1, el.scrollHeight - el.clientHeight);
          // Only scroll if we are reasonably far from the target to avoid jitter
          if (Math.abs(el.scrollTop - targetScroll) > 2) {
             el.scrollTop = targetScroll;
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          // Request initial sync in case we joined late
          channel.send({
            type: 'broadcast',
            event: 'request-sync',
            payload: {}
          }).catch(console.error);
        } else {
          setConnectionStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnectionStatus('disconnected');
    };
  }, [isJoined, roomCode]);

  const bg = isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900';
  const toolbar = isDarkMode
    ? 'bg-slate-900 border-slate-800'
    : 'bg-white border-slate-200';

  if (!isJoined) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${bg}`}>
        <div className={`max-w-md w-full space-y-8 p-8 rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mb-4">
              <Radio className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Join Live Session</h2>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Enter the room code provided by the setlist host.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleJoin}>
            <div>
              <label htmlFor="roomCode" className="sr-only">Room Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="roomCode"
                  name="roomCode"
                  type="text"
                  required
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className={`block w-full pl-10 pr-3 py-4 border rounded-xl leading-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-lg font-mono text-center tracking-[0.5em] ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder="CODE"
                />
              </div>
              {error && <p className="mt-2 text-sm text-red-400 text-center">{error}</p>}
            </div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Join Session
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 flex flex-col select-none transition-colors duration-300 ${bg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b z-50 shrink-0 ${toolbar}`}>
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
          <div>
            <div className={`text-xs font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Room: {roomCode.toUpperCase()}
            </div>
            {songsData && (
              <h1 className="text-sm font-bold flex items-center gap-1">
                <Music className="w-3 h-3" />
                {songsData.length} {songsData.length === 1 ? 'Song' : 'Songs'}
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={handleLeave}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
            }`}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden ${isDarkMode ? 'bg-black' : 'bg-slate-200/70'}`}
        style={{ scrollBehavior: 'auto' }}
      >
        {!songsData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <Radio className={`w-12 h-12 mx-auto mb-4 animate-pulse ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <p className="text-lg font-bold">Waiting for Host...</p>
            <p className={`text-sm mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>The setlist pages will appear here automatically.</p>
          </div>
        ) : (
          <div
            className="py-8 px-4 flex flex-col items-center"
            style={{ zoom: zoom }}
          >
            {songsData.map((song, i) => (
              <div key={song.songIndex} className="w-full max-w-3xl">
                {i > 0 && (
                  <div className="flex items-center gap-4 my-10">
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      ♪ Next Song
                    </span>
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
                  </div>
                )}
                
                <ContinuousSongView song={song} nashville={nashville} isDarkMode={isDarkMode} />
              </div>
            ))}
            {/* Bottom breathing room */}
            <div className="h-64 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

const ContinuousSongView: React.FC<{ song: SongData, nashville: boolean, isDarkMode: boolean }> = ({ song, nashville, isDarkMode }) => {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false }),
      Underline,
      HardBreak,
      ChordExtension,
      SectionHeaderExtension
    ],
    content: normalizeContent(song.content || {})
  });

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    if (!dom) return;

    const update = () => resolveChordOverlaps(dom);
    const timer = setTimeout(update, 60);
    editor.on('update', update);

    return () => {
      clearTimeout(timer);
      editor.off('update', update);
    };
  }, [editor]);

  return (
    <LiveViewerProvider nashville={nashville} songKey={song.key}>
      <div className={`rounded-xl shadow-lg overflow-hidden ${
        isDarkMode
          ? 'bg-slate-950 border border-slate-800 text-white'
          : 'bg-white text-slate-900 border border-slate-200'
      }`}>
        <div className={`px-8 pt-6 pb-4 border-b flex items-center justify-between gap-4 ${
          isDarkMode ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <Music className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <h2 className="text-2xl font-black tracking-tight truncate">
              {song.title}
            </h2>
          </div>
          <span className={`px-3 py-1 rounded-lg text-sm font-bold shrink-0 ${
            isDarkMode
              ? 'bg-amber-950/50 border border-amber-700/40 text-amber-300'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            Key: {song.key}
          </span>
        </div>

        <div
          className={isDarkMode ? 'presenter-dark-stage' : ''}
          style={{
            '--page-margin-top': '32px',
            '--page-margin-bottom': '48px',
            '--page-margin-left': '48px',
            '--page-margin-right': '48px',
          } as React.CSSProperties}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </LiveViewerProvider>
  );
}
