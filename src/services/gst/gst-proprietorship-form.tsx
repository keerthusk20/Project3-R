// src/services/gst/gst-proprietorship-form.tsx
import React, { useState, useEffect, useRef, ChangeEvent, FocusEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { runTransaction, increment, getDoc } from 'firebase/firestore';
import { sendConfirmationEmail } from '../emailService';
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

interface Director {
  id: string;
  designation: string;
  isPrimary: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
  fatherName: {
    firstName: string;
    middleName: string;
    lastName: string;
  };
  mobile: string;
  email: string;
  panFile: boolean;
  aadhaarFile: boolean;
  photoFile: boolean;
}

interface FormData {
  promoterFirstName: string;
  promoterMiddleName: string;
  promoterLastName: string;
  promoterFatherFirstName: string;
  promoterFatherMiddleName: string;
  promoterFatherLastName: string;
  promoterDob: string;
  promoterEmail: string;
  promoterMobile: string;
  promoterAadhaar: string;
  addressLine1: string;
  addressLine2: string;
  district: string;
  state: string;
  pincode: string;
  natureOfBusiness: string;
  consent1: boolean;
  consent2: boolean;
}

type DocKey =
  | 'shopActLicense'
  | 'udyamRegistration'
  | 'tradeLicense'
  | 'msmeCertificate'
  | 'cancelledCheque'
  | 'bankStatement'
  | 'promoterPan'
  | 'promoterAadhaarDoc'
  | 'promoterPhoto'
  | 'rentAgreement'
  | 'noc'
  | 'addressProof'
  | 'elecBill'
  | 'taxReceipt'
  | 'utilityBill'
  | 'rentedAdditionalDoc'
  | 'signPan'
  | 'signAadhaar'
  | 'signPhoto'
  | 'signAuthLetter'
  | 'dsc';

type UploadedFilesState = Record<DocKey, File | null>;

type ProprietorshipSubmissionProfile = {
  subtype: 'proprietorship' | 'shops';
  displayLabel: string;
  shortLabel: string;
  casePrefix: string;
  collectionName: string;
  storageFolder: string;
  title: string;
  emailService: string;
};

interface ProprietorshipFormProps {
  user: any;
  commonData: CommonFormData;
  gstServiceType?: 'proprietorship' | 'shops';
  serviceTypeLabel?: string;
  applicationRef?: string;
  packageMode?: boolean;
  onBack: () => void;
  onSubmit?: (formData: any, uploadedFiles: Record<string, File>) => Promise<void>;
  INDIAN_STATES: { value: string; label: string }[];
  STATE_DISTRICTS: Record<string, { value: string; label: string }[]>;
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  infoText?: string;
}

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  required?: boolean;
}

interface FileUploaderProps {
  label: string;
  name: string;
  accept?: string;
  onChange: (file: File | null) => void;
  required?: boolean;
  hint?: string;
  optional?: boolean;
  value?: boolean;
  fileName?: string | null;
  error?: string;
}

// ============================================================================
// CONSTANTS & DATA
// ============================================================================
const INITIAL_DATA: FormData = {
  promoterFirstName: '',
  promoterMiddleName: '',
  promoterLastName: '',
  promoterFatherFirstName: '',
  promoterFatherMiddleName: '',
  promoterFatherLastName: '',
  promoterDob: '',
  promoterEmail: '',
  promoterMobile: '',
  promoterAadhaar: '',
  addressLine1: '',
  addressLine2: '',
  district: '',
  state: '',
  pincode: '',
  natureOfBusiness: '',
  consent1: false,
  consent2: false,
};

const INITIAL_DIRECTORS: Director[] = [
  {
    id: '1',
    designation: 'Proprietor',
    isPrimary: true,
    firstName: '',
    middleName: '',
    lastName: '',
    fatherName: { firstName: '', middleName: '', lastName: '' },
    mobile: '',
    email: '',
    panFile: false,
    aadhaarFile: false,
    photoFile: false,
  },
];

const INITIAL_UPLOADED_DOCS: Record<DocKey, boolean> = {
  shopActLicense: false,
  udyamRegistration: false,
  tradeLicense: false,
  msmeCertificate: false,
  cancelledCheque: false,
  bankStatement: false,
  promoterPan: false,
  promoterAadhaarDoc: false,
  promoterPhoto: false,
  rentAgreement: false,
  noc: false,
  addressProof: false,
  elecBill: false,
  taxReceipt: false,
  utilityBill: false,
  rentedAdditionalDoc: false,
  signPan: false,
  signAadhaar: false,
  signPhoto: false,
  signAuthLetter: false,
  dsc: false,
};

const NATURE_OPTIONS = [
  'Manufacture',
  'Wholesale Business',
  'Retail Business',
  'Service Provision',
  'Job Work',
  'Import/Export',
  'E-commerce Seller',
  'Input Service Distributor',
];

const BUSINESS_PROOF_OPTIONS = [
  { value: 'shopActLicense', label: 'Shop Act License' },
  { value: 'udyamRegistration', label: 'Udyam Registration' },
  { value: 'tradeLicense', label: 'Trade License' },
  { value: 'msmeCertificate', label: 'MSME Certificate' },
];

const DESIGNATION_OPTIONS = [
  { value: 'Proprietor', label: 'Proprietor' },
  { value: 'Authorized Person', label: 'Authorized Person' },
];

// ============================================================================
// LOCALSTORAGE HELPER FUNCTIONS
// ============================================================================
const STORAGE_KEYS = {
  FORM_DATA: 'gstProprietorFormData',
  CURRENT_STEP: 'gstProprietorCurrentStep',
  UPLOADED_DOCS: 'gstProprietorUploadedDocs',
  DOC_FILE_NAMES: 'gstProprietorDocFileNames',
  DIRECTOR_FILE_NAMES: 'gstProprietorDirectorFileNames',
  PROPERTY_TYPE: 'gstProprietorPropertyType',
  SIGNATORY: 'gstProprietorSignatory',
  DIRECTORS: 'gstProprietorDirectors',
  INCLUDE_DIRECTORS: 'gstProprietorIncludeDirectors',
  BUSINESS_PROOF_TYPE: 'gstProprietorBusinessProofType',
  UTILITY_BILL_TYPE: 'gstProprietorUtilityBillType',
  UTILITY_BILL_FILE_NAME: 'gstProprietorUtilityBillFileName',
  RENTED_DOC_TYPE: 'gstProprietorRentedDocType',
  RENTED_DOC_FILE_NAME: 'gstProprietorRentedDocFileName',
};

const saveToLocalStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', key, e);
  }
};

const loadFromLocalStorage = (key: string, defaultValue: any) => {
  return defaultValue;
};

const clearAllLocalStorage = () => {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

const getFullName = (first: string, middle: string, last: string): string => {
  return [first, middle, last].filter(Boolean).join(' ') || 'N/A';
};

const getSubmissionProfile = (
  gstServiceType: ProprietorshipSubmissionProfile['subtype'] = 'proprietorship',
  serviceTypeLabel?: string
): ProprietorshipSubmissionProfile => {
  const isShopRetail = gstServiceType === 'shops';
  const displayLabel = isShopRetail ? 'Shops & Retail Businesses' : serviceTypeLabel || 'Sole Proprietorship';
  const shortLabel = isShopRetail ? 'Shops & Retail' : 'Proprietorship';

  return {
    subtype: isShopRetail ? 'shops' : 'proprietorship',
    displayLabel,
    shortLabel,
    casePrefix: isShopRetail ? 'GST-SHOP' : 'GST-PROP',
    collectionName: isShopRetail ? 'gst-shop-retail-applications' : 'gst-proprietorship-applications',
    storageFolder: 'gst-applications',
    title: `GST Registration Application - ${shortLabel}`,
    emailService: `GST Registration - ${shortLabel}`,
  };
};

const getNextProprietorshipNumber = async (casePrefix: string): Promise<number> => {
  const year = new Date().getFullYear();
  const counterKey = casePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const counterId = `${counterKey}_${year}`;
  const counterRef = doc(db, 'counters', counterId);

  try {
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      if (!counterDoc.exists()) {
        transaction.set(counterRef, {
          count: 0,
          createdAt: new Date(),
          prefix: casePrefix,
          year: year
        });
        return 1;
      }

      const data = counterDoc.data();

      if (data.year !== year) {
        transaction.update(counterRef, {
          count: 1,
          year: year
        });
        return 1;
      }

      const currentCount = data.count || 0;
      const nextCount = currentCount + 1;

      transaction.update(counterRef, { count: nextCount });

      return nextCount;
    });
  } catch (error) {
    console.error('Counter transaction failed:', error);
    throw error;
  }
};

const generateSequentialId = async (casePrefix: string): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `${casePrefix}-${year}`;

  const formatSeqNum = (num: number): string => {
    return num < 10 ? `0${num}` : `${num}`;
  };

  try {
    const nextNum = await getNextProprietorshipNumber(casePrefix);
    return `${prefix}-${formatSeqNum(nextNum)}`;
  } catch (error) {
    console.error('Error generating sequential ID:', error);
    const timestamp = Date.now().toString().slice(-4);
    const fallbackNum = parseInt(timestamp) % 99 + 1;
    return `${prefix}-${formatSeqNum(fallbackNum)}`;
  }
};

// ============================================================================
// COMPONENTS
// ============================================================================
const FreeCornerRibbon = () => (
  <div
    aria-label="Free service"
    className="absolute top-5 -right-11 z-20 w-40 rotate-45 border border-white/35 bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-700 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(22,163,74,0.38)] pointer-events-none"
  >
    FREE
  </div>
);

