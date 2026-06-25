/**
 * Email Verification Component
 * Displays verification status and allows users to resend verification email
 * Used during registration flow and login
 */

import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '../services/firebase';
import { emailVerificationService } from '../services/emailVerificationService';

interface EmailVerificationDisplayProps {
  email: string;
  isVerified?: boolean;
  onVerified?: () => void;
  showResendButton?: boolean;
  variant?: 'inline' | 'modal' | 'banner';
}

export const EmailVerificationDisplay: React.FC<
  EmailVerificationDisplayProps
> = ({
  email,
  isVerified = false,
  onVerified,
  showResendButton = true,
  variant = 'inline',
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [verified, setVerified] = useState(isVerified);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  // Monitor email verification in real-time
  useEffect(() => {
    const unsubscribe = emailVerificationService.monitorEmailVerification(
      (isEmailVerified) => {
        setVerified(isEmailVerified);
        if (isEmailVerified && onVerified) {
          onVerified();
        }
      }
    );

    return () => unsubscribe();
  }, [onVerified]);

  // Handle cooldown countdown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResendEmail = async () => {
    if (isResending || cooldownSeconds > 0) return;

    setIsResending(true);
    setResendMessage('');

    try {
      const result = await emailVerificationService.resendVerificationEmail();

      if (result.success) {
        setResendMessage('✓ Verification email sent! Check your inbox.');
        setCooldownSeconds(result.cooldownRemaining || 60);
      } else {
        setResendMessage(`✗ ${result.message}`);
        if (result.cooldownRemaining) {
          setCooldownSeconds(result.cooldownRemaining);
        }
      }
    } catch (error: any) {
      setResendMessage('✗ Failed to resend email. Try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsCheckingVerification(true);
    try {
      const result = await emailVerificationService.checkEmailVerification();
      setVerified(result.isVerified);
      if (result.isVerified && onVerified) {
        onVerified();
      }
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Inline variant
  if (variant === 'inline') {
    return (
      <div
        className={`p-4 rounded-lg border transition-all ${
          verified
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="flex items-start gap-3">
          {verified ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <Mail className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          )}

          <div className="flex-1">
            {verified ? (
              <div>
                <p className="font-semibold text-green-100">Email Verified ✓</p>
                <p className="text-sm text-green-200 mt-1">
                  Your email has been verified successfully.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-amber-100">
                  Verify Your Email
                </p>
                <p className="text-sm text-amber-200 mt-1">
                  A verification link has been sent to{' '}
                  <span className="font-medium">{email}</span>. Click the link
                  to verify your email.
                </p>
                {showResendButton && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleResendEmail}
                      disabled={
                        isResending ||
                        cooldownSeconds > 0 ||
                        isCheckingVerification
                      }
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Sending...
                        </>
                      ) : cooldownSeconds > 0 ? (
                        `Resend in ${cooldownSeconds}s`
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          Resend Email
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCheckVerification}
                      disabled={isCheckingVerification || isResending}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-blue-200 text-xs font-medium rounded transition-colors"
                    >
                      {isCheckingVerification ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'I verified my email'
                      )}
                    </button>
                  </div>
                )}
                {resendMessage && (
                  <p className="text-xs mt-2 text-amber-300">{resendMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner variant
  if (variant === 'banner') {
    if (verified) return null;

    return (
      <div className="w-full bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-white flex-1">
            <Mail className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Verify your email to continue</p>
              <p className="text-sm opacity-90">
                Check {email} for the verification link
              </p>
            </div>
          </div>
          {showResendButton && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResendEmail}
                disabled={isResending || cooldownSeconds > 0}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-medium rounded transition-colors flex items-center gap-2"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : cooldownSeconds > 0 ? (
                  `Resend in ${cooldownSeconds}s`
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Resend
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modal variant
  return (
    <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full mx-4 border border-slate-800">
        <div className="text-center">
          {verified ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Email Verified!
              </h2>
              <p className="text-gray-400 mb-6">
                Your email has been verified successfully. You can now access
                all features.
              </p>
              <button
                onClick={onVerified}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Verify Your Email
              </h2>
              <p className="text-gray-400 mb-6">
                We've sent a verification link to{' '}
                <span className="font-semibold text-white">{email}</span>
              </p>
              {showResendButton && (
                <button
                  onClick={handleResendEmail}
                  disabled={isResending || cooldownSeconds > 0}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    `Resend in ${cooldownSeconds}s`
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Resend Verification Email
                    </>
                  )}
                </button>
              )}
              {resendMessage && (
                <p className="text-sm mt-4 text-amber-300">{resendMessage}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationDisplay;
