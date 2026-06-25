import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CelebrationPopup from '../components/CelebrationPopup';
import { useRazorpay } from '../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import FormBackButton from '../components/FormBackButton';
import { buildInitialApplicationStatus } from './applicationStatus';

// ============================================================================
// VALIDATORS & ERROR MESSAGES
// ============================================================================

const validators = {
  required: (value: string): boolean => value.trim().length > 0,

  cin: (value: string): boolean => {
    const cleanValue = value.trim().toUpperCase();
    return /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(cleanValue);
  },

  email: (value: string): boolean => {
    const cleanValue = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue) && cleanValue.length <= 254;
  },

  din: (value: string): boolean => {
    return /^\d{8}$/.test(value.trim());
  },

  latitude: (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= -90 && num <= 90;
  },

  longitude: (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= -180 && num <= 180;
  },

  number: (value: string, min: number = 1, max: number = Infinity): boolean => {
    const cleanValue = value.trim();
    if (!/^\d+$/.test(cleanValue)) return false;
    const num = parseInt(cleanValue, 10);
    return num >= min && num <= max;
  },

  phone: (value: string): boolean => {
    return /^\d{10}$/.test(value.trim());
  },

  membershipNumber: (value: string): boolean => {
    return /^\d{5,7}$/.test(value.trim());
  },

  copNumber: (value: string): boolean => {
    return /^\d{4,8}$/.test(value.trim());
  },

  srn: (value: string): boolean => {
    return /^SRN[A-Za-z0-9]{9}$/i.test(value.trim());
  },
};

const errorMessages = {
  required: "This field is required",
  cin: "Invalid CIN format (e.g., U62099PY2026PTC009629)",
  email: "Please enter a valid email address",
  din: "DIN must be exactly 8 digits",
  latitude: "Latitude must be between -90 and 90",
  longitude: "Longitude must be between -180 and 180",
  number: "Please enter a valid positive number",
  numberRange: (min: number, max: number) => `Value must be between ${min} and ${max}`,
  phone: "Enter a valid 10-digit mobile number",
  membershipNumber: "Invalid membership number (5-7 digits expected)",
  copNumber: "Invalid COP number (4-8 digits expected)",
  srn: "Invalid SRN format (e.g., SRN123456789)",
  fileRequired: (label: string) => `${label} is required`,
  fileType: (label: string) => `${label} must be a PDF or image file`,
  fileSize: (label: string) => `${label} must be less than 10MB`,
};

// ============================================================================
// INFO TOOLTIP COMPONENT
// ============================================================================

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-500 hover:text-orange-400 transition-colors focus:outline-none"
        aria-label="More information"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {show && (
        <div className="absolute left-full top-0 ml-2 w-72 p-3 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg shadow-xl z-50" role="tooltip">
          {text}
          <div className="absolute left-0 top-3 -ml-1 w-2 h-2 bg-slate-800 border-l border-b border-slate-700 transform rotate-45" aria-hidden="true"></div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// FORM INPUT COMPONENT
// ============================================================================

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  infoText?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  hint,
  optional,
  infoText,
  className,
  id,
  required,
  ...props
}) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
            {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <input
          id={inputId}
          className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
            } ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          required={required}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse" role="alert" aria-live="polite">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

// ============================================================================
// FORM SELECT COMPONENT
// ============================================================================

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  optional?: boolean;
  infoText?: string;
}

const FormSelect: React.FC<FormSelectProps> = ({
  label,
  options,
  error,
  optional,
  infoText,
  id,
  ...props
}) => {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={selectId} className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
            {label} {optional && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select
          id={selectId}
          className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
            }`}
          aria-invalid={!!error}
          {...props}
        >
          <option value="">Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse" role="alert">{error}</p>}
    </div>
  );
};

// ============================================================================
// FILE UPLOADER COMPONENT
// ============================================================================

interface FileUploaderProps {
  label: string;
  name: string;
  onChange: (file: File | null) => void;
  required?: boolean;
  accept?: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  uploadedFile?: File | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  name,
  onChange,
  required = false,
  accept = ".pdf",
  error,
  hint,
  uploadedFile,
}) => {
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadedFile) {
      setFileName(uploadedFile.name);
    } else {
      setFileName("");
    }
  }, [uploadedFile]);

  const validateFile = (file: File): string | null => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    // Handle wildcard accept patterns (image/*, application/*, etc.)
    if (accept === 'image/*') {
      if (!file.type.startsWith('image/')) {
        return errorMessages.fileType(label);
      }
    } else if (accept === 'application/*') {
      if (!file.type.startsWith('application/')) {
        return errorMessages.fileType(label);
      }
    } else {
      // Original strict matching for specific extensions/types
      const allowedTypes = accept.split(',').map(a => a.trim().toLowerCase());
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      const isAllowed = allowedTypes.includes(file.type) || allowedTypes.includes(fileExt);

      if (!isAllowed) return errorMessages.fileType(label);
    }

    if (file.size > MAX_FILE_SIZE) return errorMessages.fileSize(label);
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setFileName("");
        onChange(null);
        // Reset the input so user can try again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setFileName(file.name);
      onChange(file);
    } else {
      setFileName("");
      onChange(null);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFileName("");
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
          {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      </div>
      <div
        className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer group ${error ? 'border-red-500 bg-red-500/5' :
          fileName ? 'border-emerald-500/50 bg-emerald-500/5' :
            'border-slate-700 hover:border-cyan-500'
          }`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
      >
        <input
          type="file"
          ref={fileInputRef}
          name={name}
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id={name}
        />
        <div className="flex items-center justify-between">
          {fileName ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-emerald-400 text-sm font-medium truncate">{fileName}</span>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors shrink-0"
                aria-label={`Remove ${fileName}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <span className="text-slate-400 text-sm group-hover:text-cyan-400 transition-colors">
              Click to upload {accept.replace(/\./g, '').toUpperCase()} file
            </span>
          )}
        </div>
      </div>
      {error && <p id={`${name}-error`} className="mt-1 text-xs text-red-400 animate-pulse" role="alert" aria-live="polite">{error}</p>}
      {hint && !error && <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

// ============================================================================
// TYPES
// ============================================================================

interface DirectorDetail {
  din: string;
  name: string;
  address: string;
  email: string;
  phone: string;
}

interface FormData {
  cin: string;
  companyName: string;
  registeredOffice: string;
  latitude: string;
  longitude: string;
  email: string;
  numberOfDirectors: string;
  isCompanyActive: string;
  aoc4Srn: string;
  mgt7Srn: string;
  remarks: string;
}

interface ProfessionalDetails {
  type: string;
  membershipNumber: string;
  copNumber: string;
  email: string;
}

interface INC22AFormProps {
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

// ============================================================================
// INDEXEDDB HELPERS
// ============================================================================

const DB_NAME = 'RegiBIZFormDB';
const STORE_NAME = 'files';
const DB_VERSION = 1;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveFileToIndexedDB = async (formId: string, key: string, file: File | File[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const req = store.put(file, `${formId}_${key}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not save file to IndexedDB:', e);
  }
};

const getFileFromIndexedDB = async (formId: string, key: string): Promise<File | File[] | null> => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.get(`${formId}_${key}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not retrieve file from IndexedDB:', e);
    return null;
  }
};

const deleteFileFromIndexedDB = async (formId: string, key: string) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const req = store.delete(`${formId}_${key}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not delete file from IndexedDB:', e);
  }
};

