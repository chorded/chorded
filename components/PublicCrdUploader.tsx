'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { parseUploadedSetlistFile } from '@/lib/setlist-service';
import { supabase } from '@/lib/supabase';
import { getSongSlug } from '@/lib/library-service';

import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import EditUsernameModal from '@/components/EditUsernameModal';

interface PublicCrdUploaderProps {
  userId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function PublicCrdUploader({ userId: propUserId, onSuccess, onClose }: PublicCrdUploaderProps) {
  const { user, profile } = useAuth();
  const currentUserId = propUserId || user?.id;
  const [isEditUsernameOpen, setIsEditUsernameOpen] = useState(false);

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File; content: string } | null>(null);
  const [title, setTitle] = useState<string>('');
  const [artist, setArtist] = useState<string>('');
  const [key, setKey] = useState<string>('C');
  const [bpm, setBpm] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (files.length === 0) return;
    const file = files[0];

    // Enforce strict .crd extension requirement
    if (!file.name.toLowerCase().endsWith('.crd')) {
      setErrorMsg('Only .crd files are accepted for upload.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setErrorMsg('The selected .crd file is empty.');
        return;
      }

      setSelectedFile({ file, content: text });

      // Parse metadata from file
      const parsed = parseUploadedSetlistFile(text, file.name);
      if (parsed.songs && parsed.songs.length > 0) {
        const firstSong = parsed.songs[0];
        setTitle(firstSong.title || file.name.replace(/\.crd$/i, ''));
        setKey(firstSong.current_key || firstSong.original_key || 'C');
        if (firstSong.bpm) setBpm(firstSong.bpm.toString());

        // Extract artist from songData or ChordPro directives / text headers
        const extractedArtist = firstSong.artist || (text.match(/^\{(?:artist|a|author|by)\s*:\s*(.*?)\}$/m) || text.match(/^(?:artist|author|by)\s*:\s*(.+)$/im))?.[1]?.trim();
        if (extractedArtist) {
          setArtist(extractedArtist);
        }
      } else {
        setTitle(file.name.replace(/\.crd$/i, ''));
      }
    };

    reader.onerror = () => {
      setErrorMsg('Failed to read the .crd file.');
    };

    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a .crd file first.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Song title is required.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const parsed = parseUploadedSetlistFile(selectedFile.content, selectedFile.file.name);
      const songData = parsed.songs[0] || {};
      const songArtist = artist.trim() || 'Traditional';
      const slug = getSongSlug(title.trim(), songArtist);

      const payload = {
        user_id: currentUserId,
        title: title.trim(),
        artist: songArtist,
        slug,
        is_public: isPublic,
        original_key: key || songData.original_key || 'C',
        current_key: key || songData.current_key || 'C',
        bpm: bpm ? parseInt(bpm, 10) : songData.bpm || null,
        time_signature: songData.time_signature || null,
        content: songData.content || { type: 'doc', content: [] },
        raw_text: selectedFile.content,
        notes: songData.notes || '',
        is_starred: false,
      };

      let insertRes = await supabase
        .from('library_songs')
        .insert(payload)
        .select()
        .single();

      if (insertRes.error) {
        console.warn('Initial insert error (possibly missing schema columns):', insertRes.error.message);
        // Fallback insert without artist, slug, is_public columns
        const fallbackPayload = {
          user_id: currentUserId,
          title: title.trim(),
          original_key: key || songData.original_key || 'C',
          current_key: key || songData.current_key || 'C',
          bpm: bpm ? parseInt(bpm, 10) : songData.bpm || null,
          time_signature: songData.time_signature || null,
          content: songData.content || { type: 'doc', content: [] },
          raw_text: selectedFile.content,
          notes: songData.notes || '',
          is_starred: false,
        };

        insertRes = await supabase
          .from('library_songs')
          .insert(fallbackPayload)
          .select()
          .single();

        if (insertRes.error) {
          throw new Error(insertRes.error.message || 'Failed to publish song');
        }
      }

