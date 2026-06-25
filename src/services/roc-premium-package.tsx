import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    addDoc,
    collection,
    serverTimestamp,
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL,
} from 'firebase/storage';
import { db, storage } from './firebase';
import { UserProfile } from '../types';
import CelebrationPopup from '../components/CelebrationPopup';
import { generateRocReferenceId } from '../utils/helpers';
import { sendConfirmationEmail } from './emailService';
import FormBackButton from '../components/FormBackButton';
import { useRazorpay } from '../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from './razorpayService';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface RocAddress {
    line1: string;
    line2: string;
    district: string;
    state: string;
    pincode: string;
}

export interface RocCompanyData {
    cin: string;
    name: string;
    email: string;
    organisationType: string;
    address: RocAddress;
}

export interface RocDirectorData {
    firstName: string;
    lastName: string;
    fatherName: string;
    dob: string;
    pan: string;
    aadhaar: string;
    mobile: string;
    email: string;
    address: RocAddress;
}

export interface RocAuditorData {
    type: 'Individual' | 'Firm' | '';
    name: string;
    membershipNo: string;
    pan: string;
    email: string;
    mobile: string;
    address: string;
}

export interface RocInc20aBankData {
    name: string;
    accountNumber: string;
    ifsc: string;
}

export interface RocInc20aSubscriberData {
    name: string;
    shares: number | '';
    amount: number | '';
    dateOfReceipt: string;
}

export interface RocInc20aData {
    bank: RocInc20aBankData;
    directorShareholders: RocInc20aSubscriberData[];
}

export interface RocMsmeData {
    gender: '' | 'Male' | 'Female' | 'Other';
    mobile: string;
    email: string;
    activity: string;
    socialCategory: string;
    speciallyAbled: string;
    investmentAmount: string;
    turnoverAmount: string;
    totalEmployees: string;
}

// ─── PREMIUM PACKAGE TYPES (OPTIMIZED) ───────────────────────────────────────
export interface RocGstData {
    businessName: string;
    tradeName: string;
    constitution: string;
    panNumber: string;
    dateOfCommencement: string;
    natureOfBusiness: string;
    businessActivityType: string;
    promoterName: string;
    promoterDob: string;
    promoterMobile: string;
    promoterEmail: string;
    promoterAadhaar: string;
    propertyType: 'owned' | 'rented' | '';
    flatNumber: string;
    roadStreet: string;
    areaLocality: string;
    district: string;
    state: string;
    pincode: string;
    // Bank fields removed from UI but kept in type to avoid breaking existing data structure if needed later
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    signatoryName: string;
    signatoryPan: string;
    signatoryAadhaar: string; // Kept in type but removed from UI/Validation as requested
    signatoryMobile: string;
    signatoryEmail: string;
}

export interface RocAoc4Data {
    financialYear: string;
    authorizedCapital: string;
    paidUpCapital: string;
    turnover: string;
    netWorth: string;
    profitBeforeTax: string;
    profitAfterTax: string;
    financialStatementType: 'Standalone' | 'Consolidated' | 'Both' | '';
    auditorReportType: 'Unmodified' | 'Modified' | 'Adverse' | '';
    caName: string;
    caMembershipNo: string;
    caCopNo?: string;
    contactNumber: string;
}

export interface RocMgt7aData {
    authorizedCapital: string;
    paidUpCapital: string;
    numberOfShareholders: string;
    shareholderNames?: string;
    sharesHeldByEachShareholder?: string;
    directorName: string;
    din: string;
    designation?: string;
    principalBusinessActivity: string;
    contactNumber?: string;
    boardMeetingsHeld: string;
}

export interface DirectorChangeEntry {
    id: string;
    name: string;
    din: string;
    designation: string;
    category: string;
    dateOfAppointment: string;
    dateOfCessation: string;
    modeOfCessation: string;
}

export interface ShareholderEntry {
    id: string;
    name: string;
    folioNumber: string;
    numberOfShares: string;
    percentageHolding: string;
}

// ─── DOCUMENTS INTERFACE (COMBINED NORMAL + PREMIUM) ─────────────────────────
export interface RocPremiumDocuments {
    // --- NORMAL PACKAGE DOCS ---
    coi: File | null;
    moa: File | null;
    aoa: File | null;
    masterData: File | null;
    directorPan: File | null;
    directorAadhaar: File | null;
    auditorConsent: File | null;
    inc20aDirectorShareholder1BankPassbook: File | null;
    inc20aDirectorShareholder1BankTransaction: File | null;
    inc20aDirectorShareholder2BankPassbook: File | null;
    inc20aDirectorShareholder2BankTransaction: File | null;
    inc20aDirectorShareholder3BankPassbook: File | null;
    inc20aDirectorShareholder3BankTransaction: File | null;
    inc20aPrimaryBoardResolution: File | null;
    inc20aInsideOfficePhoto: File | null;
    inc20aOutsideOfficePhoto: File | null;
    inc20aBoardResolution: File | null;
    msmeAadhaar: File | null;
    msmePan: File | null;
    msmeBankProof: File | null;
    msmeGstCertificate: File | null;
    msmeAddressProof: File | null;
    msmeBusinessProof: File | null;

    // --- GST DOCS (MANDATORY ONLY) ---
    gstPanCard: File | null;
    gstSignatoryAadhaar: File | null;
    gstPassportPhoto: File | null;
    gstBankProof: File | null;
    gstAddressProof: File | null;
    gstPropertyProof: File | null;
    gstDsc: File | null;

    // --- AOC-4 DOCS (SIMPLIFIED - 4 ONLY) ---
    aoc4BalanceSheet: File | null;
    aoc4ProfitLoss: File | null;
    aoc4AuditorReport: File | null;
    aoc4DirectorsReport: File | null;

    // --- MGT-7A DOCS (SIMPLIFIED - 2 ONLY) ---
    mgt7aShareholderList: File | null;
    mgt7aDirectorList: File | null;

    // --- COMMON SIGNATURE ---
    dscSignature: File | null;
}

export interface RocPremiumDeclaration {
    isConfirmed: boolean;
}

export interface RocPremiumData {
    company: RocCompanyData;
    director: RocDirectorData;
    auditor: RocAuditorData;
    inc20a: RocInc20aData;
    msme: RocMsmeData;
    // Premium Specifics
    gst: RocGstData;
    aoc4: RocAoc4Data;
    mgt7a: RocMgt7aData;
    directorChanges: DirectorChangeEntry[];
    topShareholders: ShareholderEntry[];
    documents: RocPremiumDocuments;
    declaration: RocPremiumDeclaration;
}

interface RocPremiumPackageFormProps {
    user: UserProfile;
}

const PREMIUM_PACKAGE_FEE = PRICING_CONFIG['roc-package-premium'].fee;
const PREMIUM_PACKAGE_TOTAL = calculateTotalWithGST(PREMIUM_PACKAGE_FEE);

// ─── Constants ───────────────────────────────────────────────────────────────
const FORM_STEPS = [
    { id: 'company', label: 'Company Details', icon: '🏢', description: 'Basic details & incorporation docs' },
    { id: 'auditor', label: 'ADT-1', icon: '⚖️', description: 'Auditor Appointment Details' },
    { id: 'inc20a', label: 'INC-20A', icon: '🏦', description: 'Director / Shareholder Details' },
    { id: 'director', label: 'DIR KYC', icon: '👤', description: 'Director KYC Information' },
    { id: 'msme', label: 'MSME', icon: '🏭', description: 'Udyam Registration Details' },
    // --- NEW STANDARD STEPS (OPTIMIZED) ---
    { id: 'gst', label: 'GST Registration', icon: '🧾', description: 'Business, Bank & Signatory Details' },
    { id: 'aoc4', label: 'AOC-4 Filing', icon: '📊', description: 'Financial Statement Filing' },
    { id: 'mgt7a', label: 'MGT-7A Return', icon: '👥', description: 'Annual Return for Small Co/OPC' },
    { id: 'declaration', label: 'Preview & Submit', icon: '✅', description: 'Final Review & Submit' },
] as const;

type StepId = typeof FORM_STEPS[number]['id'];

import {
    INDIAN_STATES,
    DISTRICTS_BY_STATE,
    MSME_ORG_TYPES,
    NIC_CODES,
    getDistrictsForState
} from './roc-data';

const LS_KEY = 'roc_premium_form_draft_v3'; // Updated version key for new structure
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ─── Helpers ───────────────────────────────────────────────────────────────
const BLANK_DOCS: RocPremiumDocuments = {
    // Normal Docs
    coi: null, moa: null, aoa: null, masterData: null,
    directorPan: null, directorAadhaar: null,
    auditorConsent: null,
    inc20aDirectorShareholder1BankPassbook: null,
    inc20aDirectorShareholder1BankTransaction: null,
    inc20aDirectorShareholder2BankPassbook: null,
    inc20aDirectorShareholder2BankTransaction: null,
    inc20aDirectorShareholder3BankPassbook: null,
    inc20aDirectorShareholder3BankTransaction: null,
    inc20aPrimaryBoardResolution: null,
    inc20aInsideOfficePhoto: null,
    inc20aOutsideOfficePhoto: null,
    inc20aBoardResolution: null,
    msmeAadhaar: null, msmePan: null, msmeBankProof: null,
    msmeGstCertificate: null, msmeAddressProof: null, msmeBusinessProof: null,
    // GST Docs
    gstPanCard: null,
    gstSignatoryAadhaar: null,
    gstPassportPhoto: null,
    gstBankProof: null,
    gstAddressProof: null,
    gstPropertyProof: null,
    gstDsc: null,
    // AOC-4 Docs (Simplified)
    aoc4BalanceSheet: null,
    aoc4ProfitLoss: null,
    aoc4AuditorReport: null,
    aoc4DirectorsReport: null,
    // MGT-7A Docs (Simplified)
    mgt7aShareholderList: null,
    mgt7aDirectorList: null,
    // Common
    dscSignature: null,
};

const BLANK_ADDRESS: RocAddress = { line1: '', line2: '', district: '', state: '', pincode: '' };
const BLANK_INC20A_PERSON: RocInc20aSubscriberData = { name: '', shares: '', amount: '', dateOfReceipt: '' };

const INITIAL: RocPremiumData = {
    company: { cin: '', name: '', email: '', organisationType: '', address: { ...BLANK_ADDRESS } },
    director: { firstName: '', lastName: '', fatherName: '', dob: '', pan: '', aadhaar: '', mobile: '', email: '', address: { ...BLANK_ADDRESS } },
    auditor: { type: '', name: '', membershipNo: '', pan: '', email: '', mobile: '', address: '' },
    inc20a: {
        bank: { name: '', accountNumber: '', ifsc: '' },
        directorShareholders: [
            { ...BLANK_INC20A_PERSON },
            { ...BLANK_INC20A_PERSON },
            { ...BLANK_INC20A_PERSON },
        ],
    },
    msme: {
        mobile: '', email: '', gender: '', activity: '', socialCategory: '',
        speciallyAbled: '', investmentAmount: '', turnoverAmount: '', totalEmployees: '',
    },
    // Standard Initials
    gst: {
        businessName: '', tradeName: '', constitution: '', panNumber: '',
        dateOfCommencement: '', natureOfBusiness: '', businessActivityType: '', promoterName: '',
        promoterDob: '', promoterMobile: '', promoterEmail: '', promoterAadhaar: '',
        propertyType: '', flatNumber: '', roadStreet: '', areaLocality: '',
        district: '', state: '', pincode: '', bankName: '', accountHolderName: '',
        accountNumber: '', ifscCode: '', signatoryName: '', signatoryPan: '', signatoryAadhaar: '',
        signatoryMobile: '', signatoryEmail: '',
    },
    aoc4: {
        financialYear: '',
        authorizedCapital: '', paidUpCapital: '', turnover: '', netWorth: '',
        profitBeforeTax: '', profitAfterTax: '',
        financialStatementType: '', auditorReportType: '',
        caName: '', caMembershipNo: '', caCopNo: '', contactNumber: '',
    },
    mgt7a: {
        authorizedCapital: '', paidUpCapital: '',
        numberOfShareholders: '', shareholderNames: '', sharesHeldByEachShareholder: '',
        directorName: '', din: '', designation: '', principalBusinessActivity: '',
        contactNumber: '',
        boardMeetingsHeld: '',
    },
    directorChanges: [],
    topShareholders: [],
    documents: BLANK_DOCS,
    declaration: { isConfirmed: false },
};

function saveDraft(data: RocPremiumData) {
    try {
        const { documents: _d, ...rest } = data;
        localStorage.setItem(LS_KEY, JSON.stringify(rest));
    } catch (_) { }
}

function loadDraft(): Partial<Omit<RocPremiumData, 'documents'>> | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
}

function mergeDraft(draft: Partial<Omit<RocPremiumData, 'documents'>>): RocPremiumData {
    const inc20aDraft = draft.inc20a as Partial<RocInc20aData> & { subscriber?: RocInc20aSubscriberData } | undefined;
    const draftPeople = inc20aDraft?.directorShareholders || (inc20aDraft?.subscriber ? [inc20aDraft.subscriber] : []);

    const directorShareholders = [0, 1, 2].map((index) => ({
        ...BLANK_INC20A_PERSON,
        ...(draftPeople[index] || {}),
    }));

    return {
        ...INITIAL,
        ...draft,
        company: { ...INITIAL.company, ...draft.company, address: { ...INITIAL.company.address, ...(draft.company?.address || {}) } },
        director: { ...INITIAL.director, ...draft.director, address: { ...INITIAL.director.address, ...(draft.director?.address || {}) } },
        auditor: { ...INITIAL.auditor, ...draft.auditor },
        inc20a: {
            ...INITIAL.inc20a,
            ...(draft.inc20a || {}),
            bank: { ...INITIAL.inc20a.bank, ...(draft.inc20a?.bank || {}) },
            directorShareholders,
        },
        msme: { ...INITIAL.msme, ...draft.msme },
        gst: { ...INITIAL.gst, ...draft.gst },
        aoc4: { ...INITIAL.aoc4, ...draft.aoc4 },
        mgt7a: { ...INITIAL.mgt7a, ...draft.mgt7a },
        directorChanges: draft.directorChanges || [],
        topShareholders: draft.topShareholders || [],
        documents: BLANK_DOCS,
        declaration: { ...INITIAL.declaration, ...draft.declaration },
    };
}

