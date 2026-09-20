'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, Music, FileText, ChevronRight, User as UserIcon, Trash2, Upload, Loader2 } from 'lucide-react';
import {
  PublicSong,
  slugify,
  getSongSlug,
  getSongArtist,
  getUploaderName,
  deletePublicSong,
  fetchMyPublicSongs,
} from '@/lib/library-service';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';

interface PublicChordsClientProps {
  initialSongs: PublicSong[];
}

type ActiveTab = 'all' | 'my-uploads';

export default function PublicChordsClient({ initialSongs }: PublicChordsClientProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [songsList, setSongsList] = useState<PublicSong[]>(initialSongs);
  const [myUploadsList, setMyUploadsList] = useState<PublicSong[]>([]);
  const [loadingMyUploads, setLoadingMyUploads] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string>('ALL');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load My Uploads when tab is clicked and user is logged in
  useEffect(() => {
    if (activeTab === 'my-uploads' && user) {
      setLoadingMyUploads(true);
      fetchMyPublicSongs()
        .then(setMyUploadsList)
        .finally(() => setLoadingMyUploads(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  const filteredSongs = useMemo(() => {
    const source = activeTab === 'all' ? songsList : myUploadsList;
    return source.filter((song) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        song.title.toLowerCase().includes(q) ||
        (song.artist && song.artist.toLowerCase().includes(q)) ||
        (song.raw_text && song.raw_text.toLowerCase().includes(q));

      const matchKey = selectedKey === 'ALL' || (song.current_key || song.original_key || 'C') === selectedKey;

      return matchQuery && matchKey;
    });
  }, [songsList, myUploadsList, activeTab, searchQuery, selectedKey]);

  const uniqueKeys = useMemo(() => {
    const source = activeTab === 'all' ? songsList : myUploadsList;
    const keys = new Set<string>();
    source.forEach((s) => keys.add(s.current_key || s.original_key || 'C'));
    return Array.from(keys).sort();
  }, [songsList, myUploadsList, activeTab]);

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'my-uploads' && !user) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedKey('ALL');
  };

  const handleDeleteMyUpload = async (song: PublicSong, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Remove "${song.title}" from the public directory? It will no longer be visible to other users.`)) {
      return;
    }

    setDeletingId(song.id);
    try {
      await deletePublicSong(song.id);
      setMyUploadsList((prev) => prev.filter((s) => s.id !== song.id));
      // Also update the all-songs list in the current session
      setSongsList((prev) => prev.filter((s) => s.id !== song.id));
    } catch (err: any) {
      alert(`Failed to remove: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const SongCard = ({ song, showDelete }: { song: PublicSong; showDelete?: boolean }) => {
    const artistName = getSongArtist(song);
    const artistSlug = slugify(artistName);
    const songSlug = getSongSlug(song.title, song.artist || artistName);
    const href = `/chords/${artistSlug}/${songSlug}`;
    const uploaderName = getUploaderName(song, user?.id);
    const isDeleting = deletingId === song.id;

    return (
      <div className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 rounded-2xl p-5 transition duration-200 shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between">
        <Link href={href} className="block">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-white group-hover:text-amber-400 transition text-lg line-clamp-1">
              {song.title}
            </h3>
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              Key {song.current_key || song.original_key || 'C'}
            </span>
          </div>
          <p className="text-sm text-slate-400 font-medium mb-3">{artistName}</p>
        </Link>

        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              <UserIcon className="w-3 h-3 text-amber-400" />
              By <strong className="text-slate-200 font-semibold ml-0.5">{uploaderName}</strong>
            </span>

            {showDelete && (
              <button
                onClick={(e) => handleDeleteMyUpload(song, e)}
                disabled={isDeleting}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                title="Remove from public directory"
              >
                {isDeleting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
              </button>
            )}
          </div>

          <Link href={href} className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Interactive .crd Chart
            </span>
            <span className="text-amber-400/80 font-medium group-hover:translate-x-0.5 transition flex items-center gap-0.5">
              View Chart <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="relative max-w-2xl mx-auto mb-8">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by song title, artist, or lyrics..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-xl transition"
        />
      </div>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 max-w-sm mx-auto mb-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-1">
        <button
          onClick={() => handleTabChange('all')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition ${
            activeTab === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Songs
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'all' ? 'bg-slate-950/20' : 'bg-slate-800 text-slate-300'}`}>
            {songsList.length}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('my-uploads')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition ${
            activeTab === 'my-uploads'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          My Uploads
          {user && myUploadsList.length > 0 && (
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'my-uploads' ? 'bg-slate-950/20' : 'bg-slate-800 text-slate-300'}`}>
              {myUploadsList.length}
            </span>
          )}
        </button>
      </div>

      {/* Key Filters */}
      {uniqueKeys.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 text-xs">
          <span className="text-slate-500 font-medium mr-1">Filter Key:</span>
          <button
            onClick={() => setSelectedKey('ALL')}
            className={`px-3 py-1.5 rounded-xl border transition ${
              selectedKey === 'ALL'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                : 'border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            All
          </button>
          {uniqueKeys.map((k) => (
            <button
              key={k}
              onClick={() => setSelectedKey(k)}
              className={`px-3 py-1.5 rounded-xl border transition ${
                selectedKey === k
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                  : 'border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              Key of {k}
            </button>
          ))}
        </div>
      )}

      {/* My Uploads — loading */}
      {activeTab === 'my-uploads' && loadingMyUploads && (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span className="text-sm">Loading your uploads...</span>
        </div>
      )}

      {/* Songs Grid */}
      {(!loadingMyUploads || activeTab === 'all') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left max-w-6xl mx-auto px-4 pb-20">
          {filteredSongs.length > 0 ? (
            filteredSongs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                showDelete={activeTab === 'my-uploads'}
              />
            ))
          ) : activeTab === 'all' ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <Music className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="text-lg font-semibold text-slate-400">No chord charts found</p>
              <p className="text-sm mt-1">
                {searchQuery ? 'Try a different search term.' : 'Be the first to publish a chord chart from your Library!'}
              </p>
            </div>
          ) : !loadingMyUploads ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="text-lg font-semibold text-slate-400">
                {searchQuery ? 'No matching uploads' : "You haven't published any songs yet"}
              </p>
              <p className="text-sm mt-1">
                {searchQuery ? 'Try a different search term.' : 'Go to your Library, select songs, and click "Make Public".'}
              </p>
              <Link
                href="/library"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition"
              >
                Go to My Library
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

