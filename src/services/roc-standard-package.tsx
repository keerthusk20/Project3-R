import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    addDoc,
    collection,
    doc,
    setDoc as firestoreSetDoc,
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
import jsPDF from 'jspdf';
import { useRazorpay } from '../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from './razorpayService';

// ─── Types ────────────────────────────────────────────────────────────────────

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
    type: 'individual' | 'firm' | '';
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
    gender: '' | 'male' | 'female' | 'other';
    mobile: string;
    email: string;
    activity: string;
    socialCategory: string;
    speciallyAbled: string;
    investmentAmount: string;
    turnoverAmount: string;
    totalEmployees: string;
}

export interface RocStandardDocuments {
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
}

export interface RocStandardDeclaration {
    isConfirmed: boolean;
}

export interface RocStandardData {
    company: RocCompanyData;
    director: RocDirectorData;
    auditor: RocAuditorData;
    inc20a: RocInc20aData;
    msme: RocMsmeData;
    documents: RocStandardDocuments;
    declaration: RocStandardDeclaration;
}

interface RocStandardPackageFormProps {
    user: UserProfile;
}

const STANDARD_PACKAGE_FEE = PRICING_CONFIG['roc-package-standard'].fee;
const STANDARD_PACKAGE_TOTAL = calculateTotalWithGST(STANDARD_PACKAGE_FEE);

interface BoardResolutionTemplateData {
    companyName: string;
    meetingDate: string;
    registeredOfficeAddress: string;
    auditorName: string;
    auditorTitle: '' | 'mr' | 'mrs' | 'ms';
    membershipNo: string;
    frnNo: string;
    directorName: string;
    directorTitle: '' | 'mr' | 'mrs' | 'ms';
    dinNo: string;
    place: string;
    date: string;
}

interface ConsentLetterTemplateData {
    date: string;
    companyName: string;
    companyAddress: string;
    auditorName: string;
    auditorTitle: '' | 'mr' | 'mrs' | 'ms';
    membershipNo: string;
    frnNo: string;
    auditorAddress: string;
    email: string;
    contactNumber: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FORM_STEPS = [
    { id: 'company', label: 'company details', icon: '🏢', description: 'basic details & incorporation docs' },
    { id: 'auditor', label: 'adt-1', icon: '⚖️', description: 'auditor appointment details' },
    { id: 'inc20a', label: 'inc-20a', icon: '🏦', description: 'director / shareholder details' },
    { id: 'director', label: 'dir kyc', icon: '👤', description: 'director kyc information' },
    { id: 'msme', label: 'msme', icon: '🏭', description: 'udyam registration details' },
    { id: 'declaration', label: 'preview & submit', icon: '✅', description: 'final review & submit' },
] as const;

type StepId = typeof FORM_STEPS[number]['id'];

import {
    INDIAN_STATES,
    DISTRICTS_BY_STATE,
    MSME_ORG_TYPES,
    getDistrictsForState
} from './roc-data';
import { sendConfirmationEmail } from './emailService';

const LS_KEY = 'roc_standard_form_draft_v3';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ─── Helpers ────────────────────────────────────────────────────────────────

const BLANK_DOCS: RocStandardDocuments = {
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
};

const BLANK_ADDRESS: RocAddress = { line1: '', line2: '', district: '', state: '', pincode: '' };
const BLANK_INC20A_PERSON: RocInc20aSubscriberData = { name: '', shares: '', amount: '', dateOfReceipt: '' };
const lower = (value: string) => value.toLowerCase();
const isLowercaseInputType = (type: string) => ['text', 'email', 'search', 'url'].includes(type);
const displayText = (value: string) => value === '—' ? value : lower(value);
const PAN_FIELD_KEYS = new Set(['pan']);
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
const lowerStringValues = <T,>(value: T, key?: string): T => {
    if (typeof value === 'string') return (key && PAN_FIELD_KEYS.has(key) ? formatPanInput(value) : lower(value)) as T;
    if (value instanceof File) return value;
    if (Array.isArray(value)) return value.map((entry) => lowerStringValues(entry, key)) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, lowerStringValues(entry, entryKey)])) as T;
    }
    return value;
};

const fullAddress = (address: RocAddress) => [
    address.line1,
    address.line2,
    address.district,
    address.state,
    address.pincode,
].filter(Boolean).join(', ');

const todayInputDate = () => new Date().toISOString().slice(0, 10);

const formatDocumentDate = (value: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
};

const validateTemplateFields = <T extends { [K in keyof T]: string }>(data: T, labels: Record<keyof T, string>) => {
    const errors: Partial<Record<keyof T, string>> = {};
    (Object.keys(labels) as (keyof T)[]).forEach((key) => {
        if (!data[key]?.trim()) errors[key] = `${labels[key]} is required`;
    });
    return errors;
};

const addWrappedText = (pdf: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6) => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + lines.length * lineHeight;
};

const honorificName = (name: string, title: '' | 'mr' | 'mrs' | 'ms') => {
    const cleanName = name.trim().replace(/^(mr\.?|mrs\.?|ms\.?)\s+/i, '');
    if (!cleanName) return '';
    if (title === 'mr') return `Mr. ${cleanName}`;
    if (title === 'mrs') return `Mrs. ${cleanName}`;
    if (title === 'ms') return `Ms. ${cleanName}`;
    return cleanName;
};

const drawRichParagraph = (
    pdf: jsPDF,
    segments: { text: string; bold?: boolean }[],
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
) => {
    let cursorX = x;
    let cursorY = y;

    segments.forEach((segment) => {
        pdf.setFont('times', segment.bold ? 'bold' : 'normal');
        const tokens = segment.text.split(/(\s+)/);

        tokens.forEach((token) => {
            if (!token) return;
            const isSpace = /^\s+$/.test(token);
            const tokenWidth = pdf.getTextWidth(token);

            if (!isSpace && cursorX + tokenWidth > x + maxWidth) {
                cursorX = x;
                cursorY += lineHeight;
            }

            if (isSpace && cursorX === x) return;

            pdf.text(token, cursorX, cursorY);
            cursorX += tokenWidth;
        });
    });

    return cursorY + lineHeight;
};

