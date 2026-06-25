// src/hooks/useProfileGate.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase'; // Adjust path to your config
import { UserProfile, UserRole } from '../types';

export const useProfileGate = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileComplete, setIsProfileComplete] = useState(false);

    useEffect(() => {
        // Listen for Auth State Changes (Login/Logout)
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                // User logged out
                setUser(null);
                setIsLoading(false);
                return;
            }

            try {
                // Check Firestore for Profile Data
                const userRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(userRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as UserProfile;
                    setUser(data);

                    // Define what "Complete" means for your app
                    // Example: Must have Name and Phone
                    const isComplete = !!data.displayName && !!data.phoneNumber;
                    setIsProfileComplete(isComplete);
                } else {
                    // New user, no document exists yet
                    setUser({
                        uid: currentUser.uid,
                        userId: currentUser.uid,
                        email: currentUser.email || '',
                        role: UserRole.CUSTOMER,
                        status: 'active',
                        displayName: currentUser.displayName || '',
                        createdAt: Date.now(),
                        profileCompleted: false,
                    } as UserProfile);
                    setIsProfileComplete(false);
                }
            } catch (error) {
                console.error("Error checking profile:", error);
            } finally {
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Callback to refresh data after successful save
    const refreshProfile = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                setUser(docSnap.data() as UserProfile);
                setIsProfileComplete(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return { user, isLoading, isProfileComplete, refreshProfile };
};