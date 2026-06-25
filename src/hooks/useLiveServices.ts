// src/hooks/useLiveServices.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase'; // Adjust path
import { ServiceApplication } from '../types';

export const useLiveServices = (userId: string | null) => {
    const [services, setServices] = useState<ServiceApplication[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setServices([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // 🔥 REAL-TIME LISTENER FOR ALL SERVICES
        const q = query(
            collection(db, 'applications'), // Your collection name
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const liveServices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ServiceApplication[];

            setServices(liveServices);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return { services, loading };
};