// ─── Regex ────────────────────────────────────────────────────────────────────
const RE = {
    cin: /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
    pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    mobile: /^\d{10}$/,
    pin: /^\d{6}$/,
    ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    acct: /^\d{6,18}$/,
    membership: /^\d{5,7}$/,
    aadhaar: /^\d{12}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    fy: /^\d{4}-\d{4}$/,
    din: /^\d{8}$/,
};

const isNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
const isNonNegativeNumber = (value: string) => isNumber(value) && Number(value) >= 0;
const displayLabel = (label: string) => label;
const formatPanInput = (value: string) => {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = '';

    for (const char of raw) {
        const index = formatted.length;
        if (index >= 10) break;
        if (index < 5 || index === 9) {
            if (/[A-Z]/.test(char)) formatted += char;
        } else if (/[0-9]/.test(char)) {
            formatted += char;
        }
    }

    return formatted;
};

// ─── Validation ───────────────────────────────────────────────────────────────
const REQUIRED_DOCUMENT_KEYS_NORMAL: (keyof RocPremiumDocuments)[] = [
    'coi', 'moa', 'aoa', 'masterData',
    'directorPan', 'directorAadhaar',
    'auditorConsent',
    'inc20aDirectorShareholder1BankPassbook', 'inc20aDirectorShareholder1BankTransaction',
    'inc20aDirectorShareholder2BankPassbook', 'inc20aDirectorShareholder2BankTransaction',
    'inc20aDirectorShareholder3BankPassbook', 'inc20aDirectorShareholder3BankTransaction',
    'inc20aPrimaryBoardResolution', 'inc20aInsideOfficePhoto', 'inc20aOutsideOfficePhoto', 'inc20aBoardResolution',
    'msmeAadhaar', 'msmePan', 'msmeBankProof',
];

const REQUIRED_DOCUMENT_KEYS_PREMIUM: (keyof RocPremiumDocuments)[] = [
    // GST (gstDsc is optional)
    'gstPanCard', 'gstSignatoryAadhaar', 'gstPassportPhoto', 'gstBankProof',
    'gstAddressProof', 'gstPropertyProof',
    // AOC-4 (aoc4BalanceSheet and aoc4ProfitLoss are optional)
    'aoc4AuditorReport', 'aoc4DirectorsReport',
    // MGT-7A (mgt7aShareholderList removed)
    'mgt7aDirectorList',
];

const REQUIRED_DOCUMENT_KEYS_ALL = [...REQUIRED_DOCUMENT_KEYS_NORMAL, ...REQUIRED_DOCUMENT_KEYS_PREMIUM];

const requiredText = (value: string) => value.trim().length > 0;

function validateAddress(prefix: string, address: RocAddress): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!requiredText(address.line1)) errors[`${prefix}_line1`] = `${prefix} Address Line 1 is required`;
    if (!requiredText(address.district)) errors[`${prefix}_district`] = `${prefix} District is required`;
    if (!requiredText(address.state)) errors[`${prefix}_state`] = `${prefix} State is required`;
    if (!requiredText(address.pincode)) errors[`${prefix}_pincode`] = `${prefix} Pincode is required`;
    else if (!RE.pin.test(address.pincode.trim())) errors[`${prefix}_pincode`] = `${prefix} Pincode must be 6 digits`;
    return errors;
}

function validateStep(stepId: StepId, data: RocPremiumData): Record<string, string> {
    const e: Record<string, string> = {};
    const { company, director, auditor, inc20a, msme, gst, aoc4, mgt7a, declaration, documents } = data;

    // --- NORMAL VALIDATION (UNCHANGED) ---
    if (stepId === 'company') {
        if (!company.cin.trim()) e['company_cin'] = 'CIN is required';
        else if (!RE.cin.test(company.cin.trim())) e['company_cin'] = 'CIN format invalid';
        if (!company.name.trim()) e['company_name'] = 'Company Name is required';
        if (!company.email.trim()) e['company_email'] = 'Company Email is required';
        else if (!RE.email.test(company.email)) e['company_email'] = 'Company Email format is invalid';
        if (!company.organisationType) e['company_organisationType'] = 'Organisation Type is required';
        Object.assign(e, validateAddress('company_address', company.address));
        if (!documents.coi) e['doc_coi'] = 'COI is required';
        if (!documents.moa) e['doc_moa'] = 'MOA is required';
        if (!documents.aoa) e['doc_aoa'] = 'AOA is required';
        if (!documents.masterData) e['doc_masterData'] = 'Master Data is required';
    }

    if (stepId === 'director') {
        if (!director.firstName.trim()) e['director_firstName'] = 'First Name is required';
        if (!director.lastName.trim()) e['director_lastName'] = 'Last Name is required';
        if (!director.fatherName.trim()) e['director_fatherName'] = "Father's Name is required";
        if (!director.dob) e['director_dob'] = 'Director DOB is required';
        if (!director.mobile.trim()) e['director_mobile'] = 'Director Mobile Number is required';
        else if (!RE.mobile.test(director.mobile.trim())) e['director_mobile'] = 'Mobile must be exactly 10 digits';
        if (!director.email.trim()) e['director_email'] = 'Director Email is required';
        else if (!RE.email.test(director.email)) e['director_email'] = 'Director Email format is invalid';
        Object.assign(e, validateAddress('director_address', director.address));
        if (!documents.directorPan) e['doc_directorPan'] = 'Director PAN Card is required';
        if (!documents.directorAadhaar) e['doc_directorAadhaar'] = 'Director Aadhar Card is required';
    }

    if (stepId === 'auditor') {
        if (!auditor.type) e['auditor_type'] = 'Auditor Type is required';
        if (!auditor.name.trim()) e['auditor_name'] = 'Auditor Name is required';
        if (!auditor.membershipNo.trim()) e['auditor_membershipNo'] = 'Membership No. is required';
        else if (!RE.membership.test(auditor.membershipNo.trim())) e['auditor_membershipNo'] = 'Membership No. must be exactly 5–7 digits';
        if (!auditor.pan.trim()) e['auditor_pan'] = 'Auditor PAN is required';
        else if (!RE.pan.test(auditor.pan.trim())) e['auditor_pan'] = 'Auditor PAN format invalid';
        if (!auditor.email.trim()) e['auditor_email'] = 'Auditor Email is required';
        else if (!RE.email.test(auditor.email)) e['auditor_email'] = 'Auditor Email format invalid';
        if (!auditor.mobile.trim()) e['auditor_mobile'] = 'Auditor Mobile is required';
        else if (!RE.mobile.test(auditor.mobile.trim())) e['auditor_mobile'] = 'Auditor Mobile must be 10 digits';
        if (!auditor.address.trim()) e['auditor_address'] = 'Auditor Address is required';
        if (!documents.auditorConsent) e['doc_auditorConsent'] = 'Auditor Consent Letter is required';
    }

    if (stepId === 'inc20a') {
        inc20a.directorShareholders.forEach((entry, index) => {
            const row = index + 1;
            if (!requiredText(entry.name)) e[`inc20a_directorShareholder_${index}_name`] = `Director / Shareholder ${row} Name is required`;
            if (!entry.dateOfReceipt) e[`inc20a_directorShareholder_${index}_dateOfReceipt`] = `Director / Shareholder ${row} Date of Receipt is required`;

            const passbookKey = `inc20aDirectorShareholder${row}BankPassbook` as keyof RocPremiumDocuments;
            const transactionKey = `inc20aDirectorShareholder${row}BankTransaction` as keyof RocPremiumDocuments;

            if (!documents[passbookKey]) e[`doc_${String(passbookKey)}`] = `Director / Shareholder ${row} Bank Passbook is required`;
            if (!documents[transactionKey]) e[`doc_${String(transactionKey)}`] = `Director / Shareholder ${row} Bank Statement (Last 3 Months) is required`;
        });
        if (!documents.inc20aPrimaryBoardResolution) e['doc_inc20aPrimaryBoardResolution'] = 'Authorized Person Signature Letter or Form is required';
        if (!documents.inc20aInsideOfficePhoto) e['doc_inc20aInsideOfficePhoto'] = 'Inside Office Photo (Director Room) is required';
        if (!documents.inc20aOutsideOfficePhoto) e['doc_inc20aOutsideOfficePhoto'] = 'Outside Office Photo (Building/Banner) is required';
        if (!documents.inc20aBoardResolution) e['doc_inc20aBoardResolution'] = 'Board Resolution is required';
    }

    if (stepId === 'msme') {
        if (!documents.msmeAadhaar) e['doc_msmeAadhaar'] = 'Aadhaar Card upload is required';
        if (!documents.msmePan) e['doc_msmePan'] = 'PAN Card upload is required';
        if (!documents.msmeBankProof) e['doc_msmeBankProof'] = 'Bank Passbook or Cancelled Cheque upload is required';
        if (!requiredText(msme.mobile)) e['msme_mobile'] = 'Mobile Number is required';
        else if (!RE.mobile.test(msme.mobile.trim())) e['msme_mobile'] = 'Mobile must be exactly 10 digits';
        if (!requiredText(msme.email)) e['msme_email'] = 'Email ID is required';
        else if (!RE.email.test(msme.email.trim())) e['msme_email'] = 'Email ID format is invalid';
        if (!msme.gender) e['msme_gender'] = 'Gender is required';
        if (!requiredText(msme.activity)) e['msme_activity'] = 'Activity Type is required';
        if (!requiredText(msme.socialCategory)) e['msme_socialCategory'] = 'Social Category is required';
        if (!requiredText(msme.speciallyAbled)) e['msme_speciallyAbled'] = 'Specially Abled status is required';
        if (!requiredText(msme.investmentAmount) || Number(msme.investmentAmount) < 0) e['msme_investmentAmount'] = 'Valid Investment Amount is required';
        if (!requiredText(msme.turnoverAmount) || Number(msme.turnoverAmount) < 0) e['msme_turnoverAmount'] = 'Valid Turnover Amount is required';
        if (!requiredText(msme.totalEmployees) || Number(msme.totalEmployees) < 0) e['msme_totalEmployees'] = 'Total Employees count is required';
    }

    // --- STANDARD VALIDATION (OPTIMIZED) ---
    if (stepId === 'gst') {
        if (!gst.businessName.trim()) e['gst_businessName'] = 'Business Name is required';
        if (!gst.constitution.trim()) e['gst_constitution'] = 'Constitution of Business is required';
        if (!gst.panNumber.trim()) e['gst_panNumber'] = 'PAN Number is required';
        else if (!RE.pan.test(gst.panNumber.trim())) e['gst_panNumber'] = 'PAN format invalid';
        if (!gst.dateOfCommencement) e['gst_dateOfCommencement'] = 'Date of Commencement is required';
        if (!gst.natureOfBusiness.trim()) e['gst_natureOfBusiness'] = 'Nature of Business is required';
        if (!gst.businessActivityType.trim()) e['gst_businessActivityType'] = 'Business Activity Type is required';

        // Address
        if (!gst.flatNumber.trim()) e['gst_flatNumber'] = 'Flat/Building No is required';
        if (!gst.roadStreet.trim()) e['gst_roadStreet'] = 'Road/Street is required';
        if (!gst.areaLocality.trim()) e['gst_areaLocality'] = 'Area/Locality is required';
        if (!gst.state) e['gst_state'] = 'State is required';
        if (!gst.district.trim()) e['gst_district'] = 'District is required';
        if (!gst.pincode.trim()) e['gst_pincode'] = 'Pincode is required';
        else if (!RE.pin.test(gst.pincode.trim())) e['gst_pincode'] = 'Pincode must be 6 digits';

        // Bank Validation REMOVED as per request

        // Authorized signatory
        if (!gst.signatoryName.trim()) e['gst_signatoryName'] = 'Authorized Signatory Name is required';
        if (!gst.signatoryPan.trim()) e['gst_signatoryPan'] = 'Authorized Signatory PAN is required';
        else if (!RE.pan.test(gst.signatoryPan.trim())) e['gst_signatoryPan'] = 'PAN format invalid';

        // Signatory Aadhaar Validation REMOVED as per request

        if (!gst.signatoryMobile.trim()) e['gst_signatoryMobile'] = 'Authorized Signatory Mobile is required';
        else if (!RE.mobile.test(gst.signatoryMobile.trim())) e['gst_signatoryMobile'] = 'Mobile must be 10 digits';
        if (!gst.signatoryEmail.trim()) e['gst_signatoryEmail'] = 'Authorized Signatory Email is required';
        else if (!RE.email.test(gst.signatoryEmail.trim())) e['gst_signatoryEmail'] = 'Email format invalid';

        // Docs
        if (!documents.gstPanCard) e['doc_gstPanCard'] = 'GST PAN Card is required';
        if (!documents.gstSignatoryAadhaar) e['doc_gstSignatoryAadhaar'] = 'Signatory Aadhaar is required';
        if (!documents.gstPassportPhoto) e['doc_gstPassportPhoto'] = 'Passport Size Photo is required';
        if (!documents.gstBankProof) e['doc_gstBankProof'] = 'Bank Proof is required';
        if (!documents.gstAddressProof) e['doc_gstAddressProof'] = 'Address Proof is required';
        if (!documents.gstPropertyProof) e['doc_gstPropertyProof'] = 'Property Proof is required';
        // gstDsc is optional — no validation
    }

    // --- REPLACE THIS BLOCK FOR AOC-4 VALIDATION ---
    if (stepId === 'aoc4') {
        if (!aoc4.financialYear.trim()) e['aoc4_financialYear'] = 'Financial Year is required';
        else if (!RE.fy.test(aoc4.financialYear.trim())) e['aoc4_financialYear'] = 'Format: YYYY-YYYY';

        if (!isNonNegativeNumber(aoc4.authorizedCapital)) e['aoc4_authorizedCapital'] = 'Valid Authorized Capital is required';
        if (!isNonNegativeNumber(aoc4.paidUpCapital)) e['aoc4_paidUpCapital'] = 'Valid Paid-up Capital is required';
        if (!isNonNegativeNumber(aoc4.turnover)) e['aoc4_turnover'] = 'Valid Turnover is required';
        if (!isNumber(aoc4.netWorth)) e['aoc4_netWorth'] = 'Valid Net Worth is required';
        if (!isNumber(aoc4.profitBeforeTax)) e['aoc4_profitBeforeTax'] = 'Valid Profit Before Tax is required';
        if (!isNumber(aoc4.profitAfterTax)) e['aoc4_profitAfterTax'] = 'Valid Profit After Tax is required';

        if (!aoc4.caName.trim()) e['aoc4_caName'] = 'CA Name is required';
        if (!aoc4.caMembershipNo.trim()) e['aoc4_caMembershipNo'] = 'Membership Number is required';
        if (!aoc4.contactNumber.trim()) e['aoc4_contactNumber'] = 'Contact Number is required';
        else if (!RE.mobile.test(aoc4.contactNumber.trim())) e['aoc4_contactNumber'] = 'Must be 10 digits';

        if (!aoc4.financialStatementType) e['aoc4_financialStatementType'] = 'Statement Type is required';
        if (!aoc4.auditorReportType) e['aoc4_auditorReportType'] = 'Auditor Report Type is required';

        // ✅ SIMPLIFIED DOCS VALIDATION (Balance Sheet & P&L are optional)
        // aoc4BalanceSheet is optional — no validation
        // aoc4ProfitLoss is optional — no validation
        if (!documents.aoc4AuditorReport) e['doc_aoc4AuditorReport'] = 'Auditor Report is required';
        if (!documents.aoc4DirectorsReport) e['doc_aoc4DirectorsReport'] = 'Directors Report is required';
    }

    // --- MGT-7A VALIDATION ---
    if (stepId === 'mgt7a') {
        if (!isNonNegativeNumber(mgt7a.authorizedCapital)) e['mgt7a_authorizedCapital'] = 'Valid Authorized Capital is required';
        if (!isNonNegativeNumber(mgt7a.paidUpCapital)) e['mgt7a_paidUpCapital'] = 'Valid Paid-up Capital is required';

        if (!mgt7a.numberOfShareholders.trim()) e['mgt7a_numberOfShareholders'] = 'Number of Shareholders is required';
        else if (!isNonNegativeNumber(mgt7a.numberOfShareholders)) e['mgt7a_numberOfShareholders'] = 'Valid shareholder count is required';

        if (!mgt7a.directorName.trim()) e['mgt7a_directorName'] = 'Director Name is required';
        if (!mgt7a.din.trim()) e['mgt7a_din'] = 'Director DIN Number is required';
        else if (!RE.din.test(mgt7a.din.trim())) e['mgt7a_din'] = 'DIN must be 8 digits';

        if (!mgt7a.boardMeetingsHeld.trim()) e['mgt7a_boardMeetingsHeld'] = 'Board Meetings Held is required';
        else if (!isNonNegativeNumber(mgt7a.boardMeetingsHeld)) e['mgt7a_boardMeetingsHeld'] = 'Valid board meeting count is required';

        if (!mgt7a.principalBusinessActivity.trim()) e['mgt7a_principalBusinessActivity'] = 'Principal Business Activity is required';

        // mgt7aShareholderList removed — only Director List is mandatory
        if (!documents.mgt7aDirectorList) e['doc_mgt7aDirectorList'] = 'Director List is required';
    }

    if (stepId === 'declaration') {
        if (!declaration.isConfirmed) e['declaration_isConfirmed'] = 'You must confirm the declaration before submission';
    }

    return e;
}

