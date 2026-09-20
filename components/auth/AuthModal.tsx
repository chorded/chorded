'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Mail, Key, AlertCircle, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithLicenseKey, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signInWithLicenseKey(email, licenseKey);
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      console.error('License key sign-in error:', err);
      const msg = err.message || '';
      setError(msg || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.message?.toLowerCase().includes('not enabled') || err.message?.toLowerCase().includes('unsupported provider')) {
        setError('Google login is not enabled yet. Please use your Gumroad license key to sign in.');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
      setLoading(false);
    }
  };

  // --- OTP Sent Screen ---
  if (otpSent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
        <div
          className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-2xl p-8 shadow-2xl text-white text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>

          <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We sent a magic sign-in link to{' '}
            <span className="text-white font-semibold">{email}</span>.
            <br />
            Click the link in that email to access your setlists.
          </p>
          <p className="text-xs text-zinc-500 mt-4">
            The link expires in 10 minutes. Check your spam folder if you don't see it.
          </p>

          <button
            onClick={onClose}
            className="mt-6 w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-medium text-sm rounded-xl transition duration-200 cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // --- Main Sign In Screen ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Key className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Pro Access</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Enter your email and Gumroad license key to access your setlists
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="leading-relaxed">{error}</p>
                {(error.toLowerCase().includes('license') || error.toLowerCase().includes('gumroad') || error.toLowerCase().includes('subscription')) && (
                  <a
                    href="https://gumroad.com/l/chorded"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2"
                  >
                    Get Chorded Pro on Gumroad
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email"
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* License Key */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Gumroad License Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-license-key"
                type="text"
                required
                placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Find your key in your Gumroad purchase confirmation email.
            </p>
          </div>

          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Verifying...' : 'Access My Setlists'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <span className="relative px-3 bg-[#161618] text-xs uppercase tracking-wider text-zinc-500">
            or continue with
          </span>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          id="auth-google"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-medium text-sm rounded-xl transition duration-200 flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.5l2.9-2.9C17 2 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.6 2.8C6.4 7.2 8.9 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.6 2.8c2.1-2 3.8-5 3.8-8.8z" />
            <path fill="#FBBC05" d="M5.5 14.9c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.6-2.8z" />
            <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.6-2.8c-1.1.7-2.5 1.2-4.4 1.2-3.1 0-5.6-2.2-6.5-5.1L1.9 16.6C3.7 20.4 7.5 23.5 12 23.5z" />
          </svg>
          Google
        </button>

        {/* Footer note */}
        <p className="mt-5 text-center text-[11px] text-zinc-500">
          Don't have Chorded Pro?{' '}
          <a
            href="https://gumroad.com/l/chorded"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-semibold"
          >
            Get it on Gumroad →
          </a>
        </p>
      </div>
    </div>
  );
}
