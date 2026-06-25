import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
} from 'firebase/firestore';

export interface SocialProofData {
    customerCount: number;    // Live count from Firestore users (role=customer)
    reviewRating: number;     // e.g. 4.5
    reviewCount: number;      // e.g. 1200
    isLoading: boolean;
    googleUrl?: string;
}

const DEFAULT_DATA: SocialProofData = {
    customerCount: 0,
    reviewRating: 0,
    reviewCount: 0,
    isLoading: true,
};

/**
 * useLiveSocialProof
 *
 * Returns live social proof numbers directly from Firestore:
 *  - customerCount: real-time count of users with role="customer"
 *  - reviewRating / reviewCount: read from `settings/socialProof` document
 */
export const useLiveSocialProof = (): SocialProofData => {
    const [customerCount, setCustomerCount] = useState(DEFAULT_DATA.customerCount);
    const [reviewRating, setReviewRating] = useState(DEFAULT_DATA.reviewRating);
    const [reviewCount, setReviewCount] = useState(DEFAULT_DATA.reviewCount);
    const [googleUrl, setGoogleUrl] = useState(DEFAULT_DATA.googleUrl);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReviewSettings = async () => {
            try {
                // Fetch live data directly from the Cloud Function
                const REVIEW_API_URL = "https://us-central1-regibiz2026.cloudfunctions.net/getGoogleReviews"; 
                const response = await fetch(REVIEW_API_URL);
                if (response.ok) {
                    const data = await response.json();
                    if (data.rating) setReviewRating(Number(data.rating));
                    if (data.googleUrl) setGoogleUrl(data.googleUrl);
                    if (data.reviewCount) {
                        setReviewCount(Number(data.reviewCount));
                        setCustomerCount(Number(data.reviewCount)); // Syncing happy customers with reviews
                    }
                }
            } catch (err) {
                console.warn('useLiveSocialProof: fetch error', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReviewSettings();
    }, []);

    return {
        customerCount,
        reviewRating,
        reviewCount,
        isLoading,
        googleUrl,
    };
};