function validateAll(data: RocPremiumData): Record<string, string> {
    let allErrors: Record<string, string> = {};
    FORM_STEPS.forEach(step => {
        allErrors = { ...allErrors, ...validateStep(step.id, data) };
    });
    // Global doc check for critical normal docs
    REQUIRED_DOCUMENT_KEYS_NORMAL.forEach((docKey) => {
        if (!data.documents[docKey]) allErrors[`doc_${String(docKey)}`] = `${String(docKey)} document is required`;
    });
    return allErrors;
}

// ─── Firebase upload ──────────────────────────────────────────────────────────
async function uploadFile(file: File, userId: string, packageId: string, key: string): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'bin';
    // Organize folders slightly better for standard package
    let folder = 'Common';
    if (key.startsWith('msme')) folder = 'MSME';
    else if (key.startsWith('inc20a')) folder = 'INC-20A';
    else if (key.startsWith('gst')) folder = 'GST';
    else if (key.startsWith('aoc4')) folder = 'AOC-4';
    else if (key.startsWith('mgt7a')) folder = 'MGT-7A';

    const r = ref(storage, `roc-premium-packages/${userId}/${packageId}/${folder}/${key}.${ext}`);
    await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
    return getDownloadURL(r);
}

// ─── Info Tooltip ─────────────────────────────────────────────────────────────
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-flex items-center ml-1.5">
            <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
                className="text-slate-600 hover:text-cyan-400 transition-colors focus:outline-none" aria-label="More information">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            {show && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-2.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg shadow-xl z-50 leading-relaxed pointer-events-none">
                    {text}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
                </div>
            )}
        </div>
    );
};

// ─── Primitive UI components ──────────────────────────────────────────────────
const FormInput: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; required?: boolean;
    hint?: string; disabled?: boolean; maxLength?: number; info?: string;
    error?: string;
}> = ({ label, value, onChange, placeholder, type = 'text', required, hint, disabled, maxLength, info, error }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400 normal-case tracking-normal flex items-center">
            {displayLabel(label)}{required && <span className="text-rose-400 ml-1">*</span>}
            {info && <InfoTooltip text={info} />}
        </label>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            disabled={disabled} maxLength={maxLength}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20'
                : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                }`} />
        {error ? <p className="text-xs text-rose-400 mt-1">{error}</p> : hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
);

const FormSelect: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; required?: boolean; hint?: string; info?: string;
    error?: string;
}> = ({ label, value, onChange, options, required, hint, info, error }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400 normal-case tracking-normal flex items-center">
            {displayLabel(label)}{required && <span className="text-rose-400 ml-1">*</span>}
            {info && <InfoTooltip text={info} />}
        </label>
        <select value={value} onChange={(e) => onChange(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white outline-none transition-all focus:ring-1 appearance-none cursor-pointer ${error ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20'
                : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                }`}>
            <option value="" className="bg-slate-900">Select…</option>
            {options.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
        </select>
        {error ? <p className="text-xs text-rose-400 mt-1">{error}</p> : hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
);

const RadioGroup: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; required?: boolean; info?: string;
    error?: string;
}> = ({ label, value, onChange, options, required, info, error }) => (
    <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-slate-400 normal-case tracking-normal flex items-center">
            {displayLabel(label)}{required && <span className="text-rose-400 ml-1">*</span>}
            {info && <InfoTooltip text={info} />}
        </label>
        <div className="flex flex-wrap gap-3">
            {options.map((o) => (
                <button key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${value === o.value
                        ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}>{o.label}</button>
            ))}
        </div>
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
);

const FileUploader: React.FC<{
    label: string; file: File | null; onSelect: (f: File | null) => void;
    accept?: string; required?: boolean; hint?: string; info?: string;
    error?: string;
}> = ({ label, file, onSelect, accept = '.pdf,.jpg,.jpeg,.png', required, hint, info, error }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [sizeErr, setSizeErr] = useState('');

    const pick = (f: File | undefined | null) => {
        setSizeErr('');
        if (!f) { onSelect(null); return; }
        if (f.size > MAX_FILE_BYTES) { setSizeErr('Exceeds 5 MB limit'); return; }
        const allowedExtensions = accept.split(',').map((item) => item.trim().toLowerCase()).filter((item) => item.startsWith('.'));
        const fileName = f.name.toLowerCase();
        if (allowedExtensions.length > 0 && !allowedExtensions.some((ext) => fileName.endsWith(ext))) {
            setSizeErr(`Only ${allowedExtensions.map((ext) => ext.slice(1).toUpperCase()).join(', ')} files are allowed`);
            return;
        }
        onSelect(f);
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400 normal-case tracking-normal flex items-center">
                {displayLabel(label)}{required && <span className="text-rose-400 ml-1">*</span>}
                {info && <InfoTooltip text={info} />}
            </label>
            <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all select-none ${error ? 'border-rose-500 bg-rose-500/5 text-rose-300'
                    : file ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
                        : sizeErr ? 'border-rose-500/40 bg-rose-500/5 text-rose-300'
                            : 'border-dashed border-slate-700 bg-slate-800/30 text-slate-500 hover:border-cyan-500/40 hover:text-cyan-300'
                    }`}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {file
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    }
                </svg>
                <span className="text-sm truncate flex-1">{file ? file.name : 'Click or drag to upload'}</span>
                {file && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(null); setSizeErr(''); }}
                        className="shrink-0 text-slate-500 hover:text-rose-400 transition-colors leading-none">✕</button>
                )}
            </div>
            <input ref={inputRef} type="file" accept={accept} className="hidden"
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            {error ? <p className="text-xs text-rose-400 mt-1">{error}</p> : sizeErr ? <p className="text-xs text-rose-400 mt-0.5">{sizeErr}</p> : hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; subtitle?: string; badge?: string }> = ({ title, subtitle, badge }) => (
    <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-700/60">
        <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
            <span className="shrink-0 ml-4 text-xs px-2 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{badge}</span>
        )}
    </div>
);

const SubLabel: React.FC<{
    idx: string | number; color?: 'cyan' | 'orange' | 'purple' | 'teal';
    children: React.ReactNode; note?: string;
}> = ({ idx, color = 'cyan', children, note }) => (
    <p className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${color === 'orange' ? 'bg-orange-500/20 text-orange-400'
            : color === 'purple' ? 'bg-purple-500/20 text-purple-400'
                : color === 'teal' ? 'bg-teal-500/20 text-teal-400'
                    : 'bg-cyan-500/20 text-cyan-400'
            }`}>{idx}</span>
        {children}
        {note && <span className="text-xs text-slate-500 font-normal ml-1">{note}</span>}
    </p>
);

// ─── AddressBlock ─────────────────────────────────────────────────────────────
const AddressBlock: React.FC<{
    label: string; value: RocAddress; onChange: (p: Partial<RocAddress>) => void; required?: boolean;
    prefix: string; fieldErrors: Record<string, string>;
    clearFieldError: (key: string) => void;
}> = ({ label, value, onChange, required, prefix, fieldErrors, clearFieldError }) => (
    <div className="space-y-4">
        {label && <p className="text-xs font-semibold text-slate-400 normal-case tracking-normal">{displayLabel(label)}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Address Line 1" value={value.line1} onChange={(v) => { onChange({ line1: v }); clearFieldError(`${prefix}_line1`); }} required={required} placeholder="House/Flat No., Building, Street" error={fieldErrors[`${prefix}_line1`]} />
            <FormInput label="Address Line 2" value={value.line2} onChange={(v) => onChange({ line2: v })} placeholder="Area, Locality, Landmark" />
            <FormSelect label="State" value={value.state} onChange={(v) => { onChange({ state: v, district: '' }); clearFieldError(`${prefix}_state`); }} required={required}
                options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
                info="Select state first — district list will update automatically" error={fieldErrors[`${prefix}_state`]} />
            <FormSelect label="District" value={value.district} onChange={(v) => { onChange({ district: v }); clearFieldError(`${prefix}_district`); }} required={required}
                options={getDistrictsForState(value.state).map((d: string) => ({ value: d, label: d }))}
                info="Districts update based on selected state" error={fieldErrors[`${prefix}_district`]} />
            <FormInput label="Pincode" value={value.pincode} onChange={(v) => { onChange({ pincode: v }); clearFieldError(`${prefix}_pincode`); }} required={required} maxLength={6} type="tel" hint="6-digit PIN code" error={fieldErrors[`${prefix}_pincode`]} />
        </div>
    </div>
);

const ConfirmModal: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl p-6 max-w-md w-full shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
            <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
                <button type="button" onClick={onConfirm} className="px-6 py-2.5 bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700 hover:from-teal-500 hover:via-cyan-500 hover:to-blue-600 text-white font-medium rounded-lg transition-colors">Confirm</button>
            </div>
        </div>
    </div>
);