const downloadBoardResolutionPdf = (data: BoardResolutionTemplateData) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const left = 25;
    const right = 185;
    const width = right - left;
    const line = 5.25;
    const auditorName = honorificName(data.auditorName, data.auditorTitle);
    const directorName = honorificName(data.directorName, data.directorTitle);

    pdf.setLineHeightFactor(1.14);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);

    const heading = `CERTIFIED TRUE COPY OF THE RESOLUTION PASSED AT THE MEETING OF THE BOARD OF DIRECTORS OF ${data.companyName.toUpperCase()} HELD ON ${formatDocumentDate(data.meetingDate).replace(/\//g, '.')} AT ${data.registeredOfficeAddress.toUpperCase()}.`;
    pdf.text(pdf.splitTextToSize(heading, width), left, 18);

    let y = 52;
    pdf.setFontSize(10);
    y = drawRichParagraph(pdf, [
        { text: '"RESOLVED THAT pursuant to the provisions of Section 139(6) and other applicable provisions, if any, of the Companies Act, 2013, and the rules made thereunder, ' },
        { text: auditorName, bold: true },
        { text: ', ' },
        { text: 'Chartered Accountant', bold: true },
        { text: ' ' },
        { text: '(CA)', bold: true },
        { text: ' (' },
        { text: `Membership No: ${data.membershipNo}`, bold: true },
        { text: '/ ' },
        { text: `FRN: ${data.frnNo}`, bold: true },
        { text: '), be and is hereby appointed as the ' },
        { text: 'First Statutory Auditor of the Company', bold: true },
        { text: ' to hold office from the date of this meeting until the conclusion of the ' },
        { text: 'First Annual General Meeting of the Company', bold: true },
        { text: ', at such remuneration as may be mutually agreed between the Board of Directors and the Auditor."' },
    ], left, y, width, line);

    y += 8;
    y = drawRichParagraph(pdf, [
        { text: '"RESOLVED FURTHER THAT' },
        { text: ` ${directorName} (DIN No: ${data.dinNo}), Director of the Company`, bold: true },
        { text: ', be and is hereby authorized to sign and file necessary documents/forms with the ' },
        { text: 'Ministry of Corporate Affairs', bold: true },
        { text: ' and to do all such acts, deeds and things as may be required to give effect to this resolution."' },
    ], left, y, width, line);

    const signatureY = Math.max(y + 28, 148);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    pdf.text('Authorised Signatory', left, signatureY);
    pdf.text(`For ${data.companyName}`, left, signatureY + 11);
    pdf.text(directorName, left, signatureY + 17);
    pdf.text('Director', left, signatureY + 23);
    pdf.text(`DIN No: ${data.dinNo}`, left, signatureY + 29);

    pdf.text(`Date: ${formatDocumentDate(data.date).replace(/\//g, '.')}`, left, 263);
    pdf.text(`Place: ${data.place}`, left, 269);

    pdf.save(`${data.companyName || 'board-resolution'}-inc20a-board-resolution.pdf`);
};

const downloadConsentLetterPdf = (data: ConsentLetterTemplateData) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const left = 35;
    const right = 175;
    const width = right - left;
    const line = 4.8;
    const auditorName = honorificName(data.auditorName, data.auditorTitle);

    pdf.setLineHeightFactor(1.08);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    pdf.text('CONSENT LETTER FROM STATUTORY AUDITOR', 105, 18, { align: 'center' });
    pdf.line(68, 19.2, 142, 19.2);

    pdf.setFontSize(8.8);
    pdf.text(`Date: ${formatDocumentDate(data.date).replace(/\//g, '.')}`, 151, 30);

    pdf.setFontSize(8.8);
    pdf.setFont('times', 'normal');
    pdf.text('To', left, 42);
    pdf.setFont('times', 'bold');
    pdf.text('The Board of Directors', left, 48);
    pdf.text(data.companyName, left, 53);
    pdf.text(pdf.splitTextToSize(data.companyAddress, width), left, 58);

    const addressLines = pdf.splitTextToSize(data.companyAddress, width).length;
    let y = 58 + addressLines * 4.6 + 9;
    pdf.setFont('times', 'bold');
    const subjectLines = pdf.splitTextToSize(`Subject: Consent to act as Statutory Auditor of the Company ${data.companyName}`, width);
    pdf.text(subjectLines, left, y);
    y += subjectLines.length * 4.8 + 8;

    pdf.setFont('times', 'normal');
    pdf.text('Dear Sir/Madam,', left, y);
    y += 10;

    y = drawRichParagraph(pdf, [
        { text: 'I, ' },
        { text: auditorName, bold: true },
        { text: ', Chartered Accountant in practice, having ' },
        { text: `Membership No. ${data.membershipNo}`, bold: true },
        { text: ' and ' },
        { text: `Firm Registration No. ${data.frnNo}`, bold: true },
        { text: ', hereby give my consent to act as the Statutory Auditor of ' },
        { text: data.companyName, bold: true },
        { text: ' pursuant to the provisions of Section 139 of the Companies Act, 2013. I further confirm that my appointment, if made, will be within the limits prescribed under the Companies Act, 2013 and that I am not disqualified to be appointed as the Statutory Auditor of the Company under the provisions of Section 141 of the Companies Act, 2013.' },
    ], left, y, width, line);
    y += 6;

    pdf.text('Kindly take the same on record.', left, y);
    y += 12;
    pdf.setFont('times', 'bold');
    pdf.text('Thanking you.', 105, y, { align: 'center' });
    y += 12;
    pdf.text('Yours faithfully,', left, y);

    const signatureY = Math.max(y + 31, 170);
    pdf.setFontSize(8.8);
    pdf.text('(Signature of Auditor)', left, signatureY);
    pdf.text(`Name of the Auditor: ${auditorName}`, left, signatureY + 5);
    pdf.text(`Membership No: ${data.membershipNo}`, left, signatureY + 10);
    pdf.text(`Firm Registration No (FRN): ${data.frnNo}`, left, signatureY + 15);
    const auditorAddressLines = pdf.splitTextToSize(`Address: ${data.auditorAddress}`, width);
    pdf.text(auditorAddressLines, left, signatureY + 20);
    const contactY = signatureY + 20 + auditorAddressLines.length * 4.6;
    pdf.text(`Email: ${data.email}`, left, contactY);
    pdf.text(`Contact No: ${data.contactNumber}`, left, contactY + 5);

    pdf.save(`${data.companyName || 'auditor-consent'}-adt1-consent-letter.pdf`);
};

const INITIAL: RocStandardData = {
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
        mobile: '',
        email: '',
        gender: '',
        activity: '',
        socialCategory: '',
        speciallyAbled: '',
        investmentAmount: '',
        turnoverAmount: '',
        totalEmployees: '',
    },
    documents: BLANK_DOCS,
    declaration: { isConfirmed: false },
};

function saveDraft(data: RocStandardData) {
    try {
        const { documents: _d, ...rest } = data;
        localStorage.setItem(LS_KEY, JSON.stringify(rest));
    } catch (_) { }
}

function loadDraft(): Partial<Omit<RocStandardData, 'documents'>> | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
}

function mergeDraft(draft: Partial<Omit<RocStandardData, 'documents'>>): RocStandardData {
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
        documents: BLANK_DOCS,
        declaration: { ...INITIAL.declaration, ...draft.declaration },
    };
}

// ─── Regex ────────────────────────────────────────────────────────────────────

const RE = {
    cin: /^[lu][0-9]{5}[a-z]{2}[0-9]{4}[a-z]{3}[0-9]{6}$/,
    pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    mobile: /^\d{10}$/,
    pin: /^\d{6}$/,
    ifsc: /^[a-z]{4}0[a-z0-9]{6}$/,
    acct: /^\d{6,18}$/,
    membership: /^\d{5,7}$/,
    frn: /^\d{5,7}$/,
    aadhaar: /^\d{12}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

// ─── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_DOCUMENT_KEYS: (keyof RocStandardDocuments)[] = [
    'coi', 'moa', 'aoa', 'masterData',
    'directorPan', 'directorAadhaar',
    'auditorConsent',
    'inc20aDirectorShareholder1BankPassbook', 'inc20aDirectorShareholder1BankTransaction',
    'inc20aDirectorShareholder2BankPassbook', 'inc20aDirectorShareholder2BankTransaction',
    'inc20aDirectorShareholder3BankPassbook', 'inc20aDirectorShareholder3BankTransaction',
    'inc20aPrimaryBoardResolution', 'inc20aInsideOfficePhoto', 'inc20aOutsideOfficePhoto', 'inc20aBoardResolution',
    'msmeAadhaar', 'msmePan', 'msmeBankProof',
];

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

