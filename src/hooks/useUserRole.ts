// src/hooks/useUserRole.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase'; // Your real Firebase config
import { UserRole } from '../types';

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      try {
        if (firebaseUser) {
          // Fetch user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userRole = userData.role as UserRole;
            setRole(userRole);
          } else {
            // User exists in Auth but not in Firestore → treat as unauthenticated
            setRole(null);
          }
        } else {
          // No Firebase user → clear role
          setRole(null);
        }
      } catch (err: any) {
        console.error('Failed to fetch user role:', err);
        setError(err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    role,
    loading,
    error,
    isStaff: role === UserRole.SUPERADMIN || role === UserRole.ADMIN || role === UserRole.SUPPORT,
    isSuperAdmin: role === UserRole.SUPERADMIN,
    isAdmin: role === UserRole.ADMIN,
    isSupport: role === UserRole.SUPPORT,
    isCustomer: role === UserRole.CUSTOMER,
  };
};