// ============================================================================
// VALIDATORS
// ============================================================================
const validators = {
  required: (value: string, fieldName: string = 'This field') =>
    (value && value.trim().length > 0) || `${fieldName} is required`,
  name: (value: string) =>
    /^[A-Za-z\s]{2,50}$/.test(value) || 'Enter a valid name (2-50 characters, letters only)',
  dob: (value: string) => {
    if (!value || !value.trim()) return 'Date of birth is required';
    const cleanValue = value.trim();
    let d: number, m: number, y: number;
    if (cleanValue.includes('/')) {
      const parts = cleanValue.split('/');
      if (parts.length !== 3) return 'Enter date as DD/MM/YYYY';
      [d, m, y] = parts.map(Number);
    } else if (cleanValue.includes('-')) {
      const parts = cleanValue.split('-');
      if (parts.length !== 3) return 'Enter date as DD-MM-YYYY or YYYY-MM-DD';
      if (parts[0].length === 4) {
        [y, m, d] = parts.map(Number);
      } else {
        [d, m, y] = parts.map(Number);
      }
    } else {
      return 'Invalid date format';
    }
    const dob = new Date(y, m - 1, d);
    if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d)
      return 'Invalid date';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    return (age >= 18 && age <= 100) || 'Must be between 18 and 100 years old';
  },
  email: (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email address',
  mobile: (value: string) =>
    /^[6-9]\d{9}$/.test(value) || 'Invalid 10-digit mobile number (must start with 6-9)',
  pincode: (value: string) =>
    /^\d{6}$/.test(value) || 'Pincode must be exactly 6 digits',
  aadhaar: (value: string) =>
    /^\d{12}$/.test(value) || 'Invalid Aadhaar number (must be 12 digits)',
};

// ============================================================================
// UI COMPONENTS
// ============================================================================
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-white hover:text-cyan-400 transition-colors focus:outline-none">
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