function validateStep(stepId: StepId, data: RocStandardData): Record<string, string> {
    const e: Record<string, string> = {};
    const { company, director, auditor, inc20a, msme, declaration, documents } = data;

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
        if (!director.dob) e['director_dob'] = 'Date of Birth is required';
        if (!director.pan.trim()) e['director_pan'] = 'PAN is required';
        else if (!RE.pan.test(director.pan.trim())) e['director_pan'] = 'PAN format invalid';
        if (!director.aadhaar.trim()) e['director_aadhaar'] = 'Aadhaar is required';
        else if (!RE.aadhaar.test(director.aadhaar.replace(/\D/g, ''))) e['director_aadhaar'] = 'Aadhaar must be exactly 12 digits';
        if (!director.mobile.trim()) e['director_mobile'] = 'Mobile Number is required';
        else if (!RE.mobile.test(director.mobile.trim())) e['director_mobile'] = 'Mobile must be exactly 10 digits';
        if (!director.email.trim()) e['director_email'] = 'Director Email is required';
        else if (!RE.email.test(director.email)) e['director_email'] = 'Director Email format is invalid';

        Object.assign(e, validateAddress('director_address', director.address));
        if (!documents.directorPan) e['doc_directorPan'] = 'Director PAN is required';
        if (!documents.directorAadhaar) e['doc_directorAadhaar'] = 'Director Aadhaar is required';
    }

    if (stepId === 'auditor') {
        if (!auditor.type) e['auditor_type'] = 'Auditor type is required';
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
            const passbookKey = `inc20aDirectorShareholder${row}BankPassbook` as keyof RocStandardDocuments;
            const transactionKey = `inc20aDirectorShareholder${row}BankTransaction` as keyof RocStandardDocuments;
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

    if (stepId === 'declaration') {
        if (!declaration.isConfirmed) e['declaration_isConfirmed'] = 'You must confirm the declaration before submission';
    }

    return e;
}

function validateAll(data: RocStandardData): Record<string, string> {
    let allErrors: Record<string, string> = {};
    FORM_STEPS.forEach(step => {
        allErrors = { ...allErrors, ...validateStep(step.id, data) };
    });
    REQUIRED_DOCUMENT_KEYS.forEach((docKey) => {
        if (!data.documents[docKey]) allErrors[`doc_${docKey}`] = `${docKey} document is required`;
    });
    return allErrors;
}

// ─── Firebase upload ──────────────────────────────────────────────────────────

async function uploadFile(file: File, userId: string, packageId: string, key: string): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'bin';
    const folder = key.startsWith('msme') ? 'MSME' : key.startsWith('inc20a') ? 'INC-20A' : 'Common';
    const r = ref(storage, `roc-standard-packages/${userId}/${packageId}/${folder}/${key}.${ext}`);
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
                    {text.toLowerCase()}
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
        <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">
            {label}{required && <span className="text-rose-400 ml-1">*</span>}
            {info && <InfoTooltip text={info} />}
        </label>
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            type={type}
            disabled={disabled}
            maxLength={maxLength}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:ring-1 placeholder-slate-500 ${error
                ? 'border-rose-500 bg-rose-500/10 text-white focus:border-rose-400 focus:ring-rose-400/20'
                : 'border-slate-700 bg-slate-800/60 text-white focus:border-cyan-500/60 focus:ring-cyan-500/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        {error ? <p className="text-xs text-rose-400 mt-1">{error}</p> : hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
);

const FormSelect: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; required?: boolean; hint?: string; info?: string;
    error?: string;
}> = ({ label, value, onChange, options, required, hint, info, error }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">
            {label}{required && <span className="text-rose-400 ml-1">*</span>}
            {info && <InfoTooltip text={info} />}
        </label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white outline-none transition-all focus:ring-1 appearance-none cursor-pointer ${error
                ? 'border-rose-500 bg-slate-800/60 focus:border-rose-400 focus:ring-rose-400/20'
                : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                }`}
        >
            <option value="" className="bg-slate-900 text-slate-400">select…</option>
            {options.map((o) => (
                <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>
            ))}
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
        <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">
            {label}{required && <span className="text-rose-400 ml-1">*</span>}
            {info && <InfoTooltip text={info} />}
        </label>
        <div className="flex flex-wrap gap-3">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${value === o.value
                        ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}
                >
                    {o.label}
                </button>
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
            <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">
                {label}{required && <span className="text-rose-400 ml-1">*</span>}
                {info && <InfoTooltip text={info} />}
            </label>
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all select-none ${error
                    ? 'border-rose-500 bg-rose-500/5 text-rose-300'
                    : file
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
                        : sizeErr
                            ? 'border-rose-500/40 bg-rose-500/5 text-rose-300'
                            : 'border-dashed border-slate-700 bg-slate-800/30 text-slate-500 hover:border-cyan-500/40 hover:text-cyan-300'
                    }`}
            >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {file
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    }
                </svg>
                <span className="text-sm truncate flex-1">{file ? file.name.toLowerCase() : 'click or drag to upload'}</span>
                {file && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelect(null); setSizeErr(''); }}
                        className="shrink-0 text-slate-500 hover:text-rose-400 transition-colors leading-none"
                    >
                        ✕
                    </button>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
            />
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
        <span>{children}</span>
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
        {label && <p className="text-xs font-semibold text-slate-400 tracking-wider">{label.toLowerCase()}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Address Line 1" value={value.line1} onChange={(v) => { onChange({ line1: lower(v) }); clearFieldError(`${prefix}_line1`); }} required={required} placeholder="House/Flat No., Building, Street" error={fieldErrors[`${prefix}_line1`]} />
            <FormInput label="Address Line 2" value={value.line2} onChange={(v) => onChange({ line2: lower(v) })} placeholder="Area, Locality, Landmark" />

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

const PreviewPanel: React.FC<{ formData: RocStandardData }> = ({ formData }) => {
    const [activeTab, setActiveTab] = useState<'company' | 'director' | 'auditor' | 'inc20a' | 'msme' | 'documents'>('company');
    const tabs: { id: typeof activeTab; label: string; icon: string }[] = [
        { id: 'company', label: 'company', icon: '🏢' },
        { id: 'director', label: 'director', icon: '👤' },
        { id: 'auditor', label: 'adt-1', icon: '⚖️' },
        { id: 'inc20a', label: 'inc-20a', icon: '🏦' },
        { id: 'msme', label: 'msme', icon: '🏭' },
        { id: 'documents', label: 'docs', icon: '📁' },
    ];
    const Row: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
        <div className={`flex justify-between items-start py-2 border-b border-slate-700/60 last:border-0 gap-3 ${highlight ? 'bg-cyan-500/5 -mx-2 px-2 rounded' : ''}`}>
            <span className="text-xs text-slate-500 shrink-0 w-40">{label.toLowerCase()}</span>
            <span className={`text-xs font-medium text-right break-all ${value && value !== '—' ? 'text-slate-200' : 'text-slate-600'}`}>{displayText(value || '—')}</span>
        </div>
    );
    const docKeys = Object.keys(BLANK_DOCS) as (keyof RocStandardDocuments)[];
    const uploadedCount = docKeys.filter(k => formData.documents[k] !== null).length;
    return (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 px-5 py-4 border-b border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-sm font-bold text-white">live form preview</h4>
                </div>
                <p className="text-xs text-slate-400">auto-updates as you fill the form</p>
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
                    <Row label="cin" value={lower(formData.company.cin)} highlight />
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
                            <div key={key} className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${formData.documents[key] ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800/30 text-slate-600'
                                }`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${formData.documents[key] ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
                                    }`}>{formData.documents[key] ? '✓' : '○'}</span>
                                <span className="truncate">{key}</span>
                            </div>
                        ))}
                    </div>
                </>)}
            </div>
        </div>
    );
};

