import React, { useState, useEffect, useRef, ChangeEvent, FocusEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, setDoc, getDoc, serverTimestamp, runTransaction, collection, increment, query, where, limit, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { sendConfirmationEmail } from '../emailService';
import CelebrationPopup from '../../components/CelebrationPopup';
import { useRazorpay } from '../../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../../data/pricingConfig';
import { RazorpaySuccessResponse } from '../../services/razorpayService';
import FormBackButton from '../../components/FormBackButton';
import { buildInitialApplicationStatus } from '../applicationStatus';


// ============================================================================
// TYPES
// ============================================================================
interface Director {
  id: string;
  isPrimary: boolean;
  din: string;
  firstName: string; middleName: string; lastName: string;
  fatherFirstName: string; fatherMiddleName: string; fatherLastName: string;
  dob: string; gender: string;
  pan: string; aadhaar: string;
  email: string; mobile: string;
  designation: string;
  nationality: string;
  occupation: string;
  sharePercent: string;
  // Files
  panFile: File | null;
  aadhaarFile: File | null;
  photo: File | null;
  addressProof: File | null;
  dscFile: File | null;
  // Filenames for draft persistence
  panFileName?: string | null;
  aadhaarFileName?: string | null;
  photoFileName?: string | null;
  addressProofFileName?: string | null;
  dscFileName?: string | null;
}

// LLP-specific Partner type
interface Partner {
  id: string;
  isPrimary: boolean;       // Designated Partner flag
  firstName: string; middleName: string; lastName: string;
  fatherFirstName: string; fatherMiddleName: string; fatherLastName: string;
  dob: string;
  pan: string; aadhaar: string;
  email: string; mobile: string;
  designation: 'Designated Partner' | 'Partner';
  nationality: string;
  contributionPercent: string;   // % of capital contribution
  profitSharingPercent: string;  // % of profit sharing
  // Files
  panFile: File | null;
  aadhaarFile: File | null;
  photo: File | null;
  addressProof: File | null;
  dscFile: File | null;
  // Filenames for draft persistence
  panFileName?: string | null;
  aadhaarFileName?: string | null;
  photoFileName?: string | null;
  addressProofFileName?: string | null;
  dscFileName?: string | null;
}

interface FormData {
  // Step 0 — Company Details (Pvt Ltd)
  companyType: string;
  proposedName1: string;
  proposedName2: string;
  proposedName3: string;
  mcaNameCheckStatus: string;
  nameReservationSrn: string;
  spicePartASrn: string;
  agileProRequired: string;
  mainObject: string;
  otherObjects: string;
  authorizedCapital: string;
  paidUpCapital: string;
  shareNominalValue: string;
  // Step 0 — LLP-specific
  llpName1: string;
  llpName2: string;
  llpName3: string;
  fillipSrn: string;
  llpBusinessActivity: string;
  llpContributionAmount: string;
  llpProfitSharingRatio: string;
  // Step 1 — Registered Office (shared)
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  email: string;
  mobile: string;
  website: string;
  // Step 2 — Business Details (Pvt Ltd only)
  businessActivity: string;
  nicCode: string;
  dateOfCommencement: string;
  financialYearEnd: string;
  // Step 4 — Declarations
  consent1: boolean;
  consent2: boolean;
}

type DocKey =
  | 'masterData'
  | 'moa'
  | 'aoa'
  | 'utilityBill'
  | 'noc'
  | 'rentAgreement'
  | 'addressProof'
  | 'bankStatement'
  // LLP-specific doc keys
  | 'llpAgreement'
  | 'llpUtilityBill'
  | 'llpNoc'
  | 'llpRentAgreement';

// ============================================================================
// CONSTANTS
// ============================================================================
const STEP_LABELS = [
  'Company Details',
  'Registered Office',
  'Business Activity',
  'Directors & Subscribers',
  'Documents & Declaration',
];

// LLP has a different step label set
const LLP_STEP_LABELS = [
  'LLP Details',
  'Registered Office',
  'Partners',
  'Documents & Declaration',
];

const INITIAL_DATA: FormData = {
  companyType: '', proposedName1: '', proposedName2: '', proposedName3: '',
  mcaNameCheckStatus: '', nameReservationSrn: '', spicePartASrn: '', agileProRequired: '',
  mainObject: '', otherObjects: '', authorizedCapital: '', paidUpCapital: '',
  shareNominalValue: '10',
  llpName1: '', llpName2: '', llpName3: '',
  fillipSrn: '',
  llpBusinessActivity: '', llpContributionAmount: '', llpProfitSharingRatio: '',
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
  email: '', mobile: '', website: '',
  businessActivity: '', nicCode: '', dateOfCommencement: '', financialYearEnd: 'March 31',
  consent1: false, consent2: false,
};

const INITIAL_DIRECTOR: Director = {
  id: '1', isPrimary: true, din: '',
  firstName: '', middleName: '', lastName: '',
  fatherFirstName: '', fatherMiddleName: '', fatherLastName: '',
  dob: '', gender: '', pan: '', aadhaar: '',
  email: '', mobile: '', designation: 'Director',
  nationality: 'Indian', occupation: 'Business',
  sharePercent: '',
  panFile: null, aadhaarFile: null, photo: null, addressProof: null, dscFile: null,
};

const INITIAL_PARTNER: Partner = {
  id: '1', isPrimary: true,
  firstName: '', middleName: '', lastName: '',
  fatherFirstName: '', fatherMiddleName: '', fatherLastName: '',
  dob: '', pan: '', aadhaar: '',
  email: '', mobile: '',
  designation: 'Designated Partner',
  nationality: 'Indian',
  contributionPercent: '50',
  profitSharingPercent: '50',
  panFile: null, aadhaarFile: null, photo: null, addressProof: null, dscFile: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATED companyTypeOptions — Public Ltd, OPC, Section 8 removed; LLP added
// ─────────────────────────────────────────────────────────────────────────────
const companyTypeOptions = [
  { value: 'pvt_ltd', label: 'Private Limited Company (Pvt Ltd)' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
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
  { value: 'OD', label: 'Odisha' }, { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' }, { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' }, { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' }, { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' }, { value: 'WB', label: 'West Bengal' },
  { value: 'DL', label: 'Delhi' }, { value: 'JK', label: 'Jammu & Kashmir' },
  { value: 'LA', label: 'Ladakh' }, { value: 'PY', label: 'Puducherry' },
  { value: 'CH', label: 'Chandigarh' }, { value: 'AN', label: 'Andaman & Nicobar' },
];

const businessActivityOptions = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'trading', label: 'Trading / Wholesale / Retail' },
  { value: 'services', label: 'Services' },
  { value: 'it_software', label: 'IT / Software / Technology' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'consulting', label: 'Consulting / Advisory' },
  { value: 'construction', label: 'Construction / Real Estate' },
  { value: 'healthcare', label: 'Healthcare / Pharma' },
  { value: 'education', label: 'Education / Training' },
  { value: 'food_beverage', label: 'Food & Beverage / FMCG' },
  { value: 'finance', label: 'Finance / Insurance / NBFC' },
  { value: 'media', label: 'Media / Entertainment / Creative' },
  { value: 'logistics', label: 'Logistics / Transport' },
  { value: 'agriculture', label: 'Agriculture / Agri-tech' },
  { value: 'other', label: 'Other' },
];

const designationOptions = [
  { value: 'Director', label: 'Director' },
  { value: 'Managing Director', label: 'Managing Director' },
  { value: 'Whole-time Director', label: 'Whole-time Director' },
  { value: 'Independent Director', label: 'Independent Director' },
  { value: 'Nominee Director', label: 'Nominee Director' },
];

const llpDesignationOptions = [
  { value: 'Designated Partner', label: 'Designated Partner' },
  { value: 'Partner', label: 'Partner' },
];

// ============================================================================
// SEQUENTIAL ID GENERATOR
// ============================================================================
const generateCaseId = async (year: number, isLLP = false): Promise<string> => {
  const prefix = isLLP ? 'LLP-REG' : 'COMP-REG';
  const counterId = `${prefix.toLowerCase().replace(/-/g, '_')}_${year}`;
  const counterRef = doc(db, 'counters', counterId);

  try {
    const nextCount = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      let count = 1;
      if (snap.exists()) {
        const data = snap.data();
        // Ensure we handle legacy 'count' or 'current' fields and force to number
        const currentCount = Number(data.count || data.current || 0);
        count = currentCount + 1;
      }
      transaction.set(counterRef, { count, year: Number(year), updatedAt: serverTimestamp() }, { merge: true });
      return count;
    });
    return `${prefix}-${year}-${String(nextCount).padStart(2, '0')}`;
  } catch (err) {
    console.warn("Counter transaction failed, using fallback:", err);
    const fallbackCount = Math.floor(Math.random() * 900) + 1;
    return `${prefix}-${year}-${String(fallbackCount).padStart(2, '0')}`;
  }
};

// ============================================================================
// VALIDATORS
// ============================================================================
const validators = {
  required: (v: string, f = 'This field') => (v && v.trim().length > 0) || `${f} is required`,
  pan: (v: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) || 'Invalid PAN (e.g., ABCDE1234F)',
  aadhaar: (v: string) => !v || /^\d{12}$/.test(v) || 'Aadhaar must be 12 digits',
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email address',
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v) || 'Invalid 10-digit mobile (starts 6–9)',
  pincode: (v: string) => /^\d{6}$/.test(v) || 'Pincode must be 6 digits',
  capital: (v: string) => /^\d+(\.\d{1,2})?$/.test(v) || 'Enter valid amount',
  percent: (v: string) => {
    const n = parseFloat(v);
    return (!isNaN(n) && n >= 0 && n <= 100) || 'Must be between 0 and 100';
  },
};