// ============================================================================
// HELPER COMPONENTS
// ============================================================================
const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  hint,
  optional,
  infoText,
  className = '',
  id,
  required,
  ...props
}) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  const baseClasses =
    'w-full bg-slate-900/40 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none';
  const errorClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600';

  return (
    <div className="mb-4 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white transition-colors group-focus-within:text-cyan-400">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-white font-medium">Optional</span>}
      </div>
      <input
        id={inputId}
        className={`${baseClasses} ${errorClasses} ${className}`}
        aria-invalid={!!error}
        required={required}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 flex items-center">
          <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-white font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

const SelectInput: React.FC<SelectInputProps> = ({
  label,
  error,
  options,
  required,
  className = '',
  ...props
}) => {
  const baseClasses =
    'w-full bg-slate-800 border text-white text-sm rounded-lg block p-3 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none appearance-none';
  const errorClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600';

  return (
    <div className="mb-4 group">
      <label className="block text-sm font-medium text-white mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <select className={`${baseClasses} ${errorClasses} ${className}`} required={required} {...props}>
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  name,
  accept = '.pdf,.jpg,.jpeg',
  onChange,
  required,
  hint,
  optional,
  value,
  fileName: externalFileName,
  error,
}) => {
  const [fileName, setFileName] = useState<string | null>(externalFileName || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalFileName) setFileName(externalFileName);
    else if (value === false) setFileName(null);
  }, [externalFileName, value]);

  const processFile = (file: File | null) => {
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        alert('File size exceeds 1MB limit');
        return;
      }
      setFileName(file.name);
      onChange(file);
    } else {
      setFileName(null);
      onChange(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    processFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  };

  const displayError = error;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="block text-sm font-medium text-white">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {optional && <span className="text-xs text-white font-medium">Optional</span>}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-white">📎</span>
        <span className="text-[10px] text-white font-medium">
          Max 1MB • JPEG, PDF, PFX, P12 only
        </span>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 ease-in-out cursor-pointer group ${displayError
          ? 'border-red-500 bg-red-500/5'
          : isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : fileName
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/40'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          name={name}
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-lg shrink-0 transition-colors ${fileName
              ? 'bg-emerald-500/20 text-emerald-400'
              : displayError
                ? 'bg-red-500/20 text-red-400'
                : 'bg-slate-700/50 text-white group-hover:text-cyan-400'
              }`}
          >
            {fileName ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{fileName}</p>
                <p className="text-[10px] text-white mt-0.5">Ready to Upload</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                  Click to upload
                </p>
                <p className="text-[10px] text-white mt-0.5">
                  JPEG, PDF, PFX or P12 (max 1MB)
                </p>
                {hint && <p className="text-[10px] text-white mt-0.5">{hint}</p>}
              </div>
            )}
          </div>
          {fileName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFileName(null);
                onChange(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1 hover:bg-red-500/20 text-white hover:text-red-400 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {displayError && (
        <p className="mt-2 text-xs text-red-400 flex items-center">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {displayError}
        </p>
      )}
    </div>
  );
};

const StatusBanner: React.FC = () => (
  <div className="bg-gradient-to-r from-orange-900/30 to-orange-800/10 border border-orange-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-white font-medium line-through text-lg">₹999</span>
        <span className="text-white font-bold text-2xl tracking-tight drop-shadow-sm">FREE</span>
        <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
          Govt charges applicable
        </span>
      </div>
      <p className="text-white text-sm mt-1 font-medium">Includes Digital Signature & Filing</p>
    </div>
  </div>
);

// ============================================================================
// SIDEBAR COMPONENTS (MSME STYLE)
// ============================================================================

const ProgressStatus: React.FC<{
  currentStep: number;
  uploadedFiles: Record<string, boolean>;
  requiredDocs: Array<{ key: string; label: string; isRequired: boolean }>;
}> = ({ currentStep, uploadedFiles, requiredDocs }) => {
  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'active';
    return 'pending';
  };

  const uploadedCount = requiredDocs.filter(doc =>
    doc.isRequired && uploadedFiles[doc.key]
  ).length;

  const requiredCount = requiredDocs.filter(doc => doc.isRequired).length;

  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-all duration-300">
      <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
        <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </span>
        Progress Status
      </h3>
      <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
        {[2, 3, 4, 5, 6, 7, 8].map((step) => (
          <div key={step} className="ml-5 relative">
            <span
              className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${getStepStatus(step) === 'completed'
                ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                : getStepStatus(step) === 'active'
                  ? 'bg-gradient-to-br from-orange-500 to-red-600 ring-4 ring-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.5)] scale-110'
                  : 'bg-slate-700'
                }`}
            ></span>
            <h4 className={`text-sm font-medium transition-colors ${getStepStatus(step) === 'active'
              ? 'text-white'
              : getStepStatus(step) === 'completed'
                ? 'text-white'
                : 'text-white'
              }`}>
              {step === 2 ? 'Proprietor Details & Documents' :
                step === 3 ? 'Business Address & Documents' :
                  step === 4 ? 'Business & Bank Documents' :
                    step === 5 ? 'Signatory Details' :
                      step === 6 ? 'Director Details' :
                        step === 7 ? 'Digital Signature (DSC)' :
                          'Consent & Declaration'}
            </h4>
            <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
              {step === 5
                ? `${uploadedCount}/${requiredCount} Documents Uploaded`
                : getStepStatus(step) === 'completed'
                  ? 'Completed'
                  : getStepStatus(step) === 'active'
                    ? 'In Progress'
                    : 'Pending'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const RequiredDocuments: React.FC<{
  requiredDocs: Array<{ key: string; label: string; isRequired: boolean }>;
  uploadedFiles: Record<string, boolean>;
}> = ({ requiredDocs, uploadedFiles }) => {
  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-all duration-300">
      <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
        <span className="bg-amber-500/20 p-1.5 rounded mr-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </span>
        Required Documents
      </h3>
      <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {requiredDocs.map((item, idx) => {
          const isUploaded = uploadedFiles[item.key];
          return (
            <li
              key={idx}
              className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${item.isRequired
                ? isUploaded
                  ? 'bg-orange-500/10 border border-orange-500/30'
                  : 'bg-slate-900/40 border border-slate-700/50'
                : 'bg-slate-800/20 border border-slate-700/30 opacity-60'
                }`}
            >
              <div className="flex items-center">
                <div className={`mr-3 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isUploaded && item.isRequired
                  ? 'bg-orange-500 text-white'
                  : item.isRequired
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-700/50 text-slate-200'
                  }`}>
                  {isUploaded && item.isRequired ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <span className={`font-medium text-sm ${item.isRequired
                  ? isUploaded ? 'text-white' : 'text-slate-200'
                  : 'text-white'
                  }`}>
                  {item.label}
                </span>
                {!item.isRequired && (
                  <span className="text-xs text-slate-200 ml-2">(Optional)</span>
                )}
              </div>
              {isUploaded && item.isRequired && (
                <span className="text-xs font-bold text-white px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                  READY
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const InfoSidebar: React.FC<{
  formData: FormData;
  uploadedFiles: Record<string, boolean>;
  currentStep: number;
  propertyType: 'owned' | 'rented';
  selectedBusinessProof: string;
  includeSignatoryDetails: boolean;
  includeDirectors: boolean;
  selectedUtilityBillType?: string;
  selectedRentedDocType?: string;
}> = ({
  formData,
  uploadedFiles,
  currentStep,
  propertyType,
  selectedBusinessProof,
  includeSignatoryDetails,
  includeDirectors,
  selectedUtilityBillType = 'electricity',
  selectedRentedDocType = 'noc'
}) => {
    const getRequiredDocuments = () => {
      const docs: Array<{ key: string; label: string; isRequired: boolean }> = [];

      docs.push({ key: 'promoterPan', label: 'Proprietor PAN Card', isRequired: true });
      docs.push({ key: 'promoterAadhaarDoc', label: 'Proprietor Aadhaar Card', isRequired: true });
      docs.push({ key: 'promoterPhoto', label: 'Proprietor Passport Photo', isRequired: true });

      if (propertyType === 'owned') {
        const utilityBillLabel =
          selectedUtilityBillType === 'electricity' ? 'Electricity Bill' :
            selectedUtilityBillType === 'water' ? 'Water Bill' :
              selectedUtilityBillType === 'propertyTax' ? 'Property Tax Receipt' :
                selectedUtilityBillType === 'broadband' ? 'Broadband Bill' :
                  selectedUtilityBillType === 'landline' ? 'Landline Bill' :
                    'Gas Bill';
        docs.push({ key: 'utilityBill', label: utilityBillLabel, isRequired: true });
      } else {
        docs.push({ key: 'rentAgreement', label: 'Rent Agreement', isRequired: true });

        const rentedDocLabel =
          selectedRentedDocType === 'noc' ? 'NOC from Owner' :
            selectedRentedDocType === 'addressProof' ? 'Address Proof' :
              selectedRentedDocType === 'electricity' ? 'Electricity Bill' :
                selectedRentedDocType === 'water' ? 'Water Bill' :
                  selectedRentedDocType === 'propertyTax' ? 'Property Tax Receipt' :
                    selectedRentedDocType === 'broadband' ? 'Broadband Bill' :
                      selectedRentedDocType === 'landline' ? 'Landline Bill' :
                        'Gas Bill';
        // ✅ CHANGED: rentedAdditionalDoc is now mandatory
        docs.push({ key: 'rentedAdditionalDoc', label: rentedDocLabel, isRequired: true });
      }

      docs.push({ key: selectedBusinessProof, label: 'Business Proof', isRequired: true });

      if (includeSignatoryDetails) {
        docs.push({ key: 'signPan', label: 'Signatory PAN Card', isRequired: true });
        docs.push({ key: 'signAadhaar', label: 'Signatory Aadhaar Card', isRequired: true });
        docs.push({ key: 'signPhoto', label: 'Signatory Photo', isRequired: true });
        docs.push({ key: 'signAuthLetter', label: 'Authorization Letter', isRequired: true });
      }

      if (includeDirectors) {
        docs.push({ key: 'directorPan', label: 'Director PAN Cards', isRequired: true });
        docs.push({ key: 'directorAadhaar', label: 'Director Aadhaar Cards', isRequired: true });
        docs.push({ key: 'directorPhoto', label: 'Director Photos', isRequired: true });
      }

      docs.push({ key: 'dsc', label: 'Digital Signature (DSC)', isRequired: false });

      return docs;
    };

    const requiredDocs = getRequiredDocuments();

    return (
      <div className="space-y-6 hidden lg:block">
        <ProgressStatus
          currentStep={currentStep}
          uploadedFiles={uploadedFiles}
          requiredDocs={requiredDocs}
        />
        <RequiredDocuments
          requiredDocs={requiredDocs}
          uploadedFiles={uploadedFiles}
        />
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
            <span className="bg-rose-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
            Support Verification
          </h3>
          <div className="space-y-3">
            <p className="text-xs text-white leading-relaxed">
              Our support team will contact you on the provided mobile number for OTP/Aadhaar verification after submission.
            </p>
            <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-700/50">
              <span className="text-slate-300 font-medium">Support</span>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono font-bold text-orange-400 text-base tracking-tight">0413-2262818</span>
                <span className="font-mono font-bold text-orange-400 text-base tracking-tight">63645 62818</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Action',
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg font-medium text-white bg-slate-900 hover:bg-slate-700 border border-slate-600 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg shadow-orange-500/25"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function ProprietorshipForm({
  user,
  commonData,
  gstServiceType = 'proprietorship',
  serviceTypeLabel,
  packageMode = false,
  onBack,
  onSubmit,
  INDIAN_STATES,
  STATE_DISTRICTS,
}: ProprietorshipFormProps) {
  const navigate = useNavigate();
  const submissionProfile = React.useMemo(
    () => getSubmissionProfile(gstServiceType, serviceTypeLabel),
    [gstServiceType, serviceTypeLabel]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [firebaseDocId, setFirebaseDocId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STEP, 2);
    return saved < 2 ? 2 : saved;
  });
  const [formData, setFormData] = useState<FormData>(() =>
    loadFromLocalStorage(STORAGE_KEYS.FORM_DATA, INITIAL_DATA)
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | string, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [propertyType, setPropertyType] = useState<'owned' | 'rented'>(() =>
    loadFromLocalStorage(STORAGE_KEYS.PROPERTY_TYPE, 'owned')
  );
  const [availableDistricts, setAvailableDistricts] = useState<{ value: string; label: string }[]>([]);
  const [includeSignatoryDetails, setIncludeSignatoryDetails] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.includeSignatoryDetails || false;
  });
  const [signatoryMobile, setSignatoryMobile] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryMobile || '';
  });
  const [signatoryEmail, setSignatoryEmail] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryEmail || '';
  });
  const [signatoryFirstName, setSignatoryFirstName] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryFirstName || '';
  });
  const [signatoryMiddleName, setSignatoryMiddleName] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryMiddleName || '';
  });
  const [signatoryLastName, setSignatoryLastName] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryLastName || '';
  });
  const [signatoryFatherFirstName, setSignatoryFatherFirstName] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryFatherFirstName || '';
  });
  const [signatoryFatherMiddleName, setSignatoryFatherMiddleName] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryFatherMiddleName || '';
  });
  const [signatoryFatherLastName, setSignatoryFatherLastName] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
    return saved.signatoryFatherLastName || '';
  });
  const [includeDirectors, setIncludeDirectors] = useState(() =>
    loadFromLocalStorage(STORAGE_KEYS.INCLUDE_DIRECTORS, false)
  );
  const [directors, setDirectors] = useState<Director[]>(() =>
    loadFromLocalStorage(STORAGE_KEYS.DIRECTORS, INITIAL_DIRECTORS)
  );
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, boolean>>(() =>
    loadFromLocalStorage(STORAGE_KEYS.UPLOADED_DOCS, INITIAL_UPLOADED_DOCS)
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    shopActLicense: null,
    udyamRegistration: null,
    tradeLicense: null,
    msmeCertificate: null,
    cancelledCheque: null,
    bankStatement: null,
    promoterPan: null,
    promoterAadhaarDoc: null,
    promoterPhoto: null,
    rentAgreement: null,
    noc: null,
    addressProof: null,
    elecBill: null,
    taxReceipt: null,
    utilityBill: null,
    rentedAdditionalDoc: null,
    signPan: null,
    signAadhaar: null,
    signPhoto: null,
    signAuthLetter: null,
    dsc: null,
  });
  const [docFileNames, setDocFileNames] = useState<Partial<Record<DocKey, string>>>(() =>
    loadFromLocalStorage(STORAGE_KEYS.DOC_FILE_NAMES, {})
  );
  const [directorFileNames, setDirectorFileNames] = useState<
    Record<string, { pan?: string; aadhaar?: string; photo?: string }>
  >(() => loadFromLocalStorage(STORAGE_KEYS.DIRECTOR_FILE_NAMES, {}));
  const [selectedBusinessProof, setSelectedBusinessProof] = useState(() =>
    loadFromLocalStorage(STORAGE_KEYS.BUSINESS_PROOF_TYPE, 'shopActLicense')
  );

  const [selectedUtilityBillType, setSelectedUtilityBillType] = useState<'electricity' | 'water' | 'propertyTax' | 'broadband' | 'landline' | 'gas'>(() =>
    loadFromLocalStorage(STORAGE_KEYS.UTILITY_BILL_TYPE, 'electricity')
  );
  const [utilityBillFileName, setUtilityBillFileName] = useState<string | null>(() =>
    loadFromLocalStorage(STORAGE_KEYS.UTILITY_BILL_FILE_NAME, null)
  );
  const [selectedRentedDocType, setSelectedRentedDocType] = useState<'noc' | 'addressProof' | 'electricity' | 'water' | 'propertyTax' | 'broadband' | 'landline' | 'gas'>(() =>
    loadFromLocalStorage(STORAGE_KEYS.RENTED_DOC_TYPE, 'noc')
  );
  const [rentedDocFileName, setRentedDocFileName] = useState<string | null>(() =>
    loadFromLocalStorage(STORAGE_KEYS.RENTED_DOC_FILE_NAME, null)
  );

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false);
  const [formId, setFormId] = useState<string>('GST-2026-01');
  const [formIdGenerated, setFormIdGenerated] = useState(false);

  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const saveDraft = async (stepOverride?: number) => {
    if (packageMode || !user?.uid) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `gst_${user.uid}`), {
        serviceType: 'GST',
        constitution: commonData.constitution || 'Proprietorship',
        commonData,
        formData,
        currentStep: stepOverride || currentStep,
        propertyType,
        selectedBusinessProof,
        uploadedDocs,
        docFileNames,
        signatory: {
          includeSignatoryDetails,
          signatoryMobile,
          signatoryEmail,
          signatoryFirstName,
          signatoryMiddleName,
          signatoryLastName,
          signatoryFatherFirstName,
          signatoryFatherMiddleName,
          signatoryFatherLastName,
        },
        directors: includeDirectors ? directors : null,
        includeDirectors,
        lastUpdated: serverTimestamp(),
        userId: user.uid,
        status: 'draft'
      }, { merge: true });
    } catch (error) {
      console.error('Failed to save GST proprietorship draft:', error);
    } finally {
      setIsDraftSaving(false);
    }
  };

  useEffect(() => {
    saveDraft();
  }, [currentStep]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.FORM_DATA, formData);
  }, [formData]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.CURRENT_STEP, currentStep);
  }, [currentStep]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.UPLOADED_DOCS, uploadedDocs);
  }, [uploadedDocs]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.DOC_FILE_NAMES, docFileNames);
  }, [docFileNames]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.PROPERTY_TYPE, propertyType);
  }, [propertyType]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.BUSINESS_PROOF_TYPE, selectedBusinessProof);
  }, [selectedBusinessProof]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.DIRECTORS, directors);
  }, [directors]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.DIRECTOR_FILE_NAMES, directorFileNames);
  }, [directorFileNames]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.INCLUDE_DIRECTORS, includeDirectors);
  }, [includeDirectors]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SIGNATORY, {
      includeSignatoryDetails,
      signatoryMobile,
      signatoryEmail,
      signatoryFirstName,
      signatoryMiddleName,
      signatoryLastName,
      signatoryFatherFirstName,
      signatoryFatherMiddleName,
      signatoryFatherLastName,
    });
  }, [
    includeSignatoryDetails,
    signatoryMobile,
    signatoryEmail,
    signatoryFirstName,
    signatoryMiddleName,
    signatoryLastName,
    signatoryFatherFirstName,
    signatoryFatherMiddleName,
    signatoryFatherLastName,
  ]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.UTILITY_BILL_TYPE, selectedUtilityBillType);
  }, [selectedUtilityBillType]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.UTILITY_BILL_FILE_NAME, utilityBillFileName);
  }, [utilityBillFileName]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.RENTED_DOC_TYPE, selectedRentedDocType);
  }, [selectedRentedDocType]);

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.RENTED_DOC_FILE_NAME, rentedDocFileName);
  }, [rentedDocFileName]);

  useEffect(() => {
    if (formData.state) {
      const districts = STATE_DISTRICTS[formData.state] || [];
      setAvailableDistricts(districts);
      if (!formData.district) setFormData((prev) => ({ ...prev, district: '' }));
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.state]);

  const validateField = (name: keyof FormData | string, value: any): string => {
    switch (name) {
      case 'promoterFirstName':
      case 'promoterLastName':
      case 'promoterFatherFirstName':
      case 'promoterFatherLastName':
        return '';
      case 'promoterMiddleName':
      case 'promoterFatherMiddleName':
        return '';
      case 'promoterDob':
        return validators.dob(value) === true ? '' : (validators.dob(value) as string);
      case 'promoterEmail':
        return validators.email(value) === true ? '' : (validators.email(value) as string);
      case 'promoterMobile':
        return validators.mobile(value) === true ? '' : (validators.mobile(value) as string);
      case 'promoterAadhaar':
        return validators.aadhaar(value) === true ? '' : (validators.aadhaar(value) as string);
      case 'addressLine1':
        return validators.required(value, 'Address Line 1') === true
          ? ''
          : (validators.required(value, 'Address Line 1') as string);
      case 'district':
        return validators.required(value, 'District') === true
          ? ''
          : (validators.required(value, 'District') as string);
      case 'state':
        return validators.required(value, 'State') === true
          ? ''
          : (validators.required(value, 'State') as string);
      case 'pincode':
        return validators.pincode(value) === true ? '' : (validators.pincode(value) as string);
      case 'natureOfBusiness':
        return validators.required(value, 'Nature of Business') === true
          ? ''
          : (validators.required(value, 'Nature of Business') as string);
      case 'consent1':
      case 'consent2':
        return (value as boolean) ? '' : 'Declaration is required';
      default:
        return '';
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    let formattedValue: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    if (['promoterMobile'].includes(key))
      formattedValue = (value as string).replace(/\D/g, '').slice(0, 10);
    if (key === 'promoterAadhaar')
      formattedValue = (value as string).replace(/\D/g, '').slice(0, 12);
    if (['pincode'].includes(key))
      formattedValue = (value as string).replace(/\D/g, '').slice(0, 6);

    setFormData((prev) => ({ ...prev, [key]: formattedValue }));
    if (touched[key])
      setErrors((prev) => ({ ...prev, [key]: validateField(key, formattedValue) }));
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, finalValue) }));
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    let isValid = true;

    if (currentStep === 2) {
      const fields: (keyof FormData)[] = [
        'promoterFirstName',
        'promoterFatherFirstName',
        'promoterDob',
        'promoterEmail',
        'promoterMobile',
        'promoterAadhaar',
      ];
      fields.forEach((key) => {
        const error = validateField(key, formData[key]);
        if (error) {
          newErrors[key] = error;
          isValid = false;
        }
      });

      if (!uploadedDocs.promoterPan) {
        newErrors['promoterPan'] = 'PAN Card upload is required';
        isValid = false;
      }
      if (!uploadedDocs.promoterAadhaarDoc) {
        newErrors['promoterAadhaarDoc'] = 'Aadhaar Card upload is required';
        isValid = false;
      }
      if (!uploadedDocs.promoterPhoto) {
        newErrors['promoterPhoto'] = 'Passport photo upload is required';
        isValid = false;
      }


    } else if (currentStep === 3) {
      const fields: (keyof FormData)[] = [
        'addressLine1',
        'district',
        'state',
        'pincode',
      ];
      fields.forEach((key) => {
        const error = validateField(key, formData[key]);
        if (error) {
          newErrors[key] = error;
          isValid = false;
        }
      });

      if (propertyType === 'owned') {
        if (!uploadedDocs.utilityBill) {

          const billType =
            selectedUtilityBillType === 'electricity' ? 'Electricity Bill' :
              selectedUtilityBillType === 'water' ? 'Water Bill' :
                selectedUtilityBillType === 'propertyTax' ? 'Property Tax Receipt' :
                  selectedUtilityBillType === 'broadband' ? 'Broadband Bill' :
                    selectedUtilityBillType === 'landline' ? 'Landline Bill' :
                      'Gas Bill';
          newErrors['utilityBill'] = `${billType} is required`;
          isValid = false;
        }
      }

      if (propertyType === 'rented') {
        if (!uploadedDocs.rentAgreement) {
          newErrors['rentAgreement'] = 'Rent Agreement is required';
          isValid = false;
        }
        if (!uploadedDocs.rentedAdditionalDoc) {
          const docLabel =
            selectedRentedDocType === 'noc' ? 'NOC from Owner' :
              selectedRentedDocType === 'addressProof' ? 'Address Proof' :
                selectedRentedDocType === 'electricity' ? 'Electricity Bill' :
                  selectedRentedDocType === 'water' ? 'Water Bill' :
                    selectedRentedDocType === 'propertyTax' ? 'Property Tax Receipt' :
                      selectedRentedDocType === 'broadband' ? 'Broadband Bill' :
                        selectedRentedDocType === 'landline' ? 'Landline Bill' :
                          'Gas Bill';
          newErrors['rentedAdditionalDoc'] = `${docLabel} is required`;
          isValid = false;
        }
      }
    } else if (currentStep === 4) {
      const error = validateField('natureOfBusiness', formData.natureOfBusiness);
      if (error) {
        newErrors['natureOfBusiness'] = error;
        isValid = false;
      }

      if (!uploadedDocs[selectedBusinessProof as DocKey]) {
        newErrors['businessProof'] = 'Business Proof document is required';
        isValid = false;
      }
    } else if (currentStep === 5 && includeSignatoryDetails) {
      if (!signatoryFirstName || !signatoryFirstName.trim()) {
        newErrors['signatoryFirstName'] = 'Signatory First Name is required';
        isValid = false;
      }
      if (!signatoryFatherFirstName || !signatoryFatherFirstName.trim()) {
        newErrors['signatoryFatherFirstName'] = "Signatory's Father's First Name is required";
        isValid = false;
      }
      if (!signatoryMobile || signatoryMobile.length !== 10) {
        newErrors['signatoryMobile'] = 'Valid 10-digit Signatory Mobile Number is required';
        isValid = false;
      }
      if (!signatoryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signatoryEmail)) {
        newErrors['signatoryEmail'] = 'Valid Signatory Email ID is required';
        isValid = false;
      }
      if (!uploadedDocs.signPan) {
        newErrors['signPan'] = 'Signatory PAN Card is required';
        isValid = false;
      }
      if (!uploadedDocs.signAadhaar) {
        newErrors['signAadhaar'] = 'Signatory Aadhaar Card is required';
        isValid = false;
      }
      if (!uploadedDocs.signPhoto) {
        newErrors['signPhoto'] = 'Signatory Photo is required';
        isValid = false;
      }
      if (!uploadedDocs.signAuthLetter) {
        newErrors['signAuthLetter'] = 'Authorization Letter is required';
        isValid = false;
      }
    } else if (currentStep === 6 && includeDirectors) {
      if (!validateDirectors()) {
        isValid = false;
      }
    } else if (currentStep === 8) {
      const fields: (keyof FormData)[] = ['consent1', 'consent2'];
      fields.forEach((key) => {
        const error = validateField(key, formData[key]);
        if (error) {
          newErrors[key] = error;
          isValid = false;
        }
      });
    }

    if (!isValid) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      setTouched((prev) => {
        const t = { ...prev };
        Object.keys(newErrors).forEach((k) => (t[k as keyof FormData] = true));
        return t;
      });
    }

    return isValid;
  };

  const validateDirectors = (): boolean => {
    if (!includeDirectors) return true;

    let hasPrimary = false;
    let isValid = true;
    const newErrors: Record<string, string> = {};

    directors.forEach((d) => {
      if (d.isPrimary) hasPrimary = true;

      if (!d.firstName || !d.firstName.trim()) {
        newErrors[`director-${d.id}-firstName`] = 'First Name is required';
        isValid = false;
      }
      if (!d.fatherName.firstName || !d.fatherName.firstName.trim()) {
        newErrors[`director-${d.id}-fatherFirstName`] = "Father's First Name is required";
        isValid = false;
      }
      if (!d.designation) {
        newErrors[`director-${d.id}-designation`] = 'Designation is required';
        isValid = false;
      }
      if (!d.mobile || !/^[6-9]\d{9}$/.test(d.mobile)) {
        newErrors[`director-${d.id}-mobile`] = 'Valid 10-digit mobile number is required';
        isValid = false;
      }
      if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
        newErrors[`director-${d.id}-email`] = 'Valid email address is required';
        isValid = false;
      }
      if (!d.panFile) {
        newErrors[`director-${d.id}-pan`] = 'PAN Card upload is required';
        isValid = false;
      }
      if (!d.aadhaarFile) {
        newErrors[`director-${d.id}-aadhaar`] = 'Aadhaar Card upload is required';
        isValid = false;
      }
      if (!d.photoFile) {
        newErrors[`director-${d.id}-photo`] = 'Passport photo upload is required';
        isValid = false;
      }
    });

    if (!hasPrimary) {
      newErrors['primary-director'] = 'Please select one Primary Director';
      isValid = false;
    }

    if (!isValid) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
    }

    return isValid;
  };

  const handleNext = async () => {
    if (validateCurrentStep()) {
      const nextStep = currentStep + 1;
      await saveDraft(nextStep);
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 2) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onBack();
    }
  };

  const handleBackToServices = () => {
    setShowBackConfirmModal(true);
  };

  const confirmBackToServices = () => {
    setShowBackConfirmModal(false);
    clearAllLocalStorage();
    onBack();
  };

  const cancelBackToServices = () => {
    setShowBackConfirmModal(false);
  };

  const uploadFileToStorage = async (file: File, docId: string, fieldName: string) => {
    if (!user?.uid) throw new Error('User not authenticated.');
    const cleanName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileExt = cleanName.split('.').pop() || 'bin';
    const baseName = cleanName.split('.').slice(0, -1).join('.');
    const fileName = `${baseName}_${Date.now()}.${fileExt}`;
    const path = `${submissionProfile.storageFolder}/${user.uid}/${docId}/${fieldName}_${fileName}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(snapshot.ref);
  };

  const handleFileUpload = (fieldName: DocKey) => (file: File | null) => {
    setUploadedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setUploadedDocs((prev) => ({ ...prev, [fieldName]: !!file }));
    setDocFileNames((prev) => ({ ...prev, [fieldName]: file ? file.name : undefined }));
    setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
  };

  const handleDirectorChange = (id: string, field: keyof Director | 'fatherName', value: any) => {
    setDirectors((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          if (field === 'fatherName') {
            return { ...d, fatherName: { ...d.fatherName, ...value } };
          }
          return { ...d, [field]: value };
        }
        return d;
      })
    );
    if (field === 'fatherName') {
      setErrors((prev) => ({
        ...prev,
        [`director-${id}-fatherFirstName`]: undefined,
        [`director-${id}-fatherMiddleName`]: undefined,
        [`director-${id}-fatherLastName`]: undefined,
      }));
    } else {
      setErrors((prev) => ({ ...prev, [`director-${id}-${field}`]: undefined }));
    }
  };

  const handlePrimaryChange = (selectedId: string) => {
    setDirectors((prev) => prev.map((d) => ({ ...d, isPrimary: d.id === selectedId })));
    setErrors((prev) => ({ ...prev, 'primary-director': undefined }));
  };

  const handleDirectorFileUpload = (id: string, field: 'panFile' | 'aadhaarFile' | 'photoFile') => (
    file: File | null
  ) => {
    setDirectors((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: !!file } : d)));
    if (file) {
      setDirectorFileNames((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field === 'panFile' ? 'pan' : field === 'aadhaarFile' ? 'aadhaar' : 'photo']: file.name,
        },
      }));
    }
    setErrors((prev) => ({
      ...prev,
      [`director-${id}-${field === 'panFile' ? 'pan' : field === 'aadhaarFile' ? 'aadhaar' : 'photo'}`]: undefined,
    }));
  };

  const handleConfirmExit = async () => {
    await saveDraft();
    setSaveToast(true);
    setTimeout(() => {
      navigate('/documents', { state: { defaultTab: 'drafts' } });
    }, 800);
  };

  const handleExitWithoutSaving = () => {
    navigate('/services/gst-registration');
  };

  const addDirector = () => {
    const newId = Date.now().toString();
    setDirectors((prev) => [
      ...prev,
      {
        id: newId,
        designation: 'Proprietor',
        isPrimary: false,
        firstName: '',
        middleName: '',
        lastName: '',
        fatherName: { firstName: '', middleName: '', lastName: '' },
        mobile: '',
        email: '',
        panFile: false,
        aadhaarFile: false,
        photoFile: false,
      },
    ]);
  };

  const removeDirector = (id: string) => {
    if (directors.length <= 1) return;
    setDirectors((prev) => prev.filter((d) => d.id !== id));
  };

  const initiateSubmission = () => {
    if (isSubmitting) return;
    if (!user?.uid) return;

    if (!validateCurrentStep()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setShowConfirmationModal(true);
  };

  const executeSubmission = async () => {
    setShowConfirmationModal(false);
    setIsSubmitting(true);

    try {
      const friendlyId = await generateSequentialId(submissionProfile.casePrefix);

      const docRef = doc(collection(db, submissionProfile.collectionName));
      const firebaseId = docRef.id;
      const uploadedFileUrls: Record<string, string> = {};

      for (const [key, isUploaded] of Object.entries(uploadedDocs)) {
        if (isUploaded && uploadedFiles[key as DocKey]) {
          const url = await uploadFileToStorage(uploadedFiles[key as DocKey]!, firebaseId, key);
          uploadedFileUrls[key] = url;
        }
      }

      // Prepare submission data
      const submissionData: any = {
        id: firebaseId,
        caseId: friendlyId,
        applicationRef: friendlyId,
        serviceId: firebaseId,
        type: 'gst',
        gstSubtype: submissionProfile.subtype,
        serviceType: submissionProfile.displayLabel,
        constitution: 'Proprietorship',
        title: submissionProfile.title,
        sourceCollection: submissionProfile.collectionName,
        status: 'submitted',
        submittedAt: serverTimestamp(),
        commonData: { ...commonData, serviceType: submissionProfile.displayLabel },
        formData: { ...formData },
        propertyType,

        // ✅ FIX: Only include these fields if they are relevant. 
        // Do NOT set them to undefined.
        ...(propertyType === 'owned' && { selectedUtilityBillType }),
        ...(propertyType === 'rented' && { selectedRentedDocType }),

        uploadedFileUrls,
        userId: user.uid,
        folderId: user.folderId || 'regibiz',
        paymentId: 'FREE_SUBMISSION',
        createdAt: Date.now(),
        selectedBusinessProof,
        includeSignatoryDetails,
        signatoryDetails: includeSignatoryDetails
          ? {
            firstName: signatoryFirstName,
            middleName: signatoryMiddleName,
            lastName: signatoryLastName,
            fatherFirstName: signatoryFatherFirstName,
            fatherMiddleName: signatoryFatherMiddleName,
            fatherLastName: signatoryFatherLastName,
            mobile: signatoryMobile,
            email: signatoryEmail,
          }
          : null, // Use null instead of undefined if the key is present but empty
        includeDirectors,
        directors: includeDirectors ? directors : [],
      };

      // Remove any keys that are still undefined just in case
      Object.keys(submissionData).forEach(key => {
        if (submissionData[key] === undefined) {
          delete submissionData[key];
        }
      });

      await setDoc(doc(db, submissionProfile.collectionName, firebaseId), submissionData);
      if (!packageMode) {
        await Promise.allSettled([
          deleteDoc(doc(db, 'drafts', `gst_${user.uid}`)),
          deleteDoc(doc(db, 'drafts', `gst_prop_${user.uid}`)),
        ]);
      }
      setFirebaseDocId(friendlyId);
      // After successful Firestore save, send confirmation email
      await sendConfirmationEmail({
        name: getFullName(formData.promoterFirstName, formData.promoterMiddleName, formData.promoterLastName) || commonData.businessName,
        email: user.email,
        service: submissionProfile.emailService,
        caseId: friendlyId,
      });
      if (onSubmit) {
        const filesToSubmit: Record<string, File> = {};
        Object.entries(uploadedFiles).forEach(([k, v]) => {
          if (v) filesToSubmit[k] = v;
        });
        await onSubmit(submissionData, filesToSubmit);
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      clearAllLocalStorage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submission failed:', err);
      setIsSubmitting(false);
      alert(`Error: ${err.message || 'Failed to submit application.'}`);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <CelebrationPopup trigger={isSuccess} message="" />
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg relative z-10">
          {/* Main Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">

            {/* Top Highlight Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

            {/* Animated Checkmark Circle */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500 rounded-full blur-lg opacity-40 animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)] transform transition-transform hover:scale-105 duration-300">
                  <svg className="w-10 h-10 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Title & Message */}
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              GST Application Submitted!
            </h2>
            <p className="text-white mb-6 text-sm leading-relaxed max-w-xs mx-auto">
              Your {submissionProfile.displayLabel} application has been received. Our team will contact you for OTP/Aadhaar verification and processing.
            </p>

            {/* Case ID Section */}
            <div className="mb-8">
              <p className="text-white text-xs uppercase tracking-wide font-medium mb-1">Your Case ID</p>
              <div className="inline-block bg-slate-900/40 px-4 py-2 rounded-lg border border-slate-700/50">
                <p className="text-orange-400 font-mono font-bold text-lg tracking-wider">{firebaseDocId}</p>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-900/40 rounded-xl p-4 mb-8 text-left border border-slate-700/50 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                <span className="text-white text-sm">Name</span>
                <span className="text-white font-medium text-sm capitalize">
                  {formData.promoterFirstName} {formData.promoterLastName}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                <span className="text-white text-sm">Type</span>
                <span className="text-white font-medium text-sm">{submissionProfile.displayLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white text-sm">Mobile</span>
                <span className="text-white font-mono text-sm">+91 {formData.promoterMobile}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/documents')}
                className="w-full group relative px-6 py-3.5 rounded-lg font-semibold text-white shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-blue-700 group-hover:from-teal-500 group-hover:to-blue-600 transition-all"></div>
                <span className="relative flex items-center justify-center gap-2">
                  View Submitted Application
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </span>
              </button>

              <button
                onClick={() => { clearAllLocalStorage(); navigate('/services'); }}
                className="w-full px-6 py-3.5 rounded-lg font-semibold text-slate-300 bg-slate-900/40 hover:bg-slate-800 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
              >
                Back to Services
              </button>
            </div>
          </div>

          {/* Footer Copyright */}
          <p className="text-center text-slate-200 text-xs mt-6">© 2026 RegiBIZ Compliance Solutions</p>
        </div>
      </div>
    );
  }

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">
        {submissionProfile.subtype === 'shops' ? 'Owner Details' : 'Proprietor Details'}
      </h3>
      <div className="mb-6">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Proprietor Name</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="First Name"
            name="promoterFirstName"
            value={formData.promoterFirstName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.promoterFirstName}
            placeholder="e.g., Rajesh"
            required
          />
          <FormInput
            label="Middle Name"
            name="promoterMiddleName"
            value={formData.promoterMiddleName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Optional"
            optional
          />
          <FormInput
            label="Last Name"
            name="promoterLastName"
            value={formData.promoterLastName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.promoterLastName}
            placeholder="e.g., Kumar"
            optional
          />
        </div>
      </div>

      <div className="mb-6 pt-4 border-t border-slate-700/50">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Father's Name</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="First Name"
            name="promoterFatherFirstName"
            value={formData.promoterFatherFirstName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.promoterFatherFirstName}
            placeholder="e.g., Suresh"
            required
          />
          <FormInput
            label="Middle Name"
            name="promoterFatherMiddleName"
            value={formData.promoterFatherMiddleName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Optional"
            optional
          />
          <FormInput
            label="Last Name"
            name="promoterFatherLastName"
            value={formData.promoterFatherLastName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.promoterFatherLastName}
            placeholder="e.g., Sharma"
            optional
          />
        </div>
      </div>

      <div className="mb-6 bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white mb-1">Date of Birth</label>
            <input
              type="date"
              name="promoterDob"
              value={formData.promoterDob}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors.promoterDob ? 'border-red-500' : 'border-slate-600'
                }`}
              style={{ colorScheme: 'dark' }}
            />
            {errors.promoterDob && <p className="text-xs text-red-400 mt-1">{errors.promoterDob}</p>}
          </div>
          <div>
            <label className="block text-xs text-white mb-1">Email Address</label>
            <input
              type="email"
              name="promoterEmail"
              value={formData.promoterEmail}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="you@example.com"
              className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors.promoterEmail ? 'border-red-500' : 'border-slate-600'
                }`}
            />
            {errors.promoterEmail && <p className="text-xs text-red-400 mt-1">{errors.promoterEmail}</p>}
          </div>
          <div>
            <label className="block text-xs text-white mb-1">Mobile (Aadhaar Linked)</label>
            <div className="flex">
              <div className="flex items-center justify-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-white text-xs font-medium min-w-[50px]">
                +91
              </div>
              <input
                type="tel"
                name="promoterMobile"
                value={formData.promoterMobile}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="mobile number"
                maxLength={10}
                className={`w-full bg-slate-800 border text-white text-sm rounded-r-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors.promoterMobile ? 'border-red-500' : 'border-slate-600'
                  }`}
              />
            </div>
            {errors.promoterMobile && <p className="text-xs text-red-400 mt-1">{errors.promoterMobile}</p>}
          </div>
          <div>
            <label className="block text-xs text-white mb-1">Aadhaar Number</label>
            <input
              type="text"
              name="promoterAadhaar"
              value={formData.promoterAadhaar}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="123456789012"
              maxLength={12}
              className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors.promoterAadhaar ? 'border-red-500' : 'border-slate-600'
                }`}
            />
            {errors.promoterAadhaar && <p className="text-xs text-red-400 mt-1">{errors.promoterAadhaar}</p>}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h4 className="text-lg font-bold text-white mb-4">Proprietor Identity Documents</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FileUploader
            label="PAN Card"
            name="promoterPan"
            onChange={handleFileUpload('promoterPan')}
            required
            value={uploadedDocs.promoterPan}
            fileName={docFileNames.promoterPan}
            error={errors.promoterPan}
            hint="Clear scan of PAN card"
          />
          <FileUploader
            label="Aadhaar Card"
            name="promoterAadhaarDoc"
            onChange={handleFileUpload('promoterAadhaarDoc')}
            required
            value={uploadedDocs.promoterAadhaarDoc}
            fileName={docFileNames.promoterAadhaarDoc}
            error={errors.promoterAadhaarDoc}
            hint="Both sides scanned"
          />
          <FileUploader
            label="Passport size Photo"
            name="promoterPhoto"
            accept=".jpg,.jpeg"
            onChange={handleFileUpload('promoterPhoto')}
            required
            value={uploadedDocs.promoterPhoto}
            fileName={docFileNames.promoterPhoto}
            error={errors.promoterPhoto}
            hint="White background"
          />
        </div>
      </div>
    </div>
  );

  // ✅ COMPLETELY UPDATED renderStep3 with dropdown system + MANDATORY additional doc
  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">Business Address</h3>
      <div className="grid grid-cols-1 gap-4">
        <FormInput
          label="Address Line 1"
          name="addressLine1"
          value={formData.addressLine1}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.addressLine1}
          placeholder="Building No, Street Name"
          required
        />
        <FormInput
          label="Address Line 2"
          name="addressLine2"
          value={formData.addressLine2}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Optional"
          optional
        />
        <SelectInput
          label="State"
          name="state"
          value={formData.state}
          onChange={handleChange}
          onBlur={handleBlur}
          options={INDIAN_STATES}
          required
          error={errors.state}
        />
        <SelectInput
          label="District"
          name="district"
          value={formData.district}
          onChange={handleChange}
          onBlur={handleBlur}
          options={availableDistricts}
          required
          error={errors.district}
        />
        <FormInput
          label="Pincode"
          name="pincode"
          value={formData.pincode}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.pincode}
          placeholder="400053"
          maxLength={6}
          required
          hint="6-digit pincode"
        />
      </div>

      <div className="mt-6">
        <h4 className="text-lg font-bold text-white mb-4">Property Type</h4>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="propertyType"
              value="owned"
              checked={propertyType === 'owned'}
              onChange={() => setPropertyType('owned')}
              className="w-4 h-4 text-orange-500"
            />
            <span className="text-slate-300">Owned</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="propertyType"
              value="rented"
              checked={propertyType === 'rented'}
              onChange={() => setPropertyType('rented')}
              className="w-4 h-4 text-orange-500"
            />
            <span className="text-slate-300">Rented/Leased</span>
          </label>
        </div>
      </div>

      <div className="mt-8">
        <h4 className="text-lg font-bold text-white mb-4">Address Proof Documents</h4>

        {propertyType === 'owned' ? (
          // ✅ OWNED PROPERTY: Single dropdown with utility bill options
          <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">
                Select Utility Bill Type<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                value={selectedUtilityBillType}
                onChange={(e) => {
                  setSelectedUtilityBillType(e.target.value as any);
                  setUploadedFiles(prev => ({ ...prev, utilityBill: null }));
                  setUploadedDocs(prev => ({ ...prev, utilityBill: false }));
                  setUtilityBillFileName(null);
                  setErrors(prev => ({ ...prev, utilityBill: undefined }));
                }}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg block p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="electricity">Electricity Bill</option>
                <option value="water"> Water Bill</option>
                <option value="propertyTax"> Property Tax Receipt</option>
                <option value="broadband"> Broadband Bill</option>
                <option value="landline"> Landline Bill</option>
                <option value="gas"> Gas Bill</option>
              </select>
            </div>

            <FileUploader
              label={
                selectedUtilityBillType === 'electricity' ? 'Electricity Bill' :
                  selectedUtilityBillType === 'water' ? 'Water Bill' :
                    selectedUtilityBillType === 'propertyTax' ? 'Property Tax Receipt' :
                      selectedUtilityBillType === 'broadband' ? 'Broadband Bill' :
                        selectedUtilityBillType === 'landline' ? 'Landline Bill' :
                          'Gas Bill'
              }
              name="utilityBill"
              onChange={(file) => {
                handleFileUpload('utilityBill')(file);
                setUtilityBillFileName(file ? file.name : null);
              }}
              required
              value={uploadedDocs.utilityBill}
              fileName={utilityBillFileName || docFileNames.utilityBill}
              error={errors.utilityBill}
              hint={`Upload your ${selectedUtilityBillType === 'propertyTax' ? 'Property Tax Receipt' : selectedUtilityBillType + ' Bill'}`}
            />
          </div>
        ) : (
          // ✅ RENTED PROPERTY: Rent Agreement (mandatory) + Dropdown for additional doc (NOW MANDATORY)
          <div className="space-y-4">
            <FileUploader
              label="Rent Agreement"
              name="rentAgreement"
              onChange={handleFileUpload('rentAgreement')}
              required
              value={uploadedDocs.rentAgreement}
              fileName={docFileNames.rentAgreement}
              error={errors.rentAgreement}
              hint="Valid rental agreement"
            />

            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <div className="mb-4">
                {/* ✅ CHANGED: Label now shows * instead of (Optional) */}
                <label className="block text-sm font-medium text-white mb-2">
                  Select Utility Bill Type
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={selectedRentedDocType}
                  onChange={(e) => {
                    setSelectedRentedDocType(e.target.value as any);
                    setUploadedFiles(prev => ({ ...prev, rentedAdditionalDoc: null }));
                    setUploadedDocs(prev => ({ ...prev, rentedAdditionalDoc: false }));
                    setRentedDocFileName(null);
                    setErrors(prev => ({ ...prev, rentedAdditionalDoc: undefined }));
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg block p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="noc">NOC from Owner</option>
                  <option value="addressProof"> Address Proof</option>
                  <option value="electricity"> Electricity Bill</option>
                  <option value="water"> Water Bill</option>
                  <option value="propertyTax"> Property Tax Receipt</option>
                  <option value="broadband"> Broadband Bill</option>
                  <option value="landline"> Landline Bill</option>
                  <option value="gas"> Gas Bill</option>
                </select>
              </div>

              {/* ✅ CHANGED: removed optional prop, added required */}
              <FileUploader
                label={
                  selectedRentedDocType === 'noc' ? 'NOC from Owner' :
                    selectedRentedDocType === 'addressProof' ? 'Address Proof' :
                      selectedRentedDocType === 'electricity' ? 'Electricity Bill' :
                        selectedRentedDocType === 'water' ? 'Water Bill' :
                          selectedRentedDocType === 'propertyTax' ? 'Property Tax Receipt' :
                            selectedRentedDocType === 'broadband' ? 'Broadband Bill' :
                              selectedRentedDocType === 'landline' ? 'Landline Bill' :
                                'Gas Bill'
                }
                name="rentedAdditionalDoc"
                onChange={(file) => {
                  handleFileUpload('rentedAdditionalDoc')(file);
                  setRentedDocFileName(file ? file.name : null);
                }}
                required
                value={uploadedDocs.rentedAdditionalDoc}
                fileName={rentedDocFileName || docFileNames.rentedAdditionalDoc}
                error={errors.rentedAdditionalDoc}
                hint={`Upload ${selectedRentedDocType === 'noc' ? 'No Objection Certificate' :
                  selectedRentedDocType === 'addressProof' ? 'Any valid address proof' :
                    selectedRentedDocType + ' bill'
                  }`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">Business Details</h3>
      <SelectInput
        label="Nature of Business"
        name="natureOfBusiness"
        value={formData.natureOfBusiness}
        onChange={handleChange}
        onBlur={handleBlur}
        options={NATURE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
        required
        error={errors.natureOfBusiness}
      />

      <div className="mt-8">
        <h4 className="text-lg font-bold text-white mb-4">Business Proof</h4>
        <SelectInput
          label="Select Business Proof Type"
          name="selectedBusinessProof"
          value={selectedBusinessProof}
          onChange={(e) => setSelectedBusinessProof(e.target.value)}
          options={BUSINESS_PROOF_OPTIONS}
          required
        />
        <div className="mt-4">
          <FileUploader
            label={
              BUSINESS_PROOF_OPTIONS.find((opt) => opt.value === selectedBusinessProof)?.label || 'Business Proof'
            }
            name={selectedBusinessProof}
            onChange={handleFileUpload(selectedBusinessProof as DocKey)}
            required
            value={uploadedDocs[selectedBusinessProof as DocKey]}
            fileName={docFileNames[selectedBusinessProof as DocKey]}
            error={errors.businessProof}
            hint="Upload selected business proof document"
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Authorized Signatory</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSignatoryDetails}
            onChange={(e) => setIncludeSignatoryDetails(e.target.checked)}
            className="w-4 h-4 text-orange-500 rounded"
          />
          <span className="text-slate-300 text-sm">Include Signatory Details</span>
        </label>
      </div>

      {includeSignatoryDetails && (
        <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/50">
          <div className="mb-6">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Signatory Name</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormInput
                label="First Name"
                value={signatoryFirstName}
                onChange={(e) => {
                  setSignatoryFirstName(e.target.value);
                  setErrors((prev) => ({ ...prev, signatoryFirstName: '' }));
                }}
                error={errors.signatoryFirstName}
                placeholder="e.g., Rajesh"
                required
              />
              <FormInput
                label="Middle Name"
                value={signatoryMiddleName}
                onChange={(e) => setSignatoryMiddleName(e.target.value)}
                placeholder="Optional"
                optional
              />
              <FormInput
                label="Last Name"
                value={signatoryLastName}
                onChange={(e) => {
                  setSignatoryLastName(e.target.value);
                  setErrors((prev) => ({ ...prev, signatoryLastName: '' }));
                }}
                error={errors.signatoryLastName}
                placeholder="e.g., Kumar"
                optional
              />
            </div>
          </div>

          <div className="mb-6 pt-4 border-t border-slate-700/50">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Father's Name</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormInput
                label="First Name"
                value={signatoryFatherFirstName}
                onChange={(e) => {
                  setSignatoryFatherFirstName(e.target.value);
                  setErrors((prev) => ({ ...prev, signatoryFatherFirstName: '' }));
                }}
                error={errors.signatoryFatherFirstName}
                placeholder="e.g., Suresh"
                required
              />
              <FormInput
                label="Middle Name"
                value={signatoryFatherMiddleName}
                onChange={(e) => setSignatoryFatherMiddleName(e.target.value)}
                placeholder="Optional"
                optional
              />
              <FormInput
                label="Last Name"
                value={signatoryFatherLastName}
                onChange={(e) => {
                  setSignatoryFatherLastName(e.target.value);
                  setErrors((prev) => ({ ...prev, signatoryFatherLastName: '' }));
                }}
                error={errors.signatoryFatherLastName}
                placeholder="e.g., Sharma"
                required
              />
            </div>
          </div>

          <div className="mb-6 bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white mb-1">Mobile (Aadhaar Linked)</label>
                <div className="flex">
                  <div className="flex items-center justify-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-white text-xs font-medium min-w-[50px]">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={signatoryMobile}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setSignatoryMobile(value);
                      setErrors((prev) => ({ ...prev, signatoryMobile: '' }));
                    }}
                    placeholder="mobile number"
                    className={`w-full bg-slate-800 border text-white text-sm rounded-r-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors.signatoryMobile ? 'border-red-500' : 'border-slate-600'
                      }`}
                    maxLength={10}
                  />
                </div>
                {errors.signatoryMobile && <p className="text-xs text-red-400 mt-1">{errors.signatoryMobile}</p>}
              </div>
              <div>
                <label className="block text-xs text-white mb-1">Email ID</label>
                <input
                  type="email"
                  value={signatoryEmail}
                  onChange={(e) => {
                    setSignatoryEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, signatoryEmail: '' }));
                  }}
                  placeholder="email@example.com"
                  className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors.signatoryEmail ? 'border-red-500' : 'border-slate-600'
                    }`}
                />
                {errors.signatoryEmail && <p className="text-xs text-red-400 mt-1">{errors.signatoryEmail}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FileUploader
              label="PAN Card"
              name="signPan"
              onChange={handleFileUpload('signPan')}
              required
              value={uploadedDocs.signPan}
              fileName={docFileNames.signPan}
              error={errors.signPan}
              hint="Clear scan of PAN"
            />
            <FileUploader
              label="Aadhaar Card"
              name="signAadhaar"
              onChange={handleFileUpload('signAadhaar')}
              required
              value={uploadedDocs.signAadhaar}
              fileName={docFileNames.signAadhaar}
              error={errors.signAadhaar}
              hint="Both sides scanned"
            />
            <FileUploader
              label="Passport size Photo"
              name="signPhoto"
              accept=".jpg,.jpeg"
              onChange={handleFileUpload('signPhoto')}
              required
              value={uploadedDocs.signPhoto}
              fileName={docFileNames.signPhoto}
              error={errors.signPhoto}
              hint="White background"
            />
            <FileUploader
              label="Authorization Letter"
              name="signAuthLetter"
              onChange={handleFileUpload('signAuthLetter')}
              required
              value={uploadedDocs.signAuthLetter}
              fileName={docFileNames.signAuthLetter}
              error={errors.signAuthLetter}
              hint="Signed authorization letter"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Director Details</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDirectors}
            onChange={(e) => setIncludeDirectors(e.target.checked)}
            className="w-4 h-4 text-orange-500 rounded"
          />
          <span className="text-slate-300 text-sm">Include Directors (Optional)</span>
        </label>
      </div>

      {includeDirectors && (
        <>
          {directors.map((director, index) => (
            <div key={director.id} className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-white">Director {index + 1}</h4>
                {directors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDirector(director.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mb-6 flex items-center justify-between bg-slate-900/50 p-4 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="primaryDirector"
                    checked={director.isPrimary}
                    onChange={() => handlePrimaryChange(director.id)}
                    className="w-5 h-5 text-orange-500"
                  />
                  <span className="text-orange-400 font-medium">Mark as Primary Director</span>
                </label>
                {director.isPrimary && (
                  <span className="text-xs bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full">Selected</span>
                )}
              </div>
              {errors['primary-director'] && <p className="text-red-400 text-sm mb-4">{errors['primary-director']}</p>}

              <div className="mb-6">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Director Name</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormInput
                    label="First Name"
                    value={director.firstName || ''}
                    onChange={(e) => {
                      handleDirectorChange(director.id, 'firstName', e.target.value);
                    }}
                    error={errors[`director-${director.id}-firstName`]}
                    placeholder="e.g. Rajesh"
                    required
                  />
                  <FormInput
                    label="Middle Name"
                    value={director.middleName || ''}
                    onChange={(e) => handleDirectorChange(director.id, 'middleName', e.target.value)}
                    placeholder="Optional"
                    optional
                  />
                  <FormInput
                    label="Last Name"
                    value={director.lastName || ''}
                    onChange={(e) => {
                      handleDirectorChange(director.id, 'lastName', e.target.value);
                    }}
                    error={errors[`director-${director.id}-lastName`]}
                    placeholder="e.g. Sharma"
                    optional
                  />
                </div>
              </div>

              <div className="mb-6 pt-4 border-t border-slate-700/50">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Father's Name</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormInput
                    label="First Name"
                    value={director.fatherName?.firstName || ''}
                    onChange={(e) => {
                      handleDirectorChange(director.id, 'fatherName', {
                        firstName: e.target.value,
                      });
                    }}
                    error={errors[`director-${director.id}-fatherFirstName`]}
                    placeholder="e.g. Suresh"
                    required
                  />
                  <FormInput
                    label="Middle Name"
                    value={director.fatherName?.middleName || ''}
                    onChange={(e) => {
                      handleDirectorChange(director.id, 'fatherName', {
                        middleName: e.target.value,
                      });
                    }}
                    placeholder="Optional"
                    optional
                  />
                  <FormInput
                    label="Last Name"
                    value={director.fatherName?.lastName || ''}
                    onChange={(e) => {
                      handleDirectorChange(director.id, 'fatherName', {
                        lastName: e.target.value,
                      });
                    }}
                    error={errors[`director-${director.id}-fatherLastName`]}
                    placeholder="e.g. Sharma"
                    optional
                  />
                </div>
              </div>

              <div className="mb-6 bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white mb-1">Mobile (Aadhaar Linked)</label>
                    <div className="flex">
                      <div className="flex items-center justify-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-white text-xs font-medium min-w-[50px]">
                        +91
                      </div>
                      <input
                        type="tel"
                        value={director.mobile}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          handleDirectorChange(director.id, 'mobile', value);
                        }}
                        placeholder="mobile number"
                        className={`w-full bg-slate-800 border text-white text-sm rounded-r-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors[`director-${director.id}-mobile`] ? 'border-red-500' : 'border-slate-600'
                          }`}
                        maxLength={10}
                      />
                    </div>
                    {errors[`director-${director.id}-mobile`] && (
                      <p className="text-xs text-red-400 mt-1">{errors[`director-${director.id}-mobile`]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-white mb-1">Email ID</label>
                    <input
                      type="email"
                      value={director.email}
                      onChange={(e) => {
                        handleDirectorChange(director.id, 'email', e.target.value);
                      }}
                      placeholder="email@example.com"
                      className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 ${errors[`director-${director.id}-email`] ? 'border-red-500' : 'border-slate-600'
                        }`}
                    />
                    {errors[`director-${director.id}-email`] && (
                      <p className="text-xs text-red-400 mt-1">{errors[`director-${director.id}-email`]}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FileUploader
                  label="PAN Card"
                  name={`director-${director.id}-pan`}
                  onChange={handleDirectorFileUpload(director.id, 'panFile')}
                  required
                  value={director.panFile}
                  fileName={directorFileNames[director.id]?.pan}
                  error={errors[`director-${director.id}-pan`]}
                  hint="Clear scan of PAN"
                />
                <FileUploader
                  label="Aadhaar Card"
                  name={`director-${director.id}-aadhaar`}
                  onChange={handleDirectorFileUpload(director.id, 'aadhaarFile')}
                  required
                  value={director.aadhaarFile}
                  fileName={directorFileNames[director.id]?.aadhaar}
                  error={errors[`director-${director.id}-aadhaar`]}
                  hint="Both sides scanned"
                />
                <FileUploader
                  label="Passport size Photo"
                  name={`director-${director.id}-photo`}
                  accept=".jpg,.jpeg"
                  onChange={handleDirectorFileUpload(director.id, 'photoFile')}
                  required
                  value={director.photoFile}
                  fileName={directorFileNames[director.id]?.photo}
                  error={errors[`director-${director.id}-photo`]}
                  hint="White background"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addDirector}
            className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-white hover:text-white hover:border-orange-500 transition-colors"
          >
            + Add Another Director
          </button>
        </>
      )}
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">Digital Signature (DSC)</h3>
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <p className="text-white text-sm mb-4">
          Upload your Digital Signature Certificate if you have one. This is optional but recommended for faster
          processing.
        </p>
        <FileUploader
          label="DSC File (.pfx/.p12)"
          name="dsc"
          accept=".pfx,.p12"
          onChange={handleFileUpload('dsc')}
          value={uploadedDocs.dsc}
          fileName={docFileNames.dsc}
          hint="PFX or P12 format only"
          optional
        />
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4">Declaration & Consent</h3>
      <div className="space-y-4">
        <label className="flex items-start gap-3 p-4 bg-slate-900/40 rounded-xl border border-slate-700 cursor-pointer">
          <input
            type="checkbox"
            name="consent1"
            checked={formData.consent1}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-5 h-5 text-orange-500 rounded mt-0.5"
          />
          <span className="text-slate-300 text-sm">
            I authorize RegiBIZ to file my GST registration application on my behalf.
          </span>
        </label>
        {errors.consent1 && <p className="text-red-400 text-sm ml-8">{errors.consent1}</p>}

        <label className="flex items-start gap-3 p-4 bg-slate-900/40 rounded-xl border border-slate-700 cursor-pointer">
          <input
            type="checkbox"
            name="consent2"
            checked={formData.consent2}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-5 h-5 text-orange-500 rounded mt-0.5"
          />
          <span className="text-slate-300 text-sm">
            I hereby declare that the details furnished above are true and
            correct to the best of my knowledge and belief and I undertake to
            inform you of any changes therein, immediately. In case any of
            the above information is found to be false or untrue or
            misleading or misrepresenting, I am aware that I may be held
            liable for it.
          </span>
        </label>
        {errors.consent2 && <p className="text-red-400 text-sm ml-8">{errors.consent2}</p>}
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={handlePrevious}
          className="px-6 py-3 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-800 hover:text-white transition-all"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={initiateSubmission}
          disabled={isSubmitting}
          className={`px-8 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center ${isSubmitting
            ? 'bg-slate-600 text-white cursor-not-allowed'
            : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700'
            }`}
        >
          {isSubmitting ? 'Processing...' : 'SUBMIT APPLICATION'}
        </button>
      </div>
    </div>
  );

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
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="relative mb-6">
              <div className="w-16 h-16 mx-auto">
                <svg
                  className="animate-spin w-full h-full text-orange-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
            <p className="text-white text-sm mb-1">Please wait while we submit your application.</p>
            <p className="text-white text-xs">Do not close this window.</p>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirmationModal}
        onConfirm={executeSubmission}
        onCancel={() => setShowConfirmationModal(false)}
        title="Confirm Action"
        message="During registration you will receive an OTP. Our support team will contact you once received. Please provide the correct OTP."
      />

      <ConfirmationModal
        isOpen={showBackConfirmModal}
        onConfirm={confirmBackToServices}
        onCancel={cancelBackToServices}
        title="Confirm Action"
        message="Are you sure you want to go back? All entered data will be lost."
      />

      <div className="max-w-[1600px] mx-auto">
        <div className="lg:hidden mb-6 text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
            GST Registration - {submissionProfile.shortLabel}
          </h1>
          <div className="flex items-center gap-2 mb-2">
            {[2, 3, 4, 5, 6, 7, 8].map((step) => (
              <div key={step} className="flex-1 h-1 rounded-full overflow-hidden bg-slate-800">
                <div 
                  className={`h-full transition-all duration-500 ${step <= currentStep ? 'bg-gradient-to-r from-orange-500 to-red-500' : ''}`}
                  style={{ width: step === currentStep ? '100%' : step < currentStep ? '100%' : '0%' }}
                />
              </div>
            ))}
          </div>
          <p className="text-sky-200/80 text-[10px] uppercase font-bold tracking-widest">Step {currentStep - 1} of 7</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col">
            <div className="absolute top-5 left-5 z-20 flex items-center gap-4">
              <FormBackButton onBack={handlePrevious} />
              <button 
                onClick={() => setShowExitConfirm(true)}
                className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all shadow-lg"
              >
                Exit Session
              </button>
            </div>
            <FreeCornerRibbon />


            <div className="p-6 md:p-10 flex-grow pt-14">
              <div className="mb-8 hidden lg:block text-center">
                <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">GST Registration</h1>
                <p className="text-slate-300 text-base max-w-lg leading-relaxed mt-1 mx-auto">
                  {currentStep === 2 && 'Provide proprietor details and upload identity documents.'}
                  {currentStep === 3 && 'Enter business address and upload address proof documents.'}
                  {currentStep === 4 && 'Select nature of business and upload business & bank documents.'}
                  {currentStep === 5 && 'Provide authorized signatory information.'}
                  {currentStep === 6 && 'Provide director information (optional).'}
                  {currentStep === 7 && 'Upload your Digital Signature Certificate (Optional).'}
                  {currentStep === 8 && 'Review and provide consent for submission.'}
                </p>
              </div>

              <StatusBanner />

              <form noValidate>
                <div className="grid grid-cols-1 gap-y-10">
                  {currentStep === 2 && renderStep2()}
                  {currentStep === 3 && renderStep3()}
                  {currentStep === 4 && renderStep4()}
                  {currentStep === 5 && renderStep5()}
                  {currentStep === 6 && renderStep6()}
                  {currentStep === 7 && renderStep7()}
                  {currentStep === 8 && renderStep8()}
                </div>

                {currentStep !== 8 && (
                  <div className="mt-12 pt-6 border-t border-slate-700/50">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => setShowExitConfirm(true)}
                        disabled={isDraftSaving}
                        className="px-6 py-4 rounded-xl font-bold text-sm tracking-wide border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all flex items-center justify-center disabled:opacity-50"
                      >
                        {isDraftSaving ? 'Saving...' : 'Exit Session'}
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={isDraftSaving}
                        className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 hover:-translate-y-1 flex items-center justify-center shadow-orange-500/25 disabled:opacity-50"
                      >
                        {isDraftSaving ? 'Saving...' : 'Save & Next'}
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </main>

          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8">
            <InfoSidebar
              formData={formData}
              uploadedFiles={Object.fromEntries(
                Object.entries(uploadedDocs).map(([k, v]) => [k, v])
              ) as Record<string, boolean>}
              currentStep={currentStep}
              propertyType={propertyType}
              selectedBusinessProof={selectedBusinessProof}
              includeSignatoryDetails={includeSignatoryDetails}
              includeDirectors={includeDirectors}
              selectedUtilityBillType={selectedUtilityBillType}
              selectedRentedDocType={selectedRentedDocType}
            />
          </aside>
        </div>

        <div className="mt-12 text-center text-white text-sm pb-8">&copy; 2026 RegiBIZ. All rights reserved.</div>
      </div>
    </div>
  );
} 
