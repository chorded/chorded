'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import NavBar from '@/components/NavBar';
import AuthModal from '@/components/auth/AuthModal';
import {
  LibrarySong,
  fetchLibrarySongs,
  uploadLibrarySongs,
  toggleStarSong,
  deleteLibrarySong,
  downloadSongAsCrd,
  addSongToSetlist,
  getUploaderName,
} from '@/lib/library-service';
import {
  fetchUserSetlists,
  createSetlist,
  Setlist,
} from '@/lib/setlist-service';
import {
  Star,
  FileText,
  Upload,
  Search,
  Trash2,
  Download,
  Plus,
  ListPlus,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  X,
  Music,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import Link from 'next/link';
import ChordChartView from '@/components/ChordChartView';

type SortField = 'name' | 'date' | 'key' | 'star';
type SortOrder = 'asc' | 'desc';

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();

  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeyFilter, setSelectedKeyFilter] = useState<string>('ALL');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal State
  const [previewSong, setPreviewSong] = useState<LibrarySong | null>(null);

  // Add to Setlist Modal State (single & batch)
  const [addToSetlistSong, setAddToSetlistSong] = useState<LibrarySong | null>(null);
  const [batchAddToSetlistSongs, setBatchAddToSetlistSongs] = useState<LibrarySong[] | null>(null);
  const [userSetlists, setUserSetlists] = useState<Setlist[]>([]);
  const [loadingSetlists, setLoadingSetlists] = useState(false);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>('');
  const [newSetlistTitle, setNewSetlistTitle] = useState('');
  const [isCreatingNewSetlist, setIsCreatingNewSetlist] = useState(false);
  const [addingToSetlist, setAddingToSetlist] = useState(false);
  const [setlistSuccessMsg, setSetlistSuccessMsg] = useState<string | null>(null);

  const loadSongs = async () => {
    if (!user) return;
    try {
      setLoadingSongs(true);
      const data = await fetchLibrarySongs();
      setSongs(data);
    } catch (err) {
      console.error('Failed to load library songs:', err);
    } finally {
      setLoadingSongs(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setIsAuthModalOpen(true);
      } else {
        loadSongs();
      }
    }
  }, [user, authLoading]);

  // Handle Star Toggle
  const handleToggleStar = async (song: LibrarySong, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !song.is_starred;
    // Optimistic UI update
    setSongs((prev) =>
      prev.map((s) => (s.id === song.id ? { ...s, is_starred: newStatus } : s))
    );
    if (previewSong && previewSong.id === song.id) {
      setPreviewSong({ ...previewSong, is_starred: newStatus });
    }

    try {
      await toggleStarSong(song.id, newStatus);
    } catch (err) {
      // Revert on error
      console.error('Failed to toggle star:', err);
      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, is_starred: !newStatus } : s))
      );
    }
  };

  // Handle Delete
  const handleDeleteSong = async (song: LibrarySong, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to remove "${song.title}" from your library?`)) {
      return;
    }
    try {
      await deleteLibrarySong(song.id);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(song.id); return n; });
      if (previewSong?.id === song.id) {
        setPreviewSong(null);
      }
    } catch (err: any) {
      alert(`Failed to delete song: ${err.message}`);
    }
  };

  // Batch selection helpers
  const toggleSelectSong = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Batch delete
  const handleBatchDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected song${count > 1 ? 's' : ''} from your library? This cannot be undone.`)) return;
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteLibrarySong(id);
      } catch {
        failed++;
      }
    }
    // Remove successfully deleted songs
    setSongs((prev) => prev.filter((s) => !ids.includes(s.id) || (failed > 0 && ids.indexOf(s.id) >= ids.length - failed)));
    setSelectedIds(new Set());
    if (failed > 0) alert(`${failed} song(s) could not be deleted.`);
  };

  // Batch download
  const handleBatchDownload = () => {
    const toDownload = songs.filter((s) => selectedIds.has(s.id));
    toDownload.forEach((s) => downloadSongAsCrd(s));
    clearSelection();
  };

  // Open batch add-to-setlist modal
  const openBatchAddToSetlistModal = async () => {
    const toAdd = songs.filter((s) => selectedIds.has(s.id));
    setBatchAddToSetlistSongs(toAdd);
    setSetlistSuccessMsg(null);
    setIsCreatingNewSetlist(false);
    setNewSetlistTitle('');
    try {
      setLoadingSetlists(true);
      const lists = await fetchUserSetlists();
      setUserSetlists(lists);
      if (lists.length > 0) setSelectedSetlistId(lists[0].id);
    } catch (err) {
      console.error('Error fetching setlists:', err);
    } finally {
      setLoadingSetlists(false);
    }
  };

  // Confirm batch add to setlist
  const handleConfirmBatchAddToSetlist = async () => {
    if (!user || !batchAddToSetlistSongs) return;
    try {
      setAddingToSetlist(true);
      let targetSetlistId = selectedSetlistId;
      if (isCreatingNewSetlist) {
        if (!newSetlistTitle.trim()) { alert('Please enter a setlist name.'); return; }
        const created = await createSetlist(user.id, newSetlistTitle.trim());
        targetSetlistId = created.id;
      }
      if (!targetSetlistId) { alert('Please select or create a setlist.'); return; }
      for (const song of batchAddToSetlistSongs) {
        await addSongToSetlist(targetSetlistId, song);
      }
      setSetlistSuccessMsg(`${batchAddToSetlistSongs.length} song${batchAddToSetlistSongs.length > 1 ? 's' : ''} added to setlist!`);
      setTimeout(() => {
        setBatchAddToSetlistSongs(null);
        setSetlistSuccessMsg(null);
        clearSelection();
      }, 1400);
    } catch (err: any) {
      alert(`Failed to add songs to setlist: ${err.message}`);
    } finally {
      setAddingToSetlist(false);
    }
  };

  // Handle Upload
  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const invalid = files.filter(f => !f.name.toLowerCase().endsWith('.crd'));
    if (invalid.length > 0) {
      setUploadError('Only .crd files are allowed for upload.');
      setUploadFiles([]);
      return;
    }
    setUploadFiles(files);
    setUploadError(null);
  };

  const handleUploadSubmit = async () => {
    if (!user || uploadFiles.length === 0) return;

    try {
      setIsUploading(true);
      setUploadError(null);

      const fileContents = await Promise.all(
        uploadFiles.map(
          (file) =>
            new Promise<{ name: string; content: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                resolve({ name: file.name, content: event.target?.result as string });
              };
              reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
              reader.readAsText(file);
            })
        )
      );

      const inserted = await uploadLibrarySongs(user.id, fileContents);
      setSongs((prev) => [...inserted, ...prev]);
      setIsUploadModalOpen(false);
      setUploadFiles([]);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload score files.');
    } finally {
      setIsUploading(false);
    }
  };

  // Add to Setlist Flow
  const openAddToSetlistModal = async (song: LibrarySong, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddToSetlistSong(song);
    setBatchAddToSetlistSongs(null);
    setSetlistSuccessMsg(null);
    setIsCreatingNewSetlist(false);
    setNewSetlistTitle('');
    try {
      setLoadingSetlists(true);
      const lists = await fetchUserSetlists();
      setUserSetlists(lists);
      if (lists.length > 0) {
        setSelectedSetlistId(lists[0].id);
      }
    } catch (err) {
      console.error('Error fetching setlists:', err);
    } finally {
      setLoadingSetlists(false);
    }
  };

  const handleConfirmAddToSetlist = async () => {
    if (!user || !addToSetlistSong) return;

    try {
      setAddingToSetlist(true);
      let targetSetlistId = selectedSetlistId;

      if (isCreatingNewSetlist) {
        if (!newSetlistTitle.trim()) {
          alert('Please enter a setlist name.');
          return;
        }
        const created = await createSetlist(user.id, newSetlistTitle.trim());
        targetSetlistId = created.id;
      }

      if (!targetSetlistId) {
        alert('Please select or create a setlist.');
        return;
      }

      await addSongToSetlist(targetSetlistId, addToSetlistSong);
      setSetlistSuccessMsg('Song successfully added to setlist!');
      setTimeout(() => {
        setAddToSetlistSong(null);
        setSetlistSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      alert(`Failed to add song to setlist: ${err.message}`);
    } finally {
      setAddingToSetlist(false);
    }
  };

  // NOTE: filteredAndSortedSongs is defined below the sort helper
  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Filter and Sort Logic
  const filteredAndSortedSongs = songs
    .filter((song) => {
      // Search filter
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.original_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (song.notes && song.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (song.raw_text && song.raw_text.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Key filter
      if (selectedKeyFilter !== 'ALL') {
        const keyMatch = (song.current_key || song.original_key || '').toUpperCase();
        if (keyMatch !== selectedKeyFilter.toUpperCase()) return false;
      }

      // Starred filter
      if (onlyStarred && !song.is_starred) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortField === 'name') {
        const cmp = a.title.localeCompare(b.title);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'date') {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'key') {
        const keyA = a.current_key || a.original_key || '';
        const keyB = b.current_key || b.original_key || '';
        const cmp = keyA.localeCompare(keyB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'star') {
        const starA = a.is_starred ? 1 : 0;
        const starB = b.is_starred ? 1 : 0;
        return sortOrder === 'asc' ? starA - starB : starB - starA;
      }
      return 0;
    });

  // Derived selection state (must be after filteredAndSortedSongs is defined)
  const allVisibleSelected =
    filteredAndSortedSongs.length > 0 &&
    filteredAndSortedSongs.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedSongs.map((s) => s.id)));
    }
  };

  // Date Formatter: "Sep 4, 2026, 10:55 AM"
  const formatDateUploaded = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const keyBadgesList = ['ALL', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  return (
    <div className="min-h-screen bg-[#080B14] text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <NavBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                My Library
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                CLOUD CHARTS
              </span>
            </div>
            <p className="mt-1.5 text-zinc-400 text-sm">
              Upload, organize, and manage your Chorded <code className="text-blue-400">.crd</code> song charts. Star favorites and add charts straight to setlists.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setUploadError(null);
                setUploadFiles([]);
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition duration-200 cursor-pointer shadow-lg shadow-blue-600/25"
            >
              <Upload className="w-4 h-4" />
              Upload .crd Files
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search song name or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#101626] border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Starred Filter Button */}
            <button
              onClick={() => setOnlyStarred(!onlyStarred)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                onlyStarred
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-[#101626] border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
              Starred Only
            </button>
          </div>

          {/* Key Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 self-start md:self-auto text-xs">
            <span className="text-zinc-500 mr-1 text-[11px] uppercase tracking-wider font-semibold">
              Key:
            </span>
            {keyBadgesList.map((k) => (
              <button
                key={k}
                onClick={() => setSelectedKeyFilter(k)}
                className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold transition cursor-pointer ${
                  selectedKeyFilter === k
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#101626] text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loadingSongs && user && (
          <div className="mt-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Loading songs from cloud library...</p>
          </div>
        )}

        {/* Unauthenticated State */}
        {!authLoading && !user && (
          <div className="mt-16 text-center bg-[#101626]/60 border border-white/10 rounded-2xl p-10 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Sign in to Access Your Library</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Create an account or sign in to upload, store, and view your .crd chord charts in the cloud.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition duration-200 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loadingSongs && user && filteredAndSortedSongs.length === 0 && (
          <div className="mt-16 text-center bg-[#101626]/50 border border-white/10 rounded-2xl p-12 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {searchQuery || selectedKeyFilter !== 'ALL' || onlyStarred
                ? 'No matching songs found'
                : 'Your Library is Empty'}
            </h3>
            <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
              {searchQuery || selectedKeyFilter !== 'ALL' || onlyStarred
                ? 'Try adjusting your filters or search keywords.'
                : 'Upload your .crd score files exported from the Chorded desktop app to access them anywhere.'}
            </p>
            <button
              onClick={() => {
                setUploadError(null);
                setUploadFiles([]);
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <Upload className="w-4 h-4" />
              Upload .crd Files
            </button>
          </div>
        )}

        {/* Batch Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
              <CheckSquare className="w-4 h-4" />
              <span>{selectedIds.size} selected</span>
            </div>
            <div className="flex-1" />
            <button
              onClick={openBatchAddToSetlistModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5" />
              Add to Setlist
            </button>
            <button
              onClick={handleBatchDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold border border-white/10 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download All
            </button>
            <button
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Table View Matching Desktop App Screenshot */}
        {!loadingSongs && filteredAndSortedSongs.length > 0 && (
          <div className="mt-6 border border-[#1b233a] rounded-xl bg-[#0b101e] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {/* Table Header */}
                <thead>
                  <tr className="border-b border-[#1b233a] bg-[#0d1428] text-[11px] font-bold text-zinc-400 uppercase tracking-wider select-none">
                    {/* Select All Checkbox */}
                    <th className="py-3.5 pl-4 pr-2 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center justify-center w-4 h-4 rounded border border-zinc-600 hover:border-blue-400 transition cursor-pointer"
                        title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allVisibleSelected && <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />}
                        {!allVisibleSelected && selectedIds.size > 0 && filteredAndSortedSongs.some(s => selectedIds.has(s.id)) && (
                          <div className="w-2.5 h-0.5 rounded bg-blue-400" />
                        )}
                      </button>
                    </th>
                    <th
                      className="py-3.5 px-4 w-14 text-center cursor-pointer hover:text-white"
                      onClick={() => handleSort('star')}
                    >
                      STAR
                    </th>
                    <th
                      className="py-3.5 px-4 cursor-pointer hover:text-white group"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>NAME</span>
                        <ArrowUpDown className="w-3 h-3 text-zinc-500 group-hover:text-white" />
                      </div>
                    </th>
                    <th
                      className="py-3.5 px-6 w-24 text-center cursor-pointer hover:text-white group"
                      onClick={() => handleSort('key')}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>KEY</span>
                        <ArrowUpDown className="w-3 h-3 text-zinc-500 group-hover:text-white" />
                      </div>
                    </th>
                    <th
                      className="py-3.5 px-6 w-60 cursor-pointer hover:text-white group"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>DATE UPLOADED</span>
                        <ArrowUpDown className="w-3 h-3 text-zinc-500 group-hover:text-white" />
                      </div>
                    </th>
                    <th className="py-3.5 px-6 w-44 text-right">
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-[#151c31] text-sm">
                  {filteredAndSortedSongs.map((song) => {
                    const songKey = song.current_key || song.original_key || 'C';
                    const isSelected = selectedIds.has(song.id);
                    return (
                      <tr
                        key={song.id}
                        onClick={() => setPreviewSong(song)}
                        className={`group transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/8 hover:bg-blue-600/12'
                            : 'hover:bg-[#12192e]'
                        }`}
                      >
                        {/* CHECKBOX */}
                        <td className="py-3.5 pl-4 pr-2 text-center">
                          <button
                            onClick={(e) => toggleSelectSong(song.id, e)}
                            className={`flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer ${
                              isSelected
                                ? 'border-blue-500 bg-blue-600'
                                : 'border-zinc-600 hover:border-blue-400 bg-transparent'
                            }`}
                            title={isSelected ? 'Deselect' : 'Select'}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </td>

                        {/* STAR */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={(e) => handleToggleStar(song, e)}
                            className="p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                            title={song.is_starred ? 'Unstar song' : 'Star song'}
                          >
                            <Star
                              className={`w-4 h-4 transition-colors ${
                                song.is_starred
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-zinc-600 hover:text-amber-400'
                              }`}
                            />
                          </button>
                        </td>

                        {/* NAME */}
                        <td className="py-3.5 px-4 font-medium">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-zinc-400 group-hover:text-blue-400 shrink-0 transition-colors" />
                            <span className="text-zinc-100 group-hover:text-blue-300 font-semibold transition-colors">
                              {song.title}
                            </span>
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                              By {getUploaderName(song, user?.id)}
                            </span>
                            {song.notes && (
                              <span className="text-xs text-zinc-500 truncate max-w-[200px] hidden lg:inline">
                                ({song.notes})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* KEY */}
                        <td className="py-3.5 px-6 text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-[#2563eb] text-white text-xs font-bold font-mono shadow-sm">
                            {songKey}
                          </span>
                        </td>

                        {/* DATE UPLOADED */}
                        <td className="py-3.5 px-6 text-zinc-400 text-xs font-medium">
                          {formatDateUploaded(song.created_at)}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            {/* Preview */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewSong(song);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                              title="Preview Song Chart"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Add to Setlist */}
                            <button
                              onClick={(e) => openAddToSetlistModal(song, e)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title="Add to Setlist"
                            >
                              <ListPlus className="w-4 h-4" />
                            </button>

                            {/* Download .crd */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadSongAsCrd(song);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Download .crd File"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={(e) => handleDeleteSong(song, e)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete from Library"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer counter */}
            <div className="px-6 py-3 bg-[#0d1428] border-t border-[#1b233a] flex items-center justify-between text-xs text-zinc-400">
              <div>
                Showing <span className="text-white font-semibold">{filteredAndSortedSongs.length}</span> of{' '}
                <span className="text-white font-semibold">{songs.length}</span> songs in library
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-500">
                  {songs.filter((s) => s.is_starred).length} Starred
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#111626] border border-white/10 rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-white">Upload .crd Scores to Library</h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Select one or multiple <code className="text-blue-400">.crd</code> score files or JSON charts from your computer.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  handleFilesSelected(Array.from(e.dataTransfer.files));
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/15 hover:border-blue-500/50 bg-[#0c101d] hover:bg-[#0f1424]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".crd,.json,.txt,.chordpro"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesSelected(Array.from(e.target.files));
                  }
                }}
                className="hidden"
              />
              <Upload className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">
                {uploadFiles.length > 0
                  ? `${uploadFiles.length} file(s) selected`
                  : 'Click to choose files or drop them here'}
              </p>
              <p className="text-xs text-zinc-400 mt-1.5">
                Accepts Chorded <code className="text-blue-400">.crd</code> score files, single songs, or bulk charts
              </p>
            </div>

            {/* Selected files list */}
            {uploadFiles.length > 0 && (
              <div className="mt-4 p-3 bg-[#0a0d18] rounded-xl border border-white/5 max-h-40 overflow-y-auto space-y-1 text-xs">
                {uploadFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-zinc-300 py-1 px-2 rounded bg-white/5">
                    <span className="truncate flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {f.name}
                    </span>
                    <span className="text-[10px] text-zinc-500">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-5 mt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={uploadFiles.length === 0 || isUploading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload to Cloud Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SONG PREVIEW MODAL */}
      {previewSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-5xl bg-[#0b0e1a] border border-white/15 rounded-2xl shadow-2xl text-white flex flex-col max-h-[94vh] overflow-hidden">
            {/* Modal Top Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-4 bg-[#0e1324]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white truncate">{previewSong.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
                    <span>Uploaded {formatDateUploaded(previewSong.created_at)}</span>
                    <span>• Interactive Live Chord Chart</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleToggleStar(previewSong, e)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-amber-400 transition"
                  title={previewSong.is_starred ? 'Starred' : 'Star song'}
                >
                  <Star
                    className={`w-4 h-4 ${
                      previewSong.is_starred ? 'fill-amber-400 text-amber-400' : ''
                    }`}
                  />
                </button>
                <button
                  onClick={() => setPreviewSong(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Interactive Live Chord Chart */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#060812]">
              <ChordChartView
                song={previewSong}
                maxWidthClass="max-w-full"
                onKeyChange={(newKey) => {
                  setPreviewSong((prev) => (prev ? { ...prev, current_key: newKey } : null));
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0e1324] border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={() => downloadSongAsCrd(previewSong)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold border border-white/10 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-zinc-400" />
                Download .crd
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    const s = previewSong;
                    setPreviewSong(null);
                    openAddToSetlistModal(s, e);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 transition cursor-pointer"
                >
                  <ListPlus className="w-4 h-4" />
                  Add to Setlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD TO SETLIST MODAL (single or batch) */}
      {(addToSetlistSong || batchAddToSetlistSongs) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#111626] border border-white/15 rounded-2xl p-6 shadow-2xl text-white">
            <h3 className="text-lg font-bold text-white mb-1">Add to Setlist</h3>
            <p className="text-xs text-zinc-400 mb-4">
              {batchAddToSetlistSongs ? (
                <>Add <span className="text-blue-400 font-semibold">{batchAddToSetlistSongs.length} songs</span> to an existing or new cloud setlist.</>
              ) : (
                <>Add <span className="text-blue-400 font-semibold">"{addToSetlistSong!.title}"</span> to an existing or new cloud setlist.</>
              )}
            </p>

            {/* Song list preview for batch */}
            {batchAddToSetlistSongs && batchAddToSetlistSongs.length > 0 && (
              <div className="mb-4 max-h-28 overflow-y-auto space-y-1">
                {batchAddToSetlistSongs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-zinc-300 py-1 px-2.5 rounded-lg bg-white/5">
                    <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate">{s.title}</span>
                    <span className="ml-auto text-zinc-500 font-mono">{s.current_key || s.original_key}</span>
                  </div>
                ))}
              </div>
            )}

            {setlistSuccessMsg ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{setlistSuccessMsg}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {!isCreatingNewSetlist ? (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Select Setlist
                    </label>
                    {loadingSetlists ? (
                      <div className="py-4 text-center text-xs text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" />
                        Loading setlists...
                      </div>
                    ) : userSetlists.length > 0 ? (
                      <select
                        value={selectedSetlistId}
                        onChange={(e) => setSelectedSetlistId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#090c17] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        {userSetlists.map((sl) => (
                          <option key={sl.id} value={sl.id}>
                            {sl.title} ({sl.songs?.length || 0} songs)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-zinc-400 italic py-2">
                        You have no setlists yet. Create one below!
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSetlist(true)}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Or create a new setlist
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      New Setlist Title
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Sunday Morning Worship"
                      value={newSetlistTitle}
                      onChange={(e) => setNewSetlistTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#090c17] border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    {userSetlists.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewSetlist(false)}
                        className="mt-2 text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        Back to existing setlists
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { setAddToSetlistSong(null); setBatchAddToSetlistSongs(null); }}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={batchAddToSetlistSongs ? handleConfirmBatchAddToSetlist : handleConfirmAddToSetlist}
                    disabled={addingToSetlist || (isCreatingNewSetlist && !newSetlistTitle.trim())}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
                  >
                    {addingToSetlist && <Loader2 className="w-4 h-4 animate-spin" />}
                    {batchAddToSetlistSongs ? `Add ${batchAddToSetlistSongs.length} Songs` : 'Add Song'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
