'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HardBreak from '@tiptap/extension-hard-break';
import { ChordExtension, resolveChordOverlaps } from '@/components/tiptap/ChordExtension';
import { SectionHeaderExtension } from '@/components/tiptap/SectionHeaderExtension';
import { normalizeContent } from '@/utils/normalize';
import { LiveViewerProvider } from '@/components/tiptap/LiveViewerContext';
import {
  Music,
  Moon,
  Sun,
  MicVocal,
  Loader2,
  AlertCircle,
  ListMusic,
  ChevronDown,
  Search,
  Check,
  ArrowUp,
} from 'lucide-react';

interface SongData {
  id?: string;
  song_index: number;
  title: string;
  original_key: string;
  current_key: string;
  content: object;
  raw_text?: string;
}

interface SetlistData {
  id: string;
  title: string;
  description: string;
  stage_preferences?: {
    nashville?: boolean;
    isDarkStage?: boolean;
  };
  songs: SongData[];
}

export default function PublicSetlistViewPage() {
  const params = useParams();
  const id = params.id as string;

  const [setlist, setSetlist] = useState<SetlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [nashville, setNashville] = useState(false);
  const [noChords, setNoChords] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  // Song jump state
  const [activeSongIndex, setActiveSongIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const [songFilter, setSongFilter] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/setlist/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Setlist not found or not shared.');
        }
        return res.json();
      })
      .then(({ setlist: data }) => {
        setSetlist(data);
        if (typeof data.stage_preferences?.isDarkStage === 'boolean') {
          setIsDarkMode(data.stage_preferences.isDarkStage);
        }
        if (typeof data.stage_preferences?.nashville === 'boolean') {
          setNashville(data.stage_preferences.nashville);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Jump to specific song
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

  // Close dropdown on outside click
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

  // Auto-scroll to song if URL contains #song-N
  useEffect(() => {
    if (!loading && setlist && setlist.songs?.length > 0) {
      const handleHash = () => {
        if (typeof window !== 'undefined' && window.location.hash) {
          const match = window.location.hash.match(/^#song-(\d+)$/);
          if (match) {
            const idx = parseInt(match[1], 10);
            if (!isNaN(idx) && idx >= 0 && idx < setlist.songs.length) {
              setTimeout(() => scrollToSong(idx), 300);
            }
          }
        }
      };
      handleHash();
      window.addEventListener('hashchange', handleHash);
      return () => window.removeEventListener('hashchange', handleHash);
    }
  }, [loading, setlist]);

  // Scroll listener to show back-to-top button
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 350);
    }
  };

  const bg = isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900';
  const toolbar = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bg}`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center ${bg}`}>
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        </div>
        <h1 className="text-xl font-bold">Setlist Not Available</h1>
        <p className={`text-sm max-w-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {error}
        </p>
        <p className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          The admin may not have shared this setlist yet, or the link may be invalid.
        </p>
      </div>
    );
  }

  if (!setlist) return null;

  const filteredSongs = setlist.songs
    .map((song, i) => ({ song, index: i }))
    .filter(({ song }) => !songFilter || song.title.toLowerCase().includes(songFilter.toLowerCase()));

  return (
    <div className={`fixed inset-0 flex flex-col select-none transition-colors duration-300 ${bg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 sm:px-4 py-2.5 border-b z-50 shrink-0 gap-2 ${toolbar}`}>
        {/* Left: setlist info & song dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0">
            <ListMusic className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">{setlist.title}</h1>
            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {setlist.songs.length} {setlist.songs.length === 1 ? 'song' : 'songs'}
            </p>
          </div>

          {/* Jump to Song Dropdown */}
          {setlist.songs.length > 0 && (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setSongMenuOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                  songMenuOpen
                    ? isDarkMode
                      ? 'bg-slate-800 border-indigo-500/50 text-white'
                      : 'bg-indigo-50 border-indigo-300 text-indigo-950'
                    : isDarkMode
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
                title="Jump to a specific song"
              >
                <span className="hidden md:inline truncate max-w-[140px]">
                  {activeSongIndex !== null && setlist.songs[activeSongIndex]
                    ? `${activeSongIndex + 1}. ${setlist.songs[activeSongIndex].title}`
                    : 'Jump to song'}
                </span>
                <span className="md:hidden">Songs</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${songMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Dropdown */}
              {songMenuOpen && (
                <div
                  className={`absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl shadow-2xl border p-2 z-50 backdrop-blur-xl animate-in fade-in duration-150 ${
                    isDarkMode
                      ? 'bg-slate-900/95 border-slate-800 text-white'
                      : 'bg-white/95 border-slate-200 text-slate-900'
                  }`}
                >
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
                          placeholder="Search songs in setlist..."
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
                    {filteredSongs.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">No matching songs</div>
                    ) : (
                      filteredSongs.map(({ song, index }) => (
                        <button
                          key={song.id || index}
                          onClick={() => scrollToSong(index)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer group ${
                            activeSongIndex === index
                              ? isDarkMode
                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                                : 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                              : isDarkMode
                                ? 'hover:bg-slate-800/80 text-slate-200'
                                : 'hover:bg-slate-100 text-slate-700'
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
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: viewer controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Nashville toggle */}
          <button
            onClick={() => setNashville(v => !v)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${nashville
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : isDarkMode
                  ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
          >
            Nashville
          </button>

          {/* Vocalist / no-chords mode */}
          <button
            onClick={() => setNoChords(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${noChords
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            title={noChords ? 'Show chords' : 'Hide chords (vocalist mode)'}
          >
            <MicVocal className="w-4 h-4" />
            <span className="hidden sm:inline">{noChords ? 'Lyrics Only' : 'No Chords'}</span>
          </button>

          {/* Zoom controls */}
          <div className={`hidden sm:flex items-center rounded-lg border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
              className={`px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Zoom out"
            >
              A-
            </button>
            <span className={`px-2 py-1.5 text-xs font-mono border-x ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))}
              className={`px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Zoom in"
            >
              A+
            </button>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setIsDarkMode(v => !v)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            title="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Song list container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto overflow-x-hidden ${isDarkMode ? 'bg-black' : 'bg-slate-200/70'}`}
        style={{ scrollBehavior: 'auto' }}
      >
        {setlist.songs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <Music className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <p className="text-lg font-bold">No songs in this setlist</p>
          </div>
        ) : (
          <div className="py-8 px-4 flex flex-col items-center" style={{ zoom }}>

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
                      Next Song
                    </span>
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
                  </div>
                )}
                <ViewerSongCard
                  song={song}
                  nashville={nashville}
                  isDarkMode={isDarkMode}
                  noChords={noChords}
                />
              </div>
            ))}
            <div className="h-64 shrink-0" />
          </div>
        )}
      </div>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => {
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

// ── Per-song card with local transpose ───────────────────────────────────────
const ViewerSongCard: React.FC<{
  song: SongData;
  nashville: boolean;
  isDarkMode: boolean;
  noChords?: boolean;
}> = ({ song, nashville, isDarkMode, noChords }) => {
  const [localKey, setLocalKey] = useState(song.current_key || song.original_key || 'C');

  useEffect(() => {
    setLocalKey(song.current_key || song.original_key || 'C');
  }, [song.current_key, song.original_key, song.song_index]);

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false }),
      Underline,
      HardBreak,
      ChordExtension,
      SectionHeaderExtension,
    ],
    content: normalizeContent((song as any).editorContent || song.content || {}),
  });

  useEffect(() => {
    if (editor && song.content) {
      const norm = normalizeContent((song as any).editorContent || song.content);
      editor.commands.setContent(norm);
    }
  }, [editor, song.content]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    if (!dom) return;
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

  return (
    <LiveViewerProvider nashville={nashville} songKey={localKey}>
      <div className={`rounded-xl shadow-lg overflow-hidden ${isDarkMode
          ? 'bg-slate-950 border border-slate-800 text-white'
          : 'bg-white text-slate-900 border border-slate-200'
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
              title="Transpose down"
            >
              -
            </button>
            <span className={`px-3 py-1 text-sm font-bold border-x ${isDarkMode
                ? 'border-slate-700 text-amber-400 bg-slate-950'
                : 'border-slate-200 text-indigo-700 bg-white'
              }`}>
              Key: {localKey}
            </span>
            <button
              onClick={() => handleTranspose(1)}
              className={`px-3 py-1 font-bold transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Transpose up"
            >
              +
            </button>
          </div>
        </div>

        {/* Song body */}
        <div
          className={[isDarkMode ? 'presenter-dark-stage' : '', noChords ? 'presenter-no-chords' : ''].filter(Boolean).join(' ')}
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
};