// src/services/gst/gst-llp-form.tsx
// Pattern: GST LLP Registration Form — dark slate theme (matching DSC form),
// progress sidebar, multi-step, preview modal, separate address & document steps
import React, { useState, useEffect, useRef, ChangeEvent, FocusEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, collection, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CelebrationPopup from '../../components/CelebrationPopup';
import FormBackButton from '../../components/FormBackButton';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export interface CommonFormData {
  businessName: string;
  tradeName: string;
  constitution: string;
  dateOfCommencement: string;
  panNumber: string;
}

interface Partner {
  id: string;
  designation: string;
  isPrimary: boolean;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fatherName?: { firstName?: string; middleName?: string; lastName?: string };
  mobile: string;
  email: string;
  panFile: boolean;
  aadhaarFile: boolean;
  photoFile: boolean;
}

interface FormData {
  // Step 0 — Authorized Person
  promoterName: string;
  promoterDob: string;
  promoterEmail: string;
  promoterMobile: string;
  promoterAadhaar: string;
  // Step 1 — Address (Updated to match DSC style)
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  // Step 2 — Nature of Business
  natureOfBusiness: string;
  // Step 4 — Declarations
  consent1: boolean;
  consent2: boolean;
}

type DocKey =
  | 'masterData'
  | 'companyPan'
  | 'llpAgreement'
  | 'companyCoi'
  | 'companyMoa'
  | 'companyAoa'
  | 'cancelledCheque'
  | 'bankStatement'
  | 'signPan'
  | 'signAadhaar'
  | 'signPhoto'
  | 'signAuthLetter'
  | 'rentAgreement'
  | 'utilityBill'
  | 'geoTagPhoto'
  | 'dsc';

type UploadedFilesState = Record<DocKey, File | null>;

interface LLPFormProps {
  user: any;
  commonData: CommonFormData;
  packageMode?: boolean;
  onBack: () => void;
  onSubmit?: (formData: any, uploadedFiles: Record<string, File>) => Promise<void>;
  INDIAN_STATES: { value: string; label: string }[];
  STATE_DISTRICTS: Record<string, { value: string; label: string }[]>;
}

// ============================================================================
// CONSTANTS & DATA
// ============================================================================
const INITIAL_DATA: FormData = {
  promoterName: '', promoterDob: '', promoterEmail: '',
  promoterMobile: '', promoterAadhaar: '',
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
  natureOfBusiness: '', consent1: false, consent2: false,
};

const INITIAL_PARTNERS: Partner[] = [
  { id: '1', designation: 'Designated Partner', isPrimary: true, firstName: '', middleName: '', lastName: '', fatherName: { firstName: '', middleName: '', lastName: '' }, mobile: '', email: '', panFile: false, aadhaarFile: false, photoFile: false },
  { id: '2', designation: 'Designated Partner', isPrimary: false, firstName: '', middleName: '', lastName: '', fatherName: { firstName: '', middleName: '', lastName: '' }, mobile: '', email: '', panFile: false, aadhaarFile: false, photoFile: false },
];

const INITIAL_UPLOADED_DOCS: Record<DocKey, boolean> = {
  masterData: false, companyPan: false, llpAgreement: false, companyCoi: false,
  companyMoa: false, companyAoa: false, cancelledCheque: false, bankStatement: false,
  signPan: false, signAadhaar: false, signPhoto: false, signAuthLetter: false,
  rentAgreement: false, utilityBill: false, dsc: false, geoTagPhoto: false,
};

const DESIGNATION_OPTIONS = [
  { value: 'Designated Partner', label: 'Designated Partner' },
  { value: 'Partner', label: 'Partner' },
];

const NATURE_OPTIONS = [
  'Manufacture', 'Wholesale Business', 'Retail Business',
  'Service Provision', 'Job Work', 'Import/Export',
  'E-commerce Seller', 'Input Service Distributor',
];

// 🔥 NEW: Utility Bill Options for Dropdown
const UTILITY_OPTIONS = [
  { value: 'electricity', label: 'Electricity Bill' },
  { value: 'water', label: 'Water Bill' },
  { value: 'gas', label: 'Gas Bill' },
];

// ── Step definitions matching DSC pattern ────────────────────────────────────
const STEP_LABELS = [
  'Authorized Person',
  'Address Details',
  'Nature of Business',
  'Documents & Partners',
  'Declaration & Submit',
];

// ============================================================================
// LOCALSTORAGE HELPERS
// ============================================================================
const SK = {
  FORM_DATA: 'gstLLPFormData', CURRENT_STEP: 'gstLLPCurrentStep',
  DOC_SUB_STEP: 'gstLLPDocSubStep', PARTNERS: 'gstLLPPartners',
  UPLOADED_DOCS: 'gstLLPUploadedDocs', DOC_FILE_NAMES: 'gstLLPDocFileNames',
  PARTNER_FILE_NAMES: 'gstLLPPartnerFileNames', PROPERTY_TYPE: 'gstLLPPropertyType',
  SIGNATORY: 'gstLLPSignatory', UTILITY_TYPE: 'gstLLPUtilityType',
};

// Local storage helpers removed in favor of Firestore drafts
const clearAll = () => {
  // Previously cleared localStorage, now just a placeholder for consistency
  // State is naturally reset on component unmount/remount
};

// ============================================================================
// 🔥 SEQUENTIAL ID GENERATOR (Like MSME Form)
// ============================================================================
const generateSequentialFormId = async (prefix: string = 'GST-LLP', year: number): Promise<string> => {
  const counterRef = doc(db, 'counters', `${prefix.toLowerCase().replace(/\s+/g, '_')}_${year}`);
  let newCount = 0;
  try {
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { count: 1, year, prefix, createdAt: serverTimestamp() });
        newCount = 1;
      } else {
        const currentCount = counterDoc.data()?.count || 0;
        newCount = currentCount + 1;
        transaction.update(counterRef, { count: newCount });
      }
    });
  } catch (err) {
    console.error("Transaction failed, using fallback ID", err);
    newCount = Math.floor(Math.random() * 1000);
  }
  const formattedCount = String(newCount).padStart(2, '0');
  return `${prefix}-${year}-${formattedCount}`;
};

const FreeCornerRibbon = () => (
  <div
    aria-label="Free service"
    className="absolute top-5 -right-11 z-20 w-40 rotate-45 border border-white/35 bg-gradient-to-r from-emerald-700 via-green-500 to-emerald-800 py-2 text-center text-[14px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(22,163,74,0.38)] pointer-events-none"
  >
    FREE
  </div>
);

// ============================================================================
// VALIDATORS
// ============================================================================
const validators = {
  required: (v: string, f = 'This field') => (v && v.trim().length > 0) || `${f} is required`,
  name: (v: string) => /^[A-Za-z\s]{2,50}$/.test(v) || 'Enter a valid name (2–50 letters)',
  dob: (v: string) => {
    if (!v?.trim()) return 'Date of birth is required';
    const parts = v.includes('-') ? v.split('-') : v.split('/');
    if (parts.length !== 3) return 'Invalid date format';
    let y: number, m: number, d: number;
    if (parts[0].length === 4) [y, m, d] = parts.map(Number);
    else[d, m, y] = parts.map(Number);
    const dob = new Date(y, m - 1, d);
    if (isNaN(dob.getTime())) return 'Invalid date';
    let age = new Date().getFullYear() - dob.getFullYear();
    const mo = new Date().getMonth() - dob.getMonth();
    if (mo < 0 || (mo === 0 && new Date().getDate() < dob.getDate())) age--;
    return (age >= 18 && age <= 100) || 'Must be between 18 and 100 years old';
  },
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email address',
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v) || 'Invalid 10-digit mobile (starts 6–9)',
  pincode: (v: string) => /^\d{6}$/.test(v) || 'Pincode must be 6 digits',
  aadhaar: (v: string) => /^\d{12}$/.test(v) || 'Aadhaar must be 12 digits',
};

