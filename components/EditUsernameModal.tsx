'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, User, Lock, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface EditUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditUsernameModal({ isOpen, onClose }: EditUsernameModalProps) {
  const { profile, updateUsername } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const changesCount = profile?.username_changes_count ?? 0;
  const isLocked = changesCount >= 1;

  useEffect(() => {
    if (profile?.display_name) {
      setUsername(profile.display_name);
    } else {
      setUsername('');
    }
    setError(null);
    setSuccess(null);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isLocked) {
      setError('You have already updated your username once. Username changes are restricted to once per account.');
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Username cannot be empty.');
      return;
    }

    if (trimmed === profile?.display_name) {
      setError('Please enter a new username different from your current one.');
      return;
    }

    setLoading(true);

    try {
      const res = await updateUsername(trimmed);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update username');
      }
      setSuccess('Username successfully updated!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-2xl p-6 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Set Uploader Username</h2>
            <p className="text-xs text-zinc-400">Customize how your name appears on uploaded charts</p>
          </div>
        </div>

        {/* Status / Notice Box */}
        {isLocked ? (
          <div className="mb-5 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-300">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-200">Username change limit reached</p>
              <p className="text-zinc-400 mt-0.5">
                You have already updated your username once. Usernames can only be edited once per account.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-200/90">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">One-Time Username Edit</p>
              <p className="mt-0.5">
                Note: You can only set or edit your username <strong>once</strong>. Choose carefully as this action cannot be undone.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Display Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLocked || loading}
                placeholder="Enter your public username"
                maxLength={32}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              This name will be displayed as the uploader on your published .crd chord charts.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLocked || loading || !username.trim() || username.trim() === profile?.display_name}
              className="px-5 py-2 text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isLocked ? 'Username Locked' : 'Save Username'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
