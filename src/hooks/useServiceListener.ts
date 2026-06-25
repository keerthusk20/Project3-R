import { useState, useEffect } from 'react';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../services/firebase'; // Adjust path
import { ServiceApplication } from '../types';

export const useServiceListener = (serviceId: string | null) => {
    const [service, setService] = useState<ServiceApplication | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!serviceId) {
            setService(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // 🔥 REAL-TIME LISTENER
        const unsubscribe = onSnapshot(
            doc(db, 'applications', serviceId), // Assuming collection name is 'applications'
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as DocumentData;
                    // Map Firestore data to your TypeScript Interface
                    setService({
                        id: docSnap.id,
                        ...data,
                        // Ensure timestamps are handled correctly if needed
                    } as ServiceApplication);
                } else {
                    setService(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error listening to service:", err);
                setError("Failed to load service details.");
                setLoading(false);
            }
        );

        // Cleanup listener when component unmounts or serviceId changes
        return () => unsubscribe();
    }, [serviceId]);

    return { service, loading, error };
};