// ============================================================================
// UI COMPONENTS
// ============================================================================
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
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-slate-900 border border-slate-700 text-slate-300 text-[11px] rounded-lg shadow-2xl z-[100] backdrop-blur-md text-center normal-case tracking-normal font-normal">
          {text}
          {/* Arrow */}
          <div className="absolute left-1/2 -top-1 -ml-1 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 transform rotate-45" />
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
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <input id={inputId}
        className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all focus:ring-2 focus:outline-none focus:bg-[#1e293b] ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
        required={required} {...props} />
      {error
        ? <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>
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
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select id={selectId} value={value}
          className={`w-full bg-slate-800/50 border text-sm rounded-lg block p-3 pr-10 appearance-none shadow-sm transition-all focus:ring-2 focus:outline-none focus:bg-[#1e293b] cursor-pointer ${!value ? 'text-slate-500' : 'text-white'} ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
          required={required} {...props}>
          <option value="" disabled>Select an option</option>
          {options.map(o => <option key={o.value} value={o.value} className="text-slate-900 bg-slate-100">{o.label}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>}
    </div>
  );
};

const FileUploader: React.FC<{
  label: string; name: string; required?: boolean; optional?: boolean;
  uploadedFile: File | null; onChange: (f: File | null) => void; infoText?: string;
  accept?: string; hint?: string; error?: string; fileName?: string | null; existingUrl?: string;
}> = ({ label, name, required, optional, uploadedFile, onChange, infoText, accept = '.pdf,.jpg,.jpeg,.png', hint, error, fileName: externalFileName, existingUrl }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = uploadedFile?.name || externalFileName || (existingUrl ? existingUrl.split('/').pop()?.split('?')[0] : null);
  const process = (f: File | null) => {
    if (!f) { onChange(null); return; }
    if (f.size > 2 * 1024 * 1024) { alert('File must be under 2MB'); return; }
    onChange(f);
  };
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label className={`block text-sm font-medium ${optional && !required ? 'text-slate-500' : 'text-white'}`}>
            {label}{required && <span className="text-red-500">*</span>}
            {optional && !required && <span className="text-xs text-slate-600 ml-2">(Optional)</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files?.[0] || null); }}
        className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragging ? 'border-cyan-500 bg-cyan-500/10' : displayName ? 'border-emerald-500/50 bg-emerald-500/5' : error ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}>
        <input ref={inputRef} type="file" name={name} accept={accept} className="hidden"
          onChange={e => process(e.target.files?.[0] || null)} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 ${displayName ? 'bg-emerald-500/20 text-emerald-400' : error ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-400'}`}>
            {displayName
              ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
          </div>
          <div className="flex-1 min-w-0">
            {displayName
              ? <div><p className="text-sm font-medium text-emerald-400 truncate">{displayName}</p><p className="text-xs text-slate-400 mt-0.5">Ready for upload</p></div>
              : <div>
                <p className="text-sm font-medium text-slate-300">Click or drag to upload</p>
                <p className="text-xs text-slate-500 mt-0.5">{hint || 'PDF, JPG, PNG — Max 2MB'}</p>
                {existingUrl && !uploadedFile && (
                  <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-[10px] hover:underline mt-1 block" onClick={e => e.stopPropagation()}>View existing document</a>
                )}
              </div>}
          </div>
          {displayName && (
            <button type="button" onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
              className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>}
    </div>
  );
};

const ProgressSidebar: React.FC<{
  currentStep: number;
  docSubStep: number;
  uploadedCount: number;
  totalDocs: number;
  commonData: CommonFormData;
  onPreview: () => void;
  isDraftSaving: boolean;
  lastDraftSavedAt: Date | null;
}> = ({ currentStep, docSubStep, uploadedCount, totalDocs, commonData, onPreview, isDraftSaving, lastDraftSavedAt }) => {
  const steps = STEP_LABELS.map((label, i) => ({ label, step: i }));
  return (
    <div className="space-y-6 hidden lg:block">
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
          <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </span>
          Progress Status
        </h3>
        {lastDraftSavedAt && (
          <div className="mb-4 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              {isDraftSaving ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Draft Saved
                </>
              )}
            </span>
            {!isDraftSaving && (
              <span className="text-[9px] text-white font-medium opacity-60">
                {lastDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
        <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
          {steps.map(({ label, step }) => {
            const status = step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending';
            return (
              <div key={step} className="ml-5 relative">
                <span className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : status === 'active' ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110' : 'bg-slate-700'}`} />
                <h4 className={`text-sm font-medium ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}>{label}</h4>
                <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
                  {step === 3
                    ? `${uploadedCount}/${totalDocs} Docs • Page ${docSubStep}/5`
                    : status === 'completed' ? 'Completed'
                      : status === 'active' ? 'In Progress' : 'Pending'}
                </p>
                {step === 3 && status === 'active' && (
                  <div className="mt-2 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min((uploadedCount / totalDocs) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-amber-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </span>
          Entity Information
        </h3>
        <div className="space-y-2 text-xs">
          {commonData.businessName && <div><span className="text-white">Business Name:</span><p className="text-white font-medium mt-0.5">{commonData.businessName}</p></div>}
          {commonData.constitution && <div><span className="text-white">Constitution:</span><p className="text-white mt-0.5">{commonData.constitution}</p></div>}
          {commonData.panNumber && <div><span className="text-white">PAN:</span><p className="text-white font-mono mt-0.5">{commonData.panNumber}</p></div>}
        </div>
        <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
          ✓ GST Registration — LLP
        </div>
      </div>
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-rose-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </span>
          Support Verification
        </h3>
        <p className="text-xs text-white leading-relaxed mb-3">Our team will contact you on the provided mobile for OTP/Aadhaar verification after submission.</p>
        <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5">
          <span className="text-white font-medium text-xs">contact Support</span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
          </div>
        </div>
      </div>

      {/* Preview button */}
      <div className="pt-2">
        <button onClick={onPreview}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600/50 text-emerald-400 font-bold tracking-wide shadow-lg hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Preview Application
        </button>
      </div>
    </div>
  );
};

// 🔥 UPDATED: StatusBanner now accepts caseId
const StatusBanner: React.FC<{ caseId: string }> = ({ caseId }) => (
  <div className="bg-gradient-to-r from-orange-900/30 to-orange-800/10 border border-orange-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none" />
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-white font-medium line-through text-lg">₹999</span>
        <span className="text-white font-bold text-2xl tracking-tight drop-shadow-sm">FREE</span>
        <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">Limited Offer</span>
      </div>
      <p className="text-white text-sm mt-1">GST Registration — Limited Liability Partnership</p>
      <p className="text-sky-400 text-xs mt-2 font-medium flex items-center">
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        OTP/Aadhaar verification will be done by Support Team after submission.
      </p>
    </div>
    <div className="text-left sm:text-right z-10">
      <p className="text-xs font-semibold text-white uppercase tracking-wider">Case Reference</p>
      <p className="text-white font-mono font-bold text-lg md:text-xl tracking-wider">{caseId || '—'}</p>
    </div>
  </div>
);

const SectionLegend: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
    <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
    {title}
  </div>
);

const ConfirmModal: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
      </div>
      <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} className="px-6 py-2.5 bg-gradient-to-r from-teal-700 to-blue-900 hover:from-teal-600 hover:to-blue-800 text-white font-medium rounded-lg transition-colors">Confirm</button>
      </div>
    </div>
  </div>
);

const ErrorToast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-red-500/90 backdrop-blur-sm border border-red-400 rounded-xl p-4 shadow-2xl max-w-md flex items-start gap-3">
        <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-white text-sm flex-1">{message}</p>
        <button onClick={onClose} className="text-white/70 hover:text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
    </div>
  );
};

const ProcessingOverlay: React.FC = () => (
  <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div className="w-16 h-16 mx-auto mb-6">
        <svg className="animate-spin w-full h-full text-cyan-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
      <p className="text-slate-400 text-sm">Please wait while we submit your application.</p>
      <p className="text-slate-500 text-xs mt-1">Do not close this window.</p>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function LLPForm({ user, commonData, packageMode = false, onBack, onSubmit, INDIAN_STATES, STATE_DISTRICTS }: LLPFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [caseId, setCaseId] = useState<string>('');
  // Steps: 0=AuthorizedPerson, 1=Address, 2=NatureOfBusiness, 3=Documents, 4=Declaration
  const [currentStep, setCurrentStep] = useState(0);
  const [docSubStep, setDocSubStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [propertyType, setPropertyType] = useState<'owned' | 'rented'>('owned');
  const [availableDistricts, setAvailableDistricts] = useState<{ value: string; label: string }[]>([]);
  // 🔥 NEW: Utility Bill Selection State
  const [selectedUtilityType, setSelectedUtilityType] = useState<string>('');
  const [includeSignatoryDetails, setIncludeSignatoryDetails] = useState(false);
  const [signatoryData, setSignatoryData] = useState({
    firstName: '', middleName: '', lastName: '',
    fatherFirstName: '', fatherMiddleName: '', fatherLastName: '',
    mobile: '', email: '',
  });
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, boolean>>(INITIAL_UPLOADED_DOCS);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    masterData: null, companyPan: null, llpAgreement: null, companyCoi: null,
    companyMoa: null, companyAoa: null, cancelledCheque: null, bankStatement: null,
    signPan: null, signAadhaar: null, signPhoto: null, signAuthLetter: null,
    rentAgreement: null, utilityBill: null, dsc: null, geoTagPhoto: null,
  });
  const [docFileNames, setDocFileNames] = useState<Partial<Record<DocKey, string>>>({});
  const [partnerFileNames, setPartnerFileNames] = useState<Record<string, { pan?: string; aadhaar?: string; photo?: string }>>({});
  const [confirmConfig, setConfirmConfig] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [existingDocs, setExistingDocs] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 🔥 Ref for auto-saving on close (avoids stale closures in useEffect cleanup)
  const dataRef = useRef({ formData, partners, currentStep, docSubStep, propertyType, selectedUtilityType, signatoryData, includeSignatoryDetails, caseId, existingDocs: null as any });
  useEffect(() => {
    dataRef.current = { formData, partners, currentStep, docSubStep, propertyType, selectedUtilityType, signatoryData, includeSignatoryDetails, caseId, existingDocs };
  }, [formData, partners, currentStep, docSubStep, propertyType, selectedUtilityType, signatoryData, includeSignatoryDetails, caseId, existingDocs]);

  // ── Draft Loading & ID Generation ─────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!user?.uid) {
        setIsInitialLoading(false);
        return;
      }
      try {
        // Use LLP-specific draft key to avoid cross-contamination with other GST forms
        const draftRef = doc(db, 'drafts', `gst_llp_${user.uid}`);
        const draftSnap = await getDoc(draftRef);
        if (draftSnap.exists()) {
          const d = draftSnap.data();
          // Guard: ensure it's the right constitution type
          if (d.constitution === 'LLP' || d.servicePanelType === 'llp') {
            if (d.formData) setFormData(p => ({ ...INITIAL_DATA, ...d.formData }));
            setCurrentStep(d.currentStep ?? 0);
            setDocSubStep(d.docSubStep ?? 1);
            if (d.partners && d.partners.length > 0) setPartners(d.partners);
            if (d.uploadedDocs) setUploadedDocs(d.uploadedDocs);
            if (d.docFileNames) setDocFileNames(d.docFileNames);
            if (d.partnerFileNames) setPartnerFileNames(d.partnerFileNames);
            setPropertyType(d.propertyType || 'owned');
            setSelectedUtilityType(d.selectedUtilityType || '');
            setIncludeSignatoryDetails(d.includeSignatoryDetails || false);
            if (d.signatoryData) setSignatoryData(d.signatoryData);
            if (d.caseId) setCaseId(d.caseId);
            if (d.uploadedFileUrls) setExistingDocs(d.uploadedFileUrls);
            setLastDraftSavedAt(d.updatedAt?.toDate() || new Date());
            setIsInitialLoading(false);
            return;
          }
        }
        
        // No valid draft found — generate a new case ID
        const id = await generateSequentialFormId('GST-LLP', new Date().getFullYear());
        setCaseId(id);
      } catch (err) {
        console.error("Draft load failed:", err);
        setCaseId(`GST-LLP-${new Date().getFullYear()}-01`);
      } finally {
        setIsInitialLoading(false);
      }
    };
    init();
  }, [user?.uid]);

  const saveDraft = async (stepOverride?: number, force = false) => {
    if (!user?.uid || packageMode) return;
    // Skip if still loading initial data, unless forced (e.g., exit button)
    if (isInitialLoading && !force) return;
    setIsDraftSaving(true);
    try {
      const draftData = {
        userId: user.uid,
        userEmail: user.email || '',
        serviceType: 'gst',
        title: 'GST Registration',
        constitution: commonData.constitution || 'LLP',
        commonData: commonData,
        formData,
        partners,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        docSubStep,
        propertyType,
        selectedUtilityType,
        signatoryData,
        includeSignatoryDetails,
        uploadedDocs,
        docFileNames,
        partnerFileNames,
        updatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        status: 'draft',
        caseId: caseId,
        uploadedFileUrls: existingDocs,
        servicePanelType: 'llp',
        routeState: { preSelectedType: 'llp' },
      };
      await setDoc(doc(db, 'drafts', `gst_llp_${user.uid}`), draftData, { merge: true });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error("Draft save failed:", err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting || isInitialLoading) return;
      // Trigger a silent save using ref data (avoids stale closures)
      const d = dataRef.current;
      const draftData = {
        userId: user.uid,
        userEmail: user.email || '',
        serviceType: 'gst',
        title: 'GST Registration',
        constitution: commonData.constitution || 'LLP',
        commonData: commonData,
        formData: d.formData,
        partners: d.partners,
        currentStep: d.currentStep,
        docSubStep: d.docSubStep,
        propertyType: d.propertyType,
        selectedUtilityType: d.selectedUtilityType,
        signatoryData: d.signatoryData,
        includeSignatoryDetails: d.includeSignatoryDetails,
        uploadedDocs: uploadedDocs,
        docFileNames: docFileNames,
        partnerFileNames: partnerFileNames,
        updatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        status: 'draft',
        caseId: d.caseId,
        uploadedFileUrls: d.existingDocs,
        servicePanelType: 'llp',
        routeState: { preSelectedType: 'llp' },
      };
      setDoc(doc(db, 'drafts', `gst_llp_${user.uid}`), draftData, { merge: true });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Auto-save on unmount (navigation away) — only if not submitting
      if (!isSubmitting && !isInitialLoading) {
        saveDraft();
      }
    };
  }, [user?.uid, isSubmitting, isInitialLoading]);

  useEffect(() => {
    if (formData.state) {
      setAvailableDistricts(STATE_DISTRICTS[formData.state] || []);
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.state]);

  // ── Doc counts ───────────────────────────────────────────────────────────
  const getTotalDocs = () => {
    let n = 9; // masterData + 6 corp + dsc
    n += partners.length * 3;
    n += 1; // utilityBill (single)
    if (propertyType === 'rented') n += 1; // rentAgreement
    if (includeSignatoryDetails) n += 4;
    n += 1; // geoTagPhoto
    return n;
  };

  const getUploadedCount = () => {
    let n = 0;
    const keys: DocKey[] = ['masterData', 'companyPan', 'llpAgreement', 'companyCoi', 'companyMoa', 'companyAoa', 'cancelledCheque', 'bankStatement', 'dsc', 'geoTagPhoto'];
    keys.forEach(k => { if (uploadedDocs[k]) n++; });
    partners.forEach(p => { if (p.panFile) n++; if (p.aadhaarFile) n++; if (p.photoFile) n++; });
    if (uploadedDocs.utilityBill) n++;
    if (propertyType === 'rented' && uploadedDocs.rentAgreement) n++;
    if (includeSignatoryDetails) {
      (['signPan', 'signAadhaar', 'signPhoto', 'signAuthLetter'] as DocKey[]).forEach(k => { if (uploadedDocs[k]) n++; });
    }
    return n;
  };

  // ── Field change/blur ────────────────────────────────────────────────────
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    let v: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    if (name === 'promoterMobile') v = v.replace(/\D/g, '').slice(0, 10);
    if (name === 'promoterAadhaar') v = v.replace(/\D/g, '').slice(0, 12);
    if (name === 'pincode') v = v.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, [key]: v }));
    if (touched[name]) setErrors(prev => ({ ...prev, [name]: validateField(name, v) }));
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, v) }));
  };

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'promoterName': return validators.name(value) === true ? '' : validators.name(value) as string;
      case 'promoterDob': return validators.dob(value) === true ? '' : validators.dob(value) as string;
      case 'promoterEmail': return validators.email(value) === true ? '' : validators.email(value) as string;
      case 'promoterMobile': return validators.mobile(value) === true ? '' : validators.mobile(value) as string;
      case 'promoterAadhaar': return validators.aadhaar(value) === true ? '' : validators.aadhaar(value) as string;
      case 'addressLine1': return validators.required(value, 'Address Line 1') === true ? '' : validators.required(value, 'Address Line 1') as string;
      case 'city': return validators.required(value, 'City/District') === true ? '' : validators.required(value, 'City/District') as string;
      case 'state': return validators.required(value, 'State') === true ? '' : validators.required(value, 'State') as string;
      case 'pincode': return validators.pincode(value) === true ? '' : validators.pincode(value) as string;
      case 'natureOfBusiness': return validators.required(value, 'Nature of Business') === true ? '' : validators.required(value, 'Nature of Business') as string;
      case 'consent1': case 'consent2': return value ? '' : 'Declaration is required';
      default: return '';
    }
  };

  const validateStep = (step: number): boolean => {
    const fieldMap: Record<number, string[]> = {
      0: ['promoterName', 'promoterDob', 'promoterEmail', 'promoterMobile', 'promoterAadhaar'],
      1: ['addressLine1', 'city', 'state', 'pincode'],
      2: ['natureOfBusiness'],
      4: ['consent1', 'consent2'],
    };
    const fields = fieldMap[step] || [];
    const newErrors: Record<string, string> = {};
    fields.forEach(k => { const e = validateField(k, (formData as any)[k]); if (e) newErrors[k] = e; });
    setErrors(p => ({ ...p, ...newErrors }));
    setTouched(p => { const t = { ...p }; fields.forEach(f => (t[f] = true)); return t; });
    return Object.keys(newErrors).length === 0;
  };

  const validateDocSubStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    let ok = true;
    if (docSubStep === 1) {
      if (!uploadedDocs.masterData) { newErrors['masterData'] = 'Master Data is required'; ok = false; }
      if (!uploadedDocs.companyPan) { newErrors['companyPan'] = 'Company PAN is required'; ok = false; }
      if (!uploadedDocs.llpAgreement) { newErrors['llpAgreement'] = 'LLP Agreement is required'; ok = false; }
      if (!uploadedDocs.companyCoi) { newErrors['companyCoi'] = 'Certificate of Incorporation is required'; ok = false; }
      if (!uploadedDocs.companyMoa) { newErrors['companyMoa'] = 'MOA is required'; ok = false; }
      if (!uploadedDocs.companyAoa) { newErrors['companyAoa'] = 'AOA is required'; ok = false; }
      if (!uploadedDocs.cancelledCheque) { newErrors['cancelledCheque'] = 'Cancelled Cheque is required'; ok = false; }
      if (!uploadedDocs.bankStatement) { newErrors['bankStatement'] = 'Bank Statement is required'; ok = false; }
    }
    if (docSubStep === 2) {
      if (partners.length < 2) { setErrorMsg('Minimum 2 partners are required for LLP.'); return false; }
      let hasPrimary = false;
      partners.forEach(p => {
        if (p.isPrimary) hasPrimary = true;
        if (!p.firstName || p.firstName.trim().length < 1) {
          newErrors[`partner-${p.id}-firstName`] = 'First Name required'; ok = false;
        }
        if (!p.lastName || p.lastName.trim().length < 1) {
          newErrors[`partner-${p.id}-lastName`] = 'Last Name required'; ok = false;
        }
        const mobileClean = p.mobile?.replace(/\D/g, '') || '';
        if (!mobileClean || mobileClean.length !== 10 || !/^[6-9]/.test(mobileClean)) {
          newErrors[`partner-${p.id}-mobile`] = 'Valid 10-digit mobile required (starts with 6-9)'; ok = false;
        }
        const emailTrimmed = p.email?.trim() || '';
        if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
          newErrors[`partner-${p.id}-email`] = 'Valid email address required'; ok = false;
        }
        if (!p.fatherName?.firstName?.trim()) {
          newErrors[`partner-${p.id}-fatherFirstName`] = "Father's First Name required"; ok = false;
        }
        if (!p.fatherName?.lastName?.trim()) {
          newErrors[`partner-${p.id}-fatherLastName`] = "Father's Last Name required"; ok = false;
        }
        if (!p.panFile) { newErrors[`partner-${p.id}-pan`] = 'PAN upload required'; ok = false; }
        if (!p.aadhaarFile) { newErrors[`partner-${p.id}-aadhaar`] = 'Aadhaar upload required'; ok = false; }
        if (!p.photoFile) { newErrors[`partner-${p.id}-photo`] = 'Photo upload required'; ok = false; }
      });
      if (!hasPrimary) { newErrors['primary-partner'] = 'Please select a Primary Designated Partner'; ok = false; }
    }
    if (docSubStep === 3) {
      if (!selectedUtilityType) {
        newErrors['utilityType'] = 'Please select a Utility Bill type';
        ok = false;
      } else if (!uploadedDocs.utilityBill) {
        newErrors['utilityBill'] = 'Please upload the selected Utility Bill';
        ok = false;
      }
      if (propertyType === 'rented') {
        if (!uploadedDocs.rentAgreement) { newErrors['rentAgreement'] = 'Rent Agreement required'; ok = false; }
      }
      if (!uploadedDocs.geoTagPhoto) {
        newErrors['geoTagPhoto'] = 'Geo-tagged location photo is required';
        ok = false;
      }
    }
    if (docSubStep === 4 && includeSignatoryDetails) {
      if (!signatoryData.firstName.trim()) { newErrors['sigFirstName'] = 'First Name required'; ok = false; }
      if (!signatoryData.lastName || signatoryData.lastName.trim().length < 1) { newErrors['sigLastName'] = 'Last Name required'; ok = false; }
      const sigMobileClean = signatoryData.mobile?.replace(/\D/g, '') || '';
      if (!sigMobileClean || sigMobileClean.length !== 10 || !/^[6-9]/.test(sigMobileClean)) {
        newErrors['sigMobile'] = 'Valid 10-digit mobile required'; ok = false;
      }
      const sigEmailTrimmed = signatoryData.email?.trim() || '';
      if (!sigEmailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sigEmailTrimmed)) {
        newErrors['sigEmail'] = 'Valid email required'; ok = false;
      }
      if (!signatoryData.fatherFirstName.trim()) { newErrors['sigFatherFirstName'] = "Father's First Name required"; ok = false; }
      if (!signatoryData.fatherLastName.trim()) { newErrors['sigFatherLastName'] = "Father's Last Name required"; ok = false; }
      if (!uploadedDocs.signPan) { newErrors['signPan'] = 'PAN required'; ok = false; }
      if (!uploadedDocs.signAadhaar) { newErrors['signAadhaar'] = 'Aadhaar required'; ok = false; }
      if (!uploadedDocs.signPhoto) { newErrors['signPhoto'] = 'Photo required'; ok = false; }
      if (!uploadedDocs.signAuthLetter) { newErrors['signAuthLetter'] = 'Authorization Letter required'; ok = false; }
    }
    if (docSubStep === 5) {
      if (!uploadedDocs.dsc) { newErrors['dsc'] = 'DSC is required'; ok = false; }
    }
    setErrors(p => ({ ...p, ...newErrors }));
    if (!ok) setErrorMsg('Please complete all required fields before proceeding.');
    return ok;
  };

  const handleNext = async () => {
    if (currentStep === 3) {
      if (!validateDocSubStep()) return;
      if (docSubStep < 5) {
        const nextSubStep = docSubStep + 1;
        setDocSubStep(nextSubStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await saveDraft();
        return;
      }
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await saveDraft(4);
      return;
    }
    if (currentStep === 4) {
      if (!validateStep(4)) return;
      setShowPreview(true);
      return;
    }
    if (!validateStep(currentStep)) return;
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await saveDraft(nextStep);
  };

  const handlePrev = async () => {
    if (currentStep === 3 && docSubStep > 1) {
      setDocSubStep(p => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await saveDraft();
      return;
    }
    if (currentStep === 0) {
      await saveDraft(0);
      onBack();
      return;
    }
    if (currentStep === 4) {
      setCurrentStep(3);
      setDocSubStep(5);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await saveDraft(3);
      return;
    }
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await saveDraft(prevStep);
  };

  const handleFileUpload = (key: DocKey) => (file: File | null) => {
    setUploadedFiles(p => ({ ...p, [key]: file }));
    setUploadedDocs(p => ({ ...p, [key]: !!file }));
    setDocFileNames(p => ({ ...p, [key]: file ? file.name : undefined }));
    setErrors(p => ({ ...p, [key]: undefined }));
  };

  const handlePartnerFileUpload = (id: string, field: 'panFile' | 'aadhaarFile' | 'photoFile') => (file: File | null) => {
    setPartners(p => p.map(x => x.id === id ? { ...x, [field]: !!file } : x));
    if (file) {
      const fk = field === 'panFile' ? 'pan' : field === 'aadhaarFile' ? 'aadhaar' : 'photo';
      setPartnerFileNames(p => ({ ...p, [id]: { ...p[id], [fk]: file.name } }));
    }
    const ek = field === 'panFile' ? 'pan' : field === 'aadhaarFile' ? 'aadhaar' : 'photo';
    setErrors(p => ({ ...p, [`partner-${id}-${ek}`]: undefined }));
  };

  const handlePartnerChange = (id: string, field: keyof Partner, value: any) => {
    setPartners(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const addPartner = () => {
    setPartners(p => [...p, { id: Date.now().toString(), designation: 'Designated Partner', isPrimary: false, firstName: '', middleName: '', lastName: '', fatherName: { firstName: '', middleName: '', lastName: '' }, mobile: '', email: '', panFile: false, aadhaarFile: false, photoFile: false }]);
  };

  const removePartner = (id: string) => {
    if (partners.length <= 2) { setErrorMsg('Minimum 2 partners required for LLP.'); return; }
    setPartners(p => p.filter(x => x.id !== id));
  };

  const executeSubmission = async () => {
    setIsSubmitting(true);
    try {
      const docRef = doc(collection(db, 'applications'));
      const fid = docRef.id;
      const fileUrls: Record<string, string> = {};
      for (const [k, file] of Object.entries(uploadedFiles)) {
        if (file && user?.uid) {
          const cleanName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `gst-applications/${user.uid}/${fid}/${k}_${Date.now()}.${cleanName.split('.').pop()}`;
          const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
          fileUrls[k] = await getDownloadURL(snap.ref);
        }
      }
      const payload = {
        id: fid, caseId, type: 'gst', constitution: 'Limited Liability Partnership',
        title: 'GST Registration — LLP', status: 'submitted',
        submittedAt: serverTimestamp(), commonData, formData, partners,
        propertyType, selectedUtilityType, uploadedFileUrls: fileUrls, userId: user?.uid,
        folderId: user?.folderId || 'regibiz', paymentId: 'FREE_SUBMISSION',
        createdAt: Date.now(), includeSignatoryDetails,
        signatoryDetails: includeSignatoryDetails ? signatoryData : null,
        geoTagMetadata: null,
      };
      if (!packageMode) {
        await setDoc(doc(db, 'applications', fid), payload);
        try {
          await Promise.allSettled([
            deleteDoc(doc(db, 'drafts', `gst_${user.uid}`)),
            deleteDoc(doc(db, 'drafts', `gst_llp_${user.uid}`)),
          ]);
        } catch (err) {
          console.error("Failed to delete draft:", err);
        }
      }
      if (onSubmit) {
        const filesToSubmit: Record<string, File> = {};
        Object.entries(uploadedFiles).forEach(([k, v]) => { if (v) filesToSubmit[k] = v; });
        await onSubmit(payload, filesToSubmit);
      }
      if (packageMode) {
        setIsSubmitting(false);
        return;
      }
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Registered Office Address" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">Enter address <strong>exactly as it appears on your address proof document</strong>. This will be the registered office address on GSTIN.</p>
      </div>
      <FormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1}
        onChange={handleChange} onBlur={handleBlur} error={errors.addressLine1}
        placeholder="Flat / Plot No., Building Name, Street" required
        infoText="Door/flat number, building name, street name — as per address proof." />
      <FormInput label="Address Line 2 / Landmark" name="addressLine2" value={formData.addressLine2}
        onChange={handleChange} onBlur={handleBlur}
        placeholder="Area / Colony / Locality (optional)" optional />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormSelect label="State / UT" name="state" value={formData.state}
          onChange={handleChange} onBlur={handleBlur} error={errors.state}
          options={INDIAN_STATES} required />
        <FormInput label="City / District" name="city" value={formData.city}
          onChange={handleChange} onBlur={handleBlur} error={errors.city}
          placeholder="Enter city name" required />
      </div>
      <FormInput label="Pincode" name="pincode" value={formData.pincode}
        onChange={handleChange} onBlur={handleBlur} error={errors.pincode}
        placeholder="6-digit pincode" maxLength={6} required />
    </fieldset>
  );

  const renderAddressProofStep = () => (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        {(['owned', 'rented'] as const).map(type => (
          <label key={type} className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${propertyType === type
            ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
            }`}>
            <input
              type="radio"
              name="propertyType"
              value={type}
              checked={propertyType === type}
              onChange={() => {
                setPropertyType(type);
                setSelectedUtilityType('');
                setUploadedFiles(p => ({ ...p, utilityBill: null }));
                setUploadedDocs(p => ({ ...p, utilityBill: false }));
                setErrors(p => ({ ...p, utilityType: undefined, utilityBill: undefined }));
              }}
              className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-600 focus:ring-cyan-500"
            />
            <span className="text-sm font-medium text-white capitalize">{type} Property</span>
          </label>
        ))}
      </div>
      {propertyType === 'rented' && (
        <div className="mb-6 animate-fade-in">
          <FileUploader
            label="Rent Agreement"
            name="rentAgreement"
            required
            uploadedFile={uploadedFiles.rentAgreement}
            onChange={handleFileUpload('rentAgreement')}
            hint="Valid registered rent agreement (All pages)"
            error={errors.rentAgreement}
            existingUrl={existingDocs?.rentAgreement?.url}
          />
        </div>
      )}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <h4 className="text-white font-semibold mb-4 flex items-center gap-2 relative z-10">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Utility Bill Proof <span className="text-red-500">*</span>
          <span className="text-xs font-normal text-slate-400 ml-2">(Required for {propertyType === 'owned' ? 'Owned' : 'Rented'} Property)</span>
        </h4>
        <div className="grid grid-cols-1 gap-5 relative z-10">
          <FormSelect
            label="Select Utility Bill Type"
            value={selectedUtilityType}
            onChange={(e) => {
              setSelectedUtilityType(e.target.value);
              setUploadedFiles(p => ({ ...p, utilityBill: null }));
              setUploadedDocs(p => ({ ...p, utilityBill: false }));
              setErrors(p => ({ ...p, utilityType: undefined, utilityBill: undefined }));
            }}
            options={UTILITY_OPTIONS}
            error={errors.utilityType}
            required
          />
          {selectedUtilityType && (
            <div className="animate-fade-in mt-2">
              <FileUploader
                label={`${UTILITY_OPTIONS.find(o => o.value === selectedUtilityType)?.label} Upload`}
                name="utilityBill"
                required
                uploadedFile={uploadedFiles.utilityBill}
                onChange={handleFileUpload('utilityBill')}
                hint={`Upload clear scan of ${selectedUtilityType} bill (not older than 2 months)`}
                error={errors.utilityBill}
                existingUrl={existingDocs?.utilityBill?.url}
                infoText="Ensure the address on the bill matches your registered office address."
              />
            </div>
          )}
          {!selectedUtilityType && (
            <p className="text-xs text-slate-500 italic mt-2">
              ℹ️ Please select a utility bill type above to reveal the upload field.
            </p>
          )}
        </div>
      </div>
      <div className="mt-2">
        <FileUploader
          label="Geo-Tagged Location Photo"
          name="geoTagPhoto"
          required
          uploadedFile={uploadedFiles.geoTagPhoto}
          onChange={(file) => {
            setUploadedFiles(p => ({ ...p, geoTagPhoto: file }));
            setUploadedDocs(p => ({ ...p, geoTagPhoto: !!file }));
            if (file) setDocFileNames(p => ({ ...p, geoTagPhoto: file.name }));
            else setDocFileNames(p => ({ ...p, geoTagPhoto: undefined }));
            setErrors(p => ({ ...p, geoTagPhoto: undefined }));
          }}
          accept=".jpg,.jpeg,.png"
          hint="JPG, PNG — Max 2MB"
          error={errors.geoTagPhoto}
          existingUrl={existingDocs?.geoTagPhoto?.url}
          infoText="Upload a clear photo of the business premises. GPS coordinates will be verified later if required."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <SectionLegend title={
            docSubStep === 1 ? 'Corporate Identity & Bank Proof' :
              docSubStep === 2 ? 'Partner Details & Documents' :
                docSubStep === 3 ? 'Address Proof Documents' :
                  docSubStep === 4 ? 'Authorized Signatory (Optional)' :
                    'Digital Signature Certificate'
          } />
        </div>
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${s < docSubStep ? 'bg-emerald-500' : s === docSubStep ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-slate-700'}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          {['Corporate Docs', 'Partners', 'Address Proof', 'Signatory', 'DSC'].map((l, i) => (
            <span key={i} className={i + 1 === docSubStep ? 'text-cyan-400 font-medium' : ''}>{l}</span>
          ))}
        </div>
      </div>
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">
          Documents for <strong>GST Registration — LLP</strong>. Fields marked <span className="text-red-400">*</span> are mandatory. Max 2MB per file — PDF, JPG, PNG accepted.
        </p>
      </div>
      {docSubStep === 1 && (
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-400 rounded-full inline-block" />
              Master Data
            </legend>
            <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4 mb-4">
              <p className="text-xs text-amber-300 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Master Data is the consolidated data sheet containing all entity details, partner information, and signatories compiled for GST portal filing. Download the template, fill it, and upload here.
              </p>
            </div>
            <FileUploader label="Master Data Sheet" name="masterData" required
              uploadedFile={uploadedFiles.masterData}
              onChange={handleFileUpload('masterData')}
              hint="Filled Master Data template — PDF / Excel"
              error={errors.masterData}
              existingUrl={existingDocs?.masterData?.url}
              infoText="The master data sheet consolidates all LLP entity and partner information required for GST filing. Our team will provide the template." />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-400 rounded-full inline-block" />
              Corporate Identity Documents
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FileUploader label="PAN Card of the LLP" name="companyPan" required
                uploadedFile={uploadedFiles.companyPan} onChange={handleFileUpload('companyPan')}
                hint="PAN Card of the LLP entity" error={errors.companyPan}
                existingUrl={existingDocs?.companyPan?.url}
                infoText="Upload the PAN card of the LLP entity — not the individual partner's PAN." />
              <FileUploader label="Certificate of Incorporation (COI)" name="companyCoi" required
                uploadedFile={uploadedFiles.companyCoi} onChange={handleFileUpload('companyCoi')}
                hint="Issued by MCA" error={errors.companyCoi}
                existingUrl={existingDocs?.companyCoi?.url}
                infoText="MCA-issued Certificate of Incorporation for the LLP." />
              <FileUploader label="Memorandum of Association (MOA)" name="companyMoa" required
                uploadedFile={uploadedFiles.companyMoa} onChange={handleFileUpload('companyMoa')}
                hint="Signed MOA" error={errors.companyMoa}
                existingUrl={existingDocs?.companyMoa?.url} />
              <FileUploader label="Articles of Association (AOA)" name="companyAoa" required
                uploadedFile={uploadedFiles.companyAoa} onChange={handleFileUpload('companyAoa')}
                hint="Signed AOA" error={errors.companyAoa}
                existingUrl={existingDocs?.companyAoa?.url} />
              <FileUploader label="LLP Agreement" name="llpAgreement" required
                uploadedFile={uploadedFiles.llpAgreement} onChange={handleFileUpload('llpAgreement')}
                hint="Registered LLP Agreement" error={errors.llpAgreement}
                existingUrl={existingDocs?.llpAgreement?.url}
                infoText="Stamped and registered LLP Agreement as filed with MCA." />
            </div>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-400 rounded-full inline-block" />
              Business Bank Account Proof
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FileUploader label="Cancelled Cheque" name="cancelledCheque" required
                uploadedFile={uploadedFiles.cancelledCheque} onChange={handleFileUpload('cancelledCheque')}
                hint="Clear image of cancelled cheque" error={errors.cancelledCheque}
                existingUrl={existingDocs?.cancelledCheque?.url}
                infoText="Cancelled cheque of the LLP's business current account." />
              <FileUploader label="Latest Bank Statement" name="bankStatement" required
                uploadedFile={uploadedFiles.bankStatement} onChange={handleFileUpload('bankStatement')}
                hint="Last 1–3 months statement" error={errors.bankStatement}
                existingUrl={existingDocs?.bankStatement?.url}
                infoText="Recent bank statement of the LLP's business account." />
            </div>
          </fieldset>
        </div>
      )}
      {docSubStep === 2 && (
        <div className="space-y-6">
          {errors['primary-partner'] && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{errors['primary-partner']}</div>
          )}
          {partners.map((partner, index) => (
            <div key={partner.id} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/60">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-white font-semibold text-base flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold text-white">{index + 1}</span>
                  Partner {index + 1}
                  {partner.isPrimary && <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full ml-2">Primary</span>}
                </h4>
                {partners.length > 2 && (
                  <button type="button" onClick={() => removePartner(partner.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors">Remove</button>
                )}
              </div>
              <div className="mb-5 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="primary-partner" checked={partner.isPrimary}
                    onChange={() => setPartners(p => p.map(x => ({ ...x, isPrimary: x.id === partner.id })))}
                    className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm text-slate-300">Mark as Primary Designated Partner</span>
                </label>
              </div>
              <FormSelect label="Designation" value={partner.designation} name={`designation-${partner.id}`}
                onChange={e => handlePartnerChange(partner.id, 'designation', e.target.value)}
                options={DESIGNATION_OPTIONS} required />
              <div className="mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Partner Name</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormInput
                    label="First Name"
                    value={partner.firstName || ''}
                    name={`fn-${partner.id}`}
                    onChange={e => handlePartnerChange(partner.id, 'firstName', e.target.value)}
                    onBlur={() => {
                      const p = partners.find(x => x.id === partner.id);
                      if (!p?.firstName?.trim()) {
                        setErrors(prev => ({ ...prev, [`partner-${partner.id}-firstName`]: 'First Name required' }));
                      } else {
                        setErrors(prev => ({ ...prev, [`partner-${partner.id}-firstName`]: undefined }));
                      }
                    }}
                    error={errors[`partner-${partner.id}-firstName`]}
                    required
                    placeholder="First name"
                  />
                  <FormInput label="Middle Name" value={partner.middleName || ''} name={`mn-${partner.id}`}
                    onChange={e => handlePartnerChange(partner.id, 'middleName', e.target.value)} optional placeholder="Optional" />
                  <FormInput label="Last Name" value={partner.lastName || ''} name={`ln-${partner.id}`}
                    onChange={e => handlePartnerChange(partner.id, 'lastName', e.target.value)}
                    error={errors[`partner-${partner.id}-lastName`]} required placeholder="Last name" />
                </div>
              </div>
              <div className="mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Father's Name</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormInput label="First Name" value={partner.fatherName?.firstName || ''} name={`ffn-${partner.id}`}
                    onChange={e => handlePartnerChange(partner.id, 'fatherName', { ...partner.fatherName, firstName: e.target.value })}
                    error={errors[`partner-${partner.id}-fatherFirstName`]} required placeholder="Father's first" />
                  <FormInput label="Middle Name" value={partner.fatherName?.middleName || ''} name={`fmn-${partner.id}`}
                    onChange={e => handlePartnerChange(partner.id, 'fatherName', { ...partner.fatherName, middleName: e.target.value })} optional placeholder="Optional" />
                  <FormInput label="Last Name" value={partner.fatherName?.lastName || ''} name={`fln-${partner.id}`}
                    onChange={e => handlePartnerChange(partner.id, 'fatherName', { ...partner.fatherName, lastName: e.target.value })}
                    error={errors[`partner-${partner.id}-fatherLastName`]} required placeholder="Father's last" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <FormInput label="Mobile (Aadhaar Linked)" type="tel" value={partner.mobile} name={`mobile-${partner.id}`}
                  onChange={e => handlePartnerChange(partner.id, 'mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  error={errors[`partner-${partner.id}-mobile`]} required placeholder="10-digit mobile" maxLength={10} />
                <FormInput label="Email ID" type="email" value={partner.email} name={`email-${partner.id}`}
                  onChange={e => handlePartnerChange(partner.id, 'email', e.target.value)}
                  error={errors[`partner-${partner.id}-email`]} required placeholder="email@example.com" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Documents</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FileUploader label="PAN Card" name={`pan-${partner.id}`} required
                  uploadedFile={null} onChange={handlePartnerFileUpload(partner.id, 'panFile')}
                  fileName={partnerFileNames[partner.id]?.pan || null}
                  error={errors[`partner-${partner.id}-pan`]} hint="Clear scan of PAN"
                  existingUrl={existingDocs?.[`partner-${partner.id}-pan`]?.url} />
                <FileUploader label="Aadhaar Card" name={`aadhaar-${partner.id}`} required
                  uploadedFile={null} onChange={handlePartnerFileUpload(partner.id, 'aadhaarFile')}
                  fileName={partnerFileNames[partner.id]?.aadhaar || null}
                  error={errors[`partner-${partner.id}-aadhaar`]} hint="Both sides scanned"
                  existingUrl={existingDocs?.[`partner-${partner.id}-aadhaar`]?.url} />
                <FileUploader label="Passport Photo" name={`photo-${partner.id}`} required
                  uploadedFile={null} onChange={handlePartnerFileUpload(partner.id, 'photoFile')}
                  fileName={partnerFileNames[partner.id]?.photo || null}
                  error={errors[`partner-${partner.id}-photo`]} accept=".jpg,.jpeg,.png" hint="White background"
                  existingUrl={existingDocs?.[`partner-${partner.id}-photo`]?.url} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addPartner}
            className="w-full py-4 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-cyan-400 hover:border-cyan-500 transition-all font-medium flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Add Another Partner
          </button>
        </div>
      )}
      {docSubStep === 3 && renderAddressProofStep()}
      {docSubStep === 4 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700 mb-4">
            <div>
              <p className="text-white font-medium text-sm">Include Authorized Signatory Details</p>
              <p className="text-xs text-slate-400 mt-0.5">Only required if signatory differs from the primary partner</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeSignatoryDetails}
                onChange={e => setIncludeSignatoryDetails(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
              <span className="text-sm text-slate-300">{includeSignatoryDetails ? 'Yes' : 'No'}</span>
            </label>
          </div>
          {!includeSignatoryDetails && (
            <div className="text-center py-8 text-slate-500">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <p>Toggle the switch above to add signatory details.</p>
            </div>
          )}
          {includeSignatoryDetails && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput label="First Name" value={signatoryData.firstName} name="sigFirstName"
                  onChange={e => setSignatoryData(p => ({ ...p, firstName: e.target.value }))}
                  error={errors.sigFirstName} required placeholder="First name" />
                <FormInput label="Middle Name" value={signatoryData.middleName} name="sigMiddleName"
                  onChange={e => setSignatoryData(p => ({ ...p, middleName: e.target.value }))} optional placeholder="Optional" />
                <FormInput label="Last Name" value={signatoryData.lastName} name="sigLastName"
                  onChange={e => setSignatoryData(p => ({ ...p, lastName: e.target.value }))}
                  error={errors.sigLastName} required placeholder="Last name" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Father's Name</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput label="First Name" value={signatoryData.fatherFirstName} name="sigFatherFirstName"
                  onChange={e => setSignatoryData(p => ({ ...p, fatherFirstName: e.target.value }))}
                  error={errors.sigFatherFirstName} required placeholder="Father's first" />
                <FormInput label="Middle Name" value={signatoryData.fatherMiddleName} name="sigFatherMiddleName"
                  onChange={e => setSignatoryData(p => ({ ...p, fatherMiddleName: e.target.value }))} optional placeholder="Optional" />
                <FormInput label="Last Name" value={signatoryData.fatherLastName} name="sigFatherLastName"
                  onChange={e => setSignatoryData(p => ({ ...p, fatherLastName: e.target.value }))}
                  error={errors.sigFatherLastName} required placeholder="Father's last" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="Mobile Number" type="tel" value={signatoryData.mobile} name="sigMobile"
                  onChange={e => setSignatoryData(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  error={errors.sigMobile} required placeholder="10-digit mobile" maxLength={10} />
                <FormInput label="Email ID" type="email" value={signatoryData.email} name="sigEmail"
                  onChange={e => setSignatoryData(p => ({ ...p, email: e.target.value }))}
                  error={errors.sigEmail} required placeholder="email@example.com" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Signatory Documents</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="PAN Card" name="signPan" required
                  uploadedFile={uploadedFiles.signPan} onChange={handleFileUpload('signPan')}
                  hint="Signatory's PAN card" error={errors.signPan} 
                  existingUrl={existingDocs?.signPan?.url} />
                <FileUploader label="Aadhaar Card" name="signAadhaar" required
                  uploadedFile={uploadedFiles.signAadhaar} onChange={handleFileUpload('signAadhaar')}
                  hint="Signatory's Aadhaar" error={errors.signAadhaar}
                  existingUrl={existingDocs?.signAadhaar?.url} />
                <FileUploader label="Passport Photo" name="signPhoto" required
                  uploadedFile={uploadedFiles.signPhoto} onChange={handleFileUpload('signPhoto')}
                  hint="Recent passport photo" error={errors.signPhoto} accept=".jpg,.jpeg,.png"
                  existingUrl={existingDocs?.signPhoto?.url} />
                <FileUploader label="Authorization Letter" name="signAuthLetter" required
                  uploadedFile={uploadedFiles.signAuthLetter} onChange={handleFileUpload('signAuthLetter')}
                  hint="Signed authorization on letterhead" error={errors.signAuthLetter}
                  existingUrl={existingDocs?.signAuthLetter?.url}
                  infoText="Authorization letter on LLP letterhead, signed by all designated partners." />
              </div>
            </>
          )}
        </div>
      )}
      {docSubStep === 5 && (
        <div className="space-y-6">
          <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-sky-300"><strong>Note:</strong> The DSC must be in the name of the Primary Designated Partner. Ensure it is valid and not expired before uploading.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FileUploader label="Digital Signature Certificate (DSC)" name="dsc" required
              uploadedFile={uploadedFiles.dsc} onChange={handleFileUpload('dsc')}
              accept=".pfx,.p12,.pdf" hint=".pfx, .p12 or .pdf — Max 2MB"
              error={errors.dsc}
              existingUrl={existingDocs?.dsc?.url}
              infoText="DSC of the Primary Designated Partner. Must be Class 3 Organisation DSC." />
          </div>
        </div>
      )}
    </div>
  );

  const renderStep0 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Authorized Person Details" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">All details must match exactly with <strong>Aadhaar</strong> and <strong>PAN</strong> records for GST portal verification.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Full Name" name="promoterName" value={formData.promoterName}
          onChange={handleChange} onBlur={handleBlur} error={errors.promoterName}
          placeholder="e.g., Rajesh Kumar Sharma" required
          infoText="Enter full name as printed on PAN card." />
        <FormInput type="date" label="Date of Birth" name="promoterDob" value={formData.promoterDob}
          onChange={handleChange} onBlur={handleBlur} error={errors.promoterDob} required
          infoText="Must match DOB on PAN card exactly." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput type="email" label="Email Address" name="promoterEmail" value={formData.promoterEmail}
          onChange={handleChange} onBlur={handleBlur} error={errors.promoterEmail}
          placeholder="you@example.com" required
          infoText="This email will be linked to the GST registration." />
        <FormInput type="tel" label="Mobile Number (Aadhaar Linked)" name="promoterMobile" value={formData.promoterMobile}
          onChange={handleChange} onBlur={handleBlur} error={errors.promoterMobile}
          placeholder="9876543210" maxLength={10} required hint="For OTP verification"
          infoText="Must be the mobile number linked with your Aadhaar." />
      </div>
      <FormInput label="Aadhaar Number" name="promoterAadhaar" value={formData.promoterAadhaar}
        onChange={handleChange} onBlur={handleBlur} error={errors.promoterAadhaar}
        placeholder="12-digit Aadhaar number" maxLength={12} required
        hint="Required for GST portal OTP verification"
        infoText="Aadhaar must be linked to an active mobile for OTP." />
    </fieldset>
  );

  const renderStep2 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Nature of Business" />
      <FormSelect label="Select Nature of Business" name="natureOfBusiness" value={formData.natureOfBusiness}
        onChange={handleChange} onBlur={handleBlur} error={errors.natureOfBusiness}
        options={NATURE_OPTIONS.map(o => ({ value: o, label: o }))} required
        infoText="Primary business activity for GST classification." />
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
          <svg className="w-4 h-4 mr-2 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Note
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">Select the primary nature of your business activity. This will be used for GST classification purposes on the GSTN portal. Multiple business activities can be added post-registration.</p>
      </div>
    </fieldset>
  );

  const renderStep4 = () => (
    <div>
      <SectionLegend title="Declaration & Submission" />
      <div className="space-y-4 mb-8">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="consent1" checked={formData.consent1}
              onChange={handleChange} onBlur={handleBlur}
              className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
            <span className="text-sm text-slate-300">I authorize RegiBIZ to file this GST registration application on my behalf and coordinate the filing process with the GST portal.</span>
          </label>
          {errors.consent1 && <p className="text-xs text-red-400 mt-2 ml-8">{errors.consent1}</p>}
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="consent2" checked={formData.consent2}
              onChange={handleChange} onBlur={handleBlur}
              className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
            <span className="text-sm text-slate-300">I hereby declare that all information provided is true, complete, and correct to the best of my knowledge. I understand that providing false information may result in rejection or legal liability.</span>
          </label>
          {errors.consent2 && <p className="text-xs text-red-400 mt-2 ml-8">{errors.consent2}</p>}
        </div>
      </div>
    </div>
  );

  const PreviewModal = () => (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <h3 className="text-2xl font-bold text-white">Application Preview</h3>
          <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
          <h4 className="font-bold text-white text-lg mb-4">Enterprise Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500 font-medium block mb-1">Business Name:</span><span className="text-white font-medium">{commonData.businessName || '—'}</span></div>
            <div><span className="text-slate-500 font-medium block mb-1">Constitution:</span><span className="text-white font-medium">{commonData.constitution || 'LLP'}</span></div>
            <div><span className="text-slate-500 font-medium block mb-1">PAN:</span><span className="text-white font-mono font-bold">{commonData.panNumber || '—'}</span></div>
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
          <h4 className="font-bold text-white text-lg mb-4">Authorized Person</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500 font-medium block mb-1">Name:</span><span className="text-white font-medium">{formData.promoterName || '—'}</span></div>
            <div><span className="text-slate-500 font-medium block mb-1">DOB:</span><span className="text-white font-medium">{formData.promoterDob || '—'}</span></div>
            <div><span className="text-slate-500 font-medium block mb-1">Email:</span><span className="text-white font-medium">{formData.promoterEmail || '—'}</span></div>
            <div><span className="text-slate-500 font-medium block mb-1">Mobile:</span><span className="text-white font-mono">+91 {formData.promoterMobile || '—'}</span></div>
            <div><span className="text-slate-500 font-medium block mb-1">Aadhaar:</span><span className="text-white font-mono">{formData.promoterAadhaar ? `XXXX-XXXX-${formData.promoterAadhaar.slice(-4)}` : '—'}</span></div>
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
          <h4 className="font-bold text-white text-lg mb-4">Registered Office Address</h4>
          <div className="space-y-2 text-sm">
            <div><span className="text-slate-500 font-medium block mb-1">Address Line 1:</span><span className="text-white">{formData.addressLine1 || '—'}</span></div>
            {formData.addressLine2 && <div><span className="text-slate-500 font-medium block mb-1">Address Line 2:</span><span className="text-white">{formData.addressLine2}</span></div>}
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-slate-500 block mb-1">City:</span><span className="text-white">{formData.city || '—'}</span></div>
              <div><span className="text-slate-500 block mb-1">State:</span><span className="text-white">{INDIAN_STATES.find(s => s.value === formData.state)?.label || '—'}</span></div>
              <div><span className="text-slate-500 block mb-1">Pincode:</span><span className="text-white font-mono">{formData.pincode || '—'}</span></div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
          <h4 className="font-bold text-white text-lg mb-4">Business Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500 font-medium block mb-1">Nature of Business:</span><span className="text-white font-medium">{formData.natureOfBusiness || '—'}</span></div>
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
          <h4 className="font-bold text-white text-lg mb-4">Partners ({partners.length})</h4>
          <div className="space-y-4">
            {partners.map((p, i) => (
              <div key={p.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-cyan-400">Partner {i + 1}</span>
                  {p.isPrimary && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Primary</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Name:</span> <span className="text-white">{p.firstName} {p.lastName}</span></div>
                  <div><span className="text-slate-500">Mobile:</span> <span className="text-white font-mono">+91 {p.mobile}</span></div>
                  <div><span className="text-slate-500">Email:</span> <span className="text-white">{p.email}</span></div>
                  <div><span className="text-slate-500">Designation:</span> <span className="text-white">{p.designation}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
          <h4 className="font-bold text-white text-lg mb-4">Documents Uploaded</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(Object.entries(uploadedDocs) as [DocKey, boolean][]).filter(([, v]) => v).map(([k]) => (
              <div key={k} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <span className="text-slate-300 text-sm capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
          <p className="text-sm text-amber-200 flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Please verify all details before submitting. Incorrect information may lead to GST registration rejection.
          </p>
        </div>
      </div>
      <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0 z-20">
        <button onClick={() => setShowPreview(false)} className="px-6 py-2.5 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all font-medium">Close & Edit</button>
        <button onClick={() => { setShowPreview(false); executeSubmission(); }} disabled={isSubmitting}
          className="px-8 py-2.5 rounded-lg font-bold bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white disabled:opacity-50 flex items-center gap-2">
          Confirm & Submit
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </button>
      </div>
    </div>
  );

  // ── Exit Confirmation Handler ───────────────────
  const handleConfirmExit = async () => {
    // Force-save: bypass isInitialLoading guard since user explicitly clicked Save & Exit
    await saveDraft(undefined, true);
    
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      navigate('/documents', { state: { defaultTab: 'drafts' } });
    }, 800);
  };

  const handleExitWithoutSaving = () => {
    navigate('/services/gst-registration');
  };

  if (isSuccess) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">GST Application Submitted!</h2>
        <p className="text-white mb-4 text-sm">Your application has been received. Our team will contact you for OTP/Aadhaar verification and processing.</p>
        <div className="mb-6"><p className="text-white text-xs mb-1">Your Case ID:</p><p className="text-orange-400 font-mono font-bold text-sm tracking-wide">{caseId}</p></div>
        <div className="space-y-3">
          <button onClick={() => navigate('/documents')} className="w-full bg-gradient-to-r from-teal-600 to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all text-sm">View Submitted Application</button>
          <button onClick={() => navigate('/services')} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-lg border border-slate-700 text-sm">Back to Services</button>
        </div>
      </div>
    </div>
  );

  // Dead code removed: handleConfirmExit is now defined above isSuccess return

  const stepTitle = STEP_LABELS[currentStep] || '';
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {saveToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 border border-emerald-500/50 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-sm font-bold">Draft saved successfully</span>
        </div>
      )}
      {isInitialLoading && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100]">
          <p className="text-white text-sm font-medium">Loading Draft...</p>
        </div>
      )}
      {isSubmitting && <ProcessingOverlay />}
      {errorMsg && <ErrorToast message={errorMsg} onClose={() => setErrorMsg(null)} />}
      {showPreview && <PreviewModal />}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
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
                  onClick={handleConfirmExit}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                  {isDraftSaving ? 'Saving...' : 'Yes, Save & Exit'}
                </button>
                <button
                  onClick={handleExitWithoutSaving}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/20 transition-all disabled:opacity-50"
                >
                  No, Just Exit
                </button>
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
            <FreeCornerRibbon />
            <div className="absolute top-5 left-5 z-20 flex items-center gap-4">
              <FormBackButton onBack={handlePrev} />
              <button 
                onClick={() => setShowExitConfirm(true)}
                className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all shadow-lg"
              >
                Exit Session
              </button>
            </div>
            <div className="p-6 md:p-10 flex-grow pt-14">
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">GST Registration</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">{stepTitle}</p>
              </div>
              {caseId && <StatusBanner caseId={caseId} />}
              <form noValidate>
                {currentStep === 0 && renderStep0()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}
              </form>
              <div className="mt-12 pt-6 border-t border-slate-700/50">
                <div className="flex flex-col-reverse md:flex-row items-center gap-4 justify-between">
                  <div className="hidden md:block w-[140px]"></div>
                  <div className="flex gap-3 w-full md:w-auto">
                    {currentStep === 4 && (
                      <button
                        type="button"
                        onClick={() => setShowPreview(true)}
                        className="px-6 py-4 rounded-xl font-bold bg-slate-700 border border-slate-600 text-emerald-400 hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={isSubmitting}
                      className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {currentStep === 4 ? 'Submit Application' : 'Save & Next'}
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-slate-400">
                  Step {currentStep + 1} of 5 — By continuing, you agree to our{' '}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Terms</a> and{' '}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>
                </p>
              </div>
            </div>
          </main>
          {/* Sidebar */}
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8">
            <ProgressSidebar
              currentStep={currentStep}
              docSubStep={docSubStep}
              uploadedCount={getUploadedCount()}
              totalDocs={getTotalDocs()}
              commonData={commonData}
              onPreview={() => setShowPreview(true)}
              isDraftSaving={isDraftSaving}
              lastDraftSavedAt={lastDraftSavedAt}
            />
          </aside>
        </div>
        <div className="mt-12 text-center text-slate-500 text-sm pb-8">© 2026 RegiBIZ. All rights reserved.</div>
      </div>
    </div>
  );
}

const PreviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
    <h4 className="font-bold text-white text-base mb-4">{title}</h4>
    {children}
  </div>
);

const PreviewGrid: React.FC<{ items: [string, string][] }> = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
    {items.map(([k, v]) => (
      <div key={k}><span className="text-slate-500 font-medium block mb-0.5">{k}:</span><span className="text-white font-medium">{v || '—'}</span></div>
    ))}
  </div>
);
