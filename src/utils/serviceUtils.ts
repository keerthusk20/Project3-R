// src/utils/serviceUtils.ts
// ============================================================================
// SERVICE & DOCUMENT CATEGORIZATION HELPERS
// Pure functions — no Firebase deps, easy to unit-test.
// ============================================================================

import { ServiceDocument } from '../types';

// ---------------------------------------------------------------------------
// Status category definitions
// ---------------------------------------------------------------------------

/** Statuses that count as "Active" (in-flight, being worked on) */
export const ACTIVE_STATUSES: string[] = ['processing', 'submitted', 'paid'];

/** Statuses that count as "Pending" (submitted but waiting for review) */
export const PENDING_STATUSES: string[] = ['submitted', 'paid'];

/** Statuses that count as "Completed" (terminal state) */
export const COMPLETED_STATUSES: string[] = ['approved'];

// ---------------------------------------------------------------------------
// Categorized bucket type
// ---------------------------------------------------------------------------

export interface CategorizedServices {
    active: ServiceDocument[];     // processing / submitted / paid
    pending: ServiceDocument[];    // submitted / paid (waiting for review)
    completed: ServiceDocument[];  // approved
    all: ServiceDocument[];        // original full list
}

// ---------------------------------------------------------------------------
// Core categorization function
// ---------------------------------------------------------------------------

/**
 * Splits a flat list of ServiceDocuments into Active / Pending / Completed buckets.
 *
 * Usage:
 *   const cats = categorizeServices(docs);
 *   cats.active   → in-progress applications
 *   cats.pending  → awaiting review
 *   cats.completed → approved / done
 */
export function categorizeServices(docs: ServiceDocument[]): CategorizedServices {
    return {
        all: docs,
        active: docs.filter(d => ACTIVE_STATUSES.includes(d.status ?? '')),
        pending: docs.filter(d => PENDING_STATUSES.includes(d.status ?? '')),
        completed: docs.filter(d => COMPLETED_STATUSES.includes(d.status ?? '')),
    };
}

// ---------------------------------------------------------------------------
// Document checklist helpers
// ---------------------------------------------------------------------------

/**
 * Known required document fields per service type.
 * Extend this map as new service types are added.
 */
const REQUIRED_DOCS_MAP: Record<string, string[]> = {
    gst: ['PAN Card', 'Aadhaar Card', 'Business Address Proof', 'Bank Statement'],
    msme: ['PAN Card', 'Aadhaar Card', 'Business Proof'],
    pan: ['Proof of Identity', 'Proof of Address', 'Proof of Date of Birth'],
    trademark: ['Trademark Logo / Word Mark', 'PAN Card', 'Business Proof'],
    startup: ['Incorporation Certificate', 'PAN Card', 'DPIIT Certificate', 'Pitch Deck'],
    'trade-license': ['Aadhaar Card', 'Address Proof', 'NOC from Landlord'],
    dsc: ['PAN Card', 'Aadhaar Card', 'Passport Photo'],
    fssai: ['PAN Card', 'Aadhaar Card', 'Food Safety Plan', 'Business Proof'],
    'professional-tax': ['PAN Card', 'Business Registration Proof', 'Salary Details'],
    itr: ['PAN Card', 'Form 16', 'Bank Statement', 'Investment Proofs'],
    tds: ['PAN Card', 'Tax Challan', 'Form 16A'],
    'trademark-search': ['Brand Name / Logo Details'],
    'email-gstin': ['GSTIN Number', 'Business Email'],
    'fssai-basic': ['PAN Card', 'Aadhaar Card', 'Address Proof'],
};

export interface DocumentChecklist {
    uploaded: string[];   // document names that appear to be in formData
    pending: string[];    // required docs that are NOT present in formData
}

/**
 * Derives a rough uploaded / pending document checklist for a service.
 * Since ServiceDocument doesn't carry discrete file URLs per category,
 * we use formData keys as a proxy for "uploaded".
 */
export function getDocumentChecklist(service: ServiceDocument): DocumentChecklist {
    const required = REQUIRED_DOCS_MAP[service.type] ?? [];

    if (required.length === 0) {
        return { uploaded: [], pending: [] };
    }

    // Use formData keys to approximate which docs are present
    const formKeys = Object.keys(service.formData ?? {}).map(k => k.toLowerCase());

    const uploaded: string[] = [];
    const pending: string[] = [];

    for (const doc of required) {
        // Heuristic: if ANY formData key contains a word from the doc name, treat as uploaded
        const words = doc.toLowerCase().split(' ').filter(w => w.length > 2);
        const found = words.some(w => formKeys.some(k => k.includes(w)));
        if (found) {
            uploaded.push(doc);
        } else {
            pending.push(doc);
        }
    }

    return { uploaded, pending };
}

// ---------------------------------------------------------------------------
// Status display helpers
// ---------------------------------------------------------------------------

export function getStatusLabel(status?: string): string {
    switch (status) {
        case 'submitted': return 'Submitted';
        case 'processing': return 'Processing';
        case 'paid': return 'Paid';
        case 'approved': return 'Completed';
        case 'rejected': return 'Rejected';
        default: return status ?? 'Unknown';
    }
}

export function getStatusColors(status?: string): string {
    switch (status) {
        case 'processing': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
        case 'paid': return 'text-green-400 bg-green-500/10 border-green-500/30';
        case 'submitted': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
        case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/30';
        default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
}
