import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, storage } from './firebase';
import { doc, setDoc, getDoc, runTransaction, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { generateServiceId } from '../utils/helpers';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import { useRazorpay } from '../hooks/useRazorpay';
import { calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from './razorpayService';
import FormBackButton from '../components/FormBackButton';
import { buildInitialApplicationStatus } from './applicationStatus';



// ─── Government DSC Data ─────────────────────────────────────
export const DSC_CATEGORIES = {
  class3_individual: {
    label: 'Class 3 — Individual',
    desc: 'For individuals signing on GST, Income Tax, MCA, FSSAI.',
    type: 'individual',
    requiredFields: ['applicantName', 'fatherName', 'dob', 'gender', 'pan', 'aadhaar', 'email', 'mobile', 'designation', 'purpose'],
    requiredDocs: {
      masterData: { label: 'Master Data Sheet', required: true },
      identityProof: { label: 'Identity Proof (Aadhaar / Passport / Voter ID)', required: true },
      panCard: { label: 'PAN Card of Applicant', required: true },
      photo: { label: 'Recent Passport-size Photo', required: true },
    },
    govPortals: ['GST Portal', 'MCA21', 'Income Tax', 'FSSAI'],
    validity: '2 Years',
    videoKyc: true,
    notes: 'Aadhaar must be linked with mobile for OTP-based Video KYC verification.',
  },
  class3_organisation: {
    label: 'Class 3 — Organisation',
    desc: 'For authorised representatives of companies, LLPs, partnerships.',
    type: 'organisation',
    requiredFields: ['applicantName', 'fatherName', 'dob', 'gender', 'pan', 'aadhaar', 'email', 'mobile', 'designation', 'purpose', 'organisationName', 'organisationPan', 'cin', 'purpose'],
    requiredDocs: {
      masterData: { label: 'Master Data Sheet', required: true },
      photo: { label: 'Authorized Person Photo', required: true },
      identityProof: { label: 'Authorized Person (Pancard / voter ID / Adhaar card )', required: true },
      organisationPanDoc: { label: 'company pan card', required: true },
      incorporationCert: { label: 'Company COI', required: true },
      authorizationLetter: { label: 'authorised person Board resoution document', required: true },
      gstCert: { label: 'GST no if available', required: false },
    },
    govPortals: ['MCA21 / ROC', 'GST Portal', 'e-Tendering', 'GeM Portal'],
    validity: '2 Years',
    videoKyc: true,
    notes: 'Authorization letter must be on official letterhead, signed by a Director/MD.',
  },
  dgft: {
    label: 'DGFT DSC',
    desc: 'Specifically issued for DGFT portal — import/export licence applications.',
    type: 'organisation',
    requiredFields: ['applicantName', 'fatherName', 'dob', 'gender', 'pan', 'aadhaar', 'email', 'mobile', 'designation', 'purpose', 'organisationName', 'organisationPan', 'iec', 'purpose'],
    requiredDocs: {
      masterData: { label: 'Master Data Sheet', required: true },
      photo: { label: 'Authorized Person Photo', required: true },
      identityProof: { label: 'Authorized Person (Pancard / voter ID / Adhaar card )', required: true },
      organisationPanDoc: { label: 'company pan card', required: true },
      incorporationCert: { label: 'Company COI', required: true },
      authorizationLetter: { label: 'authorised person Board resoution document', required: true },
      iecCert: { label: 'IEC (Import Export Code) Certificate', required: true },
    },
    govPortals: ['DGFT Portal', 'EXIM applications', 'Advance Authorisation'],
    validity: '2 Years',
    videoKyc: true,
    notes: 'DGFT DSC is accepted ONLY on DGFT portal.',
  },
};

const DSC_PROVIDERS = [
  {
    id: 'emudhra',
    name: 'eMudhra',
    logo: 'eMudhra',
    desc: 'Fastest issuance, widely accepted across all government portals',
    color: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'vsign',
    name: 'V-Sign',
    logo: 'V-Sign',
    desc: 'Cost-effective solution with reliable customer support',
    color: 'from-blue-500 to-indigo-600'
  },
];

// ─── UPDATED PRICING CONFIGURATION ──────────────
const PRICING_CONFIG = {
  emudhra: {
    individual: {
      1: 1350, 2: 1500, 3: 2250,
      bothAddon: 650
    },
    organisation: {
      1: 2000, 2: 2250, 3: 3350,
      bothAddon: 650
    },
    dgft: {
      1: 1800, 2: 2000, 3: 2000,
      bothAddon: 0
    }
  },
  vsign: {
    individual: {
      1: 1350, 2: 1500, 3: 2250,
      bothAddon: 650
    },
    organisation: {
      1: 2000, 2: 2250, 3: 3350,
      bothAddon: 650
    },
    dgft: {
      1: 1800, 2: 2000, 3: 2000,
      bothAddon: 0
    }
  }
};

const entityTypeOptions = [
  { value: 'individual', label: 'Individual / Sole Proprietor' },
  { value: 'pvt_ltd', label: 'Private Limited Company' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
  { value: 'partnership', label: 'Registered Partnership Firm' },
];

const purposeOptions = [
  { value: 'gst', label: 'GST Registration / Return Filing' },
  { value: 'income_tax', label: 'Income Tax Returns / e-Filing' },
  { value: 'mca', label: 'MCA21 / Company Incorporation / ROC Filing' },
  { value: 'fssai', label: 'FSSAI License Application' },
  { value: 'startup_india', label: 'Startup India / DPIIT Recognition' },
  { value: 'dgft', label: 'DGFT / Import-Export Licence' },
  { value: 'etendering', label: 'e-Tendering / GeM Portal' },
  { value: 'epfo', label: 'EPFO / ESI / PF Filing' },
  { value: 'customs', label: 'Customs / ICEGATE' },
  { value: 'multiple', label: 'Multiple Purposes' },
];

const designationOptions = [
  { value: 'director', label: 'Director' },
  { value: 'md', label: 'Managing Director / CEO' },
  { value: 'partner', label: 'Partner' },
  { value: 'proprietor', label: 'Proprietor / Owner' },
  { value: 'authorized_signatory', label: 'Authorised Signatory' },
  { value: 'ca', label: 'Chartered Accountant' },
  { value: 'individual', label: 'Individual (Self)' },
  { value: 'govt_officer', label: 'Government Officer' },
];

const stateOptions = [
  { value: 'AP', label: 'Andhra Pradesh' }, { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' }, { value: 'BR', label: 'Bihar' },
  { value: 'CT', label: 'Chhattisgarh' }, { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' }, { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' }, { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' }, { value: 'KL', label: 'Kerala' },
  { value: 'MP', label: 'Madhya Pradesh' }, { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' }, { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' }, { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' }, { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' }, { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' }, { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' }, { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' }, { value: 'WB', label: 'West Bengal' },
  { value: 'AN', label: 'Andaman & Nicobar' }, { value: 'CH', label: 'Chandigarh' },
  { value: 'DL', label: 'Delhi' }, { value: 'JK', label: 'Jammu & Kashmir' },
  { value: 'LA', label: 'Ladakh' }, { value: 'LD', label: 'Lakshadweep' },
  { value: 'PY', label: 'Puducherry' },
];

const validators = {
  pan: (v: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) || 'Invalid PAN format (ABCDE1234F)',
  aadhaar: (v: string) => !v || /^\d{12}$/.test(v) || 'Aadhaar must be 12 digits',
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email address',
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v) || 'Invalid mobile (10 digits, starts 6-9)',
  zip: (v: string) => /^\d{6}$/.test(v) || 'Pincode must be 6 digits',
  cin: (v: string) => !v || /^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(v) || 'Invalid CIN format',
  iec: (v: string) => !v || /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(v) || 'Invalid IEC format',
  required: (v: string) => v.trim().length > 0 || 'This field is required',
};

interface FormData {
  dscType: string;
  applicantName: string;
  fatherName: string;
  dob: string;
  gender: string;
  pan: string;
  aadhaar: string;
  email: string;
  mobile: string;
  altMobile: string;
  designation: string;
  entityType: string;
  purpose: string;
  organisationName: string;
  organisationPan: string;
  cin: string;
  llpin: string;
  iec: string;
  gstin: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  authorizeFiling: boolean;
  declareCorrect: boolean;
}

const initialData: FormData = {
  dscType: '', applicantName: '', fatherName: '', dob: '', gender: '',
  pan: '', aadhaar: '', email: '', mobile: '', altMobile: '',
  designation: '', entityType: '', purpose: '',
  organisationName: '', organisationPan: '', cin: '', llpin: '', iec: '', gstin: '',
  address1: '', address2: '', city: '', state: '', zip: '',
  authorizeFiling: false, declareCorrect: false,
};

// ─── UI Components ────────────────────────────────────────────

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-slate-500 hover:text-orange-400 transition-colors focus:outline-none">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {show && (
        <div className="absolute left-full top-0 ml-2 w-72 p-3 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg shadow-xl z-50">
          {text}
          <div className="absolute left-0 top-3 -ml-1 w-2 h-2 bg-slate-800 border-l border-b border-slate-700 transform rotate-45" />
        </div>
      )}
    </div>
  );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; error?: string; hint?: string; optional?: boolean; infoText?: string;
}
const FormInput: React.FC<FormInputProps> = ({ label, error, hint, optional, infoText, id, required, ...props }) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white">
            {label} {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <input id={inputId}
        className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all focus:ring-2 focus:outline-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
        required={required} {...props}
      />
      {error ? <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {error}</p>
        : hint ? <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p> : null}
    </div>
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string; options: { value: string; label: string }[];
  error?: string; optional?: boolean; infoText?: string;
}
const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, optional, infoText, id, required, value, ...props }) => {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={selectId} className="block text-sm font-medium text-white">
            {label} {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select id={selectId} value={value}
          className={`w-full bg-slate-800/50 border text-sm rounded-lg block p-3 pr-10 appearance-none shadow-sm transition-all focus:ring-2 focus:outline-none cursor-pointer ${!value ? 'text-slate-500' : 'text-white'} ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
          required={required} {...props}>
          <option value="" disabled>Select an option</option>
          {options.map(o => <option key={o.value} value={o.value} className="text-slate-900 bg-slate-100">{o.label}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {error}</p>}
    </div>
  );
};

const FileUploader: React.FC<{
  label: string; name: string; required?: boolean; optional?: boolean;
  uploadedFile: File | null; onChange: (f: File | null) => void; infoText?: string;
  accept?: string; hint?: string; onError?: (msg: string) => void;
}> = ({ label, name, required, optional, uploadedFile, onChange, infoText, accept = '.pdf,.jpg,.jpeg,.png', hint, onError }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const process = (f: File | null) => {
    if (!f) { onChange(null); return; }
    if (f.size > 2 * 1024 * 1024) {
      if (onError) onError('File must be under 2MB');
      return;
    }
    onChange(f);
  };
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label className={`block text-sm font-medium ${optional && !required ? 'text-slate-500' : 'text-white'}`}>
            {label} {required && <span className="text-red-500">*</span>}
            {optional && !required && <span className="text-xs text-slate-600 ml-2">(Not Required)</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files?.[0] || null); }}
        className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragging ? 'border-cyan-500 bg-cyan-500/10'
          : uploadedFile ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}>
        <input ref={inputRef} type="file" name={name} accept={accept} className="hidden"
          onChange={e => process(e.target.files?.[0] || null)} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 ${uploadedFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
            {uploadedFile
              ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
          </div>
          <div className="flex-1 min-w-0">
            {uploadedFile ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{uploadedFile.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">Ready for upload</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-300">Click or drag to upload</p>
                <p className="text-xs text-slate-500 mt-0.5">{hint || 'PDF, JPG, PNG — Max 2MB'}</p>
              </div>
            )}
          </div>
          {uploadedFile && (
            <button type="button" onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
              className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Progress Sidebar ─────────────────────────────────────────
interface ProgressSidebarProps {
  currentStep: number;
  uploadedFiles: Record<string, File | null>;
  dscType: string;
  isOrg: boolean;
  paymentStatus: string;
  basePrice: number;
  gstAmount: number;
  totalAmount: number;
}

const ProgressSidebar: React.FC<ProgressSidebarProps> = ({
  currentStep,
  uploadedFiles,
  dscType,
  isOrg,
  paymentStatus,
  basePrice,
  gstAmount,
  totalAmount
}) => {
  const steps = [
    { label: 'DSC Category', step: 0 },
    { label: 'Plan & Pay', step: 1 },
    { label: 'Personal Details', step: 2 },
    { label: 'Organisation', step: 3 },
    { label: 'Address', step: 4 },
    { label: 'Documents', step: 5 },
  ];

  const catData = DSC_CATEGORIES[dscType as keyof typeof DSC_CATEGORIES];
  const reqDocs = catData?.requiredDocs || {};
  const uploadedCount = Object.keys(reqDocs).filter(k => (reqDocs as any)[k].required && uploadedFiles[k]).length;
  const totalRequired = Object.keys(reqDocs).filter(k => (reqDocs as any)[k].required).length;

  return (
    <div className="space-y-6 hidden lg:block">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
        <h3 className="text-white text-sm font-bold mb-5 flex items-center gap-2">
          <div className="w-2 h-5 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full" />
          Application Progress
        </h3>
        <div className="relative border-l-2 border-white/5 ml-2 space-y-6 my-2">
          {steps.map(({ label, step }) => {
            const status = step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending';
            if (step === 3 && !isOrg) return null;

            return (
              <div key={step} className="ml-6 relative">
                <div className={`absolute -left-[33px] w-4 h-4 rounded-full border-2 border-slate-900 transition-all duration-500 flex items-center justify-center ${status === 'completed' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : status === 'active' ? 'bg-cyan-500 ring-4 ring-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-110'
                    : 'bg-slate-800'}`}>
                  {status === 'completed' && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</h4>
                <div className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-md inline-block ${status === 'active' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800/50 text-slate-600'}`}>
                  {step === 5 ? `${uploadedCount}/${totalRequired} Documents`
                    : status === 'completed' ? 'Completed' : status === 'active' ? 'Current Step' : 'Upcoming'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {catData && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
          <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
            <div className="w-2 h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
            {catData.label}
          </h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">{catData.desc}</p>
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Acceptance</p>
            <div className="flex flex-wrap gap-2">
              {catData.govPortals.map(p => (
                <div key={p} className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-lg border border-white/5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-300 font-medium">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {paymentStatus !== 'success' && basePrice > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group transition-all duration-300 hover:border-white/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
          <h3 className="text-white text-sm font-bold mb-5 flex items-center gap-2">
            <div className="w-2 h-5 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
            Order Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Base Fee</span>
              <span className="text-white font-semibold">₹{basePrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">GST (18%)</span>
              <span className="text-white font-semibold">₹{gstAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm font-bold text-white">Total Payable</span>
              <span className="text-2xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-4 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                * GST charges are calculated as per prevailing government regulations (18%).
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-5 shadow-2xl transition-all duration-500 ${paymentStatus === 'success' ? 'border-emerald-500/30' : 'border-white/10'}`}>
        <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
          <div className={`w-2 h-5 rounded-full ${paymentStatus === 'success' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          Payment Status
        </h3>
        {paymentStatus === 'success' ? (
          <div className="flex items-center gap-2.5 text-emerald-400 text-sm font-bold bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            Paid & Verified
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-slate-400 text-sm font-medium bg-slate-800/40 p-3 rounded-xl border border-white/5">
            <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
            Pending Payment
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Partnership Header ──────────────────────────────────────
const PartnershipHeader = () => (
  <div className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 mb-8 sticky top-0 z-40 shadow-lg">
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-6 opacity-80">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Official Partner</span>
          <div className="h-px w-8 bg-slate-700"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-8 px-3 bg-gradient-to-r from-heading-from to-heading-to rounded flex items-center justify-center text-xs font-bold text-white border border-white/20 shadow-lg shadow-red-500/20">eMudhra</div>
          <div className="h-8 px-3 bg-gradient-to-r from-heading-from to-heading-to rounded flex items-center justify-center text-xs font-bold text-white border border-white/20 shadow-lg shadow-red-500/20">V-Sign</div>
        </div>
      </div>
    </div>
  </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────
interface DSCFormProps {
  user: {
    uid: string;
    email?: string;
    displayName?: string;
    phoneNumber?: string;
  };
  packageMode?: boolean;
  onComplete?: (data: any) => void;
  onBack?: () => void;
  initialData?: any;
  existingDocs?: any;
}

export default function DSCRegistrationForm({ user, packageMode, onComplete, onBack, initialData: propsInitialData, existingDocs }: DSCFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as any);
  const preselectedType = navState?.dscType as string | undefined;
  const entityType = navState?.entityType as 'individual' | 'organization' | undefined || 'individual';

  const [isOrganization, setIsOrganization] = useState(entityType === 'organization');

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({ ...initialData, dscType: preselectedType || '' });
  const [selectedPlanYears, setSelectedPlanYears] = useState<number>(1);
  const [selectedUsageType, setSelectedUsageType] = useState<string>('sign');

  const selectedProvider = 'emudhra';

  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success'>('pending');

  const [paymentResponse, setPaymentResponse] = useState<RazorpaySuccessResponse | null>(null);

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [captcha, setCaptcha] = useState({ val1: 0, val2: 0, userAnswer: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [caseId, setCaseId] = useState<string>('');

  const [modalState, setModalState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; title: string; message: string }>({
    show: false, title: 'Alert', message: ''
  });

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    masterData: null, identityProof: null, panCard: null, photo: null,
    organisationPanDoc: null, authorizationLetter: null, incorporationCert: null,
    gstCert: null, iecCert: null,
  });

  const showAlert = useCallback((title: string, message: string) => {
    setAlertConfig({ show: true, title, message });
  }, []);

  const { displayRazorpay } = useRazorpay();
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const generateCaptcha = useCallback(() => {
    setCaptcha({ val1: Math.floor(Math.random() * 10) + 1, val2: Math.floor(Math.random() * 10) + 1, userAnswer: '' });
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      if (!user?.uid) {
        setIsInitialLoading(false);
        return;
      }
      try {
        const draftRef = doc(db, 'drafts', `dsc_${user.uid}`);
        const draftSnap = await getDoc(draftRef);
        if (draftSnap.exists()) {
          const draftData = draftSnap.data();
          setFormData(p => ({ ...p, ...draftData.formData }));
          setCurrentStep(draftData.currentStep || 0);
          setSelectedPlanYears(draftData.selectedPlanYears || 1);
          setSelectedUsageType(draftData.selectedUsageType || 'sign');
          setPaymentStatus(draftData.paymentStatus || 'pending');
          setCaseId(draftData.caseId || '');
          setLastDraftSavedAt(draftData.updatedAt?.toDate() || new Date());
        }
      } catch (err) {
        console.error("Error loading DSC draft:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadDraft();
  }, [user?.uid]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (modalState === 'success' || isExiting) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      if (modalState === 'success' || isExiting) return;
      window.history.pushState(null, '', window.location.href);
      setShowExitConfirm(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [modalState, isExiting]);

  useEffect(() => { generateCaptcha(); }, [generateCaptcha]);

  // Remove auto-submit after payment - redirected to Step 2 instead

  const catData = DSC_CATEGORIES[formData.dscType as keyof typeof DSC_CATEGORIES];
  const isOrg = isOrganization || catData?.type === 'organisation';
  const isDGFT = formData.dscType === 'dgft';

  const getPricingDetails = () => {
    if (!formData.dscType || !selectedProvider) return { basePrice: 0, gstAmount: 0, totalAmount: 0 };

    const catData = DSC_CATEGORIES[formData.dscType as keyof typeof DSC_CATEGORIES];
    if (!catData) return { basePrice: 0, gstAmount: 0, totalAmount: 0 };

    let priceCategory = catData.type;
    if (formData.dscType === 'dgft') priceCategory = 'dgft';

    const providerPricing = PRICING_CONFIG[selectedProvider as keyof typeof PRICING_CONFIG];
    const categoryPricing = providerPricing[priceCategory as keyof typeof providerPricing];

    let currentBasePrice = categoryPricing ? categoryPricing[selectedPlanYears] : 0;

    if (selectedUsageType === 'both' && categoryPricing?.bothAddon) {
      currentBasePrice += categoryPricing.bothAddon;
    }

    const gstAmount = calculateGST(currentBasePrice);
    const totalAmount = calculateTotalWithGST(currentBasePrice);

    return {
      basePrice: currentBasePrice,
      gstAmount,
      totalAmount
    };
  };

  const { basePrice, totalAmount, gstAmount } = getPricingDetails();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const k = name as keyof FormData;
    let v = value;
    if (k === 'pan' || k === 'organisationPan') v = value.toUpperCase().slice(0, 10);
    if (k === 'cin') v = value.toUpperCase().slice(0, 21);
    if (k === 'iec') v = value.toUpperCase().slice(0, 10);
    if (k === 'gstin') v = value.toUpperCase().slice(0, 15);
    if (k === 'aadhaar') v = value.replace(/\D/g, '').slice(0, 12);
    if (k === 'mobile' || k === 'altMobile') v = value.replace(/\D/g, '').slice(0, 10);
    if (k === 'zip') v = value.replace(/\D/g, '').slice(0, 6);
    setFormData(p => ({ ...p, [k]: v }));
    if (touched[k]) setErrors(p => ({ ...p, [k]: validateField(k, v) }));
  };

  const handleCheckbox = (k: keyof FormData) => {
    setFormData(p => ({ ...p, [k]: !(p[k] as boolean) }));
  };

  const validateField = (name: keyof FormData, value: string): string => {
    switch (name) {
      case 'applicantName': case 'dob': case 'gender': case 'designation':
      case 'entityType': case 'purpose': case 'address1': case 'state': case 'city':
        return validators.required(value) === true ? '' : validators.required(value) as string;
      case 'pan': return validators.pan(value) === true ? '' : validators.pan(value) as string;
      case 'organisationPan': return value ? (validators.pan(value) === true ? '' : validators.pan(value) as string) : '';
      case 'aadhaar': return validators.aadhaar(value) === true ? '' : validators.aadhaar(value) as string;
      case 'email': return validators.email(value) === true ? '' : validators.email(value) as string;
      case 'mobile': return validators.mobile(value) === true ? '' : validators.mobile(value) as string;
      case 'zip': return validators.zip(value) === true ? '' : validators.zip(value) as string;
      case 'cin': return validators.cin(value) === true ? '' : validators.cin(value) as string;
      case 'iec': return validators.iec(value) === true ? '' : validators.iec(value) as string;
      default: return '';
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const k = name as keyof FormData;
    setTouched(p => ({ ...p, [k]: true }));
    setErrors(p => ({ ...p, [k]: validateField(k, value) }));
  };

  const validateStep = (step: number): boolean => {
    const checks: Partial<Record<keyof FormData, string>> = {};
    const r = (k: keyof FormData) => {
      const err = validateField(k, String(formData[k]));
      if (err) checks[k] = err;
    };

    if (step === 0 && !formData.dscType) {
      showAlert('Selection Required', 'Please select a DSC category to continue.');
      return false;
    }
    if (step === 1 && !selectedPlanYears) {
      showAlert('Plan Required', 'Please select a validity plan.');
      return false;
    }
    if (step === 1 && !selectedUsageType) {
      showAlert('Usage Type Required', 'Please select how you will use the certificate.');
      return false;
    }

    if (step === 2) {
      ['applicantName', 'dob', 'designation', 'entityType', 'purpose', 'email', 'mobile'].forEach(k => r(k as keyof FormData));
      r('pan');
      if (formData.aadhaar) r('aadhaar');
    }

    if (step === 3 && isOrg) {
      if (!formData.organisationName.trim()) checks.organisationName = 'Organisation name is required';
      if (isDGFT && !formData.iec.trim()) checks.iec = 'IEC is required for DGFT DSC';
    }

    if (step === 4) {
      ['address1', 'state', 'city'].forEach(k => r(k as keyof FormData));
      r('zip');
    }

    setErrors(p => ({ ...p, ...checks }));
    setTouched(p => {
      const t = { ...p };
      Object.keys(checks).forEach(k => (t[k as keyof FormData] = true));
      return t;
    });
    return Object.keys(checks).length === 0;
  };

  const handleRazorpayPayment = async () => {
    setModalState('processing');
    setPaymentStatus('processing');
    const planLabel = `${selectedPlanYears} Year${selectedPlanYears > 1 ? 's' : ''} Plan`;

    const started = await displayRazorpay(totalAmount, (response) => {
      handlePaymentSuccess(response);
    }, {
      description: `Service Fee: ₹${basePrice} + GST (18%): ₹${gstAmount} = Total: ₹${totalAmount}`,
      prefill: {
        name: formData.applicantName || 'Applicant',
        email: formData.email || '',
        contact: formData.mobile || ''
      },
      onClosed: () => {
        setPaymentStatus('pending');
        setModalState('idle');
      }
    });

    if (!started) {
      showAlert('Payment Error', "Failed to initiate payment. Please try again.");
      setModalState('idle');
      setPaymentStatus('pending');
    }
  };

  const handleNext = async () => {
    const isValid = validateStep(currentStep);
    if (!isValid) {
      showAlert('Validation Error', 'Please fill all required fields correctly.');
      return;
    }
    if (currentStep === 1) {
      if (packageMode) {
        setPaymentStatus('success');
        const nextStep = !isOrg ? 4 : 2;
        setCurrentStep(nextStep);
        await saveDraft(nextStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      handleRazorpayPayment();
      return;
    }
    const nextStep = (currentStep === 2 && !isOrg) ? 4 : currentStep + 1;
    setCurrentStep(nextStep);
    await saveDraft(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (currentStep === 0) { navigate('/services/dsc-registration'); return; }
    if (currentStep === 2 && !isOrg) { setCurrentStep(0); }
    else if (currentStep === 4 && !isOrg) { setCurrentStep(2); }
    else { setCurrentStep(p => p - 1); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid) return;
    setIsDraftSaving(true);
    try {
      const draftData = {
        userId: user.uid,
        userEmail: user.email || '',
        userMobile: formData.mobile || '',
        serviceType: 'dsc',
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        selectedPlanYears,
        selectedUsageType,
        paymentStatus,
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: caseId || `DSC-${new Date().getFullYear()}-DRAFT`,
      };
      await setDoc(doc(db, 'drafts', `dsc_${user.uid}`), draftData, { merge: true });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error("Draft save failed:", err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave) {
      setIsDraftSaving(true);
      try {
        await saveDraft();
        setShowDraftSuccessModal(true);
        setTimeout(() => {
          setShowDraftSuccessModal(false);
          setIsExiting(true);
          navigate('/services/dsc-registration');
        }, 1500);
      } catch (err) {
        console.error("Exit save failed:", err);
        setShowExitConfirm(false);
      } finally {
        setIsDraftSaving(false);
      }
    } else {
      setIsExiting(true);
      navigate('/services/dsc-registration');
    }
  };

  const handlePaymentSuccess = (response: RazorpaySuccessResponse) => {
    setPaymentInfo(response);
    setPaymentResponse(response);
    setPaymentStatus('success');
    setModalState('idle');
    setCurrentStep(2);
    setFormData(prev => ({ ...prev, email: user?.email || prev.email, mobile: user?.phoneNumber || prev.mobile }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    sessionStorage.setItem("dsc_payment_id", response.razorpay_payment_id);
    sessionStorage.setItem("dsc_order_id", response.razorpay_order_id);
  };

  const uploadFile = async (file: File, docId: string, key: string): Promise<string> => {
    if (!user?.uid) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() || 'bin';
    const path = `dsc-applications/${user.uid}/${docId}/${key}_${Date.now()}.${ext}`;
    const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return await getDownloadURL(snap.ref);
  };

  const handleSubmit = async (payInfo?: RazorpaySuccessResponse) => {
    if (isSubmitting) return;
    if (!user) { showAlert('Authentication Error', 'Please login first.'); return; }
    if (!formData.authorizeFiling || !formData.declareCorrect) { showAlert('Declaration Required', 'Please accept both declarations.'); return; }

    const finalPayInfo = payInfo || paymentInfo;
    //if (parseInt(captcha.userAnswer) !== (captcha.val1 + captcha.val2)) { showAlert('Security Check', 'Wrong CAPTCHA. Please try again.'); generateCaptcha(); return; }

    // Category-specific required docs validation
    const reqDocs = catData?.requiredDocs || {};
    const missingDocs = Object.keys(reqDocs).filter(key =>
      (reqDocs as any)[key].required && !uploadedFiles[key]
    );

    if (missingDocs.length > 0) {
      const docLabels = missingDocs.map(key => (reqDocs as any)[key].label || key);
      showAlert('Missing Documents', `Please upload: ${docLabels.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    setModalState('processing');

    try {
      const counterRef = doc(db, "counters", "dsc_cases");
      const currentYear = new Date().getFullYear();
      let newCaseId = '';

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextId = 1;
        let lastYear = currentYear;

        if (counterDoc.exists) {
          const counterData = counterDoc.data();
          if (counterData && counterData.year === currentYear) {
            nextId = (counterData.current || 0) + 1;
          } else {
            nextId = 1;
            lastYear = currentYear;
          }
        }

        transaction.set(counterRef, { current: nextId, year: lastYear }, { merge: true });
        const paddedId = String(nextId).padStart(2, "0");
        newCaseId = `DSC-${lastYear}-${paddedId}`;
      });

      setCaseId(newCaseId);

      const docId = `DSC-${Date.now()}`;
      const fileUrls: Record<string, string> = {};
      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file) fileUrls[key] = await uploadFile(file, docId, key);
      }

      const payload = {
        id: docId, type: 'dsc', title: 'DSC Registration',
        dscType: formData.dscType,
        ...buildInitialApplicationStatus({ serviceType: 'dsc', serviceName: 'DSC Registration', userId: user.uid }),
        submittedAt: Date.now(), formData, uploadedFileUrls: fileUrls,
        userId: user.uid,
        serviceId: generateServiceId('DSC'),
        folderId: 'regibiz',
        caseId: newCaseId,
        planYears: selectedPlanYears,
        usageType: selectedUsageType,
        selectedProvider: 'emudhra',
        
        // Assignment & Tracking
        taskStatus: 'unassigned',
        assignedProvider: null,
        assignedBy: null,
        assignedAt: null,
        
        // Provider Sync
        providerReferenceId: null,
        providerStatus: null,
        providerRemarks: null,
        providerCompletedAt: null,
        
        // DSC Issuance
        dscStatus: 'pending',
        dscSerialNumber: null,
        dscIssuedDate: null,
        dscExpiryDate: null,
        
        // Notifications
        lastStatusUpdate: serverTimestamp(),
        notificationSent: false,
        notificationHistory: [],

        paymentStatus: finalPayInfo ? 'success' : (packageMode ? 'success' : 'pending'),
        paymentId: finalPayInfo?.razorpay_payment_id || '',
        orderId: finalPayInfo?.razorpay_order_id || '',
        signature: finalPayInfo?.razorpay_signature || '',
        totalPaid: totalAmount,
        basePrice: basePrice,
        gstAmount: gstAmount,
        paymentTimestamp: Date.now(),
        paymentMethod: 'razorpay',
      };

      await setDoc(doc(db, 'dsc-applications', docId), payload);
      await setDoc(doc(db, 'users', user.uid, 'documents', docId), {
        id: docId, type: 'dsc', title: 'DSC Registration',
        ...buildInitialApplicationStatus({ serviceType: 'dsc', serviceName: 'DSC Registration', userId: user.uid }),
        submittedAt: Date.now(),
        userId: user.uid, caseId: newCaseId, folderId: 'regibiz',
        taskStatus: 'unassigned', dscType: formData.dscType,
        dscStatus: 'pending', dscExpiryDate: null, dscIssuedDate: null,
      });
      await sendConfirmationEmail({
        name: formData.applicantName,
        email: user.email,
        service: "DSC Registration",
        caseId: newCaseId
      });

      setModalState('success');

    } catch (err: any) {
      console.error("Full Submission Error:", err);
      showAlert('Submission Failed', `Error: ${err.message || 'Internal Server Error'}`);
      setModalState('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const PreviewModal = () => {
    return (
      <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
            <h3 className="text-2xl font-bold text-white">Application Preview</h3>
            <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
              <h4 className="font-bold text-white text-lg mb-4">DSC Category</h4>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-400 font-bold text-sm">{catData?.label || formData.dscType}</span>
              </div>
              <p className="text-slate-400 text-sm">{catData?.desc}</p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
              <h4 className="font-bold text-white text-lg mb-4">Applicant Personal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  ['Full Name', formData.applicantName],
                  ["Father's Name", formData.fatherName || '—'],
                  ['Date of Birth', formData.dob],
                  ['Gender', formData.gender],
                  ['PAN Number', formData.pan],
                  ['Aadhaar', formData.aadhaar ? `XXXX-XXXX-${formData.aadhaar.slice(-4)}` : '—'],
                  ['Email', formData.email],
                  ['Mobile', `+91 ${formData.mobile}`],
                  ['Designation', designationOptions.find(o => o.value === formData.designation)?.label || formData.designation],
                  ['Entity Type', entityTypeOptions.find(o => o.value === formData.entityType)?.label || formData.entityType],
                  ['Purpose', purposeOptions.find(o => o.value === formData.purpose)?.label || formData.purpose],
                ].map(([k, v]) => (
                  <div key={k}><span className="text-slate-500 font-medium block mb-1">{k}:</span><span className="text-white font-medium">{v}</span></div>
                ))}
              </div>
            </div>
            {isOrg && (
              <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
                <h4 className="font-bold text-white text-lg mb-4">Organisation Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {[
                    ['Organisation Name', formData.organisationName || '—'],
                    ['Organisation PAN', formData.organisationPan || '—'],
                    ['CIN ', formData.cin || formData.llpin || '—'],
                    ['GSTIN', formData.gstin || '—'],
                    ...(isDGFT ? [['IEC Code', formData.iec || '—']] : []),
                  ].map(([k, v]) => (
                    <div key={k}><span className="text-slate-500 font-medium block mb-1">{k}:</span><span className="text-white font-mono font-bold">{v}</span></div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
              <h4 className="font-bold text-white text-lg mb-4">Address</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-slate-500 font-medium block mb-1">Address Line 1:</span><span className="text-white">{formData.address1}</span></div>
                {formData.address2 && <div><span className="text-slate-500 font-medium block mb-1">Address Line 2:</span><span className="text-white">{formData.address2}</span></div>}
                <div className="grid grid-cols-3 gap-4">
                  <div><span className="text-slate-500 block mb-1">City:</span><span className="text-white">{formData.city}</span></div>
                  <div><span className="text-slate-500 block mb-1">State:</span><span className="text-white">{stateOptions.find(s => s.value === formData.state)?.label}</span></div>
                  <div><span className="text-slate-500 block mb-1">Pincode:</span><span className="text-white font-mono">{formData.zip}</span></div>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
              <h4 className="font-bold text-white text-lg mb-4">Documents Uploaded</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(uploadedFiles).map(([key, file]) => file ? (
                  <div key={key} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <span className="text-slate-300 text-sm font-medium">
                      {catData?.requiredDocs && (catData.requiredDocs as any)[key]?.label || key}
                    </span>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                ) : null)}
              </div>
            </div>
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
              <p className="text-sm text-amber-200 flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Please verify all details before submitting. Our team will schedule a Video KYC call within 24–48 hours of submission.
              </p>
            </div>
          </div>
          <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0">
            <button onClick={() => setShowPreview(false)} className="px-6 py-2.5 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all font-medium">
              Close & Edit
            </button>
            <button onClick={() => { setShowPreview(false); handleSubmit(); }} disabled={isSubmitting}
              className="px-8 py-2.5 rounded-lg font-bold text-base transition-all flex items-center gap-2 bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white disabled:opacity-50">
              {isSubmitting ? (
                <><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Processing...</>
              ) : <>Confirm & Submit<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>}
            </button>
          </div>
        </div>
      </div>
    )
  };

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-slate-900/60 rounded-2xl p-8 max-w-sm w-full text-center border border-slate-800">
        <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
        <p className="text-slate-400 text-sm mb-6">Please log in to apply for DSC.</p>
        <button onClick={() => navigate('/auth')} className="w-full bg-gradient-to-r from-teal-700 to-blue-900 text-white font-semibold py-3 rounded-lg">Go to Login</button>
      </div>
    </div>
  );

  const stepTitle = () => {
    if (currentStep === 0) return 'Select DSC Category';
    if (currentStep === 1) return 'Select Validity Plan';
    if (currentStep === 2) return 'Applicant Personal Details';
    if (currentStep === 3) return 'Organisation Details';
    if (currentStep === 4) return 'Address Information';
    return 'Documents & Declaration';
  };

  const isFormLocked = currentStep >= 2 && paymentStatus !== 'success';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <PartnershipHeader />

      {modalState !== 'idle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">

          {/* Processing State */}
          {modalState === 'processing' && (
            <div className="relative w-full max-w-md">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 rounded-2xl blur opacity-30 animate-pulse"></div>
              <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-cyan-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Processing Application</h3>
                <p className="text-slate-400 text-sm mb-6">Please wait while we securely upload your documents and generate your Case ID.</p>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
                  <div className="bg-gradient-primary h-1.5 rounded-full animate-[progress_2s_ease-in-out_infinite]"></div>
                </div>
                <p className="text-xs text-cyan-500 font-mono animate-pulse">Encrypting Data...</p>
              </div>
            </div>
          )}

          {/* ✅ SUCCESS STATE - UPDATED UI */}
          {modalState === 'success' && (
            <div className="relative w-full max-w-md animate-in zoom-in-95 duration-300">
              <CelebrationPopup trigger={modalState === 'success'} message="" />
              {/* Background Glow Effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-500 rounded-2xl blur-sm opacity-20"></div>

              <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-8 text-center">

                {/* Animated Checkmark Icon */}
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-700 rounded-full flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-bounce">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Title & Description */}
                <h2 className="text-2xl font-bold text-white mb-2">
                  DSC Application Submitted!
                </h2>
                <p className="text-slate-400 mb-6 text-sm max-w-md mx-auto leading-relaxed">
                  Your application has been received. Our team will contact you shortly for <strong>Video KYC</strong> verification and certificate issuance.
                </p>

                {/* Case ID Display */}
                <div className="mb-8 w-full max-w-xs mx-auto">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Your Case ID</p>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4">
                    <p className="text-cyan-400 font-mono font-bold text-lg tracking-wide">{caseId}</p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-slate-800/50 rounded-xl p-5 mb-8 text-left border border-slate-700 w-full max-w-sm mx-auto space-y-3 shadow-inner">
                  <div className="flex justify-between items-center text-xs border-b border-slate-700/50 pb-2">
                    <span className="text-slate-500">Applicant</span>
                    <span className="text-white font-medium truncate max-w-[150px]">{formData.applicantName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-700/50 pb-2">
                    <span className="text-slate-500">Category</span>
                    <span className="text-white font-medium">{catData?.label || formData.dscType}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Validity</span>
                    <span className="text-white font-medium">{selectedPlanYears} Year{selectedPlanYears > 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 w-full max-w-sm mx-auto">
                  <button
                    onClick={() => navigate('/documents')}
                    className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-all text-sm shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 group"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    View Submitted Application
                  </button>
                  <button
                    onClick={() => navigate('/services')}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3.5 px-6 rounded-xl border border-slate-700 text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    Back to Services
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-20 h-20 bg-orange-500/20 rounded-3xl flex items-center justify-center text-orange-400 border border-orange-500/20 mb-6 mx-auto shadow-[0_0_40px_rgba(249,115,22,0.15)]">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">Save Draft & Exit?</h3>
              <p className="text-slate-400 mb-8 font-medium leading-relaxed">
                Do you want to <span className="text-orange-400 font-bold">Save your progress as a Draft</span> before leaving? You can resume later from the Documents section.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleConfirmExit(true)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isDraftSaving ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  )}
                  {isDraftSaving ? 'Saving...' : 'Yes, Save & Exit'}
                </button>
                
                <button 
                  onClick={() => handleConfirmExit(false)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                >
                  No, Just Exit
                </button>

                <button 
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDraftSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 mb-6 mx-auto shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Draft Saved!</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
              Your DSC registration progress has been securely saved as a draft.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/5 py-2.5 px-5 rounded-full border border-emerald-400/10 w-fit mx-auto shadow-inner shadow-emerald-400/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Redirecting to Service Panel...
            </div>
          </div>
        </div>
      )}

      {alertConfig.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4 border border-rose-500/50">
                  <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{alertConfig.title}</h3>
                <p className="text-slate-300 text-sm mb-6 leading-relaxed">{alertConfig.message}</p>
                <button onClick={() => setAlertConfig({ ...alertConfig, show: false })} className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800">Okay, Got it</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">DSC Registration</h1>
          <p className="text-sky-200/80 text-sm">Step {currentStep + 1} of {isOrg ? 6 : 5}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-5 left-5 z-20 flex items-center gap-4">
              <FormBackButton onBack={handlePrev} />
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Exit Session
              </button>
            </div>

            {isFormLocked && (
              <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-300">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(56,189,248,0.2)] border border-slate-700">
                  <svg className="w-10 h-10 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Payment Required</h3>
                <p className="text-slate-400 max-w-md mb-6">Please complete the plan selection and payment in the previous step to unlock the application form.</p>
                <button onClick={() => setCurrentStep(1)} className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-cyan-900/20">Go to Payment</button>
              </div>
            )}

            <div className={`p-6 md:p-10 flex-grow transition-all duration-500 ${isFormLocked ? 'blur-sm pointer-events-none select-none' : ''}`}>
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">DSC Registration</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">{stepTitle()}</p>
              </div>

              <form noValidate>
                {currentStep === 0 && (
                  <div className="space-y-8">
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
                        Choose DSC Category
                      </legend>
                      <p className="text-slate-400 text-sm mb-4">Select the type of DSC based on your requirement.</p>
                      <div className="space-y-4">
                        {Object.entries(DSC_CATEGORIES).map(([key, cat]) => {
                          const isSelected = formData.dscType === key;
                          return (
                            <button key={key} type="button" onClick={() => setFormData(p => ({ ...p, dscType: key }))}
                              className={`relative w-full rounded-2xl p-5 text-left border-2 transition-all overflow-hidden ${isSelected ? 'border-transparent bg-gradient-to-br from-red-500/10 to-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.2)]' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
                                }`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <p className={`font-bold text-base ${isSelected ? 'text-white' : 'text-white'}`}>{cat.label}</p>
                                    {isSelected && <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-heading-from to-heading-to text-white rounded-full font-semibold shadow-lg shadow-orange-500/20">Selected</span>}
                                  </div>
                                  <p className="text-sm text-slate-400 mb-3">{cat.desc}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {cat.govPortals.map(p => (
                                      <span key={p} className={`text-xs px-2 py-0.5 rounded border ${isSelected ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{p}</span>
                                    ))}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-r from-heading-from to-heading-to flex items-center justify-center flex-shrink-0 ml-4 shadow-lg shadow-orange-500/30">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                  </div>
                )}

                {currentStep === 1 && catData && (
                  <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                      <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
                      Select Plan & Usage
                    </legend>

                    <div className="mb-8">
                      <label className="block text-sm font-medium text-slate-300 mb-3">
                        Certificate Usage Type <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { id: 'sign', label: 'Signature Only', desc: 'For signing documents (PDF, Forms)' },
                          { id: 'encrypt', label: 'Encryption Only', desc: 'For encrypting sensitive emails/files' },
                          { id: 'both', label: 'Sign & Encrypt', desc: 'Full access', highlight: true }
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setSelectedUsageType(type.id)}
                            className={`relative p-4 rounded-xl border text-left transition-all ${selectedUsageType === type.id
                              ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                              : 'border-slate-700 bg-slate-800/30 hover:border-slate-500'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-bold text-sm ${selectedUsageType === type.id ? 'text-cyan-400' : 'text-white'}`}>
                                {type.label}
                              </span>
                              {selectedUsageType === type.id && (
                                <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{type.desc}</p>
                            {type.highlight && selectedUsageType === 'both' && (
                              <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                +₹650
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-slate-400 text-sm mb-4">Choose the validity period for your Digital Signature Certificate.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[1, 2, 3].map((years) => {
                        let priceCategory = catData.type;
                        if (isDGFT) priceCategory = 'dgft';

                        const providerPricing = PRICING_CONFIG[selectedProvider as keyof typeof PRICING_CONFIG];
                        const categoryPricing = providerPricing[priceCategory as keyof typeof providerPricing];

                        let displayPrice = categoryPricing ? categoryPricing[years] : 0;

                        if (selectedUsageType === 'both' && categoryPricing?.bothAddon) {
                          displayPrice += categoryPricing.bothAddon;
                        }

                        const isSelected = selectedPlanYears === years;

                        return (
                          <button
                            key={years}
                            type="button"
                            onClick={() => setSelectedPlanYears(years)}
                            className={`relative rounded-2xl p-6 text-left border-2 transition-all flex flex-col h-full ${isSelected
                              ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                              : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
                              }`}>
                            {years === 2 && (
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10">
                                Most Popular
                              </span>
                            )}
                            <div className="mb-4">
                              <h4 className="text-white font-bold text-lg">{years} Year{years > 1 ? 's' : ''}</h4>
                              <p className="text-slate-400 text-xs mt-1">Validity Period</p>
                            </div>
                            <div className="mt-auto">
                              <div className="text-3xl font-bold text-white">
                                ₹{displayPrice.toLocaleString('en-IN')}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute top-4 right-4 text-cyan-500">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {/* ✅ REFINED ELEGANT SUMMARY BAR FOR STEPS 2-5 */}
                {currentStep >= 2 && currentStep <= 5 && (
                  <div className="sticky top-4 z-30 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl ring-1 ring-white/5">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                        {/* Left Side: Plan Details */}
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Active Application</span>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-bold text-white">{catData?.label}</span>
                              <span className="text-slate-600">•</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 text-xs font-medium border border-slate-700">
                                {selectedUsageType === 'both' ? 'Sign & Encrypt' : selectedUsageType === 'sign' ? 'Signature Only' : 'Encryption Only'}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-300">{selectedPlanYears} Year{selectedPlanYears > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Divider (Mobile Hidden) */}
                        <div className="hidden md:block h-8 w-px bg-slate-800"></div>

                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                      <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
                      Applicant Personal Details
                    </legend>
                    <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
                      <p className="text-sm text-sky-300">All details must match exactly with your <strong>Aadhaar</strong> and <strong>PAN</strong> records.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormInput label="Full Name (as per PAN / Aadhaar)" name="applicantName" value={formData.applicantName}
                        onChange={handleChange} onBlur={handleBlur} error={errors.applicantName}
                        placeholder="e.g., Rajesh Kumar Sharma" required
                        infoText="Must match exactly with your PAN and Aadhaar records for CCA verification." />
                      <FormInput type="date" label="Date of Birth" name="dob" value={formData.dob}
                        onChange={handleChange} onBlur={handleBlur} error={errors.dob} required
                        infoText="As per your official government ID proof." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormInput label="PAN Number" name="pan" value={formData.pan}
                        onChange={handleChange} onBlur={handleBlur} error={errors.pan}
                        placeholder="ABCDE1234F" maxLength={10} required hint="Format: ABCDE1234F"
                        infoText="10-character Permanent Account Number issued by Income Tax Department." />
                      <FormInput type="email" label="Email Address" name="email" value={formData.email}
                        onChange={handleChange} onBlur={handleBlur} error={errors.email}
                        placeholder="your@email.com" required
                        infoText="Active email for communication, OTP verification, and DSC delivery." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormInput type="tel" label="Mobile Number" name="mobile" value={formData.mobile}
                        onChange={handleChange} onBlur={handleBlur} error={errors.mobile}
                        placeholder="9876543210" maxLength={10} required hint="Aadhaar Linked"
                        infoText="10-digit Aadhaar-linked mobile number for OTP-based Video KYC verification." />
                      <FormSelect label="Primary Purpose of DSC" name="purpose" value={formData.purpose}
                        onChange={handleChange} onBlur={handleBlur} error={errors.purpose}
                        options={purposeOptions} required
                        infoText="Select the main government portal where you'll use this Digital Signature Certificate." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormSelect label="Designation / Role" name="designation" value={formData.designation}
                        onChange={handleChange} onBlur={handleBlur} error={errors.designation}
                        options={designationOptions} required
                        infoText="Your official position in the organisation as per authorised documents." />
                      <FormSelect label="Entity Type" name="entityType" value={formData.entityType}
                        onChange={handleChange} onBlur={handleBlur} error={errors.entityType}
                        options={entityTypeOptions} required
                        infoText="Select your business structure. This determines the organisation documents required." />
                    </div>
                  </fieldset>
                )}

                {currentStep === 3 && isOrg && (
                  <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                      <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
                      Organisation Details
                    </legend>
                    <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
                      <p className="text-sm text-sky-300">For <strong>{catData?.label}</strong> — Organisation details as per MCA / ROC registration.</p>
                    </div>
                    <FormInput label="Organisation / Company Name" name="organisationName" value={formData.organisationName}
                      onChange={handleChange} onBlur={handleBlur} error={errors.organisationName}
                      placeholder="e.g., ABC Technologies Private Limited" required
                      infoText="Exact legal name as per Certificate of Incorporation / MCA records." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormInput label="Organisation PAN" name="organisationPan" value={formData.organisationPan}
                        onChange={handleChange} onBlur={handleBlur} error={errors.organisationPan}
                        placeholder="AAACT1234A" maxLength={10} hint="Company / LLP / Firm PAN"
                        infoText="10-character PAN of the organisation (separate from individual applicant PAN)." />
                      <FormInput label="CIN" name="cin" value={formData.cin}
                        onChange={handleChange} onBlur={handleBlur} error={errors.cin}
                        placeholder="e.g., U72900MH2020PTC123456" hint="Company / LLP Identification Number" optional maxLength={21}
                        infoText="21-character Corporate Identification Number issued by Ministry of Corporate Affairs." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormInput label="GSTIN" name="gstin" value={formData.gstin}
                        onChange={handleChange} onBlur={handleBlur}
                        placeholder="27AAACT1234A1Z5" maxLength={15} optional
                        infoText="15-character GST registration number if your organisation is GST registered." />
                      {isDGFT && (
                        <FormInput label="IEC Code (Import Export Code)" name="iec" value={formData.iec}
                          onChange={handleChange} onBlur={handleBlur} error={errors.iec}
                          placeholder="AAACT1234A" maxLength={10} required hint="DGFT IEC — 10 character code"
                          infoText="10-character Import Export Code issued by DGFT for international trade." />
                      )}
                    </div>
                    {!isDGFT && (
                      <FormInput label="LLPIN (if LLP)" name="llpin" value={formData.llpin}
                        onChange={handleChange} onBlur={handleBlur}
                        placeholder="e.g., AAB-1234" optional
                        infoText="LLP Identification Number issued by MCA for Limited Liability Partnerships." />
                    )}
                  </fieldset>
                )}

                {currentStep === 4 && (
                  <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                      <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
                      {isOrg ? 'Registered Office Address' : 'Residential Address'}
                    </legend>
                    <FormInput label="Address Line 1" name="address1" value={formData.address1}
                      onChange={handleChange} onBlur={handleBlur} error={errors.address1}
                      placeholder="Flat / Plot No., Building Name, Street" required
                      infoText="Door/flat number, building name, street — exactly as per address proof document." />
                    <FormInput label="Address Line 2 / Landmark" name="address2" value={formData.address2}
                      onChange={handleChange} onBlur={handleBlur}
                      placeholder="Area / Colony / Locality (optional)" optional
                      infoText="Area, colony, landmark, or nearby location for easier identification." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormSelect label="State / UT" name="state" value={formData.state}
                        onChange={handleChange} onBlur={handleBlur} error={errors.state}
                        options={stateOptions} required
                        infoText="Select the state or union territory where your address is located." />
                      <FormInput label="City / District" name="city" value={formData.city}
                        onChange={handleChange} onBlur={handleBlur} error={errors.city}
                        placeholder="Enter city name" required
                        infoText="City or district name as per official postal records." />
                    </div>
                    <FormInput label="Pincode" name="zip" value={formData.zip}
                      onChange={handleChange} onBlur={handleBlur} error={errors.zip}
                      placeholder="6-digit pincode" maxLength={6} required
                      infoText="6-digit postal code for accurate address verification and DSC delivery." />
                  </fieldset>
                )}

                {currentStep === 5 && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-white mb-2">Documents Upload</h2>
                      <p className="text-slate-400 text-sm">PDF / JPG / PNG — Max 2MB each. Scanned copies must be clear and legible.</p>
                    </div>
                    <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
                      <p className="text-sm text-sky-300">Documents required for <strong>{catData?.label}</strong>. Marked with <span className="text-red-400">*</span> are mandatory as per CCA India guidelines.</p>
                    </div>
                    <fieldset className="space-y-4 mb-8">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-4 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
                        Master Data
                      </legend>
                      <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                        <p className="text-xs text-amber-300 flex items-start gap-2">
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Master Data is the consolidated information sheet containing your applicant and organisation details for DSC processing. Download the template from RegiBIZ, fill it accurately, and upload here.
                        </p>
                      </div>
                      <FileUploader
                        label="Master Data Sheet"
                        name="masterData"
                        required
                        uploadedFile={uploadedFiles.masterData}
                        onChange={f => setUploadedFiles(p => ({ ...p, masterData: f }))}
                        onError={(msg) => showAlert('Upload Error', msg)}
                        hint="Filled Master Data template — PDF or Excel"
                        infoText="The Master Data sheet consolidates all applicant and entity details required for DSC certificate generation. Contact our team for the template."
                      />
                    </fieldset>
                    <fieldset className="space-y-4 mb-8">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
                        {isOrg ? "Authorized Person Documents" : "Individual KYC Documents"}
                      </legend>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FileUploader label={isOrg ? "Authorized Person Photo" : "Passport-size Photo"} name="photo" required
                          uploadedFile={uploadedFiles.photo} onChange={f => setUploadedFiles(p => ({ ...p, photo: f }))}
                          onError={(msg) => showAlert('Upload Error', msg)}
                          accept=".jpg,.jpeg,.png"
                          hint="White background, clear face — JPG/PNG only"
                          infoText="Recent photograph with white background. No sunglasses, cap, or shadow on face. JPEG/PNG only." />
                        <FileUploader label={isOrg ? "Authorized Person (Pancard / voter ID / Adhaar card )" : "Identity Proof (Aadhaar / Passport / Voter ID)"} name="identityProof" required
                          uploadedFile={uploadedFiles.identityProof} onChange={f => setUploadedFiles(p => ({ ...p, identityProof: f }))}
                          onError={(msg) => showAlert('Upload Error', msg)}
                          hint={isOrg ? "Pancard / Voter ID / Aadhaar" : "Aadhaar / Passport / Voter ID"}
                          infoText="Upload any one valid government photo ID. This will serve as both Identity and Address Proof for Video KYC." />
                        {!isOrg && (
                          <FileUploader label="PAN Card of Applicant" name="panCard" required
                            uploadedFile={uploadedFiles.panCard} onChange={f => setUploadedFiles(p => ({ ...p, panCard: f }))}
                            onError={(msg) => showAlert('Upload Error', msg)}
                            hint="Individual PAN card"
                            infoText="Upload clear scan of individual PAN card. This is the applicant's PAN, not company PAN." />
                        )}
                      </div>
                    </fieldset>
                    {isOrg && (
                      <fieldset className="space-y-4 mb-8">
                        <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
                          {isOrg ? "Entity / Organisation Documents" : "Organisation Documents"}
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <FileUploader label="Company PANCard" name="organisationPanDoc" required
                            uploadedFile={uploadedFiles.organisationPanDoc} onChange={f => setUploadedFiles(p => ({ ...p, organisationPanDoc: f }))}
                            onError={(msg) => showAlert('Upload Error', msg)}
                            hint="Company / LLP / Firm PAN"
                            infoText="Upload the organisation's PAN card — separate from the individual applicant's PAN." />
                          <FileUploader label="Company COI" name="incorporationCert" required={isOrg}
                            uploadedFile={uploadedFiles.incorporationCert} onChange={f => setUploadedFiles(p => ({ ...p, incorporationCert: f }))}
                            onError={(msg) => showAlert('Upload Error', msg)}
                            hint="COI (MCA) / LLP certificate / Partnership deed"
                            infoText="MCA-issued Certificate of Incorporation for companies, LLP Incorporation Certificate for LLPs, or Partnership Deed for firms." />
                          <FileUploader label="Board Resolution document" name="authorizationLetter" required
                            uploadedFile={uploadedFiles.authorizationLetter} onChange={f => setUploadedFiles(p => ({ ...p, authorizationLetter: f }))}
                            onError={(msg) => showAlert('Upload Error', msg)}
                            hint="On company letterhead, signed by Director/MD with seal"
                            infoText="Must be on official letterhead, authorizing the applicant to sign on behalf of the organisation. Must include: applicant name, designation, purpose, company seal, and Director/MD signature." />
                          {isDGFT ? (
                            <FileUploader label="IEC Certificate" name="iecCert" required
                              uploadedFile={uploadedFiles.iecCert} onChange={f => setUploadedFiles(p => ({ ...p, iecCert: f }))}
                              onError={(msg) => showAlert('Upload Error', msg)}
                              hint="Import Export Code certificate from DGFT"
                              infoText="DGFT-issued IEC certificate. Required for DGFT DSC applications." />
                          ) : (
                            <FileUploader label="GST no if available" name="gstCert"
                              uploadedFile={uploadedFiles.gstCert} onChange={f => setUploadedFiles(p => ({ ...p, gstCert: f }))}
                              onError={(msg) => showAlert('Upload Error', msg)}
                              hint="If GST registered (optional but recommended)"
                              optional
                              infoText="Upload GST certificate if available. Helps Certifying Authority verify entity authenticity faster." />
                          )}
                        </div>
                      </fieldset>
                    )}
                    <div className="space-y-4 mb-8">
                      <h3 className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2">
                        Declaration
                      </h3>
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={formData.authorizeFiling} onChange={() => handleCheckbox('authorizeFiling')}
                            className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-2" />
                          <span className="text-sm text-slate-300">I authorize RegiBIZ to submit my DSC application to the Certifying Authority and coordinate the Video KYC process on my behalf.</span>
                        </label>
                      </div>
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={formData.declareCorrect} onChange={() => handleCheckbox('declareCorrect')}
                            className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-2" />
                          <span className="text-sm text-slate-300">I hereby declare that all information provided is true, complete, and correct to the best of my knowledge. I understand that providing false information may result in rejection, legal liability, or revocation of the DSC.</span>
                        </label>
                      </div>
                    </div>

                    {/*<div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between mb-6">
                      <div className="mb-4 sm:mb-0">
                        <h4 className="text-sm font-semibold text-white flex items-center">
                          <svg className="w-4 h-4 mr-2 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          Security Verification
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">Solve to confirm you are human.</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 font-mono text-xl font-bold text-cyan-400 tracking-wider">
                          {captcha.val1} + {captcha.val2} = ?
                        </div>
                        <input type="number" className="w-20 bg-slate-800 border border-slate-600 rounded-lg p-2 text-center text-white focus:border-cyan-500 outline-none"
                          placeholder="?" value={captcha.userAnswer}
                          onChange={e => setCaptcha(p => ({ ...p, userAnswer: e.target.value }))} />
                        <button type="button" onClick={generateCaptcha} className="p-2 text-slate-500 hover:text-white transition-colors" title="Refresh">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      </div>
                    </div>*/}
                  </div>
                )}
              </form>

              <div className="mt-12 pt-6 border-t border-slate-700/50">
                <div className="flex justify-end">
                  <div className="flex gap-3 w-full md:w-auto">
                    {currentStep === 5 && (
                      <button type="button" onClick={() => setShowPreview(true)}
                        className="px-6 py-4 rounded-xl font-bold bg-slate-700 border border-slate-600 text-emerald-400 hover:bg-slate-600 hover:text-white transition-all flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Preview
                      </button>
                    )}
                    {currentStep < 5 ? (
                      <button type="button" onClick={handleNext}
                        className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                        Save & Next
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleSubmit()}
                        disabled={isSubmitting || !formData.authorizeFiling || !formData.declareCorrect}
                        className={`w-full md:w-auto px-8 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all transform border border-transparent ${isSubmitting || !formData.authorizeFiling || !formData.declareCorrect
                          ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70 border-slate-700'
                          : 'bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1'}`}>
                        {isSubmitting ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                            Processing...
                          </span>
                        ) : 'Submit Application'}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-slate-400">
                  Step {currentStep + 1} of {isOrg ? 6 : 5} — By continuing, you agree to our{' '}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Terms</a> and{' '}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>
                </p>
              </div>
            </div>
          </main>

          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8">
            <ProgressSidebar
              currentStep={currentStep}
              uploadedFiles={uploadedFiles}
              dscType={formData.dscType}
              isOrg={isOrg}
              paymentStatus={paymentStatus}
              basePrice={basePrice}
              gstAmount={gstAmount}
              totalAmount={totalAmount}
            />
          </aside>
        </div>
        <div className="mt-12 text-center text-slate-500 text-sm pb-8">© 2026 RegiBIZ. All rights reserved.</div>
      </div >

      {showPreview && <PreviewModal />
      }

    </div >
  );
}