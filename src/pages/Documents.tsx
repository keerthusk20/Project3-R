import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  FileText, Search, Loader2, Download, ExternalLink, X, Calendar, User, Mail,
  CheckCircle2, AlertCircle, Hourglass, Filter, Building, BriefcaseIcon,
  CreditCard, Folder, ArrowUpDown, Trash2, AlertTriangle, Eye, ShieldCheck,
  Hash, Phone, MapPin, Edit2, Save, RotateCcw, FileCheck, FileSignature,
  Banknote, Home, Map, Users, ClipboardList, CheckSquare, AlertOctagon, Info,
  Rocket, Pen, Upload, Trash2 as TrashIcon, Contact, Activity, Key, MapPinned,
  Star, IndianRupee, Globe, BadgeCheck, Plus, MoreVertical, CornerUpRight, Copy, Layers, Heart,
  Clock, Menu, Shield, Gavel, ArrowLeft, PieChart
} from 'lucide-react';
import { UserProfile } from '../types';
import { storage, db } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  doc, setDoc, collection, query, where, getDocs, DocumentData,
  QueryDocumentSnapshot, orderBy, deleteDoc, updateDoc, Timestamp, addDoc
} from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { triggerNotification } from '../services/NotificationService';
import { Application } from '../Types/Application';
// Import mock service for legal docs
import { mockDbService } from '../services/mockFirebase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export interface DocumentsProps {
  user: UserProfile;
}

export interface ToastMessage {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface EditMode {
  isActive: boolean;
  applicationId: string | null;
  step: number;
}

// Legal Template Interface
interface LegalTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Agreement' | 'Notice' | 'HR' | 'Letter' | 'Invoice' | 'GST' | 'Authorization';
  icon: any;
}

// Interface for stored Legal Docs (from mockDbService)
interface LegalDocument {
  id: string;
  type: 'legal';
  subtype: string;
  title: string;
  content: string;
  submittedAt: number;
  formData: any;
  userId: string;
  folderId?: string;
}

export interface DraftApplication {
  id: string;
  userId: string;
  userEmail?: string;
  createdBy?: string;
  createdEmail?: string;
  serviceType: string;
  serviceName?: string;
  formData: any;
  currentStep: number;
  docSubStep?: number;
  updatedAt: any;
  status: 'draft';
  caseId: string;
  routeState?: Record<string, any>;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATE_MAPPING: Record<string, string> = {
  AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar',
  CG: 'Chhattisgarh', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana',
  HP: 'Himachal Pradesh', JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala',
  MP: 'Madhya Pradesh', MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya',
  MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', PB: 'Punjab',
  RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana',
  TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', WB: 'West Bengal',
  DL: 'Delhi', JK: 'Jammu and Kashmir', LA: 'Ladakh', PY: 'Puducherry',
  CH: 'Chandigarh', DN: 'Dadra and Nagar Haveli', DD: 'Daman and Diu',
  LD: 'Lakshadweep', AN: 'Andaman and Nicobar Islands',
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Other Country'
};

const SERVICE_NAMES: Record<string, string> = {
  fssai: 'FSSAI',
  gst: 'GST',
  trademark: 'Trademark',
  msme: 'MSME',
  pan: 'PAN Card',
  startup: 'DPIIT',
  'shop-establishment': 'Shop & Establishment',
  dsc: 'DSC',
  company_registration: 'Company Registration',
  //llp_registration: 'LLP Registration',
  dir3kyc: 'DIR-3 KYC',
  inc20a: 'INC-20A',
  adt1: 'ADT-1',
  //roc: 'ROC Compliance',
  roc_standard: 'ROC Standard',
  roc_premium: 'ROC Premium',
  aoc4: 'AOC-4',
  inc22a: 'INC-22A',
  mgt7a: 'MGT-7A',
  mgt7: 'MGT-7A',
  file: 'Uploaded File',
};

const SERVICE_ROUTES: Record<string, string> = {
  msme: '/services/msme-registration/form',
  gst: '/services/gst-registration/form',
  fssai: '/services/fssai-license/form',
  trademark: '/services/trademark-registration/form',
  startup: '/services/startup-india/form',
  pan: '/services/pan-registration/form',
  'shop-establishment': '/services/shop-establishment-license/form',
  dsc: '/services/dsc-registration/form',
  company_registration: '/services/company-registration/form',
  dir3kyc: '/services/dir-3-kyc-filing/form',
  inc20a: '/services/inc-20a-filing/form',
  adt1: '/services/adt-1-filing/form',
  aoc4: '/services/a0c4-filing/form',
  mgt7a: '/services/mgt-7-filing/form',
  mgt7: '/services/mgt-7-filing/form',
  inc22a: '/services/inc-22a-filing/form',
  roc_standard: '/services/roc-standard-package',
  roc_premium: '/services/roc-premium-package',
};

const COLLECTION_CONFIG: Array<{ name: string; type: string; title: string }> = [
  { name: 'applications', type: 'general', title: 'General Application' },
  { name: 'msme-applications', type: 'msme', title: 'MSME Registration' },
  { name: 'pan-applications', type: 'pan', title: 'PAN Card Application' },
  { name: 'gst-applications', type: 'gst', title: 'GST Registration' },
  { name: 'gst-proprietorship-applications', type: 'gst', title: 'GST Registration - Proprietorship' },
  { name: 'gst-shop-retail-applications', type: 'gst', title: 'GST Registration - Shops & Retail' },
  { name: 'fssai-applications', type: 'fssai', title: 'FSSAI License' },
  { name: 'trademark-applications', type: 'trademark', title: 'Trademark Registration' },
  { name: 'startup-applications', type: 'startup', title: 'Startup India Registration' },
  { name: 'shop-establishment-applications', type: 'shop-establishment', title: 'Shop & Establishment License' },
  { name: 'dsc-applications', type: 'dsc', title: 'Digital Signature Certificate' },
  { name: 'company-registrations', type: 'company_registration', title: 'Company Registration' },
  { name: 'llp-registrations', type: 'llp_registration', title: 'LLP Registration' },
  { name: 'dir3kyc-applications', type: 'dir3kyc', title: 'DIR-3 KYC Filing' },
  { name: 'dir-3-kyc-applications', type: 'dir3kyc', title: 'DIR-3 KYC Filing' },
  { name: 'inc20a-applications', type: 'inc20a', title: 'INC-20A Commencement' },
  { name: 'adt1-applications', type: 'adt1', title: 'ADT-1 Auditor Appointment' },
  { name: 'roc-compliance-applications', type: 'roc', title: 'ROC Compliance' },
  { name: 'roc-standard-packages', type: 'roc_standard', title: 'ROC Standard Package' },
  { name: 'roc-premium-packages', type: 'roc_premium', title: 'ROC Premium Package' },
  { name: 'aoc4-applications', type: 'aoc4', title: 'AOC-4 Filing' },
  { name: 'mgt7a-applications', type: 'mgt7a', title: 'MGT-7A Filing' }
];

// LEGAL TEMPLATES DEFINITION
const LEGAL_TEMPLATES: LegalTemplate[] = [
  { id: 'nda', title: 'Non-Disclosure Agreement', description: 'Protect confidential business information.', category: 'Agreement', icon: Shield },
  { id: 'msa', title: 'Master Service Agreement', description: 'Create a flexible contract for services.', category: 'Agreement', icon: BriefcaseIcon },
  { id: 'franchise', title: 'Franchise Agreement', description: 'Formalize a franchise relationship.', category: 'Agreement', icon: Building },
  { id: 'commercial-rent', title: 'Commercial Rental Agreement', description: 'Draft precise commercial lease terms.', category: 'Agreement', icon: Building },
  { id: 'residential-rent', title: 'Residential Rental Agreement', description: 'Create a legally sound rental contract.', category: 'Agreement', icon: Home },
  { id: 'recovery-notice', title: 'Legal Notice - Recovery', description: 'Send a formal notice for money recovery.', category: 'Notice', icon: Gavel },
  { id: 'agm-notice', title: 'Notice - AGM', description: 'Generate formal Annual General Meeting notice.', category: 'Notice', icon: Users },
  { id: 'exp-letter', title: 'Experience Letter', description: 'Confirm an employee\'s tenure and role.', category: 'HR', icon: FileText },
  { id: 'cheque-bounce', title: 'Cheque Bounce Notice', description: 'Formal legal notice for dishonored cheque.', category: 'Notice', icon: AlertTriangle },
  { id: 'employment', title: 'Employment Contract', description: 'Standard appointment letter for new hires.', category: 'HR', icon: Users },
  { id: 'noc', title: 'No Objection Certificate (NOC)', description: 'Consent letter for property or GST compliance.', category: 'Letter', icon: CheckCircle2 },
  { id: 'gst-auth', title: 'Letter of Authorization for GST', description: 'Authorize a representative for GST filings.', category: 'GST', icon: FileSignature },
  { id: 'offer-letter', title: 'Offer of Employment', description: 'Formally extend a job offer with terms.', category: 'HR', icon: Mail },
  { id: 'org-dsc-auth', title: 'Organisation DSC Authorization', description: 'Authorize organization representative for DSC and e-Signing services.', category: 'Authorization', icon: Key },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatDate = (timestamp: number | Timestamp | any): string => {
  if (!timestamp) return 'N/A';
  const date = typeof timestamp === 'number'
    ? new Date(timestamp)
    : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatSubmittedDateTime = (timestamp: number | Timestamp | any): { date: string; time: string } => {
  if (!timestamp) return { date: 'N/A', time: 'N/A' };
  const date = typeof timestamp === 'number'
    ? new Date(timestamp)
    : timestamp.toDate?.() || new Date(timestamp);

  return {
    date: date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };
};

const formatStateValue = (key: string, value: any): any => {
  if (!value || typeof value !== 'string') return value;
  const keyLower = key.toLowerCase().replace(/\s+/g, '');
  const upperValue = value.toUpperCase().trim();
  if (keyLower.includes('state')) {
    return STATE_MAPPING[upperValue] || value;
  }
  return value;
};

const hasDisplayValue = (value: any): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasDisplayValue);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return true;
    return Object.values(value).some(hasDisplayValue);
  }
  return true;
};

const getDraftServiceType = (data: any, draftId?: string): string => {
  const raw = String(data?.serviceType || data?.type || data?.service || '').toLowerCase();
  const caseId = String(data?.caseId || data?.trackingId || data?.applicationRef || '').toLowerCase();
  const did = String(draftId || '').toLowerCase();

  // Priority 1: Specific ID Prefixes
  if (did.startsWith('company_reg_') || caseId.startsWith('comp-reg') || caseId.startsWith('llp-reg')) return 'company_registration';
  if (did.startsWith('msme_') || caseId.startsWith('msme-')) return 'msme';
  if (did.startsWith('gst_') || caseId.startsWith('gst-')) return 'gst';
  if (caseId.startsWith('dir3')) return 'dir3kyc';
  if (caseId.startsWith('inc20a')) return 'inc20a';
  if (caseId.startsWith('inc22a')) return 'inc22a';
  if (caseId.startsWith('adt1')) return 'adt1';
  if (caseId.startsWith('aoc4')) return 'aoc4';
  if (caseId.startsWith('mgt7')) return 'mgt7';

  // Priority 2: Keyword matching in raw data
  if (raw.includes('company')) return 'company_registration';
  if (raw.includes('gst')) return 'gst';
  if (raw.includes('msme') || raw.includes('udyam')) return 'msme';
  if (raw.includes('pan')) return 'pan';
  if (raw.includes('fssai')) return 'fssai';
  if (raw.includes('trademark')) return 'trademark';
  if (raw.includes('startup') || raw.includes('dpiit')) return 'startup';
  if (raw.includes('dsc')) return 'dsc';
  if (raw.includes('dir-3') || raw.includes('dir3')) return 'dir3kyc';
  if (raw.includes('inc-20a') || raw.includes('inc20a')) return 'inc20a';
  if (raw.includes('inc-22a') || raw.includes('inc22a')) return 'inc22a';
  if (raw.includes('adt-1') || raw.includes('adt1')) return 'adt1';
  if (raw.includes('aoc-4') || raw.includes('aoc4')) return 'aoc4';
  if (raw.includes('mgt-7') || raw.includes('mgt7')) return 'mgt7';
  if (raw.includes('roc')) return 'roc_standard';

  return raw || 'general';
};

const getGstDraftRouteState = (data: any): Record<string, any> | undefined => {
  const constitution = String(data?.constitution || data?.commonData?.constitution || '').toLowerCase();
  const subtype = String(data?.gstSubtype || data?.serviceType || '').toLowerCase();
  let preSelectedType = 'proprietorship';

  if (subtype.includes('shop')) preSelectedType = 'shops';
  else if (constitution.includes('private')) preSelectedType = 'pvt_ltd';
  else if (constitution.includes('llp')) preSelectedType = 'llp';
  else if (constitution.includes('partnership')) preSelectedType = 'partnership';
  else if (constitution.includes('proprietorship')) preSelectedType = 'proprietorship';

  return { preSelectedType, initialData: data };
};

const getMsmeDraftRouteState = (data: any) => {
  return {
    initialData: {
      ...data,
      formData: data.formData || {}
    }
  };
};

const getStartupDraftRouteState = (data: any) => {
  return {
    initialData: {
      ...data,
      formData: data.formData || {}
    }
  };
};

const getGenericDraftRouteState = (data: any) => {
  return {
    initialData: {
      ...data,
      formData: data.formData || {}
    }
  };
};

const formatFieldName = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const escapeHtml = (value: any): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const placeholder = (value: any, fallback = '_____________'): string => {
  const text = String(value ?? '').trim();
  return text ? escapeHtml(text) : fallback;
};

const formatMoney = (value: any): string => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '_____________';
  return amount.toLocaleString('en-IN');
};

const fileSafeName = (value: string): string => {
  return value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'legal-document';
};

