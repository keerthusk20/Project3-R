// src/services/gst/gst-private-limited-form.tsx
import React, { useState, useEffect, useRef, ChangeEvent, FocusEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, runTransaction, getDoc, deleteDoc } from 'firebase/firestore';
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

interface Director {
  id: string;
  designation: string;
  isPrimary: boolean;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fatherName?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  mobile: string;
  email: string;
  panFile: boolean;
  aadhaarFile: boolean;
  photoFile: boolean;
}

interface FormData {
  promoterName: string;
  promoterDob: string;
  promoterEmail: string;
  promoterMobile: string;
  promoterAadhaar: string;
  flatNumber: string;
  roadStreet: string;
  areaLocality: string;
  district: string;
  state: string;
  pincode: string;
  natureOfBusiness: string;
  consent1: boolean;
  consent2: boolean;
}

type DocKey =
  | 'companyPan'
  | 'companyCoi'
  | 'companyMoa'
  | 'companyAoa'
  | 'signPan'
  | 'signAadhaar'
  | 'signPhoto'
  | 'signAuthLetter'
  | 'rentAgreement'
  | 'noc'
  | 'addressProof'
  | 'elecBill'
  | 'taxReceipt'
  | 'utilityBill'
  | 'dsc'
  | 'geoTaggedPhoto';

type UploadedFilesState = Record<DocKey, File | null>;

