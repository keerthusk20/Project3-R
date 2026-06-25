/**
 * Email Verification Page
 * Users land here after clicking the verification link
 * Shows verification status and redirects on success
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { auth } from '../services/firebase';
import { reload, applyActionCode } from "firebase/auth";

type VerificationStatus = 'checking' | 'verified' | 'unverified' | 'error';

const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>('checking');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [loading, setLoading] = useState(false);

  const processedRef = React.useRef(false);

  const getRedirectPath = () => {
    const redirect = searchParams.get('redirect') || searchParams.get('continueUrl') || '/';
    let targetPath = redirect;

    if (redirect.includes('localhost:3000')) {
      const parts = redirect.split('3000');
      targetPath = parts[1] || '/';
    } else if (redirect.includes('regibiz.cloudmasa.com')) {
      const parts = redirect.split('.com');
      targetPath = parts[1] || '/';
    }

    if (targetPath.startsWith('/#')) targetPath = targetPath.substring(2);
    if (targetPath.startsWith('#')) targetPath = targetPath.substring(1);

    // Safety check: ensure path is local
    if (targetPath.startsWith('http')) return '/';
    return targetPath || '/';
  };

  useEffect(() => {
    // 🛡️ PREVENT DOUBLE EXECUTION
    if (processedRef.current) return;
    processedRef.current = true;

    const verifyEmail = async () => {
      try {
        setLoading(true);
        setStatus('checking');

        // 🔍 ROBUST PARAMETER EXTRACTION
        let oobCode = '';

        const urlParams = new URLSearchParams(window.location.search);
        oobCode = urlParams.get('oobCode') || '';

        if (!oobCode) {
          oobCode = searchParams.get('oobCode') || '';
        }

        if (!oobCode) {
          const href = window.location.href;
          const match = href.match(/[?&]oobCode=([^&#]+)/);
          if (match) oobCode = match[1];
        }

        if (!oobCode) {
          console.error('❌ No oobCode found in URL:', window.location.href);
          setStatus('error');
          setMessage('Invalid verification link. No verification code found.');
          return;
        }

        console.log('🔐 Initiating Firebase verification...');

        // Apply the verification code using Firebase Auth
        await applyActionCode(auth, oobCode);
        console.log('✅ Firebase applyActionCode Success');

        // Reload user to get updated emailVerified status
        const user = auth.currentUser;
        if (user) {
          await reload(user).catch(e => console.warn('User reload failed, but verification might still be fine:', e));
          setUserEmail(user.email || '');
          console.log('✅ Email verified for:', user.email);
        }

        setStatus('verified');
        setMessage('Email verified successfully!');

        // Auto-redirect after 3 seconds
        setTimeout(() => {
          navigate(getRedirectPath());
        }, 3000);

      } catch (error: any) {
        console.error('❌ Firebase Verification Error:', error);
        setStatus('error');

        // Handle specific Firebase Auth errors
        if (error.code === 'auth/expired-action-code') {
          setMessage('Verification link has expired. Please request a new one.');
        } else if (error.code === 'auth/invalid-action-code') {
          setMessage('Invalid or already used verification link.');
        } else if (error.code === 'auth/user-disabled') {
          setMessage('This account has been disabled.');
        } else if (error.code === 'auth/user-not-found') {
          setMessage('No user found for this verification link.');
        } else {
          setMessage(error.message || 'Verification failed. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [navigate, searchParams]);

  // Auto-redirect countdown effect
  useEffect(() => {
    if (status === 'verified' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (status === 'verified' && countdown === 0) {
      navigate(getRedirectPath());
    }
  }, [status, countdown, navigate]);

  const handleManualRedirect = () => {
    navigate(getRedirectPath());
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-md p-6">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center text-center mb-8 group">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full group-hover:bg-cyan-500/30 transition-all"></div>
              <img
                src="/roundmasa.webp"
                alt="RegiBIZ Logo"
                className="w-10 h-20 rounded-lg object-contain relative z-10 group-hover:scale-105 transition-transform mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to tracking-tight drop-shadow-sm">
                RegiBIZ
              </span>
              <div className="flex items-center gap-0.5 ml-7">
                <span className="text-[9px] font-bold tracking-wider text-gray-200">by</span>
                <span className="text-[14px] font-extrabold tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Cloud</span>
                  <span className="text-orange-500 ml-0.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">MaSa</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-panel rounded-2xl p-1 shadow-2xl">
          <div className="px-8 py-12 text-center">
            {/* Status Icon */}
            {status === 'checking' && (
              <Loader2 className="w-16 h-16 mx-auto mb-6 text-blue-500 animate-spin" />
            )}
            {status === 'verified' && (
              <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-green-500" />
            )}
            {status === 'unverified' && (
              <AlertCircle className="w-16 h-16 mx-auto mb-6 text-amber-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="w-16 h-16 mx-auto mb-6 text-red-500" />
            )}

            {/* Heading */}
            {status === 'checking' && (
              <h2 className="text-2xl font-bold text-white mb-2">
                Verifying Email...
              </h2>
            )}
            {status === 'verified' && (
              <h2 className="text-2xl font-bold text-green-400 mb-2">
                Email Verified!
              </h2>
            )}
            {status === 'unverified' && (
              <h2 className="text-2xl font-bold text-amber-400 mb-2">
                Verification Pending
              </h2>
            )}
            {status === 'error' && (
              <h2 className="text-2xl font-bold text-red-400 mb-2">
                Verification Error
              </h2>
            )}

            {/* Message */}
            <div className="mb-6">
              {status === 'checking' && (
                <p className="text-gray-400">
                  Please wait while we verify your email...
                </p>
              )}
              {status === 'verified' && (
                <div>
                  <p className="text-gray-300 mb-2">{message}</p>
                  {userEmail && (
                    <p className="text-sm text-gray-400">
                      Verified email: <span className="font-semibold text-green-400">{userEmail}</span>
                    </p>
                  )}
                </div>
              )}
              {status === 'unverified' && (
                <div>
                  <p className="text-gray-300 mb-2">{message}</p>
                  <p className="text-sm text-gray-400 mt-3">
                    Check your email for the verification link. If you don't see
                    it, check your spam folder.
                  </p>
                </div>
              )}
              {status === 'error' && (
                <p className="text-red-300">{message}</p>
              )}
            </div>

            {/* Countdown / Buttons */}
            {status === 'verified' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Redirecting in{' '}
                  <span className="font-bold text-green-400">{countdown}s</span>
                </p>
                <button
                  onClick={handleManualRedirect}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  Continue Now <ArrowRight size={16} />
                </button>
              </div>
            )}

            {status === 'unverified' && (
              <div>
                <button
                  onClick={() => navigate('/auth')}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all"
                >
                  Back to Login
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={() => navigate('/auth')}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
                >
                  Back to Login
                </button>
              </div>
            )}

            {status === 'checking' && (
              <button
                onClick={() => navigate('/auth')}
                className="w-full px-4 py-3 mt-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Footer Help */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>
            Questions?{' '}
            <a
              href="mailto:support@cloudmasa.com"
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;