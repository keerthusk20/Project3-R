// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { mockAuthService } from '../services/mockFirebase';
import { UserProfile } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = mockAuthService.subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
};