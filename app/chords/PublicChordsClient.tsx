'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Upload, Music, FileText, ChevronRight, User as UserIcon, Trash2 } from 'lucide-react';
import { LibrarySong, slugify, getSongSlug, getUploaderName, deleteLibrarySong } from '@/lib/library-service';
import PublicCrdUploader from '@/components/PublicCrdUploader';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';

interface PublicChordsClientProps {
  initialSongs: LibrarySong[];
}

export default function PublicChordsClient({ initialSongs }: PublicChordsClientProps) {
  const { user } = useAuth();
  const [songsList, setSongsList] = useState<LibrarySong[]>(initialSongs);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string>('ALL');
  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const filteredSongs = useMemo(() => {
    return songsList.filter((song) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        song.title.toLowerCase().includes(q) ||
        (song.artist && song.artist.toLowerCase().includes(q)) ||
        (song.raw_text && song.raw_text.toLowerCase().includes(q));

      const matchKey = selectedKey === 'ALL' || (song.current_key || song.original_key || 'C') === selectedKey;

      return matchQuery && matchKey;
    });
  }, [songsList, searchQuery, selectedKey]);

  const uniqueKeys = useMemo(() => {
    const keys = new Set<string>();
    songsList.forEach((s) => keys.add(s.current_key || s.original_key || 'C'));
    return Array.from(keys).sort();
  }, [songsList]);

  const handleUploadClick = () => {
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      setShowUploader(true);
    }
  };

  const handleDeleteSong = async (song: LibrarySong, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to remove your upload "${song.title}"?`)) {
      return;
    }

    try {
      await deleteLibrarySong(song.id);
      setSongsList((prev) => prev.filter((s) => s.id !== song.id));
    } catch (err: any) {
      alert(`Failed to delete song: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Search Bar & Upload CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto mb-10">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by song title, artist, or lyrics..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-xl transition"
          />
        </div>
        <button
          onClick={handleUploadClick}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          Upload .crd File
        </button>
      </div>

      {/* Auth Modal Trigger */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      {/* Uploader Modal */}
      {showUploader && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <PublicCrdUploader
            onClose={() => setShowUploader(false)}
            onSuccess={() => {
              setShowUploader(false);
              window.location.reload();
            }}
          />
        </div>
      )}

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

      {/* Songs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left max-w-6xl mx-auto px-4 pb-20">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => {
            const artistName = song.artist || 'Traditional';
            const artistSlug = slugify(artistName);
            const songSlug = getSongSlug(song.title, song.artist || undefined);
            const href = `/chords/${artistSlug}/${songSlug}`;
            const uploaderName = getUploaderName(song, user?.id);
            const isOwner = user && song.user_id === user.id;

            return (
              <div
                key={song.id}
                className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 rounded-2xl p-5 transition duration-200 shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
              >
                <Link href={href} className="block">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-white group-hover:text-amber-400 transition text-lg line-clamp-1">
                      {song.title}
                    </h3>
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                      Key {song.current_key || song.original_key || 'C'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 font-medium mb-3">
                    {artistName}
                  </p>
                </Link>

                {/* Uploader Badge & Actions */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                      <UserIcon className="w-3 h-3 text-amber-400" />
                      Uploaded by <strong className="text-slate-200 font-semibold">{uploaderName}</strong>
                    </span>

                    {isOwner && (
                      <button
                        onClick={(e) => handleDeleteSong(song, e)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete your uploaded chart"
                      >
                        <Trash2 className="w-4 h-4" />
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
          })
        ) : (
          <div className="col-span-full py-16 text-center text-slate-500">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-lg font-semibold text-slate-400">No chord charts found</p>
            <p className="text-sm mt-1">Be the first to upload a <code className="text-amber-400">.crd</code> file for this song!</p>
            <button
              onClick={handleUploadClick}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition"
            >
              Upload .crd Chart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
