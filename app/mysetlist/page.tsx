'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';
import AuthModal from '@/components/auth/AuthModal';
import {
  fetchUserSetlists,
  fetchSetlistWithSongs,
  createSetlist,
  updateSetlist,
  deleteSetlist,
  Setlist,
  SetlistSong,
} from '@/lib/setlist-service';
import {
  fetchLibrarySongsLight,
  LibrarySongLight,
  fetchLibrarySongs,
  LibrarySong,
} from '@/lib/library-service';
import {
  Music,
  Plus,
  Play,
  Trash2,
  Search,
  Clock,
  Sparkles,
  Loader2,
  Library,
  Radio,
  Star,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  Pencil,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// ── Song row in the picker ──────────────────────────────────────────────────
interface PickerSong extends LibrarySongLight {
  selected: boolean;
  order: number; // 0 = not selected; >0 = position
}

export default function MySetlistPage() {
  const { user, loading: authLoading } = useAuth();

  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loadingSetlists, setLoadingSetlists] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // ── Create modal state ────────────────────────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Song picker inside create modal
  const [librarySongs, setLibrarySongs] = useState<PickerSong[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSongs, setEditSongs] = useState<Partial<SetlistSong>[]>([]);
  const [librarySongsFull, setLibrarySongsFull] = useState<LibrarySong[]>([]);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPickerSearch, setEditPickerSearch] = useState('');
  const [openSongNoteIdx, setOpenSongNoteIdx] = useState<number | null>(null);

  // ── Load setlists ─────────────────────────────────────────────────────────
  const loadSetlists = async () => {
    if (!user) return;
    try {
      setLoadingSetlists(true);
      const data = await fetchUserSetlists();
      setSetlists(data);
    } catch (err) {
      console.error('Failed to load setlists:', err);
    } finally {
      setLoadingSetlists(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) setIsAuthModalOpen(true);
      else loadSetlists();
    }
  }, [user, authLoading]);

  // ── Open create modal and load library ───────────────────────────────────
  const openCreateModal = useCallback(async () => {
    setNewTitle('');
    setNewDescription('');
    setPickerSearch('');
    setIsCreateModalOpen(true);
    setLoadingLibrary(true);
    try {
      const songs = await fetchLibrarySongsLight();
      setLibrarySongs(songs.map(s => ({ ...s, selected: false, order: 0 })));
    } catch {
      setLibrarySongs([]);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  // ── Toggle a song in the picker ───────────────────────────────────────────
  const toggleSong = (id: string) => {
    setLibrarySongs(prev => {
      const song = prev.find(s => s.id === id)!;
      if (song.selected) {
        // Deselect: remove and shift remaining orders
        const removedOrder = song.order;
        return prev.map(s =>
          s.id === id
            ? { ...s, selected: false, order: 0 }
            : s.order > removedOrder
            ? { ...s, order: s.order - 1 }
            : s
        );
      } else {
        // Select: assign next order
        const nextOrder = prev.filter(s => s.selected).length + 1;
        return prev.map(s => s.id === id ? { ...s, selected: true, order: nextOrder } : s);
      }
    });
  };

  // ── Move selected song up/down in order ───────────────────────────────────
  const moveSong = (id: string, dir: 'up' | 'down') => {
    setLibrarySongs(prev => {
      const selected = [...prev.filter(s => s.selected)].sort((a, b) => a.order - b.order);
      const idx = selected.findIndex(s => s.id === id);
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === selected.length - 1) return prev;
      const swapWith = dir === 'up' ? selected[idx - 1] : selected[idx + 1];
      return prev.map(s => {
        if (s.id === id) return { ...s, order: swapWith.order };
        if (s.id === swapWith.id) return { ...s, order: selected[idx].order };
        return s;
      });
    });
  };

  const selectedSongs = librarySongs.filter(s => s.selected).sort((a, b) => a.order - b.order);

  const filteredPickerSongs = librarySongs.filter(s =>
    s.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ── Create setlist ────────────────────────────────────────────────────────
  const handleCreateSetlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    try {
      setCreating(true);

      // If songs are selected, fetch their full content from library before saving
      let songPayload: any[] = [];
      if (selectedSongs.length > 0) {
        const allFull = await fetchLibrarySongs();
        const fullMap = new Map(allFull.map(s => [s.id, s]));
        songPayload = selectedSongs.map((s, idx) => {
          const full = fullMap.get(s.id);
          return {
            song_index: idx,
            title: s.title,
            original_key: s.original_key,
            current_key: s.current_key,
            bpm: s.bpm ?? null,
            time_signature: s.time_signature ?? null,
            content: full?.content ?? { type: 'doc', content: [] },
            raw_text: full?.raw_text ?? '',
            notes: full?.notes ?? '',
          };
        });
      }

      const created = await createSetlist(user.id, newTitle.trim(), newDescription.trim(), songPayload);
      setSetlists([created, ...setlists]);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setLibrarySongs([]);
    } catch (err: any) {
      alert(`Error creating setlist: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // ── Delete setlist ────────────────────────────────────────────────────────
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteSetlist(id);
      setSetlists(setlists.filter(s => s.id !== id));
    } catch (err: any) {
      alert(`Error deleting setlist: ${err.message}`);
    }
  };

  // ── Open edit modal and load songs ────────────────────────────────────────
  const openEditModal = useCallback(async (setlist: Setlist) => {
    setEditingSetlist(setlist);
    setEditTitle(setlist.title);
    setEditDescription(setlist.description || '');
    setEditPickerSearch('');
    setOpenSongNoteIdx(null);
    setIsEditModalOpen(true);
    setLoadingEditData(true);

    try {
      const [fullSetlist, allLib] = await Promise.all([
        fetchSetlistWithSongs(setlist.id),
        fetchLibrarySongs(),
      ]);

      if (fullSetlist?.songs) {
        setEditSongs(fullSetlist.songs);
      } else {
        setEditSongs(setlist.songs || []);
      }
      setLibrarySongsFull(allLib || []);
    } catch (err) {
      console.error('Failed to load setlist details:', err);
      setEditSongs(setlist.songs || []);
    } finally {
      setLoadingEditData(false);
    }
  }, []);

  const moveEditSong = (index: number, dir: 'up' | 'down') => {
    setEditSongs(prev => {
      const targetIndex = dir === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const removeEditSong = (index: number) => {
    setEditSongs(prev => prev.filter((_, i) => i !== index));
    if (openSongNoteIdx === index) {
      setOpenSongNoteIdx(null);
    }
  };

  const changeEditSongKey = (index: number, newKey: string) => {
    setEditSongs(prev => prev.map((s, i) => (i === index ? { ...s, current_key: newKey } : s)));
  };

  const changeEditSongNotes = (index: number, notes: string) => {
    setEditSongs(prev => prev.map((s, i) => (i === index ? { ...s, notes } : s)));
  };

  const addSongFromLibraryToEdit = (libSong: LibrarySong) => {
    setEditSongs(prev => [
      ...prev,
      {
        song_index: prev.length,
        title: libSong.title,
        original_key: libSong.original_key || libSong.current_key || 'C',
        current_key: libSong.current_key || libSong.original_key || 'C',
        bpm: libSong.bpm ?? null,
        time_signature: libSong.time_signature ?? null,
        content: libSong.content ?? { type: 'doc', content: [] },
        raw_text: libSong.raw_text ?? '',
        notes: libSong.notes ?? '',
      },
    ]);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetlist || !editTitle.trim()) return;

    try {
      setSavingEdit(true);
      const updated = await updateSetlist(
        editingSetlist.id,
        editTitle.trim(),
        editDescription.trim(),
        editSongs
      );

      setSetlists(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setIsEditModalOpen(false);
      setEditingSetlist(null);
    } catch (err: any) {
      alert(`Error updating setlist: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredLibrarySongsForEdit = librarySongsFull.filter(s =>
    s.title.toLowerCase().includes(editPickerSearch.toLowerCase()) ||
    (s.original_key && s.original_key.toLowerCase().includes(editPickerSearch.toLowerCase())) ||
    (s.current_key && s.current_key.toLowerCase().includes(editPickerSearch.toLowerCase()))
  );

  const filteredSetlists = setlists.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.songs?.some(song => song.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0E0E10] text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <NavBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">MySetlist</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRO CLOUD
              </span>
            </div>
            <p className="mt-2 text-zinc-400 text-sm">
              Build setlists from your library, then go live — share a PIN so your band follows along on any device.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-sm font-medium border border-white/10 transition duration-200 cursor-pointer shadow-sm hover:border-white/20"
            >
              <Library className="w-4 h-4 text-blue-400" />
              Song Library
            </Link>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition duration-200 cursor-pointer shadow-lg shadow-blue-600/25"
            >
              <Plus className="w-4 h-4" />
              New Setlist
            </button>
          </div>
        </div>

        {/* ── Search & stats ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search setlists or song titles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="text-xs text-zinc-400 self-start sm:self-auto">
            Showing <span className="font-semibold text-white">{filteredSetlists.length}</span> of{' '}
            <span className="font-semibold text-white">{setlists.length}</span> setlists
          </div>
        </div>

        {/* ── Loading ── */}
        {loadingSetlists && user && (
          <div className="mt-16 flex flex-col items-center justify-center text-zinc-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Loading your setlists from cloud...</p>
          </div>
        )}

        {/* ── Unauthenticated ── */}
        {!authLoading && !user && (
          <div className="mt-16 text-center bg-zinc-900/50 border border-white/10 rounded-2xl p-10 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Sign in to Access MySetlist</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Create an account or sign in to save your setlists, sync across devices, and go live with your band.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition duration-200 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loadingSetlists && user && filteredSetlists.length === 0 && (
          <div className="mt-16 text-center bg-zinc-900/40 border border-white/10 rounded-2xl p-12 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <Music className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Setlists Found</h3>
            <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
              {searchQuery
                ? 'No setlists or songs match your search query.'
                : 'You have no setlists yet. Create one and pick songs from your library!'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/library"
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium border border-white/10 transition cursor-pointer flex items-center gap-2"
              >
                <Library className="w-4 h-4 text-blue-400" />
                Browse Song Library
              </Link>
              <button
                onClick={openCreateModal}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer shadow-lg shadow-blue-600/20 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create New Setlist
              </button>
            </div>
          </div>
        )}

        {/* ── Setlists Grid ── */}
        {!loadingSetlists && filteredSetlists.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSetlists.map(setlist => {
              const songCount = setlist.songs?.length || 0;
              return (
                <div
                  key={setlist.id}
                  className="group relative bg-[#151518] hover:bg-[#18181D] border border-white/10 hover:border-blue-500/30 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-2xl hover:shadow-blue-500/5"
                >
                  <div>
                    {/* Top badge + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                          {songCount} {songCount === 1 ? 'Song' : 'Songs'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(setlist)}
                          className="text-zinc-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                          title="Edit Setlist"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(setlist.id, setlist.title)}
                          className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete Setlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-white mt-3 group-hover:text-blue-400 transition-colors line-clamp-1">
                      {setlist.title}
                    </h3>

                    {setlist.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{setlist.description}</p>
                    )}

                    {/* Songs preview */}
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5">
                      {setlist.songs && setlist.songs.length > 0 ? (
                        setlist.songs.slice(0, 4).map((song, idx) => (
                          <div
                            key={song.id || idx}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/5 text-zinc-300"
                          >
                            <span className="truncate pr-2">
                              <span className="text-zinc-500 font-mono mr-1.5">{idx + 1}.</span>
                              {song.title}
                            </span>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0">
                              {song.current_key || song.original_key || 'C'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-zinc-500 italic py-2">No songs added yet.</div>
                      )}
                      {songCount > 4 && (
                        <div className="text-[11px] text-zinc-500 text-center pt-1">+{songCount - 4} more songs</div>
                      )}
                    </div>
                  </div>

                  {/* Bottom actions */}
                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(setlist.updated_at || setlist.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(setlist)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 hover:border-white/20 transition duration-200 cursor-pointer shadow-sm"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                        Edit
                      </button>

                      <Link
                        href={`/stage/${setlist.id}`}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition duration-200 shadow-md shadow-blue-600/20"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        Show Live
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE SETLIST MODAL  (with song picker)
      ═══════════════════════════════════════════════════════════════════════ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#161618] border border-white/10 rounded-2xl shadow-2xl text-white flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-xl font-bold">Create New Setlist</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Name your setlist, add band notes, and pick songs from your library.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Setlist Title *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Sunday Service – Sept 14"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Description / Band Notes <span className="text-zinc-500">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Venue info, key changes, capo notes…"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* ── Song Picker ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-300">
                    Songs <span className="text-zinc-500">(optional — pick from your library)</span>
                  </label>
                  {selectedSongs.length > 0 && (
                    <span className="text-xs font-semibold text-blue-400">
                      {selectedSongs.length} selected
                    </span>
                  )}
                </div>

                {/* Selected songs — ordered queue */}
                {selectedSongs.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {selectedSongs.map((song, idx) => (
                      <div
                        key={song.id}
                        className="flex items-center gap-2 bg-blue-600/10 border border-blue-500/25 rounded-xl px-3 py-2"
                      >
                        <span className="text-[11px] font-mono font-bold text-blue-400 w-5 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium text-white truncate">{song.title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono shrink-0">
                          {song.current_key}
                        </span>
                        <button
                          onClick={() => moveSong(song.id, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveSong(song.id, 'down')}
                          disabled={idx === selectedSongs.length - 1}
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleSong(song.id)}
                          className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Library picker */}
                <div className="bg-zinc-900/60 border border-white/8 rounded-xl overflow-hidden">
                  {/* Picker search */}
                  <div className="relative border-b border-white/8">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search your library…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none"
                    />
                  </div>

                  {/* Song list */}
                  <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
                    {loadingLibrary ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-zinc-500 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading your library…
                      </div>
                    ) : filteredPickerSongs.length === 0 ? (
                      <div className="py-6 text-center text-xs text-zinc-500">
                        {librarySongs.length === 0
                          ? 'Your library is empty. Upload songs in Song Library first.'
                          : 'No songs match your search.'}
                      </div>
                    ) : (
                      filteredPickerSongs.map(song => (
                        <button
                          key={song.id}
                          type="button"
                          onClick={() => toggleSong(song.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            song.selected
                              ? 'bg-blue-600/15 hover:bg-blue-600/20'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          {/* Checkbox */}
                          <span
                            className={`shrink-0 w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-colors ${
                              song.selected
                                ? 'bg-blue-600 border-blue-500'
                                : 'border-zinc-600 bg-transparent'
                            }`}
                          >
                            {song.selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </span>

                          {/* Star indicator */}
                          {song.is_starred && (
                            <Star className="w-3 h-3 text-yellow-400 shrink-0 fill-yellow-400" />
                          )}

                          {/* Title */}
                          <span className="flex-1 text-sm text-white truncate">{song.title}</span>

                          {/* Key badge */}
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 shrink-0">
                            {song.current_key || song.original_key}
                          </span>

                          {/* Selected order badge */}
                          {song.selected && (
                            <span className="text-[10px] font-bold text-blue-400 shrink-0 w-4 text-center">
                              #{song.order}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSetlist}
                disabled={creating || !newTitle.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/25"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Creating…' : 'Create Setlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT SETLIST MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {isEditModalOpen && editingSetlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#161618] border border-white/10 rounded-2xl shadow-2xl text-white flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Edit Setlist</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Update setlist name, notes, and customize songs.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            {loadingEditData ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm">Loading setlist details and songs…</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Setlist Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunday Service – Sept 14"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Description / Band Notes */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Description / Band Notes <span className="text-zinc-500">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Venue info, service notes, band lineup…"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* ── Songs in Setlist ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300">
                      Songs in Setlist ({editSongs.length})
                    </label>
                    <span className="text-[11px] text-zinc-500">
                      Use arrows to reorder or change key
                    </span>
                  </div>

                  {/* Songs list */}
                  {editSongs.length === 0 ? (
                    <div className="p-4 bg-zinc-900/40 border border-dashed border-white/10 rounded-xl text-center text-xs text-zinc-500">
                      No songs in this setlist yet. Select from your library below to add songs.
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {editSongs.map((song, idx) => (
                        <div
                          key={song.id || `${song.title}-${idx}`}
                          className="bg-zinc-900/80 border border-white/10 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            {/* Order */}
                            <span className="text-xs font-mono font-bold text-blue-400 w-5 text-center shrink-0">
                              {idx + 1}
                            </span>

                            {/* Title */}
                            <span className="flex-1 text-sm font-semibold text-white truncate">
                              {song.title}
                            </span>

                            {/* Key selector dropdown */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] text-zinc-400 mr-0.5">Key:</span>
                              <select
                                value={song.current_key || song.original_key || 'C'}
                                onChange={e => changeEditSongKey(idx, e.target.value)}
                                className="bg-zinc-800 border border-white/10 text-blue-300 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                              >
                                {MUSICAL_KEYS.map(k => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Song notes toggle */}
                            <button
                              type="button"
                              onClick={() => setOpenSongNoteIdx(openSongNoteIdx === idx ? null : idx)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                song.notes || openSongNoteIdx === idx
                                  ? 'text-blue-400 bg-blue-500/10'
                                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                              }`}
                              title={song.notes ? `Note: ${song.notes}` : 'Add note for this song'}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Up */}
                            <button
                              type="button"
                              onClick={() => moveEditSong(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                              title="Move Up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              onClick={() => moveEditSong(idx, 'down')}
                              disabled={idx === editSongs.length - 1}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                              title="Move Down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeEditSong(idx)}
                              className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                              title="Remove from Setlist"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Inline song notes editor if opened or has notes */}
                          {(openSongNoteIdx === idx || song.notes) && (
                            <div className="pt-1.5 border-t border-white/5 pl-7 pr-1">
                              <input
                                type="text"
                                placeholder="Notes for this song (e.g., Acoustic intro, Capo 2, Solo after chorus)…"
                                value={song.notes || ''}
                                onChange={e => changeEditSongNotes(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-zinc-950/60 border border-white/10 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Add from Library ── */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-300 mb-2">
                      Add Songs from Library
                    </label>

                    <div className="bg-zinc-900/60 border border-white/10 rounded-xl overflow-hidden">
                      {/* Search */}
                      <div className="relative border-b border-white/8">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search your library songs to add…"
                          value={editPickerSearch}
                          onChange={e => setEditPickerSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none"
                        />
                      </div>

                      {/* Song list */}
                      <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                        {filteredLibrarySongsForEdit.length === 0 ? (
                          <div className="py-6 text-center text-xs text-zinc-500">
                            {librarySongsFull.length === 0
                              ? 'Your song library is empty. Add songs in Song Library first.'
                              : 'No songs match your search.'}
                          </div>
                        ) : (
                          filteredLibrarySongsForEdit.map(song => {
                            const countInSetlist = editSongs.filter(s => s.title === song.title).length;
                            return (
                              <div
                                key={song.id}
                                className="flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {song.is_starred && (
                                    <Star className="w-3 h-3 text-yellow-400 shrink-0 fill-yellow-400" />
                                  )}
                                  <span className="text-xs font-medium text-white truncate">
                                    {song.title}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                                    {song.current_key || song.original_key}
                                  </span>
                                  {countInSetlist > 0 && (
                                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                                      {countInSetlist} in setlist
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => addSongFromLibraryToEdit(song)}
                                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editTitle.trim() || loadingEditData}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
