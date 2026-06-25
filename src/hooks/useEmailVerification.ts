/**
 * useEmailVerification Hook
 * Provides email verification utilities for components
 * Usage: const { isVerified, sendVerification, checkVerification } = useEmailVerification();
 */

import { useState, useCallback, useEffect } from 'react';
import { auth } from '../services/firebase';
import { emailVerificationService } from '../services/emailVerificationService';
import { reload } from 'firebase/auth';

export interface UseEmailVerificationReturn {
  isVerified: boolean;
  isLoading: boolean;
  error: string | null;
  cooldownSeconds: number;
  sendVerificationEmail: () => Promise<boolean>;
  checkVerification: () => Promise<boolean>;
  monitorVerification: (callback: (verified: boolean) => void) => () => void;
  formatTime: (seconds: number) => string;
}

export const useEmailVerification = (): UseEmailVerificationReturn => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Initialize verification status
  useEffect(() => {
    const checkInitial = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          await reload(user);
          setIsVerified(user.emailVerified);
        }
      } catch (err) {
        console.error('Error checking initial verification:', err);
      }
    };

    checkInitial();
  }, []);

  // Handle cooldown countdown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const sendVerificationEmail = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await emailVerificationService.sendVerificationEmail(
        auth.currentUser
      );

      if (result.success) {
        if (result.cooldownRemaining) {
          setCooldownSeconds(result.cooldownRemaining);
        }
        return true;
      } else {
        setError(result.message);
        if (result.cooldownRemaining) {
          setCooldownSeconds(result.cooldownRemaining);
        }
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to send verification email';
      setError(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkVerification = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await emailVerificationService.checkEmailVerification();

      if (result.isVerified) {
        setIsVerified(true);
        setError(null);
        return true;
      } else {
        setIsVerified(false);
        if (result.requiresAction) {
          setError(result.message);
        }
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to check email verification';
      setError(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const monitorVerification = useCallback(
    (callback: (verified: boolean) => void): (() => void) => {
      const unsubscribe = emailVerificationService.monitorEmailVerification(
        (verified) => {
          setIsVerified(verified);
          callback(verified);
        }
      );
      return unsubscribe;
    },
    []
  );

  const formatTime = useCallback((seconds: number): string => {
    return emailVerificationService.formatCooldownTime(seconds);
  }, []);

  return {
    isVerified,
    isLoading,
    error,
    cooldownSeconds,
    sendVerificationEmail,
    checkVerification,
    monitorVerification,
    formatTime,
  };
};

export default useEmailVerification;