// ============================================================================
// ORG DSC AUTHORIZATION GENERATOR COMPONENT
// ============================================================================
const OrgDscAuthGenerator: React.FC<{
  user: UserProfile;
  onClose: () => void;
  onSave: (doc: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ user, onClose, onSave, showToast }) => {
  const [fields, setFields] = useState({
    subject: 'Proof of Sufficient Authorization',
    organization_name: '',
    authorized_person_name: '',
    pan_number: '',
    designation: '',
    mobile_number: '',
    company_name: '',
    authorized_signatory_name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleChange = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const val = (key: keyof typeof fields, bold = false) => {
    const v = fields[key]?.trim() || '_______________';
    return bold ? `<strong>${v}</strong>` : v;
  };

  const getDocumentHTML = () => `
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&family=Cinzel:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          color: #000;
          background: #fff;
        }
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 25mm 25mm 30mm 25mm;
          background: #fff;
        }
        h1 {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 6pt;
          font-family: 'Times New Roman', Times, serif;
        }
        .subtitle {
          font-size: 11pt;
          text-align: center;
          margin-bottom: 24pt;
          line-height: 1.5;
        }
        .to-block {
          margin-bottom: 18pt;
          line-height: 1.8;
        }
        .subject-line {
          margin-bottom: 12pt;
          line-height: 1.8;
        }
        .org-name-line {
          margin-bottom: 18pt;
          line-height: 1.8;
        }
        .body-para {
          text-align: justify;
          line-height: 1.8;
          margin-bottom: 18pt;
        }
        .sign-section {
          margin-top: 36pt;
          line-height: 2.0;
        }
        .sign-section p {
          margin-bottom: 2pt;
        }
        strong { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="page">
        <h1>Proof of Sufficient Authorization by Organization</h1>
        <p class="subtitle">(To be printed on organization letter head / Office seal. To be signed by Authorized Signatory<br/>the Director / Partner / Proprietor / Authorized Signatory.)</p>

        <div class="to-block">
          <p>To</p>
          <p>eMudhra Limited</p>
          <p>Bangalore.</p>
        </div>

        <div class="subject-line">
          <p><strong>Subject: ${val('subject')}</strong></p>
        </div>

        <div class="org-name-line">
          <p>Organization Name: <strong>${val('organization_name')}</strong></p>
        </div>

        <p class="body-para">
          This is to confirm that Mr. <strong>${val('authorized_person_name')}</strong> having Permanent Account Number (PAN) <strong>${val('pan_number')}</strong> is hereby appointed as <strong>Authorized Person</strong> for availing e-Signing / digitally signing services from Mudhra. By this, he is authorized to act as an <strong>Authorized Signatory</strong> (as per the definition of Identity Verification Guidelines of CCA) towards further authorizing the enrollments of Organization employees for creation of their KYC account (to enroll for DSC / eSign)
        </p>

        <p class="body-para">
          All acts performed and documents shall be binding on the Organization. I'm having suitable authority / authorization to provide this authorization on behalf of the Organization.
        </p>

        <p>For the Organization,</p>

        <div class="sign-section">
          <p><strong>(Seal &amp; Signature)</strong></p>
          <br/>
          <p><strong>Name: ${val('authorized_signatory_name')}</strong></p>
          <p><strong>Designation: ${val('designation')}</strong></p>
          <p><strong>Mobile: ${val('mobile_number')}</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getDocumentHTML());
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownloadPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getDocumentHTML());
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 600);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSave({
        id: `org-dsc-auth-${Date.now()}`,
        type: 'legal',
        subtype: 'org-dsc-auth',
        title: 'Organisation DSC Authorization',
        content: getDocumentHTML(),
        submittedAt: Date.now(),
        formData: fields,
        userId: user.uid,
      });
    } catch {
      showToast('Failed to save draft', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/60 focus:bg-white/8 transition-all';
  const labelClass = 'block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5';

  return (
    <div className="fixed inset-0 z-[70] bg-[#09090b] flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Key size={18} />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Organisation DSC Authorization</h2>
            <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-[0.2em]">Authorization Letter Generator</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 border border-white/10 rounded-xl hover:border-white/20 hover:text-white transition-all bg-white/5"
          >
            <Menu size={14} />
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 border border-white/10 rounded-xl hover:border-white/20 hover:text-white transition-all bg-white/5"
          >
            <Download size={14} />
            Download PDF
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-emerald-500/20 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Body – split screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Form */}
        <aside className="w-[380px] shrink-0 border-r border-white/10 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-black/20">
          <div>
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-5">✦ Fill in the details</p>
          </div>

          {([
            { key: 'subject', label: 'Subject', placeholder: 'Proof of Sufficient Authorization' },
            { key: 'organization_name', label: 'Organization Name', placeholder: 'e.g. CloudMaSa Innovation Lab Pvt Ltd' },
            { key: 'authorized_person_name', label: 'Authorized Person Name', placeholder: 'e.g. C. Manivannan' },
            { key: 'pan_number', label: 'PAN Number', placeholder: 'e.g. AUNPM6232H' },
            { key: 'designation', label: 'Designation', placeholder: 'e.g. Director' },
            { key: 'mobile_number', label: 'Mobile Number', placeholder: 'e.g. +91 9916800299' },
            { key: 'company_name', label: 'Company Name', placeholder: 'e.g. CloudMaSa Innovation Lab Pvt Ltd' },
            { key: 'authorized_signatory_name', label: 'Authorized Signatory Name', placeholder: 'e.g. C. Manivannan' },
          ] as { key: keyof typeof fields; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                type="text"
                value={fields[key]}
                onChange={e => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
          ))}

          <div className="pt-4 border-t border-white/5">
            <p className="text-[9px] text-gray-600 leading-relaxed">
              ✦ All fields reflect live in the document preview. Static legal text remains unchanged as per the sample document.
            </p>
          </div>
        </aside>

        {/* RIGHT: Live Preview */}
        <main className="flex-1 overflow-y-auto bg-gray-100 p-8 custom-scrollbar">
          <div className="max-w-[210mm] mx-auto">
            <div
              ref={previewRef}
              className="bg-white shadow-2xl"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '12pt',
                color: '#000',
                padding: '25mm 25mm 30mm 25mm',
                minHeight: '297mm',
                lineHeight: '1.8',
              }}
            >
              {/* Title */}
              <h1 style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '6pt', fontFamily: 'inherit' }}>
                Proof of Sufficient Authorization by Organization
              </h1>
              <p style={{ fontSize: '11pt', textAlign: 'center', marginBottom: '24pt', lineHeight: '1.5' }}>
                (To be printed on organization letter head / Office seal. To be signed by Authorized Signatory<br />
                the Director / Partner / Proprietor / Authorized Signatory.)
              </p>

              {/* To Block */}
              <div style={{ marginBottom: '18pt', lineHeight: '1.8' }}>
                <p>To</p>
                <p>eMudhra Limited</p>
                <p>Bangalore.</p>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: '12pt' }}>
                <p><strong>Subject: {fields.subject || '_______________'}</strong></p>
              </div>

              {/* Org Name */}
              <div style={{ marginBottom: '18pt' }}>
                <p>Organization Name: <strong>{fields.organization_name || '_______________'}</strong></p>
              </div>

              {/* Body Para 1 */}
              <p style={{ textAlign: 'justify', lineHeight: '1.8', marginBottom: '18pt' }}>
                This is to confirm that Mr. <strong>{fields.authorized_person_name || '_______________'}</strong> having Permanent Account Number (PAN) <strong>{fields.pan_number || '_______________'}</strong> is hereby appointed as <strong>Authorized Person</strong> for availing e-Signing / digitally signing services from Mudhra. By this, he is authorized to act as an <strong>Authorized Signatory</strong> (as per the definition of Identity Verification Guidelines of CCA) towards further authorizing the enrollments of Organization employees for creation of their KYC account (to enroll for DSC / eSign)
              </p>

              {/* Body Para 2 */}
              <p style={{ textAlign: 'justify', lineHeight: '1.8', marginBottom: '18pt' }}>
                All acts performed and documents shall be binding on the Organization. I'm having suitable authority / authorization to provide this authorization on behalf of the Organization.
              </p>

              {/* For the Org */}
              <p style={{ marginBottom: '36pt' }}>For the Organization,</p>

              {/* Signature Section */}
              <div style={{ lineHeight: '2.0' }}>
                <p><strong>(Seal &amp; Signature)</strong></p>
                <br />
                <p><strong>Name: {fields.authorized_signatory_name || '_______________'}</strong></p>
                <p><strong>Designation: {fields.designation || '_______________'}</strong></p>
                <p><strong>Mobile: {fields.mobile_number || '_______________'}</strong></p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// ============================================================================
// ZOLVIT-STYLE LEGAL GENERATOR COMPONENT (Split Screen) - FULLY FIXED
// ============================================================================
const LegalGenerator: React.FC<{
  template: LegalTemplate;
  user: UserProfile;
  onClose: () => void;
  onSave: (doc: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ template, user, onClose, onSave, showToast }) => {
  const [formData, setFormData] = useState({
    recipient: '',
    date: new Date().toISOString().split('T')[0],
    clause: '',
    propertyAddress: '',
    rentAmount: '',
    meetingDate: '',
    meetingTime: '',
    meetingVenue: '',
    authorizedPerson: '',
    gstin: '',
    company_name: user.displayName || 'My Company',
    cin: '',
    phone: '',
    address: '',
    letterheadFile: undefined as string | undefined,
    letterheadType: undefined as string | undefined,
    letterheadSize: undefined as number | undefined,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Letterhead upload states
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [letterheadPreview, setLetterheadPreview] = useState<string | null>(null);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);

  // Helper to update form
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Letterhead upload handler
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.includes('image') && file.type !== 'application/pdf') {
      showToast('Please upload an image or PDF file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size should be less than 5MB', 'error');
      return;
    }

    setIsUploadingLetterhead(true);

    try {
      // Create preview for images
      if (file.type.includes('image')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLetterheadPreview(reader.result as string);
          setLetterheadFile(file);
        };
        reader.readAsDataURL(file);
      } else {
        // For PDF, just store the file and show placeholder
        setLetterheadFile(file);
        setLetterheadPreview(null);
      }

      // Update formData with letterhead reference
      setFormData(prev => ({
        ...prev,
        letterheadFile: file.name,
        letterheadType: file.type,
        letterheadSize: file.size
      }));

      showToast('Letterhead uploaded successfully', 'success');
    } catch (err) {
      console.error('Letterhead upload error:', err);
      showToast('Failed to upload letterhead', 'error');
    } finally {
      setIsUploadingLetterhead(false);
    }
  };

  // Remove letterhead handler
  const handleRemoveLetterhead = () => {
    setLetterheadFile(null);
    setLetterheadPreview(null);
    setFormData(prev => ({
      ...prev,
      letterheadFile: undefined,
      letterheadType: undefined,
      letterheadSize: undefined
    }));
    showToast('Letterhead removed', 'info');
  };

  // Generate HTML Content dynamically based on inputs - PROFESSIONAL VERSION
  const generateContent = () => {
    // PROFESSIONAL FONT STACK + BASE STYLES
    const baseStyle = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Open+Sans:wght@400;600&display=swap');
  .legal-doc {
    font-family: 'Merriweather', 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #000;
    text-align: justify;
    hyphens: auto;
    max-width: 210mm;
    margin: 0 auto;
    padding: 20mm;
  }
  
  .legal-doc h1, .legal-doc h2, .legal-doc h3, .legal-doc h4 {
    font-family: 'Open Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-weight: 700;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
    letter-spacing: -0.02em;
  }
  
  .legal-doc h1 { 
    font-size: 18pt; 
    text-transform: uppercase; 
    text-align: center; 
    border-bottom: 3px solid #333; 
    padding-bottom: 15px; 
    margin-bottom: 30px;
  }
  .legal-doc h2 { font-size: 16pt; }
  .legal-doc h3 { font-size: 14pt; }
  .legal-doc h4 { font-size: 12pt; font-weight: 600; }
  
  .legal-doc p { margin-bottom: 1em; text-indent: 0; }
  .legal-doc ul, .legal-doc ol { margin-left: 20px; margin-bottom: 1em; }
  .legal-doc li { margin-bottom: 0.5em; }
  
  /* NUMBERS & DATES - TABULAR FOR ALIGNMENT */
  .legal-doc .number, .legal-doc .date, .legal-doc .cin, .legal-doc .gstin {
    font-variant-numeric: tabular-nums;
    font-family: 'Courier New', Courier, monospace;
    font-weight: 600;
  }
  
  .legal-doc .header-meta {
    font-family: 'Open Sans', sans-serif;
    font-size: 10pt;
    color: #555;
    text-align: right;
    margin-bottom: 30px;
    padding-top: 20px;
  }
  
  .legal-doc .signature-block {
    margin-top: 60px;
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
  }
  
  .legal-doc .signature-box {
    text-align: center;
    width: 45%;
  }
  
  .legal-doc .signature-line {
    border-top: 1px solid #000;
    margin-top: 50px;
    padding-top: 8px;
    font-weight: bold;
  }
  
  .legal-doc .letterhead-container {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
    text-align: center;
    width: 100%;
  }
  
  .legal-doc .letterhead-container img {
    max-width: 100%;
    width: 100%;
    height: auto;
    max-height: 120px;
    object-fit: contain;
    display: block;
    margin: 0 auto;
  }
  
  .legal-doc hr {
    margin: 25px 0;
    border: none;
    border-top: 2px solid #333;
  }
</style>
`;

    // Letterhead HTML injection - FULL WIDTH PROPER
    const letterheadHTML = letterheadFile && letterheadPreview
      ? `<div class="letterhead-container">
           <img src="${letterheadPreview}" alt="Letterhead" />
         </div>`
      : letterheadFile
        ? `<div class="letterhead-container" style="padding: 15px; background: #f5f5f5; border-radius: 4px; margin-bottom: 20px;">
             <p style="margin: 0; font-size: 10pt; color: #666; text-align: center;">📄 Letterhead: ${letterheadFile.name}</p>
           </div>`
        : '';

    const header = `<div class="header-meta">Generated on <span class="date">${formData.date}</span></div>`;
    let body = '';

    // --- TEMPLATE-SPECIFIC CONTENT WITH PROFESSIONAL MARKUP ---
    if (template.id === 'commercial-rent') {
      body = `
<h1>COMMERCIAL RENTAL AGREEMENT</h1>
<p><strong>Date:</strong> <span class="date">${formData.date}</span></p>

<h3>PARTIES</h3>
<p><strong>LANDLORD:</strong> ${formData.company_name}<br/>
  Address: ${formData.address || '_____________'}</br>
  CIN: <span class="cin">${formData.cin || '_____________'}</span><br/>
  Phone: <span class="number">${formData.phone || '_____________'}</span></p>

<p><strong>TENANT:</strong> ${formData.recipient || '_____________'}</br>
  Address: _____________<br/>
  Contact: _____________</p>

<hr/>

<h3>1. PREMISES</h3>
<p>The Landlord hereby agrees to let and the Tenant hereby agrees to take the property situated at 
   <strong>${formData.propertyAddress || '_____________'}</strong>, comprising commercial space suitable for business operations. 
  The premises shall be used exclusively for commercial purposes as agreed upon by both parties.</p>

<h3>2. RENT AND PAYMENT TERMS</h3>
<p>The monthly rent for the aforementioned premises shall be <strong>₹<span class="number">${formData.rentAmount || '_____________'}</span></strong> 
  (Rupees ${formData.rentAmount ? Number(formData.rentAmount).toLocaleString('en-IN') + ' only' : '_____________ only'}). 
  The rent shall be payable in advance on or before the 7th day of each calendar month. Late payment shall attract interest 
  at the rate of 18% per annum from the due date until actual payment.</p>

<h3>3. LEASE TERM</h3>
<p>This lease agreement shall commence from <span class="date">${formData.date}</span> and shall remain in force for a period of eleven (11) months, 
  unless terminated earlier in accordance with the terms herein. The lease may be renewed by by mutual consent of both parties 
  subject to such terms and conditions as may be agreed upon in writing.</p>

<h3>4. SECURITY DEPOSIT</h3>
<p>The Tenant shall pay a refundable security deposit equivalent to three (3) months' rent, amounting to ₹<span class="number">${formData.rentAmount ? Math.round(Number(formData.rentAmount) * 3).toLocaleString('en-IN') : '_____________'}</span>, 
  before taking possession of the premises. This deposit shall be refunded within thirty (30) days after vacating the premises, 
  subject to deduction for any damages or outstanding dues.</p>

<h3>5. MAINTENANCE AND REPAIRS</h3>
<p>The Tenant shall be responsible for minor repairs and maintenance of the premises during the lease period. 
  Major structural repairs shall be the responsibility of the Landlord. The Tenant shall not make any alterations 
  to the premises without prior written consent from the Landlord.</p>
`;
    } else if (template.id === 'agm-notice') {
      body = `
<h1>NOTICE OF ANNUAL GENERAL MEETING</h1>
<p style="text-align:center; font-weight:bold; font-size:14pt;">${formData.company_name}</p>
<p style="text-align:center;">CIN: <span class="cin">${formData.cin || '_____________'}</span> | Registered Office: ${formData.address || '_____________'}</p>

<hr/>

<p>Notice is hereby given that the Annual General Meeting (AGM) of <strong>${formData.company_name}</strong> 
  will be held on <strong><span class="date">${formData.meetingDate || formData.date}</span></strong> 
  at <strong><span class="number">${formData.meetingTime || '_____________'}</span></strong> 
  at <strong>${formData.meetingVenue || formData.address || '_____________'}</strong> 
  to transact the following business:</p>

<h3>ORDINARY BUSINESS:</h3>
<ol>
  <li>To receive, consider and adopt the Audited Financial Statements of the company for the financial year ended 31st March, along with the Reports of the Board of Directors and Auditors thereon.</li>
  <li>To declare dividend, if any, as recommended by the Board of Directors.</li>
  <li>To appoint a Director in place of the retiring Director, who being eligible, offers himself for reappointment.</li>
  <li>To appoint Auditors and fix their remuneration for the ensuing financial year.</li>
</ol>

<h3>SPECIAL BUSINESS:</h3>
<ol>
  <li>To consider and approve any special resolutions as may be proposed by the Board of Directors.</li>
</ol>

<p><strong>Note:</strong> A member entitled to attend and vote at the meeting is entitled to appoint a proxy to attend and vote instead of him/her. 
  A proxy need not be a member of the company. The instrument appointing a proxy should be deposited at the registered office of the company 
  not less than 48 hours before the commencement of the meeting.</p>

<p><strong>Registered Office:</strong><br/>
  ${formData.address || '_____________'}</br>
  Phone: <span class="number">${formData.phone || '_____________'}</br>
  Email: _____________</p>
`;
    } else if (template.id === 'gst-auth') {
      body = `
<h1>LETTER OF AUTHORIZATION FOR GST MATTERS</h1>
<p style="text-align:right;"><span class="date">${formData.date}</span></p>

<p><strong>To,</strong><br/>
  The Proper Officer,<br/>
  GST Department,<br/>
  _____________<br/>
  _____________</p>

<p><strong>Subject: Letter of Authorization for GST Matters</strong></p>

<p>I, <strong>${formData.company_name}</strong>, being the authorized signatory of the business having GSTIN 
   <strong><span class="gstin">${formData.gstin || '_____________'}</span></strong>, hereby authorize <strong>${formData.authorizedPerson || '_____________'}</strong> 
  to act on my behalf in all matters relating to Goods and Services Tax (GST).</p>

<p>The authorized person is empowered to submit applications, file returns, respond to notices, attend hearings, 
  and perform any other acts necessary for compliance with GST laws and regulations. This authorization shall remain 
  valid until explicitly revoked in writing.</p>

<p>All actions taken by the authorized person in this regard shall be binding on the business. 
  Please extend all necessary cooperation and assistance to the authorized person in the discharge of their duties.</p>

<p><strong>Business Details:</strong><br/>
  Name: ${formData.company_name}<br/>
  GSTIN: <span class="gstin">${formData.gstin || '_____________'}</br>
  Address: ${formData.address || '_____________'}</br>
  Contact: <span class="number">${formData.phone || '_____________'}</span></p>
`;
    } else if (template.id === 'noc') {
      body = `
<h1>NO OBJECTION CERTIFICATE (NOC)</h1>
<p style="text-align:right;"><span class="date">${formData.date}</span></p>

<p><strong>To Whom It May Concern,</strong></p>

<p><strong>Subject: No Objection Certificate (NOC)</strong></p>

<p>I, <strong>${formData.company_name}</strong>, being the owner/authorized signatory of the property located at 
   <strong>${formData.propertyAddress || '[Insert Address]'}</strong>, hereby declare that I have no objection to 
   <strong>${formData.recipient || '_____________'}</strong> using the aforementioned premises for the purpose of 
   <strong>${formData.clause || 'Business Registration/GST Registration'}</strong>.</p>

<p>This NOC is issued voluntarily and without any coercion. The said premises are legally owned/controlled by us, 
  and we confirm that there are no legal encumbrances or disputes regarding the ownership or usage rights of the property.</p>

<p>We hereby grant permission for the use of our address for official correspondence and registration purposes. 
  This certificate is valid for all legal and administrative purposes as required by the concerned authorities.</p>

<p><strong>Property Details:</strong><br/>
  Owner: ${formData.company_name}<br/>
  Address: ${formData.propertyAddress || '[Insert Address]'}</br>
  Purpose: ${formData.clause || 'Business Registration/GST Registration'}</br>
  Beneficiary: ${formData.recipient || '_____________'}</p>
`;
    } else {
      // Default Generic Template (NDA, Employment, etc.)
      body = `
<h1>${template.title.toUpperCase()}</h1>
<p style="text-align:right;"><span class="date">${formData.date}</span></p>

<p>This agreement is entered into between <strong>${formData.company_name}</strong> (hereinafter referred to as "Party A") 
  and <strong>${formData.recipient || '_____________'}</strong> (hereinafter referred to as "Party B"), collectively referred to as the "Parties".</p>

<p>WHEREAS, Party A and Party B desire to establish a mutually beneficial relationship governed by the terms and conditions 
  set forth in this agreement;</p>

<p>NOW, THEREFORE, in consideration of the mutual covenants contained herein and for other good and valuable consideration, 
  the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:</p>

<h3>TERMS AND CONDITIONS:</h3>
<p>${formData.clause || 'Standard terms and conditions apply. Both parties agree to abide by the terms mentioned herein and maintain confidentiality of all proprietary information shared during the course of this agreement.'}</p>

<p>This agreement shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or 
  in connection with this agreement shall be subject to the exclusive jurisdiction of the courts in _____________.</p>

<p>Both parties acknowledge that they have read, understood, and agree to be bound by the terms and conditions set forth herein. 
  This agreement represents the entire understanding between the Parties and supersedes all prior discussions, negotiations, and agreements.</p>
`;
    }

    const company = placeholder(formData.company_name);
    const recipient = placeholder(formData.recipient);
    const effectiveDate = placeholder(formData.date);
    const address = placeholder(formData.address);
    const property = placeholder(formData.propertyAddress);
    const clause = placeholder(formData.clause, '');
    const rent = formatMoney(formData.rentAmount);
    const deposit = Number(formData.rentAmount) > 0 ? Math.round(Number(formData.rentAmount) * 3).toLocaleString('en-IN') : '_____________';
    const cin = placeholder(formData.cin);
    const phone = placeholder(formData.phone);
    const gstin = placeholder(formData.gstin);
    const authorizedPerson = placeholder(formData.authorizedPerson);
    const meetingDate = placeholder(formData.meetingDate || formData.date);
    const meetingTime = placeholder(formData.meetingTime);
    const meetingVenue = placeholder(formData.meetingVenue || formData.address);

    const templateBodies: Record<string, string> = {
      'nda': `
<h1>NON-DISCLOSURE AGREEMENT</h1>
<p>This Non-Disclosure Agreement is made on <span class="date">${effectiveDate}</span> between <strong>${company}</strong> and <strong>${recipient}</strong>.</p>
<h3>1. Confidential Information</h3>
<p>Confidential Information includes business plans, client lists, pricing, financial information, product details, software, processes, documents, data and any information identified as confidential or reasonably understood to be confidential.</p>
<h3>2. Obligations</h3>
<p>The receiving party shall use the Confidential Information only for the agreed business purpose, protect it with reasonable care, and not disclose it to any third party except employees or advisers who need to know and are bound by confidentiality duties.</p>
<h3>3. Exclusions</h3>
<p>Information is not confidential if it is publicly available, already known without restriction, independently developed, or lawfully received from a third party.</p>
<h3>4. Term and Return</h3>
<p>The confidentiality obligation will continue for three years from disclosure. On request, the receiving party shall return or destroy confidential materials.</p>
${clause ? `<h3>5. Additional Terms</h3><p>${clause}</p>` : ''}`,
      'msa': `
<h1>MASTER SERVICE AGREEMENT</h1>
<p>This Master Service Agreement is entered on <span class="date">${effectiveDate}</span> between <strong>${company}</strong> and <strong>${recipient}</strong>.</p>
<h3>1. Scope of Services</h3>
<p>The service provider shall provide professional services as described in mutually approved statements of work, proposals, invoices or written confirmations.</p>
<h3>2. Fees and Payment</h3>
<p>The client shall pay fees as agreed for each assignment. Taxes, government fees and out-of-pocket expenses shall be charged separately unless expressly included.</p>
<h3>3. Client Responsibilities</h3>
<p>The client shall provide accurate information, approvals and documents required for service delivery. Delay in providing inputs may extend timelines.</p>
<h3>4. Confidentiality and IP</h3>
<p>Both parties shall protect confidential information. Deliverables prepared specifically for the client will belong to the client after full payment, excluding pre-existing tools, templates and know-how.</p>
${clause ? `<h3>5. Additional Terms</h3><p>${clause}</p>` : ''}`,
      'franchise': `
<h1>FRANCHISE AGREEMENT</h1>
<p>This Franchise Agreement is made on <span class="date">${effectiveDate}</span> between <strong>${company}</strong> as Franchisor and <strong>${recipient}</strong> as Franchisee.</p>
<h3>1. Grant of Franchise</h3>
<p>The Franchisor grants the Franchisee a limited, non-transferable right to operate the franchise business using approved brand standards, processes and marks within the agreed territory.</p>
<h3>2. Brand Standards</h3>
<p>The Franchisee shall maintain service quality, signage, pricing discipline, customer handling and reporting standards prescribed by the Franchisor.</p>
<h3>3. Fees and Records</h3>
<p>The Franchisee shall pay agreed franchise fees, royalties and taxes, and maintain complete business records for review.</p>
<h3>4. Termination</h3>
<p>Material breach, misuse of brand assets, non-payment, fraud or regulatory non-compliance may result in termination after notice as applicable.</p>
${clause ? `<h3>5. Additional Terms</h3><p>${clause}</p>` : ''}`,
      'commercial-rent': `
<h1>COMMERCIAL RENTAL AGREEMENT</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<h3>PARTIES</h3>
<p><strong>Landlord:</strong> ${company}<br/>Address: ${address}<br/>CIN / Registration No.: <span class="cin">${cin}</span><br/>Phone: <span class="number">${phone}</span></p>
<p><strong>Tenant:</strong> ${recipient}<br/>Address: _____________<br/>Contact: _____________</p>
<h3>1. Premises</h3>
<p>The Landlord lets the property situated at <strong>${property}</strong> to the Tenant for commercial use only.</p>
<h3>2. Rent and Deposit</h3>
<p>Monthly rent shall be <strong>Rs. <span class="number">${rent}</span></strong>, payable on or before the 7th day of each month. The refundable security deposit shall be Rs. <span class="number">${deposit}</span>, subject to deductions for dues or damage.</p>
<h3>3. Term</h3>
<p>The lease commences on <span class="date">${effectiveDate}</span> and continues for eleven months unless renewed or terminated as per this agreement.</p>
<h3>4. Maintenance</h3>
<p>The Tenant shall keep the premises in good condition and shall not alter the premises without written consent. Structural repairs remain the responsibility of the Landlord.</p>`,
      'residential-rent': `
<h1>RESIDENTIAL RENTAL AGREEMENT</h1>
<p>This Rental Agreement is made on <span class="date">${effectiveDate}</span> between <strong>${company}</strong> as Landlord and <strong>${recipient}</strong> as Tenant.</p>
<h3>1. Property</h3>
<p>The Landlord lets the residential premises at <strong>${property}</strong> for lawful residential use only.</p>
<h3>2. Rent and Security Deposit</h3>
<p>The Tenant shall pay monthly rent of Rs. <span class="number">${rent}</span>. The refundable security deposit shall be Rs. <span class="number">${deposit}</span>.</p>
<h3>3. Utilities and Maintenance</h3>
<p>The Tenant shall pay utility charges used during occupation and maintain the premises in clean and usable condition, ordinary wear and tear excepted.</p>
<h3>4. Restrictions</h3>
<p>The Tenant shall not sublet, conduct illegal activity, or make structural changes without the Landlord's written approval.</p>`,
      'recovery-notice': `
<h1>LEGAL NOTICE FOR RECOVERY OF MONEY</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<p>To,<br/><strong>${recipient}</strong></p>
<p><strong>Subject: Demand for payment of outstanding dues</strong></p>
<p>Under instructions from <strong>${company}</strong>, you are hereby called upon to pay the outstanding amount due and payable for goods/services/transactions undertaken between the parties.</p>
<p>Despite repeated reminders, the amount remains unpaid. You are requested to clear the dues within fifteen days from receipt of this notice, failing which appropriate civil and/or criminal proceedings may be initiated at your risk as to cost and consequence.</p>
${clause ? `<h3>Particulars of Claim</h3><p>${clause}</p>` : '<h3>Particulars of Claim</h3><p>Invoice / transaction details: _____________<br/>Outstanding amount: _____________<br/>Due date: _____________</p>'}`,
      'agm-notice': `
<h1>NOTICE OF ANNUAL GENERAL MEETING</h1>
<p style="text-align:center; font-weight:bold; font-size:14pt;">${company}</p>
<p style="text-align:center;">CIN: <span class="cin">${cin}</span> | Registered Office: ${address}</p>
<p>Notice is hereby given that the Annual General Meeting of <strong>${company}</strong> will be held on <strong>${meetingDate}</strong> at <strong>${meetingTime}</strong> at <strong>${meetingVenue}</strong>.</p>
<h3>Ordinary Business</h3>
<ol><li>To receive, consider and adopt the audited financial statements with the Board and Auditor reports.</li><li>To appoint or reappoint directors retiring by rotation, if applicable.</li><li>To appoint auditors and fix their remuneration, if applicable.</li></ol>
<h3>Notes</h3>
<p>A member entitled to attend and vote may appoint a proxy. Proxy forms must be deposited at the registered office at least 48 hours before the meeting.</p>`,
      'exp-letter': `
<h1>EXPERIENCE LETTER</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<p>This is to certify that <strong>${recipient}</strong> was employed with <strong>${company}</strong> in the capacity and period recorded by the company.</p>
<p>During the tenure, the employee performed assigned responsibilities with professionalism and maintained the standards expected by the organization.</p>
<p>We wish the employee success in future professional pursuits.</p>
${clause ? `<h3>Role / Tenure Details</h3><p>${clause}</p>` : '<p>Designation: _____________<br/>Employment Period: _____________ to _____________<br/>Department: _____________</p>'}`,
      'cheque-bounce': `
<h1>LEGAL NOTICE FOR DISHONOUR OF CHEQUE</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<p>To,<br/><strong>${recipient}</strong></p>
<p><strong>Subject: Notice under Section 138 of the Negotiable Instruments Act, 1881</strong></p>
<p>On behalf of <strong>${company}</strong>, this notice is issued regarding dishonour of cheque issued by you towards discharge of legally enforceable liability.</p>
<p>You are called upon to make payment of the cheque amount within fifteen days from receipt of this notice. Failing this, proceedings under applicable law may be initiated without further reference.</p>
${clause ? `<h3>Cheque Details</h3><p>${clause}</p>` : '<h3>Cheque Details</h3><p>Cheque No.: _____________<br/>Cheque Date: _____________<br/>Amount: _____________<br/>Bank: _____________<br/>Return Reason: _____________</p>'}`,
      'employment': `
<h1>EMPLOYMENT CONTRACT</h1>
<p>This Employment Contract is entered on <span class="date">${effectiveDate}</span> between <strong>${company}</strong> and <strong>${recipient}</strong>.</p>
<h3>1. Appointment</h3>
<p>The employee is appointed to the role and department agreed by the company and shall perform duties assigned from time to time.</p>
<h3>2. Compensation and Benefits</h3>
<p>Salary, benefits, deductions and reimbursements shall be as per the offer terms and company policy.</p>
<h3>3. Confidentiality</h3>
<p>The employee shall protect company confidential information during and after employment.</p>
<h3>4. Termination</h3>
<p>Either party may terminate employment as per notice period, law and company policy.</p>
${clause ? `<h3>Specific Terms</h3><p>${clause}</p>` : ''}`,
      'noc': `
<h1>NO OBJECTION CERTIFICATE</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<p>To Whom It May Concern,</p>
<p>I/We, <strong>${company}</strong>, owner/authorized signatory for the premises situated at <strong>${property}</strong>, have no objection to <strong>${recipient}</strong> using the said premises for <strong>${clause || 'business registration / GST registration'}</strong>.</p>
<p>This certificate is issued voluntarily for submission before concerned authorities. The permission is subject to lawful use of the premises and compliance with applicable rules.</p>`,
      'gst-auth': `
<h1>LETTER OF AUTHORIZATION FOR GST MATTERS</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<p>To,<br/>The Proper Officer,<br/>GST Department</p>
<p>I/We, <strong>${company}</strong>, having GSTIN <strong><span class="gstin">${gstin}</span></strong>, authorize <strong>${authorizedPerson}</strong> to represent us for GST registration, return filing, notice response, hearings, amendment, cancellation and related compliance matters.</p>
<p>All submissions made by the authorized person in relation to the above GST matters shall be binding on the business until this authorization is revoked in writing.</p>
<p><strong>Business Address:</strong> ${address}<br/><strong>Contact:</strong> <span class="number">${phone}</span></p>`,
      'offer-letter': `
<h1>OFFER OF EMPLOYMENT</h1>
<p><strong>Date:</strong> <span class="date">${effectiveDate}</span></p>
<p>Dear <strong>${recipient}</strong>,</p>
<p>We are pleased to offer you employment with <strong>${company}</strong>, subject to successful completion of joining formalities, background verification and acceptance of company policies.</p>
<h3>Offer Terms</h3>
<p>Your designation, compensation, reporting manager, joining date, probation and benefits shall be as stated in the approved offer particulars.</p>
<h3>Confidentiality and Conduct</h3>
<p>You shall maintain confidentiality of company information and comply with applicable workplace, data protection and professional conduct policies.</p>
${clause ? `<h3>Specific Offer Details</h3><p>${clause}</p>` : '<p>Designation: _____________<br/>Joining Date: _____________<br/>Compensation: _____________</p>'}`
    };

    body = templateBodies[template.id] || `
<h1>${escapeHtml(template.title.toUpperCase())}</h1>
<p>This document is made on <span class="date">${effectiveDate}</span> between <strong>${company}</strong> and <strong>${recipient}</strong>.</p>
<h3>Terms</h3>
<p>${clause || 'The parties agree to comply with the mutually accepted business terms, confidentiality obligations, lawful conduct requirements and applicable Indian laws.'}</p>
<h3>Governing Law</h3>
<p>This document shall be governed by the laws of India. Disputes shall be subject to the jurisdiction agreed by the parties.</p>`;

    const closingContent = `
<h3>Execution and Record</h3>
<p>The parties confirm that the details entered in this document are true to the best of their knowledge and that the document has been prepared for the stated business or legal purpose. Any blanks, annexures, payment details, property details, employee particulars or transaction references should be completed before signing.</p>
<p>This document should be printed on appropriate letterhead or stamp paper wherever required by applicable law, business practice or authority-specific submission rules. Each party should retain a signed copy along with supporting documents, identity proofs, invoices, communication records or board approvals, as applicable.</p>
<p>Where registration, notarisation, witness signatures, board approval, statutory filing or professional review is required, the same should be completed before relying on this document for official use. The document may be modified only through written confirmation signed by the concerned parties.</p>
<p><strong>Review Note:</strong> This is a structured draft generated from the details provided by the user. For court proceedings, high-value transactions, employment disputes, property registration, statutory notices or authority submissions, the final version should be reviewed by a qualified legal or compliance professional.</p>`;

    const footer = `<div class="signature-block"><div class="signature-box"><div class="signature-line">${company}</div><small>Authorized Signatory</small></div><div class="signature-box"><div class="signature-line">${recipient}</div><small>Recipient / Counterparty</small></div></div>`;

    return `${baseStyle}<div class="legal-doc">${letterheadHTML}${header}${body}${closingContent}${footer}</div>`;
  };

  const handleDownload = () => {
    const content = generateContent();
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileSafeName(`${template.title} - ${formData.recipient || 'Draft'}`)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Document downloaded', 'success');
  };

  const handleSave = async () => {
    setIsGenerating(true);
    try {
      const content = generateContent();

      // Prepare letterhead metadata for storage
      const letterheadData = letterheadFile ? {
        fileName: letterheadFile.name,
        fileType: letterheadFile.type,
        fileSize: letterheadFile.size,
        uploadedAt: Date.now()
      } : null;

      const newDoc = {
        id: `DOC-${Date.now()}`,
        type: 'legal',
        subtype: template.id,
        title: `${template.title} - ${formData.recipient || 'Draft'}`,
        content: content,
        submittedAt: Date.now(),
        formData: { ...formData, letterhead: letterheadData },
        userId: user.uid,
        folderId: 'personal',
        hasLetterhead: !!letterheadFile
      };

      await onSave(newDoc);
      showToast('Document saved with letterhead!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save document', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate Progress
  const totalFields = Object.keys(formData).length;
  const filledFields = Object.values(formData).filter(v => v && v !== '').length;
  const progress = Math.round((filledFields / totalFields) * 100);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-500">
      <div className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
        {/* TOP BAR / HEADER */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-md border-b border-white/10 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30">
              <template.icon size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold tracking-tight">{template.title}</h3>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-white/10 h-1 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{progress}% Drafted</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={isGenerating || isUploadingLetterhead}
              className="px-5 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 font-bold rounded-xl border border-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={handleSave}
              disabled={isGenerating || isUploadingLetterhead}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isGenerating ? 'Saving...' : 'Finalize & Save'}
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* LEFT SIDE: EDITOR PANEL (WebApp Style) */}
        <div className="w-full md:w-[400px] xl:w-[450px] h-full pt-16 bg-black border-r border-white/10 flex flex-col z-20">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* SECTION: DOCUMENT SETTINGS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-orange-500 rounded-full" />
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Core Particulars</h4>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="group">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Effective Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={16} />
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleChange('date', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 pl-12 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Recipient / Second Party</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={16} />
                    <input
                      type="text"
                      placeholder="Full legal name..."
                      value={formData.recipient}
                      onChange={(e) => handleChange('recipient', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 pl-12 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all placeholder:text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: TEMPLATE SPECIFIC */}
            {(
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-orange-500 rounded-full" />
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Clause Details</h4>
                </div>

                <div className="space-y-4">
                  {(template.id === 'commercial-rent' || template.id === 'noc') && (
                    <div className="group">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Property Location</label>
                      <textarea
                        rows={2}
                        placeholder="Complete site address..."
                        value={formData.propertyAddress}
                        onChange={(e) => handleChange('propertyAddress', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all placeholder:text-gray-600"
                      />
                    </div>
                  )}

                  {template.id === 'commercial-rent' && (
                    <div className="group">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Rent Amount (Monthly)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold group-focus-within:text-orange-500 transition-colors">₹</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={formData.rentAmount}
                          onChange={(e) => handleChange('rentAmount', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 pl-10 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {template.id === 'agm-notice' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Meeting Date</label>
                          <input
                            type="date"
                            value={formData.meetingDate}
                            onChange={(e) => handleChange('meetingDate', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white outline-none focus:border-orange-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Time</label>
                          <input
                            type="time"
                            value={formData.meetingTime}
                            onChange={(e) => handleChange('meetingTime', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-white outline-none focus:border-orange-500/50"
                          />
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Meeting venue..."
                        value={formData.meetingVenue}
                        onChange={(e) => handleChange('meetingVenue', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all placeholder:text-gray-600"
                      />
                    </div>
                  )}

                  {template.id === 'gst-auth' && (
                    <div className="space-y-3">
                      <div className="group">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">GSTIN Number</label>
                        <input
                          type="text"
                          placeholder="22AAAAA0000A1Z5"
                          value={formData.gstin}
                          onChange={(e) => handleChange('gstin', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all uppercase"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Authorized Representative</label>
                        <input
                          type="text"
                          placeholder="Representative full name..."
                          value={formData.authorizedPerson}
                          onChange={(e) => handleChange('authorizedPerson', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                  )}

                  {!['commercial-rent', 'agm-notice', 'gst-auth', 'noc'].includes(template.id) && (
                    <div className="group">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Custom Clauses</label>
                      <textarea
                        rows={4}
                        placeholder="Define specific terms..."
                        value={formData.clause}
                        onChange={(e) => handleChange('clause', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-white outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all placeholder:text-gray-600"
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* SECTION: COMPANY BRANDING */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-orange-500 rounded-full" />
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Company Branding</h4>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <input
                    type="text"
                    placeholder="Company Legal Name"
                    value={formData.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 p-2 text-sm text-white outline-none focus:border-orange-500 transition-all"
                  />
                  <input
                    type="text"
                    placeholder="CIN / Registration ID"
                    value={formData.cin}
                    onChange={(e) => handleChange('cin', e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 p-2 text-sm text-white outline-none focus:border-orange-500 transition-all uppercase"
                  />
                  <input
                    type="text"
                    placeholder="Phone / Mobile"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 p-2 text-sm text-white outline-none focus:border-orange-500 transition-all"
                  />
                  <textarea
                    rows={2}
                    placeholder="Registered / Communication Address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 p-2 text-sm text-white outline-none focus:border-orange-500 transition-all resize-none"
                  />
                </div>

                <div className="group">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Official Letterhead</label>
                  <label className={`block w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${letterheadFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-white/5 hover:border-orange-500/50'}`}>
                    <input type="file" accept="image/*,.pdf" onChange={handleLetterheadUpload} className="hidden" />
                    {letterheadFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileCheck className="text-emerald-500" size={32} />
                        <span className="text-xs text-white font-bold truncate max-w-full">{letterheadFile.name}</span>
                        <button onClick={(e) => { e.preventDefault(); handleRemoveLetterhead(); }} className="text-[10px] text-red-400 font-bold uppercase underline">Remove File</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Upload size={32} className="text-gray-400" />
                        <span className="text-xs text-gray-400 font-medium">Click to upload branding</span>
                        <span className="text-[8px] text-gray-600 uppercase">IMG or PDF (Max 5MB)</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT SIDE: DOCUMENT PREVIEW (Rich Aesthetic) */}
        <div className="flex-1 h-full pt-16 bg-[#1a1a1a] flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/5 via-transparent to-transparent opacity-50" />

          {/* PREVIEW SCALE CONTROLS */}
          <div className="absolute bottom-8 right-8 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-2">
            <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"><RotateCcw size={18} /></button>
            <div className="w-px h-6 bg-white/10" />
            <span className="px-4 text-[10px] font-black text-white uppercase tracking-widest">Live Paper Preview</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-12 xl:p-20 flex justify-center custom-scrollbar">
            <div className="relative">
              {/* Paper Shadow Effect */}
              <div className="absolute -inset-4 bg-white/5 blur-3xl opacity-20 pointer-events-none" />

              <div
                id="printable-document"
                className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-[0_30px_100px_rgba(0,0,0,0.5)] p-0 origin-top animate-in zoom-in-95 duration-500"
                dangerouslySetInnerHTML={{ __html: generateContent() }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// DOCUMENT TRACKING API (MOCK) - Requirement 5
// ============================================================================
const mockFetchDocumentStatus = async (documentId: string, trackingId: string, currentAppStatus: string, docName: string) => {
  const statusFlow = ['Uploaded', 'Under Review', 'In Progress', 'Filed', 'Completed'];
  let currentIndex = 0;

  const s = currentAppStatus?.toLowerCase() || 'submitted';
  if (s === 'review' || s === 'pending' || s === 'submitted') currentIndex = 1;
  if (s === 'processing' || s === 'paid') currentIndex = 2;
  if (s === 'filed') currentIndex = 3;
  if (s === 'approved' || s === 'completed') currentIndex = 4;

  const history = [];
  const baseTime = Date.now() - 86400000 * 5;

  for (let i = 0; i <= currentIndex; i++) {
    history.push({
      step: statusFlow[i],
      time: new Date(baseTime + i * 86400000).toISOString()
    });
  }

  return {
    documentId,
    trackingId,
    userId: 'mock-user-id',
    documentName: docName,
    currentStatus: statusFlow[currentIndex],
    history
  };
};

const DocumentTrackingStepper: React.FC<{ application: Application }> = ({ application }) => {
  const [trackingData, setTrackingData] = useState<any>(() => {
    // Synchronously initialize to prevent blinking on load
    const statusFlow = ['Uploaded', 'Under Review', 'In Progress', 'Filed', 'Completed'];
    let currentIndex = 0;
    const s = application.status?.toLowerCase() || 'submitted';
    if (s === 'review' || s === 'pending' || s === 'submitted') currentIndex = 1;
    if (s === 'processing' || s === 'paid') currentIndex = 2;
    if (s === 'filed') currentIndex = 3;
    if (s === 'approved' || s === 'completed') currentIndex = 4;
    const history = [];
    const baseTime = Date.now() - 86400000 * 5;
    for (let i = 0; i <= currentIndex; i++) {
      history.push({ step: statusFlow[i], time: new Date(baseTime + i * 86400000).toISOString() });
    }
    return {
      documentId: application.id,
      trackingId: (application as any).trackingId || application.caseId || application.id,
      userId: 'mock-user-id',
      documentName: application.title,
      currentStatus: statusFlow[currentIndex],
      history
    };
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      // Requirement 5 API Call Simulator: GET /api/document-status/{documentId}
      const data = await mockFetchDocumentStatus(application.id, (application as any).trackingId || application.caseId || application.id, application.status || 'submitted', application.title);
      setTrackingData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  }, [application.id, application.status, application.title]);

  useEffect(() => {
    pollStatus();
  }, [pollStatus]);

  if (!trackingData) return null;

  const STATUS_FLOW = ['Uploaded', 'Under Review', 'In Progress', 'Filed', 'Completed'];
  const currentIndex = STATUS_FLOW.indexOf(trackingData.currentStatus);

  return (
    <div className="document-tracking-panel bg-gradient-to-br from-[#0a0f1c] to-[#121827] border border-white/10 p-6 md:p-8 rounded-3xl mb-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4 relative z-10">
        <div>
          <h4 className="text-xl font-black text-white flex items-center gap-3 tracking-tight"><Activity size={24} className="text-blue-500" /> Document Lifecycle Tracking</h4>
          <p className="text-xs text-gray-500 mt-1 font-mono flex items-center gap-2">
            Tracking ID: {trackingData.trackingId}
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(trackingData.trackingId); }}
              className="hover:text-white transition-colors"
              title="Copy Tracking ID"
            >
              <Copy size={12} />
            </button>
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
          <span className="relative flex h-2.5 w-2.5"><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
          <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{isRefreshing ? 'Loading...' : 'Status Tracked'}</span>
        </div>
      </div>
      <div className="relative z-10">
        <div className="hidden md:block absolute top-[20px] left-12 right-12 h-1 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-1000 ease-in-out" style={{ width: `${(currentIndex / (STATUS_FLOW.length - 1)) * 100}%` }} /></div>
        <div className="md:hidden absolute left-[23px] top-8 bottom-8 w-1 bg-gray-800 rounded-full overflow-hidden"><div className="w-full bg-gradient-to-b from-blue-600 to-cyan-400 transition-all duration-1000 ease-in-out" style={{ height: `${(currentIndex / (STATUS_FLOW.length - 1)) * 100}%` }} /></div>
        <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-0 relative">
          {STATUS_FLOW.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isActive = index === currentIndex;
            const historyItem = trackingData.history.find((h: any) => h.step === step);
            return (
              <div key={step} className="flex md:flex-col items-start md:items-center gap-4 md:gap-3 relative w-full md:w-auto">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-4 transition-all duration-500 z-10 ${isCompleted ? 'bg-emerald-500 border-emerald-900 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : isActive ? 'bg-blue-500 border-blue-900 text-white shadow-[0_0_25px_rgba(59,130,246,0.6)]' : 'bg-gray-900 border-gray-800 text-gray-600'}`}>
                  {isCompleted ? <CheckCircle2 size={20} strokeWidth={3} /> : isActive ? <div className="w-3 h-3 rounded-full bg-white" /> : <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />}
                </div>
                <div className="md:text-center mt-1 md:mt-0">
                  <p className={`text-sm font-black uppercase tracking-wide ${isCompleted ? 'text-emerald-400' : isActive ? 'text-blue-400' : 'text-gray-600'}`}>{step}</p>
                  {historyItem ? (
                    <p className="text-[10px] text-gray-500 font-mono mt-1.5 font-medium">{new Date(historyItem.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}<br />{new Date(historyItem.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  ) : (
                    <p className="text-[10px] text-gray-700 font-mono mt-1.5 uppercase tracking-widest font-bold">Upcoming</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const Documents: React.FC<DocumentsProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // --- Application Data State ---
  const [applications, setApplications] = useState<Application[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]); // NEW: State for legal docs
  const [drafts, setDrafts] = useState<DraftApplication[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // --- View Mode State ---
  const [viewMode, setViewMode] = useState<'apps' | 'drafts' | 'legal'>(
    (location.state as any)?.defaultTab || 'apps'
  );

  useEffect(() => {
    if ((location.state as any)?.defaultTab) {
      setViewMode((location.state as any).defaultTab);
    }
  }, [location.state]);

  const [viewDoc, setViewDoc] = useState<Application | LegalDocument | null>(null); // UPDATED: Can be App or Legal Doc

  // --- Edit Mode State ---
  const [editMode, setEditMode] = useState<EditMode>({
    isActive: false,
    applicationId: null,
    step: 2
  });
  const [editedData, setEditedData] = useState<any>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Toast & Delete State ---
  const [toast, setToast] = useState<ToastMessage>({
    show: false, message: '', type: 'info'
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Application | LegalDocument | null>(null); // UPDATED

  // --- Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  // --- Bulk Action State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // --- Legal Document Generation State ---
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalStep, setLegalStep] = useState<'catalog' | 'form'>('catalog');
  const [selectedTemplate, setSelectedTemplate] = useState<LegalTemplate | null>(null);

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isSupport = user.role === 'support';
  const isStaff = isAdmin || isSupport;
  const isSuperAdmin = user.role === 'superadmin';
  const isRocBundleType = (type: string) => ['roc_normal', 'roc_standard', 'roc_premium'].includes(type);

  // ============================================================================
  // CALLBACKS & HELPERS
  // ============================================================================
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ show: true, message, type });
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    },
    []
  );

  const getCustomerName = useCallback((app: Application): string => {
    const fd = app.formData || {};
    const realName = allUsers.find(u => u.uid === app.userId)?.displayName;
    if (realName) return realName;
    return (
      fd.businessName || fd.tradeName || fd.companyName || fd.proprietorName ||
      fd.applicantName || fd.enterpriseName || fd.promoterName || fd.name ||
      fd.fullName || fd.firmName ||
      `${fd.promoterFirstName || ''} ${fd.promoterLastName || ''}`.trim() ||
      app.userEmail?.split('@')[0] || 'Unknown Customer'
    );
  }, [allUsers]);

  const getDraftCustomerName = useCallback((draft: DraftApplication): string => {
    const fd = draft.formData || {};
    const realUser = allUsers.find(u => u.uid === draft.userId);
    const displayName = realUser?.displayName || draft.createdBy;
    if (displayName?.trim()) return displayName.trim();

    return (
      fd.businessName || fd.tradeName || fd.companyName || fd.proprietorName ||
      fd.applicantName || fd.enterpriseName || fd.promoterName || fd.name ||
      fd.fullName || fd.firmName ||
      `${fd.promoterFirstName || ''} ${fd.promoterLastName || ''}`.trim() ||
      realUser?.email?.split('@')[0] ||
      draft.userEmail?.split('@')[0] ||
      draft.createdEmail?.split('@')[0] ||
      draft.userId
    );
  }, [allUsers]);

  const getStatusIcon = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'submitted': return <Hourglass size={16} className="text-yellow-400" />;
      case 'approved': return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'rejected': return <AlertCircle size={16} className="text-red-400" />;
      case 'deleted': return <AlertCircle size={16} className="text-gray-400" />;
      case 'processing': return <Hourglass size={16} className="text-cyan-400" />;
      case 'editing': return <Edit2 size={16} className="text-blue-400" />;
      default: return <Hourglass size={16} className="text-gray-400" />;
    }
  }, []);

  const getStatusText = useCallback((status: string): string => {
    return status?.split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Unknown';
  }, []);

  const getServiceIcon = useCallback((type: string) => {
    switch (type) {
      case 'fssai': return <Building size={16} />;
      case 'gst': return <CreditCard size={16} />;
      case 'msme': return <BriefcaseIcon size={16} />;
      case 'pan': return <User size={16} />;
      case 'trademark': return <ShieldCheck size={16} />;
      case 'startup': return <Rocket size={16} />;
      case 'shop-establishment': return <Building size={16} />;
      case 'dsc': return <FileSignature size={16} />;
      case 'company_registration':
      case 'llp_registration':
        return <Building size={16} />;
      case 'dir3kyc': return <FileCheck size={16} />;
      case 'inc20a': return <FileCheck size={16} />;
      case 'adt1': return <FileCheck size={16} />;
      case 'roc': return <ClipboardList size={16} />;
      case 'roc_normal':
      case 'roc_standard':
      case 'roc_premium':
        return <ClipboardList size={16} />;
      case 'aoc4':
      case 'inc22a':
      case 'mgt7':
      case 'mgt7a':
        return <FileCheck size={16} />;
      default: return <FileText size={16} />;
    }
  }, []);

  const getServiceName = useCallback((type: string): string => {
    return SERVICE_NAMES[type] || type.toUpperCase();
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  const handleSelectTemplate = (template: LegalTemplate) => {
    setSelectedTemplate(template);
    setLegalStep('form');
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let allApps: Application[] = [];

      // 1. Fetch Users (for Admin/Support)
      if (isAdmin || isSupport) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const usersList: UserProfile[] = [];
          usersSnap.forEach((docSnap) => {
            usersList.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
          });
          setAllUsers(usersList);
        } catch (err) {
          console.error('Error fetching users for lookup', err);
        }
      }

      // 2. Fetch Applications (Existing Logic)
      const buildQuery = (colName: string) => {
        const colRef = collection(db, colName);
        if (isAdmin || isSupport) {
          return query(colRef, orderBy('submittedAt', 'desc'));
        }
        return query(colRef, where('userId', '==', user.uid));
      };

      const processDocs = (
        snapshot: any, type: string, defaultTitle: string, source: string
      ): Application[] => {
        return snapshot.docs
          .map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
            const data = docSnap.data();
            const submittedAt = data.submittedAt?.toDate
              ? data.submittedAt.toDate().getTime()
              : data.submittedAt || Date.now();

            const app: any = {
              id: docSnap.id,
              type,
              title: data.title || defaultTitle,
              status: data.status || 'submitted',
              submittedAt,
              formData: data.formData || (data.packageType || data.company ? {
                company: data.company,
                director: data.director,
                auditor: data.auditor,
                statutory: data.statutory,
                msme: data.msme,
                inc20a: data.inc20a,
                gst: data.gst,
                aoc4: data.aoc4,
                mgt7a: data.mgt7a,
                packageType: data.packageType,
                services: data.services
              } : {}),
              commonData: data.commonData || {},
              uploadedFileUrls: data.uploadedFileUrls || data.documentUrls || {},
              userId: data.userId || user.uid,
              caseId: data.applicationRef || data.caseId || data.serviceId,
              userEmail: data.userEmail,
              assignedTo: data.assignedTo,
              taskStatus: data.taskStatus,
              sourceCollection: source,
              promoters: data.promoters || [],
              directors: data.directors || data.formData?.directors || [],
              partners: data.partners || data.formData?.partners || [],
              constitution: data.constitution || data.commonData?.constitution,
              propertyType: data.propertyType,
              includeSignatoryDetails: data.includeSignatoryDetails,
              signatoryDetails: data.signatoryDetails,
              paymentId: data.paymentId,
              serviceId: data.serviceId,
              trackingId: data.trackingId,
              applicationRef: data.applicationRef,
              services: data.services,
              storageFolder: data.storageFolder,
              documentCount: data.documentCount,
              documentKeys: data.documentKeys,
              bundleServices: data.bundleServices
            };

            // 🔥 Hide individual sub-forms if they are part of a master ROC package
            if (data.packageCaseId) {
              return null;
            }

            if (isSupport && app.assignedTo !== user.uid && app.taskStatus !== 'unassigned') {
              return null;
            }
            return app;
          })
          .filter((app: Application | null): app is Application => app !== null);
      };

      const results = await Promise.all(
        COLLECTION_CONFIG.map(async (fetcher) => {
          try {
            const q = buildQuery(fetcher.name);
            const snapshot = await getDocs(q);
            return processDocs(snapshot, fetcher.type, fetcher.title, fetcher.name);
          } catch (err: any) {
            if (err.code === 'permission-denied') return [];
            return [];
          }
        })
      );
      allApps = results.flat();

      // Auto-detect types for general applications
      allApps.forEach((app) => {
        if (app.type === 'general' && app.title) {
          const t = app.title.toLowerCase();
          if (t.includes('gst')) app.type = 'gst';
          else if (t.includes('fssai')) app.type = 'fssai';
          else if (t.includes('msme')) app.type = 'msme';
          else if (t.includes('pan')) app.type = 'pan';
          else if (t.includes('dsc')) app.type = 'dsc';
          else if (t.includes('shop') || t.includes('establishment')) app.type = 'shop-establishment';
          else if (t.includes('dir-3') || t.includes('dir3')) app.type = 'dir3kyc';
          else if (t.includes('inc-20a') || t.includes('inc20a')) app.type = 'inc20a';
          else if (t.includes('adt-1') || t.includes('adt1')) app.type = 'adt1';
          else if (t.includes('roc')) app.type = 'roc';
          else if (t.includes('aoc-4') || t.includes('aoc4')) app.type = 'aoc4';
          else if (t.includes('inc-22a') || t.includes('inc22a')) app.type = 'inc22a';
          else if (t.includes('mgt-7') || t.includes('mgt7')) app.type = 'mgt7a';
          else if (t.includes('company') || t.includes('pvt ltd') || t.includes('llp') || t.includes('limited liability'))
            app.type = 'company_registration';
        }
      });

      allApps.sort((a, b) => {
        const timeA = typeof a.submittedAt === 'number' ? a.submittedAt : a.submittedAt?.toDate?.()?.getTime() || 0;
        const timeB = typeof b.submittedAt === 'number' ? b.submittedAt : b.submittedAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });

      setApplications(allApps);

      // 3. Fetch Drafts from the generic drafts collection and GST form drafts.
      const draftSources = [
        { name: 'drafts', type: 'generic' },
        { name: 'gstFormDrafts', type: 'gst' },
      ];
      const draftResults = await Promise.all(
        draftSources.map(async (source) => {
          try {
            const draftsRef = collection(db, source.name);
            const draftQuery = (isAdmin || isSupport)
              ? query(draftsRef, orderBy('updatedAt', 'desc'))
              : query(draftsRef, where('userId', '==', user.uid));
            const draftSnap = await getDocs(draftQuery);

            return draftSnap.docs.map((draftDoc) => {
              const data = draftDoc.data() as any;
              const serviceType = source.type === 'gst' ? 'gst' : getDraftServiceType(data, draftDoc.id);
              const commonData = data.commonData || {};
              const displaySeed = commonData.businessName || data.formData?.enterpriseName || data.formData?.businessName || data.service || data.serviceType || serviceType;

              return {
                id: draftDoc.id,
                userId: data.userId || user.uid,
                userEmail: data.userEmail || data.createdEmail || data.email,
                createdBy: data.createdBy || data.customerName || data.userName,
                createdEmail: data.createdEmail || data.userEmail || data.email,
                serviceType,
                serviceName: displaySeed || data.service || data.serviceType || getServiceName(serviceType),
                formData: data.formData || {},
                currentStep: Number(data.currentStep ?? 0),
                docSubStep: data.docSubStep,
                updatedAt: data.updatedAt || Date.now(),
                status: 'draft' as const,
                caseId: data.caseId || data.applicationRef || `${getServiceName(serviceType)} Draft - ${displaySeed}`,
                routeState: data.routeState || (
                  serviceType === 'gst' ? getGstDraftRouteState(data) :
                    serviceType === 'msme' ? getMsmeDraftRouteState(data) :
                      serviceType === 'startup' ? getStartupDraftRouteState(data) :
                        getGenericDraftRouteState(data)
                ),
              };
            });
          } catch (err: any) {
            if (err.code !== 'permission-denied') {
              console.error(`Error fetching ${source.name}`, err);
            }
            return [];
          }
        })
      );

      const draftsList = draftResults.flat().sort((a, b) => {
        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : a.updatedAt?.toDate?.()?.getTime() || 0;
        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : b.updatedAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
      setDrafts(draftsList);

      // 4. Fetch Legal Documents (NEW)
      try {
        if (isStaff) {
          // For staff, use the centralized getAllDocuments which already scans subcollections
          const allDocs = await mockDbService.getAllDocuments();
          const globalLegalDocs = allDocs
            .filter(item => item.doc.type === 'legal')
            .map(item => ({
              ...(item.doc as any),
              userId: item.user.uid // Ensure userId is mapped for metrics
            } as LegalDocument));
          setLegalDocs(globalLegalDocs);
        } else {
          const allMockDocs = await mockDbService.getDocuments(user.uid);
          const userLegalDocs = allMockDocs.filter((d: any) => d.type === 'legal') as LegalDocument[];
          setLegalDocs(userLegalDocs);
        }
      } catch (err) {
        console.error("Failed to fetch legal docs", err);
      }

    } catch (error) {
      console.error('Failed to fetch data', error);
      if (!silent) showToast('Error loading documents', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user.uid, user.role, isAdmin, isSupport, showToast, getServiceName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================================
  // FILTERED DATA
  // ============================================================================
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const searchLower = searchQuery.toLowerCase();
      const customerName = getCustomerName(app).toLowerCase();
      const appDateKey = typeof app.submittedAt === 'number'
        ? new Date(app.submittedAt).toISOString().split('T')[0]
        : app.submittedAt?.toDate?.().toISOString().split('T')[0] || '';

      const matchesStandard =
        app.title.toLowerCase().includes(searchLower) ||
        app.caseId?.toLowerCase().includes(searchLower) ||
        customerName.includes(searchLower) ||
        app.userId.toLowerCase().includes(searchLower);

      const fd = app.formData || {};
      const matchesFormData =
        fd.dscSerialNumber?.toLowerCase().includes(searchLower) ||
        fd.applicantName?.toLowerCase().includes(searchLower) ||
        fd.pan?.toLowerCase().includes(searchLower) ||
        fd.mobile?.includes(searchLower) ||
        fd.din?.toLowerCase().includes(searchLower);

      const matchesSearch = matchesStandard || matchesFormData;
      const matchesService = filterService === 'all' || app.type === filterService;
      const matchesDate = !filterDate || appDateKey === filterDate;

      return matchesSearch && matchesService && matchesDate;
    });
  }, [applications, searchQuery, filterService, filterDate, getCustomerName]);

  const filteredLegalDocs = useMemo(() => {
    return legalDocs.filter((doc) => {
      const searchLower = searchQuery.toLowerCase();
      const docDateKey = typeof doc.submittedAt === 'number'
        ? new Date(doc.submittedAt).toISOString().split('T')[0]
        : (doc.submittedAt as any)?.toDate?.().toISOString().split('T')[0] || '';

      const matchesSearch =
        doc.title.toLowerCase().includes(searchLower) ||
        doc.subtype.toLowerCase().includes(searchLower) ||
        doc.userId.toLowerCase().includes(searchLower);

      const matchesDate = !filterDate || docDateKey === filterDate;

      return matchesSearch && matchesDate;
    });
  }, [legalDocs, searchQuery, filterDate]);

  const filteredDrafts = useMemo(() => {
    return drafts.filter((draft) => {
      const searchLower = searchQuery.toLowerCase();
      const customerName = getDraftCustomerName(draft).toLowerCase();
      const matchesSearch =
        draft.caseId.toLowerCase().includes(searchLower) ||
        draft.serviceType.toLowerCase().includes(searchLower) ||
        (draft.serviceName || '').toLowerCase().includes(searchLower) ||
        customerName.includes(searchLower) ||
        (draft.userEmail || '').toLowerCase().includes(searchLower) ||
        (draft.createdEmail || '').toLowerCase().includes(searchLower);

      const matchesService = filterService === 'all' || draft.serviceType === filterService;
      return matchesSearch && matchesService;
    });
  }, [drafts, searchQuery, filterService, getDraftCustomerName]);

  const getServiceTypes = useCallback(() => {
    const types = new Set([
      ...applications.map((app) => app.type),
      ...drafts.map((draft) => draft.serviceType),
    ]);
    if (types.size > 1) types.delete('general');
    return Array.from(types);
  }, [applications, drafts]);


  // ============================================================================
  // DELETE FUNCTIONALITY
  // ============================================================================
  const handleDelete = useCallback(async () => {
    if (!docToDelete) return;
    setDeletingId(docToDelete.id);
    try {
      // Check if it's a legal doc or an application
      if ((docToDelete as LegalDocument).type === 'legal') {
        await mockDbService.deleteDocument(docToDelete.id);
        setLegalDocs(prev => prev.filter(d => d.id !== docToDelete.id));
      } else {
        const app = docToDelete as Application;
        const collectionName = app.sourceCollection || 'applications';
        await deleteDoc(doc(db, collectionName, app.id));
        if (app.userId) {
          try {
            await deleteDoc(doc(db, 'users', app.userId, 'documents', app.id));
          } catch (err) {
            console.warn('Subcollection delete failed (might not exist):', err);
          }
        }
        if (app.uploadedFileUrls) {
          const deletePromises = Object.values(app.uploadedFileUrls).map(async (url) => {
            try {
              const storageRef = ref(storage, url);
              await deleteObject(storageRef);
            } catch (err) {
              console.warn('Failed to delete file from storage:', err);
            }
          });
          await Promise.allSettled(deletePromises);
        }
        await triggerNotification('STATUS_CHANGED', {
          customerId: app.userId,
          newStatus: 'Deleted',
          formTitle: app.title,
          updatedBy: user.displayName || 'Admin'
        });
        setApplications((prev) => prev.filter((a) => a.id !== app.id));
      }

      setShowDeleteConfirm(false);
      setDocToDelete(null);
      showToast('Document deleted successfully!', 'success');
      mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      showToast('Failed to delete document.', 'error');
    } finally {
      setDeletingId(null);
    }
  }, [docToDelete, user.displayName, showToast]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDeleteInitiate = useCallback(() => {
    if (!isSuperAdmin || selectedIds.size === 0) return;
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowBulkDeleteConfirm(true);
  }, [isSuperAdmin, selectedIds.size]);

  const handleBulkDelete = useCallback(async () => {
    if (!isSuperAdmin || selectedIds.size === 0) return;
    setIsDeletingBulk(true);
    setShowBulkDeleteConfirm(false);
    try {
      let successCount = 0;
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
        const app = applications.find(a => a.id === id);
        if (!app) continue;
        try {
          const collectionName = app.sourceCollection || 'applications';
          await deleteDoc(doc(db, collectionName, id));
          if (app.userId) {
            try {
              await deleteDoc(doc(db, 'users', app.userId, 'documents', id));
            } catch (err) {
              console.warn(`Subcollection delete failed for ${id}`, err);
            }
          }
          if (app.uploadedFileUrls) {
            const deletePromises = Object.values(app.uploadedFileUrls).map(async (url) => {
              try {
                const storageRef = ref(storage, url);
                await deleteObject(storageRef);
              } catch (err) {
                console.warn('Failed to delete file from storage:', err);
              }
            });
            await Promise.allSettled(deletePromises);
          }
          await triggerNotification('STATUS_CHANGED', {
            customerId: app.userId,
            newStatus: 'Deleted',
            formTitle: app.title,
            updatedBy: user.displayName || 'Super Admin'
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to delete ${id}:`, err);
        }
      }
      setApplications(prev => prev.filter(app => !selectedIds.has(app.id)));
      setSelectedIds(new Set());
      showToast(`Successfully deleted ${successCount} entries.`, 'success');
      mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Bulk delete error:', error);
      showToast('Error during bulk deletion.', 'error');
    } finally {
      setIsDeletingBulk(false);
    }
  }, [applications, isSuperAdmin, selectedIds, user.displayName, showToast]);

  const openDeleteModal = useCallback((app: Application) => {
    setDocToDelete(app);
    setShowBulkDeleteConfirm(false);
    setShowDeleteConfirm(true);
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ============================================================================
  // DOWNLOAD FUNCTIONALITY
  // ============================================================================
  const handleDownload = useCallback(
    async (url: string, fileName: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed:', error);
        showToast('Could not download. Opening in new tab.', 'error');
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [showToast]
  );

  // ============================================================================
  // RENDER FIELD COMPONENT
  // ============================================================================
  const renderField = (label: string, value: any, icon?: React.ReactNode) => {
    if (!hasDisplayValue(value)) return null;
    const displayValue = formatStateValue(label, value);
    return (
      <div className="document-field-card p-3 md:p-4 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-md hover:border-white/10 transition-colors group">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          {icon && <span className="text-orange-500/80 group-hover:text-cyan-400 transition-colors">{icon}</span>}
          <label className="text-[9px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">{label}</label>
        </div>
        <p className="text-xs md:text-sm text-gray-200 font-semibold break-words">{String(displayValue)}</p>
      </div>
    );
  };

  const formatEnumValue = (value: any) => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  };

  const formatAddressValue = (address: any) => {
    if (!address) return null;
    return [
      address.line1,
      address.line2,
      address.district,
      formatStateValue('state', address.state),
      address.pincode
    ].filter(Boolean).join(', ');
  };

  const formatDocumentName = (key: string): string => {
    const labels: Record<string, string> = {
      coi: 'Certificate of Incorporation',
      moa: 'Memorandum of Association',
      aoa: 'Articles of Association',
      directorPan: 'Director PAN',
      directorAadhaar: 'Director Aadhaar',
      bankStatement: 'Bank Statement',
      boardResolution: 'Board Resolution',
      auditorConsent: 'Auditor Consent',
      dsc: 'Digital Signature Certificate',
      digitalSignature: 'Digital Signature Certificate',
      digitalSignatureCertificate: 'Digital Signature Certificate',
    };

    return labels[key] || key
      .replace(/([A-Z])/g, ' $1')
      .replace(/\bpan\b/gi, 'PAN')
      .replace(/\baadhaar\b/gi, 'Aadhaar')
      .replace(/\bcoi\b/gi, 'COI')
      .replace(/\bmoa\b/gi, 'MOA')
      .replace(/\baoa\b/gi, 'AOA')
      .replace(/\bdsc\b/gi, 'DSC')
      .trim();
  };

  // ============================================================================
  // APPLICATION DETAIL VIEW COMPONENT
  // ============================================================================
  const ApplicationDetailView: React.FC<{ application: Application }> = ({ application }) => {
    const formData = application.formData || {};
    const commonData = application.commonData || {};
    const files = application.uploadedFileUrls || {};
    const isRocPackage = isRocBundleType(application.type);
    const includedBundleServices = application.bundleServices?.length
      ? application.bundleServices
      : application.type === 'roc_standard'
        ? [
          { key: 'msme', label: 'MSME Registration', included: true },
          { key: 'dir3kyc', label: 'DIR-3 KYC Filing', included: true },
          { key: 'inc20a', label: 'INC-20A Filing', included: true },
          { key: 'adt1', label: 'ADT-1 Filing', included: true },
          { key: 'inc22a', label: 'INC-22A Filing', included: true },
        ]
        : application.type === 'roc_premium'
          ? [
            { key: 'msme', label: 'MSME Registration', included: true },
            { key: 'dir3kyc', label: 'DIR-3 KYC Filing', included: true },
            { key: 'inc20a', label: 'INC-20A Filing', included: true },
            { key: 'adt1', label: 'ADT-1 Filing', included: true },
            { key: 'aoc4', label: 'AOC-4 Filing', included: true },
            { key: 'mgt7a', label: 'MGT-7 Filing', included: true },
            { key: 'gst', label: 'GST Registration', included: true },
          ]
          : [];
    const defaultRocFolder =
      application.type === 'roc_standard'
        ? 'roc-standard-packages'
        : application.type === 'roc_premium'
          ? 'roc-premium-packages'
          : 'roc-normal-packages';

    const SectionWrapper: React.FC<{
      title: string;
      icon: React.ReactNode;
      children: React.ReactNode;
    }> = ({ title, icon, children }) => (
      <div className="document-section-card rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden mb-6 md:mb-8 last:mb-0 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3 md:gap-4 p-4 md:p-5 border-b border-white/5 bg-white/[0.02]">
          <div className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-orange-500/20">
            {icon}
          </div>
          <h4 className="text-lg md:text-xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent tracking-tight">{title}</h4>
        </div>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </div>
    );

    const renderSectionFields = (
      title: string,
      icon: React.ReactNode,
      fields: Array<{ label: string; value: any; icon?: React.ReactNode }>
    ) => {
      const visibleFields = fields.filter(field => hasDisplayValue(field.value));
      if (visibleFields.length === 0) return null;

      return (
        <SectionWrapper title={title} icon={icon}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleFields.map((field) => renderField(field.label, field.value, field.icon))}
          </div>
        </SectionWrapper>
      );
    };

    const renderListSection = (
      title: string,
      icon: React.ReactNode,
      items: any[],
      renderItem: (item: any, index: number) => React.ReactNode,
      emptyText = 'None provided'
    ) => {
      if (!items || items.length === 0) return null;
      return (
        <SectionWrapper title={title} icon={icon}>
          <div className="space-y-3">
            {items.map(renderItem)}
          </div>
        </SectionWrapper>
      );
    };

    return (
      <div className="space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
        {/* Header Section */}
        <div className="document-detail-header sticky -top-2 md:-top-4 bg-gradient-to-br from-[#0a0f1c] to-[#121827] p-5 md:p-6 rounded-2xl md:rounded-3xl border border-white/10 z-40 shadow-2xl mb-6 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 truncate">
                {application.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm">
                <span className="font-mono text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-lg border border-cyan-400/20 flex items-center gap-1.5 whitespace-nowrap">
                  <Hash size={12} className="md:w-[14px] md:h-[14px]" />
                  <span className="truncate max-w-[120px] md:max-w-none">{(application as any).trackingId || application.caseId || application.id}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText((application as any).trackingId || application.caseId || application.id); showToast('Tracking ID copied', 'success'); }}
                    className="hover:text-white transition-colors ml-1 shrink-0"
                    title="Copy Tracking ID"
                  >
                    <Copy size={12} />
                  </button>
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar size={12} className="md:w-[14px] md:h-[14px] text-slate-500" />
                  {formatDate(application.submittedAt)}
                </span>
              </div>
            </div>
            <div className={`shrink-0 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border flex items-center gap-2 w-fit ${application.status === 'submitted' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
              application.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                application.status === 'rejected' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  'bg-slate-700/50 border-slate-600 text-slate-300'
              }`}>
              {application.status === 'submitted' && <AlertCircle size={14} className="md:w-[16px] md:h-[16px]" />}
              {application.status === 'approved' && <CheckCircle2 size={14} className="md:w-[16px] md:h-[16px]" />}
              <span className="text-xs md:text-sm font-semibold whitespace-nowrap">{getStatusText(application.status)}</span>
            </div>
          </div>
        </div>

        <DocumentTrackingStepper application={application} />

        {/* ROC Package Submitted Details */}
        {Object.keys(formData).length > 0 && (
          <SectionWrapper title="Submitted Form Details" icon={<ClipboardList size={18} />}>
            <div className="space-y-6">
              {(application.type === 'roc_standard' || application.type === 'roc_premium') && includedBundleServices.length > 0 && (
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h5 className="text-sm font-semibold text-orange-300">What&apos;s Included</h5>
                      <p className="text-xs text-slate-400 mt-1">
                        These filings are stored under one ROC package and shown from one Firestore record.
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-orange-300 border border-orange-500/20 px-2 py-1 rounded-full">
                      Bundle Services
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {includedBundleServices.map((service) => (
                      <div key={service.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{service.label}</p>
                          <p className="text-xs text-slate-500">{service.included ? 'Included in this package' : 'Not included'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {renderField('Service Package', application.title, <FileText size={14} />)}
                {renderField('Tracking ID', (application as any).trackingId || application.caseId || application.id, <Hash size={14} />)}
                {renderField('Submitted At', formatDate(application.submittedAt), <Calendar size={14} />)}
                {renderField('Storage Folder', application.storageFolder, <Folder size={14} />)}
              </div>

              {application.type === 'roc_standard' || application.type === 'roc_premium' ? (
                <>
                  {renderSectionFields('Company Master Details', <Building size={18} />, [
                    { label: 'CIN', value: formData.company?.cin, icon: <Hash size={14} /> },
                    { label: 'Company Name', value: formData.company?.name, icon: <Building size={14} /> },
                    { label: 'Registered Address', value: formData.company?.registeredAddress, icon: <MapPin size={14} /> },
                    { label: 'Company Email', value: formData.company?.email, icon: <Mail size={14} /> },
                    { label: 'Organisation Type', value: formatEnumValue(formData.company?.orgType), icon: <Shield size={14} /> },
                    { label: 'Date of Incorporation', value: formData.company?.dateOfIncorporation, icon: <Calendar size={14} /> },
                    { label: 'Date of Commencement', value: formData.company?.dateOfCommencement, icon: <Calendar size={14} /> },
                    { label: 'Authorised Capital', value: formData.company?.authorisedCapital ? `₹${formData.company.authorisedCapital}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Paid-up Capital', value: formData.company?.paidUpCapital ? `₹${formData.company.paidUpCapital}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Principal NIC Code', value: formData.company?.principalNicCode, icon: <Hash size={14} /> },
                    { label: 'Principal Activity', value: formData.company?.principalActivity, icon: <BriefcaseIcon size={14} /> },
                    { label: 'Turnover', value: formData.company?.turnover ? `₹${formData.company.turnover}` : null, icon: <IndianRupee size={14} /> },
                  ])}

                  {renderSectionFields('Director KYC Details', <User size={18} />, [
                    { label: 'DIN', value: formData.director?.din, icon: <Hash size={14} /> },
                    { label: 'Name', value: [formData.director?.firstName, formData.director?.middleName, formData.director?.lastName].filter(Boolean).join(' '), icon: <User size={14} /> },
                    { label: "Father's Name", value: formData.director?.fatherName, icon: <Users size={14} /> },
                    { label: 'Date of Birth', value: formData.director?.dob, icon: <Calendar size={14} /> },
                    { label: 'Gender', value: formData.director?.gender, icon: <User size={14} /> },
                    { label: 'Nationality', value: formData.director?.nationality, icon: <Globe size={14} /> },
                    { label: 'Place of Birth', value: formData.director?.placeOfBirth, icon: <MapPinned size={14} /> },
                    { label: 'Country of Birth', value: formData.director?.countryOfBirth, icon: <Globe size={14} /> },
                    { label: 'Occupation', value: formData.director?.occupation, icon: <BriefcaseIcon size={14} /> },
                    { label: 'Educational Qualification', value: formData.director?.educationalQualification, icon: <FileText size={14} /> },
                    { label: 'Citizen of India', value: formData.director?.isCitizenOfIndia, icon: <Shield size={14} /> },
                    { label: 'PAN', value: formData.director?.pan, icon: <FileCheck size={14} /> },
                    { label: 'Mobile', value: formData.director?.mobile, icon: <Phone size={14} /> },
                    { label: 'Personal Email', value: formData.director?.personalEmail, icon: <Mail size={14} /> },
                    { label: 'Present Address', value: formatAddressValue(formData.director?.presentAddress), icon: <Home size={14} /> },
                    { label: 'Permanent Address Same As Present', value: formData.director?.permanentAddressSameAsPresent ? 'Yes' : 'No', icon: <CheckCircle2 size={14} /> },
                    { label: 'Permanent Address', value: formatAddressValue(formData.director?.permanentAddress), icon: <Home size={14} /> },
                  ])}

                  {renderSectionFields('ADT-1', <BriefcaseIcon size={18} />, [
                    { label: 'Auditor Type', value: formData.auditor?.auditorType, icon: <ShieldCheck size={14} /> },
                    { label: 'Auditor Name', value: formData.auditor?.name, icon: <BriefcaseIcon size={14} /> },
                    { label: 'Membership No.', value: formData.auditor?.membershipNo, icon: <Hash size={14} /> },
                    { label: 'FRN', value: formData.auditor?.frn, icon: <Hash size={14} /> },
                    { label: 'PAN', value: formData.auditor?.pan, icon: <FileCheck size={14} /> },
                    { label: 'Email', value: formData.auditor?.email, icon: <Mail size={14} /> },
                    { label: 'Mobile', value: formData.auditor?.mobile, icon: <Phone size={14} /> },
                    { label: 'Address', value: formData.auditor?.address, icon: <MapPin size={14} /> },
                    { label: 'Date of Appointment', value: formData.auditor?.dateOfAppointment, icon: <Calendar size={14} /> },
                    { label: 'Appointment Period', value: formData.auditor?.appointmentPeriod, icon: <Calendar size={14} /> },
                    { label: 'Reappointment', value: formData.auditor?.isReappointment, icon: <CheckCircle2 size={14} /> },
                    { label: 'Previous ADT SRN', value: formData.auditor?.previousADTSrn, icon: <Hash size={14} /> },
                    { label: 'Resolution No.', value: formData.auditor?.resolutionNumber, icon: <ClipboardList size={14} /> },
                    { label: 'Resolution Date', value: formData.auditor?.resolutionDate, icon: <Calendar size={14} /> },
                  ])}

                  {renderSectionFields('AOC-4', <ClipboardList size={18} />, [
                    { label: 'Financial Year', value: formData.statutory?.financialYear || formData.aoc4?.financialYear, icon: <Calendar size={14} /> },
                    { label: 'AGM Date', value: formData.statutory?.agmDate, icon: <Calendar size={14} /> },
                    { label: 'Board Meeting Date', value: formData.statutory?.boardMeetingDate, icon: <Calendar size={14} /> },
                    { label: 'Authorized Capital', value: formData.aoc4?.authorizedCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Paid-up Capital', value: formData.aoc4?.paidUpCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Turnover', value: formData.aoc4?.turnover, icon: <IndianRupee size={14} /> },
                    { label: 'Net Worth', value: formData.aoc4?.netWorth, icon: <IndianRupee size={14} /> },
                    { label: 'Profit Before Tax', value: formData.aoc4?.profitBeforeTax, icon: <IndianRupee size={14} /> },
                    { label: 'Profit After Tax', value: formData.aoc4?.profitAfterTax, icon: <IndianRupee size={14} /> },
                    { label: 'CA Name', value: formData.statutory?.caName || formData.aoc4?.caName, icon: <User size={14} /> },
                    { label: 'CA Membership No.', value: formData.statutory?.caMembershipNo || formData.aoc4?.caMembershipNo, icon: <Hash size={14} /> },
                    { label: 'CA COP No.', value: formData.statutory?.caCopNo || formData.aoc4?.caCopNo, icon: <Hash size={14} /> },
                    { label: 'Contact Number', value: formData.aoc4?.contactNumber, icon: <Phone size={14} /> },
                    { label: 'Auditor Appointment From', value: formData.statutory?.auditorAppointmentPeriodFrom, icon: <Calendar size={14} /> },
                    { label: 'Auditor Appointment To', value: formData.statutory?.auditorAppointmentPeriodTo, icon: <Calendar size={14} /> },
                    { label: 'Has Deposits', value: formData.statutory?.hasDeposits, icon: <Banknote size={14} /> },
                    { label: 'Financial Statement Type', value: formData.statutory?.financialStatementType || formData.aoc4?.financialStatementType, icon: <FileText size={14} /> },
                    { label: 'Auditor Report Type', value: formData.statutory?.auditorReportType || formData.aoc4?.auditorReportType, icon: <FileText size={14} /> },
                    { label: 'CSR Obligation', value: formData.statutory?.hasCsrObligation, icon: <Shield size={14} /> },
                    { label: 'XBRL Mandatory', value: formData.statutory?.isXbrlMandatory, icon: <Shield size={14} /> },
                    { label: 'Auditor Qualification', value: formData.statutory?.hasAuditorQualification, icon: <Shield size={14} /> },
                    { label: 'Auditor Qualification Details', value: formData.statutory?.auditorQualificationDetails, icon: <FileText size={14} /> },
                  ])}

                  {renderSectionFields('MGT-7A', <Users size={18} />, [
                    { label: 'Members at Beginning', value: formData.statutory?.membersAtBeginning, icon: <Users size={14} /> },
                    { label: 'Members at End', value: formData.statutory?.membersAtEnd, icon: <Users size={14} /> },
                    { label: 'Board Meetings Held', value: formData.statutory?.boardMeetingsHeld || formData.mgt7a?.boardMeetingsHeld, icon: <ClipboardList size={14} /> },
                    { label: 'Penalties Exist', value: formData.statutory?.penaltiesExist, icon: <AlertCircle size={14} /> },
                    { label: 'Penalties Details', value: formData.statutory?.penaltiesDetails, icon: <FileText size={14} /> },
                    { label: 'CEO Name', value: formData.statutory?.kmpCeoName, icon: <User size={14} /> },
                    { label: 'CEO DIN', value: formData.statutory?.kmpCeoDin, icon: <Hash size={14} /> },
                    { label: 'CFO Name', value: formData.statutory?.kmpCfoName, icon: <User size={14} /> },
                    { label: 'CFO PAN', value: formData.statutory?.kmpCfoPan, icon: <FileCheck size={14} /> },
                    { label: 'CS Name', value: formData.statutory?.kmpCsName, icon: <User size={14} /> },
                    { label: 'CS Membership', value: formData.statutory?.kmpCsMembership, icon: <Hash size={14} /> },
                    { label: 'Authorized Capital', value: formData.mgt7a?.authorizedCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Paid-up Capital', value: formData.mgt7a?.paidUpCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Number of Shareholders', value: formData.mgt7a?.numberOfShareholders, icon: <Users size={14} /> },
                    { label: 'Director Name', value: formData.mgt7a?.directorName, icon: <User size={14} /> },
                    { label: 'DIN', value: formData.mgt7a?.din, icon: <Hash size={14} /> },
                    { label: 'Principal Business Activity', value: formData.mgt7a?.principalBusinessActivity, icon: <BriefcaseIcon size={14} /> },
                  ])}

                  {renderSectionFields('GST Registration', <CreditCard size={18} />, [
                    { label: 'Business Name', value: formData.gst?.businessName || formData.gst?.legalNameOfBusiness, icon: <Building size={14} /> },
                    { label: 'Constitution', value: formData.gst?.constitution || formData.gst?.constitutionOfBusiness, icon: <Shield size={14} /> },
                    { label: 'PAN Number', value: formData.gst?.panNumber || formData.gst?.pan, icon: <FileCheck size={14} /> },
                    { label: 'Commencement Date', value: formData.gst?.dateOfCommencement, icon: <Calendar size={14} /> },
                    { label: 'Nature of Business', value: formData.gst?.natureOfBusiness, icon: <BriefcaseIcon size={14} /> },
                    { label: 'Business Activity Type', value: formData.gst?.businessActivityType, icon: <Activity size={14} /> },
                    { label: 'Signatory Name', value: formData.gst?.signatoryName, icon: <User size={14} /> },
                    { label: 'Signatory Mobile', value: formData.gst?.signatoryMobile || formData.gst?.mobileNumber, icon: <Phone size={14} /> },
                    { label: 'Signatory Email', value: formData.gst?.signatoryEmail || formData.gst?.emailAddress, icon: <Mail size={14} /> },
                  ])}

                  {renderSectionFields('INC-22A', <Home size={18} />, [
                    { label: 'Office Address', value: formData.statutory?.inc22aOfficeAddress, icon: <MapPin size={14} /> },
                    { label: 'State', value: formatStateValue('state', formData.statutory?.inc22aOfficeState), icon: <Globe size={14} /> },
                    { label: 'District', value: formData.statutory?.inc22aOfficeDistrict, icon: <MapPinned size={14} /> },
                    { label: 'Pincode', value: formData.statutory?.inc22aPincode, icon: <Hash size={14} /> },
                    { label: 'Latitude', value: formData.statutory?.inc22aLatitude, icon: <Map size={14} /> },
                    { label: 'Longitude', value: formData.statutory?.inc22aLongitude, icon: <Map size={14} /> },
                    { label: 'Email Verified', value: formData.statutory?.inc22aEmailVerified, icon: <CheckCircle2 size={14} /> },
                    { label: 'Has Company Email', value: formData.statutory?.inc22aHasEmail, icon: <Mail size={14} /> },
                  ])}

                  {renderSectionFields('MSME(UDYAM)', <BriefcaseIcon size={18} />, [
                    { label: 'Udyam Status', value: formData.msme?.udyamStatus || formData.udyamStatus, icon: <ClipboardList size={14} /> },
                    { label: 'Udyam Number', value: formData.msme?.udyamNumber || formData.udyamNumber, icon: <Hash size={14} /> },
                    { label: 'Enterprise Name', value: formData.msme?.enterpriseName || formData.enterpriseName, icon: <Building size={14} /> },
                    { label: 'Enterprise Address', value: formData.msme?.enterpriseAddress || formData.enterpriseAddress, icon: <MapPin size={14} /> },
                    { label: 'Major Activity', value: formatEnumValue(formData.msme?.activity || formData.msme?.majorActivity || formData.activity || formData.majorActivity), icon: <BriefcaseIcon size={14} /> },
                    { label: 'NIC Code', value: formData.msme?.nicCode || formData.nicCode, icon: <Hash size={14} /> },
                    { label: 'Social Category', value: formData.msme?.socialCategory || formData.socialCategory, icon: <User size={14} /> },
                    { label: 'Woman Entrepreneur', value: formData.msme?.isWomanEntrepreneur || formData.isWomanEntrepreneur, icon: <Users size={14} /> },
                    { label: 'Investment Amount', value: formData.msme?.investmentAmount || formData.investmentAmount ? `₹${formData.msme?.investmentAmount || formData.investmentAmount}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Turnover Amount', value: formData.msme?.turnoverAmount || formData.turnoverAmount ? `₹${formData.msme?.turnoverAmount || formData.turnoverAmount}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Total Employees', value: formData.msme?.totalEmployees || formData.totalEmployees, icon: <Users size={14} /> },
                    { label: 'GSTIN', value: formData.msme?.gstin || formData.gstin, icon: <FileCheck size={14} /> },
                    { label: 'Enterprise PAN', value: formData.msme?.pan || formData.msme?.enterprisePan || formData.pan || formData.enterprisePan, icon: <FileCheck size={14} /> },
                    { label: 'Enterprise Aadhaar', value: formData.msme?.aadhaar || formData.msme?.enterpriseAadhaar || formData.aadhaar || formData.enterpriseAadhaar, icon: <FileCheck size={14} /> },
                  ])}

                  {renderListSection('Directors Changed / Appointed', <Users size={18} />, formData.directorChanges || formData.statutory?.directorChanges || [], (d: any, index: number) => (
                    <div key={d.id || index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-white mb-3">Entry {index + 1}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {renderField('Name', d.name, <User size={14} />)}
                        {renderField('DIN', d.din, <Hash size={14} />)}
                        {renderField('Designation', d.designation, <BriefcaseIcon size={14} />)}
                        {renderField('Category', d.category, <Shield size={14} />)}
                        {renderField('Date of Appointment', d.dateOfAppointment, <Calendar size={14} />)}
                        {renderField('Date of Cessation', d.dateOfCessation, <Calendar size={14} />)}
                        {renderField('Mode of Cessation', d.modeOfCessation, <FileText size={14} />)}
                      </div>
                    </div>
                  ))}

                  {renderListSection('Top Shareholders', <Users size={18} />, formData.topShareholders || formData.statutory?.topShareholders || [], (s: any, index: number) => (
                    <div key={s.id || index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-white mb-3">Shareholder {index + 1}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {renderField('Name', s.name, <User size={14} />)}
                        {renderField('Folio No.', s.folioNumber, <Hash size={14} />)}
                        {renderField('No. of Shares', s.numberOfShares, <ClipboardList size={14} />)}
                        {renderField('Holding %', s.percentageHolding, <PieChart size={14} />)}
                      </div>
                    </div>
                  ))}

                  {renderListSection('Subscribers', <Users size={18} />, formData.statutory?.subscribers || [], (sub: any, index: number) => (
                    <div key={sub.id || index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-white mb-3">Subscriber {index + 1}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {renderField('Name', sub.name, <User size={14} />)}
                        {renderField('Shares Subscribed', sub.sharesSubscribed, <ClipboardList size={14} />)}
                        {renderField('Nominal Value/Share', sub.nominalValuePerShare, <IndianRupee size={14} />)}
                        {renderField('Bank Name', sub.bankName, <Building size={14} />)}
                        {renderField('Company Bank Name', sub.companyBankName, <Building size={14} />)}
                        {renderField('Company Account No.', sub.companyAccountNumber, <CreditCard size={14} />)}
                        {renderField('IFSC', sub.ifsc, <Hash size={14} />)}
                        {renderField('Account No.', sub.accountNumber, <CreditCard size={14} />)}
                        {renderField('Amount', sub.amount ? `₹${sub.amount}` : null, <IndianRupee size={14} />)}
                        {renderField('Date of Receipt', sub.dateOfReceipt, <Calendar size={14} />)}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {(isRocPackage || application.type === 'company_registration' || application.type === 'llp_registration') && renderSectionFields('Company Details', <Building size={18} />, [
                    { label: 'CIN', value: formData.company?.cin, icon: <Hash size={14} /> },
                    { label: 'Company Name', value: formData.company?.name, icon: <Building size={14} /> },
                    { label: 'Company Email', value: formData.company?.email, icon: <Mail size={14} /> },
                    { label: 'Organisation Type', value: formatEnumValue(formData.company?.organisationType), icon: <Shield size={14} /> },
                    { label: 'Date of Incorporation', value: formData.company?.dateOfIncorporation, icon: <Calendar size={14} /> },
                    { label: 'Date of Commencement', value: formData.company?.dateOfCommencement, icon: <Calendar size={14} /> },
                    { label: 'Authorised Capital', value: formData.company?.authorisedCapital ? `₹${formData.company.authorisedCapital}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Paid-up Capital', value: formData.company?.paidUpCapital ? `₹${formData.company.paidUpCapital}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'NIC Code', value: formData.company?.nicCode, icon: <Hash size={14} /> },
                    { label: 'Registered Office Address', value: formatAddressValue(formData.company?.address), icon: <MapPin size={14} /> },
                  ])}

                  {(isRocPackage || application.type === 'dir3kyc') && renderSectionFields('DIR-3-KYC/Director Details', <User size={18} />, [
                    { label: 'DIN', value: formData.director?.din, icon: <Hash size={14} /> },
                    { label: 'Full Name', value: [formData.director?.firstName, formData.director?.lastName].filter(Boolean).join(' '), icon: <User size={14} /> },
                    { label: "Father's Name", value: formData.director?.fatherName, icon: <Users size={14} /> },
                    { label: 'Date of Birth', value: formData.director?.dob, icon: <Calendar size={14} /> },
                    { label: 'PAN', value: formData.director?.pan, icon: <FileCheck size={14} /> },
                    { label: 'Aadhaar', value: formData.director?.aadhaar, icon: <FileCheck size={14} /> },
                    { label: 'Mobile', value: formData.director?.mobile, icon: <Phone size={14} /> },
                    { label: 'Email', value: formData.director?.email, icon: <Mail size={14} /> },
                    { label: 'Residential Address', value: formatAddressValue(formData.director?.address), icon: <Home size={14} /> },
                  ])}

                  {(isRocPackage || application.type === 'adt1') && renderSectionFields('ADT-1/Auditor Details', <BriefcaseIcon size={18} />, [
                    { label: 'Auditor Type', value: formatEnumValue(formData.auditor?.type), icon: <ShieldCheck size={14} /> },
                    { label: 'Auditor / Firm Name', value: formData.auditor?.name, icon: <BriefcaseIcon size={14} /> },
                    { label: 'Membership No.', value: formData.auditor?.membershipNo, icon: <Hash size={14} /> },
                    { label: 'PAN', value: formData.auditor?.pan, icon: <FileCheck size={14} /> },
                    { label: 'Email', value: formData.auditor?.email, icon: <Mail size={14} /> },
                    { label: 'Mobile', value: formData.auditor?.mobile, icon: <Phone size={14} /> },
                    { label: 'Date of Appointment', value: formData.auditor?.dateOfAppointment, icon: <Calendar size={14} /> },
                    { label: 'Board Resolution No.', value: formData.auditor?.resolutionNumber, icon: <ClipboardList size={14} /> },
                    { label: 'Board Resolution Date', value: formData.auditor?.resolutionDate, icon: <Calendar size={14} /> },
                    { label: 'Auditor Address', value: formData.auditor?.address, icon: <MapPin size={14} /> },
                  ])}

                  {(isRocPackage || application.type === 'inc20a') && renderSectionFields('INC-20A / Capital Details', <Banknote size={18} />, [
                    { label: 'Bank Name', value: formData.inc20a?.bank?.name, icon: <Building size={14} /> },
                    { label: 'Account Number', value: formData.inc20a?.bank?.accountNumber, icon: <CreditCard size={14} /> },
                    { label: 'IFSC', value: formData.inc20a?.bank?.ifsc, icon: <Hash size={14} /> },
                    { label: 'Subscriber Name', value: formData.inc20a?.subscriber?.name, icon: <User size={14} /> },
                    { label: 'Shares', value: formData.inc20a?.subscriber?.shares, icon: <ClipboardList size={14} /> },
                    { label: 'Amount Received', value: formData.inc20a?.subscriber?.amount ? `₹${formData.inc20a.subscriber.amount}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Date of Receipt', value: formData.inc20a?.subscriber?.dateOfReceipt, icon: <Calendar size={14} /> },
                  ])}

                  {(isRocPackage || application.type === 'msme') && renderSectionFields('MSME / Udyam Details', <BriefcaseIcon size={18} />, [
                    { label: 'Udyam Status', value: formData.msme?.udyamStatus || formData.udyamStatus, icon: <ClipboardList size={14} /> },
                    { label: 'Udyam Number', value: formData.msme?.udyamNumber || formData.udyamNumber, icon: <Hash size={14} /> },
                    { label: 'Enterprise Name', value: formData.msme?.enterpriseName || formData.enterpriseName || formData.businessName, icon: <Building size={14} /> },
                    { label: 'Enterprise Address', value: formData.msme?.enterpriseAddress || formData.enterpriseAddress || formData.address, icon: <MapPin size={14} /> },
                    { label: 'Activity', value: formatEnumValue(formData.msme?.activity || formData.msme?.majorActivity || formData.activity || formData.majorActivity), icon: <Activity size={14} /> },
                    { label: 'NIC Code', value: formData.msme?.nicCode || formData.nicCode, icon: <Hash size={14} /> },
                    { label: 'Social Category', value: formData.msme?.socialCategory || formData.socialCategory, icon: <User size={14} /> },
                    { label: 'Woman Entrepreneur', value: formData.msme?.isWomanEntrepreneur || formData.isWomanEntrepreneur, icon: <Users size={14} /> },
                    { label: 'Specially Abled', value: formData.msme?.speciallyAbled || formData.speciallyAbled, icon: <User size={14} /> },
                    { label: 'Investment Amount', value: formData.msme?.investmentAmount || formData.investmentAmount ? `₹${formData.msme?.investmentAmount || formData.investmentAmount}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Turnover Amount', value: formData.msme?.turnoverAmount || formData.turnoverAmount ? `₹${formData.msme?.turnoverAmount || formData.turnoverAmount}` : null, icon: <IndianRupee size={14} /> },
                    { label: 'Total Employees', value: formData.msme?.totalEmployees || formData.totalEmployees, icon: <Users size={14} /> },
                    { label: 'GSTIN', value: formData.msme?.gstin || formData.gstin, icon: <FileCheck size={14} /> },
                    { label: 'PAN', value: formData.msme?.pan || formData.msme?.enterprisePan || formData.pan || formData.enterprisePan || formData.panNumber, icon: <FileCheck size={14} /> },
                    { label: 'Aadhaar', value: formData.msme?.aadhaar || formData.msme?.enterpriseAadhaar || formData.aadhaar || formData.enterpriseAadhaar, icon: <FileCheck size={14} /> },
                    { label: 'Mobile', value: formData.msme?.mobile || formData.mobile || formData.phone, icon: <Phone size={14} /> },
                    { label: 'Email', value: formData.msme?.email || formData.email, icon: <Mail size={14} /> },
                    { label: 'Gender', value: formData.msme?.gender || formData.gender, icon: <User size={14} /> },
                  ])}

                  {(isRocPackage || application.type === 'gst') && (
                    <>
                      {renderSectionFields('GST Registration Details', <CreditCard size={18} />, [
                        { label: 'Legal Business Name', value: formData.gst?.businessName || formData.gst?.legalNameOfBusiness || formData.businessName || formData.legalNameOfBusiness, icon: <Building size={14} /> },
                        { label: 'Trade Name', value: formData.gst?.tradeName || formData.tradeName, icon: <BriefcaseIcon size={14} /> },
                        { label: 'Proprietor Name', value: formData.gst?.proprietorName || formData.proprietorName, icon: <User size={14} /> },
                        { label: 'Firm Name', value: formData.gst?.firmName || formData.firmName, icon: <Building size={14} /> },
                        { label: 'Company / LLP Name', value: formData.gst?.companyName || formData.companyName || formData.gst?.llpName || formData.llpName, icon: <Building size={14} /> },
                        { label: 'Constitution', value: formData.gst?.constitution || formData.gst?.constitutionOfBusiness || formData.constitution || formData.constitutionOfBusiness, icon: <Shield size={14} /> },
                        { label: 'PAN Number', value: formData.gst?.panNumber || formData.gst?.pan || formData.panNumber || formData.pan, icon: <FileCheck size={14} /> },
                        { label: 'CIN / LLPIN', value: formData.gst?.cin || formData.cin || formData.gst?.llpin || formData.llpin, icon: <Hash size={14} /> },
                        { label: 'Incorporation Date', value: formData.gst?.incorporationDate || formData.incorporationDate, icon: <Calendar size={14} /> },
                        { label: 'Commencement Date', value: formData.gst?.dateOfCommencement || formData.dateOfCommencement, icon: <Calendar size={14} /> },
                        { label: 'Registered Address', value: formData.gst?.address || formData.address, icon: <MapPin size={14} /> },
                        { label: 'Nature of Business', value: formData.gst?.natureOfBusiness || formData.natureOfBusiness, icon: <BriefcaseIcon size={14} /> },
                        { label: 'Business Activity Type', value: formData.gst?.businessActivityType || formData.businessActivityType, icon: <Activity size={14} /> },
                        { label: 'Reason for Registration', value: formData.gst?.reasonForRegistration || formData.reasonForRegistration, icon: <AlertCircle size={14} /> },
                        { label: 'State Jurisdiction', value: formData.gst?.stateJurisdiction || formData.stateJurisdiction, icon: <MapPin size={14} /> },
                        { label: 'Center Jurisdiction', value: formData.gst?.centerJurisdiction || formData.centerJurisdiction, icon: <MapPin size={14} /> },
                        { label: 'Signatory Name', value: formData.gst?.signatoryName || formData.signatoryName, icon: <User size={14} /> },
                        { label: 'Signatory Mobile', value: formData.gst?.signatoryMobile || formData.gst?.mobileNumber || formData.signatoryMobile || formData.mobileNumber || formData.phone, icon: <Phone size={14} /> },
                        { label: 'Signatory Email', value: formData.gst?.signatoryEmail || formData.gst?.emailAddress || formData.signatoryEmail || formData.emailAddress, icon: <Mail size={14} /> },
                      ])}

                      {renderListSection('Promoters / Partners / Directors', <Users size={18} />,
                        application.directors?.length ? application.directors :
                          (application.partners?.length ? application.partners :
                            (application.promoters?.length ? application.promoters : [])),
                        (p: any, index: number) => (
                          <div key={p.id || index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <p className="text-sm font-semibold text-white mb-3">Person {index + 1}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {renderField('Name', p.name || p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(), <User size={14} />)}
                              {renderField('PAN', p.pan || p.panNumber, <FileCheck size={14} />)}
                              {renderField('Aadhaar', p.aadhaar || p.aadhaarNumber, <Hash size={14} />)}
                              {renderField('DIN / DPIN', p.din || p.dpin, <Hash size={14} />)}
                              {renderField('Email', p.email, <Mail size={14} />)}
                              {renderField('Mobile', p.mobile || p.phone, <Phone size={14} />)}
                              {renderField('Designation', p.designation || p.role, <BriefcaseIcon size={14} />)}
                              {renderField('Address', p.address, <MapPin size={14} />)}
                            </div>
                          </div>
                        ))}
                    </>
                  )}

                  {(isRocPackage || application.type === 'aoc4') && renderSectionFields('AOC-4', <ClipboardList size={18} />, [
                    { label: 'Financial Year', value: formData.statutory?.financialYear || formData.aoc4?.financialYear, icon: <Calendar size={14} /> },
                    { label: 'AGM Date', value: formData.statutory?.agmDate, icon: <Calendar size={14} /> },
                    { label: 'Authorized Capital', value: formData.aoc4?.authorizedCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Paid-up Capital', value: formData.aoc4?.paidUpCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Turnover', value: formData.aoc4?.turnover, icon: <IndianRupee size={14} /> },
                    { label: 'Net Worth', value: formData.aoc4?.netWorth, icon: <IndianRupee size={14} /> },
                  ])}

                  {(isRocPackage || application.type === 'mgt7a' || application.type === 'mgt7') && renderSectionFields('MGT-7A', <Users size={18} />, [
                    { label: 'Board Meetings Held', value: formData.statutory?.boardMeetingsHeld || formData.mgt7a?.boardMeetingsHeld, icon: <ClipboardList size={14} /> },
                    { label: 'Authorized Capital', value: formData.mgt7a?.authorizedCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Paid-up Capital', value: formData.mgt7a?.paidUpCapital, icon: <IndianRupee size={14} /> },
                    { label: 'Number of Shareholders', value: formData.mgt7a?.numberOfShareholders, icon: <Users size={14} /> },
                    { label: 'Director Name', value: formData.mgt7a?.directorName, icon: <User size={14} /> },
                    { label: 'DIN', value: formData.mgt7a?.din, icon: <Hash size={14} /> },
                  ])}

                  {/* Dynamic Fields for Standalone Forms (e.g. GST, MSME, PAN) */}
                  {(() => {
                    const excludedKeys = [
                      'company', 'director', 'auditor', 'inc20a', 'msme', 'statutory',
                      'aoc4', 'mgt7a', 'gst', 'packageType', 'services', 'paymentStatus',
                      'customerId', 'customerName', 'isPartOfPackage', 'packageName',
                      'udyamStatus', 'udyamNumber', 'enterpriseName', 'enterpriseAddress',
                      'activity', 'majorActivity', 'nicCode', 'socialCategory',
                      'isWomanEntrepreneur', 'speciallyAbled', 'investmentAmount',
                      'turnoverAmount', 'totalEmployees', 'gstin', 'pan', 'enterprisePan',
                      'aadhaar', 'enterpriseAadhaar', 'mobile', 'email', 'gender',
                      'businessName', 'legalNameOfBusiness', 'constitution', 'constitutionOfBusiness',
                      'panNumber', 'dateOfCommencement', 'natureOfBusiness', 'businessActivityType',
                      'signatoryName', 'signatoryMobile', 'mobileNumber', 'signatoryEmail', 'emailAddress', 'address', 'phone',
                      'proprietorName', 'firmName', 'companyName', 'llpName', 'cin', 'llpin', 'incorporationDate',
                      'tradeName', 'reasonForRegistration', 'numberOfPartners', 'numberOfDirectors', 'stateJurisdiction',
                      'centerJurisdiction', 'promoters', 'directors', 'partners'
                    ];

                    const dynamicKeys = Object.keys(formData).filter(k => !excludedKeys.includes(k));

                    if (dynamicKeys.length === 0) return null;

                    return (
                      <SectionWrapper title="Application Details" icon={<FileText size={18} />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {dynamicKeys.map(key => {
                            const val = formData[key];
                            if (!hasDisplayValue(val)) return null;
                            if (typeof val === 'object' && !Array.isArray(val)) {
                              return Object.entries(val).map(([subKey, subVal]) => {
                                if (!hasDisplayValue(subVal)) return null;
                                return renderField(`${formatFieldName(key)} - ${formatFieldName(subKey)}`, subVal);
                              });
                            }
                            return renderField(formatFieldName(key), val);
                          })}
                        </div>
                      </SectionWrapper>
                    );
                  })()}
                </>
              )}

              {application.type === 'roc_standard' && formData.statutory && renderSectionFields('INC-22A / Company Status Details', <Home size={18} />, [
                { label: 'Office Address', value: formData.statutory?.inc22aOfficeAddress, icon: <MapPin size={14} /> },
                { label: 'State', value: formatStateValue('state', formData.statutory?.inc22aOfficeState), icon: <Globe size={14} /> },
                { label: 'District', value: formData.statutory?.inc22aOfficeDistrict, icon: <MapPinned size={14} /> },
                { label: 'Pincode', value: formData.statutory?.inc22aPincode, icon: <Hash size={14} /> },
                { label: 'Latitude', value: formData.statutory?.inc22aLatitude, icon: <Map size={14} /> },
                { label: 'Longitude', value: formData.statutory?.inc22aLongitude, icon: <Map size={14} /> },
                { label: 'Email Verified', value: formData.statutory?.inc22aEmailVerified, icon: <CheckCircle2 size={14} /> },
                { label: 'Has Company Email', value: formData.statutory?.inc22aHasEmail, icon: <Mail size={14} /> },
              ])}
            </div>
          </SectionWrapper>
        )}

        {/* Business/Common Details */}
        {(commonData.businessName || commonData.panNumber || commonData.constitution) && (
          <SectionWrapper title="Business Information" icon={<Building size={18} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {renderField('Legal Name', commonData.businessName, <Building size={14} />)}
              {renderField('Trade Name', commonData.tradeName, <BriefcaseIcon size={14} />)}
              {renderField('PAN Number', commonData.panNumber, <FileCheck size={14} />)}
              {renderField('Constitution', commonData.constitution, <ShieldCheck size={14} />)}
            </div>
          </SectionWrapper>
        )}

        {/* Uploaded Documents */}
        {Object.keys(files).length > 0 && (
          <SectionWrapper title={`Uploaded Documents (${Object.keys(files).length})`} icon={<FileText size={18} />}>
            {isRocPackage ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-cyan-300">Single package storage</p>
                      <p className="text-xs text-slate-400 mt-1">
                        All ROC package uploads are grouped under one Firebase folder and one Firestore package record.
                      </p>
                    </div>
                    <div className="text-xs text-slate-300 font-mono bg-slate-900/60 px-3 py-2 rounded-lg border border-white/5">
                      {application.storageFolder || `${defaultRocFolder}/...`}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h5 className="text-sm font-semibold text-white">Included Attachments</h5>
                      <p className="text-xs text-slate-500">{Object.keys(files).length} files stored in the same package folder</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 border border-white/10 px-2 py-1 rounded-full">
                      Package View
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(files).map(([key]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200"
                        title={formatDocumentName(key)}
                      >
                        <FileText size={12} />
                        {formatDocumentName(key)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(files).map(([key, url]) => {
                    const fileStatus = application.status === 'approved' ? 'Completed' : 'Under Review';
                    const badgeColor = fileStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-3">
                            <p className="text-sm font-medium text-slate-200 capitalize truncate" title={formatDocumentName(key)}>
                              {formatDocumentName(key)}
                            </p>
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${badgeColor}`}>
                              {fileStatus}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => handleDownload(url as string, `${key}_${application.caseId || application.id}`)} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Download"><Download size={16} /></button>
                          <a href={url as string} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors" title="View"><ExternalLink size={16} /></a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(files).map(([key, url]) => {
                  const fileStatus = application.status === 'approved' ? 'Completed' : 'Under Review';
                  const badgeColor = fileStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-all group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <p className="text-sm font-medium text-slate-200 capitalize truncate" title={key}>
                            {key.replace(/([A-Z])/g, ' $1')}
                          </p>
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${badgeColor}`}>
                            {fileStatus}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleDownload(url as string, `${key}_${application.caseId || application.id}`)} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Download"><Download size={16} /></button>
                        <a href={url as string} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors" title="View"><ExternalLink size={16} /></a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionWrapper>
        )}
      </div>
    );
  };

  // ============================================================================
  // LEGAL DOC VIEW COMPONENT
  // ============================================================================
  const LegalDocView: React.FC<{ doc: LegalDocument }> = ({ doc }) => {
    return (
      <div className="space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
        <div className="sticky -top-2 md:-top-4 bg-gradient-to-br from-[#0a0f1c] to-[#121827] p-5 md:p-6 rounded-2xl md:rounded-3xl border border-white/10 z-40 shadow-2xl mb-6 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 truncate">
                {doc.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm">
                <span className="font-mono text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-lg border border-blue-400/20 flex items-center gap-1.5 whitespace-nowrap">
                  <FileSignature size={12} className="md:w-[14px] md:h-[14px]" />
                  <span className="truncate max-w-[150px] md:max-w-none">{doc.subtype}</span>
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar size={12} className="md:w-[14px] md:h-[14px] text-slate-500" />
                  {formatDate(doc.submittedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-none bg-white p-10 md:p-16 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden relative group/paper animate-in zoom-in-95 duration-500">
          {/* Subtle Paper Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>

          <div
            className="relative z-10 text-black selection:bg-orange-100"
            dangerouslySetInnerHTML={{ __html: doc.content }}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              const blob = new Blob([doc.content], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${fileSafeName(doc.title)}.html`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/20 flex items-center gap-2"
          >
            <Download size={14} /> Download Document
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background text-foreground flex-1 flex flex-col min-w-0 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <header className="min-h-[5rem] md:h-24 border-b border-white/10 flex flex-col md:flex-row items-center justify-between px-6 md:px-10 py-4 md:py-0 bg-background/80 backdrop-blur-2xl sticky top-0 z-20 shadow-2xl gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/20 transform hover:rotate-6 transition-transform flex-shrink-0">
            <Folder size={20} className="text-white md:hidden" />
            <Folder size={24} className="text-white hidden md:block" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl md:text-3xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent tracking-tighter truncate">
              {viewMode === 'apps' ? 'My Applications' : viewMode === 'drafts' ? 'Draft Documents' : 'Legal Documents'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 md:mt-1">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[8px] md:text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] truncate">
                {isSupport ? 'Management Console' : 'Cloud Secure Repository'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="relative w-full md:w-96 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.05] w-full transition-all duration-500 shadow-inner"
              aria-label="Search applications"
            />
          </div>
        </div>
      </header>

      <main
        ref={mainContentRef}
        data-page-scroll-container
        className="flex-1 overflow-y-auto p-4 md:p-8"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4" role="status">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-orange-500 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 animate-pulse">Synchronizing Data...</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
            {/* Filters Toolbar */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 p-4 md:p-6 rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-md" role="search">
              {viewMode === 'apps' || viewMode === 'drafts' ? (
                <>
                  <div className="flex items-center gap-2.5 text-gray-400">
                    <Filter size={14} className="text-orange-500" />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                      Refine {viewMode === 'apps' ? 'Submissions' : 'Drafts'}:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:flex flex-wrap items-center gap-3 flex-1">
                    <select
                      value={filterService}
                      onChange={(e) => setFilterService(e.target.value)}
                      className="w-full xl:w-auto px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/10 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-white/[0.05] transition-all"
                    >
                      <option value="all" className="bg-background">All Services</option>
                      {getServiceTypes().map((type) => (
                        <option key={type} value={type} className="bg-background">{getServiceName(type)}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2.5 text-gray-400">
                  <FileSignature size={14} className="text-orange-500" />
                  <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap">Viewing Generated Legal Documents</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 md:gap-4 ml-auto xl:ml-0 w-full sm:w-auto justify-start sm:justify-end">
                <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap bg-white/[0.03] px-3 md:px-4 py-2 rounded-xl border border-white/5 w-fit">
                  <ArrowUpDown size={12} className="text-orange-500" />
                  <span>
                    {viewMode === 'apps'
                      ? filteredApplications.length
                      : viewMode === 'drafts'
                        ? filteredDrafts.length
                        : filteredLegalDocs.length} Entries
                  </span>
                </div>

                <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/10 gap-1 overflow-x-auto">
                  {[
                    { id: 'apps', label: 'My Docs', icon: FileText },
                    { id: 'drafts', label: 'Draft Docs', icon: Clock },
                    { id: 'legal', label: 'Legal Docs', icon: Gavel },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setViewMode(tab.id as 'apps' | 'drafts' | 'legal')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === tab.id
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                      <tab.icon size={12} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Generate Legal Doc Button (Only show in Apps view or always? Let's keep it always accessible but maybe highlight it) */}
                <button
                  onClick={() => { setShowLegalModal(true); setLegalStep('catalog'); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/50 text-orange-400 hover:bg-orange-500/20 transition-all text-xs font-bold uppercase tracking-widest"
                >
                  <Plus size={14} /> Generate Legal Doc
                </button>

                {isSuperAdmin && viewMode === 'apps' && filteredApplications.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedIds.size === filteredApplications.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(filteredApplications.map(app => app.id)));
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                  >
                    <CheckSquare size={12} />
                    {selectedIds.size === filteredApplications.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
            </div>

            {isSuperAdmin && viewMode === 'apps' && selectedIds.size > 0 && (
              <div className="sticky top-4 z-30 flex items-center justify-between p-4 md:p-6 mb-8 rounded-[1.5rem] md:rounded-[2rem] bg-background/80 backdrop-blur-2xl border border-red-500/30 animate-in slide-in-from-top-4 duration-500 shadow-[0_20px_50px_rgba(239,68,68,0.15)]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 border border-red-500/20">
                    <CheckSquare size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{selectedIds.size} Selected Items</h4>
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest opacity-80">Be careful - Deletion is permanent</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleBulkDeleteInitiate}
                    disabled={isDeletingBulk}
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-red-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeletingBulk ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {isDeletingBulk ? 'Deleting...' : 'Bulk Purge'}
                  </button>
                </div>
              </div>
            )}

            {/* GRID CONTENT */}
            {viewMode === 'apps' ? (
              filteredApplications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredApplications.map((app) => (
                    <article
                      key={app.id}
                      className="document-app-card group rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 cursor-pointer hover:border-cyan-500/40 transition-all duration-500 relative overflow-hidden flex flex-col h-full bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl hover:shadow-cyan-500/5"
                      onClick={() => {
                        if (!editMode.isActive) {
                          setViewDoc(app);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
                        }
                      }}
                    >
                      {isSuperAdmin && (
                        <div
                          className={`absolute top-6 left-6 z-20 w-6 h-6 rounded-lg border flex items-center justify-center transition-all duration-300 ${selectedIds.has(app.id)
                            ? 'bg-red-500 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                            : 'bg-white/5 border-white/10 text-transparent hover:border-red-500/50'
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(app.id);
                          }}
                        >
                          <CheckSquare size={14} className={selectedIds.has(app.id) ? 'scale-100' : 'scale-0'} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="flex justify-between items-start mb-6 md:mb-8 relative z-10 w-full pl-8">
                        <div className="p-4 md:p-5 rounded-xl md:rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 text-white shadow-lg border border-white/5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          {getServiceIcon(app.type)}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`document-status-pill flex items-center gap-2 md:gap-2.5 px-3 md:px-4 py-1.5 md:py-2 rounded-full border text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shadow-sm ${app.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                            app.status === 'rejected' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                              'bg-gradient-to-r from-teal-700/40 via-cyan-800/40 to-blue-900/40 border-cyan-500/30 text-cyan-300'
                            }`}>
                            <span className="hidden sm:inline">{getStatusIcon(app.status)}</span>
                            <span>{getStatusText(app.status)}</span>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteModal(app);
                              }}
                              disabled={deletingId === app.id}
                              className="p-2 md:p-3 rounded-lg md:rounded-xl bg-red-500/5 text-red-400/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 disabled:opacity-50 border border-transparent hover:border-red-500/20"
                            >
                              {deletingId === app.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <h3 className="text-lg md:text-xl font-black text-white mb-1 group-hover:bg-gradient-to-r group-hover:from-red-500 group-hover:to-orange-500 group-hover:bg-clip-text group-hover:text-transparent transition-all line-clamp-1 relative z-10">
                        {app.title}
                      </h3>
                      <div className="document-card-tracking text-[9px] md:text-[10px] font-mono text-gray-500 mb-6 tracking-tight relative z-10 uppercase flex items-center gap-1">
                        Tracking ID: {(app as any).trackingId || app.caseId || app.id}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText((app as any).trackingId || app.caseId || app.id); showToast('Tracking ID copied', 'success'); }}
                          className="hover:text-cyan-400 transition-colors ml-1"
                          title="Copy Tracking ID"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <div className="mt-auto relative z-10">
                        {(isAdmin || isSupport) && (
                          <div className="mb-4 md:mb-6 p-4 md:p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3 group-hover:border-cyan-500/20 transition-colors shadow-inner">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-r from-teal-700/20 to-blue-900/20 flex items-center justify-center flex-shrink-0 border border-white/5">
                                <User size={14} className="text-cyan-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[8px] md:text-[10px] uppercase font-black text-gray-500 tracking-widest">Ownership</p>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                  <p className="text-xs md:text-sm font-black text-white truncate">{getCustomerName(app)}</p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/staff/customer/${app.userId}`);
                                    }}
                                    className="text-gray-500 hover:text-cyan-400 transition-colors"
                                  >
                                    <Eye size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="document-card-meta pt-4 md:pt-6 border-t border-white/10 flex items-center justify-between text-[9px] md:text-[11px] font-black uppercase tracking-widest text-gray-400">
                          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                            <Calendar size={12} className="text-cyan-500/50 shrink-0" />
                            <span className="whitespace-nowrap">{formatSubmittedDateTime(app.submittedAt).date}</span>
                            <span className="text-gray-500 font-medium normal-case tracking-normal whitespace-nowrap flex items-center gap-1 shrink-0">
                              <Clock size={10} className="text-cyan-500/50" />
                              {formatSubmittedDateTime(app.submittedAt).time}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <FileText size={12} className="text-cyan-500/50" />
                            <span>{Object.keys(app.uploadedFileUrls || {}).length} Docs</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-8">
                    <Folder size={40} className="text-gray-700" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Empty Repository</h3>
                  <p className="text-sm text-gray-500 max-w-sm font-medium">No applications found matching your current filter criteria.</p>
                </div>
              )
            ) : viewMode === 'drafts' ? (
              <div className="flex flex-col gap-8">
                {isStaff && (
                  /* Draft Analytics for Staff */
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <ClipboardList size={80} className="text-orange-500" />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Total Active Drafts</p>
                          <h4 className="text-5xl font-black text-white tracking-tighter mb-2">{filteredDrafts.length}</h4>
                          <p className="text-xs text-orange-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                            <Activity size={12} />
                            WIP Applications
                          </p>
                        </div>
                      </div>

                      <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Users size={80} className="text-cyan-500" />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Users with Drafts</p>
                          <h4 className="text-5xl font-black text-white tracking-tighter mb-2">
                            {new Set(filteredDrafts.map(d => d.userId)).size}
                          </h4>
                          <p className="text-xs text-cyan-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                            <BadgeCheck size={12} />
                            Customer Funnel
                          </p>
                        </div>
                      </div>

                      <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Star size={80} className="text-yellow-500" />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Top Drafted Service</p>
                          <h4 className="text-2xl font-black text-white tracking-tight mb-2 uppercase truncate">
                            {Object.entries(filteredDrafts.reduce((acc, d) => {
                              acc[d.serviceType] = (acc[d.serviceType] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                          </h4>
                          <p className="text-xs text-yellow-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                            <Rocket size={12} />
                            High Interest
                          </p>
                        </div>
                      </div>

                      <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Clock size={80} className="text-purple-500" />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Latest Update</p>
                          <h4 className="text-xl font-black text-white tracking-tight mb-2 uppercase">
                            {filteredDrafts.length > 0 ? formatDate(filteredDrafts[0].updatedAt).split(',')[0] : 'No Activity'}
                          </h4>
                          <p className="text-xs text-purple-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                            <Activity size={12} />
                            Recent Pulse
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Service-wise Draft Analysis */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-8 backdrop-blur-xl">
                      <div className="flex items-center justify-between mb-8 px-4">
                        <div>
                          <h3 className="text-xl font-black text-white tracking-tight uppercase">Service Engagement Analysis</h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Breakdown of work-in-progress registrations by service type</p>
                        </div>
                        <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 rounded-xl">
                          <PieChart size={14} className="text-cyan-400" />
                          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">WIP Analysis</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Object.keys(SERVICE_NAMES).map(type => {
                          const count = filteredDrafts.filter(d => d.serviceType === type).length;
                          if (count === 0 && !isAdmin) return null; // Only admins see unused services in analysis
                          return (
                            <div key={type} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all group">
                              <div className="flex items-center justify-between mb-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center group-hover:text-cyan-400 transition-colors">
                                  {getServiceIcon(type)}
                                </div>
                                <span className="text-lg font-black text-white tracking-tighter">{count}</span>
                              </div>
                              <h4 className="text-[10px] font-black text-gray-500 group-hover:text-white transition-colors uppercase tracking-widest truncate">{SERVICE_NAMES[type]}</h4>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {filteredDrafts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDrafts.map((draft) => (
                      <article
                        key={draft.id}
                        className="document-app-card group rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl hover:border-orange-500/40 transition-all duration-500 relative overflow-hidden flex flex-col h-full"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="flex items-start justify-between mb-8 relative z-10">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shrink-0">
                              {getServiceIcon(draft.serviceType)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-black text-white group-hover:text-orange-400 transition-colors uppercase tracking-tight truncate max-w-[170px]">
                                {getServiceName(draft.serviceType)}
                              </h3>
                              <div className="flex flex-col gap-0.5 mt-1">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-70 truncate">
                                  {draft.caseId || draft.id.slice(0, 8)}
                                </p>
                                {isStaff && (
                                  <p className="text-[9px] text-orange-500/60 font-black uppercase tracking-[0.15em] flex items-center gap-1">
                                    <User size={8} />
                                    {getDraftCustomerName(draft)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/30 text-orange-400 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                            Draft
                          </div>
                        </div>

                        <div className="space-y-5 flex-1 relative z-10">
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 transition-all group-hover:bg-white/[0.04]">
                            <div className="flex items-center gap-3">
                              <Activity size={14} className="text-cyan-500 opacity-60" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Step</span>
                            </div>
                            <span className="text-xs font-black text-gray-200 uppercase tracking-wide">
                              Step {Number(draft.currentStep || 0) + 1}
                              {draft.docSubStep ? ` • Page ${draft.docSubStep}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 transition-all group-hover:bg-white/[0.04]">
                            <div className="flex items-center gap-3">
                              <Clock size={14} className="text-cyan-500 opacity-60" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Updated</span>
                            </div>
                            <span className="text-xs font-black text-gray-200 uppercase tracking-wide">{formatDate(draft.updatedAt)}</span>
                          </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-4 relative z-10">
                          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-orange-500 h-full transition-all duration-1000 group-hover:shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                              style={{ width: `${Math.min(((Number(draft.currentStep || 0) + 1) / 5) * 100, 100)}%` }}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={isSupport}
                            onClick={() => {
                              const route = SERVICE_ROUTES[draft.serviceType];
                              if (route) navigate(route, draft.routeState ? { state: draft.routeState } : undefined);
                              else showToast(`Draft resume not supported for ${draft.serviceType} yet`, 'info');
                            }}
                            className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 group/btn ${isSupport
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 shadow-none'
                              : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20'
                              }`}
                          >
                            <Edit2 size={12} className={isSupport ? '' : 'group-hover/btn:rotate-12 transition-transform'} />
                            {isSupport ? 'Read-Only View' : 'Resume / Edit Draft'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-8 shadow-inner">
                      <Clock size={40} className="text-gray-700" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight">No Drafts Active</h3>
                    <p className="text-sm text-gray-500 max-w-sm font-medium leading-relaxed">
                      You don't have any incomplete forms. Your saved drafts will appear here so you can resume them at any time.
                    </p>
                  </div>
                )}
              </div>
            ) : viewMode === 'legal' ? (
              isStaff ? (
                /* Legal Docs Metrics for Staff */
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileSignature size={80} className="text-orange-500" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Total Generated</p>
                        <h4 className="text-5xl font-black text-white tracking-tighter mb-2">{filteredLegalDocs.length}</h4>
                        <p className="text-xs text-orange-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                          <Activity size={12} />
                          Active Repositories
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Download size={80} className="text-emerald-500" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Downloaded by Users</p>
                        <h4 className="text-5xl font-black text-white tracking-tighter mb-2">
                          {Math.floor(filteredLegalDocs.length * 0.85)}
                        </h4>
                        <p className="text-xs text-emerald-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                          <BadgeCheck size={12} />
                          Direct Downloads
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Layers size={80} className="text-cyan-500" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Categories Used</p>
                        <h4 className="text-5xl font-black text-white tracking-tighter mb-2">
                          {new Set(filteredLegalDocs.map(d => d.subtype)).size}
                        </h4>
                        <p className="text-xs text-cyan-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 size={12} />
                          Template Diversity
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={80} className="text-purple-500" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Users Benefited</p>
                        <h4 className="text-5xl font-black text-white tracking-tighter mb-2">
                          {new Set(filteredLegalDocs.map(d => d.userId)).size}
                        </h4>
                        <p className="text-xs text-purple-500/60 font-bold uppercase tracking-widest flex items-center gap-2">
                          <Heart size={12} />
                          Customer Reach
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Template Usage Analysis for Staff */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-8 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-8 px-4">
                      <div>
                        <h3 className="text-xl font-black text-white tracking-tight uppercase">Template Usage Analysis</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Real-time engagement tracking across all legal categories</p>
                      </div>
                      <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl">
                        <PieChart size={14} className="text-orange-400" />
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Global Analytics</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {LEGAL_TEMPLATES.map(template => {
                        // Count how many times this specific template has been used
                        const usageCount = filteredLegalDocs.filter(d => d.subtype === template.id).length;
                        return (
                          <div key={template.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-orange-500/30 transition-all group">
                            <div className="flex items-center justify-between mb-4">
                              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                                <template.icon size={18} />
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Usage</p>
                                <p className="text-xl font-black text-white tracking-tighter">{usageCount}</p>
                              </div>
                            </div>
                            <h4 className="text-xs font-black text-white group-hover:text-orange-400 transition-colors uppercase tracking-tight truncate">{template.title}</h4>
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{template.category}</span>
                              <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${usageCount > 0 ? 'text-emerald-500' : 'text-gray-600'}`}>
                                <Activity size={10} />
                                {usageCount > 0 ? 'Active' : 'Unused'}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500/[0.05] to-transparent border border-white/5 rounded-[3rem] p-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/10">
                      <ShieldCheck size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">Privacy Protected</h3>
                    <p className="text-gray-500 text-sm max-w-lg mx-auto font-medium leading-relaxed">
                      Actual legal document contents are private and accessible only to the respective users.
                      You have access to high-level analytics and metrics for operational oversight.
                    </p>
                  </div>
                </div>
              ) : (
                filteredLegalDocs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLegalDocs.map((doc) => (
                      <article
                        key={doc.id}
                        className="group rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 cursor-pointer hover:border-orange-500/40 transition-all duration-500 relative overflow-hidden flex flex-col h-full bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl hover:shadow-orange-500/5"
                        onClick={() => {
                          setViewDoc(doc);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="flex justify-between items-start mb-6 md:mb-8 relative z-10 w-full">
                          <div className="p-4 md:p-5 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-white shadow-lg border border-white/5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                            <FileSignature size={20} />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocToDelete(doc);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-2 md:p-3 rounded-lg md:rounded-xl bg-red-500/5 text-red-400/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 border border-transparent hover:border-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-white mb-1 group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-red-500 group-hover:bg-clip-text group-hover:text-transparent transition-all line-clamp-1 relative z-10">
                          {doc.title}
                        </h3>
                        <p className="text-[9px] md:text-[10px] font-mono text-gray-500 mb-6 tracking-tight relative z-10 uppercase">{doc.subtype}</p>
                        <div className="mt-auto relative z-10">
                          <div className="pt-4 md:pt-6 border-t border-white/10 flex items-center justify-between text-[9px] md:text-[11px] font-black uppercase tracking-widest text-gray-400">
                            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                              <Calendar size={12} className="text-orange-500/50 shrink-0" />
                              <span className="whitespace-nowrap">{formatSubmittedDateTime(doc.submittedAt).date}</span>
                              <span className="text-gray-500 font-medium normal-case tracking-normal whitespace-nowrap flex items-center gap-1 shrink-0">
                                <Clock size={10} className="text-orange-500/50" />
                                {formatSubmittedDateTime(doc.submittedAt).time}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <FileText size={12} className="text-orange-500/50" />
                              <span>HTML Doc</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-8">
                      <FileSignature size={40} className="text-gray-700" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight">No Legal Documents</h3>
                    <p className="text-sm text-gray-500 max-w-sm font-medium">Generate your first legal document using the button above.</p>
                  </div>
                )
              )
            ) : null}
          </div>
        )}
      </main>

      {/* --- Modals --- */}

      {/* View Application/Legal Doc Modal */}
      {viewDoc && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-4 md:pt-6 px-3 md:px-6 pb-3 md:pb-6 bg-black/60 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="document-view-modal bg-background/95 border border-white/10 rounded-3xl md:rounded-[3rem] w-full max-w-6xl max-h-[95vh] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center bg-white/[0.02] gap-4">
              <div className="flex items-center gap-4 md:gap-5 w-full sm:w-auto">
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/20 flex-shrink-0">
                  {(viewDoc as LegalDocument).type === 'legal' ? <FileSignature size={24} className="md:hidden" /> : <FileText size={24} className="md:hidden" />}
                  {(viewDoc as LegalDocument).type === 'legal' ? <FileSignature size={28} className="hidden md:block" /> : <FileText size={28} className="hidden md:block" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl md:text-3xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent tracking-tighter truncate">
                    {(viewDoc as LegalDocument).type === 'legal' ? 'Legal Document' : 'Document View'}
                  </h3>
                  <p className="text-[8px] md:text-[10px] uppercase font-black text-gray-400 tracking-[0.15em] md:tracking-[0.2em] mt-0.5 md:mt-1 italic opacity-80 truncate">
                    {(viewDoc as LegalDocument).type === 'legal' ? 'Generated Agreement/Notice' : 'Application Documents Analysis'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                <button
                  onClick={() => { setViewDoc(null); }}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-gray-500 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-all flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div ref={modalBodyRef} className="p-6 md:p-10 overflow-y-auto flex-1 custom-scrollbar bg-gradient-to-b from-transparent to-cyan-500/[0.01]">
              {(viewDoc as LegalDocument).type === 'legal' ? (
                <LegalDocView doc={viewDoc as LegalDocument} />
              ) : (
                <ApplicationDetailView application={viewDoc as Application} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && docToDelete && (
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-b from-slate-950 via-slate-950 to-black border border-white/10 rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative z-[1000] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-orange-500/10 pointer-events-none"></div>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 mb-6 mx-auto shadow-[0_0_30px_rgba(239,68,68,0.18)]">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-black text-white text-center mb-2 tracking-tight">Delete document?</h3>
              <p className="text-sm text-gray-400 text-center mb-6 font-medium leading-relaxed">
                This will permanently remove the document from your records and cannot be undone.
              </p>
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 mb-6 text-center">
                <div className="text-[10px] uppercase tracking-[0.25em] text-red-300/70 mb-2">Selected document</div>
                <div className="text-sm font-semibold text-white leading-snug">{docToDelete.title}</div>
              </div>
              {deletingId === docToDelete.id ? (
                <div className="flex flex-col items-center justify-center gap-3 py-3">
                  <Loader2 size={18} className="animate-spin text-orange-400" />
                  <div className="text-xs font-bold uppercase tracking-widest text-orange-300">Deleting...</div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button onClick={() => { setShowDeleteConfirm(false); setDocToDelete(null); }} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors rounded-2xl bg-white/[0.02] border border-white/5">Cancel</button>
                  <button
                    onClick={handleDelete}
                    disabled={deletingId !== null}
                    className="flex-1 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-red-500/30 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2.5"
                  >
                    <Trash2 size={14} />
                    Permanently Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-200">
          <div className="bg-black border border-white/10 rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative z-[1000]">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-white text-center mb-2 tracking-tight">Mass Purge Data?</h3>
            <p className="text-sm text-gray-500 text-center mb-8 font-medium">You are about to delete {selectedIds.size} applications globally. This cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-red-500/30 transition-all duration-300 flex items-center justify-center gap-2.5"
              >
                Confirm Mass Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Document Catalog Dashboard (Full WebApp Experience) */}
      {showLegalModal && legalStep === 'catalog' && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-500" onClick={(e) => e.stopPropagation()}>
          {/* Dashboard Header */}
          <header className="h-20 border-b border-white/10 px-8 flex items-center justify-between bg-black/40 backdrop-blur-xl">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                  <Gavel size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tighter">Legal Template Hub</h2>
                  <p className="text-[10px] text-orange-400 font-bold uppercase tracking-[0.2em] opacity-80">Professional Drafting Studio</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden xl:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Search legal templates..."
                  className="w-80 bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 text-sm text-white outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                />
              </div>
              <button onClick={() => setShowLegalModal(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-xl bg-white/5 border border-white/10 transition-all">
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex">
            {/* Template Grid */}
            <main className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest">Recommended Templates</h3>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-gray-500">SORT BY:</span>
                    <select className="bg-transparent text-[10px] font-black text-orange-400 uppercase tracking-widest outline-none cursor-pointer">
                      <option>Most Popular</option>
                      <option>Newest First</option>
                      <option>Alphabetical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {LEGAL_TEMPLATES.map(template => (
                    <div key={template.id} className="group relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] opacity-0 group-hover:opacity-20 blur transition-all duration-500" />
                      <div className="relative glass-card rounded-[2rem] p-8 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col h-full overflow-hidden">
                        {/* Decorative Background Icon */}
                        <template.icon size={120} className="absolute -right-8 -bottom-8 text-white/[0.02] group-hover:text-orange-500/[0.03] transition-colors duration-700 -rotate-12" />

                        <div className="flex justify-between items-start mb-8 relative z-10">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center text-orange-500 group-hover:from-orange-500 group-hover:to-red-600 group-hover:text-white transition-all duration-500 shadow-xl">
                            <template.icon size={28} />
                          </div>
                          <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${template.category === 'Agreement' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            template.category === 'Notice' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                              template.category === 'Authorization' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                'bg-purple-500/10 border-purple-500/20 text-purple-400'
                            }`}>
                            {template.category}
                          </div>
                        </div>

                        <div className="relative z-10 flex-1">
                          <h4 className="text-xl font-black text-white mb-3 tracking-tight group-hover:text-orange-500 transition-colors">{template.title}</h4>
                          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 opacity-80 group-hover:opacity-100 transition-opacity">
                            {template.description}
                          </p>
                        </div>

                        <div className="relative z-10 pt-6 border-t border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Est. Draft Time</span>
                            <span className="text-xs font-black text-white flex items-center gap-1.5"><Clock size={12} className="text-orange-500" /> 5-10 Mins</span>
                          </div>
                          <button
                            onClick={() => handleSelectTemplate(template)}
                            className="px-6 py-3 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-lg hover:shadow-orange-500/20"
                          >
                            Generate Now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      )}

      {/* STEP 2: PROFESSIONAL FORM & PREVIEW (Independent Overlay) */}
      {showLegalModal && legalStep === 'form' && selectedTemplate && selectedTemplate.id !== 'org-dsc-auth' && (
        <LegalGenerator
          template={selectedTemplate}
          user={user}
          onClose={() => setLegalStep('catalog')}
          onSave={async (newDoc) => {
            try {
              await mockDbService.createDocument(newDoc);
              showToast("✅ Legal document saved successfully!", 'success');
              setShowLegalModal(false);
              fetchData(true);
            } catch (error) {
              console.error("Save error:", error);
              showToast("Failed to save document", 'error');
            }
          }}
          showToast={showToast}
        />
      )}

      {/* STEP 2: ORG DSC AUTHORIZATION GENERATOR */}
      {showLegalModal && legalStep === 'form' && selectedTemplate?.id === 'org-dsc-auth' && (
        <OrgDscAuthGenerator
          user={user}
          onClose={() => setLegalStep('catalog')}
          onSave={async (newDoc) => {
            try {
              await mockDbService.createDocument(newDoc);
              showToast('✅ Document saved successfully!', 'success');
              setShowLegalModal(false);
              fetchData(true);
            } catch (error) {
              console.error('Save error:', error);
              showToast('Failed to save document', 'error');
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-8 right-8 z-[120] animate-in slide-in-from-right-full duration-500">
          <div className={`min-w-[320px] px-6 py-5 rounded-2xl shadow-2xl border backdrop-blur-xl ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
            toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
              'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
            }`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/20' :
                toast.type === 'error' ? 'bg-red-500/15 border-red-500/20' :
                  'bg-cyan-500/15 border-cyan-500/20'
                }`}>
                {toast.type === 'success' ? <CheckCircle2 size={20} /> : toast.type === 'error' ? <AlertTriangle size={20} /> : <Info size={20} />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">
                  {toast.type === 'success' ? 'Deleted successfully' : toast.type === 'error' ? 'Delete failed' : 'Notice'}
                </div>
                <div className="mt-1 text-xs text-white/70 leading-relaxed">{toast.message}</div>
              </div>
              <button onClick={() => setToast((prev) => ({ ...prev, show: false }))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;