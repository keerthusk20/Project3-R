/**
 * Example Usage of Email Verification System
 * This file demonstrates how to use the email verification features
 * in different scenarios within your app
 */

// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { EmailVerificationDisplay } from '../components/EmailVerificationDisplay';
import { auth } from '../services/firebase';
import { emailVerificationService } from '../services/emailVerificationService';

// ============================================================================
// EXAMPLE 1: Check Email Verification Before Granting Access
// ============================================================================

function ProtectedDashboard() {
  const navigate = useNavigate();
  const { isVerified, isLoading, error } = useEmailVerification();

  if (!auth.currentUser) {
    return <div>Not logged in</div>;
  }

  if (isLoading) {
    return <div>Checking email verification status...</div>;
  }

  if (!isVerified) {
    return (
      <EmailVerificationDisplay
        email={auth.currentUser.email || ''}
        isVerified={false}
        variant="inline"
      />
    );
  }

  return <div>Welcome! Your email is verified.</div>;
}

// ============================================================================
// EXAMPLE 2: Show Resend Email Option in Settings
// ============================================================================

function EmailVerificationSettings() {
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const handleResend = async () => {
    if (isResending || cooldownSeconds > 0) return;

    setIsResending(true);
    setMessage('');

    try {
      const result = await emailVerificationService.resendVerificationEmail();

      if (result.success) {
        setMessage('✓ Verification email sent!');
        setCooldownSeconds(result.cooldownRemaining || 60);
      } else {
        setMessage(`✗ ${result.message}`);
        if (result.cooldownRemaining) {
          setCooldownSeconds(result.cooldownRemaining);
        }
      }
    } finally {
      setIsResending(false);
    }

    // Countdown timer
    if (cooldownSeconds > 0) {
      const interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  return (
    <div className="p-4 bg-slate-800 rounded-lg">
      <h3 className="font-semibold mb-4">Email Verification</h3>
      <p className="text-sm text-gray-400 mb-4">
        Email: {auth.currentUser?.email}
      </p>
      <button
        onClick={handleResend}
        disabled={isResending || cooldownSeconds > 0}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded flex items-center gap-2"
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
      {message && <p className="text-sm mt-2 text-blue-300">{message}</p>}
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Custom Verification Check Before Action
// ============================================================================

import { triggerNotification } from '../services/NotificationService';

async function handleCriticalAction() {
  // Check if email is verified before allowing critical actions
  const result = await emailVerificationService.checkEmailVerification();

  if (!result.isVerified) {
    triggerNotification('ERROR', {
      title: 'Email Verification Required',
      message: 'Please verify your email before proceeding.',
    });
    return;
  }

  // Proceed with critical action
  console.log('Action allowed - email verified');
}

// ============================================================================
// EXAMPLE 4: Monitor Email Verification in Real-time
// ============================================================================

function LiveVerificationStatus() {
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // This will update automatically when user verifies email
    // even if the page was open when they clicked the verification link
    const unsubscribe = emailVerificationService.monitorEmailVerification(
      (verified) => {
        setIsVerified(verified);
        if (verified) {
          triggerNotification('SUCCESS', {
            message: 'Email verified successfully!',
          });
        }
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <p>
        Status: {isVerified ? '✓ Verified' : '⏳ Awaiting verification'}
      </p>
      <p className="text-sm text-gray-500 mt-2">
        {isVerified
          ? 'You have full access to all features'
          : 'Verification pending. Check your email for the link.'}
      </p>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Protected Route Component with Email Verification
// ============================================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

function AdvancedProtectedRoute({
  children,
  requireEmailVerification = true,
}: ProtectedRouteProps) {
  const { isVerified, isLoading } = useEmailVerification();
  const user = auth.currentUser;
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (isLoading) {
    return <div className="p-4">Verifying email...</div>;
  }

  if (requireEmailVerification && !isVerified) {
    return (
      <EmailVerificationDisplay
        email={user.email || ''}
        isVerified={false}
        variant="banner"
        onVerified={() => window.location.reload()}
      />
    );
  }

  return <>{children}</>;
}

// Usage:
// <AdvancedProtectedRoute requireEmailVerification={true}>
//   <Dashboard />
// </AdvancedProtectedRoute>

// ============================================================================
// EXAMPLE 6: Admin Panel - View Verification Status
// ============================================================================

async function viewUserVerificationStatus(userId: string) {
  try {
    const verificationState =
      await emailVerificationService.getVerificationState(userId);

    console.log('User Verification Status:', {
      isVerified: verificationState.isVerified,
      emailSent: verificationState.verificationEmailSent,
      lastSent: new Date(verificationState.lastVerificationEmailSent || 0),
      attempts: verificationState.verificationAttempts,
    });
  } catch (error) {
    console.error('Error fetching verification state:', error);
  }
}

// ============================================================================
// EXAMPLE 7: Batch Operations
// ============================================================================

async function resendVerificationsForMultipleUsers(userIds: string[]) {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const result = await emailVerificationService.sendVerificationEmail(
          auth.currentUser
        );
        return {
          userId,
          success: result.success,
          message: result.message,
        };
      } catch (error) {
        return {
          userId,
          success: false,
          message: 'Error sending email',
        };
      }
    })
  );

  return results;
}

// ============================================================================
// EXAMPLE 8: Post-Verification Actions
// ============================================================================

function PostVerificationFlow() {
  const { isVerified } = useEmailVerification();
  const navigate = useNavigate();

  useEffect(() => {
    if (isVerified) {
      // Perform actions after email is verified
      // e.g., unlock features, show onboarding, etc.

      // Example: Update user profile
      const updateUserProfile = async () => {
        try {
          // Your logic here
          console.log('User email verified - updating profile');

          // Navigate to next step
          navigate('/onboarding');
        } catch (error) {
          console.error('Error updating profile:', error);
        }
      };

      updateUserProfile();
    }
  }, [isVerified, navigate]);

  return null;
}

// ============================================================================
// EXAMPLE 9: Error Boundary for Email Verification
// ============================================================================

class EmailVerificationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Email verification error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded">
          <p className="text-red-400 font-semibold">
            Error with email verification
          </p>
          <p className="text-sm text-red-300 mt-2">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage:
// <EmailVerificationErrorBoundary>
//   <YourComponent />
// </EmailVerificationErrorBoundary>

// ============================================================================
// EXPORT FOR IMPORT IN COMPONENTS
// ============================================================================

export {
  ProtectedDashboard,
  EmailVerificationSettings,
  LiveVerificationStatus,
  AdvancedProtectedRoute,
  PostVerificationFlow,
  EmailVerificationErrorBoundary,
};