// ─── Preview Panel ────────────────────────────────────────────────────────────
const PreviewPanel: React.FC<{ formData: RocPremiumData }> = ({ formData }) => {
    const [activeTab, setActiveTab] = useState<'company' | 'director' | 'auditor' | 'inc20a' | 'msme' | 'gst' | 'aoc4' | 'mgt7a' | 'documents'>('company');

    const tabs: { id: typeof activeTab; label: string; icon: string }[] = [
        { id: 'company', label: 'Company', icon: '🏢' },
        { id: 'director', label: 'Director', icon: '👤' },
        { id: 'auditor', label: 'ADT-1', icon: '⚖️' },
        { id: 'inc20a', label: 'INC-20A', icon: '🏦' },
        { id: 'msme', label: 'MSME', icon: '🏭' },
        { id: 'gst', label: 'GST', icon: '🧾' },
        { id: 'aoc4', label: 'AOC-4', icon: '📊' },
        { id: 'mgt7a', label: 'MGT-7A', icon: '👥' },
        { id: 'documents', label: 'Docs', icon: '📁' },
    ];

    const Row: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
        <div className={`flex justify-between items-start py-2 border-b border-slate-700/60 last:border-0 gap-3 ${highlight ? 'bg-cyan-500/5 -mx-2 px-2 rounded' : ''}`}>
            <span className="text-xs text-slate-500 shrink-0 w-40">{label}</span>
            <span className={`text-xs font-medium text-right break-all ${value && value !== '—' ? 'text-slate-200' : 'text-slate-600'}`}>{value || '—'}</span>
        </div>
    );

    const docKeys = REQUIRED_DOCUMENT_KEYS_ALL;
    const uploadedCount = docKeys.filter(k => formData.documents[k] !== null).length;

    return (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 px-5 py-4 border-b border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-sm font-bold text-white">Live Form Preview</h4>
                </div>
                <p className="text-xs text-slate-400">Auto-updates as you fill the form</p>
            </div>
            <div className="flex overflow-x-auto border-b border-slate-700/60 bg-slate-900/70">
                {tabs.map(tab => (
                    <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id
                            ? 'border-cyan-500 text-cyan-300 bg-cyan-500/5'
                            : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}>
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>
            <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                {activeTab === 'company' && (<>
                    <Row label="CIN" value={formData.company.cin} highlight />
                    <Row label="Company Name" value={formData.company.name} highlight />
                    <Row label="Org Type" value={formData.company.organisationType.replace(/_/g, ' ')} />
                    <Row label="Email" value={formData.company.email} />
                    <Row label="Registered Address" value={[formData.company.address.line1, formData.company.address.district, formData.company.address.state, formData.company.address.pincode].filter(Boolean).join(', ')} />
                </>)}
                {activeTab === 'director' && (<>
                    <Row label="Full Name" value={[formData.director.firstName, formData.director.lastName].filter(Boolean).join(' ')} highlight />
                    <Row label="Father's Name" value={formData.director.fatherName} />
                    <Row label="Date of Birth" value={formData.director.dob} />
                    <Row label="PAN" value={formData.director.pan} />
                    <Row label="Aadhaar" value={formData.director.aadhaar} />
                    <Row label="Mobile" value={formData.director.mobile} />
                    <Row label="Email" value={formData.director.email} />
                    <Row label="Address" value={[formData.director.address.line1, formData.director.address.district, formData.director.address.state, formData.director.address.pincode].filter(Boolean).join(', ')} />
                </>)}
                {activeTab === 'auditor' && (<>
                    <Row label="Auditor Type" value={formData.auditor.type} highlight />
                    <Row label="Name / Firm" value={formData.auditor.name} highlight />
                    <Row label="Membership No." value={formData.auditor.membershipNo} />
                    <Row label="PAN" value={formData.auditor.pan} />
                    <Row label="Email" value={formData.auditor.email} />
                    <Row label="Mobile" value={formData.auditor.mobile} />
                    <Row label="Address" value={formData.auditor.address} />
                </>)}
                {activeTab === 'inc20a' && (<>
                    {formData.inc20a.directorShareholders.map((entry, index) => (
                        <React.Fragment key={index}>
                            <Row label={`Director / Shareholder ${index + 1}`} value={entry.name} highlight={index === 0} />
                            <Row label={`Shares ${index + 1}`} value={String(entry.shares || '—')} />
                            <Row label={`Amount ${index + 1}`} value={String(entry.amount || '—')} />
                            <Row label={`Receipt Date ${index + 1}`} value={entry.dateOfReceipt} />
                        </React.Fragment>
                    ))}
                    <Row label="Primary Board Resolution" value={formData.documents.inc20aPrimaryBoardResolution?.name || '—'} />
                    <Row label="Inside Office Photo" value={formData.documents.inc20aInsideOfficePhoto?.name || '—'} />
                    <Row label="Outside Office Photo" value={formData.documents.inc20aOutsideOfficePhoto?.name || '—'} />
                    <Row label="Board Resolution" value={formData.documents.inc20aBoardResolution?.name || '—'} />
                </>)}
                {activeTab === 'msme' && (<>
                    <Row label="Mobile" value={formData.msme.mobile} />
                    <Row label="Email" value={formData.msme.email} />
                    <Row label="Gender" value={formData.msme.gender || '—'} />
                    <Row label="Activity" value={formData.msme.activity} />
                    <Row label="Social Category" value={formData.msme.socialCategory} />
                    <Row label="Specially Abled" value={formData.msme.speciallyAbled} />
                    <Row label="Investment (₹)" value={formData.msme.investmentAmount} />
                    <Row label="Turnover (₹)" value={formData.msme.turnoverAmount} />
                    <Row label="Employees" value={formData.msme.totalEmployees} />
                </>)}
                {activeTab === 'gst' && (<>
                    <Row label="Business Name" value={formData.gst.businessName} highlight />
                    <Row label="Constitution" value={formData.gst.constitution} />
                    <Row label="PAN" value={formData.gst.panNumber} />
                    <Row label="Commencement Date" value={formData.gst.dateOfCommencement} />
                    <Row label="Business Activity" value={formData.gst.businessActivityType} />
                    <Row label="Business Address" value={[formData.gst.flatNumber, formData.gst.roadStreet, formData.gst.areaLocality, formData.gst.district, formData.gst.state, formData.gst.pincode].filter(Boolean).join(', ')} />
                    <Row label="Nature of Business" value={formData.gst.natureOfBusiness} />
                    {/* Bank Details Row Removed */}
                    <Row label="Signatory" value={formData.gst.signatoryName} highlight />
                    {/* Signatory Aadhaar Row Removed */}
                    <Row label="Signatory Mobile" value={formData.gst.signatoryMobile} />
                    <Row label="Signatory Email" value={formData.gst.signatoryEmail} />
                </>)}
                {activeTab === 'aoc4' && (<>
                    <Row label="Financial Year" value={formData.aoc4.financialYear} highlight />
                    <Row label="Authorized Capital" value={formData.aoc4.authorizedCapital} />
                    <Row label="Paid-up Capital" value={formData.aoc4.paidUpCapital} />
                    <Row label="Turnover" value={formData.aoc4.turnover} />
                    <Row label="Net Worth" value={formData.aoc4.netWorth} />
                    <Row label="Profit Before Tax" value={formData.aoc4.profitBeforeTax} />
                    <Row label="Profit After Tax" value={formData.aoc4.profitAfterTax} />
                    <Row label="Statement Type" value={formData.aoc4.financialStatementType} />
                    <Row label="Auditor Report" value={formData.aoc4.auditorReportType} />
                    <Row label="CA Name" value={formData.aoc4.caName} />
                    <Row label="CA Membership" value={formData.aoc4.caMembershipNo} />
                    <Row label="CA Contact" value={formData.aoc4.contactNumber} />
                </>)}
                {activeTab === 'mgt7a' && (<>
                    <Row label="Authorized Capital" value={formData.mgt7a.authorizedCapital} />
                    <Row label="Paid-up Capital" value={formData.mgt7a.paidUpCapital} />
                    <Row label="Shareholders" value={formData.mgt7a.numberOfShareholders} />
                    <Row label="Director Name" value={formData.mgt7a.directorName} />
                    <Row label="DIN" value={formData.mgt7a.din} />
                    <Row label="Board Meetings" value={formData.mgt7a.boardMeetingsHeld} />
                    <Row label="Business Activity" value={formData.mgt7a.principalBusinessActivity} />
                </>)}
                {activeTab === 'documents' && (<>
                    <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">{uploadedCount} of {docKeys.length} uploaded</span>
                            <span className="text-cyan-400 font-bold">{Math.round((uploadedCount / docKeys.length) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((uploadedCount / docKeys.length) * 100)}%` }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                        {docKeys.map(key => (
                            <div key={String(key)} className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${formData.documents[key] ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800/30 text-slate-600'
                                }`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${formData.documents[key] ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
                                    }`}>{formData.documents[key] ? '✓' : '○'}</span>
                                <span className="truncate">{String(key)}</span>
                            </div>
                        ))}
                    </div>
                </>)}
            </div>
        </div>
    );
};

// ─── Right Status Sidebar ─────────────────────────────────────────────────────
const StatusSidebar: React.FC<{ formData: RocPremiumData; currentStepIndex: number; draftFlash: boolean }> = ({ formData, currentStepIndex, draftFlash }) => {
    const totalDocs = REQUIRED_DOCUMENT_KEYS_ALL.length;
    const uploadedDocs = REQUIRED_DOCUMENT_KEYS_ALL.filter((key) => formData.documents[key]).length;
    const pct = Math.round((uploadedDocs / totalDocs) * 100);
    const directorName = [formData.director.firstName, formData.director.lastName].filter(Boolean).join(' ') || '—';

    return (
        <aside className="hidden xl:block w-64 shrink-0">
            <div className="sticky top-20 space-y-4">
                <div className={`flex items-center gap-2 text-xs transition-opacity duration-700 ${draftFlash ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400">Draft auto-saved</span>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-cyan-400">📋</span> Filing Summary
                    </p>
                    <div className="space-y-3">
                        {[
                            { label: 'Company', value: formData.company.name || '—' },
                            { label: 'CIN', value: formData.company.cin || '—' },
                            { label: 'Org Type', value: formData.company.organisationType ? formData.company.organisationType.replace(/_/g, ' ') : '—' },
                            { label: 'Director', value: directorName },
                            { label: 'Auditor', value: formData.auditor.name || '—' },
                            { label: 'Fin. Year', value: formData.aoc4.financialYear || '—' },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex flex-col gap-0.5 border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
                                <span className="text-xs text-slate-200 font-medium truncate" title={value}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-amber-400">📁</span> Documents
                    </p>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-400">{uploadedDocs} of {totalDocs} uploaded</span>
                        <span className="text-cyan-400 font-semibold">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mb-3">
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Filings Covered</p>
                    <div className="space-y-1.5">
                        {['ADT-1', 'INC-20A', 'DIR-3 KYC', 'MSME Reg.', 'GST Reg.', 'AOC-4', 'MGT-7A'].map((f) => (
                            <div key={f} className="flex items-center gap-2 text-xs text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />{f}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RocPremiumPackageForm({ user }: RocPremiumPackageFormProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
    const [formData, setFormData] = useState<RocPremiumData>(() => {
        const draft = loadDraft();
        if (!draft) return INITIAL;
        return mergeDraft(draft);
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [submittedId, setSubmittedId] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(location.state?.paymentInfo || null);
    const [isPaying, setIsPaying] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [draftFlash, setDraftFlash] = useState(false);
    const { displayRazorpay } = useRazorpay();

    const currentStep = FORM_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === FORM_STEPS.length - 1;

    useEffect(() => {
        saveDraft(formData);
        setDraftFlash(true);
        const t = setTimeout(() => setDraftFlash(false), 1800);
        return () => clearTimeout(t);
    }, [formData]);

    const setCompany = useCallback((p: Partial<RocCompanyData>) => setFormData(d => ({ ...d, company: { ...d.company, ...p } })), []);
    const setCompanyAddr = useCallback((p: Partial<RocAddress>) => setFormData(d => ({ ...d, company: { ...d.company, address: { ...d.company.address, ...p } } })), []);
    const setDirector = useCallback((p: Partial<RocDirectorData>) => setFormData(d => ({ ...d, director: { ...d.director, ...p } })), []);
    const setDirectorAddr = useCallback((p: Partial<RocAddress>) => setFormData(d => ({ ...d, director: { ...d.director, address: { ...d.director.address, ...p } } })), []);
    const setAuditor = useCallback((p: Partial<RocAuditorData>) => setFormData(d => ({ ...d, auditor: { ...d.auditor, ...p } })), []);
    const setInc20aDirectorShareholder = useCallback((index: number, p: Partial<RocInc20aSubscriberData>) => setFormData(d => ({
        ...d,
        inc20a: {
            ...d.inc20a,
            directorShareholders: d.inc20a.directorShareholders.map((entry, i) => i === index ? { ...entry, ...p } : entry),
        }
    })), []);
    const setMsme = useCallback((p: Partial<RocMsmeData>) => setFormData(d => ({ ...d, msme: { ...d.msme, ...p } })), []);

    // Standard Setters
    const setGst = useCallback((p: Partial<RocGstData>) => setFormData(d => ({ ...d, gst: { ...d.gst, ...p } })), []);
    const setAoc4 = useCallback((p: Partial<RocAoc4Data>) => setFormData(d => ({ ...d, aoc4: { ...d.aoc4, ...p } })), []);
    const setMgt7a = useCallback((p: Partial<RocMgt7aData>) => setFormData(d => ({ ...d, mgt7a: { ...d.mgt7a, ...p } })), []);

    const setDoc = useCallback((k: keyof RocPremiumDocuments, f: File | null) => setFormData(d => ({ ...d, documents: { ...d.documents, [k]: f } })), []);
    const setDeclaration = useCallback((p: Partial<RocPremiumDeclaration>) => setFormData(d => ({ ...d, declaration: { ...d.declaration, ...p } })), []);

    const isMsmeApplicable = useMemo(() => MSME_ORG_TYPES.includes(formData.company.organisationType), [formData.company.organisationType]);

    const clearFieldError = useCallback((key: string) => {
        setFieldErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    // Navigation
    const handleNext = useCallback(() => {
        const errors = validateStep(currentStep.id, formData);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setFieldErrors({});
        setCurrentStepIndex(i => Math.min(i + 1, FORM_STEPS.length - 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep.id, formData]);

    const handleBack = useCallback(() => {
        setFieldErrors({});
        if (currentStepIndex === 0) {
            setShowConfirm({ show: true, message: 'Go back to services? Your draft will be saved locally.', onConfirm: () => navigate('/services') });
            return;
        }
        setCurrentStepIndex(i => Math.max(i - 1, 0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStepIndex, navigate]);

    const handleClearDraft = useCallback(() => {
        setShowConfirm({
            show: true,
            message: 'Clear all entered data and start fresh? This cannot be undone.',
            onConfirm: () => {
                localStorage.removeItem(LS_KEY);
                setFormData(INITIAL);
                setCurrentStepIndex(0);
                setFieldErrors({});
                setPaymentInfo(null);
                setIsPaying(false);
            },
        });
    }, []);

    const handleSubmit = async (payInfo?: RazorpaySuccessResponse) => {
        const errors = validateAll(formData);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const finalPaymentInfo = payInfo || paymentInfo;
            const applicationRef = generateRocReferenceId('premium');
            const packageId = `roc-premium-${Date.now()}`;
            const docUrls: Record<string, string> = {};

            // Upload all files
            for (const [key, file] of Object.entries(formData.documents) as [keyof RocPremiumDocuments, File | null][]) {
                if (file) {
                    setUploadProgress(`Uploading ${String(key)}…`);
                    docUrls[String(key)] = await uploadFile(file, user.uid, packageId, String(key));
                }
            }

            setUploadProgress('Saving Master Package…');
            const masterRef = await addDoc(collection(db, 'roc-premium-packages'), {
                packageType: 'premium',
                title: 'ROC Premium Compliance Package',
                applicationRef,
                status: 'submitted',
                userId: user.uid,
                company: formData.company,
                director: formData.director,
                auditor: formData.auditor,
                inc20a: formData.inc20a,
                msme: isMsmeApplicable ? formData.msme : null,
                gst: formData.gst,
                aoc4: formData.aoc4,
                mgt7a: formData.mgt7a,
                directorChanges: formData.directorChanges,
                topShareholders: formData.topShareholders,
                paymentStatus: finalPaymentInfo ? 'paid' : 'pending',
                paymentAmount: PREMIUM_PACKAGE_TOTAL,
                paymentCurrency: 'INR',
                paymentId: finalPaymentInfo?.razorpay_payment_id || '',
                paymentOrderId: finalPaymentInfo?.razorpay_order_id || '',
                paymentSignature: finalPaymentInfo?.razorpay_signature || '',
                documentUrls: docUrls,
                submittedAt: serverTimestamp(),
                services: {
                    adt1: true,
                    inc20a: true,
                    dir3kyc: true,
                    msme: isMsmeApplicable,
                    gst: true,
                    aoc4: true,
                    mgt7a: true
                }
            });

            const finalId = masterRef.id;

            setUploadProgress('Creating individual filing records…');

            // Create individual records for all 7 services
            await Promise.all([
                // 1. ADT-1
                addDoc(collection(db, 'adt1-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-ADT1`, applicationRef,
                    title: 'ADT-1 Filing (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company, director: formData.director, auditor: formData.auditor,
                    documentUrls: {
                        auditorConsent: docUrls.auditorConsent ?? null,
                        dscSignature: docUrls.dscSignature ?? null,
                    },
                }),
                // 2. INC-20A
                addDoc(collection(db, 'inc20a-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-INC20A`, applicationRef,
                    title: 'INC-20A Filing (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company, director: formData.director,
                    inc20a: formData.inc20a,
                    documentUrls: {
                        coi: docUrls.coi ?? null, moa: docUrls.moa ?? null, aoa: docUrls.aoa ?? null,
                        directorShareholderBankUploads: {
                            first: {
                                bankPassbook: docUrls.inc20aDirectorShareholder1BankPassbook ?? null,
                                bankTransactionDetails: docUrls.inc20aDirectorShareholder1BankTransaction ?? null,
                            },
                            second: {
                                bankPassbook: docUrls.inc20aDirectorShareholder2BankPassbook ?? null,
                                bankTransactionDetails: docUrls.inc20aDirectorShareholder2BankTransaction ?? null,
                            },
                            third: {
                                bankPassbook: docUrls.inc20aDirectorShareholder3BankPassbook ?? null,
                                bankTransactionDetails: docUrls.inc20aDirectorShareholder3BankTransaction ?? null,
                            },
                        },
                        primaryBoardResolution: docUrls.inc20aPrimaryBoardResolution ?? null,
                        insideOfficePhoto: docUrls.inc20aInsideOfficePhoto ?? null,
                        outsideOfficePhoto: docUrls.inc20aOutsideOfficePhoto ?? null,
                        boardResolution: docUrls.inc20aBoardResolution ?? null,
                        dscSignature: docUrls.dscSignature ?? null,
                    },
                }),
                // 3. DIR-3 KYC
                addDoc(collection(db, 'dir-3-kyc-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-DIRKYC`, applicationRef,
                    title: 'DIR-3 KYC (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company, director: formData.director,
                    documentUrls: {
                        directorPan: docUrls.directorPan ?? null,
                        directorAadhaar: docUrls.directorAadhaar ?? null,
                        dscSignature: docUrls.dscSignature ?? null,
                    },
                }),
                // 4. MSME
                addDoc(collection(db, 'msme-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-MSME`, applicationRef,
                    title: 'MSME Registration (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company, director: formData.director,
                    msme: formData.msme,
                    documentUrls: {
                        aadhaarCard: docUrls.msmeAadhaar ?? null,
                        panCard: docUrls.msmePan ?? null,
                        bankProof: docUrls.msmeBankProof ?? null,
                        gstCertificate: docUrls.msmeGstCertificate ?? null,
                        addressProof: docUrls.msmeAddressProof ?? null,
                        businessProof: docUrls.msmeBusinessProof ?? null,
                        dscSignature: docUrls.dscSignature ?? null,
                    },
                }),
                // 5. GST
                addDoc(collection(db, 'gst-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-GST`, applicationRef,
                    title: 'GST Registration (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company,
                    gst: formData.gst,
                    documentUrls: {
                        panCard: docUrls.gstPanCard ?? null,
                        aadhaarCard: docUrls.gstSignatoryAadhaar ?? null,
                        passportPhoto: docUrls.gstPassportPhoto ?? null,
                        bankProof: docUrls.gstBankProof ?? null,
                        addressProof: docUrls.gstAddressProof ?? null,
                        propertyProof: docUrls.gstPropertyProof ?? null,
                        geoTaggedPhoto: null,
                        signatoryPan: docUrls.gstSignatoryPan ?? null,
                        signatoryAadhaar: docUrls.gstSignatoryAadhaar ?? null,
                        signatoryPhoto: null,
                        authorizationLetter: null,
                        dsc: docUrls.gstDsc ?? null,
                    },
                }),
                // 6. AOC-4 (Simplified)
                addDoc(collection(db, 'aoc4-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-AOC4`, applicationRef,
                    title: 'AOC-4 Filing (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company,
                    aoc4: formData.aoc4,
                    documentUrls: {
                        balanceSheet: docUrls.aoc4BalanceSheet ?? null,
                        profitLoss: docUrls.aoc4ProfitLoss ?? null,
                        auditorReport: docUrls.aoc4AuditorReport ?? null,
                        directorsReport: docUrls.aoc4DirectorsReport ?? null,
                        dscSignature: docUrls.dscSignature ?? null,
                    },
                }),
                // 7. MGT-7A (Simplified)
                addDoc(collection(db, 'mgt7a-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-MGT7A`, applicationRef,
                    title: 'MGT-7A Filing (Premium Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: formData.company,
                    mgt7a: formData.mgt7a,
                    directorChanges: formData.directorChanges,
                    topShareholders: formData.topShareholders,
                    documentUrls: {
                        shareholderList: docUrls.mgt7aShareholderList ?? null,
                        directorList: docUrls.mgt7aDirectorList ?? null,
                        dscSignature: docUrls.dscSignature ?? null,
                    },
                }),
            ]);

            localStorage.removeItem(LS_KEY);
            setSubmittedId(applicationRef);
            setPaymentInfo(finalPaymentInfo || null);

            await sendConfirmationEmail({
                name: formData.company.name || 'User',
                email: user.email,
                service: "ROC Compliance Premium Package",
                caseId: applicationRef,
            });

            setIsSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err: any) {
            console.error(err);
            setSubmitError(err?.message || 'Submission failed. Please try again.');
        } finally {
            setIsSubmitting(false);
            setUploadProgress('');
        }
    };

    const handlePaymentAndSubmit = useCallback(async () => {
        const errors = validateAll(formData);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (paymentInfo) {
            await handleSubmit(paymentInfo);
            return;
        }

        setSubmitError(null);
        setIsPaying(true);
        const started = await displayRazorpay(
            PREMIUM_PACKAGE_TOTAL,
            async (response) => {
                setPaymentInfo(response);
                setIsPaying(false);
                await handleSubmit(response);
            },
            {
                name: 'RegiBIZ ROC Premium Package',
                description: `Service Fee: ₹${PREMIUM_PACKAGE_FEE.toLocaleString('en-IN')} + GST: ₹${calculateGST(PREMIUM_PACKAGE_FEE).toLocaleString('en-IN')} = Total: ₹${PREMIUM_PACKAGE_TOTAL.toLocaleString('en-IN')}`,
                prefill: {
                    name: user?.displayName || formData.company.name || 'Applicant',
                    email: user?.email || formData.company.email || '',
                    contact: formData.director.mobile || '',
                },
                onClosed: () => setIsPaying(false),
            }
        );

        if (!started) {
            setSubmitError('Failed to initiate payment. Please check your connection.');
            setIsPaying(false);
        }
    }, [PREMIUM_PACKAGE_FEE, PREMIUM_PACKAGE_TOTAL, displayRazorpay, formData, handleSubmit, paymentInfo, user]);

    // ─── Step Renderers ───────────────────────────────────────────────────────
    // ... (Normal Steps: Company, Director, Auditor, INC-20A, MSME are same as Normal Package) ...

    const renderCompanyStep = () => (
        <div className="space-y-8">
            <SectionHeader title="Company Details" subtitle="Basic entity information." badge="Step 1" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormInput label="Corporate Identification Number (CIN)" value={formData.company.cin} onChange={(v) => { setCompany({ cin: v.toUpperCase() }); clearFieldError('company_cin'); }} placeholder="L12345MH2020PLC123456" required maxLength={21} hint="21-char CIN starting with L or U" error={fieldErrors['company_cin']} />
                <FormInput label="Company Name" value={formData.company.name} onChange={(v) => { setCompany({ name: v }); clearFieldError('company_name'); }} placeholder="Acme Technologies Private Limited" required info="Full legal name exactly as registered with the Registrar of Companies." error={fieldErrors['company_name']} />
                <FormSelect label="Organisation / Constitution Type" value={formData.company.organisationType} onChange={(v) => { setCompany({ organisationType: v }); clearFieldError('company_organisationType'); }} required
                    options={[
                        { value: 'private_limited', label: 'Private Limited Company' },
                        { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
                        { value: 'partnership', label: 'Partnership Firm' },
                        { value: 'proprietorship', label: 'Proprietorship' },
                    ]} error={fieldErrors['company_organisationType']} />
                <FormInput label="Company Email" value={formData.company.email} onChange={(v) => { setCompany({ email: v }); clearFieldError('company_email'); }} placeholder="info@company.com" type="email" required error={fieldErrors['company_email']} />
            </div>
            <div>
                <SubLabel idx="2">Registered Office Address</SubLabel>
                <AddressBlock label="" value={formData.company.address} onChange={setCompanyAddr} required prefix="company_address" fieldErrors={fieldErrors} clearFieldError={clearFieldError} />
            </div>
            <div>
                <SectionHeader title="Company Incorporation Documents" subtitle="Upload COI, MOA, AOA, and Master Data." badge="Required" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Certificate of Incorporation (COI)" file={formData.documents.coi} onSelect={(f) => { setDoc('coi', f); clearFieldError('doc_coi'); }} required info="Issued by ROC on company registration." error={fieldErrors['doc_coi']} />
                    <FileUploader label="Memorandum of Association (MOA)" file={formData.documents.moa} onSelect={(f) => { setDoc('moa', f); clearFieldError('doc_moa'); }} required info="Constitutional document defining objectives." error={fieldErrors['doc_moa']} />
                    <FileUploader label="Articles of Association (AOA)" file={formData.documents.aoa} onSelect={(f) => { setDoc('aoa', f); clearFieldError('doc_aoa'); }} required info="Internal governance rules." error={fieldErrors['doc_aoa']} />
                    <FileUploader label="Master Data" file={formData.documents.masterData} onSelect={(f) => { setDoc('masterData', f); clearFieldError('doc_masterData'); }} required info="Company Master Data file." error={fieldErrors['doc_masterData']} />
                </div>
            </div>
        </div>
    );

    const renderDirectorStep = () => (
        <div className="space-y-8">
            <SectionHeader title="Director / Authorised Person Details" subtitle="Complete DIR-3 KYC data." badge="DIR-3 KYC" />
            <div>
                <SubLabel idx="1">Identity Details</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="First Name" value={formData.director.firstName} onChange={(v) => { setDirector({ firstName: v }); clearFieldError('director_firstName'); }} required error={fieldErrors['director_firstName']} />
                    <FormInput label="Last Name" value={formData.director.lastName} onChange={(v) => { setDirector({ lastName: v }); clearFieldError('director_lastName'); }} required error={fieldErrors['director_lastName']} />
                    <FormInput label="Father's Name" value={formData.director.fatherName} onChange={(v) => { setDirector({ fatherName: v }); clearFieldError('director_fatherName'); }} required error={fieldErrors['director_fatherName']} />
                    <FormInput label="Director DOB" value={formData.director.dob} onChange={(v) => { setDirector({ dob: v }); clearFieldError('director_dob'); }} type="date" required error={fieldErrors['director_dob']} />
                    <FormInput label="Director Mobile Number" value={formData.director.mobile} onChange={(v) => { setDirector({ mobile: v.replace(/\D/g, '') }); clearFieldError('director_mobile'); }} placeholder="9876543210" required maxLength={10} type="tel" error={fieldErrors['director_mobile']} />
                    <FormInput label="Email" value={formData.director.email} onChange={(v) => { setDirector({ email: v }); clearFieldError('director_email'); }} type="email" required error={fieldErrors['director_email']} />
                </div>
            </div>
            <div>
                <SubLabel idx="2">Residential Address</SubLabel>
                <AddressBlock label="" value={formData.director.address} onChange={setDirectorAddr} required prefix="director_address" fieldErrors={fieldErrors} clearFieldError={clearFieldError} />
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">Director KYC Documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 shrink-0 ml-3">DIR-3 KYC</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Director PAN Card" file={formData.documents.directorPan} onSelect={(f) => { setDoc('directorPan', f); clearFieldError('doc_directorPan'); }} required info="Self-attested copy of the director's PAN card." error={fieldErrors['doc_directorPan']} />
                    <FileUploader label="Director Aadhar Card" file={formData.documents.directorAadhaar} onSelect={(f) => { setDoc('directorAadhaar', f); clearFieldError('doc_directorAadhaar'); }} required info="Self-attested copy of the director's Aadhaar card." error={fieldErrors['doc_directorAadhaar']} />
                </div>
            </div>
        </div>
    );

    const renderAuditorStep = () => (
        <div className="space-y-8">
            <SectionHeader title="Auditor Details — ADT-1" subtitle="Statutory auditor appointment details." badge="ADT-1" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <RadioGroup label="Auditor Type" value={formData.auditor.type} onChange={(v) => { setAuditor({ type: v as RocAuditorData['type'] }); clearFieldError('auditor_type'); }} required
                    options={[{ value: 'Individual', label: 'Individual CA' }, { value: 'Firm', label: 'Audit Firm' }]} error={fieldErrors['auditor_type']} />
                <FormInput label="Auditor / Firm Name" value={formData.auditor.name} onChange={(v) => { setAuditor({ name: v }); clearFieldError('auditor_name'); }} required error={fieldErrors['auditor_name']} />
                <FormInput
                    label="ICAI Membership No."
                    value={formData.auditor.membershipNo}
                    onChange={(v) => { setAuditor({ membershipNo: v.replace(/\D/g, '') }); clearFieldError('auditor_membershipNo'); }}
                    required
                    hint="5–7 digits only"
                    maxLength={7}
                    error={fieldErrors['auditor_membershipNo']}
                />
                <FormInput label="Auditor PAN" value={formData.auditor.pan} onChange={(v) => { setAuditor({ pan: formatPanInput(v) }); clearFieldError('auditor_pan'); }} required maxLength={10} error={fieldErrors['auditor_pan']} />
                <FormInput label="Auditor Email" value={formData.auditor.email} onChange={(v) => { setAuditor({ email: v }); clearFieldError('auditor_email'); }} type="email" required error={fieldErrors['auditor_email']} />
                <FormInput label="Auditor Mobile" value={formData.auditor.mobile} onChange={(v) => { setAuditor({ mobile: v.replace(/\D/g, '') }); clearFieldError('auditor_mobile'); }} type="tel" required maxLength={10} error={fieldErrors['auditor_mobile']} />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400 normal-case tracking-normal flex items-center">
                    Auditor's Office Address <span className="text-rose-400 ml-1">*</span>
                    <InfoTooltip text="Complete office address of the auditor or audit firm." />
                </label>
                <textarea value={formData.auditor.address} onChange={(e) => { setAuditor({ address: e.target.value }); clearFieldError('auditor_address'); }} rows={2}
                    placeholder="Full office address of auditor / audit firm"
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-1 resize-none ${fieldErrors['auditor_address'] ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20' : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                        }`} />
                {fieldErrors['auditor_address'] && <p className="text-xs text-rose-400 mt-1">{fieldErrors['auditor_address']}</p>}
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">Auditor Documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 shrink-0 ml-3">ADT-1</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Auditor Consent Letter" file={formData.documents.auditorConsent} onSelect={(f) => { setDoc('auditorConsent', f); clearFieldError('doc_auditorConsent'); }} required info="Written consent from the auditor agreeing to act as statutory auditor." error={fieldErrors['doc_auditorConsent']} />
                </div>
            </div>
        </div>
    );

    const renderInc20aStep = () => (
        <div className="space-y-8">
            <SectionHeader title="INC-20A — Commencement of Business" subtitle="Director / Shareholder payment and bank proof details." badge="INC-20A" />
            <div className="space-y-4">
                <SubLabel idx="1" color="orange" note="(INC-20A)">Director / Shareholder Details</SubLabel>
                {formData.inc20a.directorShareholders.map((entry, index) => {
                    const row = index + 1;
                    const passbookKey = `inc20aDirectorShareholder${row}BankPassbook` as keyof RocPremiumDocuments;
                    const transactionKey = `inc20aDirectorShareholder${row}BankTransaction` as keyof RocPremiumDocuments;
                    return (
                        <div key={row} className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-semibold text-slate-200">Director / Shareholder {row}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300">Required</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                                <FormInput label="Director / Shareholder Name" value={entry.name} onChange={(v) => { setInc20aDirectorShareholder(index, { name: v }); clearFieldError(`inc20a_directorShareholder_${index}_name`); }} required error={fieldErrors[`inc20a_directorShareholder_${index}_name`]} />
                                <FormInput label="Date of Receipt" value={entry.dateOfReceipt} onChange={(v) => { setInc20aDirectorShareholder(index, { dateOfReceipt: v }); clearFieldError(`inc20a_directorShareholder_${index}_dateOfReceipt`); }} type="date" required error={fieldErrors[`inc20a_directorShareholder_${index}_dateOfReceipt`]} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FileUploader label="Bank Passbook" file={formData.documents[passbookKey]} onSelect={(f) => { setDoc(passbookKey, f); clearFieldError(`doc_${String(passbookKey)}`); }} required hint="PDF, JPG or PNG. Maximum 5 MB." error={fieldErrors[`doc_${String(passbookKey)}`]} />
                                <FileUploader label="Bank Statement (Last 3 Months)" file={formData.documents[transactionKey]} onSelect={(f) => { setDoc(transactionKey, f); clearFieldError(`doc_${String(transactionKey)}`); }} required hint="Upload bank statement for the last 3 months." error={fieldErrors[`doc_${String(transactionKey)}`]} />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">Required Documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 shrink-0 ml-3">INC-20A</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Authorized Person Signature Letter or Form" file={formData.documents.inc20aPrimaryBoardResolution} onSelect={(f) => { setDoc('inc20aPrimaryBoardResolution', f); clearFieldError('doc_inc20aPrimaryBoardResolution'); }} required info="Authorized person signature letter or form required for INC-20A processing." error={fieldErrors['doc_inc20aPrimaryBoardResolution']} />
                    <FileUploader label="Inside Office Photo (Director Room) – Image/PDF upload" file={formData.documents.inc20aInsideOfficePhoto} onSelect={(f) => { setDoc('inc20aInsideOfficePhoto', f); clearFieldError('doc_inc20aInsideOfficePhoto'); }} required accept=".pdf,.jpg,.jpeg,.png" error={fieldErrors['doc_inc20aInsideOfficePhoto']} />
                    <FileUploader label="Outside Office Photo (Building/Banner) – Image/PDF upload" file={formData.documents.inc20aOutsideOfficePhoto} onSelect={(f) => { setDoc('inc20aOutsideOfficePhoto', f); clearFieldError('doc_inc20aOutsideOfficePhoto'); }} required accept=".pdf,.jpg,.jpeg,.png" error={fieldErrors['doc_inc20aOutsideOfficePhoto']} />
                    <FileUploader label="Board Resolution – PDF upload only" file={formData.documents.inc20aBoardResolution} onSelect={(f) => { setDoc('inc20aBoardResolution', f); clearFieldError('doc_inc20aBoardResolution'); }} required accept=".pdf" error={fieldErrors['doc_inc20aBoardResolution']} />
                </div>
            </div>
        </div>
    );

    const renderMsmeStep = () => (
        <div className="space-y-8">
            <SectionHeader
                title="MSME / Udyam Registration"
                subtitle="Upload documents first, then fill only the essential registration details."
                badge={isMsmeApplicable ? 'Applicable' : 'Optional'}
            />
            {!isMsmeApplicable && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-300 mb-6">
                    ⚠️ MSME registration is primarily for Proprietorships, Partnerships, LLPs, and Companies. Ensure this is required for your entity.
                </div>
            )}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                <div className="flex flex-col gap-1 mb-5">
                    <p className="text-base font-semibold text-cyan-200">Upload Documents First for Faster Processing</p>
                    <p className="text-sm text-slate-400">We will use these documents to verify Aadhaar, PAN, bank details, GSTIN and business identity. If OCR is unavailable, admin will verify manually.</p>
                </div>
                <SubLabel idx="1">Required Documents</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <FileUploader label="Aadhaar Card Upload" file={formData.documents.msmeAadhaar} onSelect={(f) => { setDoc('msmeAadhaar', f); clearFieldError('doc_msmeAadhaar'); }} required hint="Auto-read target: applicant name, Aadhaar number and address." error={fieldErrors['doc_msmeAadhaar']} />
                    <FileUploader label="PAN Card Upload" file={formData.documents.msmePan} onSelect={(f) => { setDoc('msmePan', f); clearFieldError('doc_msmePan'); }} required hint="Auto-read target: PAN number and name." error={fieldErrors['doc_msmePan']} />
                    <FileUploader label="Bank Passbook or Cancelled Cheque Upload" file={formData.documents.msmeBankProof} onSelect={(f) => { setDoc('msmeBankProof', f); clearFieldError('doc_msmeBankProof'); }} required hint="Auto-read target: bank name, account number and IFSC." error={fieldErrors['doc_msmeBankProof']} />
                </div>
                <SubLabel idx="2">Optional Documents</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FileUploader label="GST Certificate Upload" file={formData.documents.msmeGstCertificate} onSelect={(f) => setDoc('msmeGstCertificate', f)} hint="Auto-read target: GSTIN and business name." />
                    <FileUploader label="Address Proof Upload" file={formData.documents.msmeAddressProof} onSelect={(f) => setDoc('msmeAddressProof', f)} hint="Utility bill, rent agreement or other address proof." />
                    <FileUploader label="Business Proof / COI / Shop License Upload" file={formData.documents.msmeBusinessProof} onSelect={(f) => setDoc('msmeBusinessProof', f)} hint="COI, shop license or business registration proof." />
                </div>
            </div>
            <div>
                <SubLabel idx="3">Essential Contact & Classification Details</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Mobile Number" value={formData.msme.mobile} onChange={(v) => { setMsme({ mobile: v.replace(/\D/g, '') }); clearFieldError('msme_mobile'); }} type="tel" maxLength={10} required error={fieldErrors['msme_mobile']} />
                    <FormInput label="Email ID" value={formData.msme.email} onChange={(v) => { setMsme({ email: v }); clearFieldError('msme_email'); }} type="email" required error={fieldErrors['msme_email']} />
                    <FormSelect label="Gender" value={formData.msme.gender} onChange={(v) => { setMsme({ gender: v as RocMsmeData['gender'] }); clearFieldError('msme_gender'); }} required
                        options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} error={fieldErrors['msme_gender']} />
                    <FormSelect label="Social Category" value={formData.msme.socialCategory} onChange={(v) => { setMsme({ socialCategory: v }); clearFieldError('msme_socialCategory'); }} required
                        options={[
                            { value: 'General', label: 'General' },
                            { value: 'OBC', label: 'OBC' },
                            { value: 'SC', label: 'SC' },
                            { value: 'ST', label: 'ST' },
                            { value: 'EWS', label: 'EWS' },
                            { value: 'Minority', label: 'Minority' },
                        ]} error={fieldErrors['msme_socialCategory']} />
                    <RadioGroup label="Specially Abled?" value={formData.msme.speciallyAbled} onChange={(v) => { setMsme({ speciallyAbled: v }); clearFieldError('msme_speciallyAbled'); }} required
                        options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]} error={fieldErrors['msme_speciallyAbled']} />
                    <FormSelect
                        label="Activity Type"
                        value={formData.msme.activity}
                        onChange={(v) => { setMsme({ activity: v }); clearFieldError('msme_activity'); }}
                        required
                        options={[
                            { value: 'Manufacturing', label: 'Manufacturing' },
                            { value: 'Service', label: 'Service' },
                            { value: 'Trading', label: 'Trading' },
                        ]}
                        error={fieldErrors['msme_activity']}
                    />
                </div>
            </div>
            <div>
                <SubLabel idx="4">Investment & Employment Details</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                        label="Investment Amount (₹)"
                        value={formData.msme.investmentAmount}
                        onChange={(v) => { setMsme({ investmentAmount: v }); clearFieldError('msme_investmentAmount'); }}
                        type="number"
                        required
                        placeholder="e.g. 500000"
                        error={fieldErrors['msme_investmentAmount']}
                    />
                    <FormInput
                        label="Annual Turnover (₹)"
                        value={formData.msme.turnoverAmount}
                        onChange={(v) => { setMsme({ turnoverAmount: v }); clearFieldError('msme_turnoverAmount'); }}
                        type="number"
                        required
                        placeholder="e.g. 2000000"
                        error={fieldErrors['msme_turnoverAmount']}
                    />
                    <FormInput
                        label="Total Employees"
                        value={formData.msme.totalEmployees}
                        onChange={(v) => { setMsme({ totalEmployees: v }); clearFieldError('msme_totalEmployees'); }}
                        type="number"
                        required
                        placeholder="e.g. 10"
                        error={fieldErrors['msme_totalEmployees']}
                    />
                </div>
            </div>
        </div>
    );

    // ─── NEW STANDARD RENDERERS (OPTIMIZED) ───────────────────────────────────────
    const renderGstStep = () => (
        <div className="space-y-8">
            <SectionHeader title="GST Registration" subtitle="Business Registration Under Goods and Services Tax" badge="GST" />
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
                <SubLabel idx="1" color="teal">Business Details</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Company Name" value={formData.gst.businessName} onChange={(v) => { setGst({ businessName: v }); clearFieldError('gst_businessName'); }} required error={fieldErrors['gst_businessName']} />
                    <FormInput label="PAN" value={formData.gst.panNumber} onChange={(v) => { setGst({ panNumber: formatPanInput(v) }); clearFieldError('gst_panNumber'); }} required maxLength={10} error={fieldErrors['gst_panNumber']} />
                    <FormSelect label="Constitution of Business" value={formData.gst.constitution} onChange={(v) => { setGst({ constitution: v }); clearFieldError('gst_constitution'); }} required
                        options={[
                            { value: 'Private Limited Company', label: 'Private Limited Company' },
                            { value: 'Limited Liability Partnership', label: 'Limited Liability Partnership' },
                            { value: 'Partnership Firm', label: 'Partnership Firm' },
                            { value: 'Proprietorship', label: 'Proprietorship' },
                        ]} error={fieldErrors['gst_constitution']} />
                    <FormInput label="Date of Commencement" value={formData.gst.dateOfCommencement} onChange={(v) => { setGst({ dateOfCommencement: v }); clearFieldError('gst_dateOfCommencement'); }} type="date" required error={fieldErrors['gst_dateOfCommencement']} />
                    <FormSelect label="Nature of Business" value={formData.gst.natureOfBusiness} onChange={(v) => { setGst({ natureOfBusiness: v }); clearFieldError('gst_natureOfBusiness'); }} required
                        options={[
                            { value: 'Manufacture', label: 'Manufacture' },
                            { value: 'Wholesale Business', label: 'Wholesale Business' },
                            { value: 'Retail Business', label: 'Retail Business' },
                            { value: 'Service Provision', label: 'Service Provision' },
                            { value: 'Works Contract', label: 'Works Contract' },
                        ]} error={fieldErrors['gst_natureOfBusiness']} />
                    <FormSelect label="Business Activity Type" value={formData.gst.businessActivityType} onChange={(v) => { setGst({ businessActivityType: v }); clearFieldError('gst_businessActivityType'); }} required
                        options={[
                            { value: 'Manufacturer', label: 'Manufacturer' },
                            { value: 'Trader', label: 'Trader' },
                            { value: 'Service Provider', label: 'Service Provider' },
                            { value: 'Mixed Business', label: 'Mixed Business' },
                        ]} error={fieldErrors['gst_businessActivityType']} />
                </div>
            </div>
            <div>
                <SubLabel idx="2" color="teal">Business Address</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Flat / Door Number" value={formData.gst.flatNumber} onChange={(v) => { setGst({ flatNumber: v }); clearFieldError('gst_flatNumber'); }} required error={fieldErrors['gst_flatNumber']} />
                    <FormInput label="Street / Road" value={formData.gst.roadStreet} onChange={(v) => { setGst({ roadStreet: v }); clearFieldError('gst_roadStreet'); }} required error={fieldErrors['gst_roadStreet']} />
                    <FormInput label="Area / Locality" value={formData.gst.areaLocality} onChange={(v) => { setGst({ areaLocality: v }); clearFieldError('gst_areaLocality'); }} required error={fieldErrors['gst_areaLocality']} />
                    <FormSelect label="State" value={formData.gst.state} onChange={(v) => { setGst({ state: v, district: '' }); clearFieldError('gst_state'); }} required options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} error={fieldErrors['gst_state']} />
                    <FormSelect label="District" value={formData.gst.district} onChange={(v) => { setGst({ district: v }); clearFieldError('gst_district'); }} required options={getDistrictsForState(formData.gst.state).map((d: string) => ({ value: d, label: d }))} error={fieldErrors['gst_district']} />
                    <FormInput label="Pincode" value={formData.gst.pincode} onChange={(v) => { setGst({ pincode: v.replace(/\D/g, '') }); clearFieldError('gst_pincode'); }} required maxLength={6} type="tel" error={fieldErrors['gst_pincode']} />
                </div>
            </div>

            {/* Bank Details Section REMOVED as per request */}

            <div>
                <SubLabel idx="4" color="teal">Authorized Signatory</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Full Name" value={formData.gst.signatoryName} onChange={(v) => { setGst({ signatoryName: v }); clearFieldError('gst_signatoryName'); }} required error={fieldErrors['gst_signatoryName']} />
                    <FormInput label="PAN" value={formData.gst.signatoryPan} onChange={(v) => { setGst({ signatoryPan: formatPanInput(v) }); clearFieldError('gst_signatoryPan'); }} required maxLength={10} error={fieldErrors['gst_signatoryPan']} />

                    {/* Signatory Aadhaar Field REMOVED as per request */}

                    <FormInput label="Mobile Number" value={formData.gst.signatoryMobile} onChange={(v) => { setGst({ signatoryMobile: v.replace(/\D/g, '') }); clearFieldError('gst_signatoryMobile'); }} type="tel" maxLength={10} required error={fieldErrors['gst_signatoryMobile']} />
                    <FormInput label="Email" value={formData.gst.signatoryEmail} onChange={(v) => { setGst({ signatoryEmail: v }); clearFieldError('gst_signatoryEmail'); }} type="email" required error={fieldErrors['gst_signatoryEmail']} />
                </div>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">Mandatory GST Documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 shrink-0 ml-3">Required</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="PAN Card" file={formData.documents.gstPanCard} onSelect={(f) => { setDoc('gstPanCard', f); clearFieldError('doc_gstPanCard'); }} required error={fieldErrors['doc_gstPanCard']} />
                    <FileUploader label="Aadhaar Card" file={formData.documents.gstSignatoryAadhaar} onSelect={(f) => { setDoc('gstSignatoryAadhaar', f); clearFieldError('doc_gstSignatoryAadhaar'); }} required error={fieldErrors['doc_gstSignatoryAadhaar']} />
                    <FileUploader label="Passport Size Photo" file={formData.documents.gstPassportPhoto} onSelect={(f) => { setDoc('gstPassportPhoto', f); clearFieldError('doc_gstPassportPhoto'); }} required error={fieldErrors['doc_gstPassportPhoto']} />
                    <FileUploader label="Bank Passbook / Cancelled Cheque" file={formData.documents.gstBankProof} onSelect={(f) => { setDoc('gstBankProof', f); clearFieldError('doc_gstBankProof'); }} required error={fieldErrors['doc_gstBankProof']} />
                    <FileUploader label="Electricity Bill / Address Proof" file={formData.documents.gstAddressProof} onSelect={(f) => { setDoc('gstAddressProof', f); clearFieldError('doc_gstAddressProof'); }} required error={fieldErrors['doc_gstAddressProof']} />
                    <FileUploader label="Rent Agreement OR Ownership Proof" file={formData.documents.gstPropertyProof} onSelect={(f) => { setDoc('gstPropertyProof', f); clearFieldError('doc_gstPropertyProof'); }} required error={fieldErrors['doc_gstPropertyProof']} />
                    <FileUploader label="DSC" file={formData.documents.gstDsc} onSelect={(f) => setDoc('gstDsc', f)} hint="Optional. Upload if available." />
                </div>
            </div>
        </div>
    );

    const renderAoc4Step = () => (
        <div className="space-y-8">
            <SectionHeader title="AOC-4 Filing" subtitle="Financial Statement Filing with ROC" badge="AOC-4" />

            {/* Financial Year */}
            <div>
                <SubLabel idx="1" color="purple">Financial Year</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                        label="Financial Year"
                        value={formData.aoc4.financialYear}
                        onChange={(v) => { setAoc4({ financialYear: v }); clearFieldError('aoc4_financialYear'); }}
                        required
                        placeholder="2024-2025"
                        maxLength={9}
                        error={fieldErrors['aoc4_financialYear']}
                    />
                </div>
            </div>

            {/* Capital & Financials */}
            <div>
                <SubLabel idx="2" color="purple">Capital & Financials</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Authorized Capital" value={formData.aoc4.authorizedCapital} onChange={(v) => { setAoc4({ authorizedCapital: v }); clearFieldError('aoc4_authorizedCapital'); }} type="number" required error={fieldErrors['aoc4_authorizedCapital']} />
                    <FormInput label="Paid-up Capital" value={formData.aoc4.paidUpCapital} onChange={(v) => { setAoc4({ paidUpCapital: v }); clearFieldError('aoc4_paidUpCapital'); }} type="number" required error={fieldErrors['aoc4_paidUpCapital']} />
                    <FormInput label="Turnover" value={formData.aoc4.turnover} onChange={(v) => { setAoc4({ turnover: v }); clearFieldError('aoc4_turnover'); }} type="number" required error={fieldErrors['aoc4_turnover']} />
                    <FormInput label="Net Worth" value={formData.aoc4.netWorth} onChange={(v) => { setAoc4({ netWorth: v }); clearFieldError('aoc4_netWorth'); }} type="number" required error={fieldErrors['aoc4_netWorth']} />
                    <FormInput label="Profit Before Tax" value={formData.aoc4.profitBeforeTax} onChange={(v) => { setAoc4({ profitBeforeTax: v }); clearFieldError('aoc4_profitBeforeTax'); }} type="number" required error={fieldErrors['aoc4_profitBeforeTax']} />
                    <FormInput label="Profit After Tax" value={formData.aoc4.profitAfterTax} onChange={(v) => { setAoc4({ profitAfterTax: v }); clearFieldError('aoc4_profitAfterTax'); }} type="number" required error={fieldErrors['aoc4_profitAfterTax']} />
                </div>
            </div>

            {/* Compliance */}
            <div>
                <SubLabel idx="3" color="purple">Compliance</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormSelect label="Financial Statement Type" value={formData.aoc4.financialStatementType} onChange={(v) => { setAoc4({ financialStatementType: v as RocAoc4Data['financialStatementType'] }); clearFieldError('aoc4_financialStatementType'); }} required
                        options={[{ value: 'Standalone', label: 'Standalone' }, { value: 'Consolidated', label: 'Consolidated' }, { value: 'Both', label: 'Both' }]} error={fieldErrors['aoc4_financialStatementType']} />
                    <FormSelect label="Auditor Report Type" value={formData.aoc4.auditorReportType} onChange={(v) => { setAoc4({ auditorReportType: v as RocAoc4Data['auditorReportType'] }); clearFieldError('aoc4_auditorReportType'); }} required
                        options={[{ value: 'Unmodified', label: 'Unmodified (Clean)' }, { value: 'Modified', label: 'Modified' }, { value: 'Adverse', label: 'Adverse' }]} error={fieldErrors['aoc4_auditorReportType']} />
                </div>
            </div>

            {/* CA Details */}
            <div>
                <SubLabel idx="4" color="purple">CA Details</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <FormInput label="CA Name" value={formData.aoc4.caName} onChange={(v) => { setAoc4({ caName: v }); clearFieldError('aoc4_caName'); }} required error={fieldErrors['aoc4_caName']} />
                    <FormInput label="Membership Number" value={formData.aoc4.caMembershipNo} onChange={(v) => { setAoc4({ caMembershipNo: v.replace(/\D/g, '') }); clearFieldError('aoc4_caMembershipNo'); }} required error={fieldErrors['aoc4_caMembershipNo']} />
                    <FormInput label="Contact Number" value={formData.aoc4.contactNumber} onChange={(v) => { setAoc4({ contactNumber: v.replace(/\D/g, '') }); clearFieldError('aoc4_contactNumber'); }} type="tel" maxLength={10} required error={fieldErrors['aoc4_contactNumber']} />
                </div>
            </div>

            {/* ✅ SIMPLIFIED DOCUMENTS SECTION (Only 4 Mandatory) */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">AOC-4 Documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 shrink-0 ml-3">AOC-4</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Balance Sheet (Signed)" file={formData.documents.aoc4BalanceSheet} onSelect={(f) => setDoc('aoc4BalanceSheet', f)} hint="Optional. Upload if available." />
                    <FileUploader label="Profit & Loss Account" file={formData.documents.aoc4ProfitLoss} onSelect={(f) => setDoc('aoc4ProfitLoss', f)} hint="Optional. Upload if available." />
                    <FileUploader label="Auditor's Report" file={formData.documents.aoc4AuditorReport} onSelect={(f) => { setDoc('aoc4AuditorReport', f); clearFieldError('doc_aoc4AuditorReport'); }} required error={fieldErrors['doc_aoc4AuditorReport']} />
                    <FileUploader label="Directors' Report" file={formData.documents.aoc4DirectorsReport} onSelect={(f) => { setDoc('aoc4DirectorsReport', f); clearFieldError('doc_aoc4DirectorsReport'); }} required error={fieldErrors['doc_aoc4DirectorsReport']} />
                </div>
            </div>
        </div>
    );

    const renderMgt7aStep = () => (
        <div className="space-y-8">
            <SectionHeader title="MGT-7A Annual Return" subtitle="Annual Return Filing for Small Companies / OPC" badge="MGT-7A" />

            {/* Capital */}
            <div>
                <SubLabel idx="1" color="orange">Capital</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Authorized Capital" value={formData.mgt7a.authorizedCapital} onChange={(v) => { setMgt7a({ authorizedCapital: v }); clearFieldError('mgt7a_authorizedCapital'); }} type="number" required error={fieldErrors['mgt7a_authorizedCapital']} />
                    <FormInput label="Paid-up Capital" value={formData.mgt7a.paidUpCapital} onChange={(v) => { setMgt7a({ paidUpCapital: v }); clearFieldError('mgt7a_paidUpCapital'); }} type="number" required error={fieldErrors['mgt7a_paidUpCapital']} />
                </div>
            </div>

            {/* Management */}
            <div>
                <SubLabel idx="2" color="orange">Management</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Number of Shareholders" value={formData.mgt7a.numberOfShareholders} onChange={(v) => { setMgt7a({ numberOfShareholders: v }); clearFieldError('mgt7a_numberOfShareholders'); }} type="number" required error={fieldErrors['mgt7a_numberOfShareholders']} />
                    <FormInput label="Director Name" value={formData.mgt7a.directorName} onChange={(v) => { setMgt7a({ directorName: v }); clearFieldError('mgt7a_directorName'); }} required error={fieldErrors['mgt7a_directorName']} />
                    <FormInput label="Director DIN Number" value={formData.mgt7a.din} onChange={(v) => { setMgt7a({ din: v.replace(/\D/g, '') }); clearFieldError('mgt7a_din'); }} type="tel" maxLength={8} required error={fieldErrors['mgt7a_din']} />
                    <FormInput label="Board Meetings Held" value={formData.mgt7a.boardMeetingsHeld} onChange={(v) => { setMgt7a({ boardMeetingsHeld: v }); clearFieldError('mgt7a_boardMeetingsHeld'); }} type="number" required error={fieldErrors['mgt7a_boardMeetingsHeld']} />
                </div>
            </div>

            {/* Business Activity */}
            <div>
                <SubLabel idx="3" color="orange">Business</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormSelect label="Principal Business Activity" value={formData.mgt7a.principalBusinessActivity} onChange={(v) => { setMgt7a({ principalBusinessActivity: v }); clearFieldError('mgt7a_principalBusinessActivity'); }} required
                        options={[
                            { value: 'Manufacturing', label: 'Manufacturing' },
                            { value: 'Trading', label: 'Trading' },
                            { value: 'Services', label: 'Services' },
                            { value: 'IT / Software Services', label: 'IT / Software Services' },
                        ]} error={fieldErrors['mgt7a_principalBusinessActivity']} />
                </div>
            </div>

            {/* ✅ SIMPLIFIED DOCUMENTS SECTION */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">MGT-7A Documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300 shrink-0 ml-3">MGT-7A</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Director List" file={formData.documents.mgt7aDirectorList} onSelect={(f) => { setDoc('mgt7aDirectorList', f); clearFieldError('doc_mgt7aDirectorList'); }} required error={fieldErrors['doc_mgt7aDirectorList']} />
                </div>
            </div>
        </div>
    );

    const renderDeclarationStep = () => {
        const totalDocs = REQUIRED_DOCUMENT_KEYS_ALL.filter((key) => formData.documents[key]).length;
        return (
            <div className="space-y-8">
                <SectionHeader title="Full Preview & Declaration" subtitle="Review all entered data using the preview panel below, confirm declarations, then submit." badge="Final Step" />
                <PreviewPanel formData={formData} />

                {/* Summary */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-5 space-y-2.5">
                    <p className="text-sm font-semibold text-slate-300 mb-3">Submission Summary</p>
                    {[
                        { label: 'Company', value: formData.company.name || '—' },
                        { label: 'CIN', value: formData.company.cin || '—' },
                        { label: 'Org Type', value: formData.company.organisationType || '—' },
                        { label: 'Director', value: [formData.director.firstName, formData.director.lastName].filter(Boolean).join(' ') || '—' },
                        { label: 'Auditor', value: formData.auditor.name || '—' },
                        { label: 'Fin. Year', value: formData.aoc4.financialYear || '—' },
                        { label: 'Filings Covered', value: 'ADT-1, INC-20A, DIR-3 KYC, MSME, GST Registration, AOC-4, MGT-7A' },
                        { label: 'Required Documents Attached', value: `${totalDocs} / ${REQUIRED_DOCUMENT_KEYS_ALL.length} files` },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-start text-sm border-b border-slate-700/60 pb-2 last:border-0 last:pb-0">
                            <span className="text-slate-500 shrink-0 mr-4 w-44">{label}</span>
                            <span className="text-slate-200 text-right font-medium">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Declarations */}
                <div className="space-y-4">
                    <p className="text-sm font-semibold text-slate-300">Declarations <span className="text-rose-400 font-normal text-xs ml-1">All required</span></p>
                    <div className={`rounded-xl border p-4 transition-all cursor-pointer ${fieldErrors['declaration_isConfirmed'] ? 'border-rose-500 bg-rose-500/5' : 'border-slate-700/60 bg-slate-900/70'}`}
                        onClick={() => { setDeclaration({ isConfirmed: !formData.declaration.isConfirmed }); clearFieldError('declaration_isConfirmed'); }}>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.declaration.isConfirmed ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600 bg-slate-800 group-hover:border-slate-500'
                                    }`}>
                                    {formData.declaration.isConfirmed && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed select-none">I confirm that all required information and documents for ADT-1, INC-20A, DIR-3 KYC, MSME, GST, AOC-4, and MGT-7A are complete and correct.</p>
                        </div>
                        {fieldErrors['declaration_isConfirmed'] && <p className="text-xs text-rose-400 mt-2">{fieldErrors['declaration_isConfirmed']}</p>}
                    </div>
                </div>

                {submitError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{submitError}</div>
                )}
            </div>
        );
    };

    const renderCurrentStep = () => {
        switch (currentStep.id) {
            case 'company': return renderCompanyStep();
            case 'auditor': return renderAuditorStep();
            case 'inc20a': return renderInc20aStep();
            case 'director': return renderDirectorStep();
            case 'msme': return renderMsmeStep();
            case 'gst': return renderGstStep();
            case 'aoc4': return renderAoc4Step();
            case 'mgt7a': return renderMgt7aStep();
            case 'declaration': return renderDeclarationStep();
            default: return null;
        }
    };

    // ─── Success screen ───────────────────────────────────────────────────────
    if (isSuccess) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
                <CelebrationPopup trigger={isSuccess} message="" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="w-full max-w-lg relative z-10">
                    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-orange-500 rounded-full blur-lg opacity-40 animate-pulse" />
                                <div className="relative w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">ROC Premium Package Submitted!</h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto mb-8">
                            Your ROC Premium Compliance Package (all 7 filings) has been received. Our team will review and begin filing within 24 hours.
                        </p>
                        <div className="mb-6">
                            <p className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-1">Reference ID</p>
                            <div className="inline-block bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50">
                                <p className="text-orange-400 font-mono font-bold text-lg tracking-wider">{submittedId}</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/40 rounded-xl p-4 mb-8 text-left border border-slate-700/50 space-y-3">
                            {[
                                { label: 'Applicant', value: user.displayName || 'Valued Client' },
                                { label: 'Company', value: formData.company.name },
                                { label: 'Package', value: 'ROC Premium Bundle' },
                                { label: 'Filings', value: 'ADT-1 · INC-20A · DIR-3 KYC · MSME · GST · AOC-4 · MGT-7A' },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-slate-500 text-sm">{label}</span>
                                    <span className="text-white font-medium text-sm">{value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <button type="button" onClick={() => navigate('/documents')} className="w-full group relative px-6 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-blue-700 group-hover:from-teal-500 group-hover:to-blue-600 transition-all" />
                                <span className="relative flex items-center justify-center gap-2">
                                    View My Documents
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>
                            </button>
                            <button type="button" onClick={() => navigate('/services')} className="w-full px-6 py-3.5 rounded-xl font-semibold text-slate-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white border border-slate-700 hover:border-slate-600 transition-all">
                                Back to Services
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-slate-600 text-xs mt-6">© 2026 RegiBIZ Compliance Solutions</p>
                </div>
            </div>
        );
    }

    // ─── Main layout ──────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background text-slate-200 relative overflow-hidden">
            <div className="absolute top-24 left-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-24 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #06b6d4; }
      `}</style>

            {showConfirm?.show && (
                <ConfirmModal
                    message={showConfirm.message}
                    onConfirm={() => { setShowConfirm(null); showConfirm.onConfirm?.(); }}
                    onCancel={() => setShowConfirm(null)}
                />
            )}

            {/* Top bar */}
            <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
                    <div>
                        <h1 className="text-base font-semibold text-white">ROC Premium Compliance Package</h1>
                        <p className="text-xs text-slate-400">Step {currentStepIndex + 1} of {FORM_STEPS.length} — {currentStep.label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-xs text-emerald-400 transition-opacity duration-700 ${draftFlash ? 'opacity-100' : 'opacity-0'}`}>✓ Draft saved</span>
                        <button type="button" onClick={handleClearDraft} className="text-xs px-2.5 py-1 rounded-lg border border-rose-800/40 text-rose-400/70 hover:text-rose-400 hover:border-rose-600/50 transition-all">
                            Clear Draft
                        </button>
                        <div className="hidden sm:flex items-center gap-1.5">
                            {FORM_STEPS.map((s, i) => (
                                <div key={s.id} className={`h-1.5 rounded-full transition-all ${i < currentStepIndex ? 'w-6 bg-emerald-500'
                                    : i === currentStepIndex ? 'w-10 bg-cyan-400'
                                        : 'w-6 bg-slate-700'
                                    }`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1600px] px-4 py-6">
                <div className="flex gap-6">
                    {/* LEFT: Step navigation */}
                    <aside className="hidden lg:block w-56 shrink-0">
                        <div className="sticky top-20 space-y-1">
                            {FORM_STEPS.map((s, i) => {
                                const done = i < currentStepIndex;
                                const active = i === currentStepIndex;
                                return (
                                    <button key={s.id} type="button"
                                        onClick={() => {
                                            if (i < currentStepIndex) { setFieldErrors({}); setCurrentStepIndex(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                                        }}
                                        disabled={i > currentStepIndex}
                                        className={`w-full text-left rounded-xl px-4 py-3 transition-all ${active ? 'border border-cyan-500/30 bg-cyan-500/10'
                                            : done ? 'border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer'
                                                : 'border border-transparent opacity-50 cursor-not-allowed'
                                            }`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-base">{done ? '✅' : s.icon}</span>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium truncate ${active ? 'text-cyan-300' : done ? 'text-emerald-300' : 'text-slate-500'}`}>{s.label}</p>
                                                <p className="text-xs text-slate-600 leading-tight mt-0.5 line-clamp-2">{s.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* CENTER: Form content */}
                    <main className="flex-1 min-w-0">
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-2xl backdrop-blur-xl p-6 md:p-8 relative">
                            {renderCurrentStep()}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex items-center justify-between mt-6 gap-4">
                            <button type="button" onClick={handleBack} disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back
                            </button>
                            {isLastStep ? (
                                <button type="button" onClick={handlePaymentAndSubmit} disabled={isSubmitting || isPaying}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-teal-500 hover:via-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-cyan-900/30">
                                    {isSubmitting || isPaying ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            {isPaying ? 'Opening payment…' : (uploadProgress || 'Submitting…')}
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Pay & Submit ROC Premium Package
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button type="button" onClick={handleNext}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-teal-500 hover:via-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/30">
                                    Continue
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Mobile step pills */}
                        <div className="flex lg:hidden gap-2 flex-wrap mt-4 justify-center">
                            {FORM_STEPS.map((s, i) => (
                                <span key={s.id} className={`text-xs px-2.5 py-1 rounded-full border ${i < currentStepIndex ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                    : i === currentStepIndex ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                                        : 'border-slate-700 text-slate-500'
                                    }`}>{s.label}</span>
                            ))}
                        </div>
                    </main>

                    {/* RIGHT: Status sidebar */}
                    <StatusSidebar formData={formData} currentStepIndex={currentStepIndex} draftFlash={draftFlash} />
                </div>
            </div>
        </div>
    );
}