interface PrivateLimitedFormProps {
  user: any;
  commonData: CommonFormData;
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

interface CustomConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ============================================================================
// CONSTANTS & DATA
// ============================================================================
const INITIAL_DATA: FormData = {
  promoterName: '',
  promoterDob: '',
  promoterEmail: '',
  promoterMobile: '',
  promoterAadhaar: '',
  flatNumber: '',
  roadStreet: '',
  areaLocality: '',
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
    designation: 'Director',
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
  {
    id: '2',
    designation: 'Director',
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
];

const INITIAL_UPLOADED_DOCS: Record<DocKey, boolean> = {
  companyPan: false,
  companyCoi: false,
  companyMoa: false,
  companyAoa: false,
  signPan: false,
  signAadhaar: false,
  signPhoto: false,
  signAuthLetter: false,
  rentAgreement: false,
  noc: false,
  addressProof: false,
  elecBill: false,
  taxReceipt: false,
  utilityBill: false,
  dsc: false,
  geoTaggedPhoto: false,
};

const DESIGNATION_OPTIONS = [
  { value: 'Director', label: 'Director' },
  { value: 'Promoter', label: 'Promoter' },
];

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

// ============================================================================
// LOCALSTORAGE HELPER FUNCTIONS
// ============================================================================
const STORAGE_KEYS = {
  FORM_DATA: 'gstPvtLtdFormData',
  CURRENT_STEP: 'gstPvtLtdCurrentStep',
  DOC_SUB_STEP: 'gstPvtLtdDocSubStep',
  DIRECTORS: 'gstPvtLtdDirectors',
  UPLOADED_DOCS: 'gstPvtLtdUploadedDocs',
  DOC_FILE_NAMES: 'gstPvtLtdDocFileNames',
  DIRECTOR_FILE_NAMES: 'gstPvtLtdDirectorFileNames',
  PROPERTY_TYPE: 'gstPvtLtdPropertyType',
  SIGNATORY: 'gstPvtLtdSignatory',
  CASE_ID: 'gstPvtLtdCaseId',
  GEO_COORDS: 'gstPvtLtdGeoCoords',
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

const generateSequentialFormId = async (
  prefix: string = 'GST-PVT',
  year: number
): Promise<string> => {
  try {
    const counterRef = doc(
      db,
      'counters',
      `${prefix.toLowerCase().replace(/\s+/g, '_')}_${year}`
    );

    let newCount = 0;

    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      if (!counterDoc.exists()) {
        // First ID for this year - start at 1
        transaction.set(counterRef, {
          count: 1,
          year,
          prefix,
          createdAt: serverTimestamp(),
        });
        newCount = 1;
      } else {
        // Increment existing counter
        const currentCount = counterDoc.data()?.count || 0;
        newCount = currentCount + 1;
        transaction.update(counterRef, { count: newCount });
      }
    });

    // ✅ CHANGE THIS LINE: padStart(2, '0') creates 01, 02, ... 99
    const formattedCount = String(newCount).padStart(2, '0');

    return `${prefix}-${year}-${formattedCount}`;
  } catch (err) {
    console.error('Failed to generate sequential ID:', err);
    throw new Error('Could not generate Case ID. Please try again.');
  }
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
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
    if (
      dob.getFullYear() !== y ||
      dob.getMonth() !== m - 1 ||
      dob.getDate() !== d
    )
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
    /^[6-9]\d{9}$/.test(value) ||
    'Invalid 10-digit mobile number (must start with 6-9)',
  pan: (value: string) =>
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) ||
    'Invalid PAN format (ABCDE1234F)',
  aadhaar: (value: string) =>
    /^\d{12}$/.test(value) || 'Aadhaar must be exactly 12 digits',
  consent: (value: boolean) => value === true || 'Declaration is required',
  pincode: (value: string) =>
    /^\d{6}$/.test(value) || 'Pincode must be exactly 6 digits',
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
    'w-full bg-[#031f31] border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none focus:bg-[#031f31]';
  const errorClasses = error
    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600';

  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-white"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && (
          <span className="text-xs text-white font-medium">Optional</span>
        )}
      </div>
      <input
        id={inputId}
        className={`${baseClasses} ${errorClasses} ${className}`}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `${inputId}-error`
            : hint
              ? `${inputId}-hint`
              : undefined
        }
        required={required}
        {...props}
      />
      {error ? (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"
        >
          <svg
            className="w-3 h-3 mr-1 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${inputId}-hint`}
          className="mt-1.5 text-xs text-white font-mono"
        >
          {hint}
        </p>
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
    'w-full bg-[#031f31] border text-white text-sm rounded-lg block p-3 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none focus:bg-[#031f31] appearance-none';
  const errorClasses = error
    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600';

  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <select
        className={`${baseClasses} ${errorClasses} ${className}`}
        required={required}
        {...props}
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center">
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
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
  const [fileName, setFileName] = useState<string | null>(
    externalFileName || null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalFileName) setFileName(externalFileName);
    else if (value === false) setFileName(null);
  }, [externalFileName, value]);

  const processFile = (file: File | null) => {
    setUploadError(null);
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        setUploadError(
          `File size exceeds 1MB limit. Current size: ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB`
        );
        return;
      }
      const allowedTypes = [
        'image/jpeg',
        'application/pdf',
        'application/x-pkcs12',
      ];
      const allowedExtensions = ['.jpg', '.jpeg', '.pdf', '.pfx', '.p12'];
      const fileExtension = file.name
        .toLowerCase()
        .slice(file.name.lastIndexOf('.'));

      if (
        !allowedTypes.includes(file.type) &&
        !allowedExtensions.includes(fileExtension)
      ) {
        setUploadError(
          'Only JPEG images, PDF files, and PFX/P12 files are allowed.'
        );
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

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  };

  const displayError = error || uploadError;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="block text-sm font-medium text-white">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {optional && (
          <span className="text-xs text-white font-medium">Optional</span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-white">📄</span>
        <span className="text-[10px] text-white font-medium">
          Max 1MB • JPEG, PDF, PFX, P12 only
        </span>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-3 transition-all duration-200 ease-in-out cursor-pointer group ${displayError
          ? 'border-red-500/80 bg-red-500/5'
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
                : 'bg-slate-700/50 text-white group-hover:text-sky-400'
              }`}
          >
            {fileName ? (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">
                  {fileName}
                </p>
                <p className="text-[10px] text-white mt-0.5">
                  Ready to Upload
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                  Click to upload
                </p>
                <p className="text-[10px] text-white mt-0.5">
                  JPEG, PDF, PFX or P12 (max 1MB)
                </p>
                {hint && (
                  <p className="text-[10px] text-white mt-0.5">{hint}</p>
                )}
              </div>
            )}
          </div>
          {fileName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFileName(null);
                setUploadError(null);
                onChange(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1 hover:bg-red-500/20 text-white hover:text-red-400 rounded transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      {displayError && (
        <p className="mt-2 text-xs text-red-400 flex items-center animate-pulse">
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {displayError}
        </p>
      )}
    </div>
  );
};

const StatusBanner: React.FC = () => (
  <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-white font-medium line-through text-lg">
          ₹999
        </span>
        <span className="text-emerald-400 font-bold text-2xl tracking-tight drop-shadow-sm">
          FREE
        </span>
        <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
          Govt charges applicable
        </span>
      </div>
      <p className="text-white text-sm mt-1 font-medium">
        Includes Digital Signature & Filing
      </p>
    </div>
  </div>
);

// ============================================================================
// CUSTOM CONFIRM MODAL
// ============================================================================
const CustomConfirm: React.FC<CustomConfirmProps> = ({
  message,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-sky-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
        </div>
        <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-medium rounded-lg transition-colors duration-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PROCESSING OVERLAY COMPONENT
// ============================================================================
const ProcessingOverlay: React.FC = () => (
  <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
      <div className="relative mb-6">
        <div className="w-16 h-16 mx-auto">
          <svg
            className="animate-spin w-full h-full text-sky-500"
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
      <p className="text-white text-sm mb-1">
        Please wait while we submit your application.
      </p>
      <p className="text-white text-xs">Do not close this window.</p>
    </div>
  </div>
);

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================
const Sidebar: React.FC<{
  currentStep: number;
  uploadedDocCount: number;
  totalRequiredDocs: number;
  onStepClick: (step: number) => void;
  onPreviewClick: () => void;
}> = ({ currentStep, uploadedDocCount, totalRequiredDocs, onStepClick, onPreviewClick }) => {
  const steps = [
    { num: 2, label: 'Enterprise Details', sub: 'Promoter Info' },
    { num: 3, label: 'Address Information', sub: 'Principal Place' },
    { num: 4, label: 'Business Activity', sub: 'Nature of Business' },
    { num: 5, label: 'Documents & Uploads', sub: `${uploadedDocCount}/${totalRequiredDocs} Uploaded` },
    { num: 6, label: 'Declaration', sub: 'Consent & Submit' },
  ];

  const requiredDocuments = [
    'Company PAN Card',
    'Certificate of Incorporation',
    'MOA & AOA',
    'Director KYC (PAN/Aadhaar)',
    'Address Proof (NOC/Rent)',
    'Digital Signature (DSC)',
  ];

  const getStepStatus = (stepNum: number) => {
    if (stepNum < currentStep) return 'completed';
    if (stepNum === currentStep) return 'in-progress';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Progress Status */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-white text-sm font-semibold">Progress Status</h3>
        </div>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const status = getStepStatus(step.num);
            return (
              <div key={step.num} className="relative">
                {index < steps.length - 1 && (
                  <div className="absolute left-[11px] top-6 w-0.5 h-full bg-slate-700/60 -mb-4"></div>
                )}
                <button
                  onClick={() => onStepClick(step.num)}
                  className="flex items-start gap-3 w-full text-left group focus:outline-none"
                >
                  <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 border-2 border-slate-800 transition-all duration-300 ${status === 'completed'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : status === 'in-progress'
                      ? 'bg-gradient-primary ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(34,197,94,0.5)] scale-110'
                      : 'bg-slate-700 group-hover:bg-slate-600'
                    }`}></div>
                  <div className="flex-1">
                    <h4 className={`text-xs font-medium transition-colors duration-200 ${status === 'completed'
                      ? 'text-emerald-400'
                      : status === 'in-progress'
                        ? 'text-white'
                        : 'text-white group-hover:text-white'
                      }`}>
                      {step.label}
                    </h4>
                    <p className={`text-[10px] mt-0.5 ${status === 'completed'
                      ? 'text-emerald-400/80'
                      : status === 'in-progress'
                        ? 'text-sky-400'
                        : 'text-slate-200'
                      }`}>
                      {status === 'completed'
                        ? 'Completed'
                        : status === 'in-progress'
                          ? 'In Progress'
                          : 'Pending'}
                    </p>
                    {step.num === 5 && (
                      <p className="text-[10px] text-sky-400 mt-1">
                        {step.sub}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Required Documents */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-white text-sm font-semibold">Required Documents</h3>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {requiredDocuments.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
              <span className="text-xs text-slate-300">{doc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Support Verification */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <h3 className="text-white text-sm font-semibold">Support Verification</h3>
        </div>
        <p className="text-[10px] text-white mb-4 leading-relaxed">
          Our support team will contact you on the provided mobile number for OTP/Aadhaar verification after submission.
        </p>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Support</span>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-amber-400 font-mono font-semibold">0413-2262818</span>
              <span className="text-xs text-amber-400 font-mono font-semibold">63645 62818</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Button */}
      <button
        onClick={onPreviewClick}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-800/80 border border-slate-600/50 text-amber-400 font-bold tracking-wide shadow-lg hover:bg-slate-700 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Preview Application
      </button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function PrivateLimitedForm({
  user,
  commonData,
  packageMode = false,
  onBack,
  onSubmit,
  INDIAN_STATES,
  STATE_DISTRICTS,
}: PrivateLimitedFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [firebaseDocId, setFirebaseDocId] = useState<string>('');

  // ============================================================================
  // GEO-TAGGED PHOTO UPLOADER COMPONENT
  // ============================================================================
  const GeoTaggedPhotoUploader: React.FC<FileUploaderProps & { onLocationCaptured?: (coords: { lat: number; lng: number } | null) => void }> = ({
    label, name, onChange, required, hint, optional, value, fileName: externalFileName, error, onLocationCaptured,
  }) => {
    const [fileName, setFileName] = useState<string | null>(externalFileName || null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (externalFileName) setFileName(externalFileName);
      else if (value === false) { setFileName(null); setCoords(null); }
    }, [externalFileName, value]);

    const captureLocation = () => {
      if (!navigator.geolocation) { setUploadError('Geolocation not supported.'); return; }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(newCoords);
          onLocationCaptured?.(newCoords);
          setIsLocating(false);
        },
        () => { setUploadError('Location permission denied.'); setIsLocating(false); },
        { enableHighAccuracy: true }
      );
    };

    const processFile = (file: File | null) => {
      setUploadError(null);
      if (!file) { setFileName(null); setCoords(null); onLocationCaptured?.(null); onChange(null); return; }
      if (file.size > 2 * 1024 * 1024) { setUploadError(`Max 2MB allowed.`); return; }
      if (!file.type.startsWith('image/')) { setUploadError('Only image files allowed.'); return; }
      setFileName(file.name);
      onChange(file);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => processFile(e.target.files?.[0] || null);
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files?.[0] || null); };

    const displayError = error || uploadError;

    return (
      <div className="mb-4">
        <div className="flex justify-between items-baseline mb-1.5">
          <label className="block text-sm font-medium text-white">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {optional && <span className="text-xs text-white font-medium">Optional</span>}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-white">📍</span>
          <span className="text-[10px] text-white font-medium">Max 2MB • JPEG/PNG • Enable GPS</span>
        </div>
        <div
          className={`relative border-2 border-dashed rounded-xl p-3 transition-all duration-200 cursor-pointer group ${displayError ? 'border-red-500/80 bg-red-500/5' : isDragging ? 'border-cyan-500 bg-cyan-500/10' : fileName ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/40'
            }`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} name={name} accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg shrink-0 transition-colors ${fileName ? 'bg-emerald-500/20 text-emerald-400' : displayError ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-white group-hover:text-sky-400'}`}>
              {fileName ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            </div>
            <div className="flex-1 min-w-0">
              {fileName ? <div><p className="text-sm font-medium text-emerald-400 truncate">{fileName}</p><p className="text-[10px] text-white mt-0.5">Ready to Upload</p></div> : <div><p className="text-sm text-slate-300 font-medium group-hover:text-white">Click to upload or capture</p><p className="text-[10px] text-white mt-0.5">JPEG, PNG (max 2MB)</p>{hint && <p className="text-[10px] text-white mt-0.5">{hint}</p>}</div>}
            </div>
            {fileName && <button type="button" onClick={(e) => { e.stopPropagation(); setFileName(null); setCoords(null); onLocationCaptured?.(null); setUploadError(null); onChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 hover:bg-red-500/20 text-white hover:text-red-400 rounded transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
          </div>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); captureLocation(); }} disabled={isLocating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sky-400 text-xs rounded-md transition-colors disabled:opacity-50">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {isLocating ? 'Fetching GPS...' : 'Capture GPS Coordinates'}
          </button>
          {coords && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded font-mono border border-emerald-500/20">📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>}
        </div>
        {displayError && <p className="mt-2 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{displayError}</p>}
      </div>
    );
  };

  // ✅ FIXED: Initialize caseId from LocalStorage first, then update if needed
  const [caseId, setCaseId] = useState<string>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CASE_ID, '')
  );

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STEP, 2);
    return saved < 2 ? 2 : saved;
  });

  const [formData, setFormData] = useState<FormData>(() =>
    loadFromLocalStorage(STORAGE_KEYS.FORM_DATA, INITIAL_DATA)
  );

  const [docSubStep, setDocSubStep] = useState(() =>
    loadFromLocalStorage(STORAGE_KEYS.DOC_SUB_STEP, 1)
  );

  const [errors, setErrors] = useState<
    Partial<Record<keyof FormData | string, string>>
  >({});

  const [touched, setTouched] = useState<
    Partial<Record<keyof FormData, boolean>>
  >({});

  const [propertyType, setPropertyType] = useState<'owned' | 'rented'>(() =>
    loadFromLocalStorage(STORAGE_KEYS.PROPERTY_TYPE, 'owned')
  );

  const [availableDistricts, setAvailableDistricts] = useState<
    { value: string; label: string }[]
  >([]);

  const [captcha, setCaptcha] = useState({ val1: 0, val2: 0, userAnswer: '' });

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

  const [signatoryFatherFirstName, setSignatoryFatherFirstName] = useState(
    () => {
      const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
      return saved.signatoryFatherFirstName || '';
    }
  );

  const [signatoryFatherMiddleName, setSignatoryFatherMiddleName] = useState(
    () => {
      const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
      return saved.signatoryFatherMiddleName || '';
    }
  );

  const [signatoryFatherLastName, setSignatoryFatherLastName] = useState(
    () => {
      const saved = loadFromLocalStorage(STORAGE_KEYS.SIGNATORY, {});
      return saved.signatoryFatherLastName || '';
    }
  );

  const [directors, setDirectors] = useState<Director[]>(() =>
    loadFromLocalStorage(STORAGE_KEYS.DIRECTORS, INITIAL_DIRECTORS)
  );

  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, boolean>>(
    () =>
      loadFromLocalStorage(STORAGE_KEYS.UPLOADED_DOCS, INITIAL_UPLOADED_DOCS)
  );

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    companyPan: null,
    companyCoi: null,
    companyMoa: null,
    companyAoa: null,
    signPan: null,
    signAadhaar: null,
    signPhoto: null,
    signAuthLetter: null,
    rentAgreement: null,
    noc: null,
    addressProof: null,
    elecBill: null,
    taxReceipt: null,
    utilityBill: null,
    dsc: null,
    geoTaggedPhoto: null,
  });

  const [docFileNames, setDocFileNames] = useState<
    Partial<Record<DocKey, string>>
  >(() => loadFromLocalStorage(STORAGE_KEYS.DOC_FILE_NAMES, {}));

  const [directorFileNames, setDirectorFileNames] = useState<
    Record<string, { pan?: string; aadhaar?: string; photo?: string }>
  >(() => loadFromLocalStorage(STORAGE_KEYS.DIRECTOR_FILE_NAMES, {}));

  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(() => {
    return loadFromLocalStorage(STORAGE_KEYS.GEO_COORDS, null);
  });

  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  const draftId = React.useMemo(() => {
    const owner = user?.uid || user?.email || 'guest';
    const seed = commonData.panNumber || commonData.businessName || 'gst-private-limited';
    return `${owner}-${seed}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }, [user?.uid, user?.email, commonData.panNumber, commonData.businessName]);


  // Persistence effects
  useEffect(() => {
    saveDraft();
  }, [currentStep, docSubStep]);

  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const saveDraft = async (stepOverride?: number) => {
    if (packageMode || !user?.uid) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `gst_${user.uid}`), {
        serviceType: 'GST',
        constitution: commonData.constitution || 'Private Limited Company',
        commonData,
        formData,
        directors,
        currentStep: stepOverride || currentStep,
        docSubStep,
        propertyType,
        uploadedDocs,
        docFileNames,
        directorFileNames,
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
        geoCoords,
        lastUpdated: serverTimestamp(),
        userId: user.uid,
        status: 'draft'
      }, { merge: true });
    } catch (error) {
      console.error('Failed to save GST Private Limited draft:', error);
    } finally {
      setIsDraftSaving(false);
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // ============================================================================
  // CHROME NOTIFICATION SUPPRESSION
  // ============================================================================
  useEffect(() => {
    const suppressNotificationErrors = () => {
      if ('Notification' in window) {
        const OriginalNotification = (window as any).Notification;
        (window as any).Notification = Object.assign(
          function (...args: any[]) {
            return new OriginalNotification(...args);
          },
          OriginalNotification,
          {
            permission: OriginalNotification.permission,
            requestPermission: async function () {
              try {
                return await OriginalNotification.requestPermission();
              } catch (error) {
                return 'denied';
              }
            }
          }
        );
      }
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        const reasonStr = String(reason);
        if (reasonStr.includes('Notification') ||
          reasonStr.includes('notification') ||
          reasonStr.includes('permission') ||
          reasonStr.includes('Permission')) {
          event.preventDefault();
        }
      };
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    };
    const cleanup = suppressNotificationErrors();
    return cleanup;
  }, []);

  // ============================================================================
  // ✅ FIXED: CASE ID GENERATION
  // ============================================================================
  useEffect(() => {
    const ensureCaseId = async () => {
      // If we already have a caseId, do nothing
      if (caseId && caseId.startsWith('GST-PVT-')) return;

      // ✅ CHECK IF USER IS LOGGED IN
      if (!user || !user.uid) {
        console.warn("User not logged in. Cannot generate Case ID yet.");
        return;
      }

      try {
        const year = new Date().getFullYear();
        const newId = await generateSequentialFormId('GST-PVT', year);
        setCaseId(newId);
        console.log('✅ Generated new Case ID:', newId);
      } catch (err) {
        console.error('❌ Failed to generate case ID:', err);
        alert('Error generating Case ID. Please ensure you are logged in.');
      }
    };
    ensureCaseId();
  }, [caseId, user]); // Add 'user' to dependencies

  const generateCaptcha = () =>
    setCaptcha({
      val1: Math.floor(Math.random() * 10),
      val2: Math.floor(Math.random() * 10),
      userAnswer: '',
    });

  useEffect(() => {
    if (formData.state) {
      const districts = STATE_DISTRICTS[formData.state] || [];
      setAvailableDistricts(districts);
      if (!formData.district)
        setFormData((prev) => ({ ...prev, district: '' }));
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.state]);

  const validateField = (name: keyof FormData | string, value: any): string => {
    switch (name) {
      case 'promoterName':
        return validators.name(value) === true
          ? ''
          : (validators.name(value) as string);
      case 'promoterDob':
        return validators.dob(value) === true
          ? ''
          : (validators.dob(value) as string);
      case 'promoterEmail':
        return validators.email(value) === true
          ? ''
          : (validators.email(value) as string);
      case 'promoterMobile':
        return validators.mobile(value) === true
          ? ''
          : (validators.mobile(value) as string);
      case 'promoterAadhaar':
        return validators.aadhaar(value) === true
          ? ''
          : (validators.aadhaar(value) as string);
      case 'flatNumber':
        return validators.required(value, 'Flat/Door/Block Number') === true
          ? ''
          : (validators.required(value, 'Flat/Door/Block Number') as string);
      case 'roadStreet':
        return validators.required(value, 'Road/Street/Lane') === true
          ? ''
          : (validators.required(value, 'Road/Street/Lane') as string);
      case 'areaLocality':
        return validators.required(value, 'Area/Locality') === true
          ? ''
          : (validators.required(value, 'Area/Locality') as string);
      case 'district':
        return validators.required(value, 'District') === true
          ? ''
          : (validators.required(value, 'District') as string);
      case 'state':
        return validators.required(value, 'State') === true
          ? ''
          : (validators.required(value, 'State') as string);
      case 'pincode':
        return validators.pincode(value) === true
          ? ''
          : (validators.pincode(value) as string);
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    let formattedValue: any =
      type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : value;

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

  const handleBlur = (
    e: FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    const finalValue =
      type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : value;
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, finalValue) }));
  };

  const getStepFields = (step: number): (keyof FormData)[] => {
    switch (step) {
      case 2:
        return [
          'promoterName',
          'promoterDob',
          'promoterEmail',
          'promoterMobile',
          'promoterAadhaar',
        ];
      case 3:
        return [
          'flatNumber',
          'roadStreet',
          'areaLocality',
          'district',
          'state',
          'pincode',
        ];
      case 4:
        return ['natureOfBusiness'];
      case 6:
        return ['consent1', 'consent2'];
      default:
        return [];
    }
  };

  const validateCurrentStep = (): boolean => {
    const fields = getStepFields(currentStep);
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    let isValid = true;

    fields.forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    if (!isValid) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      setTouched((prev) => {
        const t = { ...prev };
        fields.forEach((f) => (t[f] = true));
        return t;
      });
    }
    return isValid;
  };

  const validateDirectors = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (directors.length < 2) {
      isValid = false;
    }

    let hasPrimary = false;
    directors.forEach((director, index) => {
      const directorNum = index + 1;
      if (director.isPrimary) hasPrimary = true;

      if (!director.firstName || !director.firstName.trim()) {
        newErrors[`director-${director.id}-firstName`] =
          'First Name is required';
        isValid = false;
      }

      if (!director.designation) {
        newErrors[`director-${director.id}-designation`] =
          'Designation is required';
        isValid = false;
      }
      if (!director.mobile || director.mobile.length !== 10) {
        newErrors[`director-${director.id}-mobile`] =
          'Valid 10-digit mobile number is required';
        isValid = false;
      }
      if (
        !director.email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(director.email)
      ) {
        newErrors[`director-${director.id}-email`] =
          'Valid email address is required';
        isValid = false;
      }
      if (
        !director.fatherName?.firstName ||
        !director.fatherName.firstName.trim()
      ) {
        newErrors[`director-${director.id}-fatherFirstName`] =
          "Father's First Name is required";
        isValid = false;
      }

      if (!director.panFile) {
        newErrors[`director-${director.id}-pan`] =
          'PAN Card upload is required';
        isValid = false;
      }
      if (!director.aadhaarFile) {
        newErrors[`director-${director.id}-aadhaar`] =
          'Aadhaar Card upload is required';
        isValid = false;
      }
      if (!director.photoFile) {
        newErrors[`director-${director.id}-photo`] =
          'Passport size photo upload is required';
        isValid = false;
      }
    });

    if (!hasPrimary) {
      newErrors['primary-director'] = 'Please select one Primary Director';
      isValid = false;
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const validateDocuments = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (docSubStep === 1) {
      if (!uploadedDocs.companyPan) {
        newErrors['companyPan'] = 'Company PAN Card is required';
        isValid = false;
      }
      if (!uploadedDocs.companyCoi) {
        newErrors['companyCoi'] =
          'Certificate of Incorporation (COI) is required';
        isValid = false;
      }
      if (!uploadedDocs.companyMoa) {
        newErrors['companyMoa'] =
          'Memorandum of Association (MOA) is required';
        isValid = false;
      }
      if (!uploadedDocs.companyAoa) {
        newErrors['companyAoa'] =
          'Articles of Association (AOA) is required';
        isValid = false;
      }
    } else if (docSubStep === 2) {
      if (!validateDirectors()) {
        isValid = false;
      }
    } else if (docSubStep === 3) {
      if (propertyType === 'owned') {
        if (!uploadedDocs.elecBill) {
          newErrors['elecBill'] = 'Electricity Bill is required for owned property';
          isValid = false;
        }
        if (!uploadedDocs.taxReceipt) {
          newErrors['taxReceipt'] = 'Property Tax Receipt is required for owned property';
          isValid = false;
        }
        if (!uploadedDocs.utilityBill) {
          newErrors['utilityBill'] = 'Utility Bill is required for owned property';
          isValid = false;
        }
      } else {
        if (!uploadedDocs.rentAgreement) {
          newErrors['rentAgreement'] = 'Rent Agreement is required for rented property';
          isValid = false;
        }
        if (!uploadedDocs.noc) {
          newErrors['noc'] = 'NOC from Owner is required for rented property';
          isValid = false;
        }
        if (!uploadedDocs.addressProof) {
          newErrors['addressProof'] = 'Address Proof is required for rented property';
          isValid = false;
        }
      }
      // Check geoTaggedPhoto for BOTH property types
      if (!uploadedDocs.geoTaggedPhoto) {
        newErrors['geoTaggedPhoto'] = 'Geo-tagged photo is required';
        isValid = false;
      }

    } else if (docSubStep === 4 && includeSignatoryDetails) {
      if (!signatoryFirstName || !signatoryFirstName.trim()) {
        newErrors['signatoryFirstName'] = 'Signatory First Name is required';
        isValid = false;
      }

      if (!signatoryFatherFirstName || !signatoryFatherFirstName.trim()) {
        newErrors['signatoryFatherFirstName'] =
          "Signatory's Father's First Name is required";
        isValid = false;
      }

      if (!signatoryMobile || signatoryMobile.length !== 10) {
        newErrors['signatoryMobile'] =
          'Valid 10-digit Signatory Mobile Number is required';
        isValid = false;
      }
      if (
        !signatoryEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signatoryEmail)
      ) {
        newErrors['signatoryEmail'] =
          'Valid Signatory Email ID is required';
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
    } else if (docSubStep === 5) {
      if (!uploadedDocs.dsc) {
        newErrors['dsc'] = 'Digital Signature Certificate (DSC) is required';
        isValid = false;
      }
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const handleNext = async () => {
    if (currentStep === 5) {
      if (!validateDocuments()) {
        return;
      }
      if (docSubStep < 5) {
        setDocSubStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (currentStep === 6) {
      if (!validateCurrentStep()) return;
      if (parseInt(captcha.userAnswer) !== captcha.val1 + captcha.val2) {
        setErrors((prev) => ({
          ...prev,
          captcha: 'Wrong CAPTCHA. Please try again.',
        }));
        generateCaptcha();
        return;
      }
    }

    if (currentStep < 6 && currentStep !== 5) {
      if (validateCurrentStep()) {
        const nextStep = currentStep + 1;
        await saveDraft(nextStep);
        setCurrentStep(nextStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (currentStep === 5 && docSubStep === 5) {
      const nextStep = currentStep + 1;
      await saveDraft(nextStep);
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep === 2) {
      onBack();
      return;
    }
    setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToServices = () => {
    setConfirmConfig({
      show: true,
      message:
        'Are you sure you want to go back? All entered data will be lost.',
      onConfirm: () => {
        clearAllLocalStorage();
        onBack();
      },
    });
  };

  /**
   * Upload file to Firebase Storage with retry logic
   */
  const uploadFileToStorage = async (
    file: File,
    docId: string, // This is now our custom Case ID
    fieldName: string,
    maxRetries: number = 3
  ): Promise<string> => {
    if (!user?.uid) throw new Error('User not authenticated.');

    const cleanName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileExt = cleanName.split('.').pop() || 'bin';
    const baseName = cleanName.split('.').slice(0, -1).join('.');
    const fileName = `${baseName}_${Date.now()}.${fileExt}`;

    // Path uses the Custom Case ID for better organization
    const path = `gst-applications/${user.uid}/${docId}/${fieldName}_${fileName}`;

    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📤 Upload attempt ${attempt}/${maxRetries} for ${fieldName}: ${file.name}`
        );
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file, {
          contentType: file.type,
        });
        const downloadUrl = await getDownloadURL(snapshot.ref);
        console.log(
          `✅ Upload successful on attempt ${attempt}/${maxRetries}: ${fieldName}`
        );
        return downloadUrl;
      } catch (error: any) {
        lastError = error;
        const status = error.serverResponse?.status;
        const code = error.code || '';
        console.warn(
          `⚠️ Upload attempt ${attempt}/${maxRetries} failed for ${fieldName}:`,
          { code, status, message: error.message }
        );

        const permanentErrors = [
          'storage/not-found',
          'storage/object-not-found',
          'storage/bucket-not-found',
          'storage/invalid-checksum',
          'storage/invalid-argument',
        ];
        const isPermanent = permanentErrors.includes(code) && status !== 403;

        if (isPermanent) {
          console.error(`🛑 Non-retryable error for ${fieldName}: ${code}.`);
          throw error;
        }

        if (attempt === maxRetries) {
          console.error(`🛑 Upload failed after ${maxRetries} attempts for ${fieldName}`);
          throw error;
        }

        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError || new Error(`Upload failed for ${fieldName}`);
  };

  const handleFileUpload =
    (fieldName: DocKey) => (file: File | null) => {
      setUploadedFiles((prev) => ({ ...prev, [fieldName]: file }));
      setUploadedDocs((prev) => ({ ...prev, [fieldName]: !!file }));
      setDocFileNames((prev) => ({
        ...prev,
        [fieldName]: file ? file.name : undefined,
      }));
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    };

  const handleDirectorChange = (
    id: string,
    field: keyof Director,
    value: any
  ) => {
    setDirectors((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
    if (field === 'fatherName') {
      setErrors((prev) => ({
        ...prev,
        [`director-${id}-fatherFirstName`]: undefined,
        [`director-${id}-fatherMiddleName`]: undefined,
        [`director-${id}-fatherLastName`]: undefined,
      }));
    } else {
      setErrors((prev) => ({
        ...prev,
        [`director-${id}-${field}`]: undefined,
      }));
    }
  };

  const handlePrimaryChange = (selectedId: string) => {
    setDirectors((prev) =>
      prev.map((d) => ({ ...d, isPrimary: d.id === selectedId }))
    );
    setErrors((prev) => ({ ...prev, 'primary-director': undefined }));
  };

  const handleDirectorFileUpload =
    (id: string, field: 'panFile' | 'aadhaarFile' | 'photoFile') =>
      (file: File | null) => {
        setDirectors((prev) =>
          prev.map((d) => (d.id === id ? { ...d, [field]: !!file } : d))
        );
        if (file) {
          setDirectorFileNames((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              [field === 'panFile'
                ? 'pan'
                : field === 'aadhaarFile'
                  ? 'aadhaar'
                  : 'photo']: file.name,
            },
          }));
        }
        setErrors((prev) => ({
          ...prev,
          [`director-${id}-${field === 'panFile'
            ? 'pan'
            : field === 'aadhaarFile'
              ? 'aadhaar'
              : 'photo'
            }`]: undefined,
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
        designation: 'Director',
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
    if (directors.length <= 2) {
      return;
    }
    setDirectors((prev) => prev.filter((d) => d.id !== id));
  };

  const getTotalRequiredDocs = () => {
    let count = 7;
    count += directors.length * 3;
    count += 4;
    if (includeSignatoryDetails) count += 4;
    return count;
  };

  const getUploadedDocCount = () => {
    let count = 0;
    if (uploadedDocs.companyPan) count++;
    if (uploadedDocs.companyCoi) count++;
    if (uploadedDocs.companyMoa) count++;
    if (uploadedDocs.companyAoa) count++;
    if (uploadedDocs.dsc) count++;
    directors.forEach((d) => {
      if (d.panFile) count++;
      if (d.aadhaarFile) count++;
      if (d.photoFile) count++;
    });
    if (propertyType === 'owned') {
      if (uploadedDocs.elecBill) count++;
      if (uploadedDocs.taxReceipt) count++;
      if (uploadedDocs.utilityBill) count++;
    }
    if (propertyType === 'rented') {
      if (uploadedDocs.rentAgreement) count++;
      if (uploadedDocs.noc) count++;
      if (uploadedDocs.addressProof) count++;

    }
    if (uploadedDocs.geoTaggedPhoto) count++;
    if (includeSignatoryDetails) {
      if (uploadedDocs.signPan) count++;
      if (uploadedDocs.signAadhaar) count++;
      if (uploadedDocs.signPhoto) count++;
      if (uploadedDocs.signAuthLetter) count++;
    }
    return count;
  };

  const validateAllSections = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    const promoterFields: (keyof FormData)[] = [
      'promoterName',
      'promoterDob',
      'promoterEmail',
      'promoterMobile',
      'promoterAadhaar',
    ];
    promoterFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    const addressFields: (keyof FormData)[] = [
      'flatNumber',
      'roadStreet',
      'areaLocality',
      'district',
      'state',
      'pincode',
    ];
    addressFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    if (!formData.natureOfBusiness) {
      newErrors['natureOfBusiness'] = 'Nature of Business is required';
      isValid = false;
    }

    if (docSubStep === 1) {
      if (!uploadedDocs.companyPan) {
        newErrors['companyPan'] = 'Company PAN Card is required';
        isValid = false;
      }
      if (!uploadedDocs.companyCoi) {
        newErrors['companyCoi'] = 'Certificate of Incorporation is required';
        isValid = false;
      }
      if (!uploadedDocs.companyMoa) {
        newErrors['companyMoa'] = 'MOA is required';
        isValid = false;
      }
      if (!uploadedDocs.companyAoa) {
        newErrors['companyAoa'] = 'AOA is required';
        isValid = false;
      }
    } else if (docSubStep === 2) {
      if (!validateDirectors()) isValid = false;
    } else if (docSubStep === 3) {
      if (propertyType === 'owned') {
        if (!uploadedDocs.elecBill) {
          newErrors['elecBill'] = 'Electricity Bill is required';
          isValid = false;
        }
        if (!uploadedDocs.taxReceipt) {
          newErrors['taxReceipt'] = 'Tax Receipt is required';
          isValid = false;
        }
        if (!uploadedDocs.utilityBill) {
          newErrors['utilityBill'] = 'Utility Bill is required';
          isValid = false;
        }
      } else {
        if (!uploadedDocs.rentAgreement) {
          newErrors['rentAgreement'] = 'Rent Agreement is required';
          isValid = false;
        }
        if (!uploadedDocs.noc) {
          newErrors['noc'] = 'NOC is required';
          isValid = false;
        }
        if (!uploadedDocs.addressProof) {
          newErrors['addressProof'] = 'Address Proof is required';
          isValid = false;
        }
      }
    } else if (docSubStep === 4 && includeSignatoryDetails) {
      if (!signatoryFirstName) {
        newErrors['signatoryFirstName'] = 'First Name is required';
        isValid = false;
      }
      if (!signatoryMobile || signatoryMobile.length !== 10) {
        newErrors['signatoryMobile'] = 'Valid mobile is required';
        isValid = false;
      }
      if (!signatoryEmail) {
        newErrors['signatoryEmail'] = 'Valid email is required';
        isValid = false;
      }
      if (!uploadedDocs.signPan) {
        newErrors['signPan'] = 'PAN is required';
        isValid = false;
      }
      if (!uploadedDocs.signAadhaar) {
        newErrors['signAadhaar'] = 'Aadhaar is required';
        isValid = false;
      }
      if (!uploadedDocs.signPhoto) {
        newErrors['signPhoto'] = 'Photo is required';
        isValid = false;
      }
      if (!uploadedDocs.signAuthLetter) {
        newErrors['signAuthLetter'] = 'Authorization Letter is required';
        isValid = false;
      }
    } else if (docSubStep === 5) {
      if (!uploadedDocs.dsc) {
        newErrors['dsc'] = 'DSC is required';
        isValid = false;
      }
    }

    if (!formData.consent1) {
      newErrors['consent1'] = 'Authorization consent is required';
      isValid = false;
    }
    if (!formData.consent2) {
      newErrors['consent2'] = 'Declaration consent is required';
      isValid = false;
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    setTouched((prev) => {
      const t = { ...prev };
      [...promoterFields, ...addressFields].forEach((f) => (t[f] = true));
      return t;
    });
    return isValid;
  };

  const initiateSubmission = () => {
    if (isSubmitting) return;
    if (!user?.uid) {
      return;
    }
    if (!validateAllSections()) {
      return;
    }
    setConfirmConfig({
      show: true,
      message:
        'During registration you will receive an OTP. Our support team will contact you once received. Please provide the correct OTP.',
      onConfirm: executeSubmission,
    });
  };


  /**
   * ✅ FIXED: Execute Submission (Matching LLP Logic)
   * Uses Random Firestore ID to avoid Permission/Counter conflicts.
   */
  const executeSubmission = async () => {
    // 1. Safety Checks
    if (!user || !user.uid) {
      alert("User authentication error. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('🚀 Starting GST Pvt Ltd application submission...');

      // 2. Generate a RANDOM Firestore ID (Just like LLP form)
      // This avoids the "Permission Denied" error caused by custom IDs/Counters
      const docRef = doc(collection(db, 'applications'));
      const firebaseId = docRef.id;

      console.log(`🆔 Generated Firestore ID: ${firebaseId}`);

      // 3. Upload Files to Storage
      console.log('📤 Uploading files to Firebase Storage...');
      const uploadedFileUrls: Record<string, string> = {};
      let uploadErrors: Array<{ key: string; error: any }> = [];

      const filesToUpload: Array<{ key: string; file: File; fieldName: string }> = [];

      for (const [key, isUploaded] of Object.entries(uploadedDocs)) {
        if (isUploaded && uploadedFiles[key as DocKey]) {
          filesToUpload.push({
            key,
            file: uploadedFiles[key as DocKey]!,
            fieldName: key,
          });
        }
      }

      for (const { key, file, fieldName } of filesToUpload) {
        try {
          // Path structure: gst-applications/{userId}/{randomFirebaseId}/{fieldName}_{filename}
          const cleanName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `gst-applications/${user.uid}/${firebaseId}/${fieldName}_${Date.now()}_${cleanName}`;

          const storageRef = ref(storage, path);
          const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
          const downloadUrl = await getDownloadURL(snapshot.ref);

          uploadedFileUrls[key] = downloadUrl;
          console.log(`✅ Uploaded ${fieldName}`);
        } catch (uploadError: any) {
          console.error(`❌ Failed to upload ${fieldName}:`, uploadError.message);
          uploadErrors.push({ key, error: uploadError });
        }
      }

      if (uploadErrors.length > 0) {
        throw new Error(`Failed to upload ${uploadErrors.length} file(s). Please check your internet connection.`);
      }

      // 4. Prepare Submission Data
      // We still generate the Custom Case ID for DISPLAY purposes, 
      // but we save the document with the Random Firebase ID.
      const year = new Date().getFullYear();
      // Note: If you want sequential IDs later, you can add a Cloud Function. 
      // For now, we use a simple fallback or the random ID to ensure it saves.
      const displayCaseId = caseId && caseId.startsWith('GST-PVT-') ? caseId : `GST-PVT-${year}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const submissionData = {
        id: firebaseId,           // 🔥 Use Random ID for DB Key
        caseId: displayCaseId,    // 🔥 Use Custom ID for Display/Reference
        applicationRef: displayCaseId,
        serviceId: displayCaseId,
        type: 'gst',
        constitution: 'Private Limited Company',
        title: 'GST Registration Application - Private Limited',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        commonData: { ...commonData },
        formData: { ...formData },
        directors,
        propertyType,
        uploadedFileUrls,

        // 🔥 CRITICAL: Must match request.auth.uid for Rules to pass
        userId: user.uid,

        folderId: user.folderId || 'regibiz',
        paymentId: 'FREE_SUBMISSION',
        createdAt: Date.now(),
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
          : null,
      };

      // 5. Save to Firestore (Skip if packageMode)
      if (!packageMode) {
        console.log('💾 Saving application to Firestore...');
        await setDoc(docRef, submissionData);
        try {
          await Promise.allSettled([
            deleteDoc(doc(db, 'drafts', `gst_${user.uid}`)),
            deleteDoc(doc(db, 'drafts', `gst_pvtltd_${user.uid}`)),
          ]);
        } catch (err) {
          console.error('Failed to delete draft:', err);
        }
        console.log('✅ Application saved successfully!');
        setFirebaseDocId(firebaseId);
      }

      // 6. Call Parent Handler (if exists)
      if (onSubmit) {
        const filesToSubmit: Record<string, File> = {};
        Object.entries(uploadedFiles).forEach(([k, v]) => { if (v) filesToSubmit[k] = v; });
        await onSubmit(submissionData, filesToSubmit);
      }

      // 7. Success (Skip success screen if packageMode)
      if (packageMode) {
        setIsSubmitting(false);
        return;
      }

      clearAllLocalStorage();
      setIsSubmitting(false);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err: any) {
      console.error('❌ Submission failed:', err);
      setIsSubmitting(false);

      if (err.code === 'permission-denied') {
        alert("❌ Permission Denied.\n\nThis usually means:\n1. You are not logged in properly.\n2. Your Firestore Rules are blocking the write.\n\nPlease try logging out and back in.");
      } else {
        alert(`❌ Submission Failed:\n${err.message}`);
      }
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
        <CelebrationPopup trigger={isSuccess} message="" />
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg relative z-10">
          {/* Main Card */}
          <div className="bg-black/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">

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
            <p className="text-slate-300 mb-6 text-sm leading-relaxed max-w-xs mx-auto">
              Your Private Limited application has been received. Our team will contact you for OTP/Aadhaar verification and processing.
            </p>

            {/* Case ID Section */}
            <div className="mb-8">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-1">Your Case ID</p>
              <div className="inline-block bg-slate-900/40 px-4 py-2 rounded-lg border border-slate-700/50">
                <p className="text-orange-400 font-mono font-bold text-lg tracking-wider">{caseId}</p>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-900/40 rounded-xl p-4 mb-8 text-left border border-slate-700/50 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-300 text-sm">Company Name</span>
                <span className="text-white font-medium text-sm capitalize">{commonData.businessName || 'Applicant'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-300 text-sm">Type</span>
                <span className="text-white font-medium text-sm">Private Limited Company</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300 text-sm">Primary Director</span>
                <span className="text-white font-medium text-sm">
                  {directors.find(d => d.isPrimary)?.firstName || 'Director'}
                </span>
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
                className="w-full px-6 py-3.5 rounded-lg font-semibold text-white bg-slate-900/40 hover:bg-slate-800 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
              >
                Back to Services
              </button>
            </div>
          </div>

          {/* Footer Copyright */}
          <p className="text-center text-slate-500 text-xs mt-6">© 2026 RegiBIZ Compliance Solutions</p>
        </div>
      </div>
    );
  }

  const PreviewModal = () => {
    const getStateLabel = (value: string) => {
      const stateData = INDIAN_STATES.find((s) => s.value === value);
      return stateData?.label || value;
    };
    const getDistrictLabel = (value: string) => {
      const districtData = availableDistricts.find((d) => d.value === value);
      return districtData?.label || value;
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-black rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto border border-slate-700 shadow-2xl my-8">
          <div className="sticky top-0 bg-black/95 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center z-10">
            <div>
              <h3 className="text-2xl font-bold text-white">
                Application Preview
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Review all details before submission
              </p>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="p-6 space-y-6">
            {/* Business Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Business Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Legal Name
                  </p>
                  <p className="text-white font-medium mt-1">
                    {commonData.businessName}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    PAN Number
                  </p>
                  <p className="text-white font-mono font-medium mt-1">
                    {commonData.panNumber}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Constitution
                  </p>
                  <p className="text-white font-medium mt-1">
                    {commonData.constitution}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Date of Commencement
                  </p>
                  <p className="text-white font-medium mt-1">
                    {formatDate(commonData.dateOfCommencement)}
                  </p>
                </div>
              </div>
            </section>

            {/* Promoter Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Promoter / Authorized Signatory Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Full Name
                  </p>
                  <p className="text-white font-medium mt-1">
                    {formData.promoterName}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Date of Birth
                  </p>
                  <p className="text-white font-medium mt-1">
                    {formatDate(formData.promoterDob)}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Mobile Number
                  </p>
                  <p className="text-white font-medium mt-1">
                    +91 {formData.promoterMobile}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Email Address
                  </p>
                  <p className="text-white font-medium mt-1">
                    {formData.promoterEmail}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Aadhaar Number
                  </p>
                  <p className="text-white font-mono font-medium mt-1">
                    {formData.promoterAadhaar}
                  </p>
                </div>
              </div>
            </section>

            {/* Address Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Principal Place of Business
              </h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Flat/Door/Block Number
                    </p>
                    <p className="text-white font-medium mt-1">
                      {formData.flatNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Road/Street/Lane
                    </p>
                    <p className="text-white font-medium mt-1">
                      {formData.roadStreet}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Area/Locality
                    </p>
                    <p className="text-white font-medium mt-1">
                      {formData.areaLocality}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      District
                    </p>
                    <p className="text-white font-medium mt-1">
                      {getDistrictLabel(formData.district)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      State
                    </p>
                    <p className="text-white font-medium mt-1">
                      {getStateLabel(formData.state)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Pincode
                    </p>
                    <p className="text-white font-mono font-medium mt-1">
                      {formData.pincode}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Nature of Business */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Nature of Business
              </h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-white font-medium">
                  {formData.natureOfBusiness}
                </p>
              </div>
            </section>

            {/* Directors Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Directors / Promoters ({directors.length})
              </h4>
              <div className="space-y-4">
                {directors.map((director, index) => (
                  <div
                    key={director.id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                        {index + 1}
                      </span>
                      <h5 className="text-white font-semibold">
                        Director {index + 1}
                      </h5>
                      {director.isPrimary && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        ({director.designation})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Full Name</p>
                        <p className="text-white font-medium">
                          {director.firstName} {director.middleName}{' '}
                          {director.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Father's Name</p>
                        <p className="text-white font-medium">
                          {director.fatherName?.firstName}{' '}
                          {director.fatherName?.middleName}{' '}
                          {director.fatherName?.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Mobile</p>
                        <p className="text-white font-medium">
                          +91 {director.mobile}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Email</p>
                        <p className="text-white font-medium">
                          {director.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/30">
                      <p className="text-xs text-slate-400 mb-2">
                        Documents Uploaded:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {director.panFile && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            PAN
                          </span>
                        )}
                        {director.aadhaarFile && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Aadhaar
                          </span>
                        )}
                        {director.photoFile && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Photo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Corporate Documents */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Corporate Documents
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'companyPan', label: 'Company PAN' },
                  { key: 'companyCoi', label: 'Certificate of Incorporation' },
                  { key: 'companyMoa', label: 'Memorandum of Association (MOA)' },
                  { key: 'companyAoa', label: 'Articles of Association (AOA)' },
                  { key: 'dsc', label: 'Digital Signature Certificate (DSC)' },
                ].map((doc) => (
                  <div
                    key={doc.key}
                    className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-300">{doc.label}</span>
                    {uploadedDocs[doc.key as DocKey] ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Uploaded
                      </span>
                    ) : (
                      <span className="text-xs text-white">
                        Not Uploaded
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Address Proof Documents */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Address Proof Documents (
                {propertyType === 'owned' ? 'Owned' : 'Rented'} Property)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {propertyType === 'owned' ? (
                  <>
                    {[
                      { key: 'elecBill', label: 'Electricity Bill' },
                      { key: 'taxReceipt', label: 'Property Tax Receipt' },
                      { key: 'utilityBill', label: 'Utility Bill' },
                    ].map((doc) => (
                      <div
                        key={doc.key}
                        className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-300">
                          {doc.label}
                        </span>
                        {uploadedDocs[doc.key as DocKey] ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-xs text-white">
                            Not Uploaded
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { key: 'rentAgreement', label: 'Rent Agreement' },
                      { key: 'noc', label: 'NOC from Owner' },
                      { key: 'addressProof', label: 'Address Proof' },
                      { key: 'geoTaggedPhoto', label: 'Geo-Tagged Photo' },
                    ].map((doc) => (
                      <div
                        key={doc.key}
                        className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-300">
                          {doc.label}
                        </span>
                        {uploadedDocs[doc.key as DocKey] ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-xs text-white">
                            Not Uploaded
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            {/* Signatory Details */}
            {includeSignatoryDetails && (
              <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-sky-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Authorized Signatory Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Full Name
                    </p>
                    <p className="text-white font-medium mt-1">
                      {signatoryFirstName} {signatoryMiddleName}{' '}
                      {signatoryLastName}
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Father's Name
                    </p>
                    <p className="text-white font-medium mt-1">
                      {signatoryFatherFirstName} {signatoryFatherMiddleName}{' '}
                      {signatoryFatherLastName}
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Mobile Number
                    </p>
                    <p className="text-white font-medium mt-1">
                      +91 {signatoryMobile}
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Email Address
                    </p>
                    <p className="text-white font-medium mt-1">
                      {signatoryEmail}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700/30">
                  <p className="text-xs text-slate-400 mb-2">
                    Signatory Documents:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'signPan', label: 'PAN Card' },
                      { key: 'signAadhaar', label: 'Aadhaar Card' },
                      { key: 'signPhoto', label: 'Photo' },
                      { key: 'signAuthLetter', label: 'Authorization Letter' },
                    ].map((doc) => (
                      <div
                        key={doc.key}
                        className="bg-slate-900/50 rounded-lg p-2 flex items-center justify-between"
                      >
                        <span className="text-xs text-slate-300">
                          {doc.label}
                        </span>
                        {uploadedDocs[doc.key as DocKey] ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            ✅
                          </span>
                        ) : (
                          <span className="text-[10px] text-white">❌</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
          <div className="sticky bottom-0 bg-black/95 backdrop-blur border-t border-slate-800 p-6 flex justify-end gap-3 z-10">
            <button
              onClick={() => setShowPreview(false)}
              className="px-6 py-3 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setShowPreview(false);
                setCurrentStep(6);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-6 py-3 bg-gradient-primary text-white rounded-lg hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 transition-colors font-medium"
            >
              Edit Application
            </button>
            <button
              onClick={initiateSubmission}
              disabled={isSubmitting}
              className={`px-8 py-3 rounded-lg font-semibold ${isSubmitting
                ? 'bg-slate-600 text-white cursor-not-allowed'
                : 'bg-emerald-500 text-white hover:bg-emerald-400'
                }`}
            >
              {isSubmitting ? 'Processing...' : 'SUBMIT APPLICATION'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
        Director / Promoter Details
      </legend>
      <FormInput
        label="Full Name"
        name="promoterName"
        value={formData.promoterName}
        onChange={handleChange}
        onBlur={handleBlur}
        error={errors.promoterName}
        placeholder="e.g., Rajesh Kumar"
        required
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="mb-5">
          <label className="block text-sm font-medium text-white mb-2">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="promoterDob"
            value={formData.promoterDob}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full bg-slate-900/40 border text-white text-sm rounded-lg block p-3 ${errors.promoterDob
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-700'
              }`}
            required
            style={{ colorScheme: 'dark' }}
          />
          {errors.promoterDob && (
            <p className="mt-1.5 text-xs text-red-400 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {errors.promoterDob}
            </p>
          )}
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-white mb-2">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div className="flex">
            <div className="flex items-center justify-center px-4 bg-slate-700/50 border border-r-0 border-slate-700 rounded-l-lg text-white text-sm font-medium min-w-[80px]">
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
              required
              className={`w-full bg-slate-900/40 border text-white text-sm rounded-r-lg block p-3 ${errors.promoterMobile
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-700'
                }`}
            />
          </div>
          {errors.promoterMobile && (
            <p className="mt-1.5 text-xs text-red-400 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {errors.promoterMobile}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput
          type="email"
          label="Email Address"
          name="promoterEmail"
          value={formData.promoterEmail}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.promoterEmail}
          placeholder="you@example.com"
          required
        />
        <FormInput
          label="Aadhaar Number"
          name="promoterAadhaar"
          value={formData.promoterAadhaar}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.promoterAadhaar}
          placeholder="123456789012"
          maxLength={12}
          required
        />
      </div>
    </fieldset>
  );

  const renderStep3 = () => (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
        Principal Place of Business
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput
          label="Flat/Door/Block Number"
          name="flatNumber"
          value={formData.flatNumber}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.flatNumber}
          placeholder="e.g., A-101"
          required
        />
        <FormInput
          label="Road/Street/Lane"
          name="roadStreet"
          value={formData.roadStreet}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.roadStreet}
          placeholder="e.g., MG Road"
          required
        />
        <FormInput
          label="Village/Town/City"
          name="areaLocality"
          value={formData.areaLocality}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.areaLocality}
          placeholder="e.g., Andheri West"
          required
        />
        <SelectInput
          label="Select State"
          name="state"
          value={formData.state}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.state}
          options={INDIAN_STATES}
          required
        />
        <SelectInput
          label="District"
          name="district"
          value={formData.district}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.district}
          options={availableDistricts}
          required
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
        />


      </div>
    </fieldset>
  );

  const renderStep4 = () => (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
        Nature of Business
      </legend>
      <div className="pt-0.5">
        <h4 className="text-sm font-semibold text-sky-400 mb-2">
          Select applicable activity <span className="text-red-500">*</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NATURE_OPTIONS.map((item) => (
            <label
              key={item}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="radio"
                name="natureOfBusiness"
                value={item}
                checked={formData.natureOfBusiness === item}
                onChange={handleChange}
                onBlur={() => {
                  setTouched((p) => ({ ...p, natureOfBusiness: true }));
                  setErrors((p) => ({
                    ...p,
                    natureOfBusiness: validateField(
                      'natureOfBusiness',
                      formData.natureOfBusiness
                    ),
                  }));
                }}
                className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500"
              />
              <span className="text-slate-300">{item}</span>
            </label>
          ))}
        </div>
        {errors.natureOfBusiness && (
          <p className="mt-3 text-xs text-red-400 flex items-center">
            <svg
              className="w-3 h-3 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {errors.natureOfBusiness}
          </p>
        )}
      </div>
    </fieldset>
  );

  const renderStep5 = () => (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
        Documents Upload (Page {docSubStep}/5)
      </legend>
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${step <= docSubStep ? 'bg-gradient-primary' : 'bg-slate-700'
              }`}
          />
        ))}
      </div>
      {docSubStep === 1 && (
        <div className="space-y-6 animate-fade-in">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
            Corporate Identity
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FileUploader
              label="PAN of the Company"
              name="companyPan"
              onChange={handleFileUpload('companyPan')}
              required
              value={uploadedDocs.companyPan}
              fileName={docFileNames.companyPan}
              hint="PAN Card of the Company"
              error={errors.companyPan}
            />
            <FileUploader
              label="Certificate of Incorporation (COI)"
              name="companyCoi"
              onChange={handleFileUpload('companyCoi')}
              required
              value={uploadedDocs.companyCoi}
              fileName={docFileNames.companyCoi}
              hint="Issued by MCA"
              error={errors.companyCoi}
            />
            <FileUploader
              label="Memorandum of Association (MOA)"
              name="companyMoa"
              onChange={handleFileUpload('companyMoa')}
              required
              value={uploadedDocs.companyMoa}
              fileName={docFileNames.companyMoa}
              hint="Signed MOA"
              error={errors.companyMoa}
            />
            <FileUploader
              label="Articles of Association (AOA)"
              name="companyAoa"
              onChange={handleFileUpload('companyAoa')}
              required
              value={uploadedDocs.companyAoa}
              fileName={docFileNames.companyAoa}
              hint="Signed AOA"
              error={errors.companyAoa}
            />
          </div>
        </div>
      )}
      {docSubStep === 2 && (
        <div className="space-y-6 animate-fade-in">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
            Directors / Promoters
          </h4>
          <p className="text-xs text-slate-300 mb-4">
            Add details for all applicable persons. One must be marked as
            Primary.
            <span className="text-sky-400 font-bold">
              {' '}
              Minimum 2 Directors required for Pvt Ltd.
            </span>
          </p>
          {errors['primary-director'] && (
            <p className="text-xs text-red-400 flex items-center mb-4">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {errors['primary-director']}
            </p>
          )}
          {directors.map((director, index) => (
            <div
              key={director.id}
              className="bg-slate-900/40 border border-slate-700 rounded-xl p-5 relative"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-700/50 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold border border-cyan-500/30">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-white">
                    Personal Details
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <div className="w-full sm:w-48">
                    <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                      Position
                    </label>
                    <select
                      className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg p-2"
                      value={director.designation}
                      onChange={(e) =>
                        handleDirectorChange(
                          director.id,
                          'designation',
                          e.target.value
                        )
                      }
                    >
                      {DESIGNATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {errors[`director-${director.id}-designation`] && (
                      <p className="text-[10px] text-red-400 mt-1">
                        {errors[`director-${director.id}-designation`]}
                      </p>
                    )}
                  </div>
                  {directors.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeDirector(director.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="mb-8 flex items-center gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                <input
                  type="radio"
                  id={`primary-${director.id}`}
                  name="primaryDirector"
                  checked={director.isPrimary}
                  onChange={() => handlePrimaryChange(director.id)}
                  className="w-5 h-5 text-sky-500"
                />
                <label
                  htmlFor={`primary-${director.id}`}
                  className="text-sm font-medium text-sky-400 cursor-pointer"
                >
                  Mark as <strong>Primary</strong> Director
                </label>
                {director.isPrimary && (
                  <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              <div className="space-y-6 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-3">
                    Director Name
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormInput
                      label="First Name"
                      value={director.firstName || ''}
                      onChange={(e) =>
                        handleDirectorChange(
                          director.id,
                          'firstName',
                          e.target.value
                        )
                      }
                      placeholder="e.g. Rajesh"
                      required
                      error={errors[`director-${director.id}-firstName`]}
                    />
                    <FormInput
                      label="Middle Name"
                      value={director.middleName || ''}
                      onChange={(e) =>
                        handleDirectorChange(
                          director.id,
                          'middleName',
                          e.target.value
                        )
                      }
                      placeholder="Optional"
                    />
                    <FormInput
                      label="Last Name"
                      value={director.lastName || ''}
                      onChange={(e) =>
                        handleDirectorChange(
                          director.id,
                          'lastName',
                          e.target.value
                        )
                      }
                      placeholder="e.g. Sharma"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-3">
                    Father's Name
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormInput
                      label="First Name"
                      value={director.fatherName?.firstName || ''}
                      onChange={(e) =>
                        handleDirectorChange(director.id, 'fatherName', {
                          ...director.fatherName,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="e.g. Suresh"
                      required
                      error={errors[`director-${director.id}-fatherFirstName`]}
                    />
                    <FormInput
                      label="Middle Name"
                      value={director.fatherName?.middleName || ''}
                      onChange={(e) =>
                        handleDirectorChange(director.id, 'fatherName', {
                          ...director.fatherName,
                          middleName: e.target.value,
                        })
                      }
                      placeholder="Optional"
                    />
                    <FormInput
                      label="Last Name"
                      value={director.fatherName?.lastName || ''}
                      onChange={(e) =>
                        handleDirectorChange(director.id, 'fatherName', {
                          ...director.fatherName,
                          lastName: e.target.value,
                        })
                      }
                      placeholder="e.g. Sharma"
                    />
                  </div>
                </div>
              </div>
              <div className="mb-6 bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-300 mb-1">
                      Mobile (Aadhaar Linked)
                    </label>
                    <div className="flex">
                      <div className="flex items-center justify-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-white text-xs font-medium min-w-[50px]">
                        +91
                      </div>
                      <input
                        type="tel"
                        value={director.mobile}
                        onChange={(e) =>
                          handleDirectorChange(
                            director.id,
                            'mobile',
                            e.target.value.replace(/\D/g, '').slice(0, 10)
                          )
                        }
                        placeholder="mobile number"
                        className={`w-full bg-slate-800 border text-white text-sm rounded-r-lg p-2.5 focus:ring-2 focus:ring-cyan-500 ${errors[`director-${director.id}-mobile`]
                          ? 'border-red-500'
                          : 'border-slate-600'
                          }`}
                        maxLength={10}
                        required
                      />
                    </div>
                    {errors[`director-${director.id}-mobile`] && (
                      <p className="text-[10px] text-red-400 mt-1">
                        {errors[`director-${director.id}-mobile`]}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-300 mb-1">
                      Email ID
                    </label>
                    <input
                      type="email"
                      value={director.email}
                      onChange={(e) =>
                        handleDirectorChange(
                          director.id,
                          'email',
                          e.target.value
                        )
                      }
                      placeholder="email@example.com"
                      className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-cyan-500 ${errors[`director-${director.id}-email`]
                        ? 'border-red-500'
                        : 'border-slate-600'
                        }`}
                      required
                    />
                    {errors[`director-${director.id}-email`] && (
                      <p className="text-[10px] text-red-400 mt-1">
                        {errors[`director-${director.id}-email`]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FileUploader
                  label="PAN Card"
                  name={`pan-${director.id}`}
                  onChange={handleDirectorFileUpload(director.id, 'panFile')}
                  required
                  value={director.panFile}
                  fileName={directorFileNames[director.id]?.pan || null}
                  hint="Clear scan of PAN"
                  error={errors[`director-${director.id}-pan`]}
                />
                <FileUploader
                  label="Aadhaar Card"
                  name={`aadhaar-${director.id}`}
                  onChange={handleDirectorFileUpload(
                    director.id,
                    'aadhaarFile'
                  )}
                  required
                  value={director.aadhaarFile}
                  fileName={directorFileNames[director.id]?.aadhaar || null}
                  hint="Both sides scanned"
                  error={errors[`director-${director.id}-aadhaar`]}
                />
                <FileUploader
                  label="Passport size Photo"
                  name={`photo-${director.id}`}
                  onChange={handleDirectorFileUpload(director.id, 'photoFile')}
                  required
                  value={director.photoFile}
                  fileName={directorFileNames[director.id]?.photo || null}
                  hint="White background"
                  error={errors[`director-${director.id}-photo`]}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addDirector}
            className="w-full border-dashed border-slate-600 text-white hover:text-white hover:border-cyan-500 hover:bg-cyan-500/10 bg-transparent py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Another Director
          </button>
        </div>
      )}
      {docSubStep === 3 && (
        <div className="space-y-6 animate-fade-in">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
            Registered Office Address Proof
          </h4>
          <div className="mb-6">
            <label className="block text-sm font-medium text-white mb-2">
              Property Type
            </label>
            <select
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-3"
              value={propertyType}
              onChange={(e) =>
                setPropertyType(e.target.value as 'owned' | 'rented')
              }
            >
              <option value="owned">Owned Property</option>
              <option value="rented">Rented / Leased Property</option>
            </select>
          </div>

          {/* Specific Docs based on Property Type */}
          {propertyType === 'owned' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUploader
                label="Electricity Bill *"
                name="elecBill"
                onChange={handleFileUpload('elecBill')}
                required
                value={uploadedDocs.elecBill}
                fileName={docFileNames.elecBill}
                error={errors.elecBill}
              />
              <FileUploader
                label="Property Tax Receipt *"
                name="taxReceipt"
                onChange={handleFileUpload('taxReceipt')}
                required
                value={uploadedDocs.taxReceipt}
                fileName={docFileNames.taxReceipt}
                error={errors.taxReceipt}
              />
              <FileUploader
                label="Latest Utility Bill *"
                name="utilityBill"
                onChange={handleFileUpload('utilityBill')}
                required
                value={uploadedDocs.utilityBill}
                fileName={docFileNames.utilityBill}
                hint="If electricity bill is not available"
                error={errors.utilityBill}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploader
                  label="Rental / Lease Agreement"
                  name="rentAgreement"
                  onChange={handleFileUpload('rentAgreement')}
                  required
                  value={uploadedDocs.rentAgreement}
                  fileName={docFileNames.rentAgreement}
                  error={errors.rentAgreement}
                />
                <FileUploader
                  label="NOC from Owner"
                  name="noc"
                  onChange={handleFileUpload('noc')}
                  required
                  value={uploadedDocs.noc}
                  fileName={docFileNames.noc}
                  error={errors.noc}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploader
                  label="Electricity / Utility Bill of Property"
                  name="addressProof"
                  onChange={handleFileUpload('addressProof')}
                  required
                  value={uploadedDocs.addressProof}
                  fileName={docFileNames.addressProof}
                  error={errors.addressProof}
                />
              </div>
            </div>
          )}

          {/* 👇 GEO-TAGGED UPLOADER MOVED HERE (OUTSIDE THE IF/ELSE) */}
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Geo-Tagged Location Photo
            </h4>
            <GeoTaggedPhotoUploader
              label="Upload Geo-Tagged Business Location Photo *"
              name="geoTaggedPhoto"
              onChange={(file) => {
                setUploadedFiles((prev) => ({ ...prev, geoTaggedPhoto: file }));
                setUploadedDocs((prev) => ({ ...prev, geoTaggedPhoto: !!file }));
                setDocFileNames((prev) => ({ ...prev, geoTaggedPhoto: file ? file.name : undefined }));
                setErrors((prev) => ({ ...prev, geoTaggedPhoto: undefined }));
              }}
              required
              value={uploadedDocs.geoTaggedPhoto}
              fileName={docFileNames.geoTaggedPhoto}
              hint="Capture the front of your business premises with GPS enabled."
              error={errors.geoTaggedPhoto}
              onLocationCaptured={(coords) => setGeoCoords(coords)}
            />
            {!geoCoords && uploadedDocs.geoTaggedPhoto && (
              <p className="mt-1 text-[10px] text-amber-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                GPS coordinates not captured. Please click "Capture GPS Coordinates".
              </p>
            )}
          </div>
        </div>
      )}
      {docSubStep === 4 && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-700 pb-2">
              Authorized Signatory Details
            </h4>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white cursor-pointer">
                Include Signatory Details
              </label>
              <button
                type="button"
                onClick={() => {
                  setIncludeSignatoryDetails(!includeSignatoryDetails);
                  if (includeSignatoryDetails) {
                    setErrors((prev) => ({
                      ...prev,
                      signatoryFirstName: undefined,
                      signatoryLastName: undefined,
                      signatoryMobile: undefined,
                      signatoryEmail: undefined,
                      signatoryFatherFirstName: undefined,
                      signatoryFatherLastName: undefined,
                    }));
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${includeSignatoryDetails ? 'bg-gradient-primary' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${includeSignatoryDetails ? 'left-7' : 'left-1'
                    }`}
                />
              </button>
              <span
                className={`text-xs ${includeSignatoryDetails ? 'text-sky-400' : 'text-white'
                  }`}
              >
                {includeSignatoryDetails ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
          {includeSignatoryDetails ? (
            <>
              <div className="space-y-6 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-3">
                    Signatory Name
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormInput
                      label="First Name"
                      placeholder="e.g. Rajesh"
                      required
                      value={signatoryFirstName}
                      onChange={(e) => {
                        setSignatoryFirstName(e.target.value);
                        if (errors.signatoryFirstName)
                          setErrors((prev) => ({
                            ...prev,
                            signatoryFirstName: undefined,
                          }));
                      }}
                      error={errors.signatoryFirstName}
                    />
                    <FormInput
                      label="Middle Name"
                      placeholder="Optional"
                      value={signatoryMiddleName}
                      onChange={(e) => setSignatoryMiddleName(e.target.value)}
                    />
                    <FormInput
                      label="Last Name"
                      placeholder="e.g. Sharma"
                      value={signatoryLastName}
                      onChange={(e) => {
                        setSignatoryLastName(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-3">
                    Father's Name
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormInput
                      label="First Name"
                      placeholder="e.g. Suresh"
                      required
                      value={signatoryFatherFirstName}
                      onChange={(e) => {
                        setSignatoryFatherFirstName(e.target.value);
                        if (errors.signatoryFatherFirstName)
                          setErrors((prev) => ({
                            ...prev,
                            signatoryFatherFirstName: undefined,
                          }));
                      }}
                      error={errors.signatoryFatherFirstName}
                    />
                    <FormInput
                      label="Middle Name"
                      placeholder="Optional"
                      value={signatoryFatherMiddleName}
                      onChange={(e) =>
                        setSignatoryFatherMiddleName(e.target.value)
                      }
                    />
                    <FormInput
                      label="Last Name"
                      placeholder="e.g. Sharma"
                      value={signatoryFatherLastName}
                      onChange={(e) => {
                        setSignatoryFatherLastName(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mb-6 bg-slate-900/30 p-4 rounded-lg border border-slate-700/50">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-300 mb-1">
                      Mobile (Aadhaar Linked)
                    </label>
                    <div className="flex">
                      <div className="flex items-center justify-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-white text-xs font-medium min-w-[50px]">
                        +91
                      </div>
                      <input
                        type="tel"
                        placeholder="mobile number"
                        value={signatoryMobile}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 10);
                          setSignatoryMobile(value);
                          if (errors.signatoryMobile)
                            setErrors((prev) => ({
                              ...prev,
                              signatoryMobile: undefined,
                            }));
                        }}
                        className={`w-full bg-slate-800 border text-white text-sm rounded-r-lg p-2.5 focus:ring-2 focus:ring-sky-500 ${errors.signatoryMobile
                          ? 'border-red-500'
                          : 'border-slate-600'
                          }`}
                        maxLength={10}
                      />
                    </div>
                    {errors.signatoryMobile && (
                      <p className="text-[10px] text-red-400 mt-1">
                        {errors.signatoryMobile}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-300 mb-1">
                      Email ID
                    </label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={signatoryEmail}
                      onChange={(e) => {
                        setSignatoryEmail(e.target.value);
                        if (errors.signatoryEmail)
                          setErrors((prev) => ({
                            ...prev,
                            signatoryEmail: undefined,
                          }));
                      }}
                      className={`w-full bg-slate-800 border text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 ${errors.signatoryEmail
                        ? 'border-red-500'
                        : 'border-slate-600'
                        }`}
                    />
                    {errors.signatoryEmail && (
                      <p className="text-[10px] text-red-400 mt-1">
                        {errors.signatoryEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploader
                  label="PAN Card"
                  name="signPan"
                  onChange={handleFileUpload('signPan')}
                  required
                  value={uploadedDocs.signPan}
                  fileName={docFileNames.signPan}
                  error={errors.signPan}
                />
                <FileUploader
                  label="Aadhaar Card"
                  name="signAadhaar"
                  onChange={handleFileUpload('signAadhaar')}
                  required
                  value={uploadedDocs.signAadhaar}
                  fileName={docFileNames.signAadhaar}
                  error={errors.signAadhaar}
                />
                <FileUploader
                  label="Passport size Photo"
                  name="signPhoto"
                  onChange={handleFileUpload('signPhoto')}
                  required
                  value={uploadedDocs.signPhoto}
                  fileName={docFileNames.signPhoto}
                  error={errors.signPhoto}
                />
                <FileUploader
                  label="Authorization Letter from Director"
                  name="signAuthLetter"
                  onChange={handleFileUpload('signAuthLetter')}
                  required
                  value={uploadedDocs.signAuthLetter}
                  fileName={docFileNames.signAuthLetter}
                  hint="Signed authorization letter"
                  error={errors.signAuthLetter}
                />
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 rounded-lg border border-slate-700/50">
              <svg
                className="w-16 h-16 text-slate-200 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-white text-sm">
                Signatory details are optional
              </p>
              <p className="text-white text-xs mt-1">
                Toggle the switch above to add authorized signatory information
              </p>
            </div>
          )}
        </div>
      )}
      {docSubStep === 5 && (
        <div className="space-y-6 animate-fade-in">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
            Digital Signature Certificate (DSC)
          </h4>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5">
            <h5 className="text-sky-400 font-semibold mb-3 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              What is DSC?
            </h5>
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                <strong className="text-white">
                  Digital Signature Certificate (DSC)
                </strong>{' '}
                is a secure digital key that certifies the identity of the
                holder.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Used to sign documents electronically</li>
                <li>Ensures authenticity and integrity of documents</li>
                <li>Required for GST registration filing</li>
                <li>Must be valid and not expired</li>
              </ul>
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/50">
            <h5 className="text-white font-semibold mb-4">Upload Your DSC</h5>
            <FileUploader
              label="Digital Signature Certificate (DSC)"
              name="dsc"
              accept=".pfx,.p12"
              onChange={handleFileUpload('dsc')}
              required
              value={uploadedDocs.dsc}
              fileName={docFileNames.dsc}
              hint="Upload your DSC file in .pfx or .p12 format"
              error={errors.dsc}
            />
            {uploadedDocs.dsc && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-400">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    DSC uploaded successfully
                  </span>
                </div>
                <p className="text-xs text-white mt-1">{docFileNames.dsc}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );

  const renderStep6 = () => (
    <fieldset className="space-y-6">
      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6">
        Declaration & Consent
      </legend>
      <div className="space-y-4">
        <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              id="consent1"
              name="consent1"
              checked={formData.consent1}
              onChange={handleChange}
              onBlur={handleBlur}
              className="mt-1 w-5 h-5 text-emerald-500 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
            <div className="flex-1">
              <label
                htmlFor="consent1"
                className="text-sm text-slate-300 cursor-pointer leading-relaxed block"
              >
                I authorize RegiBIZ to file my GST registration application on my behalf.
              </label>
              {errors.consent1 && (
                <span className="text-red-400 mt-2 text-sm font-medium flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.consent1}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              id="consent2"
              name="consent2"
              checked={formData.consent2}
              onChange={handleChange}
              onBlur={handleBlur}
              className="mt-1 w-5 h-5 text-emerald-500 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
            <div className="flex-1">
              <label
                htmlFor="consent2"
                className="text-sm text-slate-300 cursor-pointer leading-relaxed block"
              >
                I hereby declare that the details furnished above are true and
                correct to the best of my knowledge and belief and I undertake to
                inform you of any changes therein, immediately. In case any of
                the above information is found to be false or untrue or
                misleading or misrepresenting, I am aware that I may be held
                liable for it.
              </label>
              {errors.consent2 && (
                <span className="text-red-400 mt-2 text-sm font-medium flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.consent2}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={handlePrevious}
          className="px-6 py-3 rounded-lg font-medium border border-slate-600 bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 transition-all"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={initiateSubmission}
          disabled={isSubmitting}
          className={`px-8 py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center ${isSubmitting
            ? 'bg-slate-600 text-white cursor-not-allowed'
            : 'bg-emerald-500 text-white hover:bg-emerald-400'
            }`}
        >
          {isSubmitting ? 'Processing...' : 'SUBMIT APPLICATION'}
        </button>
      </div>
    </fieldset>
  );

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
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

      {isSubmitting && <ProcessingOverlay />}
      {confirmConfig?.show && (
        <CustomConfirm
          message={confirmConfig.message}
          onConfirm={() => {
            setConfirmConfig(null);
            if (confirmConfig.onConfirm) confirmConfig.onConfirm();
          }}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
      <div className="max-w-[1600px] mx-auto">
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            GST Registration - Private Limited
          </h1>
          <p className="text-sky-200/80 text-sm">Step {currentStep - 1} of 5</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
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
                <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
                  GST Registration
                </h1>
                <p className="text-slate-300 text-base max-w-lg leading-relaxed mt-1 mx-auto">
                  {currentStep === 2 &&
                    'Provide details of the Authorized Signatory.'}
                  {currentStep === 3 &&
                    'Enter principal place of business address.'}
                  {currentStep === 4 &&
                    'Select nature of business activities.'}
                  {currentStep === 5 &&
                    `Upload Documents (Page ${docSubStep}/5)`}
                  {currentStep === 6 && 'Review and provide consent.'}
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
                </div>
                {currentStep !== 6 && (
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
                        className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 flex items-center justify-center disabled:opacity-50"
                      >
                        {isDraftSaving ? 'Saving...' : (currentStep === 5 && docSubStep < 5 ? `Save & Next Page (${docSubStep}/5)` : 'Save & Next')}
                        <svg
                          className="w-5 h-5 ml-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </main>
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8 hidden lg:block">
            <Sidebar
              currentStep={currentStep}
              uploadedDocCount={getUploadedDocCount()}
              totalRequiredDocs={getTotalRequiredDocs()}
              onStepClick={(step) => {
                if (step < currentStep) {
                  setCurrentStep(step);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              onPreviewClick={() => setShowPreview(true)}
            />
          </aside>
        </div>
        <div className="mt-12 text-center text-white text-sm pb-8">
          &copy; 2026 RegiBIZ. All rights reserved.
        </div>
      </div>
      {showPreview && <PreviewModal />}
    </div>
  );
}