      // If marked public, publish to public_songs table as well
      if (isPublic && insertRes.data && currentUserId) {
        try {
          const uploaderName = profile?.display_name?.trim() || user?.email?.split('@')[0] || null;
          const publicPayload = {
            user_id: currentUserId,
            uploader_name: uploaderName,
            library_song_id: insertRes.data.id,
            title: title.trim(),
            artist: songArtist !== 'Traditional' ? songArtist : null,
            slug,
            original_key: key || songData.original_key || 'C',
            current_key: key || songData.current_key || 'C',
            bpm: bpm ? parseInt(bpm, 10) : songData.bpm || null,
            time_signature: songData.time_signature || null,
            content: songData.content || { type: 'doc', content: [] },
            raw_text: selectedFile.content,
            notes: songData.notes || '',
          };
          let { error: pubErr } = await supabase.from('public_songs').insert(publicPayload);
          if (pubErr && pubErr.message?.includes('uploader_name')) {
            const { uploader_name, ...fallbackPayload } = publicPayload;
            const fallbackRes = await supabase.from('public_songs').insert(fallbackPayload);
            if (fallbackRes.error) console.error('Error inserting into public_songs table (fallback):', fallbackRes.error);
          } else if (pubErr) {
            console.error('Error inserting into public_songs table:', pubErr);
          }
        } catch (pubErr) {
          console.error('Failed to publish to public_songs:', pubErr);
        }
      }

      setSuccessMsg(`Successfully uploaded "${title}"! Viewable at /chords/${slugify(songArtist)}/${slugify(title)}-chords`);
      setIsUploading(false);

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMsg(err.message || 'Failed to process and upload .crd file.');
      setIsUploading(false);
    }
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // If user is not authenticated, show sign-in prompt
  if (!user && !propUserId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 max-w-xl w-full shadow-2xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Sign In Required to Upload</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Only signed-in members can publish and manage chord charts. Create your account or sign in to share your <code className="text-amber-400 font-mono">.crd</code> files.
          </p>
          <div className="flex items-center justify-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold text-sm hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
            >
              Sign In / Register
            </button>
          </div>
        </div>
        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 max-w-xl w-full shadow-2xl relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Upload .crd Chord Chart</h2>
          <p className="text-xs text-slate-400">Publish your .crd file so musicians can search and view it online</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
        <span className="text-slate-400">
          Uploading as: <strong className="text-amber-300 font-semibold">{profile?.display_name || user?.email?.split('@')[0] || 'Member'}</strong>
        </span>
        <button
          type="button"
          onClick={() => setIsEditUsernameOpen(true)}
          className="text-amber-400 hover:text-amber-300 font-medium text-[11px] underline underline-offset-2 cursor-pointer"
        >
          {(profile?.username_changes_count ?? 0) < 1 ? 'Edit username (1 edit left)' : 'View username'}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleUploadSubmit} className="space-y-4">
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              dragActive
                ? 'border-amber-500 bg-amber-500/5'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".crd"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Click or drag & drop your <span className="text-amber-400 font-bold">.crd</span> file here
              </p>
              <p className="text-xs text-slate-500 mt-1">Accepts strictly .crd format chord files</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-white">{selectedFile.file.name}</p>
                <p className="text-xs text-slate-400">{(selectedFile.file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800 transition"
            >
              Change file
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Song Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hotel California"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Artist / Band</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Eagles"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. Bm"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">BPM (Optional)</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder="e.g. 120"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-200">Publish to Public Directory</span>
              <p className="text-xs text-slate-400">Allows anyone to find and view this song via Google search</p>
            </div>
          </label>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isUploading ? 'Uploading...' : 'Publish .crd Chart'}
          </button>
        </div>
      </form>
      <EditUsernameModal isOpen={isEditUsernameOpen} onClose={() => setIsEditUsernameOpen(false)} />
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
