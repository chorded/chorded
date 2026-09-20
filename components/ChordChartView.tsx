'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HardBreak from '@tiptap/extension-hard-break';
import { ChordExtension, resolveChordOverlaps, buildContentFromLines } from '@/components/tiptap/ChordExtension';
import { SectionHeaderExtension } from '@/components/tiptap/SectionHeaderExtension';
import { normalizeContent } from '@/utils/normalize';
import { LiveViewerProvider } from '@/components/tiptap/LiveViewerContext';
import { Music, Sun, Moon, MicVocal, RotateCcw, Hash } from 'lucide-react';

export interface ChordChartViewProps {
  song: {
    title: string;
    original_key?: string | null;
    current_key?: string | null;
    bpm?: number | null;
    time_signature?: string | null;
    content?: any;
    raw_text?: string | null;
    notes?: string | null;
  };
  /** Default dark mode state (defaults to true) */
  initialDarkMode?: boolean;
  /** Custom container class (default: "max-w-3xl") */
  maxWidthClass?: string;
  /** Callback fired whenever the user transposes the song key */
  onKeyChange?: (newKey: string) => void;
  /** Custom additional buttons/actions to show in header toolbar */
  headerActions?: React.ReactNode;
}

export default function ChordChartView({
  song,
  initialDarkMode = true,
  maxWidthClass = 'max-w-3xl',
  onKeyChange,
  headerActions,
}: ChordChartViewProps) {
  const initialKey = song.current_key || song.original_key || 'C';
  const [localKey, setLocalKey] = useState<string>(initialKey);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(initialDarkMode);
  const [nashville, setNashville] = useState<boolean>(false);
  const [noChords, setNoChords] = useState<boolean>(false);

  // Sync key if song changes
  useEffect(() => {
    const k = song.current_key || song.original_key || 'C';
    setLocalKey(k);
  }, [song.current_key, song.original_key, song.title]);

  // Compute parsed TipTap doc content
  const parsedContent = useMemo(() => {
    if (song.content && Array.isArray(song.content.content) && song.content.content.length > 0) {
      return normalizeContent(song.content);
    }
    if (song.raw_text && song.raw_text.trim()) {
      const lines = song.raw_text.split(/\r?\n/);
      const contentNodes = buildContentFromLines(lines);
      return normalizeContent({ type: 'doc', content: contentNodes });
    }
    return normalizeContent({ type: 'doc', content: [{ type: 'paragraph' }] });
  }, [song.content, song.raw_text]);

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false }),
      Underline,
      HardBreak,
      ChordExtension,
      SectionHeaderExtension,
    ],
    content: parsedContent,
  });

  // Update content dynamically
  useEffect(() => {
    if (editor && parsedContent) {
      editor.commands.setContent(parsedContent);
    }
  }, [editor, parsedContent]);

  // Resolve chord overlap layout
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

  const handleTranspose = (semitones: number) => {
    if (!editor) return;
    editor.commands.transposeAllChords(semitones);
    import('@/utils/transposer').then(({ transposeKey }) => {
      setLocalKey((prevKey) => {
        const nextKey = transposeKey(prevKey, semitones);
        if (onKeyChange) onKeyChange(nextKey);
        return nextKey;
      });
    });
  };

  const handleResetKey = () => {
    const origKey = song.original_key || 'C';
    if (!editor || localKey === origKey) return;
    // Calculate difference or reload editor content
    if (parsedContent) {
      editor.commands.setContent(parsedContent);
      setLocalKey(origKey);
      if (onKeyChange) onKeyChange(origKey);
    }
  };

  return (
    <LiveViewerProvider nashville={nashville} songKey={localKey}>
      <div
        className={`w-full ${maxWidthClass} mx-auto rounded-2xl shadow-2xl border overflow-hidden transition-colors duration-300 ${
          isDarkMode
            ? 'bg-slate-950 border-slate-800 text-white'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        {/* ── Toolbar Header ── */}
        <div
          className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${
            isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'
          }`}
        >
          {/* Song Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight truncate">{song.title}</h2>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                {song.bpm && <span>{song.bpm} BPM</span>}
                {song.time_signature && <span>• {song.time_signature}</span>}
                {song.original_key && (
                  <span>
                    • Orig: <strong className={isDarkMode ? 'text-amber-400' : 'text-blue-600'}>{song.original_key}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Transpose Widget */}
            <div
              className={`flex items-center rounded-xl overflow-hidden border shadow-sm ${
                isDarkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'
              }`}
            >
              <button
                onClick={() => handleTranspose(-1)}
                className={`px-3 py-1.5 font-bold transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Transpose Down"
              >
                -
              </button>
              <span
                className={`px-3 py-1.5 text-xs font-bold font-mono border-x ${
                  isDarkMode
                    ? 'border-slate-700 text-amber-400 bg-slate-900'
                    : 'border-slate-200 text-blue-600 bg-slate-50'
                }`}
              >
                Key: {localKey}
              </span>
              <button
                onClick={() => handleTranspose(1)}
                className={`px-3 py-1.5 font-bold transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Transpose Up"
              >
                +
              </button>
            </div>

            {/* Reset Key Button */}
            {localKey !== (song.original_key || 'C') && (
              <button
                onClick={handleResetKey}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600'
                }`}
                title="Reset to Original Key"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Nashville Numbers System Toggle */}
            <button
              onClick={() => setNashville((prev) => !prev)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                nashville
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : isDarkMode
                  ? 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle Nashville Number System (1, 4, 5...)"
            >
              <Hash className="w-3.5 h-3.5" />
              Nashville
            </button>

            {/* Vocalist Mode Toggle (Lyrics Only) */}
            <button
              onClick={() => setNoChords((prev) => !prev)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                noChords
                  ? 'bg-purple-600 text-white border-purple-500'
                  : isDarkMode
                  ? 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={noChords ? 'Show chords' : 'Hide chords for vocalists'}
            >
              <MicVocal className="w-3.5 h-3.5" />
              {noChords ? 'Lyrics Only' : 'Vocalist'}
            </button>

            {/* Dark / Light Stage Mode Toggle */}
            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-amber-400 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Toggle Stage Light/Dark Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Extra Header Actions */}
            {headerActions}
          </div>
        </div>

        {/* ── Chord Chart Viewport ── */}
        <div
          className={`p-6 sm:p-10 min-h-[300px] overflow-y-auto ${
            isDarkMode ? 'presenter-dark-stage bg-slate-950' : 'bg-white'
          } ${noChords ? 'presenter-no-chords' : ''}`}
          style={
            {
              '--page-margin-top': '16px',
              '--page-margin-bottom': '32px',
              '--page-margin-left': '0px',
              '--page-margin-right': '0px',
            } as React.CSSProperties
          }
        >
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm italic">
              Loading chord chart...
            </div>
          )}
        </div>
      </div>
    </LiveViewerProvider>
  );
}
