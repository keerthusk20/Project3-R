/**
 * Email Verification Alert Component
 * Friendly, informational alert for when email verification is required
 * Not styled as an error, but as a helpful informational message
 */

import React, { useState } from 'react';
import { Mail, InfoIcon, RefreshCw, Loader2 } from 'lucide-react';
import { emailVerificationService } from '../services/emailVerificationService';
import { auth } from '../services/firebase';

interface EmailVerificationAlertProps {
  email: string;
  onResendSuccess?: () => void;
  variant?: 'compact' | 'full';
  showResendButton?: boolean;
}

export const EmailVerificationAlert: React.FC<EmailVerificationAlertProps> = ({
  email,
  onResendSuccess,
  variant = 'full',
  showResendButton = true,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Handle cooldown countdown
  React.useEffect(() => {
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
        if (onResendSuccess) onResendSuccess();
      } else {
        setResendMessage(`${result.message}`);
        if (result.cooldownRemaining) {
          setCooldownSeconds(result.cooldownRemaining);
        }
      }
    } catch (error: any) {
      setResendMessage('Unable to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Compact variant - minimal design
  if (variant === 'compact') {
    return (
      <div className="mb-4 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Mail className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-200">
              Verify Your Email
            </p>
            <p className="text-xs text-blue-300 mt-1">
              We sent a verification link to <span className="font-semibold">{email}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full variant - with resend button and more details
  return (
    <div className="mb-4 p-4 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-blue-500/10 border border-blue-400/30 rounded-xl animate-fade-in shadow-lg shadow-blue-500/5">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-400/30">
            <InfoIcon className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-blue-200 mb-1">
            Email Verification Required
          </h4>
          <p className="text-xs text-blue-300 mb-3">
            We've sent a verification link to <span className="font-medium text-blue-100">{email}</span>. 
            Please check your inbox (and spam folder) to complete verification.
          </p>

          {/* Action Buttons */}
          {showResendButton && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResendEmail}
                disabled={isResending || cooldownSeconds > 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all active:scale-95"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </>
                ) : cooldownSeconds > 0 ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Resend in {cooldownSeconds}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Resend Email
                  </>
                )}
              </button>

              {/* Resend status message */}
              {resendMessage && (
                <span className={`text-xs font-medium ${
                  resendMessage.includes('✓') 
                    ? 'text-green-300' 
                    : 'text-blue-300'
                }`}>
                  {resendMessage}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="mt-3 pt-3 border-t border-blue-400/20">
        <p className="text-xs text-blue-300/70">
          💡 <span className="font-medium">Tip:</span> Check your spam/junk folder if you don't see the email. You can also proceed to login once verification is complete.
        </p>
      </div>
    </div>
  );
};

export default EmailVerificationAlert;
