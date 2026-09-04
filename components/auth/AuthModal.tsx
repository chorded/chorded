'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showResend, setShowResend] = useState(false);

  if (!isOpen) return null;

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResendingEmail(true);
    setError(null);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setSuccessMessage(`A new confirmation email has been sent to ${email}. Please check your inbox and spam folder.`);
      setShowResend(false);
    } catch (err: any) {
      setError(err.message || 'Failed to resend confirmation email.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setShowResend(false);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error, data } = await signUpWithEmail(email, password, displayName);
        if (error) throw error;
        
        // Check if session was returned immediately (Confirm Email disabled)
        if (data?.session) {
          onClose();
        } else if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
          // Supabase returns empty identities if email is already registered
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setSuccessMessage(
            'Account created! Please check your email inbox (and spam folder) to confirm your account before signing in.'
          );
        }
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Your email has not been confirmed yet. Please check your inbox (and spam folder) for the confirmation link to activate your account.');
        setShowResend(true);
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(msg || 'An error occurred. Please try again.');
      }
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
        setError('Google login is not enabled in your Supabase dashboard yet. Go to Supabase -> Authentication -> Providers -> Google to enable it.');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
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
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Create Chorded Account'}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {mode === 'signin'
              ? 'Access your saved setlists and stage runner'
              : 'Save setlists to the cloud and run gigs from any device'}
          </p>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="leading-relaxed">{error}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendingEmail}
                    className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                  >
                    {resendingEmail && <Loader2 className="w-3 h-3 animate-spin" />}
                    Resend confirmation link to {email || 'my email'}
                  </button>
                )}
                {(error.toLowerCase().includes('gumroad') || error.toLowerCase().includes('subscription')) && (
                  <a
                    href="#pricing"
                    onClick={() => onClose()}
                    className="mt-2.5 inline-block text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2"
                  >
                    View Pricing & Plans →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
            {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Display Name / Band Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Worship Band or Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
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
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-medium text-sm rounded-xl transition duration-200 flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.7 0 3 .7 3.9 1.5l2.9-2.9C17 2 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.6 2.8C6.4 7.2 8.9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.6 2.8c2.1-2 3.8-5 3.8-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.5 14.9c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.6-2.8z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.2 0 6-1.1 8-3l-3.6-2.8c-1.1.7-2.5 1.2-4.4 1.2-3.1 0-5.6-2.2-6.5-5.1L1.9 16.6C3.7 20.4 7.5 23.5 12 23.5z"
            />
          </svg>
          Google
        </button>

        {/* Switch Mode Footer */}
        <div className="mt-6 text-center text-xs text-zinc-400">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('signup');
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 ml-1"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('signin');
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 ml-1"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
