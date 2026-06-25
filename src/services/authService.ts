import { auth, db } from './firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    updateProfile,
    reload,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

export const authService = {
    async loginWithEmail(email: string, password?: string): Promise<UserProfile> {
        if (!password) throw new Error("Password is required");
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await reload(user);
        if (!user.emailVerified && !email.endsWith('@cloudmasa.com') && email !== 'demo@gmail.com') {
            // Allow cloudmasa devs and demo account to skip verification
            // await signOut(auth);
            // throw new Error("Email not verified. Please check your inbox.");
        }

        const profile = await this.getUserProfile(user.uid);
        if (!profile) throw new Error("User profile not found.");

        // Auto-verify demo account if needed
        if (profile.email === 'demo@gmail.com' && !profile.emailVerified) {
            profile.emailVerified = true;
            await this.updateUserProfile(user.uid, { emailVerified: true });
        }

        if (profile.status === 'blocked') {
            await signOut(auth);
            throw new Error("This account has been deactivated.");
        }
        return profile;
    },

    async registerWithEmail(email: string, password: string, displayName: string, customerId: string, phone: string): Promise<void> {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });

        const newUser: UserProfile = {
            uid: userCredential.user.uid,
            email: email,
            displayName: displayName,
            phoneNumber: phone,
            customerId: customerId,
            role: UserRole.CUSTOMER,
            status: 'active',
            userId: 'USR-' + userCredential.user.uid.substring(0, 6).toUpperCase(),
            createdAt: Date.now(),
            provider: 'password'
        };

        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);

        const actionCodeSettings = {
            url: `${window.location.origin}/#/verify-email`,
            handleCodeInApp: true,
        };
        await sendEmailVerification(userCredential.user, actionCodeSettings);
        await signOut(auth);
    },

    async loginWithGoogle(): Promise<UserProfile> {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        const fbUser = result.user;

        const profile = await this.getUserProfile(fbUser.uid);
        if (profile) return profile;

        // Create new profile if it doesn't exist
        const newProfile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'User',
            role: UserRole.CUSTOMER,
            status: 'active',
            userId: 'USR-' + fbUser.uid.substring(0, 6).toUpperCase(),
            createdAt: Date.now(),
            emailVerified: fbUser.emailVerified || fbUser.email === 'demo@gmail.com' || false,
            provider: 'google.com'
        };
        await setDoc(doc(db, 'users', fbUser.uid), newProfile);
        return newProfile;
    },

    async getUserProfile(uid: string): Promise<UserProfile | null> {
        const docRef = doc(db, 'users', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return { uid: snap.id, ...snap.data() } as UserProfile;
        }
        return null;
    },

    async logout(): Promise<void> {
        await signOut(auth);
    },

    subscribeToAuth(callback: (user: UserProfile | null) => void) {
        let unsubscribeProfile: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }

            if (!user) {
                callback(null);
                return;
            }

            // Initial fetch
            const profile = await this.getUserProfile(user.uid);
            if (profile) {
                callback(profile);
            } else {
                // Fallback for new users or if profile doesn't exist yet
                callback({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || 'User',
                    role: UserRole.CUSTOMER,
                    status: 'active',
                    userId: 'USR-NEW',
                    createdAt: Date.now()
                });
            }

            // Set up real-time listener for profile changes
            unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                if (snap.exists()) {
                    callback({ uid: user.uid, ...snap.data() } as UserProfile);
                }
            });
        });

        return () => {
            if (unsubscribeProfile) unsubscribeProfile();
            unsubscribeAuth();
        };
    },

    async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
        const userDocRef = doc(db, 'users', uid);
        await setDoc(userDocRef, { ...data, updatedAt: Date.now() }, { merge: true });

        if (data.displayName && auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: data.displayName });
        }
    },

    async reloadUser(): Promise<void> {
        if (auth.currentUser) {
            await reload(auth.currentUser);
        }
    },

    async createInternalUser(userData: {
        email: string;
        password: string;
        displayName: string;
        role: UserRole;
        invitedBy: string;
    }): Promise<void> {
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const newUser: UserProfile = {
            uid: userCredential.user.uid,
            email: userData.email,
            displayName: userData.displayName,
            role: userData.role,
            status: 'invited',
            userId: 'USR-' + userCredential.user.uid.substring(0, 6).toUpperCase(),
            createdAt: Date.now(),
            invitedBy: userData.invitedBy,
            invitedAt: Date.now(),
            isTemporaryPassword: true,
            provider: 'password'
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        await updateProfile(userCredential.user, { displayName: userData.displayName });
    }
};
