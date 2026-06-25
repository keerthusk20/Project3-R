// src/services/gst/gst-partnership-form.tsx
import React, { useState, useEffect, useRef, ChangeEvent, FocusEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, runTransaction, deleteDoc } from 'firebase/firestore';
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
  fatherName?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  mobile: string;
  email: string;
  panNumber?: string;
  aadhaarNumber?: string;
  panFile: boolean;
  aadhaarFile: boolean;
  photoFile: boolean;
  sharePercentage?: string;
}
interface FormData {
  firmName: string;
  firmPanNumber: string;
  partnershipDeedDate: string;
  numberOfPartners: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  natureOfBusiness: string;
  consent1: boolean;
  consent2: boolean;
}
type DocKey =
  | 'cancelledCheque'
  | 'bankStatement'
  | 'partnershipDeed'
  | 'firmPan'
  | 'rentAgreement'
  | 'noc'
  | 'addressProof'
  | 'elecBill'
  | 'taxReceipt'
  | 'utilityBill'
  | 'dsc'
  | 'signPan'
  | 'signAadhaar'
  | 'signPhoto'
  | 'signAuthLetter'
  | 'partnerPan'
  | 'partnerAadhaar'
  | 'partnerPhoto';
type UploadedFilesState = Record<DocKey, File | null>;
interface PartnershipFormProps {
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
  isPanField?: boolean;
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
  firmName: '',
  firmPanNumber: '',
  partnershipDeedDate: '',
  numberOfPartners: '2',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  natureOfBusiness: '',
  consent1: false,
  consent2: false,
};
const INITIAL_PARTNERS: Partner[] = [
  {
    id: '1',
    designation: 'Partner',
    isPrimary: true,
    firstName: '',
    middleName: '',
    lastName: '',
    fatherName: { firstName: '', middleName: '', lastName: '' },
    mobile: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    panFile: false,
    aadhaarFile: false,
    photoFile: false,
    sharePercentage: '50',
  },
  {
    id: '2',
    designation: 'Partner',
    isPrimary: false,
    firstName: '',
    middleName: '',
    lastName: '',
    fatherName: { firstName: '', middleName: '', lastName: '' },
    mobile: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    panFile: false,
    aadhaarFile: false,
    photoFile: false,
    sharePercentage: '50',
  },
];
const INITIAL_UPLOADED_DOCS: Record<DocKey, boolean> = {
  cancelledCheque: false,
  bankStatement: false,
  partnershipDeed: false,
  firmPan: false,
  rentAgreement: false,
  noc: false,
  addressProof: false,
  elecBill: false,
  taxReceipt: false,
  utilityBill: false,
  dsc: false,
  signPan: false,
  signAadhaar: false,
  signPhoto: false,
  signAuthLetter: false,
  partnerPan: false,
  partnerAadhaar: false,
  partnerPhoto: false,
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
const DESIGNATION_OPTIONS = [
  { value: 'Partner', label: 'Partner' },
  { value: 'Managing Partner', label: 'Managing Partner' },
  { value: 'Authorized Signatory', label: 'Authorized Signatory' },
];
// ============================================================================
// LOCALSTORAGE HELPER FUNCTIONS
// ============================================================================
const STORAGE_KEYS = {
  FORM_DATA: 'gstPartnershipFormData',
  CURRENT_STEP: 'gstPartnershipCurrentStep',
  UPLOADED_DOCS: 'gstPartnershipUploadedDocs',
  DOC_SUB_STEP: 'gstPartnershipDocSubStep',
  DOC_FILE_NAMES: 'gstPartnershipDocFileNames',
  PARTNER_FILE_NAMES: 'gstPartnershipPartnerFileNames',
  PROPERTY_TYPE: 'gstPartnershipPropertyType',
  SIGNATORY: 'gstPartnershipSignatory',
  PARTNERS: 'gstPartnershipPartners',
  UPLOADED_FILES: 'gstPartnershipUploadedFiles',
  CASE_ID: 'gstPartnershipCaseId',
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
/**
* Generate Sequential Form ID for Partnership
*/
const generateSequentialFormId = async (
  prefix: string = 'GST-PART',
  year: number
): Promise<string> => {
  const counterId = `${prefix.toLowerCase().replace(/\s+/g, '_')}_${year}`;
  const counterRef = doc(db, 'counters', counterId);
  console.log(`🔍 Checking counter for: ${counterId}`);
  try {
    let newCount = 0;
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists()) {
        console.log(`✨ Creating new counter for ${counterId} starting at 1`);
        transaction.set(counterRef, {
          count: 1,
          year,
          prefix,
          createdAt: serverTimestamp(),
        });
        newCount = 1;
      } else {
        const currentCount = counterDoc.data()?.count || 0;
        newCount = currentCount + 1;
        console.log(`⬆️ Incrementing counter ${counterId} from ${currentCount} to ${newCount}`);
        transaction.update(counterRef, { count: newCount });
      }
    });
    const formattedCount = String(newCount).padStart(2, '0');
    const finalId = `${prefix}-${year}-${formattedCount}`;
    console.log(`✅ Generated Case ID: ${finalId}`);
    return finalId;
  } catch (err: any) {
    console.error('❌ Failed to generate sequential ID:', err);
    const timestampPart = Date.now().toString().slice(-4);
    const fallbackId = `${prefix}-${year}-F${timestampPart}`;
    console.warn(`⚠️ Using fallback ID due to error: ${fallbackId}`);
    return fallbackId;
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
const getFullName = (first: string, middle: string, last: string): string => {
  return [first, middle, last].filter(Boolean).join(' ') || 'N/A';
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
  email: (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email address',
  mobile: (value: string) =>
    /^[6-9]\d{9}$/.test(value) || 'Invalid 10-digit mobile number (must start with 6-9)',
  pan: (value: string) =>
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) || 'Invalid PAN format (ABCDE1234F)',
  consent: (value: boolean) => value === true || 'Declaration is required',
  pincode: (value: string) => /^\d{6}$/.test(value) || 'Pincode must be exactly 6 digits',
  partnershipDeedDate: (value: string) => {
    if (!value) return 'Partnership Deed Date is required';
    return true;
  },
  firmPan: (value: string) =>
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) || 'Invalid Firm PAN format',
  sharePercentage: (value: string) => {
    const num = parseInt(value);
    return (num >= 0 && num <= 100) || 'Share percentage must be between 0 and 100';
  },
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
  placeholder,
  isPanField,
  ...props
}) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  // UPDATED: Focus ring uses the Teal/Cyan Gradient logic via ring color
  const baseClasses =
    'w-full bg-slate-900/40 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none';
  const errorClasses = error
    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600';
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        {/* UPDATED: Label turns into Red-Orange Gradient when focused */}
        <div className="flex items-center">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-white transition-all duration-300 group-focus-within:text-cyan-400"
          >
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
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        required={required}
        placeholder={placeholder}
        {...props}
        style={isPanField ? { textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' } : undefined}
        onInput={isPanField ? (e) => {
          const target = e.target as HTMLInputElement;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
          target.setSelectionRange(start, end);
        } : undefined}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-white font-mono">
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
    'w-full bg-slate-800 border text-white text-sm rounded-lg block p-3 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none appearance-none';
  const errorClasses = error
    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600';
  return (
    <div className="mb-5 group">
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
        setUploadError(`File size exceeds 1MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }
      const allowedTypes = ['image/jpeg', 'application/pdf', 'application/x-pkcs12'];
      const allowedExtensions = ['.jpg', '.jpeg', '.pdf', '.pfx', '.p12'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setUploadError('Only JPEG images, PDF files, and PFX/P12 files are allowed.');
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
        {optional && <span className="text-xs text-white font-medium">Optional</span>}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-white">📎</span>
        <span className="text-[10px] text-white font-medium">Max 1MB • JPEG, PDF, PFX, P12 only</span>
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
        <input type="file" ref={fileInputRef} name={name} accept={accept} className="hidden" onChange={handleFileChange} />
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
                <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">Click to upload</p>
                <p className="text-[10px] text-white mt-0.5">JPEG, PDF, PFX or P12 (max 1MB)</p>
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
                setUploadError(null);
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
        <p className="mt-2 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {displayError}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// NEW GEO-TAGGED FILE UPLOADER COMPONENT
// ============================================================================
const GeoTaggedFileUploader: React.FC<FileUploaderProps & {
  onLocationCapture?: (location: { lat: number; lng: number } | null) => void;
}> = ({
  label,
  name,
  accept = '.jpg,.jpeg,.png,.webp',
  onChange,
  required,
  hint,
  optional,
  value,
  fileName: externalFileName,
  error,
  onLocationCapture,
}) => {
    const [fileName, setFileName] = useState<string | null>(externalFileName || null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'captured' | 'failed'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (externalFileName) setFileName(externalFileName);
      else if (value === false) setFileName(null);
    }, [externalFileName, value]);

    const captureLocation = () => {
      setLocationStatus('fetching');
      if (!navigator.geolocation) {
        setLocationStatus('failed');
        onLocationCapture?.(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStatus('captured');
          onLocationCapture?.({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setLocationStatus('failed');
          onLocationCapture?.(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    const processFile = (file: File | null) => {
      setUploadError(null);
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          setUploadError(`File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
          return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
          setUploadError('Only JPEG, PNG, or WEBP images are allowed.');
          return;
        }
        setFileName(file.name);
        captureLocation();
        onChange(file);
      } else {
        setFileName(null);
        setLocationStatus('idle');
        onChange(null);
      }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      processFile(file);
    };

    const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
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
          {optional && <span className="text-xs text-white font-medium">Optional</span>}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-white">📎</span>
          <span className="text-[10px] text-white font-medium">Max 5MB • JPEG, PNG, WEBP only</span>
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
          <input type="file" ref={fileInputRef} name={name} accept={accept} className="hidden" onChange={handleFileChange} />

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg shrink-0 transition-colors ${fileName
              ? 'bg-emerald-500/20 text-emerald-400'
              : displayError
                ? 'bg-red-500/20 text-red-400'
                : 'bg-slate-700/50 text-white group-hover:text-cyan-400'
              }`}>
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
                  <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">Click or drag photo</p>
                  <p className="text-[10px] text-white mt-0.5">Clear photo of business premises / board</p>
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
                  setLocationStatus('idle');
                  setUploadError(null);
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

        {/* Location Status Indicator */}
        {fileName && (
          <div className="mt-2 flex items-center gap-2">
            {locationStatus === 'fetching' && (
              <span className="text-[10px] text-cyan-400 flex items-center gap-1 animate-pulse">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Capturing location...
              </span>
            )}
            {locationStatus === 'captured' && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Geo-tagged successfully
              </span>
            )}
            {locationStatus === 'failed' && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Location access denied
              </span>
            )}
          </div>
        )}

        {displayError && (
          <p className="mt-2 text-xs text-red-400 flex items-center animate-pulse">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {displayError}
          </p>
        )}
      </div>
    );
  };

const DocumentRow = ({
  label,
  uploaded,
  fileName,
}: {
  label: string;
  uploaded: boolean;
  fileName?: string;
}) => (
  <div className="flex items-center justify-between p-4 hover:bg-slate-900/40 transition-colors">
    <div className="flex-1">
      <p className="text-sm text-slate-300 font-medium">{label}</p>
      {fileName && <p className="text-xs text-white mt-0.5 truncate max-w-xs">{fileName}</p>}
    </div>
    <div className="flex items-center gap-2">
      {uploaded ? (
        <>
          <span className="text-xs text-emerald-400 font-medium">Uploaded</span>
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </>
      ) : (
        <>
          <span className="text-xs text-white font-medium">Pending</span>
          <svg className="w-5 h-5 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </>
      )}
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
    { num: 2, label: 'Enterprise Details', sub: 'Firm & Partners' },
    { num: 3, label: 'Address Information', sub: 'Principal Place' },
    { num: 4, label: 'Business Activity', sub: 'Nature of Business' },
    { num: 5, label: 'Documents & Uploads', sub: `${uploadedDocCount}/${totalRequiredDocs} Uploaded` },
    { num: 6, label: 'Declaration', sub: 'Consent & Submit' },
  ];
  const requiredDocuments = [
    'Partnership Deed',
    'Firm PAN Card',
    'Partner KYC (PAN/Aadhaar)',
    'Address Proof (NOC/Rent)',
    'Bank Account Proof',
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
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-white text-sm font-semibold text-white">Progress Status</h3>
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
                      // UPDATED: Active Dot uses Teal/Blue Gradient
                      ? 'bg-gradient-primary ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                      : 'bg-slate-700 group-hover:bg-slate-600'
                    }`}></div>
                  <div className="flex-1">
                    {/* UPDATED: Active Step Title uses Red-Orange Gradient */}
                    <h4 className={`text-xs font-medium transition-colors duration-200 ${status === 'completed'
                      ? 'text-emerald-400'
                      : status === 'in-progress'
                        ? 'text-white font-bold'
                        : 'text-white group-hover:text-white'
                      }`}>
                      {step.label}
                    </h4>
                    <p className={`text-[10px] mt-0.5 ${status === 'completed'
                      ? 'text-emerald-400/80'
                      : status === 'in-progress'
                        ? 'text-cyan-400'
                        : 'text-slate-200'
                      }`}>
                      {status === 'completed'
                        ? 'Completed'
                        : status === 'in-progress'
                          ? 'In Progress'
                          : 'Pending'}
                    </p>
                    {step.num === 5 && (
                      <p className="text-[10px] text-cyan-400 mt-1">
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
          <h3 className="text-white text-sm font-semibold text-white">Required Documents</h3>
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
      {/* Preview Button - UPDATED with Teal/Blue Gradient */}
      <button
        onClick={onPreviewClick}
        className="w-full py-4 rounded-xl bg-gradient-primary border border-cyan-500/30 text-white font-bold tracking-wide shadow-lg hover:shadow-cyan-500/20 hover:brightness-110 transition-all duration-300 flex items-center justify-center gap-2"
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
// STATUS BANNER COMPONENT
// ============================================================================
const StatusBanner: React.FC<{ caseId: string }> = ({ caseId }) => (
  <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-white font-medium line-through text-lg">
          ₹999
        </span>
        {/* UPDATED: FREE text uses Red-Orange Gradient */}
        <span className="font-bold text-2xl tracking-tight drop-shadow-sm text-white">
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
    <div className="text-left sm:text-right z-10">
      <p className="text-xs font-semibold text-white uppercase tracking-wider">Case Reference</p>
      <p className="text-slate-100 font-mono font-bold text-lg tracking-wider">{caseId}</p>
    </div>
  </div>
);
// ============================================================================
// CUSTOM CONFIRM MODAL
// ============================================================================
const CustomConfirm: React.FC<CustomConfirmProps> = ({ message, onConfirm, onCancel }) => {
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
            <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
        </div>
        <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors duration-200">
            Cancel
          </button>
          {/* UPDATED: OK Button uses Teal/Blue Gradient */}
          <button onClick={onConfirm} className="px-6 py-2.5 bg-gradient-primary hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-cyan-900/20">
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
          <svg className="animate-spin w-full h-full text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
      <p className="text-white text-sm mb-1">Please wait while we submit your application.</p>
      <p className="text-white text-xs">Do not close this window.</p>
    </div>
  </div>
);
// ============================================================================
// MSME-STYLE PROGRESS STATUS COMPONENT
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
  const uploadedCount = requiredDocs.filter(doc => {
    if (!doc.isRequired) return false;
    return uploadedFiles[doc.key];
  }).length;
  const requiredCount = requiredDocs.filter(doc => doc.isRequired).length;
  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-all duration-300">
      <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
        <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a 2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </span>
        Progress Status
      </h3>
      <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
        {[2, 3, 4, 5, 6, 7, 8].map((step) => (
          <div key={step} className="ml-5 relative">
            <span
              className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${getStepStatus(step) === 'completed'
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : getStepStatus(step) === 'active'
                  // UPDATED: Active Dot uses Teal/Blue Gradient
                  ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                  : 'bg-slate-700'
                }`}
            ></span>
            {/* UPDATED: Active Step Title uses Red-Orange Gradient */}
            <h4
              className={`text-sm font-medium transition-colors ${getStepStatus(step) === 'active'
                ? 'text-white font-bold'
                : getStepStatus(step) === 'completed'
                  ? 'text-emerald-400'
                  : 'text-white'
                }`}
            >
              {step === 2 ? 'Enterprise Details' :
                step === 3 ? 'Financials & Activity' :
                  step === 4 ? 'Address Information' :
                    step === 5 ? 'Contact & Bank' :
                      step === 6 ? 'Partners Details' :
                        step === 7 ? 'Authorized Signatory' :
                          'Documents & Declaration'}
            </h4>
            <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
              {step === 8
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
// ============================================================================
// MSME-STYLE REQUIRED DOCUMENTS COMPONENT
// ============================================================================
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
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-slate-900/40 border border-slate-700/50'
                : 'bg-slate-800/20 border border-slate-700/30 opacity-60'
                }`}
            >
              <div className="flex items-center">
                <div className={`mr-3 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isUploaded && item.isRequired
                  ? 'bg-emerald-500 text-white'
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
                  ? isUploaded ? 'text-slate-100' : 'text-slate-300'
                  : 'text-white'
                  }`}>
                  {item.label}
                </span>
                {!item.isRequired && (
                  <span className="text-xs text-slate-200 ml-2">(Not Required)</span>
                )}
              </div>
              {isUploaded && item.isRequired && (
                <span className="text-xs font-bold text-emerald-400 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
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
// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function PartnershipForm({
  user,
  commonData,
  packageMode = false,
  onBack,
  onSubmit,
  INDIAN_STATES,
  STATE_DISTRICTS,
}: PartnershipFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [firebaseDocId, setFirebaseDocId] = useState<string>('');
  const [caseId, setCaseId] = useState<string>(() =>
    loadFromLocalStorage(STORAGE_KEYS.CASE_ID, '')
  );
  useEffect(() => {
    const generateId = async () => {
      if (caseId) return;
      try {
        const year = new Date().getFullYear();
        const id = await generateSequentialFormId('GST-PART', year);
        setCaseId(id);
        localStorage.setItem('gst_part_case_id', id);
      } catch (err) {
        console.error('Failed to generate case ID:', err);
        const fallbackId = `GST-PART-${new Date().getFullYear()}-01`;
        setCaseId(fallbackId);
      }
    };
    generateId();
  }, [caseId]);
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.CURRENT_STEP, 2);
    return saved < 2 ? 2 : saved;
  });
  const [docSubStep, setDocSubStep] = useState(() =>
    loadFromLocalStorage(STORAGE_KEYS.DOC_SUB_STEP, 1)
  );
  const [formData, setFormData] = useState<FormData>(() => loadFromLocalStorage(STORAGE_KEYS.FORM_DATA, INITIAL_DATA));
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | string, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [propertyType, setPropertyType] = useState<'owned' | 'rented'>(() => loadFromLocalStorage(STORAGE_KEYS.PROPERTY_TYPE, 'owned'));
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
  const [partners, setPartners] = useState<Partner[]>(() => loadFromLocalStorage(STORAGE_KEYS.PARTNERS, INITIAL_PARTNERS));
  const [partnerFileNames, setPartnerFileNames] = useState<Record<string, { pan?: string; aadhaar?: string; photo?: string }>>(() =>
    loadFromLocalStorage(STORAGE_KEYS.PARTNER_FILE_NAMES, {})
  );
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, boolean>>(() =>
    loadFromLocalStorage(STORAGE_KEYS.UPLOADED_DOCS, INITIAL_UPLOADED_DOCS)
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    cancelledCheque: null,
    bankStatement: null,
    partnershipDeed: null,
    firmPan: null,
    rentAgreement: null,
    noc: null,
    addressProof: null,
    elecBill: null,
    taxReceipt: null,
    utilityBill: null,
    dsc: null,
    signPan: null,
    signAadhaar: null,
    signPhoto: null,
    signAuthLetter: null,
    partnerPan: null,
    partnerAadhaar: null,
    partnerPhoto: null,
  });
  const [docFileNames, setDocFileNames] = useState<Partial<Record<DocKey, string>>>(() =>
    loadFromLocalStorage(STORAGE_KEYS.DOC_FILE_NAMES, {})
  );
  const [confirmConfig, setConfirmConfig] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);

  // 🔹 NEW: Geo-Location State
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const saveDraft = async (stepOverride?: number) => {
    if (packageMode || !user?.uid) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `gst_${user.uid}`), {
        serviceType: 'GST',
        constitution: commonData.constitution || 'Partnership',
        commonData,
        formData,
        partners,
        currentStep: stepOverride || currentStep,
        docSubStep,
        propertyType,
        uploadedDocs,
        docFileNames,
        partnerFileNames,
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
        lastUpdated: serverTimestamp(),
        userId: user.uid,
        status: 'draft'
      }, { merge: true });
    } catch (error) {
      console.error('Failed to save GST partnership draft:', error);
    } finally {
      setIsDraftSaving(false);
    }
  };

  // Persistence effects
  useEffect(() => {
    saveDraft();
  }, [currentStep, docSubStep]);

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
    saveToLocalStorage(STORAGE_KEYS.PARTNERS, partners);
  }, [partners]);
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.PARTNER_FILE_NAMES, partnerFileNames);
  }, [partnerFileNames]);
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
    if (caseId) {
      saveToLocalStorage(STORAGE_KEYS.CASE_ID, caseId);
    }
  }, [caseId]);
  useEffect(() => {
    if (formData.state) {
      const districts = STATE_DISTRICTS[formData.state] || [];
      setAvailableDistricts(districts);
      if (!formData.city) setFormData((prev) => ({ ...prev, city: '' }));
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.state]);
  useEffect(() => {
    const generateId = async () => {
      if (caseId) return;
      try {
        const year = new Date().getFullYear();
        const id = await generateSequentialFormId('GST-PART', year);
        setCaseId(id);
      } catch (err) {
        console.error('Failed to generate case ID:', err);
        const fallbackId = `GST-PART-${new Date().getFullYear()}-01`;
        setCaseId(fallbackId);
      }
    };
    generateId();
  }, [caseId]);
  // Sync Partners Count
  useEffect(() => {
    const count = parseInt(formData.numberOfPartners) || 2;
    if (count < 2) return;
    setPartners((prev) => {
      if (prev.length === count) return prev;
      const newPartners = [...prev];
      if (newPartners.length < count) {
        while (newPartners.length < count) {
          const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          newPartners.push({
            id: newId,
            designation: 'Partner',
            isPrimary: false,
            firstName: '',
            middleName: '',
            lastName: '',
            fatherName: { firstName: '', middleName: '', lastName: '' },
            mobile: '',
            email: '',
            panNumber: '',
            aadhaarNumber: '',
            panFile: false,
            aadhaarFile: false,
            photoFile: false,
            sharePercentage: '0',
          });
        }
      } else {
        newPartners.splice(count);
      }
      return newPartners;
    });
  }, [formData.numberOfPartners]);
  const validateField = (name: keyof FormData | string, value: any): string => {
    switch (name) {
      case 'firmName':
        return validators.required(value, 'Firm Name') === true ? '' : (validators.required(value, 'Firm Name') as string);
      case 'firmPanNumber':
        return validators.firmPan(value) === true ? '' : (validators.firmPan(value) as string);
      case 'partnershipDeedDate':
        return validators.partnershipDeedDate(value) === true ? '' : (validators.partnershipDeedDate(value) as string);
      case 'numberOfPartners':
        const num = parseInt(value);
        return num >= 2 ? '' : 'Minimum 2 partners required';
      case 'addressLine1':
        return validators.required(value, 'Address Line 1') === true ? '' : (validators.required(value, 'Address Line 1') as string);
      case 'addressLine2':
        return '';
      case 'city':
        return validators.required(value, 'City/District') === true ? '' : (validators.required(value, 'City/District') as string);
      case 'state':
        return validators.required(value, 'State') === true ? '' : (validators.required(value, 'State') as string);
      case 'pincode':
        return validators.pincode(value) === true ? '' : (validators.pincode(value) as string);
      case 'natureOfBusiness':
        return validators.required(value, 'Nature of Business') === true ? '' : (validators.required(value, 'Nature of Business') as string);
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
    if (['pincode', 'numberOfPartners'].includes(key)) formattedValue = (value as string).replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, [key]: formattedValue }));
    if (touched[key]) setErrors((prev) => ({ ...prev, [key]: validateField(key, formattedValue) }));
  };
  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, finalValue) }));
  };
  const handlePartnerChange = (id: string, field: keyof Partner, value: any) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    if (field === 'fatherName') {
      setErrors((prev) => ({
        ...prev,
        [`partner-${id}-fatherFirstName`]: undefined,
        [`partner-${id}-fatherMiddleName`]: undefined,
        [`partner-${id}-fatherLastName`]: undefined,
      }));
    } else {
      setErrors((prev) => ({
        ...prev,
        [`partner-${id}-${field}`]: undefined,
      }));
    }
  };
  const handlePrimaryChange = (selectedId: string) => {
    setPartners((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === selectedId })));
    setErrors((prev) => ({ ...prev, 'primary-partner': undefined }));
  };
  const handlePartnerFileUpload = (id: string, field: 'panFile' | 'aadhaarFile' | 'photoFile') => (file: File | null) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: !!file } : p)));
    if (file) {
      setPartnerFileNames((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field === 'panFile' ? 'pan' : field === 'aadhaarFile' ? 'aadhaar' : 'photo']: file.name,
        },
      }));
    }
    setErrors((prev) => ({
      ...prev,
      [`partner-${id}-${field === 'panFile' ? 'pan' : field === 'aadhaarFile' ? 'aadhaar' : 'photo'}`]: undefined,
    }));
  };
  const getTotalSharePercentage = () => {
    return partners.reduce((sum, p) => sum + parseInt(p.sharePercentage || '0'), 0);
  };
  const validatePartners = (): boolean => {
    const newErrors: Record<string, string> = {};
    let hasPrimary = false;
    let isValid = true;
    let totalShare = 0;
    partners.forEach((p, index) => {
      if (p.isPrimary) hasPrimary = true;
      const share = parseInt(p.sharePercentage || '0');
      totalShare += share;
      if (!p.firstName || !p.firstName.trim()) {
        newErrors[`partner-${p.id}-firstName`] = 'First Name is required';
        isValid = false;
      }
      if (!p.lastName || !p.lastName.trim()) {
        newErrors[`partner-${p.id}-lastName`] = 'Last Name is required';
        isValid = false;
      }
      if (!p.designation) {
        newErrors[`partner-${p.id}-designation`] = 'Designation is required';
        isValid = false;
      }
      if (!p.mobile || p.mobile.length !== 10) {
        newErrors[`partner-${p.id}-mobile`] = 'Valid 10-digit mobile number is required';
        isValid = false;
      }
      if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
        newErrors[`partner-${p.id}-email`] = 'Valid email address is required';
        isValid = false;
      }
      if (!p.fatherName?.firstName || !p.fatherName.firstName.trim()) {
        newErrors[`partner-${p.id}-fatherFirstName`] = "Father's First Name is required";
        isValid = false;
      }
      if (!p.fatherName?.lastName || !p.fatherName.lastName.trim()) {
        newErrors[`partner-${p.id}-fatherLastName`] = "Father's Last Name is required";
        isValid = false;
      }
      if (!p.panFile) {
        newErrors[`partner-${p.id}-pan`] = 'PAN Card upload is required';
        isValid = false;
      }
      if (!p.aadhaarFile) {
        newErrors[`partner-${p.id}-aadhaar`] = 'Aadhaar Card upload is required';
        isValid = false;
      }
      if (!p.photoFile) {
        newErrors[`partner-${p.id}-photo`] = 'Passport size photo upload is required';
        isValid = false;
      }
    });
    if (!hasPrimary) {
      newErrors['primary-partner'] = 'Please select one Primary Partner';
      isValid = false;
    }
    if (totalShare !== 100) {
      newErrors['share-percentage'] = `Total share percentage must be exactly 100%. Current: ${totalShare}%`;
      isValid = false;
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  };
  const getStepFields = (step: number): (keyof FormData)[] => {
    switch (step) {
      case 2:
        return ['firmName', 'firmPanNumber', 'partnershipDeedDate', 'numberOfPartners'];
      case 3:
        return ['addressLine1', 'city', 'state', 'pincode'];
      case 4:
        return ['natureOfBusiness'];
      case 8:
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
  const validateDocuments = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    if (currentStep === 2) {
      if (!uploadedDocs.partnershipDeed) {
        newErrors['partnershipDeed'] = 'Partnership Deed is required';
        isValid = false;
      }
      if (!uploadedDocs.firmPan) {
        newErrors['firmPan'] = 'Firm PAN Card is required';
        isValid = false;
      }
    } else if (currentStep === 3) {
      if (propertyType === 'owned') {
        if (!uploadedDocs.elecBill) {
          newErrors['elecBill'] = 'Electricity Bill is required for owned property';
          isValid = false;
        }
        if (!uploadedDocs.taxReceipt) {
          newErrors['taxReceipt'] = 'Property Tax Receipt is required';
          isValid = false;
        }
        if (!uploadedDocs.utilityBill) {
          newErrors['utilityBill'] = 'Utility Bill is required';
          isValid = false;
        }
      } else {
        if (!uploadedDocs.rentAgreement) {
          newErrors['rentAgreement'] = 'Rent Agreement is required for rented property';
          isValid = false;
        }
        if (!uploadedDocs.noc) {
          newErrors['noc'] = 'NOC from Owner is required';
          isValid = false;
        }
        if (!uploadedDocs.addressProof) {
          newErrors['addressProof'] = 'Address Proof is required';
          isValid = false;
        }
      }
    } else if (currentStep === 4) {
      if (!uploadedDocs.cancelledCheque) {
        newErrors['cancelledCheque'] = 'Cancelled Cheque is required';
        isValid = false;
      }
      if (!uploadedDocs.bankStatement) {
        newErrors['bankStatement'] = 'Bank Statement is required';
        isValid = false;
      }
    } else if (currentStep === 5) {
      if (!validatePartners()) {
        isValid = false;
      }
    } else if (currentStep === 6 && includeSignatoryDetails) {
      if (!signatoryFirstName || !signatoryFirstName.trim()) {
        newErrors['signatoryFirstName'] = 'Signatory First Name is required';
        isValid = false;
      }
      if (!signatoryLastName || !signatoryLastName.trim()) {
        newErrors['signatoryLastName'] = 'Signatory Last Name is required';
        isValid = false;
      }
      if (!signatoryFatherFirstName || !signatoryFatherFirstName.trim()) {
        newErrors['signatoryFatherFirstName'] = "Signatory's Father's First Name is required";
        isValid = false;
      }
      if (!signatoryFatherLastName || !signatoryFatherLastName.trim()) {
        newErrors['signatoryFatherLastName'] = "Signatory's Father's Last Name is required";
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
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  };
  const validateAllSections = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    const formFields: (keyof FormData)[] = [
      'firmName',
      'firmPanNumber',
      'partnershipDeedDate',
      'numberOfPartners',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'pincode',
      'natureOfBusiness',
    ];
    formFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });
    if (!uploadedDocs.partnershipDeed) {
      newErrors['partnershipDeed'] = 'Partnership Deed is required';
      isValid = false;
    }
    if (!uploadedDocs.firmPan) {
      newErrors['firmPan'] = 'Firm PAN Card is required';
      isValid = false;
    }
    if (!uploadedDocs.cancelledCheque) {
      newErrors['cancelledCheque'] = 'Cancelled Cheque is required';
      isValid = false;
    }
    if (!uploadedDocs.bankStatement) {
      newErrors['bankStatement'] = 'Bank Statement is required';
      isValid = false;
    }
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
    partners.forEach((p) => {
      if (!p.firstName || !p.lastName || !p.mobile || !p.email) {
        isValid = false;
      }
      if (!p.panFile || !p.aadhaarFile || !p.photoFile) {
        isValid = false;
      }
    });
    if (!validatePartners()) {
      isValid = false;
    }
    if (includeSignatoryDetails) {
      if (!signatoryFirstName || !signatoryLastName) {
        newErrors['signatoryName'] = 'Signatory name is required';
        isValid = false;
      }
      if (!signatoryMobile || signatoryMobile.length !== 10) {
        newErrors['signatoryMobile'] = 'Valid signatory mobile is required';
        isValid = false;
      }
      if (!signatoryEmail) {
        newErrors['signatoryEmail'] = 'Valid signatory email is required';
        isValid = false;
      }
      if (!uploadedDocs.signPan || !uploadedDocs.signAadhaar || !uploadedDocs.signPhoto || !uploadedDocs.signAuthLetter) {
        newErrors['signatoryDocs'] = 'All signatory documents are required';
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
      formFields.forEach((f) => (t[f] = true));
      return t;
    });
    return isValid;
  };
  const handleNext = async () => {
    if (!validateDocuments()) {
      return;
    }
    if (currentStep === 8) {
      if (!validateCurrentStep()) return;
      initiateSubmission();
      return;
    }
    if (currentStep < 8) {
      const nextStep = currentStep + 1;
      await saveDraft(nextStep);
      setCurrentStep(nextStep);
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
    setConfirmConfig({
      show: true,
      message: 'Are you sure you want to go back? All entered data will be lost.',
      onConfirm: () => {
        clearAllLocalStorage();
        onBack();
      },
    });
  };
  const uploadFileToStorage = async (file: File, docId: string, fieldName: string) => {
    if (!user?.uid) throw new Error('User not authenticated.');
    const cleanName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileExt = cleanName.split('.').pop() || 'bin';
    const baseName = cleanName.split('.').slice(0, -1).join('.');
    const fileName = `${baseName}_${Date.now()}.${fileExt}`;
    const path = `gst-applications/${user.uid}/${docId}/${fieldName}_${fileName}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    return await getDownloadURL(snapshot.ref);
  };
  const handleFileUpload = (fieldName: DocKey) => (file: File | null) => {
    setUploadedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setUploadedDocs((prev) => ({ ...prev, [fieldName]: !!file }));
    setDocFileNames((prev) => ({
      ...prev,
      [fieldName]: file ? file.name : undefined,
    }));
    setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
  };
  const getRequiredDocumentsList = () => {
    const docs: Array<{ key: string; label: string; isRequired: boolean }> = [];
    docs.push({ key: 'partnershipDeed', label: 'Partnership Deed', isRequired: true });
    docs.push({ key: 'firmPan', label: 'Firm PAN Card', isRequired: true });
    docs.push({ key: 'cancelledCheque', label: 'Cancelled Cheque', isRequired: true });
    docs.push({ key: 'bankStatement', label: 'Bank Statement', isRequired: true });
    if (propertyType === 'owned') {
      docs.push({ key: 'elecBill', label: 'Electricity Bill', isRequired: true });
      docs.push({ key: 'taxReceipt', label: 'Property Tax Receipt', isRequired: true });
      docs.push({ key: 'utilityBill', label: 'Utility Bill', isRequired: true });
    } else {
      docs.push({ key: 'rentAgreement', label: 'Rent Agreement', isRequired: true });
      docs.push({ key: 'noc', label: 'NOC from Owner', isRequired: true });
      docs.push({ key: 'addressProof', label: 'Address Proof', isRequired: true });
    }
    partners.forEach((partner, index) => {
      docs.push({ key: `partner-${index}-pan`, label: `Partner ${index + 1} PAN`, isRequired: true });
      docs.push({ key: `partner-${index}-aadhaar`, label: `Partner ${index + 1} Aadhaar`, isRequired: true });
      docs.push({ key: `partner-${index}-photo`, label: `Partner ${index + 1} Photo`, isRequired: true });
    });
    if (includeSignatoryDetails) {
      docs.push({ key: 'signPan', label: 'Signatory PAN', isRequired: true });
      docs.push({ key: 'signAadhaar', label: 'Signatory Aadhaar', isRequired: true });
      docs.push({ key: 'signPhoto', label: 'Signatory Photo', isRequired: true });
      docs.push({ key: 'signAuthLetter', label: 'Authorization Letter', isRequired: true });
    }
    docs.push({ key: 'dsc', label: 'Digital Signature (DSC)', isRequired: false });
    return docs;
  };
  const getPartnershipDocCount = () => {
    let count = 0;
    if (uploadedDocs.partnershipDeed) count++;
    if (uploadedDocs.firmPan) count++;
    return count;
  };
  const getAddressDocCount = () => {
    let count = 0;
    if (propertyType === 'owned') {
      if (uploadedDocs.elecBill) count++;
      if (uploadedDocs.taxReceipt) count++;
      if (uploadedDocs.utilityBill) count++;
    } else {
      if (uploadedDocs.rentAgreement) count++;
      if (uploadedDocs.noc) count++;
      if (uploadedDocs.addressProof) count++;
    }
    return count;
  };
  const getBusinessDocCount = () => {
    let count = 0;
    if (uploadedDocs.cancelledCheque) count++;
    if (uploadedDocs.bankStatement) count++;
    return count;
  };
  const getPartnerDocCount = () => {
    let count = 0;
    partners.forEach((p) => {
      if (p.panFile) count++;
      if (p.aadhaarFile) count++;
      if (p.photoFile) count++;
    });
    return count;
  };
  const getSignatoryDocCount = () => {
    if (!includeSignatoryDetails) return 0;
    let count = 0;
    if (uploadedDocs.signPan) count++;
    if (uploadedDocs.signAadhaar) count++;
    if (uploadedDocs.signPhoto) count++;
    if (uploadedDocs.signAuthLetter) count++;
    return count;
  };
  const getTotalRequiredDocs = () => {
    let count = 0;
    count += 2;
    count += 3;
    count += 2;
    count += partners.length * 3;
    if (includeSignatoryDetails) count += 4;
    return count;
  };
  const getUploadedDocCount = () => {
    let count = 0;
    if (uploadedDocs.partnershipDeed) count++;
    if (uploadedDocs.firmPan) count++;
    if (uploadedDocs.cancelledCheque) count++;
    if (uploadedDocs.bankStatement) count++;
    if (propertyType === 'rented') {
      if (uploadedDocs.rentAgreement) count++;
      if (uploadedDocs.noc) count++;
      if (uploadedDocs.addressProof) count++;
    } else {
      if (uploadedDocs.elecBill) count++;
      if (uploadedDocs.taxReceipt) count++;
      if (uploadedDocs.utilityBill) count++;
    }
    partners.forEach((p) => {
      if (p.panFile) count++;
      if (p.aadhaarFile) count++;
      if (p.photoFile) count++;
    });
    if (includeSignatoryDetails) {
      if (uploadedDocs.signPan) count++;
      if (uploadedDocs.signAadhaar) count++;
      if (uploadedDocs.signPhoto) count++;
      if (uploadedDocs.signAuthLetter) count++;
    }
    return count;
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
      message: 'During registration you will receive an OTP. Our support team will contact you once received. Please provide the correct OTP.',
      onConfirm: executeSubmission,
    });
  };
  const executeSubmission = async () => {
    if (!caseId) {
      alert("Case ID is generating. Please wait a moment and try again.");
      return;
    }
    setIsSubmitting(true);
    try {
      const docRef = doc(collection(db, 'applications'));
      const firebaseId = docRef.id;
      const uploadedFileUrls: Record<string, string> = {};
      for (const [key, isUploaded] of Object.entries(uploadedDocs)) {
        if (isUploaded && uploadedFiles[key as DocKey]) {
          const url = await uploadFileToStorage(uploadedFiles[key as DocKey]!, firebaseId, key);
          uploadedFileUrls[key] = url;
        }
      }
      const submissionData = {
        id: firebaseId,
        caseId: caseId,
        applicationRef: caseId,
        serviceId: caseId,
        type: 'gst',
        constitution: 'Partnership',
        title: 'GST Registration Application - Partnership',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        commonData: { ...commonData },
        formData: { ...formData },
        partners,
        propertyType,
        uploadedFileUrls,
        userId: user.uid,
        folderId: user.folderId || 'regibiz',
        paymentId: 'FREE_SUBMISSION',
        createdAt: Date.now(),
        includeSignatoryDetails,
        geoLocation: geoLocation || undefined, // 🔹 Geo-location added here
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
      if (!packageMode) {
        await setDoc(doc(db, 'applications', firebaseId), submissionData);
        try {
          await Promise.allSettled([
            deleteDoc(doc(db, 'drafts', `gst_${user.uid}`)),
            deleteDoc(doc(db, 'drafts', `gst_partnership_${user.uid}`)),
          ]);
        } catch (err) {
          console.error('Failed to delete draft:', err);
        }
        setFirebaseDocId(caseId);
      }
      if (onSubmit) {
        const filesToSubmit: Record<string, File> = {};
        Object.entries(uploadedFiles).forEach(([k, v]) => {
          if (v) filesToSubmit[k] = v;
        });
        await onSubmit(submissionData, filesToSubmit);
      }
      if (packageMode) {
        setIsSubmitting(false);
        return;
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
  // Success Screen
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
              Your Partnership application has been received. Our team will contact you for OTP/Aadhaar verification and processing.
            </p>
            {/* Case ID Section */}
            <div className="mb-8">
              <p className="text-white text-xs uppercase tracking-wide font-medium mb-1">Your Case ID</p>
              <div className="inline-block bg-slate-900/40 px-4 py-2 rounded-lg border border-slate-700/50">
                <p className="text-orange-400 font-mono font-bold text-lg tracking-wider">{firebaseDocId || caseId}</p>
              </div>
            </div>
            {/* Summary Box */}
            <div className="bg-slate-900/40 rounded-xl p-4 mb-8 text-left border border-slate-700/50 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                <span className="text-white text-sm">Firm Name</span>
                <span className="text-white font-medium text-sm capitalize">{formData.firmName || commonData.businessName || 'Applicant'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                <span className="text-white text-sm">Type</span>
                <span className="text-white font-medium text-sm">Partnership Firm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white text-sm">Primary Partner</span>
                <span className="text-white font-medium text-sm">
                  {partners.find(p => p.isPrimary)?.firstName || 'Partner'}
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
                className="w-full px-6 py-3.5 rounded-lg font-semibold text-white bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20 transition-all"
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
  // Preview Modal Component
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
      <div className="fixed inset-0 bg-secondary backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-slate-900 rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto border border-slate-700 shadow-2xl my-8">
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center z-10">
            <div>
              <h3 className="text-2xl font-bold text-white">Application Preview</h3>
              <p className="text-white text-sm mt-1">Review all details before submission</p>
            </div>
            <button onClick={() => setShowPreview(false)} className="p-2 text-white hover:text-white rounded-lg hover:bg-slate-800">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 space-y-6">
            {/* Partnership Firm Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Partnership Firm Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-white uppercase tracking-wider">Firm Name</p>
                  <p className="text-white font-medium mt-1">{formData.firmName}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-white uppercase tracking-wider">Partnership Deed Date</p>
                  <p className="text-white font-medium mt-1">{formatDate(formData.partnershipDeedDate)}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-white uppercase tracking-wider">Number of Partners</p>
                  <p className="text-white font-medium mt-1">{formData.numberOfPartners}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-white uppercase tracking-wider">Firm PAN Number</p>
                  <p className="text-white font-mono font-medium mt-1">{formData.firmPanNumber}</p>
                </div>
              </div>
            </section>
            {/* Partners Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Partners ({partners.length})
              </h4>
              <div className="space-y-4">
                {partners.map((partner, index) => (
                  <div key={partner.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                        {index + 1}
                      </span>
                      <h5 className="text-white font-semibold">Partner {index + 1}</h5>
                      {partner.isPrimary && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Primary</span>
                      )}
                      <span className="text-xs text-white">({partner.designation})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-white">Full Name</p>
                        <p className="text-white font-medium">
                          {partner.firstName} {partner.middleName} {partner.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white">Father's Name</p>
                        <p className="text-white font-medium">
                          {partner.fatherName?.firstName} {partner.fatherName?.middleName} {partner.fatherName?.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white">Mobile</p>
                        <p className="text-white font-medium">+91 {partner.mobile}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white">Email</p>
                        <p className="text-white font-medium">{partner.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white">Share Percentage</p>
                        <p className="text-white font-medium">{partner.sharePercentage}%</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/30">
                      <p className="text-xs text-white mb-2">Documents Uploaded:</p>
                      <div className="flex flex-wrap gap-2">
                        {partner.panFile && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            PAN
                          </span>
                        )}
                        {partner.aadhaarFile && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Aadhaar
                          </span>
                        )}
                        {partner.photoFile && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
            {/* Authorized Signatory (if enabled) */}
            {includeSignatoryDetails && (
              <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Authorized Signatory
                </h4>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-white uppercase tracking-wider">Full Name</p>
                      <p className="text-white font-medium mt-1">
                        {signatoryFirstName} {signatoryMiddleName} {signatoryLastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white uppercase tracking-wider">Father's Name</p>
                      <p className="text-white font-medium mt-1">
                        {signatoryFatherFirstName} {signatoryFatherMiddleName} {signatoryFatherLastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white uppercase tracking-wider">Mobile</p>
                      <p className="text-white font-medium mt-1">+91 {signatoryMobile}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white uppercase tracking-wider">Email</p>
                      <p className="text-white font-medium mt-1">{signatoryEmail}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700/30">
                    <p className="text-xs text-white mb-2">Signatory Documents:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'signPan', label: 'PAN Card' },
                        { key: 'signAadhaar', label: 'Aadhaar Card' },
                        { key: 'signPhoto', label: 'Photo' },
                        { key: 'signAuthLetter', label: 'Authorization Letter' },
                      ].map((doc) => (
                        <div key={doc.key} className="bg-slate-900/50 rounded-lg p-2 flex items-center justify-between">
                          <span className="text-xs text-slate-300">{doc.label}</span>
                          {uploadedDocs[doc.key as DocKey] ? (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              ✓
                            </span>
                          ) : (
                            <span className="text-[10px] text-white">✗</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
            {/* Business Address */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Business Address
              </h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-white">
                  {formData.addressLine1}
                </p>
                <p className="text-white">
                  {formData.addressLine2 ? `${formData.addressLine2}, ` : ''}{getDistrictLabel(formData.city)}
                </p>
                <p className="text-white">
                  {getStateLabel(formData.state)} - {formData.pincode}
                </p>
              </div>
            </section>
            {/* Nature of Business */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Nature of Business
              </h4>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-white font-medium">{formData.natureOfBusiness}</p>
              </div>
            </section>
            {/* Property Details */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Property Details ({propertyType === 'owned' ? 'Owned' : 'Rented'})
              </h4>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-white">Property Type</p>
                  <span
                    className={`text-sm font-medium px-3 py-1 rounded ${propertyType === 'owned' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                  >
                    {propertyType === 'owned' ? 'Owned' : 'Rented/Leased'}
                  </span>
                </div>
              </div>
            </section>
            {/* Documents Checklist */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documents Checklist ({getUploadedDocCount()}/{getTotalRequiredDocs()})
              </h4>
              <div className="bg-slate-900/50 rounded-lg divide-y divide-slate-800">
                <div className="p-3">
                  <p className="text-xs text-white uppercase tracking-wider mb-2">Partnership Documents</p>
                  <div className="space-y-1">
                    <DocumentRow label="Partnership Deed" uploaded={uploadedDocs.partnershipDeed} fileName={docFileNames.partnershipDeed} />
                    <DocumentRow label="Firm PAN Card" uploaded={uploadedDocs.firmPan} fileName={docFileNames.firmPan} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-white uppercase tracking-wider mb-2">Bank Account Proof (Both Required)</p>
                  <div className="space-y-1">
                    <DocumentRow label="Cancelled Cheque" uploaded={uploadedDocs.cancelledCheque} fileName={docFileNames.cancelledCheque} />
                    <DocumentRow label="Bank Statement" uploaded={uploadedDocs.bankStatement} fileName={docFileNames.bankStatement} />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-white uppercase tracking-wider mb-2">Address Proof</p>
                  <div className="space-y-1">
                    {propertyType === 'owned' ? (
                      <>
                        <DocumentRow label="Electricity Bill" uploaded={uploadedDocs.elecBill} fileName={docFileNames.elecBill} />
                        <DocumentRow label="Property Tax Receipt" uploaded={uploadedDocs.taxReceipt} fileName={docFileNames.taxReceipt} />
                        <DocumentRow label="Utility Bill" uploaded={uploadedDocs.utilityBill} fileName={docFileNames.utilityBill} />
                      </>
                    ) : (
                      <>
                        <DocumentRow label="Rent Agreement" uploaded={uploadedDocs.rentAgreement} fileName={docFileNames.rentAgreement} />
                        <DocumentRow label="NOC from Owner" uploaded={uploadedDocs.noc} fileName={docFileNames.noc} />
                        <DocumentRow label="Address Proof" uploaded={uploadedDocs.addressProof} fileName={docFileNames.addressProof} />
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-white uppercase tracking-wider mb-2">Partner Documents</p>
                  {partners.map((partner, index) => (
                    <div key={partner.id} className="mb-3 last:mb-0">
                      <p className="text-xs text-white mb-1">Partner {index + 1}</p>
                      <div className="space-y-1 ml-2">
                        <DocumentRow label="PAN" uploaded={partner.panFile} fileName={partnerFileNames[partner.id]?.pan} />
                        <DocumentRow label="Aadhaar" uploaded={partner.aadhaarFile} fileName={partnerFileNames[partner.id]?.aadhaar} />
                        <DocumentRow label="Photo" uploaded={partner.photoFile} fileName={partnerFileNames[partner.id]?.photo} />
                      </div>
                    </div>
                  ))}
                </div>
                {includeSignatoryDetails && (
                  <div className="p-3">
                    <p className="text-xs text-white uppercase tracking-wider mb-2">Signatory Documents</p>
                    <div className="space-y-1">
                      <DocumentRow label="Signatory PAN" uploaded={uploadedDocs.signPan} fileName={docFileNames.signPan} />
                      <DocumentRow label="Signatory Aadhaar" uploaded={uploadedDocs.signAadhaar} fileName={docFileNames.signAadhaar} />
                      <DocumentRow label="Signatory Photo" uploaded={uploadedDocs.signPhoto} fileName={docFileNames.signPhoto} />
                      <DocumentRow label="Authorization Letter" uploaded={uploadedDocs.signAuthLetter} fileName={docFileNames.signAuthLetter} />
                    </div>
                  </div>
                )}
              </div>
            </section>
            {/* Consent */}
            <section className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-lg font-semibold mb-4 text-white">Declaration & Consent</h4>
              <div className="space-y-3">
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg ${formData.consent1 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-900/50 border border-slate-700'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 ${formData.consent1 ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                  >
                    {formData.consent1 && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">
                    I authorize RegiBIZ to file my GST registration application on my behalf.
                  </p>
                </div>
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg ${formData.consent2 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-900/50 border border-slate-700'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 ${formData.consent2 ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                  >
                    {formData.consent2 && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">
                    I hereby declare that the details furnished above are true and correct to the best of my knowledge and belief.
                  </p>
                </div>
              </div>
            </section>
          </div>
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-6 flex justify-end gap-3 z-10">
            <button
              onClick={() => setShowPreview(false)}
              className="px-6 py-3 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setShowPreview(false);
                setCurrentStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-6 py-3 bg-gradient-primary text-white rounded-lg hover:brightness-110 transition-colors font-medium"
            >
              Edit Application
            </button>
            <button
              onClick={initiateSubmission}
              disabled={isSubmitting}
              className={`px-8 py-3 rounded-lg font-semibold ${isSubmitting ? 'bg-slate-600 text-white cursor-not-allowed' : 'bg-gradient-primary text-white hover:brightness-110'
                }`}
            >
              {isSubmitting ? 'Processing...' : 'SUBMIT APPLICATION'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  // Step Renderers (Simplified for brevity, assume they exist as in original file)
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Partnership Firm Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Firm Name" name="firmName" value={formData.firmName} onChange={handleChange} onBlur={handleBlur} error={errors.firmName} required placeholder="Enter firm name as per registration" />
          <FormInput label="Firm PAN Number" name="firmPanNumber" value={formData.firmPanNumber} onChange={handleChange} onBlur={handleBlur} error={errors.firmPanNumber} required placeholder="ABCDE1234F" maxLength={10} isPanField hint="Format: ABCDE1234F" />
          <FormInput label="Partnership Deed Date" name="partnershipDeedDate" type="date" value={formData.partnershipDeedDate} onChange={handleChange} onBlur={handleBlur} error={errors.partnershipDeedDate} required />
          <FormInput label="Number of Partners" name="numberOfPartners" type="number" value={formData.numberOfPartners} onChange={handleChange} onBlur={handleBlur} error={errors.numberOfPartners} required min={2} max={50} placeholder="Minimum 2 partners" />
        </div>
      </div>
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Required Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploader label="Partnership Deed" name="partnershipDeed" onChange={handleFileUpload('partnershipDeed')} required fileName={docFileNames.partnershipDeed || null} error={errors.partnershipDeed} />
          <FileUploader label="Firm PAN Card" name="firmPan" onChange={handleFileUpload('firmPan')} required fileName={docFileNames.firmPan || null} error={errors.firmPan} />
        </div>
      </div>
    </div>
  );
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Business Address</h3>
        <div className="space-y-4">
          <FormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1} onChange={handleChange} onBlur={handleBlur} error={errors.addressLine1} required placeholder="Flat / Plot No., Building Name, Street" />
          <FormInput label="Address Line 2 / Landmark" name="addressLine2" value={formData.addressLine2} onChange={handleChange} onBlur={handleBlur} error={errors.addressLine2} optional placeholder="Area / Colony / Locality (optional)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput label="State" name="state" value={formData.state} onChange={handleChange} options={INDIAN_STATES} required error={errors.state} />
            <SelectInput label="City / District" name="city" value={formData.city} onChange={handleChange} options={availableDistricts} required error={errors.city} disabled={!formData.state} />
          </div>
          <FormInput label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} onBlur={handleBlur} error={errors.pincode} required maxLength={6} placeholder="6 digit pincode" />
        </div>
      </div>
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Property Type</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPropertyType('owned')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md ${propertyType === 'owned' ? 'bg-gradient-primary text-white border border-cyan-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'}`}>Owned</button>
            <button type="button" onClick={() => setPropertyType('rented')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md ${propertyType === 'rented' ? 'bg-gradient-primary text-white border border-cyan-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'}`}>Rented/Leased</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {propertyType === 'owned' ? (
            <>
              <FileUploader label="Electricity Bill" name="elecBill" onChange={handleFileUpload('elecBill')} required fileName={docFileNames.elecBill || null} error={errors.elecBill} />
              <FileUploader label="Property Tax Receipt" name="taxReceipt" onChange={handleFileUpload('taxReceipt')} required fileName={docFileNames.taxReceipt || null} error={errors.taxReceipt} />
              <FileUploader label="Utility Bill" name="utilityBill" onChange={handleFileUpload('utilityBill')} required fileName={docFileNames.utilityBill || null} error={errors.utilityBill} />
            </>
          ) : (
            <>
              <FileUploader label="Rent Agreement" name="rentAgreement" onChange={handleFileUpload('rentAgreement')} required fileName={docFileNames.rentAgreement || null} error={errors.rentAgreement} />
              <FileUploader label="NOC from Owner" name="noc" onChange={handleFileUpload('noc')} required fileName={docFileNames.noc || null} error={errors.noc} />

              {/* 🔹 REPLACED: Address Proof with GeoTaggedFileUploader */}
              <GeoTaggedFileUploader
                label="Geo-tagged Address Proof"
                name="addressProof"
                onChange={handleFileUpload('addressProof')}
                onLocationCapture={(loc) => setGeoLocation(loc)}
                required
                fileName={docFileNames.addressProof || null}
                error={errors.addressProof}
                hint="Clear photo of premises/board. Location auto-captured on selection."
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Nature of Business</h3>
        <SelectInput label="Select Business Type" name="natureOfBusiness" value={formData.natureOfBusiness} onChange={handleChange} options={NATURE_OPTIONS.map((opt) => ({ value: opt, label: opt }))} required error={errors.natureOfBusiness} />
      </div>
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Bank Account Proof (Mandatory)</h3>
        <p className="text-white text-sm mb-4">Both Cancelled Cheque AND Bank Statement are required</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploader label="Cancelled Cheque" name="cancelledCheque" onChange={handleFileUpload('cancelledCheque')} required fileName={docFileNames.cancelledCheque || null} error={errors.cancelledCheque} hint="Clear image of cancelled cheque" />
          <FileUploader label="Bank Statement" name="bankStatement" onChange={handleFileUpload('bankStatement')} required fileName={docFileNames.bankStatement || null} error={errors.bankStatement} hint="Recent bank statement (last 3 months)" />
        </div>
        {errors.bankProof && <p className="text-red-400 text-sm mt-2">{errors.bankProof}</p>}
      </div>
    </div>
  );
  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Partner Details</h3>
        <p className="text-white text-sm mb-4">Total Partners: {partners.length} | Share Total: {getTotalSharePercentage()}%</p>
        {errors['share-percentage'] && <p className="text-red-400 text-sm mb-4">{errors['share-percentage']}</p>}
        {errors['primary-partner'] && <p className="text-red-400 text-sm mb-4">{errors['primary-partner']}</p>}
        <div className="space-y-6">
          {partners.map((partner, index) => (
            <div key={partner.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Partner {index + 1}</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="primary-partner" checked={partner.isPrimary} onChange={() => handlePrimaryChange(partner.id)} className="w-4 h-4 text-cyan-500 bg-slate-700 border-slate-600" />
                  <span className="text-sm text-slate-300">Primary Partner</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="First Name" value={partner.firstName || ''} onChange={(e) => handlePartnerChange(partner.id, 'firstName', e.target.value)} error={errors[`partner-${partner.id}-firstName`]} required placeholder="Enter first name" />
                <FormInput label="Middle Name" value={partner.middleName || ''} onChange={(e) => handlePartnerChange(partner.id, 'middleName', e.target.value)} optional placeholder="Enter middle name (optional)" />
                <FormInput label="Last Name" value={partner.lastName || ''} onChange={(e) => handlePartnerChange(partner.id, 'lastName', e.target.value)} error={errors[`partner-${partner.id}-lastName`]} required placeholder="Enter last name" />
                <SelectInput label="Designation" value={partner.designation} onChange={(e) => handlePartnerChange(partner.id, 'designation', e.target.value)} options={DESIGNATION_OPTIONS} error={errors[`partner-${partner.id}-designation`]} required />
                <FormInput label="Mobile Number" value={partner.mobile} onChange={(e) => handlePartnerChange(partner.id, 'mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} error={errors[`partner-${partner.id}-mobile`]} required maxLength={10} placeholder="10 digit mobile number" infoText="Use a number linked to Aadhaar for easier OTP verification." />
                <FormInput label="Email Address" type="email" value={partner.email} onChange={(e) => handlePartnerChange(partner.id, 'email', e.target.value)} error={errors[`partner-${partner.id}-email`]} required placeholder="partner@example.com" />
                <FormInput label="Share Percentage" type="number" value={partner.sharePercentage || '0'} onChange={(e) => handlePartnerChange(partner.id, 'sharePercentage', e.target.value)} error={errors['share-percentage']} min={0} max={100} placeholder="0-100" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700/30">
                <h5 className="text-sm font-medium text-white mb-3">Father's Name</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormInput label="First Name" value={partner.fatherName?.firstName || ''} onChange={(e) => handlePartnerChange(partner.id, 'fatherName', { ...partner.fatherName, firstName: e.target.value })} error={errors[`partner-${partner.id}-fatherFirstName`]} required placeholder="Enter first name" />
                  <FormInput label="Middle Name" value={partner.fatherName?.middleName || ''} onChange={(e) => handlePartnerChange(partner.id, 'fatherName', { ...partner.fatherName, middleName: e.target.value })} optional placeholder="Enter middle name (optional)" />
                  <FormInput label="Last Name" value={partner.fatherName?.lastName || ''} onChange={(e) => handlePartnerChange(partner.id, 'fatherName', { ...partner.fatherName, lastName: e.target.value })} error={errors[`partner-${partner.id}-fatherLastName`]} required placeholder="Enter last name" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700/30">
                <h5 className="text-sm font-medium text-white mb-3">Partner Documents</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FileUploader label="PAN Card" name={`partner-${partner.id}-pan`} onChange={handlePartnerFileUpload(partner.id, 'panFile')} required fileName={partnerFileNames[partner.id]?.pan || null} error={errors[`partner-${partner.id}-pan`]} hint="PAN format: ABCDE1234F" />
                  <FileUploader label="Aadhaar Card" name={`partner-${partner.id}-aadhaar`} onChange={handlePartnerFileUpload(partner.id, 'aadhaarFile')} required fileName={partnerFileNames[partner.id]?.aadhaar || null} error={errors[`partner-${partner.id}-aadhaar`]} />
                  <FileUploader label="Passport Photo" name={`partner-${partner.id}-photo`} onChange={handlePartnerFileUpload(partner.id, 'photoFile')} required fileName={partnerFileNames[partner.id]?.photo || null} error={errors[`partner-${partner.id}-photo`]} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Authorized Signatory Details</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeSignatoryDetails} onChange={(e) => setIncludeSignatoryDetails(e.target.checked)} className="w-4 h-4 text-cyan-500 bg-slate-700 border-slate-600 rounded" />
            <span className="text-sm text-slate-300">Include Signatory</span>
          </label>
        </div>
        {includeSignatoryDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="First Name" value={signatoryFirstName} onChange={(e) => setSignatoryFirstName(e.target.value)} error={errors.signatoryFirstName} required placeholder="Enter first name" />
              <FormInput label="Middle Name" value={signatoryMiddleName} onChange={(e) => setSignatoryMiddleName(e.target.value)} optional placeholder="Enter middle name (optional)" />
              <FormInput label="Last Name" value={signatoryLastName} onChange={(e) => setSignatoryLastName(e.target.value)} error={errors.signatoryLastName} required placeholder="Enter last name" />
              <FormInput label="Mobile Number" value={signatoryMobile} onChange={(e) => setSignatoryMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} error={errors.signatoryMobile} required maxLength={10} placeholder="10 digit mobile number" />
              <FormInput label="Email Address" type="email" value={signatoryEmail} onChange={(e) => setSignatoryEmail(e.target.value)} error={errors.signatoryEmail} required placeholder="signatory@example.com" />
            </div>
            <div className="pt-4 border-t border-slate-700/30">
              <h5 className="text-sm font-medium text-white mb-3">Father's Name</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormInput label="First Name" value={signatoryFatherFirstName} onChange={(e) => setSignatoryFatherFirstName(e.target.value)} error={errors.signatoryFatherFirstName} required placeholder="Enter first name" />
                <FormInput label="Middle Name" value={signatoryFatherMiddleName} onChange={(e) => setSignatoryFatherMiddleName(e.target.value)} optional placeholder="Enter middle name (optional)" />
                <FormInput label="Last Name" value={signatoryFatherLastName} onChange={(e) => setSignatoryFatherLastName(e.target.value)} error={errors.signatoryFatherLastName} required placeholder="Enter last name" />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-700/30">
              <h5 className="text-sm font-medium text-white mb-3">Signatory Documents</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploader label="PAN Card" name="signPan" onChange={handleFileUpload('signPan')} required fileName={docFileNames.signPan || null} error={errors.signPan} />
                <FileUploader label="Aadhaar Card" name="signAadhaar" onChange={handleFileUpload('signAadhaar')} required fileName={docFileNames.signAadhaar || null} error={errors.signAadhaar} />
                <FileUploader label="Passport Photo" name="signPhoto" onChange={handleFileUpload('signPhoto')} required fileName={docFileNames.signPhoto || null} error={errors.signPhoto} />
                <FileUploader label="Authorization Letter" name="signAuthLetter" onChange={handleFileUpload('signAuthLetter')} required fileName={docFileNames.signAuthLetter || null} error={errors.signAuthLetter} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Digital Signature Certificate (DSC)</h3>
        <p className="text-white text-sm mb-4">Upload your Digital Signature Certificate for signing documents (Optional but recommended)</p>
        <FileUploader label="DSC File (.pfx/.p12)" name="dsc" accept=".pfx,.p12" onChange={handleFileUpload('dsc')} optional fileName={docFileNames.dsc || null} hint="PFX or P12 format only" />
      </div>
    </div>
  );
  const renderStep8 = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-white">Declaration & Consent</h3>
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-lg bg-slate-900/50 border border-slate-700 cursor-pointer hover:border-cyan-500 transition-colors">
            <input type="checkbox" name="consent1" checked={formData.consent1} onChange={handleChange} className="w-5 h-5 text-cyan-500 bg-slate-700 border-slate-600 rounded mt-0.5" />
            <span className="text-sm text-slate-300">I authorize RegiBIZ to file my GST registration application on my behalf.</span>
          </label>
          {errors.consent1 && <p className="text-red-400 text-sm">{errors.consent1}</p>}
          <label className="flex items-start gap-3 p-4 rounded-lg bg-slate-900/50 border border-slate-700 cursor-pointer hover:border-cyan-500 transition-colors">
            <input type="checkbox" name="consent2" checked={formData.consent2} onChange={handleChange} className="w-5 h-5 text-cyan-500 bg-slate-700 border-slate-600 rounded mt-0.5" />
            <span className="text-sm text-slate-300">I hereby declare that the details furnished above are true and correct to the best of my knowledge and belief and I undertake to inform you of any changes therein, immediately. In case any of the above information is found to be false or untrue or misleading or misrepresenting, I am aware that I may be held liable for it.</span>
          </label>
          {errors.consent2 && <p className="text-red-400 text-sm">{errors.consent2}</p>}
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-700/50">
        <div className="flex flex-col-reverse md:flex-row items-center gap-4 justify-between">
          <div className="hidden md:block w-[140px]"></div>
          {/* UPDATED: Submit Button uses Teal/Blue Gradient */}
          <button type="button" onClick={executeSubmission} disabled={isSubmitting} className={`w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 flex items-center justify-center ${isSubmitting ? 'bg-slate-600 text-white cursor-not-allowed' : 'bg-gradient-primary text-white hover:brightness-110 hover:-translate-y-1'}`}>
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                SUBMIT APPLICATION
                <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        </div>
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
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">GST Registration - Partnership</h1>
          <p className="text-cyan-200/80 text-sm">Step {currentStep - 1} of 7</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_16px_48px_0_rgba(0,0,0,0.5),0_0_20px_0_rgba(56,189,248,0.1)] border border-cyan-500/20 overflow-hidden relative min-h-[600px] flex flex-col">
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
                {/* UPDATED: Main Title uses Red-Orange Gradient */}
                <h1 className="text-3xl font-bold tracking-tight drop-shadow-md text-white">GST Registration</h1>
                <p className="text-slate-300 text-base max-w-lg leading-relaxed mt-1 mx-auto">
                  {currentStep === 2 && 'Provide partnership firm details and upload required documents.'}
                  {currentStep === 3 && 'Enter business address and upload address proof documents.'}
                  {currentStep === 4 && 'Select nature of business and upload bank documents.'}
                  {currentStep === 5 && 'Provide all partner information and documents.'}
                  {currentStep === 6 && 'Provide authorized signatory information (Optional).'}
                  {currentStep === 7 && 'Upload your Digital Signature Certificate (Optional).'}
                  {currentStep === 8 && 'Review and provide consent for submission.'}
                </p>
              </div>
              {caseId && <StatusBanner caseId={caseId} />}
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
                      <button type="button" onClick={handleNext} disabled={isDraftSaving} className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 bg-gradient-primary text-white hover:brightness-110 hover:-translate-y-1 flex items-center justify-center disabled:opacity-50">
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
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8 hidden lg:block">
            <div className="space-y-6">
              {/* MSME-Style Progress Status */}
              <ProgressStatus
                currentStep={currentStep}
                uploadedFiles={uploadedDocs}
                requiredDocs={getRequiredDocumentsList()}
              />
              {/* MSME-Style Required Documents */}
              <RequiredDocuments
                requiredDocs={getRequiredDocumentsList()}
                uploadedFiles={uploadedDocs}
              />
              {/* Support Verification */}
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
                      <span className="font-mono font-bold text-emerald-400 text-base tracking-tight">0413-2262818</span>
                      <span className="font-mono font-bold text-emerald-400 text-base tracking-tight">63645 62818</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Preview Button - Already updated in Sidebar component */}
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full py-4 rounded-xl bg-gradient-primary border border-cyan-500/30 text-white font-bold text-base tracking-wide shadow-lg hover:brightness-110 transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  <svg className="w-5 h-5 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-lg">Preview Application</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
        <div className="mt-12 text-center text-white text-sm pb-8">&copy; 2026 RegiBIZ. All rights reserved.</div>
      </div>
      {showPreview && <PreviewModal />}
    </div>
  );
}