// ============================================================================
// UI COMPONENTS — defined outside main to prevent focus loss
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
  const inputId = id || `fi-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
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
        className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all focus:ring-2 focus:outline-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-white focus:ring-white/20 hover:border-slate-600'}`}
        required={required} {...props} />
      {error
        ? <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>
        : hint ? <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p> : null}
    </div>
  );
};

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string; optional?: boolean; infoText?: string; }> = ({ label, error, hint, optional, infoText, id, required, ...props }) => {
  const taId = id || `ta-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={taId} className="block text-sm font-medium text-white">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <textarea id={taId} rows={4}
        className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all focus:ring-2 focus:outline-none resize-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-white focus:ring-white/20 hover:border-slate-600'}`}
        required={required} {...props} />
      {error ? <p className="mt-1.5 text-xs text-red-400 flex items-center">{error}</p>
        : hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string; options: { value: string; label: string }[];
  error?: string; optional?: boolean; infoText?: string;
}
const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, optional, infoText, id, required, value, ...props }) => {
  const selectId = id || `fs-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
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
          className={`w-full bg-slate-800/50 border text-sm rounded-lg block p-3 pr-10 appearance-none shadow-sm transition-all focus:ring-2 focus:outline-none cursor-pointer ${!value ? 'text-slate-500' : 'text-white'} ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
          required={required} {...props}>
          <option value="" disabled>Select an option</option>
          {options.map(o => <option key={o.value} value={o.value} className="text-slate-900 bg-slate-100">{o.label}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center">{error}</p>}
    </div>
  );
};

const FileUploader: React.FC<{
  label: string; name: string; required?: boolean; optional?: boolean;
  uploadedFile: File | null; onChange: (f: File | null) => void;
  infoText?: string; accept?: string; hint?: string; error?: string;
  fileName?: string | null;
  existingUrl?: string;
}> = ({ label, name, required, optional, uploadedFile, onChange, infoText, accept = '.pdf,.jpg,.jpeg,.png', hint, error, fileName: externalFileName, existingUrl }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = uploadedFile?.name || externalFileName || (existingUrl ? existingUrl.split('/').pop()?.split('?')[0] : null);

  const process = (f: File | null) => {
    if (!f) { onChange(null); return; }
    if (f.size > 5 * 1024 * 1024) { alert('File must be under 5MB'); return; }
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
        className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragging ? 'border-cyan-500 bg-cyan-500/10' : uploadedFile ? 'border-emerald-500/50 bg-emerald-500/5' : error ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}>
        <input ref={inputRef} type="file" name={name} accept={accept} className="hidden"
          onChange={e => process(e.target.files?.[0] || null)} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 ${uploadedFile ? 'bg-emerald-500/20 text-emerald-400' : error ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-400'}`}>
            {uploadedFile
              ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
          </div>
          <div className="flex-1 min-w-0">
            {displayName
              ? <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{displayName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {uploadedFile ? 'Ready for upload' : existingUrl ? <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline" onClick={e => e.stopPropagation()}>View document</a> : 'Auto-saved'}
                </p>
              </div>
              : <div><p className="text-sm font-medium text-slate-300">Click or drag to upload</p><p className="text-xs text-slate-500 mt-0.5">{hint || 'PDF, JPG, PNG — Max 5MB'}</p></div>}
          </div>
          {uploadedFile && (
            <button type="button" onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
              className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center">{error}</p>}
    </div>
  );
};

const SectionLegend: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
    <span className="bg-white w-1 h-5 mr-3 rounded-full inline-block" />
    {title}
  </div>
);

const SubLegend: React.FC<{ title: string }> = ({ title }) => (
  <p className="text-sm font-semibold text-white uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 flex items-center gap-2">
    <span className="w-1 h-4 bg-white rounded-full inline-block" />{title}
  </p>
);

// ── Progress Sidebar ──────────────────────────────────────────────────────────
const ProgressSidebar: React.FC<{
  currentStep: number;
  docSubStep: number;
  uploadedCount: number;
  totalDocs: number;
  participantCount: number;
  companyType: string;
  onPreview: () => void;
  paymentVerified?: boolean;
  isDraftSaving?: boolean;
  lastDraftSavedAt?: Date | null;
}> = ({ currentStep, docSubStep, uploadedCount, totalDocs, participantCount, companyType, onPreview, paymentVerified, isDraftSaving, lastDraftSavedAt }) => {
  const isLLP = companyType === 'llp';
  const stepLabels = isLLP ? LLP_STEP_LABELS : STEP_LABELS;
  const cLabel = companyTypeOptions.find(o => o.value === companyType)?.label || '';
  const participantLabel = isLLP ? 'Partner(s)' : 'Director(s)';
  const participantStep = isLLP ? 2 : 3;
  const docStep = isLLP ? 3 : 4;

  const basePrice = PRICING_CONFIG['company-registration']?.fee || 3999;
  const gstAmount = calculateGST(basePrice);
  const totalAmount = calculateTotalWithGST(basePrice);

  return (
    <div className="space-y-6 hidden lg:block">
      {/* Application Progress */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
        <h3 className="text-white text-sm font-bold mb-5 flex items-center gap-2">
          <div className="w-2 h-5 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full" />
          Application Progress
        </h3>

        {/* Draft Status Indicator */}
        {lastDraftSavedAt && (
          <div className="mb-4 px-3 py-2 bg-slate-800/40 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDraftSaving ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-3 w-3 text-cyan-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[10px] text-slate-400 font-medium animate-pulse">Saving Draft...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight">Draft Saved</span>
                </div>
              )}
            </div>
            {!isDraftSaving && (
              <span className="text-[10px] text-slate-500 font-mono">
                {lastDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        <div className="relative border-l-2 border-white/5 ml-2 space-y-6 my-2">
          {stepLabels.map((label, step) => {
            const status = step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending';
            return (
              <div key={step} className="ml-6 relative">
                <div className={`absolute -left-[33px] w-4 h-4 rounded-full border-2 border-slate-900 transition-all duration-500 flex items-center justify-center ${status === 'completed' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : status === 'active' ? 'bg-cyan-500 ring-4 ring-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-110'
                    : 'bg-slate-800'}`}>
                  {status === 'completed' && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {label}
                </h4>
                <div className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-md inline-block ${status === 'active' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800/50 text-slate-600'}`}>
                  {step === docStep
                    ? `${uploadedCount}/${totalDocs} Documents`
                    : step === participantStep
                      ? `${participantCount} ${participantLabel}`
                      : status === 'completed' ? 'Completed'
                        : status === 'active' ? 'Current Step' : 'Upcoming'}
                </div>
                {step === docStep && status === 'active' && (
                  <div className="mt-3 w-32 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min((uploadedCount / Math.max(totalDocs, 1)) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Registration Process */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
        <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
          <div className="w-2 h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
          {isLLP ? 'LLP Registration' : 'MCA Registration'}
        </h3>
        <div className="space-y-3 mt-4">
          {(isLLP ? (
            [
              { step: '1', text: 'Obtain DSC for Partners' },
              { step: '2', text: 'DPIN Application' },
              { step: '3', text: 'Name Reservation (RUN-LLP)' },
              { step: '4', text: 'File FiLLiP Form' },
              { step: '5', text: 'Incorporation & PAN' },
            ]
          ) : (
            [
              { step: '1', text: 'DSC & DIN Issuance' },
              { step: '2', text: 'Name Approval (MCA)' },
              { step: '3', text: 'MOA & AOA Drafting' },
              { step: '4', text: 'SPICe+ Filing' },
              { step: '5', text: 'COI, PAN & TAN' },
            ]
          )).map(item => (
            <div key={item.step} className="flex items-center gap-3 text-xs">
              <span className="w-5 h-5 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-300 font-bold shrink-0">{item.step}</span>
              <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group transition-all duration-300 hover:border-white/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-5 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
            Order Summary
          </h3>
          {paymentVerified && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              Paid
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Service Fee</span>
            <span className="text-white font-semibold">₹{basePrice.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">GST</span>
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
              * GST charges are calculated as per prevailing government regulations.
            </p>
          </div>
        </div>
      </div>

      {/* Need Help? */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
        <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
          <div className="w-2 h-5 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full" />
          Need Help?
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {isLLP
            ? 'Our CA team will guide you through DPIN, DSC, and LLP Agreement drafting.'
            : 'Our CA team will guide you through the entire MCA registration process.'}
        </p>
        <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-white/5">
          <span className="text-slate-400 font-medium text-xs">contact Support</span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
          </div>
        </div>
      </div>

      {/* Preview Profile */}
      <button onClick={onPreview}
        className="w-full py-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-cyan-500/30 text-cyan-400 hover:text-cyan-300 font-bold tracking-wide shadow-xl transition-all flex items-center justify-center gap-2 group">
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Preview Application
      </button>
    </div>
  );
};

// ── Status Banner ─────────────────────────────────────────────────────────────
const StatusBanner: React.FC<{ caseId: string; companyType: string }> = ({ caseId, companyType }) => {
  const label = companyTypeOptions.find(o => o.value === companyType)?.label || 'New Registration';
  const basePrice = PRICING_CONFIG['company-registration']?.fee || 3999;
  const gstAmount = calculateGST(basePrice);
  const totalAmount = calculateTotalWithGST(basePrice);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group transition-all duration-300 mb-8">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Final Inclusive Price
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">
            ₹{basePrice.toLocaleString('en-IN')} Service Fee + ₹{gstAmount.toLocaleString('en-IN')} GST | <span className="text-sky-400/80">Service Charges Applicable</span>
          </p>
          <div className="pt-2 flex items-center gap-2">
            <div className="px-2 py-1 bg-slate-800/50 rounded-lg border border-white/5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">{label}</span>
            </div>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="inline-block bg-slate-800/40 px-4 py-2 rounded-xl border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Case Reference</p>
            <p className="text-white font-mono font-bold text-lg tracking-widest">{caseId || 'GENERATING...'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modals ────────────────────────────────────────────────────────────────────
const OTPModal: React.FC<{ onConfirm: () => void; onCancel: () => void; isLLP?: boolean }> = ({ onConfirm, onCancel, isLLP = false }) => (
  <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Confirm Submission</h3>
      </div>
      <p className="text-slate-300 mb-4 leading-relaxed">
        By submitting this form, our CA team will review your application and contact you within 24 hours to:
      </p>
      <ul className="text-sm text-slate-400 space-y-1.5 mb-6">
        {(isLLP ? [
          'Verify all submitted documents',
          'Coordinate DSC & DPIN process for partners',
          'File for name reservation via RUN-LLP',
          'Handle FiLLiP filing & LLP Agreement',
        ] : [
          'Verify all submitted documents',
          'Coordinate DSC & DIN process for directors',
          'File for name reservation on MCA portal',
          'Handle SPICe+ filing & ROC submission',
        ]).map(item => (
          <li key={item} className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {item}
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} className="px-6 py-2.5 bg-gradient-to-r from-teal-700 to-blue-900 hover:from-teal-600 hover:to-blue-800 text-white font-medium rounded-lg transition-colors">Confirm & Submit</button>
      </div>
    </div>
  </div>
);

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
      <p className="text-slate-400 text-sm">Uploading documents and submitting your application.</p>
      <p className="text-slate-500 text-xs mt-1">Do not close this window.</p>
    </div>
  </div>
);

const ErrorToast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-red-500/90 backdrop-blur-sm border border-red-400 rounded-xl p-4 shadow-2xl max-w-md flex items-start gap-3">
        <svg className="w-5 h-5 text-white shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-white text-sm flex-1">{message}</p>
        <button onClick={onClose} className="text-white/70 hover:text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
    </div>
  );
};

const ConfirmModal: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} className="px-6 py-2.5 bg-gradient-to-r from-teal-700 to-blue-900 text-white font-medium rounded-lg transition-colors">Confirm</button>
      </div>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
interface CompanyRegistrationFormProps {
  user: { uid: string; email?: string; displayName?: string; phoneNumber?: string };
  packageMode?: boolean;
  onComplete?: (data: any) => void;
  onBack?: () => void;
  initialData?: any;
  existingDocs?: any;
}

export default function CompanyRegistrationForm({ user, packageMode, onComplete, onBack, initialData: propsInitialData, existingDocs }: CompanyRegistrationFormProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [docSubStep, setDocSubStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [caseId, setCaseId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const { displayRazorpay } = useRazorpay();
  const servicePrice = PRICING_CONFIG['company-registration']?.fee ?? 0;
  const [showPreview, setShowPreview] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const handleSaveAndExit = async () => {
    setIsExiting(true);
    await saveDraft();
    navigate('/services/company-registration');
  };

  const handleExitWithoutSaving = () => {
    setIsExiting(true);
    navigate('/services/company-registration');
  };

  // ── Exit Confirmation Logic ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSuccess || isExiting) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isSuccess || isExiting) return;
      // Block navigation and show custom confirm
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
  }, [isSuccess, isExiting]);

  // Initialize from location state if coming from pre-paid landing page
  useEffect(() => {
    if (location.state) {
      const { paymentId, orderId, signature, preSelectedType } = location.state;
      if (paymentId && orderId && signature) {
        setPaymentInfo({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: signature
        });
      }
      if (preSelectedType) {
        setFormData(prev => ({ ...prev, companyType: preSelectedType }));
      }
    }

    // ── Load Draft ───────────────────────────────────────────────────────────
    const loadDraft = async () => {
      if (!user?.uid) return;
      try {
        console.log("🔍 Attempting to load draft for:", user.uid);
        // Use direct getDoc with multiple possible keys (matching GST router pattern)
        // This is more reliable than queries which often fail due to missing indexes or rules
        const draftRef = doc(db, 'drafts', `company_reg_${user.uid}`);
        const draftSnap = await getDoc(draftRef);
        
        if (draftSnap.exists()) {
          const draftData = draftSnap.data();
          console.log("✅ Draft found:", draftSnap.id);
          if (draftData.formData) setFormData(p => ({ ...p, ...draftData.formData }));
          if (draftData.currentStep !== undefined) setCurrentStep(draftData.currentStep);
          if (draftData.docSubStep !== undefined) setDocSubStep(draftData.docSubStep);
          if (draftData.caseId) setCaseId(draftData.caseId);
          if (draftData.directors) setDirectors(draftData.directors);
          if (draftData.partners) setPartners(draftData.partners);
          if (draftData.uploadedFileNames) setUploadedFileNames(draftData.uploadedFileNames);
          if (draftData.lastDraftSavedAt) setLastDraftSavedAt(draftData.lastDraftSavedAt.toDate());
        }
      } catch (err: any) {
        // Handle permission denied - this happens if the draft document doesn't exist 
        // or if Firestore Security Rules are not configured to allow the user to read 'drafts'
        if (err.code === 'permission-denied') {
          console.warn("Draft access denied. Ensure Firestore Rules allow read on 'drafts/company_reg_{uid}'", err.message);
        } else {
          console.error("Error loading draft:", err);
        }
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadDraft();
  }, [location.state, user?.uid]);

  // Directors (Pvt Ltd)
  const [directors, setDirectors] = useState<Director[]>([{ ...INITIAL_DIRECTOR, id: Date.now().toString() }]);

  // Partners (LLP)
  const [partners, setPartners] = useState<Partner[]>([
    { ...INITIAL_PARTNER, id: `${Date.now()}-1` },
    { ...INITIAL_PARTNER, id: `${Date.now()}-2`, isPrimary: false, contributionPercent: '50', profitSharingPercent: '50' },
  ]);

  // Company-level uploaded docs
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, File | null>>({
    masterData: null, moa: null, aoa: null,
    utilityBill: null, noc: null, rentAgreement: null,
    addressProof: null, bankStatement: null,
    llpAgreement: null, llpUtilityBill: null, llpNoc: null, llpRentAgreement: null,
  });

  const [uploadedFileNames, setUploadedFileNames] = useState<Record<DocKey, string>>({
    masterData: '', moa: '', aoa: '',
    utilityBill: '', noc: '', rentAgreement: '',
    addressProof: '', bankStatement: '',
    llpAgreement: '', llpUtilityBill: '', llpNoc: '', llpRentAgreement: '',
  });

  // Derived: is LLP selected?
  const isLLP = formData.companyType === 'llp';

  // LLP has 4 steps (0–3); Pvt Ltd has 5 steps (0–4)
  const totalSteps = isLLP ? 4 : 5;

  const docStepIndex = isLLP ? 3 : 4;
  const participantStepIndex = isLLP ? 2 : 3;
  // LLP doc sub-steps: 1=Docs, 2=Declaration (2 pages)
  // Pvt doc sub-steps: 1=Company, 2=Director KYC, 3=Declaration (3 pages)
  const maxDocSubStep = isLLP ? 2 : 3;

  // Auto-submit after payment (only if on the final document sub-step)
  useEffect(() => {
    if (paymentInfo && !isSubmitting && !isSuccess && currentStep === totalSteps - 1 && docSubStep === maxDocSubStep) {
      executeSubmission(paymentInfo);
    }
  }, [paymentInfo, currentStep, totalSteps, docSubStep, maxDocSubStep]);

  // ── Generate Case ID on mount and when type changes ────────────────────────
  useEffect(() => {
    if (caseId) return; // Skip if already set (e.g., from draft)
    generateCaseId(new Date().getFullYear(), isLLP)
      .then(setCaseId)
      .catch(() => {
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        setCaseId(`${isLLP ? 'LLP' : 'COMP'}-REG-${new Date().getFullYear()}-${randomSuffix}`);
      });
  }, [isLLP, caseId]);

  // Reset to step 0 when company type changes to avoid being stuck mid-flow
  const handleTypeChange = (newType: string) => {
    setFormData(p => ({ ...INITIAL_DATA, companyType: newType }));
    setCurrentStep(0);
    setDocSubStep(1);
    setErrors({});
    setTouched({});
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getUploadedCount = () => {
    if (isLLP) {
      let n = 0;
      if (uploadedDocs.llpUtilityBill) n++;
      if (uploadedDocs.llpAgreement) n++;
      if (uploadedDocs.llpNoc) n++;
      if (uploadedDocs.llpRentAgreement) n++;
      partners.forEach(p => {
        if (p.panFile) n++;
        if (p.aadhaarFile) n++;
        if (p.photo) n++;
        if (p.addressProof) n++;
      });
      return n;
    }
    let n = Object.values(uploadedDocs).filter(Boolean).length;
    directors.forEach(d => {
      if (d.panFile) n++;
      if (d.aadhaarFile) n++;
      if (d.photo) n++;
      if (d.dscFile) n++;
    });
    return n;
  };

  const getTotalDocs = () => {
    if (isLLP) {
      // per partner: pan+aadhaar+photo+addressProof + office utility
      return 1 + partners.length * 4;
    }
    return 4 + directors.length * 4;
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    // Intercept companyType changes for reset
    if (name === 'companyType') { handleTypeChange(value); return; }
    let v: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    if (name === 'mobile') v = v.replace(/\D/g, '').slice(0, 10);
    if (name === 'pincode') v = v.replace(/\D/g, '').slice(0, 6);
    if (name === 'llpContributionAmount') v = v.replace(/[^\d.]/g, '');
    setFormData(p => ({ ...p, [name]: v }));
    if (touched[name]) setErrors(p => ({ ...p, [name]: validateField(name, v) }));
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setTouched(p => ({ ...p, [name]: true }));
    setErrors(p => ({ ...p, [name]: validateField(name, v) }));
  };

  const validateField = (name: string, value: any): string => {
    switch (name) {
      // Pvt Ltd fields
      case 'companyType': case 'proposedName1': case 'mainObject': case 'businessActivity':
      case 'addressLine1': case 'city': case 'state':
      case 'authorizedCapital': case 'paidUpCapital':
        return validators.required(value) === true ? '' : validators.required(value) as string;
      // LLP-specific fields
      case 'llpName1':
        return validators.required(value, 'LLP Name') === true ? '' : validators.required(value, 'LLP Name') as string;
      case 'llpBusinessActivity':
        return validators.required(value, 'Business Activity') === true ? '' : validators.required(value, 'Business Activity') as string;
      case 'llpContributionAmount':
        return validators.capital(value) === true ? '' : validators.capital(value) as string;
      case 'llpProfitSharingRatio':
        return validators.required(value, 'Profit Sharing Ratio') === true ? '' : validators.required(value, 'Profit Sharing Ratio') as string;
      // Shared
      case 'email': return validators.email(value) === true ? '' : validators.email(value) as string;
      case 'mobile': return validators.mobile(value) === true ? '' : validators.mobile(value) as string;
      case 'pincode': return validators.pincode(value) === true ? '' : validators.pincode(value) as string;
      case 'consent1': case 'consent2': return value ? '' : 'Declaration is required';
      default: return '';
    }
  };

  const validateStep = (step: number): boolean => {
    let fieldMap: Record<number, string[]>;

    if (isLLP) {
      fieldMap = {
        0: ['llpName1', 'llpBusinessActivity', 'llpContributionAmount', 'llpProfitSharingRatio'],
        1: ['addressLine1', 'city', 'state', 'pincode', 'email', 'mobile'],
      };
    } else {
      fieldMap = {
        0: ['companyType', 'proposedName1', 'mainObject', 'authorizedCapital', 'paidUpCapital'],
        1: ['addressLine1', 'city', 'state', 'pincode', 'email', 'mobile'],
        2: ['businessActivity'],
      };
    }

    const fs = fieldMap[step] || [];
    const newErrors: Record<string, string> = {};
    fs.forEach(k => { const e = validateField(k, (formData as any)[k]); if (e) newErrors[k] = e; });
    setErrors(p => ({ ...p, ...newErrors }));
    setTouched(p => { const t = { ...p }; fs.forEach(f => (t[f] = true)); return t; });
    return Object.keys(newErrors).length === 0;
  };

  // ── Director validation (Pvt Ltd) ──────────────────────────────────────────
  const validateDirectors = (): boolean => {
    const newErrors: Record<string, string> = {};
    let ok = true;
    const hasPrimary = directors.some(d => d.isPrimary);
    if (!hasPrimary) { newErrors['primary-director'] = 'Please select a Primary Director'; ok = false; }
    directors.forEach(d => {
      if (!d.firstName.trim()) { newErrors[`d-${d.id}-fn`] = 'First Name required'; ok = false; }
      if (!d.lastName.trim()) { newErrors[`d-${d.id}-ln`] = 'Last Name required'; ok = false; }
      if (!d.dob) { newErrors[`d-${d.id}-dob`] = 'Date of Birth required'; ok = false; }
      if (!d.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(d.pan)) { newErrors[`d-${d.id}-pan`] = 'Valid PAN required'; ok = false; }
      if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { newErrors[`d-${d.id}-email`] = 'Valid email required'; ok = false; }
      if (!d.mobile || d.mobile.length !== 10) { newErrors[`d-${d.id}-mobile`] = 'Valid 10-digit mobile required'; ok = false; }
    });
    setErrors(p => ({ ...p, ...newErrors }));
    if (!ok) setErrorMsg('Please complete all required Director fields.');
    return ok;
  };

  // ── Partner validation (LLP) ───────────────────────────────────────────────
  const validatePartners = (): boolean => {
    const newErrors: Record<string, string> = {};
    let ok = true;
    const hasDesignated = partners.some(p => p.designation === 'Designated Partner');
    if (!hasDesignated) { newErrors['primary-partner'] = 'At least one Designated Partner is required for LLP'; ok = false; }

    const totalContrib = partners.reduce((sum, p) => sum + (parseFloat(p.contributionPercent) || 0), 0);
    const totalProfit = partners.reduce((sum, p) => sum + (parseFloat(p.profitSharingPercent) || 0), 0);
    if (Math.abs(totalContrib - 100) > 0.01) { newErrors['contrib-total'] = `Total contribution % must be 100%. Current: ${totalContrib.toFixed(1)}%`; ok = false; }
    if (Math.abs(totalProfit - 100) > 0.01) { newErrors['profit-total'] = `Total profit sharing % must be 100%. Current: ${totalProfit.toFixed(1)}%`; ok = false; }

    partners.forEach(p => {
      if (!p.firstName.trim()) { newErrors[`p-${p.id}-fn`] = 'First Name required'; ok = false; }
      if (!p.lastName.trim()) { newErrors[`p-${p.id}-ln`] = 'Last Name required'; ok = false; }
      if (!p.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(p.pan)) { newErrors[`p-${p.id}-pan`] = 'Valid PAN required'; ok = false; }
      if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { newErrors[`p-${p.id}-email`] = 'Valid email required'; ok = false; }
      if (!p.mobile || p.mobile.replace(/\D/g, '').length !== 10) { newErrors[`p-${p.id}-mobile`] = 'Valid 10-digit mobile required'; ok = false; }
      if (validators.percent(p.contributionPercent) !== true) { newErrors[`p-${p.id}-contrib`] = 'Enter valid contribution %'; ok = false; }
      if (validators.percent(p.profitSharingPercent) !== true) { newErrors[`p-${p.id}-profit`] = 'Enter valid profit sharing %'; ok = false; }
    });
    setErrors(p => ({ ...p, ...newErrors }));
    if (!ok) setErrorMsg('Please complete all required Partner fields.');
    return ok;
  };

  const validateDocStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    let ok = true;

    if (isLLP) {
      if (docSubStep === 1) {
        if (!uploadedDocs.llpUtilityBill) { newErrors['llpUtilityBill'] = 'Utility Bill is required'; ok = false; }
        partners.forEach(p => {
          if (!p.panFile) { newErrors[`p-${p.id}-panFile`] = 'PAN Card required'; ok = false; }
          if (!p.aadhaarFile) { newErrors[`p-${p.id}-aadhaarFile`] = 'Aadhaar required'; ok = false; }
          if (!p.photo) { newErrors[`p-${p.id}-photo`] = 'Passport photo required'; ok = false; }
          if (!p.dscFile) { newErrors[`p-${p.id}-dscFile`] = 'DSC is required for MCA filing'; ok = false; }
        });
      }
      if (docSubStep === 2) {
        if (!formData.consent1 || !formData.consent2) { newErrors['consent'] = 'Both declarations are required'; ok = false; }
      }
    } else {
      if (docSubStep === 1) {
        if (!uploadedDocs.masterData) { newErrors['masterData'] = 'Master Data Sheet is required'; ok = false; }
        if (!uploadedDocs.utilityBill) { newErrors['utilityBill'] = 'Utility Bill (address proof) is required'; ok = false; }
      }
      if (docSubStep === 2) {
        directors.forEach(d => {
          if (!d.panFile) { newErrors[`d-${d.id}-panFile`] = 'PAN Card required'; ok = false; }
          if (!d.aadhaarFile) { newErrors[`d-${d.id}-aadhaarFile`] = 'Aadhaar required'; ok = false; }
          if (!d.photo) { newErrors[`d-${d.id}-photo`] = 'Passport photo required'; ok = false; }
          if (!d.dscFile) { newErrors[`d-${d.id}-dscFile`] = 'DSC is required for MCA filing'; ok = false; }
        });
      }
      if (docSubStep === 3) {
        if (!formData.consent1 || !formData.consent2) { newErrors['consent'] = 'Both declarations are required'; ok = false; }
      }
    }

    setErrors(p => ({ ...p, ...newErrors }));
    if (!ok) setErrorMsg('Please complete all required fields.');
    return ok;
  };

  // ── Draft Saving ──────────────────────────────────────────────────────────
  const saveDraft = async (stepOverride?: number, subStepOverride?: number) => {
    if (!user?.uid) return;
    setIsDraftSaving(true);
    try {
      const draftData = {
        serviceType: 'company_registration',
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        docSubStep: subStepOverride !== undefined ? subStepOverride : docSubStep,
        caseId,
        uploadedFileNames,
        // Filter out binary files from directors/partners but KEEP names
        directors: directors.map(d => ({
          ...d,
          panFile: null, aadhaarFile: null, photo: null, addressProof: null, dscFile: null,
          panFileName: d.panFileName || (d.panFile instanceof File ? d.panFile.name : null),
          aadhaarFileName: d.aadhaarFileName || (d.aadhaarFile instanceof File ? d.aadhaarFile.name : null),
          photoFileName: d.photoFileName || (d.photo instanceof File ? d.photo.name : null),
          addressProofFileName: d.addressProofFileName || (d.addressProof instanceof File ? d.addressProof.name : null),
          dscFileName: d.dscFileName || (d.dscFile instanceof File ? d.dscFile.name : null),
        })),
        partners: partners.map(p => ({
          ...p,
          panFile: null, aadhaarFile: null, photo: null, addressProof: null, dscFile: null,
          panFileName: p.panFileName || (p.panFile instanceof File ? p.panFile.name : null),
          aadhaarFileName: p.aadhaarFileName || (p.aadhaarFile instanceof File ? p.aadhaarFile.name : null),
          photoFileName: p.photoFileName || (p.photo instanceof File ? p.photo.name : null),
          addressProofFileName: p.addressProofFileName || (p.addressProof instanceof File ? p.addressProof.name : null),
          dscFileName: p.dscFileName || (p.dscFile instanceof File ? p.dscFile.name : null),
        })),
        lastDraftSavedAt: serverTimestamp(),
        userId: user.uid,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'drafts', `company_reg_${user.uid}`), draftData, { merge: true });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error("Draft save failed:", err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = async () => {
    // Participant step (Directors or Partners)
    if (currentStep === participantStepIndex) {
      if (isLLP) {
        if (!validatePartners()) return;
      } else {
        if (!validateDirectors()) return;
      }
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await saveDraft(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Document step
    if (currentStep === docStepIndex) {
      if (!validateDocStep()) return;
      if (docSubStep < maxDocSubStep) {
        const nextSubStep = docSubStep + 1;
        setDocSubStep(nextSubStep);
        await saveDraft(currentStep, nextSubStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setShowOTPModal(true);
      return;
    }

    if (!validateStep(currentStep)) return;
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    await saveDraft(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (currentStep === docStepIndex && docSubStep > 1) {
      setDocSubStep(p => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentStep === 0) {
      setShowExitConfirm(true);
      return;
    }
    setCurrentStep(p => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDocUpload = (key: DocKey) => (file: File | null) => {
    setUploadedDocs(p => ({ ...p, [key]: file }));
    setUploadedFileNames(p => ({ ...p, [key]: file ? file.name : '' }));
    setErrors(p => ({ ...p, [key]: '' }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const executeSubmission = async (payInfo?: RazorpaySuccessResponse) => {
    setIsSubmitting(true);
    try {
      const colName = 'applications';
      const fid = caseId;
      const fileUrls: Record<string, string> = {};
      const uid = user?.uid || 'anonymous';

      const uploadFile = async (file: File, key: string) => {
        const path = `company-applications/${uid}/${fid}/${key}_${Date.now()}.${file.name.split('.').pop()}`;
        const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
        return await getDownloadURL(snap.ref);
      };

      for (const [k, file] of Object.entries(uploadedDocs)) {
        if (file) fileUrls[k] = await uploadFile(file, k);
      }

      if (isLLP) {
        for (const p of partners) {
          for (const [fk, file] of [['panFile', p.panFile], ['aadhaarFile', p.aadhaarFile], ['photo', p.photo], ['addressProof', p.addressProof], ['dscFile', p.dscFile]] as [string, File | null][]) {
            if (file) fileUrls[`partner_${p.id}_${fk}`] = await uploadFile(file, `partner_${p.id}_${fk}`);
          }
        }
      } else {
        for (const d of directors) {
          for (const [fk, file] of [['panFile', d.panFile], ['aadhaarFile', d.aadhaarFile], ['photo', d.photo], ['addressProof', d.addressProof], ['dscFile', d.dscFile]] as [string, File | null][]) {
            if (file) fileUrls[`director_${d.id}_${fk}`] = await uploadFile(file, `director_${d.id}_${fk}`);
          }
        }
      }

      const typeLabel = companyTypeOptions.find(o => o.value === formData.companyType)?.label || formData.companyType;
      await setDoc(doc(db, colName, fid), {
        id: fid, caseId,
        type: isLLP ? 'llp-registration' : 'company-registration',
        constitution: typeLabel,
        title: `${typeLabel} — ${isLLP ? (formData.llpName1 || 'New LLP') : (formData.proposedName1 || 'New Company')}`,
        ...buildInitialApplicationStatus({
          serviceType: isLLP ? 'llp-registration' : 'company-registration',
          serviceName: isLLP ? 'LLP Registration' : 'Company Registration',
          userId: uid,
        }),
        submittedAt: serverTimestamp(), createdAt: Date.now(),
        formData,
        ...(isLLP
          ? { partners: partners.map(p => ({ ...p, panFile: null, aadhaarFile: null, photo: null, addressProof: null, dscFile: null })) }
          : { directors: directors.map(d => ({ ...d, panFile: null, aadhaarFile: null, photo: null, addressProof: null, dscFile: null })) }
        ),
        uploadedFileUrls: fileUrls,
        userId: uid, folderId: 'regibiz',
        paymentStatus: payInfo ? 'paid' : (servicePrice > 0 && !packageMode ? 'pending' : 'free'),
        paymentId: payInfo?.razorpay_payment_id || '',
        orderId: payInfo?.razorpay_order_id || '',
        metaData: {
          submittedFrom: window.location.hostname,
          userAgent: navigator.userAgent,
        }
      });

      if (packageMode && onComplete) {
        onComplete({ id: fid, caseId, ...formData });
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

  // ── Director helpers ───────────────────────────────────────────────────────
  const updateDirector = (id: string, field: keyof Director, value: any, fileName?: string) => {
    setDirectors(p => p.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        if (fileName !== undefined) {
          if (field === 'panFile') updated.panFileName = fileName;
          if (field === 'aadhaarFile') updated.aadhaarFileName = fileName;
          if (field === 'photo') updated.photoFileName = fileName;
          if (field === 'addressProof') updated.addressProofFileName = fileName;
          if (field === 'dscFile') updated.dscFileName = fileName;
        }
        return updated;
      }
      return d;
    }));
    setErrors(p => {
      const n = { ...p };
      delete n[`d-${id}-${field}`];
      return n;
    });
  };

  const addDirector = () =>
    setDirectors(p => [...p, { ...INITIAL_DIRECTOR, id: Date.now().toString(), isPrimary: false }]);

  const removeDirector = (id: string) => {
    if (directors.length <= 2) { setErrorMsg('Minimum 2 directors required for Private Limited.'); return; }
    setDirectors(p => p.filter(d => d.id !== id));
  };

  // ── Partner helpers (LLP) ──────────────────────────────────────────────────
  const updatePartner = (id: string, field: keyof Partner, value: any, fileName?: string) => {
    setPartners(p => p.map(x => {
      if (x.id === id) {
        const updated = { ...x, [field]: value };
        if (fileName !== undefined) {
          if (field === 'panFile') updated.panFileName = fileName;
          if (field === 'aadhaarFile') updated.aadhaarFileName = fileName;
          if (field === 'photo') updated.photoFileName = fileName;
          if (field === 'addressProof') updated.addressProofFileName = fileName;
          if (field === 'dscFile') updated.dscFileName = fileName;
        }
        return updated;
      }
      return x;
    }));
    setErrors(p => {
      const n = { ...p };
      delete n[`p-${id}-${field}`];
      return n;
    });
  };

  const addPartner = () =>
    setPartners(p => [...p, { ...INITIAL_PARTNER, id: Date.now().toString(), isPrimary: false, designation: 'Partner', contributionPercent: '0', profitSharingPercent: '0' }]);

  const removePartner = (id: string) => {
    if (partners.length <= 2) { setErrorMsg('Minimum 2 partners required for LLP.'); return; }
    setPartners(p => p.filter(x => x.id !== id));
  };

  // ============================================================================
  // STEP RENDERS
  // ============================================================================

  // ── Step 0: Company Details (Pvt Ltd) ─────────────────────────────────────
  const renderStep0_PvtLtd = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Company Details" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">All details will be used for MCA filings. Company name must comply with <strong>Companies Act 2013</strong> naming guidelines.</p>
      </div>

      <FormSelect label="Type of Company" name="companyType" value={formData.companyType}
        onChange={handleChange} onBlur={handleBlur} error={errors.companyType}
        options={companyTypeOptions} required
        infoText="Pvt Ltd: 2+ directors, 2+ shareholders. LLP: 2+ designated partners, separate legal entity." />

      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60 space-y-4">
        <SubLegend title="Proposed Company Name (3 Options)" />
        <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 mb-3">
          <p className="text-xs text-amber-300">Provide 3 name choices in order of preference. Names must end with 'Private Limited'. Avoid generic or descriptive-only names.</p>
        </div>
        <FormInput label="Proposed Name 1 (First Preference)" name="proposedName1" value={formData.proposedName1}
          onChange={handleChange} onBlur={handleBlur} error={errors.proposedName1}
          placeholder="e.g., RegiBIZ Technologies Private Limited" required />
        <FormInput label="Proposed Name 2 (Second Preference)" name="proposedName2" value={formData.proposedName2}
          onChange={handleChange} placeholder="e.g., RegiBIZ Solutions Private Limited" optional />
	        <FormInput label="Proposed Name 3 (Third Preference)" name="proposedName3" value={formData.proposedName3}
	          onChange={handleChange} placeholder="e.g., RegiBIZ Ventures Private Limited" optional />
	        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	          <FormSelect label="MCA Name Auto-check Status" name="mcaNameCheckStatus" value={formData.mcaNameCheckStatus}
	            onChange={handleChange} options={[
	              { value: '', label: 'Not checked yet' },
	              { value: 'available', label: 'Available / likely available' },
	              { value: 'resubmit', label: 'Needs resubmission / alternate name' },
	              { value: 'approved', label: 'Name approved' },
	            ]} optional />
	          <FormInput label="Name Reservation SRN" name="nameReservationSrn" value={formData.nameReservationSrn}
	            onChange={handleChange} placeholder="Optional MCA SRN after Part A/RUN approval" optional />
	          <FormInput label="SPICe+ Part A SRN" name="spicePartASrn" value={formData.spicePartASrn}
	            onChange={handleChange} placeholder="Optional SRN if name reserved separately" optional />
	          <FormSelect label="AGILE-PRO Linked Registrations" name="agileProRequired" value={formData.agileProRequired}
	            onChange={handleChange} options={[
	              { value: '', label: 'Select if applicable' },
	              { value: 'gst_epfo_esic_bank', label: 'GST + EPFO + ESIC + Bank' },
	              { value: 'epfo_esic_bank', label: 'EPFO + ESIC + Bank only' },
	              { value: 'not_required', label: 'Not required / decide later' },
	            ]} optional />
	        </div>
	      </div>

      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60 space-y-4">
        <SubLegend title="Capital Structure" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FormInput label="Authorized Capital (₹)" name="authorizedCapital" value={formData.authorizedCapital}
            onChange={handleChange} onBlur={handleBlur} error={errors.authorizedCapital}
            placeholder="e.g., 100000" required hint="Min. ₹1,00,000"
            infoText="Maximum capital the company is authorized to issue." />
          <FormInput label="Paid-Up Capital (₹)" name="paidUpCapital" value={formData.paidUpCapital}
            onChange={handleChange} onBlur={handleBlur} error={errors.paidUpCapital}
            placeholder="e.g., 100000" required hint="Must be ≤ Authorized Capital" />
          <FormInput label="Nominal Value per Share (₹)" name="shareNominalValue" value={formData.shareNominalValue}
            onChange={handleChange} placeholder="e.g., 10" required hint="Typically ₹10 or ₹1" />
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60 space-y-4">
        <SubLegend title="Object Clause (MOA)" />
        <FormTextarea label="Main Objects of the Company" name="mainObject" value={formData.mainObject}
          onChange={handleChange} onBlur={handleBlur} error={errors.mainObject} required
          placeholder="e.g., To carry on the business of software development, IT consulting..." rows={5}
          infoText="The primary business purpose stated in the Memorandum of Association." />
        <FormTextarea label="Other Objects / Ancillary Activities" name="otherObjects" value={formData.otherObjects}
          onChange={handleChange} placeholder="e.g., To acquire, hold, and deal in shares..." optional rows={3} />
      </div>
    </fieldset>
  );

  // ── Step 0: LLP Details ────────────────────────────────────────────────────
  const renderStep0_LLP = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="LLP Details" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">
          LLP (Limited Liability Partnership) combines the flexibility of a partnership with limited liability. Governed by the <strong>LLP Act 2008</strong>. Min. 2 designated partners required.
        </p>
      </div>

      <FormSelect label="Registration Type" name="companyType" value={formData.companyType}
        onChange={handleChange} onBlur={handleBlur} error={errors.companyType}
        options={companyTypeOptions} required />

      {/* LLP Name Options */}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60 space-y-4">
        <SubLegend title="Proposed LLP Name (3 Options)" />
        <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 mb-3">
          <p className="text-xs text-amber-300">Provide 3 name choices in order of preference. LLP names must end with 'LLP' or 'Limited Liability Partnership'. MCA will approve one via RUN-LLP.</p>
        </div>
        <FormInput label="Proposed LLP Name 1 (First Preference)" name="llpName1" value={formData.llpName1}
          onChange={handleChange} onBlur={handleBlur} error={errors.llpName1}
          placeholder="e.g., RegiBIZ Advisory LLP" required
          infoText="Your most preferred LLP name. Must end with 'LLP' or 'Limited Liability Partnership'." />
        <FormInput label="Proposed LLP Name 2 (Second Preference)" name="llpName2" value={formData.llpName2}
          onChange={handleChange} placeholder="e.g., RegiBIZ Consulting LLP" optional />
	        <FormInput label="Proposed LLP Name 3 (Third Preference)" name="llpName3" value={formData.llpName3}
	          onChange={handleChange} placeholder="e.g., RegiBIZ Services LLP" optional />
	        <FormInput label="FiLLiP / RUN-LLP SRN" name="fillipSrn" value={formData.fillipSrn}
	          onChange={handleChange} placeholder="Optional MCA SRN after name reservation/incorporation filing" optional />
	      </div>

      {/* Business Activity */}
      <FormSelect label="Primary Business Activity" name="llpBusinessActivity" value={formData.llpBusinessActivity}
        onChange={handleChange} onBlur={handleBlur} error={errors.llpBusinessActivity}
        options={businessActivityOptions} required
        infoText="The main business activity the LLP will carry out. This will be stated in the LLP Agreement." />

      {/* Capital & Profit Sharing */}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60 space-y-4">
        <SubLegend title="Contribution & Profit Sharing" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormInput label="Total Contribution Amount (₹)" name="llpContributionAmount" value={formData.llpContributionAmount}
            onChange={handleChange} onBlur={handleBlur} error={errors.llpContributionAmount}
            placeholder="e.g., 100000" required hint="Combined capital contributed by all partners"
            infoText="Total monetary/non-monetary contribution by all partners. This is stated in the LLP Agreement." />
          <FormInput label="Profit Sharing Ratio (Brief)" name="llpProfitSharingRatio" value={formData.llpProfitSharingRatio}
            onChange={handleChange} onBlur={handleBlur} error={errors.llpProfitSharingRatio}
            placeholder="e.g., 50:50 or As per LLP Agreement" required hint="Per-partner % defined in LLP Agreement"
            infoText="How profits and losses will be shared between partners. Detailed breakdown is captured per-partner in the next step." />
        </div>
        <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-3">
          <p className="text-xs text-cyan-300">
            Unlike companies, LLPs do not issue shares. Partners contribute capital and share profits/losses as per the LLP Agreement. There is no concept of Authorized or Paid-Up capital in an LLP.
          </p>
        </div>
      </div>
    </fieldset>
  );

  // ── Step 1: Registered Office (shared, unchanged) ─────────────────────────
  const renderStep1 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Registered Office Address" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">The registered office must be a <strong>physical address</strong> where official {isLLP ? 'MCA/LLP' : 'MCA'} correspondence will be sent. Proof of address is mandatory.</p>
      </div>
      <FormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1}
        onChange={handleChange} onBlur={handleBlur} error={errors.addressLine1}
        placeholder="Flat/Office No., Building Name, Street" required />
      <FormInput label="Address Line 2 / Landmark" name="addressLine2" value={formData.addressLine2}
        onChange={handleChange} placeholder="Area / Colony / Locality" optional />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormSelect label="State / UT" name="state" value={formData.state}
          onChange={handleChange} onBlur={handleBlur} error={errors.state}
          options={stateOptions} required />
        <FormInput label="City / District" name="city" value={formData.city}
          onChange={handleChange} onBlur={handleBlur} error={errors.city}
          placeholder="Enter city name" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Pincode" name="pincode" value={formData.pincode}
          onChange={handleChange} onBlur={handleBlur} error={errors.pincode}
          placeholder="6-digit pincode" maxLength={6} required />
        <FormInput label={isLLP ? 'LLP Email Address' : 'Company Email Address'} name="email" type="email" value={formData.email}
          onChange={handleChange} onBlur={handleBlur} error={errors.email}
          placeholder="info@yourcompany.com" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Mobile / Phone" name="mobile" type="tel" value={formData.mobile}
          onChange={handleChange} onBlur={handleBlur} error={errors.mobile}
          placeholder="10-digit number" maxLength={10} required />
        <FormInput label="Website (if any)" name="website" value={formData.website}
          onChange={handleChange} placeholder="https://www.yourcompany.com" optional />
      </div>
    </fieldset>
  );

  // ── Step 2: Business Activity (Pvt Ltd only) ───────────────────────────────
  const renderStep2_PvtLtd = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Business Activity" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormSelect label="Primary Business Activity" name="businessActivity" value={formData.businessActivity}
          onChange={handleChange} onBlur={handleBlur} error={errors.businessActivity}
          options={businessActivityOptions} required />
        <FormInput label="NIC Code" name="nicCode" value={formData.nicCode}
          onChange={handleChange} placeholder="e.g., 62010"
          hint="National Industrial Classification Code" optional />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput type="date" label="Proposed Date of Commencement" name="dateOfCommencement" value={formData.dateOfCommencement}
          onChange={handleChange} optional />
        <FormSelect label="Financial Year End" name="financialYearEnd" value={formData.financialYearEnd}
          onChange={handleChange}
          options={[
            { value: 'March 31', label: 'March 31 (Standard — Recommended)' },
            { value: 'December 31', label: 'December 31' },
            { value: 'June 30', label: 'June 30' },
            { value: 'September 30', label: 'September 30' },
          ]} />
      </div>
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60 mt-4">
        <SubLegend title="Post-Registration Compliance Requirements" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
          {[
            ['INC-20A', 'File within 180 days of incorporation', 'text-red-400'],
            ['GST Registration', 'If turnover > ₹20L (services) / ₹40L (goods)', 'text-orange-400'],
            ['Annual Returns (MGT-7A)', 'File within 60 days of AGM', 'text-yellow-400'],
            ['Financial Statements (AOC-4)', 'File within 30 days of AGM', 'text-yellow-400'],
            ['Board Meetings', 'Min. 4 per year for Pvt Ltd', 'text-cyan-400'],
            ['Statutory Auditor', 'Appoint within 30 days', 'text-cyan-400'],
          ].map(([title, desc, color]) => (
            <div key={title} className="flex items-start gap-2">
              <svg className={`w-4 h-4 ${color} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
              <div><p className={`font-semibold ${color}`}>{title}</p><p>{desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  );

  // ── Step 3/2: Directors (Pvt Ltd) ──────────────────────────────────────────
  const renderDirectorsStep = () => (
    <div>
      <SectionLegend title="Directors & Subscribers" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">
          <strong>Pvt Ltd:</strong> Min. 2 directors, max. 15. First Directors will also be the first Subscribers to the Memorandum.
        </p>
      </div>
      {errors['primary-director'] && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 mb-4">{errors['primary-director']}</div>
      )}
      {directors.map((director, index) => (
        <div key={director.id} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/60 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold">{index + 1}</span>
              Director {index + 1}
              {director.isPrimary && <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">Primary (Authorised Signatory)</span>}
            </h4>
            {directors.length > 1 && (
              <button type="button" onClick={() => removeDirector(director.id)}
                className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors">Remove</button>
            )}
          </div>
          <div className="mb-5 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="primary-director" checked={director.isPrimary}
                onChange={() => setDirectors(p => p.map(d => ({ ...d, isPrimary: d.id === director.id })))}
                className="w-4 h-4 text-cyan-500" />
              <span className="text-sm text-slate-300">Mark as Primary Director (Authorised Signatory for all MCA filings)</span>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormSelect label="Designation" value={director.designation} name={`des-${director.id}`}
              onChange={e => updateDirector(director.id, 'designation', e.target.value)}
              options={designationOptions} required />
            <FormInput label="DIN (if already obtained)" value={director.din} name={`din-${director.id}`}
              onChange={e => updateDirector(director.id, 'din', e.target.value)}
              placeholder="8-digit DIN" maxLength={8} optional hint="Director Identification Number" />
          </div>
          <SubLegend title="Director Name" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <FormInput label="First Name" value={director.firstName} name={`fn-${director.id}`}
              onChange={e => updateDirector(director.id, 'firstName', e.target.value)}
              error={errors[`d-${director.id}-fn`]} required placeholder="First name" />
            <FormInput label="Middle Name" value={director.middleName} name={`mn-${director.id}`}
              onChange={e => updateDirector(director.id, 'middleName', e.target.value)} optional placeholder="Optional" />
            <FormInput label="Last Name" value={director.lastName} name={`ln-${director.id}`}
              onChange={e => updateDirector(director.id, 'lastName', e.target.value)}
              error={errors[`d-${director.id}-ln`]} required placeholder="Last name" />
          </div>
          <SubLegend title="Father's Name" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <FormInput label="First Name" value={director.fatherFirstName} name={`ffn-${director.id}`}
              onChange={e => updateDirector(director.id, 'fatherFirstName', e.target.value)} required placeholder="Father's first" />
            <FormInput label="Middle Name" value={director.fatherMiddleName} name={`fmn-${director.id}`}
              onChange={e => updateDirector(director.id, 'fatherMiddleName', e.target.value)} optional placeholder="Optional" />
            <FormInput label="Last Name" value={director.fatherLastName} name={`fln-${director.id}`}
              onChange={e => updateDirector(director.id, 'fatherLastName', e.target.value)} required placeholder="Father's last" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <FormInput type="date" label="Date of Birth" value={director.dob} name={`dob-${director.id}`}
              onChange={e => updateDirector(director.id, 'dob', e.target.value)}
              error={errors[`d-${director.id}-dob`]} required />
            <FormSelect label="Gender" value={director.gender} name={`gender-${director.id}`}
              onChange={e => updateDirector(director.id, 'gender', e.target.value)}
              options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} required />
            <FormSelect label="Nationality" value={director.nationality} name={`nat-${director.id}`}
              onChange={e => updateDirector(director.id, 'nationality', e.target.value)}
              options={[{ value: 'Indian', label: 'Indian' }, { value: 'NRI', label: 'NRI' }, { value: 'Foreign', label: 'Foreign National' }]} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormInput label="PAN Number" value={director.pan} name={`pan-${director.id}`}
              onChange={e => updateDirector(director.id, 'pan', e.target.value.toUpperCase().slice(0, 10))}
              error={errors[`d-${director.id}-pan`]} required placeholder="ABCDE1234F" maxLength={10} hint="Individual PAN card" />
            <FormInput label="Aadhaar Number" value={director.aadhaar} name={`aadhaar-${director.id}`}
              onChange={e => updateDirector(director.id, 'aadhaar', e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="12-digit Aadhaar" maxLength={12} optional hint="For DSC and Video KYC" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormInput type="tel" label="Mobile (Aadhaar Linked)" value={director.mobile} name={`mob-${director.id}`}
              onChange={e => updateDirector(director.id, 'mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              error={errors[`d-${director.id}-mobile`]} required placeholder="10-digit mobile" maxLength={10} />
            <FormInput type="email" label="Email ID" value={director.email} name={`email-${director.id}`}
              onChange={e => updateDirector(director.id, 'email', e.target.value)}
              error={errors[`d-${director.id}-email`]} required placeholder="director@email.com" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect label="Occupation" value={director.occupation} name={`occ-${director.id}`}
              onChange={e => updateDirector(director.id, 'occupation', e.target.value)}
              options={[
                { value: 'Business', label: 'Business' },
                { value: 'Service', label: 'Service' }, { value: 'Student', label: 'Student' },
                { value: 'Housewife', label: 'Housewife' }, { value: 'Retired', label: 'Retired' },
              ]} required />
            <FormInput label="Shareholding (%)" value={director.sharePercent} name={`share-${director.id}`}
              onChange={e => updateDirector(director.id, 'sharePercent', e.target.value)}
              placeholder="e.g., 50" hint="% of total shares held" optional />
          </div>
        </div>
      ))}
      <button type="button" onClick={addDirector}
        className="w-full py-4 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-cyan-400 hover:border-cyan-500 transition-all font-medium flex items-center justify-center gap-2 mb-4">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        Add Another Director
      </button>
      <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4">
        <p className="text-xs text-amber-300 flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          All directors must obtain a <strong>DSC (Class 3)</strong> before SPICe+ can be filed. DIN will be generated automatically through SPICe+. Our team will coordinate this process.
        </p>
      </div>
    </div>
  );

  // ── Step 2 (LLP): Partners ─────────────────────────────────────────────────
  const renderPartnersStep = () => {
    const totalContrib = partners.reduce((sum, p) => sum + (parseFloat(p.contributionPercent) || 0), 0);
    const totalProfit = partners.reduce((sum, p) => sum + (parseFloat(p.profitSharingPercent) || 0), 0);

    return (
      <div>
        <SectionLegend title="Partners" />
        <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-sky-300">
            <strong>LLP:</strong> Min. 2 partners required. At least 2 must be <strong>Designated Partners</strong> (residents of India). Designated Partners are responsible for filing and compliance.
          </p>
        </div>

        {errors['primary-partner'] && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 mb-4">{errors['primary-partner']}</div>
        )}

        {/* Totals banner */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className={`flex-1 min-w-[160px] p-3 rounded-lg border text-xs ${Math.abs(totalContrib - 100) < 0.01 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
            <span className="font-medium">Total Contribution %:</span>
            <span className="ml-2 font-bold font-mono">{totalContrib.toFixed(1)}% {Math.abs(totalContrib - 100) < 0.01 ? '✓' : '(must be 100%)'}</span>
          </div>
          <div className={`flex-1 min-w-[160px] p-3 rounded-lg border text-xs ${Math.abs(totalProfit - 100) < 0.01 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
            <span className="font-medium">Total Profit Sharing %:</span>
            <span className="ml-2 font-bold font-mono">{totalProfit.toFixed(1)}% {Math.abs(totalProfit - 100) < 0.01 ? '✓' : '(must be 100%)'}</span>
          </div>
        </div>

        {errors['contrib-total'] && <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-400 mb-4">{errors['contrib-total']}</div>}
        {errors['profit-total'] && <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-400 mb-4">{errors['profit-total']}</div>}

        {partners.map((partner, index) => (
          <div key={partner.id} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/60 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold">{index + 1}</span>
                Partner {index + 1}
                {partner.designation === 'Designated Partner' && (
                  <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">Designated Partner</span>
                )}
              </h4>
              {partners.length > 2 && (
                <button type="button" onClick={() => removePartner(partner.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors">Remove</button>
              )}
            </div>

            {/* Designation */}
            <FormSelect label="Designation" value={partner.designation} name={`pdes-${partner.id}`}
              onChange={e => updatePartner(partner.id, 'designation', e.target.value as Partner['designation'])}
              options={llpDesignationOptions} required
              infoText="Designated Partners manage compliance and filings. At least 2 Designated Partners required." />

            {/* Name */}
            <SubLegend title="Partner Name" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <FormInput label="First Name" value={partner.firstName} name={`pfn-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'firstName', e.target.value)}
                error={errors[`p-${partner.id}-fn`]} required placeholder="First name" />
              <FormInput label="Middle Name" value={partner.middleName} name={`pmn-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'middleName', e.target.value)} optional placeholder="Optional" />
              <FormInput label="Last Name" value={partner.lastName} name={`pln-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'lastName', e.target.value)}
                error={errors[`p-${partner.id}-ln`]} required placeholder="Last name" />
            </div>

            {/* Father's Name */}
            <SubLegend title="Father's Name" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <FormInput label="First Name" value={partner.fatherFirstName} name={`pffn-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'fatherFirstName', e.target.value)} required placeholder="Father's first" />
              <FormInput label="Middle Name" value={partner.fatherMiddleName} name={`pfmn-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'fatherMiddleName', e.target.value)} optional placeholder="Optional" />
              <FormInput label="Last Name" value={partner.fatherLastName} name={`pfln-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'fatherLastName', e.target.value)} required placeholder="Father's last" />
            </div>

            {/* Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormInput type="date" label="Date of Birth" value={partner.dob} name={`pdob-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'dob', e.target.value)} required />
              <FormSelect label="Nationality" value={partner.nationality} name={`pnat-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'nationality', e.target.value)}
                options={[{ value: 'Indian', label: 'Indian' }, { value: 'NRI', label: 'NRI' }, { value: 'Foreign', label: 'Foreign National' }]} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormInput label="PAN Number" value={partner.pan} name={`ppan-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'pan', e.target.value.toUpperCase().slice(0, 10))}
                error={errors[`p-${partner.id}-pan`]} required placeholder="ABCDE1234F" maxLength={10} hint="Individual PAN card" />
              <FormInput label="Aadhaar Number" value={partner.aadhaar} name={`padh-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'aadhaar', e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="12-digit Aadhaar" maxLength={12} optional hint="For DSC and KYC" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormInput type="tel" label="Mobile (Aadhaar Linked)" value={partner.mobile} name={`pmob-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                error={errors[`p-${partner.id}-mobile`]} required placeholder="10-digit mobile" maxLength={10} />
              <FormInput type="email" label="Email ID" value={partner.email} name={`peml-${partner.id}`}
                onChange={e => updatePartner(partner.id, 'email', e.target.value)}
                error={errors[`p-${partner.id}-email`]} required placeholder="partner@email.com" />
            </div>

            {/* Contribution & Profit Sharing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Contribution (%)" value={partner.contributionPercent} name={`pcontrib-${partner.id}`}
                type="number" min={0} max={100}
                onChange={e => updatePartner(partner.id, 'contributionPercent', e.target.value)}
                error={errors[`p-${partner.id}-contrib`]} required
                placeholder="e.g., 50" hint="This partner's share of total capital contribution"
                infoText="Percentage of the total LLP contribution amount this partner is investing." />
              <FormInput label="Profit Sharing (%)" value={partner.profitSharingPercent} name={`pprofit-${partner.id}`}
                type="number" min={0} max={100}
                onChange={e => updatePartner(partner.id, 'profitSharingPercent', e.target.value)}
                error={errors[`p-${partner.id}-profit`]} required
                placeholder="e.g., 50" hint="This partner's share of profits and losses"
                infoText="Percentage of profits (and losses) this partner will receive per the LLP Agreement." />
            </div>
          </div>
        ))}

        <button type="button" onClick={addPartner}
          className="w-full py-4 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-cyan-400 hover:border-cyan-500 transition-all font-medium flex items-center justify-center gap-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add Another Partner
        </button>

        <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4">
          <p className="text-xs text-amber-300 flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Both Designated Partners must have a <strong>DSC (Class 3)</strong> and obtain a <strong>DPIN</strong> before FiLLiP can be filed. Our team will coordinate this.
          </p>
        </div>
      </div>
    );
  };

  // ── Step 3 (LLP) / Step 4 (Pvt Ltd): Documents ────────────────────────────
  const renderDocStep = () => {
    const subStepLabels = isLLP
      ? ['Partner KYC & Office Docs', 'Declaration']
      : ['Company Docs', 'Director KYC', 'Declaration'];

    return (
      <div>
        {/* Sub-step progress */}
        <div className="mb-8">
          <SectionLegend title={
            isLLP
              ? (docSubStep === 1 ? 'Partner KYC & Office Documents' : 'Declaration & Consent')
              : (docSubStep === 1 ? 'Company & Office Address Documents' : docSubStep === 2 ? 'Directors KYC Documents' : 'Declaration & Consent')
          } />
          <div className="flex items-center gap-2 mb-2">
            {subStepLabels.map((_, s) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${s + 1 < docSubStep ? 'bg-emerald-500' : s + 1 === docSubStep ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-slate-700'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            {subStepLabels.map((l, i) => (
              <span key={i} className={i + 1 === docSubStep ? 'text-cyan-400 font-medium' : ''}>{l}</span>
            ))}
          </div>
        </div>

        <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-sky-300">All files max <strong>5MB</strong>. PDF, JPG, PNG accepted.</p>
        </div>

        {/* ── LLP Doc Sub-step 1: Partner KYC + Office ── */}
        {isLLP && docSubStep === 1 && (
          <div className="space-y-8">
            {/* Partner KYC */}
            <div className="space-y-6">
              {partners.map((partner, index) => (
                <div key={partner.id} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/60">
                  <h4 className="text-white font-semibold mb-5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold text-white">{index + 1}</span>
                    Partner {index + 1} — {partner.firstName || 'Name not entered'} {partner.lastName}
                    {partner.designation === 'Designated Partner' && (
                      <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">Designated</span>
                    )}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FileUploader label="PAN Card" name={`pPan-${partner.id}`} required
                      uploadedFile={partner.panFile}
                      onChange={f => updatePartner(partner.id, 'panFile', f, f ? f.name : '')}
                      error={errors[`p-${partner.id}-panFile`]}
                      fileName={partner.panFileName}
                      hint="Clear scan of individual PAN card" />
                    <FileUploader label="Aadhaar Card" name={`pAadh-${partner.id}`} required
                      uploadedFile={partner.aadhaarFile}
                      onChange={f => updatePartner(partner.id, 'aadhaarFile', f, f ? f.name : '')}
                      error={errors[`p-${partner.id}-aadhaarFile`]}
                      fileName={partner.aadhaarFileName}
                      hint="Both front and back sides" />
                    <FileUploader label="Passport-size Photo" name={`pPhoto-${partner.id}`} required
                      uploadedFile={partner.photo}
                      onChange={f => updatePartner(partner.id, 'photo', f, f ? f.name : '')}
                      error={errors[`p-${partner.id}-photo`]}
                      fileName={partner.photoFileName}
                      accept=".jpg,.jpeg,.png"
                      hint="White background, clear face — JPG/PNG" />
                    <FileUploader label="Address Proof of Partner" name={`pAddr-${partner.id}`}
                      uploadedFile={partner.addressProof}
                      onChange={f => updatePartner(partner.id, 'addressProof', f, f ? f.name : '')}
                      fileName={partner.addressProofFileName}
                      hint="Utility bill / Bank statement / Rent agreement" optional />
                    <FileUploader label="Digital Signature Certificate (DSC)" name={`pDsc-${partner.id}`} required
                      uploadedFile={partner.dscFile}
                      onChange={f => updatePartner(partner.id, 'dscFile', f, f ? f.name : '')}
                      fileName={partner.dscFileName}
                      error={errors[`p-${partner.id}-dscFile`]}
                      accept=".pfx,.p12,.pdf"
                      hint=".pfx / .p12 / .pdf"
                      infoText="Class 3 DSC is required for MCA portal filing. Apply for DSC from the requirement page if it is not available yet." />
                  </div>
                </div>
              ))}
            </div>

            {/* Registered Office Docs */}
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60">
              <SubLegend title="Registered Office Documents" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="Utility Bill (Electricity / Gas / Water)" name="llpUtilityBill" required
                  uploadedFile={uploadedDocs.llpUtilityBill} onChange={handleDocUpload('llpUtilityBill')}
                  hint="Not older than 2 months" error={errors.llpUtilityBill}
                  fileName={uploadedFileNames.llpUtilityBill}
                  infoText="Utility bill for the registered office address." />
                <FileUploader label="NOC from Property Owner" name="llpNoc"
                  uploadedFile={uploadedDocs.llpNoc} onChange={handleDocUpload('llpNoc')}
                  fileName={uploadedFileNames.llpNoc}
                  hint="If office is not owned by the LLP" optional />
                <FileUploader label="Rent / Lease Agreement" name="llpRentAgreement"
                  uploadedFile={uploadedDocs.llpRentAgreement} onChange={handleDocUpload('llpRentAgreement')}
                  fileName={uploadedFileNames.llpRentAgreement}
                  hint="For rented premises" optional />
                <FileUploader label="LLP Agreement Draft (if available)" name="llpAgreement"
                  uploadedFile={uploadedDocs.llpAgreement} onChange={handleDocUpload('llpAgreement')}
                  fileName={uploadedFileNames.llpAgreement}
                  hint="Optional — our team can draft this" optional
                  infoText="The LLP Agreement defines rights, duties, and profit sharing among partners. Must be filed within 30 days of incorporation. Our team can draft if not uploaded." />
              </div>
            </div>
          </div>
        )}

        {/* ── LLP Doc Sub-step 2: Declaration ── */}
        {isLLP && docSubStep === 2 && renderDeclarationStep(true)}

        {/* ── Pvt Ltd Doc Sub-step 1: Company Docs ── */}
        {!isLLP && docSubStep === 1 && (
          <div className="space-y-8">
            <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-5">
              <SubLegend title="Master Data Sheet" />
              <p className="text-xs text-amber-300 mb-4 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                The Master Data Sheet consolidates all company and director details for SPICe+ filing. Our team will provide the template.
              </p>
              <FileUploader label="Master Data Sheet" name="masterData" required
                uploadedFile={uploadedDocs.masterData} onChange={handleDocUpload('masterData')}
                fileName={uploadedFileNames.masterData}
                hint="Filled Master Data template — PDF / Excel" error={errors.masterData} />
            </div>
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60">
              <SubLegend title="Registered Office Address Proof" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="Utility Bill (Electricity / Gas / Water)" name="utilityBill" required
                  uploadedFile={uploadedDocs.utilityBill} onChange={handleDocUpload('utilityBill')}
                  fileName={uploadedFileNames.utilityBill}
                  hint="Not older than 2 months" error={errors.utilityBill} />
                <FileUploader label="NOC from Property Owner" name="noc"
                  uploadedFile={uploadedDocs.noc} onChange={handleDocUpload('noc')}
                  fileName={uploadedFileNames.noc}
                  hint="If office is not owned by the company" optional />
                <FileUploader label="Rent / Lease Agreement" name="rentAgreement"
                  uploadedFile={uploadedDocs.rentAgreement} onChange={handleDocUpload('rentAgreement')}
                  fileName={uploadedFileNames.rentAgreement}
                  hint="For rented premises" optional />
                <FileUploader label="Sale Deed / Property Tax Receipt" name="addressProof"
                  uploadedFile={uploadedDocs.addressProof} onChange={handleDocUpload('addressProof')}
                  fileName={uploadedFileNames.addressProof}
                  hint="For owned premises" optional />
              </div>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60">
              <SubLegend title="MOA & AOA (Optional — We Can Draft)" />
              <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-3 mb-4">
                <p className="text-xs text-cyan-300">If you have custom MOA/AOA, upload here. Otherwise our team drafts standard documents based on your object clause.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="Memorandum of Association (MOA)" name="moa"
                  uploadedFile={uploadedDocs.moa} onChange={handleDocUpload('moa')}
                  fileName={uploadedFileNames.moa}
                  hint="Custom MOA — optional" optional />
                <FileUploader label="Articles of Association (AOA)" name="aoa"
                  uploadedFile={uploadedDocs.aoa} onChange={handleDocUpload('aoa')}
                  fileName={uploadedFileNames.aoa}
                  hint="Custom AOA — optional" optional />
              </div>
            </div>
          </div>
        )}

        {/* ── Pvt Ltd Doc Sub-step 2: Director KYC ── */}
        {!isLLP && docSubStep === 2 && (
          <div className="space-y-6">
            {directors.map((director, index) => (
              <div key={director.id} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/60">
                <h4 className="text-white font-semibold mb-5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold text-white">{index + 1}</span>
                  Director {index + 1} — {director.firstName || 'Name not entered'} {director.lastName}
                  {director.isPrimary && <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">Primary</span>}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FileUploader label="PAN Card" name={`panFile-${director.id}`} required
                    uploadedFile={director.panFile}
                    onChange={f => updateDirector(director.id, 'panFile', f, f ? f.name : '')}
                    fileName={director.panFileName}
                    error={errors[`d-${director.id}-panFile`]} hint="Clear scan / photo of PAN card" />
                  <FileUploader label="Aadhaar Card" name={`aadhaarFile-${director.id}`} required
                    uploadedFile={director.aadhaarFile}
                    onChange={f => updateDirector(director.id, 'aadhaarFile', f, f ? f.name : '')}
                    fileName={director.aadhaarFileName}
                    error={errors[`d-${director.id}-aadhaarFile`]} hint="Both front and back sides" />
                  <FileUploader label="Passport-size Photo" name={`photo-${director.id}`} required
                    uploadedFile={director.photo}
                    onChange={f => updateDirector(director.id, 'photo', f, f ? f.name : '')}
                    fileName={director.photoFileName}
                    error={errors[`d-${director.id}-photo`]}
                    accept=".jpg,.jpeg,.png" hint="White background, clear face" />
                  <FileUploader label="Address Proof of Director" name={`addrProof-${director.id}`}
                    uploadedFile={director.addressProof}
                    onChange={f => updateDirector(director.id, 'addressProof', f, f ? f.name : '')}
                    fileName={director.addressProofFileName}
                    hint="Electricity bill / Bank statement" optional />
                  <FileUploader label="Digital Signature Certificate (DSC)" name={`dscFile-${director.id}`} required
                    uploadedFile={director.dscFile}
                    onChange={f => updateDirector(director.id, 'dscFile', f, f ? f.name : '')}
                    fileName={director.dscFileName}
                    error={errors[`d-${director.id}-dscFile`]}
                    accept=".pfx,.p12,.pdf" hint=".pfx / .p12 / .pdf"
                    infoText="Class 3 DSC is required for MCA portal filing. Apply for DSC from the requirement page if it is not available yet." />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pvt Ltd Doc Sub-step 3: Declaration ── */}
        {!isLLP && docSubStep === 3 && renderDeclarationStep(false)}
      </div>
    );
  };

  // ── Declaration Sub-step (shared, context-aware) ──────────────────────────
  const renderDeclarationStep = (llp: boolean) => (
    <div className="space-y-6">
      <div className="space-y-4 mb-6">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="consent1" checked={formData.consent1}
              onChange={handleChange}
              className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
            <span className="text-sm text-slate-300">
              {llp
                ? 'I authorize RegiBIZ and its affiliated CA professionals to file the LLP Incorporation application (FiLLiP, LLP Agreement) on behalf of all proposed partners, and to coordinate the DSC, DPIN, and name reservation process via RUN-LLP on the MCA portal.'
                : 'I authorize RegiBIZ and its affiliated CA professionals to file the Company Incorporation application (SPICe+, INC-9, MOA, AOA) on behalf of all proposed directors and subscribers, and to coordinate the DSC, DIN, and name reservation process on the MCA portal.'}
            </span>
          </label>
          {errors.consent1 && <p className="text-xs text-red-400 mt-2 ml-8">{errors.consent1}</p>}
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="consent2" checked={formData.consent2}
              onChange={handleChange}
              className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
            <span className="text-sm text-slate-300">
              I hereby declare and confirm that all information provided — including {llp ? 'LLP name, business activity, contribution amount, profit sharing ratio, and partner' : 'company details, object clauses, capital structure, and director'} particulars and address — is true, accurate, and complete to the best of my knowledge. I understand that providing false information for {llp ? 'LLP' : 'company'} incorporation is a criminal offence under the {llp ? 'LLP Act 2008' : 'Companies Act 2013'}.
            </span>
          </label>
          {errors.consent2 && <p className="text-xs text-red-400 mt-2 ml-8">{errors.consent2}</p>}
        </div>
      </div>

      {/* Quick Summary */}
      <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/60">
        <SubLegend title="Quick Summary" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {(llp ? [
            ['Registration Type', companyTypeOptions.find(o => o.value === formData.companyType)?.label || '—'],
            ['LLP Name (1st Preference)', formData.llpName1 || '—'],
            ['Business Activity', businessActivityOptions.find(o => o.value === formData.llpBusinessActivity)?.label || '—'],
            ['Total Contribution', formData.llpContributionAmount ? `₹${parseFloat(formData.llpContributionAmount).toLocaleString('en-IN')}` : '—'],
            ['Registered State', stateOptions.find(s => s.value === formData.state)?.label || '—'],
            ['Partners', `${partners.length} Partner(s)`],
          ] : [
            ['Company Type', companyTypeOptions.find(o => o.value === formData.companyType)?.label || '—'],
            ['Proposed Name', formData.proposedName1 || '—'],
            ['Authorized Capital', formData.authorizedCapital ? `₹${parseInt(formData.authorizedCapital).toLocaleString('en-IN')}` : '—'],
            ['Paid-Up Capital', formData.paidUpCapital ? `₹${parseInt(formData.paidUpCapital).toLocaleString('en-IN')}` : '—'],
            ['Registered State', stateOptions.find(s => s.value === formData.state)?.label || '—'],
            ['Directors', `${directors.length} Director(s)`],
          ]).map(([k, v]) => (
            <div key={k} className="flex justify-between p-2 bg-slate-900/50 rounded-lg">
              <span className="text-slate-500 text-xs">{k}:</span>
              <span className="text-white text-xs font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {errors.consent && <p className="text-xs text-red-400 text-center">{errors.consent}</p>}
    </div>
  );

  // ── Preview Modal ──────────────────────────────────────────────────────────
  const PreviewModal = () => (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <h3 className="text-2xl font-bold text-white">Application Preview</h3>
          <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          {isLLP ? (
            <>
              <PSection title="LLP Details">
                <PGrid items={[
                  ['Registration Type', companyTypeOptions.find(o => o.value === formData.companyType)?.label || '—'],
                  ['LLP Name 1', formData.llpName1 || '—'],
                  ['LLP Name 2', formData.llpName2 || '—'],
                  ['LLP Name 3', formData.llpName3 || '—'],
                  ['Business Activity', businessActivityOptions.find(o => o.value === formData.llpBusinessActivity)?.label || '—'],
                  ['Total Contribution', formData.llpContributionAmount ? `₹${parseFloat(formData.llpContributionAmount).toLocaleString('en-IN')}` : '—'],
                  ['Profit Sharing Ratio', formData.llpProfitSharingRatio || '—'],
                ]} />
              </PSection>
              <PSection title="Registered Office">
                <PGrid items={[
                  ['Address', `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}`],
                  ['City', formData.city], ['State', stateOptions.find(s => s.value === formData.state)?.label || '—'],
                  ['Pincode', formData.pincode], ['Email', formData.email], ['Mobile', `+91 ${formData.mobile}`],
                ]} />
              </PSection>
              <PSection title={`Partners (${partners.length})`}>
                {partners.map((p, i) => (
                  <div key={p.id} className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Partner {i + 1} — {p.designation}</p>
                    <PGrid items={[
                      ['Name', `${p.firstName} ${p.middleName} ${p.lastName}`.trim() || '—'],
                      ['PAN', p.pan || '—'], ['Mobile', p.mobile ? `+91 ${p.mobile}` : '—'],
                      ['Email', p.email || '—'],
                      ['Contribution %', p.contributionPercent ? `${p.contributionPercent}%` : '—'],
                      ['Profit Share %', p.profitSharingPercent ? `${p.profitSharingPercent}%` : '—'],
                    ]} />
                  </div>
                ))}
              </PSection>
            </>
          ) : (
            <>
              <PSection title="Company Details">
                <PGrid items={[
                  ['Company Type', companyTypeOptions.find(o => o.value === formData.companyType)?.label || '—'],
                  ['Proposed Name 1', formData.proposedName1 || '—'],
                  ['Proposed Name 2', formData.proposedName2 || '—'],
                  ['Proposed Name 3', formData.proposedName3 || '—'],
                  ['Authorized Capital', formData.authorizedCapital ? `₹${parseInt(formData.authorizedCapital).toLocaleString('en-IN')}` : '—'],
                  ['Paid-Up Capital', formData.paidUpCapital ? `₹${parseInt(formData.paidUpCapital).toLocaleString('en-IN')}` : '—'],
                  ['Share Nominal Value', `₹${formData.shareNominalValue}`],
                ]} />
                {formData.mainObject && <div className="mt-3"><p className="text-slate-500 text-xs mb-1">Main Object:</p><p className="text-white text-sm">{formData.mainObject.slice(0, 200)}{formData.mainObject.length > 200 ? '...' : ''}</p></div>}
              </PSection>
              <PSection title="Registered Office">
                <PGrid items={[
                  ['Address', `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}`],
                  ['City', formData.city], ['State', stateOptions.find(s => s.value === formData.state)?.label || '—'],
                  ['Pincode', formData.pincode], ['Email', formData.email], ['Mobile', `+91 ${formData.mobile}`],
                ]} />
              </PSection>
              <PSection title="Business Activity">
                <PGrid items={[
                  ['Activity', businessActivityOptions.find(o => o.value === formData.businessActivity)?.label || '—'],
                  ['NIC Code', formData.nicCode || '—'],
                  ['Financial Year End', formData.financialYearEnd],
                ]} />
              </PSection>
              <PSection title={`Directors (${directors.length})`}>
                {directors.map((d, i) => (
                  <div key={d.id} className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Director {i + 1}{d.isPrimary ? ' (Primary)' : ''} — {d.designation}</p>
                    <PGrid items={[
                      ['Name', `${d.firstName} ${d.middleName} ${d.lastName}`.trim() || '—'],
                      ['PAN', d.pan || '—'], ['Mobile', d.mobile ? `+91 ${d.mobile}` : '—'],
                      ['Email', d.email || '—'], ['Shareholding', d.sharePercent ? `${d.sharePercent}%` : '—'],
                    ]} />
                  </div>
                ))}
              </PSection>
            </>
          )}
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm text-amber-200 flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Please verify all details. Our CA team will contact you within 24 hours to proceed with {isLLP ? 'DSC, DPIN, and LLP filing' : 'DSC, DIN, and MCA filing'}.
            </p>
          </div>
        </div>
        <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0">
          <button onClick={() => setShowPreview(false)} className="px-6 py-2.5 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all font-medium">Close & Edit</button>
          <button onClick={() => { setShowPreview(false); setShowOTPModal(true); }} disabled={isSubmitting}
            className="px-8 py-2.5 rounded-lg font-bold bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white disabled:opacity-50 flex items-center gap-2">
            Confirm & Submit
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (isSuccess) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <CelebrationPopup trigger={isSuccess} message="" />
      <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-800">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isLLP ? 'LLP Registration Application Submitted!' : 'Company Registration Application Submitted!'}
        </h2>
        <p className="text-slate-400 mb-4 text-sm">
          Our CA team will review your application and contact you within 24 hours to initiate {isLLP ? 'DSC, DPIN, and LLP filing' : 'DSC, DIN, and MCA filing'}.
        </p>
        <div className="mb-6"><p className="text-slate-500 text-xs mb-1">Your Case ID:</p><p className="text-orange-400 font-mono font-bold text-sm tracking-wide">{caseId}</p></div>
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700 space-y-2">
          {(isLLP ? [
            ['LLP Name', formData.llpName1 || '—'],
            ['Type', 'Limited Liability Partnership (LLP)'],
            ['Email', formData.email],
            ['Partners', `${partners.length} Partner(s)`],
          ] : [
            ['Company', formData.proposedName1 || '—'],
            ['Type', companyTypeOptions.find(o => o.value === formData.companyType)?.label || '—'],
            ['Email', formData.email],
            ['Directors', `${directors.length} Director(s)`],
          ]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs"><span className="text-slate-500">{k}</span><span className="text-white font-medium truncate ml-2">{v}</span></div>
          ))}
        </div>
        <div className="space-y-3">
          <button onClick={() => { window.location.href = '/#/documents'; }} className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all text-sm">
            View Submitted Application
          </button>
          <button onClick={() => navigate('/services/company-registration')} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-lg border border-slate-700 text-sm">
            Back to Services
          </button>
        </div>
      </div>
    </div>
  );

  // ── Loading Screen ─────────────────────────────────────────────────────────
  if (isInitialLoading) return (
    <div className="min-h-screen bg-[#031f31] flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin mb-4" />
      <p className="text-cyan-500/60 text-xs font-black uppercase tracking-[0.2em] animate-pulse">Restoring your session...</p>
    </div>
  );

  // ── Compute current step title ─────────────────────────────────────────────
  const stepLabels = isLLP ? LLP_STEP_LABELS : STEP_LABELS;
  const stepTitle = stepLabels[currentStep] || '';
  const nextButtonLabel = (() => {
    if (currentStep === docStepIndex) {
      if (docSubStep === maxDocSubStep) return 'Submit Application';
      return `Next Page (${docSubStep}/${maxDocSubStep})`;
    }
    return 'Save and Next';
  })();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {isSubmitting && <ProcessingOverlay />}
      {showConfirm?.show && <ConfirmModal message={showConfirm.message} onConfirm={() => { setShowConfirm(null); showConfirm.onConfirm?.(); }} onCancel={() => setShowConfirm(null)} />}
      {showOTPModal && <OTPModal isLLP={isLLP} onConfirm={async () => {
        setShowOTPModal(false);

        // If in package mode, fee is 0, or already paid (pre-paid landing), skip direct payment
        if (packageMode || servicePrice === 0 || paymentInfo) {
          await executeSubmission(paymentInfo || undefined);
          return;
        }

        // Trigger payment
        setIsPaying(true);
        const started = await displayRazorpay(calculateTotalWithGST(servicePrice), (response) => {
          setPaymentInfo(response);
        }, {
          description: `Service Fee: ₹${servicePrice} + GST: ₹${calculateGST(servicePrice)} = Total: ₹${calculateTotalWithGST(servicePrice)}`,
          prefill: {
            name: user?.displayName || (isLLP ? formData.llpName1 : formData.proposedName1),
            email: user?.email || formData.email || '',
            contact: user?.phoneNumber || formData.mobile || ''
          }
        });

        if (!started) {
          setErrorMsg("Failed to initiate payment. Please check your connection.");
          setIsPaying(false);
        }
      }} onCancel={() => setShowOTPModal(false)} />}
      {errorMsg && <ErrorToast message={errorMsg} onClose={() => setErrorMsg(null)} />}
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
                  onClick={handleSaveAndExit}
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
                  onClick={handleExitWithoutSaving}
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
      {showPreview && <PreviewModal />}

      <div className="max-w-[1600px] mx-auto">
        {/* Mobile header */}
        <div className="lg:hidden mb-6 text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">
            {isLLP ? 'LLP Registration' : 'Company Registration'}
          </h1>
          <div className="flex items-center gap-2 mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-slate-800">
                <div 
                  className={`h-full transition-all duration-500 ${i <= currentStep ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : ''}`}
                  style={{ width: i === currentStep ? '100%' : i < currentStep ? '100%' : '0%' }}
                />
              </div>
            ))}
          </div>
          <p className="text-sky-200/80 text-[10px] uppercase font-bold tracking-widest">Step {currentStep + 1} of {totalSteps} — {stepTitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Form */}
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

            <div className="p-6 md:p-10 flex-grow">
              {/* Desktop header */}
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
                  {isLLP ? 'LLP Registration (MCA)' : 'Company Registration (MCA)'}
                </h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">{stepTitle}</p>
              </div>

              <StatusBanner caseId={caseId} companyType={formData.companyType} />

              <form noValidate>
                {/* ─── Pvt Ltd Flow ─── */}
                {!isLLP && currentStep === 0 && renderStep0_PvtLtd()}
                {!isLLP && currentStep === 1 && renderStep1()}
                {!isLLP && currentStep === 2 && renderStep2_PvtLtd()}
                {!isLLP && currentStep === 3 && renderDirectorsStep()}
                {!isLLP && currentStep === 4 && renderDocStep()}

                {/* ─── LLP Flow ─── */}
                {isLLP && currentStep === 0 && renderStep0_LLP()}
                {isLLP && currentStep === 1 && renderStep1()}
                {isLLP && currentStep === 2 && renderPartnersStep()}
                {isLLP && currentStep === 3 && renderDocStep()}
              </form>

              {/* Navigation */}
              <div className="mt-12 pt-6 border-t border-slate-700/50">
                <div className="flex flex-col-reverse md:flex-row items-center gap-4 justify-between">
                  <div className="hidden md:block" />
                  <div className="flex gap-3 w-full md:w-auto">
                    <button type="button" onClick={handleNext} disabled={isSubmitting}
                      className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      {nextButtonLabel}
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-slate-400">
                  Step {currentStep + 1} of {totalSteps} — By continuing, you agree to our{' '}
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
              participantCount={isLLP ? partners.length : directors.length}
              companyType={formData.companyType}
              onPreview={() => setShowPreview(true)}
              paymentVerified={!!paymentInfo}
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

// ── Preview helpers (unchanged) ───────────────────────────────────────────────
const PSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700">
    <h4 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to text-base mb-4">{title}</h4>
    {children}
  </div>
);
const PGrid: React.FC<{ items: [string, string][] }> = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
    {items.map(([k, v]) => (
      <div key={k}><span className="text-slate-500 font-medium block mb-0.5">{k}:</span><span className="text-white font-medium">{v || '—'}</span></div>
    ))}
  </div>
);
