// src/hooks/useCustomerServices.ts
// ============================================================================
// ONE-TIME FETCH HOOK — NO REAL-TIME LISTENERS, NO POLLING
// ============================================================================
// Fetches ALL applications for the logged-in customer from the SAME 13
// root-level collections that the Documents page queries.
//
// ⚡ Key rules:
//  • Uses getDocs (not onSnapshot) — zero real-time subscriptions
//  • Fetches on mount ONCE; only re-fetches when refresh() is called
//  • Scoped strictly to userId — no admin / support data
//  • Categorisation matches the requirements:
//      Active    → status === 'submitted'
//      Pending   → status === 'processing' | 'pending'
//      Completed → status === 'completed' | 'approved'
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection,
    getDocs,
    query,
    where,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Application } from '../Types/Application';

// ---------------------------------------------------------------------------
// The same collection list used by Documents.tsx (COLLECTION_CONFIG)
// ---------------------------------------------------------------------------
const COLLECTIONS: Array<{ name: string; type: string; title: string }> = [
    { name: 'applications', type: 'general', title: 'General Application' },
    { name: 'msme-applications', type: 'msme', title: 'MSME Registration' },
    { name: 'pan-applications', type: 'pan', title: 'PAN Card Application' },
    { name: 'gst-applications', type: 'gst', title: 'GST Registration' },
    { name: 'gst-proprietorship-applications', type: 'gst', title: 'GST Registration - Proprietorship' },
    { name: 'gst-shop-retail-applications', type: 'gst', title: 'GST Registration - Shops & Retail' },
    { name: 'fssai-applications', type: 'fssai', title: 'FSSAI License' },
    { name: 'trademark-applications', type: 'trademark', title: 'Trademark Registration' },
    { name: 'startup-applications', type: 'startup', title: 'Startup India Registration' },
    { name: 'dsc-applications', type: 'dsc', title: 'Digital Signature Certificate' },
    { name: 'company-registrations', type: 'company_registration', title: 'Company Registration' },
    { name: 'dir3kyc-applications', type: 'dir3kyc', title: 'DIR-3 KYC Filing' },
    { name: 'inc20a-applications', type: 'inc20a', title: 'INC-20A Commencement' },
    { name: 'adt1-applications', type: 'adt1', title: 'ADT-1 Auditor Appointment' },
    { name: 'roc-compliance-applications', type: 'roc', title: 'ROC Compliance' },
];

// ---------------------------------------------------------------------------
// Categorized bucket type
// ---------------------------------------------------------------------------
export interface CategorizedServices {
    /** status === 'submitted' */
    active: Application[];
    /** status === 'processing' | 'pending' */
    pending: Application[];
    /** status === 'completed' | 'approved' */
    completed: Application[];
    /** everything */
    all: Application[];
}

const EMPTY_CATEGORIZED: CategorizedServices = {
    active: [], pending: [], completed: [], all: [],
};

// ---------------------------------------------------------------------------
// Categorisation — matches the requested business logic exactly
// ---------------------------------------------------------------------------
function categorize(apps: Application[]): CategorizedServices {
    const active = apps.filter(s => s.status === 'submitted');
    const pending = apps.filter(s => ['processing', 'pending'].includes(s.status));
    const completed = apps.filter(s => ['completed', 'approved'].includes(s.status));

    console.log('📊 Dashboard service counts:');
    console.log('  Total services fetched:', apps.length);
    console.log('  Active  (submitted):', active.length);
    console.log('  Pending (processing/pending):', pending.length);
    console.log('  Completed (completed/approved):', completed.length);

    return { active, pending, completed, all: apps };
}

