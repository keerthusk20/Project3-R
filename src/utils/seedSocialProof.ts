/**
 * Run this once to seed the Firestore settings/socialProof document.
 * After running, admins can update reviewRating and reviewCount directly
 * in the Firebase Console → Firestore → settings → socialProof
 *
 * Usage: import and call seedSocialProof() from a one-time admin action,
 * OR just create the document manually in the Firebase Console.
 */

import { db } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const seedSocialProofDoc = async () => {
    const ref = doc(db, 'settings', 'socialProof');
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        await setDoc(ref, {
            customerCount: 1250,   // Number of happy customers
            reviewRating: 4.8,     // Google star rating (0-5)
            reviewCount: 1250,     // Number of Google reviews
            updatedAt: Date.now(),
        });
        console.log('✅ settings/socialProof document created.');
    } else {
        console.log('ℹ️ settings/socialProof already exists:', snap.data());
    }
};