const clearAllFilesFromIndexedDB = async (formId: string) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const keys = await new Promise<string[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });

    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(`${formId}_`)) {
        store.delete(key);
      }
    }
  } catch (e) {
    console.warn('Could not clear files from IndexedDB:', e);
  }
};

// ============================================================================
// MAIN COMPONENT: INC-22A FORM
// ============================================================================

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

export default function INC22AForm({ user, packageMode, onComplete, onBack, initialData, existingDocs }: INC22AFormProps) {
  const navigate = useNavigate();
  const initialFormData: FormData = {
    cin: initialData?.cin || '',
    companyName: initialData?.companyName || '',
    registeredOffice: initialData?.registeredOffice || '',
    latitude: initialData?.latitude || '',
    longitude: initialData?.longitude || '',
    email: initialData?.email || '',
    numberOfDirectors: initialData?.numberOfDirectors || '2',
    isCompanyActive: initialData?.isCompanyActive || 'yes',
    aoc4Srn: initialData?.aoc4Srn || '',
    mgt7Srn: initialData?.mgt7Srn || '',
    remarks: initialData?.remarks || '',
  };
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [formId, setFormId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Draft state
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const { displayRazorpay } = useRazorpay();
  const servicePrice = PRICING_CONFIG['inc-22a']?.fee ?? 0;

  const [directorDetails, setDirectorDetails] = useState<DirectorDetail[]>(initialData?.directorDetails || [
    { din: '', name: '', address: '', email: '', phone: '' }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | File[] | null>>({
    cinCertificate: null,
    insideOfficePhoto: null,
    outsideOfficePhoto: null,
    boardResolution: null,
    directorList: null,
    directoryProof: null,
    aoc4Filing: null,
    mgt7Filing: null,
  });

  const [professionalDetails, setProfessionalDetails] = useState<ProfessionalDetails>(initialData?.professionalDetails || {
    type: 'Chartered Accountant',
    membershipNumber: '',
    copNumber: '',
    email: '',
  });

  const uploadedCount = Object.values(uploadedFiles).filter(val => {
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val);
  }).length;

  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Check for existing application on mount
  useEffect(() => {
    const checkExistingApplication = async () => {
      try {
        const q = query(
          collection(db, "applications"),
          where("userId", "==", user.uid),
          where("type", "==", "inc22a")
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const latestApp = querySnapshot.docs[0].data();
          setExistingApplication(latestApp);
        }
      } catch (error) {
        console.error("Error checking existing application:", error);
      } finally {
        setLoading(false);
      }
    };

    checkExistingApplication();
  }, [user.uid]);

  // Initialize form and load files from IndexedDB
  useEffect(() => {
    const initializeForm = async () => {
      let id = localStorage.getItem('inc22a_formId');
      if (!id) {
        id = `INC22A-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
        localStorage.setItem('inc22a_formId', id);
      }
      setFormId(id);

      // ✅ UPDATED: Include new file keys
      const fileKeys = [
        'cinCertificate',
        'insideOfficePhoto',
        'outsideOfficePhoto',
        'boardResolution',
        'directorList',
        'directoryProof',
        'aoc4Filing',
        'mgt7Filing'
      ];
      const restoredFiles: Record<string, File | File[] | null> = {};

      for (const key of fileKeys) {
        const file = await getFileFromIndexedDB(id, key);
        restoredFiles[key] = file;
      }

      setUploadedFiles(prev => ({ ...prev, ...restoredFiles }));
    };

    initializeForm();
  }, []);

  // Firestore saveDraft
  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid || packageMode) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `inc22a_${user.uid}`), {
        userId: user.uid,
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        extra: { directorDetails, professionalDetails },
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: formId,
        serviceType: 'inc22a',
      }, { merge: true });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  // Load draft from Firestore on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (packageMode || !user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'drafts', `inc22a_${user.uid}`));
        if (snap.exists()) {
          const data = snap.data();
          if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));
          if (data.currentStep) setCurrentStep(Math.min(Math.max(data.currentStep, 1), 3));
          if (data.caseId) {
            setFormId(data.caseId);
            localStorage.setItem('inc22a_formId', data.caseId);
          }
          if (data.extra?.directorDetails) setDirectorDetails(data.extra.directorDetails);
          if (data.extra?.professionalDetails) setProfessionalDetails(data.extra.professionalDetails);
        }
      } catch (err) {
        console.error('Draft load failed:', err);
      }
    };
    loadDraft();
  }, [packageMode, user?.uid]);

  // Auto-save draft on step/formData change
  useEffect(() => {
    if (packageMode || isSuccess) return;
    const timer = setTimeout(() => saveDraft(), 2000);
    return () => clearTimeout(timer);
  }, [currentStep, directorDetails, formData, isSuccess, packageMode, professionalDetails]);

  // Exit confirmation and navigation blocking
  useEffect(() => {
    if (packageMode) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSuccess) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (_e: PopStateEvent) => {
      if (isSuccess) return;
      window.history.pushState(null, '', window.location.href);
      if (currentStep > 1) {
        handlePrevious();
      } else {
        setShowExitConfirm(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSuccess, packageMode, currentStep]);

  const handleConfirmExit = async (save: boolean) => {
    if (save) {
      setIsDraftSaving(true);
      try {
        await saveDraft();
        setShowExitConfirm(false);
        navigate('/services/inc-22a-filing');
      } catch (err) {
        console.error('Exit save failed:', err);
        setShowExitConfirm(false);
      } finally {
        setIsDraftSaving(false);
      }
    } else {
      setShowExitConfirm(false);
      navigate('/services/inc-22a-filing');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const focusField = (fieldName: string) => {
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[name="${fieldName}"], [id="${fieldName}"]`);
      if (!field) return;
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus();
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // ✅ Force uppercase for CIN field
  const handleCINChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upperValue = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, cin: upperValue }));

    if (errors.cin) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cin;
        return newErrors;
      });
    }
  };

  // ✅ Numeric handler for formData fields (DIN, phone, numberOfDirectors, etc.)
  const handleNumericFormDataChange = (fieldName: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitValue = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, [fieldName]: digitValue }));

    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // ✅ Numeric handler for professionalDetails fields (membershipNumber, copNumber)
  const handleNumericProfessionalChange = (fieldName: keyof ProfessionalDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitValue = e.target.value.replace(/\D/g, '');
    setProfessionalDetails(prev => ({ ...prev, [fieldName]: digitValue }));

    // Clear corresponding error
    const errorKey = fieldName === 'membershipNumber' ? 'profMembership' :
      fieldName === 'copNumber' ? 'profCOP' : 'profEmail';
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleDirectorChange = (index: number, field: keyof DirectorDetail, value: string) => {
    // For numeric fields, strip non-digits
    const processedValue = ['din', 'phone'].includes(field) ? value.replace(/\D/g, '') : value;

    const updated = [...directorDetails];
    updated[index] = { ...updated[index], [field]: processedValue };
    setDirectorDetails(updated);

    const errorKey = `director${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addDirector = () => {
    setDirectorDetails([
      ...directorDetails,
      { din: '', name: '', address: '', email: '', phone: '' }
    ]);
  };

  const removeDirector = (index: number) => {
    if (directorDetails.length > 1) {
      setDirectorDetails(directorDetails.filter((_, i) => i !== index));
    }
  };

  // ✅ Debounced blur validation
  const handleFieldBlur = useCallback((fieldName: string, value: string) => {
    if (!value.trim()) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      let isValid = true;
      let errorMsg = errorMessages.required;

      switch (fieldName) {
        case 'cin':
          isValid = validators.cin(value);
          errorMsg = errorMessages.cin;
          break;
        case 'email':
        case 'profEmail':
          isValid = validators.email(value);
          errorMsg = errorMessages.email;
          break;
        case 'directorDIN':
        case 'din':
          isValid = validators.din(value);
          errorMsg = errorMessages.din;
          break;
        case 'latitude':
          isValid = validators.latitude(value);
          errorMsg = errorMessages.latitude;
          break;
        case 'longitude':
          isValid = validators.longitude(value);
          errorMsg = errorMessages.longitude;
          break;
        case 'numberOfDirectors':
          isValid = validators.number(value, 1, 20);
          errorMsg = errorMessages.numberRange(1, 20);
          break;
        case 'phone':
          isValid = validators.phone(value);
          errorMsg = errorMessages.phone;
          break;
        case 'membershipNumber':
          isValid = validators.membershipNumber(value);
          errorMsg = errorMessages.membershipNumber;
          break;
        case 'copNumber':
          isValid = validators.copNumber(value);
          errorMsg = errorMessages.copNumber;
          break;
        case 'aoc4Srn':
        case 'mgt7Srn':
          if (value) {
            isValid = validators.srn(value);
            errorMsg = errorMessages.srn;
          }
          break;
        default:
          return;
      }

      if (!isValid && !errors[fieldName]) {
        setErrors(prev => ({ ...prev, [fieldName]: errorMsg }));
      }
    }, 300);
  }, [errors]);

  const handleFileUpload = (key: string) => (file: File | null) => {
    setUploadedFiles(prev => ({ ...prev, [key]: file }));

    if (file && formId) {
      saveFileToIndexedDB(formId, key, file);
    } else if (!file && formId) {
      deleteFileFromIndexedDB(formId, key);
    }

    if (file && fileErrors[key]) {
      setFileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    let firstInvalidField = '';

    if (step === 1) {
      if (!validators.required(formData.cin)) {
        newErrors.cin = errorMessages.required;
        firstInvalidField ||= 'cin';
      } else if (!validators.cin(formData.cin)) {
        newErrors.cin = errorMessages.cin;
        firstInvalidField ||= 'cin';
      }

      if (!validators.required(formData.companyName)) {
        newErrors.companyName = errorMessages.required;
        firstInvalidField ||= 'companyName';
      }

      if (!validators.required(formData.registeredOffice)) {
        newErrors.registeredOffice = errorMessages.required;
        firstInvalidField ||= 'registeredOffice';
      }

      if (!validators.required(formData.latitude)) {
        newErrors.latitude = errorMessages.required;
        firstInvalidField ||= 'latitude';
      } else if (!validators.latitude(formData.latitude)) {
        newErrors.latitude = errorMessages.latitude;
        firstInvalidField ||= 'latitude';
      }

      if (!validators.required(formData.longitude)) {
        newErrors.longitude = errorMessages.required;
        firstInvalidField ||= 'longitude';
      } else if (!validators.longitude(formData.longitude)) {
        newErrors.longitude = errorMessages.longitude;
        firstInvalidField ||= 'longitude';
      }

      if (!validators.required(formData.email)) {
        newErrors.email = errorMessages.required;
        firstInvalidField ||= 'email';
      } else if (!validators.email(formData.email)) {
        newErrors.email = errorMessages.email;
        firstInvalidField ||= 'email';
      }

      if (!validators.required(formData.numberOfDirectors)) {
        newErrors.numberOfDirectors = errorMessages.required;
        firstInvalidField ||= 'numberOfDirectors';
      } else if (!validators.number(formData.numberOfDirectors, 1, 20)) {
        newErrors.numberOfDirectors = errorMessages.numberRange(1, 20);
        firstInvalidField ||= 'numberOfDirectors';
      }
    }

    if (step === 2) {
      directorDetails.forEach((director, idx) => {
        const prefix = `director${idx}`;

        if (!validators.required(director.name)) {
          newErrors[`${prefix}_name`] = "Director name is required";
          firstInvalidField ||= `${prefix}_name`;
        }

        if (!validators.required(director.din)) {
          newErrors[`${prefix}_din`] = errorMessages.required;
          firstInvalidField ||= `${prefix}_din`;
        } else if (!validators.din(director.din)) {
          newErrors[`${prefix}_din`] = errorMessages.din;
          firstInvalidField ||= `${prefix}_din`;
        }

        if (!validators.required(director.address)) {
          newErrors[`${prefix}_address`] = errorMessages.required;
          firstInvalidField ||= `${prefix}_address`;
        }

        if (!validators.required(director.email)) {
          newErrors[`${prefix}_email`] = errorMessages.required;
          firstInvalidField ||= `${prefix}_email`;
        } else if (!validators.email(director.email)) {
          newErrors[`${prefix}_email`] = errorMessages.email;
          firstInvalidField ||= `${prefix}_email`;
        }

        if (!validators.required(director.phone)) {
          newErrors[`${prefix}_phone`] = errorMessages.required;
          firstInvalidField ||= `${prefix}_phone`;
        } else if (!validators.phone(director.phone)) {
          newErrors[`${prefix}_phone`] = errorMessages.phone;
          firstInvalidField ||= `${prefix}_phone`;
        }
      });
    }

    if (step === 3) {
      if (!validators.required(professionalDetails.membershipNumber)) {
        newErrors.profMembership = errorMessages.required;
        firstInvalidField ||= 'profMembership';
      } else if (!validators.membershipNumber(professionalDetails.membershipNumber)) {
        newErrors.profMembership = errorMessages.membershipNumber;
        firstInvalidField ||= 'profMembership';
      }

      if (!validators.required(professionalDetails.copNumber)) {
        newErrors.profCOP = errorMessages.required;
        firstInvalidField ||= 'profCOP';
      } else if (!validators.copNumber(professionalDetails.copNumber)) {
        newErrors.profCOP = errorMessages.copNumber;
        firstInvalidField ||= 'profCOP';
      }

      if (!validators.required(professionalDetails.email)) {
        newErrors.profEmail = errorMessages.required;
        firstInvalidField ||= 'profEmail';
      } else if (!validators.email(professionalDetails.email)) {
        newErrors.profEmail = errorMessages.email;
        firstInvalidField ||= 'profEmail';
      }

      if (formData.aoc4Srn && !validators.srn(formData.aoc4Srn)) {
        newErrors.aoc4Srn = errorMessages.srn;
        firstInvalidField ||= 'aoc4Srn';
      }
      if (formData.mgt7Srn && !validators.srn(formData.mgt7Srn)) {
        newErrors.mgt7Srn = errorMessages.srn;
        firstInvalidField ||= 'mgt7Srn';
      }
    }

    setErrors(newErrors);
    if (firstInvalidField) {
      focusField(firstInvalidField);
    }
    return Object.keys(newErrors).length === 0;
  };

  const validateFiles = (): boolean => {
    const newFileErrors: Record<string, string> = {};
    const requiredDocs: Record<string, string> = {
      cinCertificate: 'CIN Certificate',
      insideOfficePhoto: 'Inside Office Photo',    // ✅ UPDATED
      outsideOfficePhoto: 'Outside Office Photo',  // ✅ UPDATED
      boardResolution: 'Board Resolution',
      directorList: 'List of Directors',
      directoryProof: 'Director Proof Documents',
    };

    Object.entries(requiredDocs).forEach(([key, label]) => {
      const file = uploadedFiles[key];
      if (!file || (Array.isArray(file) && file.length === 0)) {
        newFileErrors[key] = errorMessages.fileRequired(label);
      }
    });

    setFileErrors(newFileErrors);
    return Object.keys(newFileErrors).length === 0;
  };

  const handleNext = async () => {
    setSubmitError(null);
    if (validateStep(currentStep)) {
      // Save draft before moving to next step
      await saveDraft(currentStep + 1);
      setCurrentStep(prev => Math.min(prev + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    setSubmitError(null);
    if (currentStep === 1) {
      if (packageMode && onBack) {
        onBack();
      } else {
        setShowConfirm({
          show: true,
          message: 'Go back to services? Your draft will be saved.',
          onConfirm: () => navigate('/services/inc-22a-filing')
        });
      }
      return;
    }
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================================================
  // SUBMISSION LOGIC
  // ============================================================================

  const ProcessingOverlay: React.FC = () => (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="processing-title">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6">
          <svg className="animate-spin w-full h-full text-cyan-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h3 id="processing-title" className="text-xl font-semibold text-white mb-2">Processing...</h3>
        <p className="text-slate-400 text-sm">Please wait while we submit your application.</p>
        <p className="text-slate-500 text-xs mt-1">Do not close this window.</p>
      </div>
    </div>
  );

  // Payment-Gated Auto-Submit Effect
  useEffect(() => {
    if (paymentInfo && !isSubmitting && !isSuccess) {
      handleSubmit(paymentInfo);
    }
  }, [paymentInfo]);

  const handleSubmit = async (payInfo?: RazorpaySuccessResponse | React.FormEvent) => {
    if (payInfo && 'preventDefault' in payInfo) {
      payInfo.preventDefault();
      payInfo = undefined;
    }
    setSubmitError(null);

    const stepValid = validateStep(3);
    const filesValid = validateFiles();

    if (!stepValid || !filesValid) {
      setSubmitError("Please fill all required fields and upload all documents");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If already have payment info or in package mode or fee is 0
    if (payInfo || packageMode || servicePrice === 0) {
      setIsSubmitting(true);
      try {
        const uploadedFileUrls: Record<string, string | string[]> = {};

        for (const [key, file] of Object.entries(uploadedFiles)) {
          if (!file) continue;

          if (Array.isArray(file)) {
            const urls: string[] = [];
            for (const selectedFile of file) {
              const filePath = `inc22a/${user.uid}/${formId}/${key}_${Date.now()}_${selectedFile.name}`;
              const storageRef = ref(storage, filePath);
              await uploadBytes(storageRef, selectedFile);
              urls.push(await getDownloadURL(storageRef));
            }
            uploadedFileUrls[key] = urls;
            continue;
          }

          const filePath = `inc22a/${user.uid}/${formId}/${key}_${Date.now()}_${file.name}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, file);
          uploadedFileUrls[key] = await getDownloadURL(storageRef);
        }

        const applicationData = {
          id: formId,
          type: 'inc22a',
          title: 'INC-22A (ACTIVE) - Compliance Form',
          ...buildInitialApplicationStatus({ serviceType: 'inc22a', serviceName: 'INC-22A (ACTIVE) - Compliance Form', userId: user.uid }),
          submittedAt: serverTimestamp(),
          formData: { ...formData, directorDetails, professionalDetails },
          uploadedFileUrls,
          userId: user.uid,
          folderId: 'regibiz',
          paymentStatus: payInfo ? 'paid' : (servicePrice > 0 && !packageMode ? 'pending' : 'free'),
          paymentId: (payInfo as RazorpaySuccessResponse)?.razorpay_payment_id || '',
          orderId: (payInfo as RazorpaySuccessResponse)?.razorpay_order_id || '',
          metaData: {
            submittedFrom: window.location.hostname,
            userAgent: navigator.userAgent,
          }
        };

        if (packageMode && onComplete) {
          await clearAllFilesFromIndexedDB(formId);
          localStorage.removeItem('inc22a_formId');
          onComplete(applicationData);
          return;
        }

        await setDoc(doc(db, "applications", formId), applicationData);
        await clearAllFilesFromIndexedDB(formId);
        localStorage.removeItem('inc22a_formId');
        // Mark Firestore draft as submitted
        try { await setDoc(doc(db, 'drafts', `inc22a_${user.uid}`), { status: 'submitted' }, { merge: true }); } catch (_) { }
        setIsSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error: any) {
        console.error("INC-22A Submission failed:", error);
        setSubmitError(error.message || "Submission failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Trigger payment
    setIsPaying(true);
    const started = await displayRazorpay(calculateTotalWithGST(servicePrice), (response) => {
      setPaymentInfo(response);
    }, {
      description: `Service Fee: ₹${servicePrice} + GST (18%): ₹${calculateGST(servicePrice)} = Total: ₹${calculateTotalWithGST(servicePrice)}`,
      prefill: {
        name: user?.displayName || formData.companyName,
        email: user?.email || formData.email || '',
        contact: user?.phoneNumber || ''
      }
    });

    if (!started) {
      setSubmitError("Failed to initiate payment. Please check your connection.");
      setIsPaying(false);
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-red-500/20" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUCCESS STATE
  // ============================================================================

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CelebrationPopup trigger={isSuccess} message="" />
        <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-800">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-2">
            INC-22A Application Submitted!
          </h2>
          <p className="text-slate-400 mb-4 text-sm">
            Your application has been received successfully. Our team will review the details and process your INC-22A filing.
          </p>
          <div className="mb-6">
            <p className="text-slate-500 text-xs mb-1">Your Case ID:</p>
            <p className="text-orange-400 font-mono font-bold text-sm tracking-wide break-all">{formId}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700 space-y-2">
            {[
              ['Company', formData.companyName || '—'],
              ['CIN', formData.cin || '—'],
              ['No. of Directors', directorDetails.length.toString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-xs">
                <span className="text-slate-500">{k}</span>
                <span className="text-white font-medium text-right break-all">{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => { window.location.href = '/#/documents'; }}
              className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Submitted Application
            </button>
            <button
              onClick={() => navigate('/services/inc-22a-filing')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-lg border border-slate-700 text-sm"
            >
              Back to Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN FORM RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {isSubmitting && <ProcessingOverlay />}

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
      {showConfirm?.show && (
        <ConfirmModal
          message={showConfirm.message}
          onConfirm={() => {
            setShowConfirm(null);
            showConfirm.onConfirm?.();
          }}
          onCancel={() => setShowConfirm(null)}
        />
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Form INC-22A (ACTIVE)</h1>
          <p className="text-sky-200/80 text-sm">Step {currentStep} of 3</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-5 left-5 z-20 flex items-center gap-6">
              <FormBackButton onBack={handlePrevious} />
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Exit Session
              </button>
            </div>

            <div className="p-6 md:p-10 flex-grow">
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Form INC-22A (ACTIVE)</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">
                  {currentStep === 1 ? 'Company & Contact Details' :
                    currentStep === 2 ? 'Director Information' : 'Documents & Declaration'}
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Case Reference: <span className="text-cyan-400 font-mono">{formId}</span>
                </p>
              </div>

              <div className="flex items-center justify-center mb-8" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={3}>
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep >= step
                        ? 'bg-gradient-primary text-white shadow-lg shadow-cyan-500/25'
                        : 'bg-slate-700 text-slate-400'
                        }`}
                      aria-current={currentStep === step ? 'step' : undefined}
                    >
                      {currentStep > step ? '✓' : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-16 md:w-20 h-1 mx-2 rounded-full transition-all ${currentStep > step ? 'bg-gradient-primary' : 'bg-slate-700'
                        }`} aria-hidden="true" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {submitError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm" role="alert">
                  ⚠️ {submitError}
                </div>
              )}

              {/* STEP 1: Company Information */}
              {currentStep === 1 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm" aria-hidden="true">1</span>
                    Company Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                      label="Corporate Identity Number (CIN)"
                      name="cin"
                      value={formData.cin}
                      onChange={handleCINChange}
                      onBlur={(e) => handleFieldBlur('cin', e.target.value)}
                      error={errors.cin}
                      required
                      placeholder="U62099PY2026PTC009629"
                      infoText="Enter the CIN exactly as per MCA records"
                      maxLength={21}
                      autoCapitalize="characters"
                      autoComplete="off"
                      className="uppercase"
                      style={{ textTransform: 'uppercase' }}
                    />
                    <FormInput
                      label="Company Name"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      error={errors.companyName}
                      required
                      placeholder="e.g., CloudMaSa ."
                    />
                    <div className="md:col-span-2">
                      <FormInput
                        label="Registered Office Address"
                        name="registeredOffice"
                        value={formData.registeredOffice}
                        onChange={handleChange}
                        error={errors.registeredOffice}
                        required
                        placeholder="Enter complete address"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormInput
                        label="Latitude"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleChange}
                        onBlur={(e) => handleFieldBlur('latitude', e.target.value)}
                        error={errors.latitude}
                        required
                        placeholder="e.g., 12.9716"
                        infoText="GPS latitude of registered office"
                        inputMode="decimal"
                        step="any"
                      />
                      <FormInput
                        label="Longitude"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleChange}
                        onBlur={(e) => handleFieldBlur('longitude', e.target.value)}
                        error={errors.longitude}
                        required
                        placeholder="e.g., 77.5946"
                        infoText="GPS longitude of registered office"
                        inputMode="decimal"
                        step="any"
                      />
                    </div>
                    <FormInput
                      label="Company Email ID"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={(e) => handleFieldBlur('email', e.target.value)}
                      error={errors.email}
                      required
                      placeholder="company@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                    <FormSelect
                      label="Is Company Active?"
                      name="isCompanyActive"
                      value={formData.isCompanyActive}
                      onChange={handleChange}
                      options={[
                        { value: 'yes', label: 'Yes - Company is operational' },
                        { value: 'no', label: 'No - Company is dormant' },
                      ]}
                      required
                    />
                    <FormInput
                      label="Number of Directors"
                      name="numberOfDirectors"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.numberOfDirectors}
                      onChange={handleNumericFormDataChange('numberOfDirectors')}  // ✅ FIXED
                      onBlur={(e) => handleFieldBlur('numberOfDirectors', e.target.value)}
                      error={errors.numberOfDirectors}
                      required
                      inputMode="numeric"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Director Details */}
              {currentStep === 2 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm" aria-hidden="true">2</span>
                    Director Details
                  </h2>
                  {directorDetails.map((director, index) => (
                    <div key={index} className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 mb-5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-cyan-400 font-medium">Director {index + 1}</h3>
                        {directorDetails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDirector(index)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput
                          label="Director Name"
                          name={`directorName-${index}`}
                          value={director.name}
                          onChange={(e) => handleDirectorChange(index, 'name', e.target.value)}
                          error={errors[`director${index}_name`]}
                          required
                          placeholder="e.g., JOHN DOE"
                        />
                        <FormInput
                          label="DIN (Director Identification Number)"
                          name={`directorDIN-${index}`}
                          value={director.din}
                          onChange={(e) => handleDirectorChange(index, 'din', e.target.value)}
                          onBlur={(e) => handleFieldBlur('directorDIN', e.target.value)}
                          error={errors[`director${index}_din`]}
                          required
                          placeholder="8-digit DIN"
                          maxLength={8}
                          inputMode="numeric"
                          pattern="\d*"
                        />
                        <FormInput
                          label="Email Address"
                          name={`directorEmail-${index}`}
                          type="email"
                          value={director.email}
                          onChange={(e) => handleDirectorChange(index, 'email', e.target.value)}
                          onBlur={(e) => handleFieldBlur('email', e.target.value)}
                          error={errors[`director${index}_email`]}
                          required
                          placeholder="director@company.com"
                          autoCapitalize="none"
                          autoComplete="email"
                        />
                        <FormInput
                          label="Phone Number"
                          name={`directorPhone-${index}`}
                          type="tel"
                          value={director.phone}
                          onChange={(e) => handleDirectorChange(index, 'phone', e.target.value)}
                          onBlur={(e) => handleFieldBlur('phone', e.target.value)}
                          error={errors[`director${index}_phone`]}
                          required
                          placeholder="10-digit mobile"
                          maxLength={10}
                          inputMode="numeric"
                          pattern="\d{10}"
                        />
                        <div className="md:col-span-2">
                          <FormInput
                            label="Address"
                            name={`directorAddress-${index}`}
                            value={director.address}
                            onChange={(e) => handleDirectorChange(index, 'address', e.target.value)}
                            error={errors[`director${index}_address`]}
                            required
                            placeholder="e.g., #45, Main Road, Anna Nagar, Chennai - 600040"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDirector}
                    className="w-full py-3 border-2 border-dashed border-cyan-500/50 rounded-lg text-cyan-400 font-medium hover:bg-cyan-500/10 hover:border-cyan-400 transition-all"
                  >
                    + Add Another Director
                  </button>
                </div>
              )}

              {/* STEP 3: Documents & Declaration */}
              {currentStep === 3 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm" aria-hidden="true">3</span>
                    Documents & Declaration
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <FormInput
                      label="AOC-4 SRN (if filed)"
                      name="aoc4Srn"
                      value={formData.aoc4Srn}
                      onChange={(e) => {
                        const upperValue = e.target.value.toUpperCase();
                        setFormData(prev => ({ ...prev, aoc4Srn: upperValue }));
                      }}
                      onBlur={(e) => handleFieldBlur('aoc4Srn', e.target.value)}
                      error={errors.aoc4Srn}
                      optional
                      placeholder="SRN123456789"
                      maxLength={12}
                      autoCapitalize="characters"
                      className="uppercase"
                      style={{ textTransform: 'uppercase' }}
                    />
                    <FormInput
                      label="MGT-7A SRN (if filed)"
                      name="mgt7Srn"
                      value={formData.mgt7Srn}
                      onChange={(e) => {
                        const upperValue = e.target.value.toUpperCase();
                        setFormData(prev => ({ ...prev, mgt7Srn: upperValue }));
                      }}
                      onBlur={(e) => handleFieldBlur('mgt7Srn', e.target.value)}
                      error={errors.mgt7Srn}
                      optional
                      placeholder="SRN987654321"
                      maxLength={12}
                      autoCapitalize="characters"
                      className="uppercase"
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs" aria-hidden="true">📄</span>
                    Upload Required Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                    <FileUploader
                      label="CIN Certificate"
                      name="cinCertificate"
                      onChange={handleFileUpload('cinCertificate')}
                      required
                      accept=".pdf,.jpg,.jpeg,.png"
                      error={fileErrors.cinCertificate}
                      hint="Upload Certificate of Incorporation"
                      uploadedFile={uploadedFiles.cinCertificate as File | null}
                    />

                    {/* ✅ REPLACED MultiFileUploader with two separate FileUploaders */}
                    <FileUploader
                      label="Inside Office Photo (Director Room)"
                      name="insideOfficePhoto"
                      onChange={handleFileUpload('insideOfficePhoto')}
                      required
                      accept="image/*"
                      error={fileErrors.insideOfficePhoto}
                      hint="Photo inside registered office"
                      uploadedFile={uploadedFiles.insideOfficePhoto as File | null}
                    />
                    <FileUploader
                      label="Outside Office Photo (Building/Banner)"
                      name="outsideOfficePhoto"
                      onChange={handleFileUpload('outsideOfficePhoto')}
                      required
                      accept="image/*"
                      error={fileErrors.outsideOfficePhoto}
                      hint="Photo of office building/exterior"
                      uploadedFile={uploadedFiles.outsideOfficePhoto as File | null}
                    />

                    <FileUploader
                      label="Board Resolution"
                      name="boardResolution"
                      onChange={handleFileUpload('boardResolution')}
                      required
                      accept=".pdf"
                      error={fileErrors.boardResolution}
                      hint="Resolution authorizing INC-22A filing"
                      uploadedFile={uploadedFiles.boardResolution as File | null}
                    />
                    <FileUploader
                      label="List of Directors"
                      name="directorList"
                      onChange={handleFileUpload('directorList')}
                      required
                      accept=".pdf,.jpg,.jpeg,.png"
                      error={fileErrors.directorList}
                      hint="Director details with DIN"
                      uploadedFile={uploadedFiles.directorList as File | null}
                    />
                    <FileUploader
                      label="Director Proof Documents"
                      name="directoryProof"
                      onChange={handleFileUpload('directoryProof')}
                      required
                      accept=".pdf,.jpg,.jpeg,.png"
                      error={fileErrors.directoryProof}
                      hint="Address & ID proof for all directors"
                      uploadedFile={uploadedFiles.directoryProof as File | null}
                    />
                    <FileUploader
                      label="AOC-4 Filing Proof"
                      name="aoc4Filing"
                      onChange={handleFileUpload('aoc4Filing')}
                      optional
                      accept=".pdf"
                      error={fileErrors.aoc4Filing}
                      hint="Optional: if already filed"
                      uploadedFile={uploadedFiles.aoc4Filing as File | null}
                    />
                    <FileUploader
                      label="MGT-7A Filing Proof"
                      name="mgt7Filing"
                      onChange={handleFileUpload('mgt7Filing')}
                      optional
                      accept=".pdf"
                      error={fileErrors.mgt7Filing}
                      hint="Optional: if already filed"
                      uploadedFile={uploadedFiles.mgt7Filing as File | null}
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs" aria-hidden="true">👨‍💼</span>
                    Professional Certification (CA/CS/CMA)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
                    <FormSelect
                      label="Professional Type"
                      name="profType"
                      value={professionalDetails.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setProfessionalDetails({ ...professionalDetails, type: e.target.value })
                      }
                      options={[
                        { value: 'Chartered Accountant', label: 'Chartered Accountant' },
                        { value: 'Company Secretary', label: 'Company Secretary' },
                        { value: 'Cost Accountant', label: 'Cost Accountant' },
                      ]}
                      required
                    />
                    <FormInput
                      label="Membership Number"
                      name="profMembership"
                      value={professionalDetails.membershipNumber}
                      onChange={handleNumericProfessionalChange('membershipNumber')}  // ✅ FIXED
                      onBlur={(e) => handleFieldBlur('membershipNumber', e.target.value)}
                      error={errors.profMembership}
                      required
                      placeholder="e.g., 226526"
                      maxLength={7}
                      inputMode="numeric"
                      pattern="\d*"
                    />
                    <FormInput
                      label="Certificate of Practice (COP) Number"
                      name="profCOP"
                      value={professionalDetails.copNumber}
                      onChange={handleNumericProfessionalChange('copNumber')}  // ✅ FIXED - This was the broken one!
                      onBlur={(e) => handleFieldBlur('copNumber', e.target.value)}
                      error={errors.profCOP}
                      required
                      placeholder="e.g., 12345"
                      maxLength={8}
                      inputMode="numeric"
                      pattern="\d*"
                    />
                    <FormInput
                      label="Professional Email"
                      name="profEmail"
                      type="email"
                      value={professionalDetails.email}
                      onChange={(e) => setProfessionalDetails({ ...professionalDetails, email: e.target.value })}
                      onBlur={(e) => handleFieldBlur('profEmail', e.target.value)}
                      error={errors.profEmail}
                      required
                      placeholder="ca@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </div>

                  <div className="mb-6">
                    <FormInput
                      label="Additional Remarks"
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleChange}
                      optional
                      placeholder="Any additional information..."
                      className="bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg p-3 focus:border-cyan-500 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-8 pt-6 border-t border-slate-700/50">
                {currentStep < 3 ? (
                  <div className="flex justify-end w-full">
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={isSubmitting}
                      className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                    >
                      Save & Next Step →
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end w-full">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {(servicePrice > 0 && !packageMode) ? 'Pay & Submit' : 'Submit Application'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </main>

          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8 self-start">
            <ProgressSidebar
              currentStep={currentStep}
              formId={formId}
              directorCount={directorDetails.length}
              uploadedCount={uploadedCount}
              totalRequired={4}
              packageMode={packageMode}
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

// ============================================================================
// PROGRESS SIDEBAR COMPONENT
// ============================================================================

const ProgressSidebar: React.FC<{
  currentStep: number;
  formId: string;
  directorCount: number;
  uploadedCount: number;
  totalRequired: number;
  packageMode?: boolean;
  isDraftSaving?: boolean;
  lastDraftSavedAt?: Date | null;
}> = ({
  currentStep,
  formId,
  directorCount,
  uploadedCount,
  totalRequired,
  packageMode,
  isDraftSaving,
  lastDraftSavedAt,
}) => {
    const steps = [
      { label: 'Company Details', step: 1 },
      { label: 'Director Info', step: 2 },
      { label: 'Documents', step: 3 },
    ];

    return (
      <div className="space-y-6 hidden lg:block">
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
            <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            Filing Progress
          </h3>
          <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
            {steps.map(({ label, step }) => {
              const status = step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending';
              return (
                <div key={step} className="ml-5 relative">
                  <span
                    className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${status === 'completed'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : status === 'active'
                        ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                        : 'bg-slate-700'
                      }`}
                    aria-hidden="true"
                  />
                  <h4 className={`text-sm font-medium ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                    {label}
                  </h4>
                  <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
                    {status === 'completed' ? 'Completed' : status === 'active' ? 'In Progress' : 'Pending'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
            <span className="bg-amber-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            INC-22A Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Case ID</span>
              <span className="text-cyan-400 font-mono">{formId || 'Generating...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Directors</span>
              <span className="text-white font-medium">{directorCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Documents</span>
              <span className="text-white font-medium">{uploadedCount}/{totalRequired} uploaded</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
              <span className="text-slate-400">Draft</span>
              {isDraftSaving ? (
                <span className="text-amber-400 text-xs flex items-center gap-1">
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Saving...
                </span>
              ) : lastDraftSavedAt ? (
                <span className="text-emerald-400 text-xs">✓ Saved {lastDraftSavedAt.toLocaleTimeString()}</span>
              ) : (
                <span className="text-slate-500 text-xs">Not saved yet</span>
              )}
            </div>
          </div>

          <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
            <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
              <span className="bg-rose-500/20 p-1.5 rounded mr-2">
                <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </span>
              Need Help?
            </h3>
            <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-white/5">
              <span className="text-slate-400 font-medium text-xs">contact Support</span>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
                <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
              </div>
            </div>
          </div>
        </div>

        {!packageMode && (
          <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
            <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
              <span className="bg-emerald-500/20 p-1.5 rounded mr-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Price Breakdown
            </h3>
            <div className="space-y-3 pt-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Service Fee</span>
                <span className="text-white font-medium">₹{PRICING_CONFIG['inc22a']?.fee?.toLocaleString() || '1999'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">GST (18%)</span>
                <span className="text-white font-medium">₹{calculateGST(PRICING_CONFIG['inc22a']?.fee || 1999).toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-700/50 pt-2 flex justify-between text-base">
                <span className="text-white font-bold">Total Payable</span>
                <span className="text-cyan-400 font-bold">₹{calculateTotalWithGST(PRICING_CONFIG['inc22a']?.fee || 1999).toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">* Exclusive of ROC late filing fees</p>
            </div>
          </div>
        )}

        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
            <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Filing Note
          </h3>
          <p className="text-xs text-slate-400 leading-6">
            Ensure all company details match MCA records. Upload clear photographs of registered office and valid director proofs to avoid delays.
          </p>
        </div>
      </div>
    );
  };