// ---------------------------------------------------------------------------
// Normalize timestamp to ms number (same as Documents.tsx logic)
// ---------------------------------------------------------------------------
function toMs(val: any): number {
    if (!val) return Date.now();
    if (typeof val === 'number') return val;
    if (val?.toDate) return val.toDate().getTime();          // Firestore Timestamp
    if (val instanceof Date) return val.getTime();
    return Date.now();
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------
export interface UseCustomerServicesResult {
    services: Application[];
    categorized: CategorizedServices;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    lastFetchedAt: string | null;
    refresh: () => void;
}

// ---------------------------------------------------------------------------
// HOOK
// ---------------------------------------------------------------------------
export function useCustomerServices(
    userId: string | null | undefined
): UseCustomerServicesResult {
    const [services, setServices] = useState<Application[]>([]);
    const [categorized, setCategorized] = useState<CategorizedServices>(EMPTY_CATEGORIZED);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

    const isFetchingRef = useRef(false);
    const initialDoneRef = useRef(false);

    // ──────────────────────────────────────────────────────────────────────────
    // Core fetch — queries all 13 collections with where('userId', '==', uid)
    // exactly like Documents.tsx does for non-admin users
    // ✅ getDocs only — no onSnapshot, no polling
    // ──────────────────────────────────────────────────────────────────────────
    const fetchServices = useCallback(async (isRefresh = false) => {
        if (!userId || isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isRefresh) {
            setRefreshing(true);
            setError(null);
        } else {
            setLoading(true);
            setError(null);
        }

        try {
            console.log(`[Dashboard] Fetching all collections for userId: ${userId}`);

            // Fetch all 13 collections in parallel — same strategy as Documents page
            const results = await Promise.all(
                COLLECTIONS.map(async (col) => {
                    try {
                        const q = query(
                            collection(db, col.name),
                            where('userId', '==', userId)   // ✅ strict per-user scoping
                        );
                        const snapshot = await getDocs(q); // ✅ getDocs, NOT onSnapshot

                        const apps: Application[] = snapshot.docs.map(docSnap => {
                            const data = docSnap.data();
                            return {
                                id: docSnap.id,
                                type: col.type === 'general' ? (data.type || 'general') : col.type,
                                title: data.title || col.title,
                                status: data.status || 'submitted',
                                submittedAt: toMs(data.submittedAt),
                                formData: data.formData || {},
                                commonData: data.commonData || {},
                                uploadedFileUrls: data.uploadedFileUrls || {},
                                userId: data.userId || userId,
                                caseId: data.caseId || data.serviceId || data.applicationRef,
                                userEmail: data.userEmail,
                                assignedTo: data.assignedTo,
                                taskStatus: data.taskStatus,
                                sourceCollection: col.name,
                                promoters: data.promoters || [],
                                directors: data.directors || data.formData?.directors || [],
                                partners: data.partners || data.formData?.partners || [],
                                constitution: data.constitution || data.commonData?.constitution,
                                propertyType: data.propertyType,
                                includeSignatoryDetails: data.includeSignatoryDetails,
                                signatoryDetails: data.signatoryDetails,
                                paymentId: data.paymentId,
                                serviceId: data.serviceId,
                                applicationRef: data.applicationRef,
                            } as Application;
                        });

                        if (apps.length > 0) {
                            console.log(`  [${col.name}] → ${apps.length} record(s)`);
                        }
                        return apps;
                    } catch (err: any) {
                        // permission-denied is expected for collections the user can't access
                        if (err.code !== 'permission-denied') {
                            console.warn(`  [${col.name}] fetch warning:`, err.message);
                        }
                        return [] as Application[];
                    }
                })
            );

            // Flatten + deduplicate by doc id (same doc can appear in multiple collections)
            const flat = results.flat();
            const seen = new Set<string>();
            const deduped = flat.filter(app => {
                const key = `${app.sourceCollection}_${app.id}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // Sort newest first
            deduped.sort((a, b) => toMs(b.submittedAt) - toMs(a.submittedAt));

            setServices(deduped);
            setCategorized(categorize(deduped));
            setLastFetchedAt(new Date().toISOString());
            setError(null);
            initialDoneRef.current = true;

        } catch (err: any) {
            console.error('[useCustomerServices] Critical fetch error:', err);
            setError('Failed to load services. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            isFetchingRef.current = false;
        }
    }, [userId]);

    // ──────────────────────────────────────────────────────────────────────────
    // Initial fetch — runs exactly once when userId is first available
    // ❌ No polling  ❌ No real-time listener
    // ──────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        if (!initialDoneRef.current) {
            fetchServices(false);
        }
        return () => {
            initialDoneRef.current = false;
        };
    }, [userId, fetchServices]);

    // Manual refresh — the ONLY post-mount trigger
    const refresh = useCallback(() => fetchServices(true), [fetchServices]);

    return { services, categorized, loading, refreshing, error, lastFetchedAt, refresh };
}