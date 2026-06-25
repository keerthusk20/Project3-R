/**
 * Email Verification Service
 * Handles email verification for Firebase Authentication
 * Production-ready with proper error handling and UX
 */

import {
    auth,
    db,
} from './firebase';
import {
    User,
    sendEmailVerification,
    onAuthStateChanged,
    reload,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

export interface EmailVerificationState {
    isVerified: boolean;
    verificationEmailSent: boolean;
    lastVerificationEmailSent: number | null;
    verificationAttempts: number;
}

export interface VerificationCheckResult {
    isVerified: boolean;
    message: string;
    requiresAction: boolean; // true if email needs to be verified
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const RESEND_EMAIL_COOLDOWN_MS = 60000; // 1 minute
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_COLLECTION = 'email_verifications';

// ─────────────────────────────────────────────────────────────
// EMAIL VERIFICATION SERVICE
// ─────────────────────────────────────────────────────────────

export const emailVerificationService = {
    /**
     * Send verification email to user
     * Includes built-in cooldown to prevent abuse
     */
    sendVerificationEmail: async (user: User | null): Promise<{
        success: boolean;
        message: string;
        cooldownRemaining?: number;
    }> => {
        if (!user) {
            return {
                success: false,
                message: 'No user found. Please sign up first.',
            };
        }

        if (user.emailVerified) {
            return {
                success: false,
                message: 'Email is already verified.',
            };
        }

        try {
            // Check cooldown period
            const verificationDoc = await getDoc(
                doc(db, VERIFICATION_COLLECTION, user.uid)
            );

            if (verificationDoc.exists()) {
                const data = verificationDoc.data();
                const lastSent = data.lastVerificationEmailSent || 0;
                const timeSinceLastEmail = Date.now() - lastSent;

                if (timeSinceLastEmail < RESEND_EMAIL_COOLDOWN_MS) {
                    const cooldownRemaining = Math.ceil(
                        (RESEND_EMAIL_COOLDOWN_MS - timeSinceLastEmail) / 1000
                    );
                    return {
                        success: false,
                        message: `Please wait ${cooldownRemaining}s before requesting another email.`,
                        cooldownRemaining,
                    };
                }

                // Check max attempts
                if (
                    data.verificationAttempts &&
                    data.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS
                ) {
                    return {
                        success: false,
                        message:
                            'Too many verification attempts. Please contact support.',
                    };
                }
            }

            // Send verification email with custom settings
            const actionCodeSettings = {
                url: `${window.location.origin}/verify-email?redirect=/dashboard`,
                handleCodeInApp: false,
            };

            await sendEmailVerification(user, actionCodeSettings);

            // Update verification tracking in Firestore
            await setDoc(
                doc(db, VERIFICATION_COLLECTION, user.uid),
                {
                    uid: user.uid,
                    email: user.email,
                    lastVerificationEmailSent: Date.now(),
                    verificationAttempts: (
                        verificationDoc.data()?.verificationAttempts || 0
                    ) + 1,
                    createdAt: Timestamp.now(),
                },
                { merge: true }
            );

            return {
                success: true,
                message: `Verification email sent to ${user.email}. Please check your inbox and spam folder.`,
            };
        } catch (error: any) {
            console.error('Error sending verification email:', error);
            return {
                success: false,
                message:
                    error.message || 'Failed to send verification email. Try again.',
            };
        }
    },

    /**
     * Check if user's email is verified
     * Refreshes user data from Firebase
     */
    checkEmailVerification: async (): Promise<VerificationCheckResult> => {
        const user = auth.currentUser;

        if (!user) {
            return {
                isVerified: false,
                message: 'No user logged in',
                requiresAction: true,
            };
        }

        try {
            // Reload user data to get latest email verification status
            await reload(user);

            if (user.emailVerified) {
                return {
                    isVerified: true,
                    message: 'Email verified successfully',
                    requiresAction: false,
                };
            }

            return {
                isVerified: false,
                message: 'Please verify your email before proceeding.',
                requiresAction: true,
            };
        } catch (error: any) {
            console.error('Error checking email verification:', error);
            return {
                isVerified: false,
                message: 'Unable to verify email status. Please try again.',
                requiresAction: true,
            };
        }
    },

    /**
     * Monitor email verification status in real-time
     * Useful for showing live updates without page refresh
     */
    monitorEmailVerification: (
        callback: (isVerified: boolean) => void
    ): (() => void) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    await reload(user);
                    callback(user.emailVerified);
                } catch (error) {
                    console.error('Error monitoring email verification:', error);
                    callback(false);
                }
            }
        });

        return unsubscribe;
    },

    /**
     * Get verification state for UI display
     */
    getVerificationState: async (
        userId: string
    ): Promise<EmailVerificationState> => {
        try {
            const verificationDoc = await getDoc(
                doc(db, VERIFICATION_COLLECTION, userId)
            );

            const user = auth.currentUser;
            await reload(user!);

            if (verificationDoc.exists()) {
                const data = verificationDoc.data();
                return {
                    isVerified: user?.emailVerified || false,
                    verificationEmailSent: !!data.lastVerificationEmailSent,
                    lastVerificationEmailSent: data.lastVerificationEmailSent || null,
                    verificationAttempts: data.verificationAttempts || 0,
                };
            }

            return {
                isVerified: user?.emailVerified || false,
                verificationEmailSent: false,
                lastVerificationEmailSent: null,
                verificationAttempts: 0,
            };
        } catch (error: any) {
            console.error('Error getting verification state:', error);
            return {
                isVerified: false,
                verificationEmailSent: false,
                lastVerificationEmailSent: null,
                verificationAttempts: 0,
            };
        }
    },

    /**
     * Resend verification email with cooldown check
     */
    resendVerificationEmail: async (): Promise<{
        success: boolean;
        message: string;
        cooldownRemaining?: number;
    }> => {
        return await emailVerificationService.sendVerificationEmail(
            auth.currentUser
        );
    },

    /**
     * Helper: Format remaining time for display
     */
    formatCooldownTime: (seconds: number): string => {
        if (seconds <= 0) return 'Ready';
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.ceil(seconds / 60);
        return `${minutes}m`;
    },

    /**
     * Clean up verification data (optional - for testing)
     */
    clearVerificationData: async (userId: string): Promise<void> => {
        try {
            await getDoc(doc(db, VERIFICATION_COLLECTION, userId)).then(
                async (docSnap) => {
                    if (docSnap.exists()) {
                        await updateDoc(doc(db, VERIFICATION_COLLECTION, userId), {
                            verificationAttempts: 0,
                            lastVerificationEmailSent: null,
                        });
                    }
                }
            );
        } catch (error: any) {
            console.error('Error clearing verification data:', error);
        }
    },
};

export default emailVerificationService;