// ─── Right Status Sidebar ─────────────────────────────────────────────────────

const StatusSidebar: React.FC<{ formData: RocStandardData; currentStepIndex: number; draftFlash: boolean }> = ({ formData, currentStepIndex, draftFlash }) => {
    const totalDocs = Object.keys(BLANK_DOCS).length;
    const uploadedDocs = Object.values(formData.documents).filter(Boolean).length;
    const pct = Math.round((uploadedDocs / totalDocs) * 100);
    const directorName = [formData.director.firstName, formData.director.lastName].filter(Boolean).join(' ') || '—';
    return (
        <aside className="hidden xl:block w-64 shrink-0">
            <div className="sticky top-20 space-y-4">
                <div className={`flex items-center gap-2 text-xs transition-opacity duration-700 ${draftFlash ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400">draft auto-saved</span>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm p-4">
                    <p className="text-xs font-semibold text-slate-400 tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-cyan-400">📋</span> filing summary
                    </p>
                    <div className="space-y-3">
                        {[
                            { label: 'Company', value: formData.company.name || '—' },
                            { label: 'CIN', value: formData.company.cin || '—' },
                            { label: 'Org Type', value: formData.company.organisationType ? formData.company.organisationType.replace(/_/g, ' ') : '—' },
                            { label: 'Director', value: directorName },
                            { label: 'Auditor', value: formData.auditor.name || '—' },
                            { label: 'Director / Shareholder', value: formData.inc20a.directorShareholders[0]?.name || '—' },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex flex-col gap-0.5 border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
                                <span className="text-[10px] text-slate-500 tracking-wide">{label.toLowerCase()}</span>
                                <span className="text-xs text-slate-200 font-medium truncate" title={displayText(value)}>{displayText(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm p-4">
                    <p className="text-xs font-semibold text-slate-400 tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-amber-400">📁</span> documents
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
                    <p className="text-xs font-semibold text-slate-400 tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-emerald-400">✅</span> progress
                    </p>
                    <div className="space-y-2">
                        {FORM_STEPS.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-2.5">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold transition-all ${i < currentStepIndex ? 'bg-emerald-500 text-white shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                                    : i === currentStepIndex ? 'bg-cyan-500 text-white shadow-[0_0_6px_rgba(6,182,212,0.4)] ring-2 ring-cyan-500/20'
                                        : 'bg-slate-800 text-slate-600 border border-slate-700'
                                    }`}>{i < currentStepIndex ? '✓' : i + 1}</div>
                                <span className={`text-xs font-medium ${i < currentStepIndex ? 'text-emerald-400'
                                    : i === currentStepIndex ? 'text-cyan-300'
                                        : 'text-slate-600'
                                    }`}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm p-4">
                    <p className="text-xs font-semibold text-slate-400 tracking-wider mb-3">filings covered</p>
                    <div className="space-y-1.5">
                        {['adt-1', 'inc-20a', 'dir-3 kyc', 'msme registration'].map((f) => (
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

export default function RocStandardPackageForm({ user }: RocStandardPackageFormProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
    const [formData, setFormData] = useState<RocStandardData>(() => {
        const draft = loadDraft();
        if (!draft) return INITIAL;
        return mergeDraft(draft);
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showConsentGenerator, setShowConsentGenerator] = useState(false);
    const [showBoardGenerator, setShowBoardGenerator] = useState(false);
    const [consentTemplate, setConsentTemplate] = useState<ConsentLetterTemplateData>(() => ({
        date: todayInputDate(),
        companyName: formData.company.name,
        companyAddress: fullAddress(formData.company.address),
        auditorName: formData.auditor.name,
        auditorTitle: '',
        membershipNo: formData.auditor.membershipNo,
        frnNo: '',
        auditorAddress: formData.auditor.address,
        email: formData.auditor.email,
        contactNumber: formData.auditor.mobile,
    }));
    const [boardTemplate, setBoardTemplate] = useState<BoardResolutionTemplateData>(() => ({
        companyName: formData.company.name,
        meetingDate: todayInputDate(),
        registeredOfficeAddress: fullAddress(formData.company.address),
        auditorName: formData.auditor.name,
        auditorTitle: '',
        membershipNo: formData.auditor.membershipNo,
        frnNo: '',
        directorName: [formData.director.firstName, formData.director.lastName].filter(Boolean).join(' '),
        directorTitle: '',
        dinNo: '',
        place: formData.company.address.district || formData.company.address.state,
        date: todayInputDate(),
    }));
    const [consentTemplateErrors, setConsentTemplateErrors] = useState<Partial<Record<keyof ConsentLetterTemplateData, string>>>({});
    const [boardTemplateErrors, setBoardTemplateErrors] = useState<Partial<Record<keyof BoardResolutionTemplateData, string>>>({});

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
    const setDoc = useCallback((k: keyof RocStandardDocuments, f: File | null) => setFormData(d => ({ ...d, documents: { ...d.documents, [k]: f } })), []);
    const setDeclaration = useCallback((p: Partial<RocStandardDeclaration>) => setFormData(d => ({ ...d, declaration: { ...d.declaration, ...p } })), []);

    const isMsmeApplicable = useMemo(() => MSME_ORG_TYPES.includes(formData.company.organisationType), [formData.company.organisationType]);

    const clearFieldError = useCallback((key: string) => {
        setFieldErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const updateConsentTemplate = useCallback((key: keyof ConsentLetterTemplateData, value: string) => {
        setConsentTemplate(prev => ({ ...prev, [key]: value }));
        setConsentTemplateErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const updateBoardTemplate = useCallback((key: keyof BoardResolutionTemplateData, value: string) => {
        setBoardTemplate(prev => ({ ...prev, [key]: value }));
        setBoardTemplateErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const syncConsentTemplateFromForm = useCallback(() => {
        setConsentTemplate(prev => ({
            ...prev,
            companyName: prev.companyName || formData.company.name,
            companyAddress: prev.companyAddress || fullAddress(formData.company.address),
            auditorName: prev.auditorName || formData.auditor.name,
            membershipNo: prev.membershipNo || formData.auditor.membershipNo,
            auditorAddress: prev.auditorAddress || formData.auditor.address,
            email: prev.email || formData.auditor.email,
            contactNumber: prev.contactNumber || formData.auditor.mobile,
        }));
    }, [formData.auditor, formData.company]);

    const syncBoardTemplateFromForm = useCallback(() => {
        setBoardTemplate(prev => ({
            ...prev,
            companyName: prev.companyName || formData.company.name,
            registeredOfficeAddress: prev.registeredOfficeAddress || fullAddress(formData.company.address),
            auditorName: prev.auditorName || formData.auditor.name,
            membershipNo: prev.membershipNo || formData.auditor.membershipNo,
            directorName: prev.directorName || [formData.director.firstName, formData.director.lastName].filter(Boolean).join(' '),
            place: prev.place || formData.company.address.district || formData.company.address.state,
        }));
    }, [formData.auditor, formData.company, formData.director.firstName, formData.director.lastName]);

    const handleConsentPdfDownload = useCallback(() => {
        const labels: Record<keyof ConsentLetterTemplateData, string> = {
            date: 'Date',
            companyName: 'Company Name',
            companyAddress: 'Company Address',
            auditorName: 'Auditor Name',
            auditorTitle: 'Auditor Title',
            membershipNo: 'Membership No',
            frnNo: 'FRN No',
            auditorAddress: 'Auditor Address',
            email: 'Email',
            contactNumber: 'Contact Number',
        };
        const errors = validateTemplateFields(consentTemplate, labels);
        if (consentTemplate.membershipNo && !RE.membership.test(consentTemplate.membershipNo.trim())) {
            errors.membershipNo = 'Membership No must be 5-7 digits';
        }
        if (consentTemplate.frnNo && !RE.frn.test(consentTemplate.frnNo.trim())) {
            errors.frnNo = 'FRN No must be 5-7 digits';
        }
        setConsentTemplateErrors(errors);
        if (Object.keys(errors).length) return;
        downloadConsentLetterPdf(consentTemplate);
    }, [consentTemplate]);

    const handleBoardPdfDownload = useCallback(() => {
        const labels: Record<keyof BoardResolutionTemplateData, string> = {
            companyName: 'Company Name',
            meetingDate: 'Meeting Date',
            registeredOfficeAddress: 'Registered Office Address',
            auditorName: 'Auditor Name',
            auditorTitle: 'Auditor Title',
            membershipNo: 'Membership No',
            frnNo: 'FRN No',
            directorName: 'Director Name',
            directorTitle: 'Director Title',
            dinNo: 'DIN No',
            place: 'Place',
            date: 'Date',
        };
        const errors = validateTemplateFields(boardTemplate, labels);
        if (boardTemplate.membershipNo && !RE.membership.test(boardTemplate.membershipNo.trim())) {
            errors.membershipNo = 'Membership No must be 5-7 digits';
        }
        if (boardTemplate.frnNo && !RE.frn.test(boardTemplate.frnNo.trim())) {
            errors.frnNo = 'FRN No must be 5-7 digits';
        }
        setBoardTemplateErrors(errors);
        if (Object.keys(errors).length) return;
        downloadBoardResolutionPdf(boardTemplate);
    }, [boardTemplate]);

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
            const submissionData = lowerStringValues(formData);
            const applicationRef = generateRocReferenceId('standard');
            const packageId = `roc-standard-${Date.now()}`;
            const docUrls: Record<string, string> = {};
            for (const [key, file] of Object.entries(formData.documents) as [keyof RocStandardDocuments, File | null][]) {
                if (file) {
                    setUploadProgress(`Uploading ${String(key)}…`);
                    docUrls[String(key)] = await uploadFile(file, user.uid, packageId, String(key));
                }
            }
            setUploadProgress('Saving package…');
            const masterRef = await addDoc(collection(db, 'roc-standard-packages'), {
                packageType: 'standard',
                title: 'ROC Standard Compliance Package',
                applicationRef,
                status: 'submitted',
                userId: user.uid,
                company: submissionData.company,
                director: submissionData.director,
                auditor: submissionData.auditor,
                inc20a: submissionData.inc20a,
                msme: isMsmeApplicable ? submissionData.msme : null,
                paymentStatus: finalPaymentInfo ? 'paid' : 'pending',
                paymentAmount: STANDARD_PACKAGE_TOTAL,
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
                    msme: isMsmeApplicable
                }
            });
            const finalId = masterRef.id;

            setUploadProgress('Saving to user profile…');
            await firestoreSetDoc(doc(db, 'users', user.uid, 'documents', finalId), {
                id: finalId,
                caseId: applicationRef,
                type: 'roc_standard',
                title: 'ROC Standard Compliance Package',
                status: 'submitted',
                submittedAt: serverTimestamp(),
                userId: user.uid,
                folderId: 'regibiz',
                taskStatus: 'unassigned',
                paymentStatus: finalPaymentInfo ? 'paid' : 'pending',
                paymentAmount: STANDARD_PACKAGE_TOTAL,
                paymentCurrency: 'INR',
                paymentId: finalPaymentInfo?.razorpay_payment_id || '',
                paymentOrderId: finalPaymentInfo?.razorpay_order_id || '',
                paymentSignature: finalPaymentInfo?.razorpay_signature || '',
                formData: {
                    company: submissionData.company,
                    director: submissionData.director,
                    auditor: submissionData.auditor,
                    inc20a: submissionData.inc20a,
                    msme: isMsmeApplicable ? submissionData.msme : null,
                },
                uploadedFileUrls: docUrls,
            });

            setUploadProgress('Creating individual filing records…');
            await Promise.all([
                addDoc(collection(db, 'adt1-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-ADT1`, applicationRef,
                    title: 'ADT-1 Filing (Standard Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: submissionData.company, director: submissionData.director, auditor: submissionData.auditor,
                    documentUrls: {
                        auditorConsent: docUrls.auditorConsent ?? null,
                    },
                }),
                addDoc(collection(db, 'inc20a-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-INC20A`, applicationRef,
                    title: 'INC-20A Filing (Standard Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: submissionData.company, director: submissionData.director,
                    inc20a: submissionData.inc20a,
                    documentUrls: {
                        coi: docUrls.coi ?? null, moa: docUrls.moa ?? null,
                        aoa: docUrls.aoa ?? null,
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
                    },
                }),
                addDoc(collection(db, 'dir-3-kyc-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-DIRKYC`, applicationRef,
                    title: 'DIR-3 KYC (Standard Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: submissionData.company, director: submissionData.director,
                    documentUrls: {
                        directorPan: docUrls.directorPan ?? null,
                        directorAadhaar: docUrls.directorAadhaar ?? null,
                    },
                }),
                addDoc(collection(db, 'msme-applications'), {
                    userId: user.uid, packageCaseId: finalId, caseId: `${finalId}-MSME`, applicationRef,
                    title: 'MSME Registration (Standard Package)', status: 'submitted', submittedAt: serverTimestamp(),
                    company: submissionData.company, director: submissionData.director,
                    msme: submissionData.msme,
                    documentUrls: {
                        aadhaarCard: docUrls.msmeAadhaar ?? null,
                        panCard: docUrls.msmePan ?? null,
                        bankProof: docUrls.msmeBankProof ?? null,
                        gstCertificate: docUrls.msmeGstCertificate ?? null,
                        addressProof: docUrls.msmeAddressProof ?? null,
                        businessProof: docUrls.msmeBusinessProof ?? null,
                    },
                }),
            ]);
            localStorage.removeItem(LS_KEY);
            setSubmittedId(applicationRef);
            setPaymentInfo(finalPaymentInfo || null);
            await sendConfirmationEmail({
                name: submissionData.company.name || 'user',
                email: user.email,
                service: "ROC Compliance Standard Package",
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
            STANDARD_PACKAGE_TOTAL,
            async (response) => {
                setPaymentInfo(response);
                setIsPaying(false);
                await handleSubmit(response);
            },
            {
                name: 'RegiBIZ ROC Standard Package',
                description: `Service Fee: ₹${STANDARD_PACKAGE_FEE.toLocaleString('en-IN')} + GST: ₹${calculateGST(STANDARD_PACKAGE_FEE).toLocaleString('en-IN')} = Total: ₹${STANDARD_PACKAGE_TOTAL.toLocaleString('en-IN')}`,
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
    }, [STANDARD_PACKAGE_FEE, STANDARD_PACKAGE_TOTAL, displayRazorpay, formData, handleSubmit, paymentInfo, user]);

    // ─── Step Renderers ───────────────────────────────────────────────────────

    const renderCompanyStep = () => (
        <div className="space-y-8">
            <SectionHeader title="Company Details" subtitle="Basic entity information." badge="Step 1" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormInput label="Corporate Identification Number (CIN)" value={formData.company.cin} onChange={(v) => { setCompany({ cin: lower(v) }); clearFieldError('company_cin'); }} placeholder="L12345MH2020PLC123456" required maxLength={21} hint="21-char CIN starting with L or U" error={fieldErrors['company_cin']} />
                <FormInput label="Company Name" value={formData.company.name} onChange={(v) => { setCompany({ name: lower(v) }); clearFieldError('company_name'); }} placeholder="Acme Technologies Private Limited" required info="Full legal name exactly as registered with the Registrar of Companies." error={fieldErrors['company_name']} />
                <FormSelect label="Organisation / Constitution Type" value={formData.company.organisationType} onChange={(v) => { setCompany({ organisationType: v }); clearFieldError('company_organisationType'); }} required
                    options={[
                        { value: 'private_limited', label: 'Private Limited Company' },
                        { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
                        { value: 'partnership', label: 'Partnership Firm' },
                        { value: 'proprietorship', label: 'Proprietorship' },
                    ]} error={fieldErrors['company_organisationType']} />
                <FormInput label="Company Email" value={formData.company.email} onChange={(v) => { setCompany({ email: lower(v) }); clearFieldError('company_email'); }} placeholder="info@company.com" type="email" required error={fieldErrors['company_email']} />
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
                    <FormInput label="First Name" value={formData.director.firstName} onChange={(v) => { setDirector({ firstName: lower(v) }); clearFieldError('director_firstName'); }} required error={fieldErrors['director_firstName']} />
                    <FormInput label="Last Name" value={formData.director.lastName} onChange={(v) => { setDirector({ lastName: lower(v) }); clearFieldError('director_lastName'); }} required error={fieldErrors['director_lastName']} />
                    <FormInput label="Father's Name" value={formData.director.fatherName} onChange={(v) => { setDirector({ fatherName: lower(v) }); clearFieldError('director_fatherName'); }} required error={fieldErrors['director_fatherName']} />
                    <FormInput label="Date of Birth" value={formData.director.dob} onChange={(v) => { setDirector({ dob: v }); clearFieldError('director_dob'); }} type="date" required error={fieldErrors['director_dob']} />
                    <FormInput label="PAN" value={formData.director.pan} onChange={(v) => { setDirector({ pan: formatPanInput(v) }); clearFieldError('director_pan'); }} placeholder="ABCDE1234F" required maxLength={10} error={fieldErrors['director_pan']} />
                    <FormInput label="Aadhaar" value={formData.director.aadhaar} onChange={(v) => { setDirector({ aadhaar: v.replace(/\D/g, '') }); clearFieldError('director_aadhaar'); }} placeholder="123456789012" required maxLength={12} type="tel" error={fieldErrors['director_aadhaar']} />
                    <FormInput label="Mobile" value={formData.director.mobile} onChange={(v) => { setDirector({ mobile: v.replace(/\D/g, '') }); clearFieldError('director_mobile'); }} placeholder="9876543210" required maxLength={10} type="tel" error={fieldErrors['director_mobile']} />
                    <FormInput label="Email" value={formData.director.email} onChange={(v) => { setDirector({ email: lower(v) }); clearFieldError('director_email'); }} type="email" required error={fieldErrors['director_email']} />
                </div>
            </div>

            <div>
                <SubLabel idx="2">Residential Address</SubLabel>
                <AddressBlock label="" value={formData.director.address} onChange={setDirectorAddr} required prefix="director_address" fieldErrors={fieldErrors} clearFieldError={clearFieldError} />
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">director kyc documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 shrink-0 ml-3">dir-3 kyc</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploader label="Director PAN Card" file={formData.documents.directorPan} onSelect={(f) => { setDoc('directorPan', f); clearFieldError('doc_directorPan'); }} required info="Self-attested copy of the director's PAN card." error={fieldErrors['doc_directorPan']} />
                    <FileUploader label="Director Aadhaar Card" file={formData.documents.directorAadhaar} onSelect={(f) => { setDoc('directorAadhaar', f); clearFieldError('doc_directorAadhaar'); }} required info="Self-attested copy of the director's Aadhaar card." error={fieldErrors['doc_directorAadhaar']} />
                </div>
            </div>
        </div>
    );

    const renderAuditorStep = () => (
        <div className="space-y-8">
            <SectionHeader title="Auditor Details — ADT-1" subtitle="Statutory auditor appointment details." badge="ADT-1" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <RadioGroup label="Auditor Type" value={formData.auditor.type} onChange={(v) => { setAuditor({ type: v as RocAuditorData['type'] }); clearFieldError('auditor_type'); }} required
                    options={[{ value: 'individual', label: 'Individual CA' }, { value: 'firm', label: 'Audit Firm' }]} error={fieldErrors['auditor_type']} />
                <FormInput label="Auditor / Firm Name" value={formData.auditor.name} onChange={(v) => { setAuditor({ name: lower(v) }); clearFieldError('auditor_name'); }} required error={fieldErrors['auditor_name']} />
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
                <FormInput label="Auditor Email" value={formData.auditor.email} onChange={(v) => { setAuditor({ email: lower(v) }); clearFieldError('auditor_email'); }} type="email" required error={fieldErrors['auditor_email']} />
                <FormInput label="Auditor Mobile" value={formData.auditor.mobile} onChange={(v) => { setAuditor({ mobile: v.replace(/\D/g, '') }); clearFieldError('auditor_mobile'); }} type="tel" required maxLength={10} error={fieldErrors['auditor_mobile']} />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">
                    Auditor's Office Address <span className="text-rose-400 ml-1">*</span>
                    <InfoTooltip text="Complete office address of the auditor or audit firm." />
                </label>
                <textarea
                    value={lower(formData.auditor.address)}
                    onChange={(e) => { setAuditor({ address: lower(e.target.value) }); clearFieldError('auditor_address'); }}
                    rows={2}
                    placeholder="full office address of auditor / audit firm"
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-1 resize-none ${fieldErrors['auditor_address']
                        ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20'
                        : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'
                        }`}
                />
                {fieldErrors['auditor_address'] && <p className="text-xs text-rose-400 mt-1">{fieldErrors['auditor_address']}</p>}
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-200">auditor documents</p>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 shrink-0 ml-3">adt-1</span>
                </div>
                <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-cyan-200">Generate Consent Letter</p>
                            <p className="text-xs text-slate-400 mt-1">Fill the auditor details, download the PDF, sign it, then upload the signed copy below.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                syncConsentTemplateFromForm();
                                setShowConsentGenerator(prev => !prev);
                            }}
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/15 transition-all"
                        >
                            {showConsentGenerator ? 'Hide Generator' : 'Generate Consent Letter'}
                        </button>
                    </div>
                    {showConsentGenerator && (
                        <div className="mt-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormInput label="Date" type="date" value={consentTemplate.date} onChange={(v) => updateConsentTemplate('date', v)} required error={consentTemplateErrors.date} />
                                <FormInput label="Company Name" value={consentTemplate.companyName} onChange={(v) => updateConsentTemplate('companyName', v)} required error={consentTemplateErrors.companyName} />
                                <FormInput label="Auditor Name" value={consentTemplate.auditorName} onChange={(v) => updateConsentTemplate('auditorName', v)} required error={consentTemplateErrors.auditorName} />
                                <FormSelect label="Auditor Title" value={consentTemplate.auditorTitle} onChange={(v) => updateConsentTemplate('auditorTitle', v as ConsentLetterTemplateData['auditorTitle'])} required options={[{ value: 'mr', label: 'Mr.' }, { value: 'mrs', label: 'Mrs.' }, { value: 'ms', label: 'Ms.' }]} error={consentTemplateErrors.auditorTitle} />
                                <FormInput label="Membership No" value={consentTemplate.membershipNo} onChange={(v) => updateConsentTemplate('membershipNo', v.replace(/\D/g, ''))} required maxLength={7} hint="5-7 digits only" error={consentTemplateErrors.membershipNo} />
                                <FormInput label="FRN No" value={consentTemplate.frnNo} onChange={(v) => updateConsentTemplate('frnNo', v.replace(/\D/g, ''))} required maxLength={7} hint="5-7 digits only" error={consentTemplateErrors.frnNo} />
                                <FormInput label="Email" value={consentTemplate.email} onChange={(v) => updateConsentTemplate('email', lower(v))} type="email" required error={consentTemplateErrors.email} />
                                <FormInput label="Contact Number" value={consentTemplate.contactNumber} onChange={(v) => updateConsentTemplate('contactNumber', v.replace(/\D/g, ''))} maxLength={10} required error={consentTemplateErrors.contactNumber} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">Company Address <span className="text-rose-400 ml-1">*</span></label>
                                    <textarea value={consentTemplate.companyAddress} onChange={(e) => updateConsentTemplate('companyAddress', e.target.value)} rows={3} className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-1 resize-none ${consentTemplateErrors.companyAddress ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20' : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'}`} />
                                    {consentTemplateErrors.companyAddress && <p className="text-xs text-rose-400 mt-1">{consentTemplateErrors.companyAddress}</p>}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">Auditor Address <span className="text-rose-400 ml-1">*</span></label>
                                    <textarea value={consentTemplate.auditorAddress} onChange={(e) => updateConsentTemplate('auditorAddress', e.target.value)} rows={3} className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-1 resize-none ${consentTemplateErrors.auditorAddress ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20' : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'}`} />
                                    {consentTemplateErrors.auditorAddress && <p className="text-xs text-rose-400 mt-1">{consentTemplateErrors.auditorAddress}</p>}
                                </div>
                            </div>
                            <button type="button" onClick={handleConsentPdfDownload} className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-teal-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/10 hover:from-teal-500 hover:to-blue-600 transition-all">
                                Download PDF
                            </button>
                        </div>
                    )}
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
                    const passbookKey = `inc20aDirectorShareholder${row}BankPassbook` as keyof RocStandardDocuments;
                    const transactionKey = `inc20aDirectorShareholder${row}BankTransaction` as keyof RocStandardDocuments;
                    return (
                        <div key={row} className="rounded-xl border border-slate-700/60 bg-slate-900/65 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-semibold text-slate-200">Director / Shareholder {row}</p>
                                <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300">required</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                                <FormInput label="Director / Shareholder Name" value={entry.name} onChange={(v) => { setInc20aDirectorShareholder(index, { name: lower(v) }); clearFieldError(`inc20a_directorShareholder_${index}_name`); }} required error={fieldErrors[`inc20a_directorShareholder_${index}_name`]} />
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
                <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-cyan-200">Generate Board Resolution</p>
                            <p className="text-xs text-slate-400 mt-1">Fill the resolution details, download the PDF, sign it, then upload the signed copy below.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                syncBoardTemplateFromForm();
                                setShowBoardGenerator(prev => !prev);
                            }}
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/15 transition-all"
                        >
                            {showBoardGenerator ? 'Hide Generator' : 'Generate Board Resolution'}
                        </button>
                    </div>
                    {showBoardGenerator && (
                        <div className="mt-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormInput label="Company Name" value={boardTemplate.companyName} onChange={(v) => updateBoardTemplate('companyName', v)} required error={boardTemplateErrors.companyName} />
                                <FormInput label="Meeting Date" type="date" value={boardTemplate.meetingDate} onChange={(v) => updateBoardTemplate('meetingDate', v)} required error={boardTemplateErrors.meetingDate} />
                                <FormInput label="Auditor Name" value={boardTemplate.auditorName} onChange={(v) => updateBoardTemplate('auditorName', v)} required error={boardTemplateErrors.auditorName} />
                                <FormSelect label="Auditor Title" value={boardTemplate.auditorTitle} onChange={(v) => updateBoardTemplate('auditorTitle', v as BoardResolutionTemplateData['auditorTitle'])} required options={[{ value: 'mr', label: 'Mr.' }, { value: 'mrs', label: 'Mrs.' }, { value: 'ms', label: 'Ms.' }]} error={boardTemplateErrors.auditorTitle} />
                                <FormInput label="Membership No" value={boardTemplate.membershipNo} onChange={(v) => updateBoardTemplate('membershipNo', v.replace(/\D/g, ''))} required maxLength={7} hint="5-7 digits only" error={boardTemplateErrors.membershipNo} />
                                <FormInput label="FRN No" value={boardTemplate.frnNo} onChange={(v) => updateBoardTemplate('frnNo', v.replace(/\D/g, ''))} required maxLength={7} hint="5-7 digits only" error={boardTemplateErrors.frnNo} />
                                <FormInput label="Director Name" value={boardTemplate.directorName} onChange={(v) => updateBoardTemplate('directorName', v)} required error={boardTemplateErrors.directorName} />
                                <FormSelect label="Director Title" value={boardTemplate.directorTitle} onChange={(v) => updateBoardTemplate('directorTitle', v as BoardResolutionTemplateData['directorTitle'])} required options={[{ value: 'mr', label: 'Mr.' }, { value: 'mrs', label: 'Mrs.' }, { value: 'ms', label: 'Ms.' }]} error={boardTemplateErrors.directorTitle} />
                                <FormInput label="DIN No" value={boardTemplate.dinNo} onChange={(v) => updateBoardTemplate('dinNo', v.replace(/\D/g, ''))} maxLength={8} required error={boardTemplateErrors.dinNo} />
                                <FormInput label="Place" value={boardTemplate.place} onChange={(v) => updateBoardTemplate('place', v)} required error={boardTemplateErrors.place} />
                                <FormInput label="Date" type="date" value={boardTemplate.date} onChange={(v) => updateBoardTemplate('date', v)} required error={boardTemplateErrors.date} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-400 tracking-wide flex items-center">Registered Office Address <span className="text-rose-400 ml-1">*</span></label>
                                <textarea value={boardTemplate.registeredOfficeAddress} onChange={(e) => updateBoardTemplate('registeredOfficeAddress', e.target.value)} rows={3} className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-1 resize-none ${boardTemplateErrors.registeredOfficeAddress ? 'border-rose-500 bg-rose-500/10 focus:border-rose-400 focus:ring-rose-400/20' : 'border-slate-700 bg-slate-800/60 focus:border-cyan-500/60 focus:ring-cyan-500/20'}`} />
                                {boardTemplateErrors.registeredOfficeAddress && <p className="text-xs text-rose-400 mt-1">{boardTemplateErrors.registeredOfficeAddress}</p>}
                            </div>
                            <button type="button" onClick={handleBoardPdfDownload} className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-teal-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/10 hover:from-teal-500 hover:to-blue-600 transition-all">
                                Download PDF
                            </button>
                        </div>
                    )}
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
                    ⚠️ msme registration is primarily for proprietorships, partnerships, llps, and companies. ensure this is required for your entity.
                </div>
            )}

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                <div className="flex flex-col gap-1 mb-5">
                    <p className="text-base font-semibold text-cyan-200">upload documents first for faster processing</p>
                    <p className="text-sm text-slate-400">we will use these documents to verify aadhaar, pan, bank details, gstin and business identity. if ocr is unavailable, admin will verify manually.</p>
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
                    <FormInput label="Email ID" value={formData.msme.email} onChange={(v) => { setMsme({ email: lower(v) }); clearFieldError('msme_email'); }} type="email" required error={fieldErrors['msme_email']} />
                    <FormSelect label="Gender" value={formData.msme.gender} onChange={(v) => { setMsme({ gender: v as RocMsmeData['gender'] }); clearFieldError('msme_gender'); }} required
                        options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} error={fieldErrors['msme_gender']} />
                    <FormSelect label="Social Category" value={formData.msme.socialCategory} onChange={(v) => { setMsme({ socialCategory: v }); clearFieldError('msme_socialCategory'); }} required
                        options={[
                            { value: 'general', label: 'General' },
                            { value: 'obc', label: 'OBC' },
                            { value: 'sc', label: 'SC' },
                            { value: 'st', label: 'ST' },
                            { value: 'ews', label: 'EWS' },
                            { value: 'minority', label: 'Minority' },
                        ]} error={fieldErrors['msme_socialCategory']} />
                    <RadioGroup label="Specially Abled?" value={formData.msme.speciallyAbled} onChange={(v) => { setMsme({ speciallyAbled: v }); clearFieldError('msme_speciallyAbled'); }} required
                        options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} error={fieldErrors['msme_speciallyAbled']} />
                    <FormSelect
                        label="Activity Type"
                        value={formData.msme.activity}
                        onChange={(v) => { setMsme({ activity: v }); clearFieldError('msme_activity'); }}
                        required
                        options={[
                            { value: 'manufacturing', label: 'Manufacturing' },
                            { value: 'service', label: 'Service' },
                            { value: 'trading', label: 'Trading' },
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

    const renderDeclarationStep = () => {
        const totalDocs = Object.values(formData.documents).filter(Boolean).length;

        return (
            <div className="space-y-8">
                <SectionHeader title="Full Preview & Declaration" subtitle="Review all entered data using the preview panel below, confirm declarations, then submit." badge="Final Step" />
                <PreviewPanel formData={formData} />

                {/* Summary */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-5 space-y-2.5">
                    <p className="text-sm font-semibold text-slate-300 mb-3">submission summary</p>
                    {[
                        { label: 'Company', value: formData.company.name || '—' },
                        { label: 'CIN', value: formData.company.cin || '—' },
                        { label: 'Org Type', value: formData.company.organisationType || '—' },
                        { label: 'Director', value: [formData.director.firstName, formData.director.lastName].filter(Boolean).join(' ') || '—' },
                        { label: 'Auditor', value: formData.auditor.name || '—' },
                        { label: 'Director / Shareholder', value: formData.inc20a.directorShareholders[0]?.name || '—' },
                        { label: 'Filings Covered', value: 'ADT-1, INC-20A, DIR-3 KYC, MSME' },
                        { label: 'Documents Attached', value: `${totalDocs} / ${Object.keys(BLANK_DOCS).length} files` },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-start text-sm border-b border-slate-700/60 pb-2 last:border-0 last:pb-0">
                            <span className="text-slate-500 shrink-0 mr-4 w-44">{label.toLowerCase()}</span>
                            <span className="text-slate-200 text-right font-medium">{displayText(value)}</span>
                        </div>
                    ))}
                </div>

                {/* Declarations */}
                <div className="space-y-4">
                    <p className="text-sm font-semibold text-slate-300">declarations <span className="text-rose-400 font-normal text-xs ml-1">all required</span></p>
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
                            <p className="text-sm text-slate-300 leading-relaxed select-none">i confirm that all required information and documents for adt-1, inc-20a, dir-3 kyc and msme are complete and correct.</p>
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
            case 'director': return renderDirectorStep();
            case 'auditor': return renderAuditorStep();
            case 'inc20a': return renderInc20aStep();
            case 'msme': return renderMsmeStep();
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
                        <h2 className="text-2xl font-bold text-white mb-2">roc package submitted!</h2>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto mb-8">
                            your roc standard compliance package has been received. our team will review and begin filing within 24 hours.
                        </p>
                        <div className="mb-6">
                            <p className="text-slate-500 text-xs tracking-wide font-medium mb-1">reference id</p>
                            <div className="inline-block bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50">
                                <p className="text-orange-400 font-mono font-bold text-lg tracking-wider">{submittedId}</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/40 rounded-xl p-4 mb-8 text-left border border-slate-700/50 space-y-3">
                            {[
                                { label: 'Applicant', value: user.displayName || 'Valued Client' },
                                { label: 'Company', value: formData.company.name },
                                { label: 'Package', value: 'roc standard Bundle' },
                                { label: 'Filings', value: 'ADT-1 · INC-20A · DIR-3 KYC · MSME' },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-slate-500 text-sm">{label.toLowerCase()}</span>
                                    <span className="text-white font-medium text-sm">{displayText(value)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <button type="button" onClick={() => navigate('/documents')} className="w-full group relative px-6 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-blue-700 group-hover:from-teal-500 group-hover:to-blue-600 transition-all" />
                                <span className="relative flex items-center justify-center gap-2">
                                    view my documents
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>
                            </button>
                            <button type="button" onClick={() => navigate('/services')} className="w-full px-6 py-3.5 rounded-xl font-semibold text-slate-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white border border-slate-700 hover:border-slate-600 transition-all">
                                back to services
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-slate-600 text-xs mt-6">© 2026 regibiz compliance solutions</p>
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
                        <h1 className="text-base font-semibold text-white">ROC Standard Compliance Package</h1>
                        <p className="text-xs text-slate-400">step {currentStepIndex + 1} of {FORM_STEPS.length} — {currentStep.label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-xs text-emerald-400 transition-opacity duration-700 ${draftFlash ? 'opacity-100' : 'opacity-0'}`}>✓ draft saved</span>
                        <button type="button" onClick={handleClearDraft} className="text-xs px-2.5 py-1 rounded-lg border border-rose-800/40 text-rose-400/70 hover:text-rose-400 hover:border-rose-600/50 transition-all">
                            clear draft
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
                        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-2xl backdrop-blur-xl p-6 md:p-8">
                            {renderCurrentStep()}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex items-center justify-between mt-6 gap-4">
                            <button type="button" onClick={handleBack} disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                back
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
                                            {isPaying ? 'Opening payment…' : (uploadProgress || 'submitting…').toLowerCase()}
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            pay & submit roc standard package
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button type="button" onClick={handleNext}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-teal-500 hover:via-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/30">
                                    continue
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
