import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from './firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CelebrationPopup from '../components/CelebrationPopup';
import { sendConfirmationEmail } from './emailService';
import { useRazorpay } from '../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import FormBackButton from '../components/FormBackButton';
import { buildInitialApplicationStatus } from './applicationStatus';
import { saveFileToDraft, restoreFilesFromDraft, clearAllFilesFromDraft } from './formDraft';

// --- Validators ---
const validators = {
  required: (value: string): boolean => value.trim().length > 0,
  cin: (value: string): boolean => /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(value),
  date: (value: string): boolean => value.length > 0,
  number: (value: string): boolean => /^\d+(\.\d{1,2})?$/.test(value),
  email: (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  din: (value: string): boolean => /^\d{8}$/.test(value),
  ifsc: (value: string): boolean => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value),
  amount: (value: string): boolean => /^\d+(\.\d{1,2})?$/.test(value),
  accountNumber: (value: string): boolean => /^\d{9,18}$/.test(value),
  resolutionNumber: (value: string): boolean => /^[A-Z]{1,10}[ \-/][0-9A-Z]{1,10}$/i.test(value),
};

const errorMessages = {
  required: "This field is required",
  cin: "Invalid CIN format",
  date: "Date is required",
  number: "Invalid number format",
  email: "Invalid email format",
  din: "DIN must be 8 digits",
  ifsc: "Invalid IFSC code",
  amount: "Enter valid amount",
  accountNumber: "Invalid Account Number (9-18 digits)",
  resolutionNumber: "Format: e.g., BR-01 (Letter prefix required)",
};

// --- Form Components ---
interface FormInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}


const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  value,
  onChange,
  error,
  required = false,
  type = "text",
  placeholder,
  onBlur
}) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-white mb-1.5 transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg p-3 ${error ? 'border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500'
        } focus:ring-2 focus:outline-none transition-colors`}
    />

    {error && <p className="mt-1 text-xs text-red-400 animate-pulse">{error}</p>}
  </div>
);

interface FormSelectProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
}


const FormSelect: React.FC<FormSelectProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required = false,
  onBlur
}) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-white mb-1.5 transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg p-3 ${error ? 'border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500'
        } focus:ring-2 focus:outline-none transition-colors`}
    >

      <option value="">Select an option</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p className="mt-1 text-xs text-red-400 animate-pulse">{error}</p>}
  </div>
);

interface FileUploaderProps {
  label: string;
  name: string;
  onChange: (file: File | null) => void;
  required?: boolean;
  accept?: string;
  error?: string;
  existingUrl?: string;
  uploadedFile?: File | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  name,
  onChange,
  required = false,
  accept = ".pdf",
  error,
  existingUrl,
  uploadedFile
}) => {
  const [fileName, setFileName] = useState<string>("");

  useEffect(() => {
    if (uploadedFile) {
      setFileName(uploadedFile.name);
    } else if (existingUrl) {
      setFileName(existingUrl.split('/').pop()?.split('?')[0] || 'Previously uploaded file');
    } else {
      setFileName("");
    }
  }, [uploadedFile, existingUrl]);

  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-1.5 transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={`border-2 border-dashed rounded-lg p-4 transition-colors ${error ? 'border-red-500 bg-red-500/5' : 'border-slate-700 hover:border-cyan-500'
        }`}>
        <input
          type="file"
          name={name}
          accept={accept}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] || null;
            if (file) {
              setFileName(file.name);
              onChange(file);
            } else {
              setFileName("");
              onChange(null);
            }
          }}
          className="hidden"
          id={name}
        />
        <label htmlFor={name} className="cursor-pointer flex flex-col items-center justify-center text-center">
          {fileName ? (
            <div>
              <span className="text-emerald-400 text-sm font-medium break-all block">{fileName}</span>
              {existingUrl && !uploadedFile && (
                <a href={existingUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-cyan-400 hover:underline mt-1 block"
                  onClick={(e) => e.stopPropagation()}>
                  View existing document
                </a>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-sm">Click to upload {accept.replace(/\./g, '').toUpperCase()} file</span>
          )}
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-400 animate-pulse">{error}</p>}
    </div>
  );
};

// Multi-File Uploader for Registered Office Photos
interface MultiFileUploaderProps {
  label: string;
  name: string;
  onChange: (files: File[]) => void;
  required?: boolean;
  accept?: string;
  error?: string;
  maxFiles?: number;
  existingUrls?: string[];
  uploadedFiles?: File[];
}

type UploadedFileValue = File | File[] | null;

const MultiFileUploader: React.FC<MultiFileUploaderProps> = ({
  label,
  name,
  onChange,
  required = false,
  accept = "image/*",
  error,
  maxFiles = 2,
  existingUrls,
  uploadedFiles = []
}) => {
  const [fileNames, setFileNames] = useState<string[]>([]);

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      setFileNames(uploadedFiles.map(f => f.name));
    } else if (existingUrls && existingUrls.length > 0) {
      setFileNames(existingUrls.map(url => url.split('/').pop()?.split('?')[0] || 'Previous upload'));
    } else {
      setFileNames([]);
    }
  }, [uploadedFiles, existingUrls]);

  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-1.5 transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={`border-2 border-dashed rounded-lg p-4 transition-colors ${error ? 'border-red-500 bg-red-500/5' : 'border-slate-700 hover:border-cyan-500'
        }`}>
        <input
          type="file"
          name={name}
          accept={accept}
          multiple
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              const fileNamesList = files.map(f => f.name);
              setFileNames(fileNamesList);
              onChange(files);
            } else {
              setFileNames([]);
              onChange([]);
            }
          }}
          className="hidden"
          id={name}
        />
        <label htmlFor={name} className="cursor-pointer flex flex-col items-center justify-center text-center">
          {fileNames.length > 0 ? (
            <div className="space-y-2">
              {fileNames.map((name, idx) => (
                <span key={idx} className="text-emerald-400 text-sm font-medium break-all block">{name}</span>
              ))}
              <span className="text-slate-500 text-xs mt-2 block">{fileNames.length} file(s) selected</span>
              {existingUrls && uploadedFiles.length === 0 && (
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {existingUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-cyan-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}>
                      View Photo {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-sm">Click to upload photos (Inside & Outside)<br /><span className="text-xs text-slate-500">Accept: JPG, PNG, JPEG</span></span>
          )}
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-400 animate-pulse">{error}</p>}
    </div>
  );
};

const ProgressSidebar: React.FC<{ 
  currentStep: number; 
  formId: string; 
  subscriberCount: number; 
  uploadedCount: number;
  isDraftSaving?: boolean;
  lastDraftSavedAt?: Date | null;
}> = ({
  currentStep,
  formId,
  subscriberCount,
  uploadedCount,
  isDraftSaving,
  lastDraftSavedAt,
}) => {
  const steps = [
    { label: 'Company Info', step: 1 },
    { label: 'Subscribers', step: 2 },
    { label: 'Declaration & Docs', step: 3 },
  ];

  return (
    <div className="space-y-6 hidden lg:block">
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
          <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <span className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${status === 'completed'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : status === 'active'
                    ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                    : 'bg-slate-700'
                  }`} />
                <h4 className={`text-sm font-medium ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}>{label}</h4>
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
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          INC-20A Summary
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Case ID</span>
            <span className="text-cyan-400 font-mono">{formId || 'Generating...'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Subscribers</span>
            <span className="text-white font-medium">{subscriberCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Documents</span>
            <span className="text-white font-medium">{uploadedCount}/2 ready</span>
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
      </div>

      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-emerald-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </span>
          Price Breakdown
        </h3>
        <div className="space-y-3 pt-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Service Fee</span>
            <span className="text-white font-medium">₹{PRICING_CONFIG['inc-20a']?.fee?.toLocaleString() || '299'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">GST (18%)</span>
            <span className="text-white font-medium">₹{calculateGST(PRICING_CONFIG['inc-20a']?.fee || 299).toLocaleString()}</span>
          </div>
          <div className="border-t border-slate-700/50 pt-2 flex justify-between font-bold">
            <span className="text-white">Total Amount</span>
            <span className="text-cyan-400">₹{calculateTotalWithGST(PRICING_CONFIG['inc-20a']?.fee || 299).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          Filing Note
        </h3>
        <p className="text-xs text-slate-400 leading-6">
          Keep company details aligned with MCA master data and upload legible proof documents to avoid rework during verification.
        </p>
      </div>
    </div>
  );
};

// --- Types ---
interface SubscriberPayment {
  shareholderName: string;
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  dateOfReceipt: string;
  amountReceived: string;
}

interface ProfessionalDetails {
  type: string;
  membershipNumber: string;
  copNumber: string;
  email: string;
}

interface FormData {
  cin: string;
  companyName: string;
  registeredOffice: string;
  email: string;
  certificateOfIncorporationDate: string;
  commencementDeclarationDate: string;
  bankAccountOpeningDate: string;
  inc20aFilingSrn: string;
  numberOfShareholders: string;
  sectoralRegulator: string;
  resolutionNumber: string;
  resolutionDate: string;
  directorDIN: string;
}

// --- Main INC-20A Form ---
interface INC20AFormProps {
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

export default function INC20AForm({ user, packageMode, onComplete, onBack, initialData, existingDocs }: INC20AFormProps) {
  const navigate = useNavigate();
  const initialFormData: FormData = {
    cin: initialData?.cin || '',
    companyName: initialData?.companyName || '',
    registeredOffice: initialData?.registeredOffice || '',
    email: initialData?.email || '',
    certificateOfIncorporationDate: initialData?.certificateOfIncorporationDate || '',
    commencementDeclarationDate: initialData?.commencementDeclarationDate || '',
    bankAccountOpeningDate: initialData?.bankAccountOpeningDate || '',
    inc20aFilingSrn: initialData?.inc20aFilingSrn || '',
    numberOfShareholders: initialData?.numberOfShareholders || '3',
    sectoralRegulator: initialData?.sectoralRegulator || 'no',
    resolutionNumber: initialData?.resolutionNumber || '',
    resolutionDate: initialData?.resolutionDate || '',
    directorDIN: initialData?.directorDIN || '',
  };
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [formId, setFormId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const { displayRazorpay } = useRazorpay();
  const servicePrice = PRICING_CONFIG['inc-20a']?.fee ?? 0;
  // Draft state
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [subscriberPayments, setSubscriberPayments] = useState<SubscriberPayment[]>(initialData?.subscriberPayments || [
    { shareholderName: '', bankName: '', ifscCode: '', accountNumber: '', dateOfReceipt: '', amountReceived: '' }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});


  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileValue>>({
    boardResolution: null,
    insideOfficePhoto: null,
    outsideOfficePhoto: null,
  });

  const [professionalDetails, setProfessionalDetails] = useState<ProfessionalDetails>({
    type: 'Chartered Accountant',
    membershipNumber: '',
    copNumber: '',
    email: '',
  });

  const uploadedCount = Object.values(uploadedFiles).filter(val => {
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val);
  }).length;

  const stepTitle = () => {
    if (currentStep === 1) return 'Company Information';
    if (currentStep === 2) return 'Subscriber Payment Details';
    return 'Declaration, Certification & Documents';
  };

  useEffect(() => {
    const id = `INC20A-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
    setFormId(prev => prev || id);
  }, []);

  // saveDraft — Firestore-based
  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid || packageMode) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `inc20a_${user.uid}`), {
        userId: user.uid,
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        extra: { subscriberPayments, professionalDetails },
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: formId,
        serviceType: 'inc20a',
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
        const snap = await getDoc(doc(db, 'drafts', `inc20a_${user.uid}`));
        if (snap.exists()) {
          const data = snap.data();
          if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));
          if (data.currentStep) setCurrentStep(Math.min(Math.max(data.currentStep, 1), 3));
          if (data.caseId) setFormId(data.caseId);
          if (data.extra?.subscriberPayments) setSubscriberPayments(data.extra.subscriberPayments);
          if (data.extra?.professionalDetails) setProfessionalDetails(data.extra.professionalDetails);
        }
      } catch (err) {
        console.error('Draft load failed:', err);
      }
    };
    loadDraft();
  }, [packageMode, user?.uid]);

  // Restore uploaded files from draft on mount
  useEffect(() => {
    const restoreFiles = async () => {
      if (packageMode) return;
      const files = await restoreFilesFromDraft('inc20a_files', ['boardResolution', 'insideOfficePhoto', 'outsideOfficePhoto']);
      setUploadedFiles(prev => ({ ...prev, ...files }));
    };
    restoreFiles();
  }, [packageMode]);

  // Save uploaded files whenever they change
  useEffect(() => {
    if (packageMode || isSuccess) return;
    const saveFiles = async () => {
      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file && !Array.isArray(file)) {
          await saveFileToDraft('inc20a_files', key, file);
        }
      }
    };
    saveFiles();
  }, [uploadedFiles, packageMode, isSuccess]);

  // Auto-save draft on step/formData change
  useEffect(() => {
    if (packageMode || isSuccess) return;
    const timer = setTimeout(() => saveDraft(), 2000);
    return () => clearTimeout(timer);
  }, [currentStep, formData, subscriberPayments, professionalDetails, packageMode, isSuccess]);

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
        navigate('/services/inc-20a-filing');
      } catch (err) {
        console.error('Exit save failed:', err);
        setShowExitConfirm(false);
      } finally {
        setIsDraftSaving(false);
      }
    } else {
      setShowExitConfirm(false);
      navigate('/services/inc-20a-filing');
    }
  };

  // Payment-Gated Auto-Submit Effect
  useEffect(() => {
    if (paymentInfo && !isSubmitting && !isSuccess) {
      handleFinalSubmission(paymentInfo);
    }
  }, [paymentInfo]);

  const handleFinalSubmission = async (payInfo?: RazorpaySuccessResponse) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const uploadedFileUrls: Record<string, any> = { ...existingDocs };

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (!file) continue;

        if (Array.isArray(file)) {
          const fileArray = file as File[];
          const urls: any[] = [];

          for (const selectedFile of fileArray) {
            const filePath = `inc20a/${user.uid}/${formId}/${key}_${Date.now()}_${selectedFile.name}`;
            const storageRef = ref(storage, filePath);
            await uploadBytes(storageRef, selectedFile);
            const url = await getDownloadURL(storageRef);
            urls.push({
              url,
              name: selectedFile.name,
              type: selectedFile.type,
              uploadedAt: new Date()
            });
          }

          uploadedFileUrls[key] = urls;
        } else {
          const selectedFile = file as File;
          const filePath = `inc20a/${user.uid}/${formId}/${key}_${Date.now()}_${selectedFile.name}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, selectedFile);
          const url = await getDownloadURL(storageRef);
          uploadedFileUrls[key] = {
            url,
            name: selectedFile.name,
            type: selectedFile.type,
            uploadedAt: new Date()
          };
        }
      }

      const submissionData = {
        id: formId,
        type: 'inc20a',
        title: 'INC-20A - Commencement of Business',
        ...buildInitialApplicationStatus({ serviceType: 'inc20a', serviceName: 'INC-20A - Commencement of Business', userId: user.uid }),
        submittedAt: serverTimestamp(),
        formData: { ...formData, subscriberPayments, professionalDetails },
        uploadedFileUrls,
        userId: user.uid,
        folderId: 'regibiz',
        paymentStatus: payInfo ? 'paid' : (servicePrice > 0 && !packageMode ? 'pending' : 'free'),
        paymentId: payInfo?.razorpay_payment_id || '',
        orderId: payInfo?.razorpay_order_id || '',
        metaData: {
          submittedFrom: window.location.hostname,
          userAgent: navigator.userAgent,
        }
      };

      if (packageMode && onComplete) {
        await clearAllFilesFromDraft('inc20a_files', ['boardResolution', 'insideOfficePhoto', 'outsideOfficePhoto']);
        onComplete(submissionData);
        return;
      }

      await setDoc(doc(db, "applications", formId), submissionData);
      try {
        await sendConfirmationEmail({
          name: formData.companyName,
          email: user.email || formData.email || '',
          service: "INC-20A Application",
          caseId: formId
        });
      } catch (err) {
        console.error("Email failed", err);
      }
      // Mark Firestore draft as submitted
      try { await setDoc(doc(db, 'drafts', `inc20a_${user.uid}`), { status: 'submitted' }, { merge: true }); } catch (_) { }
      await clearAllFilesFromDraft('inc20a_files', ['boardResolution', 'insideOfficePhoto', 'outsideOfficePhoto']);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error("INC-20A Submission failed:", error);
      setSubmitError(error.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const focusField = (fieldName: string) => {
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[name="${fieldName}"]`);
      if (!field) {
        return;
      }

      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus();
    });
  };

  const validateField = (name: string, value: any): string => {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      switch (name) {
        case 'cin':
          return validators.cin(trimmedValue) ? '' : errorMessages.cin;
        case 'companyName':
        case 'registeredOffice':
          return validators.required(trimmedValue) ? '' : errorMessages.required;
        case 'email':
          return validators.email(trimmedValue) ? '' : errorMessages.email;
        case 'certificateOfIncorporationDate':
        case 'commencementDeclarationDate':
        case 'bankAccountOpeningDate':
          return validators.date(trimmedValue) ? '' : errorMessages.date;
        case 'directorDIN':
          return validators.din(trimmedValue) ? '' : errorMessages.din;
        case 'resolutionNumber':
          return validators.resolutionNumber(trimmedValue) ? '' : errorMessages.resolutionNumber;
        case 'resolutionDate':
          return validators.date(trimmedValue) ? '' : errorMessages.date;
        default:
          if (name.startsWith('shareholderName-') || name.startsWith('bankName-')) {
            return validators.required(trimmedValue) ? '' : errorMessages.required;
          }
          if (name.startsWith('accountNumber-')) {
            return validators.accountNumber(trimmedValue) ? '' : errorMessages.accountNumber;
          }
          if (name.startsWith('ifscCode-')) {
            return validators.ifsc(trimmedValue) ? '' : errorMessages.ifsc;
          }
          if (name.startsWith('amountReceived-')) {
            return validators.amount(trimmedValue) ? '' : errorMessages.amount;
          }
          if (name.startsWith('dateOfReceipt-')) {
            return validators.date(trimmedValue) ? '' : errorMessages.date;
          }
          return '';
      }
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cin') {
      formattedValue = value.toUpperCase().slice(0, 21);
    }
    if (name === 'resolutionNumber') {
      formattedValue = value.toUpperCase().slice(0, 20);
    }
    if (name === 'directorDIN') {
      formattedValue = value.replace(/\D/g, '').slice(0, 8);
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));

    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, formattedValue) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };


  const handleSubscriberChange = (index: number, field: keyof SubscriberPayment, value: string) => {
    const updated = [...subscriberPayments];
    let formattedValue = value;
    if (field === 'ifscCode') formattedValue = value.toUpperCase().slice(0, 11);
    if (field === 'amountReceived') formattedValue = value.replace(/\D/g, '').slice(0, 15);
    if (field === 'accountNumber') formattedValue = value.replace(/\D/g, '').slice(0, 18);

    updated[index] = { ...updated[index], [field]: formattedValue };
    setSubscriberPayments(updated);

    const name = `${field}-${index}`;
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, formattedValue) }));
    }
  };


  const addSubscriber = () => {
    setSubscriberPayments([
      ...subscriberPayments,
      { shareholderName: '', bankName: '', ifscCode: '', accountNumber: '', dateOfReceipt: '', amountReceived: '' }
    ]);
  };

  const removeSubscriber = (index: number) => {
    if (subscriberPayments.length > 1) {
      setSubscriberPayments(subscriberPayments.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = (key: string) => (file: File | null) => {
    setUploadedFiles(prev => ({ ...prev, [key]: file }));
    if (fileErrors[key]) {
      setFileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handleMultiFileUpload = (key: string) => (files: File[]) => {
    setUploadedFiles(prev => ({ ...prev, [key]: files }));
    if (fileErrors[key]) {
      setFileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    let firstInvalidField = '';

    if (step === 1) {
      if (!validators.cin(formData.cin)) {
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
      if (!validators.email(formData.email)) {
        newErrors.email = errorMessages.email;
        firstInvalidField ||= 'email';
      }
      if (!validators.date(formData.certificateOfIncorporationDate)) {
        newErrors.certificateOfIncorporationDate = errorMessages.date;
        firstInvalidField ||= 'certificateOfIncorporationDate';
      }
    }

    if (step === 2) {
      subscriberPayments.forEach((sub, idx) => {
        if (!validators.required(sub.shareholderName)) {
          newErrors[`shareholderName-${idx}`] = errorMessages.required;
          firstInvalidField ||= `shareholderName-${idx}`;
        }
        if (!validators.required(sub.bankName)) {
          newErrors[`bankName-${idx}`] = errorMessages.required;
          firstInvalidField ||= `bankName-${idx}`;
        }
        if (!validators.ifsc(sub.ifscCode)) {
          newErrors[`ifscCode-${idx}`] = errorMessages.ifsc;
          firstInvalidField ||= `ifscCode-${idx}`;
        }
        if (!validators.required(sub.accountNumber)) {
          newErrors[`accountNumber-${idx}`] = errorMessages.required;
          firstInvalidField ||= `accountNumber-${idx}`;
        }
        if (!validators.date(sub.dateOfReceipt)) {
          newErrors[`dateOfReceipt-${idx}`] = errorMessages.date;
          firstInvalidField ||= `dateOfReceipt-${idx}`;
        }
        if (!validators.amount(sub.amountReceived)) {
          newErrors[`amountReceived-${idx}`] = errorMessages.amount;
          firstInvalidField ||= `amountReceived-${idx}`;
        }
      });
    }

    if (step === 3) {
      if (!validators.required(formData.resolutionNumber)) {
        newErrors.resolutionNumber = errorMessages.required;
        firstInvalidField ||= 'resolutionNumber';
      }
      if (!validators.date(formData.resolutionDate)) {
        newErrors.resolutionDate = errorMessages.date;
        firstInvalidField ||= 'resolutionDate';
      }
      if (!validators.din(formData.directorDIN)) {
        newErrors.directorDIN = errorMessages.din;
        firstInvalidField ||= 'directorDIN';
      }
      if (!validators.date(formData.commencementDeclarationDate)) {
        newErrors.commencementDeclarationDate = errorMessages.date;
        firstInvalidField ||= 'commencementDeclarationDate';
      }
      if (!validators.date(formData.bankAccountOpeningDate)) {
        newErrors.bankAccountOpeningDate = errorMessages.date;
        firstInvalidField ||= 'bankAccountOpeningDate';
      }

      if (!validators.required(professionalDetails.membershipNumber)) {
        newErrors.profMembership = errorMessages.required;
        firstInvalidField ||= 'profMembership';
      }
      if (!validators.required(professionalDetails.copNumber)) {
        newErrors.profCOP = errorMessages.required;
        firstInvalidField ||= 'profCOP';
      }
      if (!validators.email(professionalDetails.email)) {
        newErrors.profEmail = errorMessages.email;
        firstInvalidField ||= 'profEmail';
      }
    }

    setErrors(newErrors);
    if (firstInvalidField) {
      focusField(firstInvalidField);
    }
    return Object.keys(newErrors).length === 0;
  };

  const isStepValid = (step: number): boolean => {
    if (step === 1) {
      return (
        validators.cin(formData.cin) &&
        validators.required(formData.companyName) &&
        validators.required(formData.registeredOffice) &&
        validators.email(formData.email) &&
        validators.date(formData.certificateOfIncorporationDate)
      );
    }
    if (step === 2) {
      return subscriberPayments.every(sub =>
        validators.required(sub.shareholderName) &&
        validators.required(sub.bankName) &&
        validators.ifsc(sub.ifscCode) &&
        validators.required(sub.accountNumber) &&
        validators.date(sub.dateOfReceipt) &&
        validators.amount(sub.amountReceived)
      );
    }
    if (step === 3) {
      return (
        validators.required(formData.resolutionNumber) &&
        validators.date(formData.resolutionDate) &&
        validators.din(formData.directorDIN) &&
        validators.date(formData.commencementDeclarationDate) &&
        validators.date(formData.bankAccountOpeningDate) &&
        validators.required(professionalDetails.membershipNumber) &&
        validators.required(professionalDetails.copNumber) &&
        validators.email(professionalDetails.email)
      );
    }
    return false;
  };


  const validateFiles = (): boolean => {
    const newFileErrors: Record<string, string> = {};
    const requiredDocs: Record<string, string> = {
      boardResolution: 'Board Resolution is required',
      insideOfficePhoto: 'Inside Office Photo is required',
      outsideOfficePhoto: 'Outside Office Photo is required',
    };

    Object.entries(requiredDocs).forEach(([key, message]) => {
      const file = uploadedFiles[key];
      const existing = existingDocs?.[key];

      if (!file && !existing) {
        newFileErrors[key] = message;
      }
    });

    setFileErrors(newFileErrors);
    return Object.keys(newFileErrors).length === 0;
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
          message: 'Go back to services? Your draft will be saved locally.',
          onConfirm: () => navigate('/services/inc-20a-filing')
        });
      }
      return;
    }

    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitError(null);

    const stepValid = validateStep(3);
    const filesValid = validateFiles();

    if (!stepValid || !filesValid) {
      setSubmitError("Please fill all required fields and upload all documents");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If in package mode, or fee is 0, skip direct payment
    if (packageMode || servicePrice === 0) {
      await handleFinalSubmission();
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

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CelebrationPopup trigger={isSuccess} message="" />
        <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-800">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-2">
            INC-20A Application Submitted!
          </h2>
          <p className="text-slate-400 mb-4 text-sm">
            Your application has been received successfully. Our team will review the commencement details and contact you if any clarification is required.
          </p>
          <div className="mb-6">
            <p className="text-slate-500 text-xs mb-1">Your Case ID:</p>
            <p className="text-orange-400 font-mono font-bold text-sm tracking-wide break-all">{formId}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700 space-y-2">
            {[
              ['Company', formData.companyName || '—'],
              ['CIN', formData.cin || '—'],
              ['Director DIN', formData.directorDIN || '—'],
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Submitted Application
            </button>
            <button
              onClick={() => navigate('/services')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-lg border border-slate-700 text-sm"
            >
              Back to Services
            </button>
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
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {isSubmitting && <ProcessingOverlay />}

      {showDraftSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_20px_50px_rgba(16,185,129,0.1)] scale-in-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Draft Saved!</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
              Your INC-20A registration progress has been securely saved.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/5 py-2.5 px-5 rounded-full border border-emerald-400/10 w-fit mx-auto shadow-inner shadow-emerald-400/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Redirecting to Panel...
            </div>
          </div>
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
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Form INC-20A</h1>
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
                <h1 className="text-3xl font-bold text-white mb-3">Form INC-20A</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">{stepTitle()}</p>
                <p className="text-slate-500 text-sm mt-2">
                  Case Reference: <span className="text-cyan-400 font-mono">{formId}</span>
                </p>
              </div>

              <div className="flex items-center justify-center mb-8">
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep >= step
                      ? 'bg-gradient-primary text-white shadow-lg shadow-cyan-500/25'
                      : 'bg-slate-700 text-slate-400'
                      }`}>
                      {currentStep > step ? '✓' : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-16 md:w-20 h-1 mx-2 rounded-full transition-all ${currentStep > step ? 'bg-gradient-primary' : 'bg-slate-700'
                        }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {submitError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  ⚠️ {submitError}
                </div>
              )}

              {currentStep === 1 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">1</span>
                    Company Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                      label="Corporate Identity Number (CIN)"
                      name="cin"
                      value={formData.cin}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.cin}
                      required
                      placeholder="U62099PY2026PTC009629"
                    />
                    <FormInput
                      label="Company Name"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.companyName}
                      required
                    />
                    <FormInput
                      label="Certificate of Incorporation Date"
                      name="certificateOfIncorporationDate"
                      type="date"
                      value={formData.certificateOfIncorporationDate}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.certificateOfIncorporationDate}
                      required
                    />
                    <div className="md:col-span-2">
                      <FormInput
                        label="Registered Office Address"
                        name="registeredOffice"
                        value={formData.registeredOffice}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.registeredOffice}
                        required
                        placeholder="Enter complete address"
                      />
                    </div>
                    <FormInput
                      label="Email ID"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.email}
                      required
                      placeholder="contact@company.com"
                    />

                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">2</span>
                    Subscriber Payment Details
                  </h2>
                  {subscriberPayments.map((subscriber, index) => (
                    <div key={index} className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 mb-5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-cyan-400 font-medium">Shareholder {index + 1}</h3>
                        {subscriberPayments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSubscriber(index)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput
                          label="Shareholder Name"
                          name={`shareholderName-${index}`}
                          value={subscriber.shareholderName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubscriberChange(index, 'shareholderName', e.target.value)}
                          onBlur={handleBlur}
                          error={errors[`shareholderName-${index}`]}
                          required
                        />
                        <FormInput
                          label="Bank Name"
                          name={`bankName-${index}`}
                          value={subscriber.bankName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubscriberChange(index, 'bankName', e.target.value)}
                          onBlur={handleBlur}
                          error={errors[`bankName-${index}`]}
                          required
                          placeholder="IDFC First Bank"
                        />
                        <FormInput
                          label="IFSC Code"
                          name={`ifscCode-${index}`}
                          value={subscriber.ifscCode}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubscriberChange(index, 'ifscCode', e.target.value)}
                          onBlur={handleBlur}
                          error={errors[`ifscCode-${index}`]}
                          required
                          placeholder="IDFB0081512"
                        />
                        <FormInput
                          label="Account Number"
                          name={`accountNumber-${index}`}
                          value={subscriber.accountNumber}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubscriberChange(index, 'accountNumber', e.target.value)}
                          onBlur={handleBlur}
                          error={errors[`accountNumber-${index}`]}
                          required
                          placeholder="e.g., 909010098765432"
                        />
                        <FormInput
                          label="Date of Receipt"
                          name={`dateOfReceipt-${index}`}
                          type="date"
                          value={subscriber.dateOfReceipt}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubscriberChange(index, 'dateOfReceipt', e.target.value)}
                          onBlur={handleBlur}
                          error={errors[`dateOfReceipt-${index}`]}
                          required
                        />
                        <FormInput
                          label="Amount Received (₹)"
                          name={`amountReceived-${index}`}
                          value={subscriber.amountReceived}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubscriberChange(index, 'amountReceived', e.target.value)}
                          onBlur={handleBlur}
                          error={errors[`amountReceived-${index}`]}
                          required
                          placeholder="9600"
                        />

                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSubscriber}
                    className="w-full py-3 border-2 border-dashed border-cyan-500/50 rounded-lg text-cyan-400 font-medium hover:bg-cyan-500/10 hover:border-cyan-400 transition-all"
                  >
                    + Add Another Shareholder
                  </button>
                </div>
              )}

              {currentStep === 3 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">3</span>
                    Declaration & Professional Certification
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                    <FormInput
                      label="Resolution Number"
                      name="resolutionNumber"
                      value={formData.resolutionNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.resolutionNumber}
                      required
                      placeholder="e.g., BR-01"
                    />
                    <FormInput
                      label="Resolution Date"
                      name="resolutionDate"
                      type="date"
                      value={formData.resolutionDate}
                      onChange={handleChange}
                      error={errors.resolutionDate}
                      required
                    />
                    <FormInput
                      label="Director DIN"
                      name="directorDIN"
                      value={formData.directorDIN}
                      onChange={handleChange}
                      error={errors.directorDIN}
                      required
                      placeholder="10842644"
                    />
                    <FormInput
                      label="Declaration of Commencement Date"
                      name="commencementDeclarationDate"
                      type="date"
                      value={formData.commencementDeclarationDate}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.commencementDeclarationDate}
                      required
                    />
                    <FormInput
                      label="Bank Account Opening Date"
                      name="bankAccountOpeningDate"
                      type="date"
                      value={formData.bankAccountOpeningDate}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.bankAccountOpeningDate}
                      required
                    />
                    <FormInput
                      label="MCA INC-20A SRN"
                      name="inc20aFilingSrn"
                      value={formData.inc20aFilingSrn}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.inc20aFilingSrn}
                      placeholder="Optional after MCA upload"
                    />
                    <FormSelect
                      label="Sectoral Regulator (RBI/SEBI/IRDAI)"
                      name="sectoralRegulator"
                      value={formData.sectoralRegulator}
                      onChange={handleChange}
                      options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
                      required
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">👨‍💼</span>
                    Professional Details (CA/CS/CMA)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
                    <FormSelect
                      label="Professional Type"
                      name="profType"
                      value={professionalDetails.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setProfessionalDetails({ ...professionalDetails, type: e.target.value });
                        if (touched.profType) setErrors(prev => ({ ...prev, profType: validateField('profType', e.target.value) }));
                      }}
                      onBlur={handleBlur}
                      options={[
                        { value: 'Chartered Accountant', label: 'Chartered Accountant' },
                        { value: 'Company Secretary', label: 'Company Secretary' },
                        { value: 'Cost Accountant', label: 'Cost Accountant' }
                      ]}
                      required
                    />
                    <FormInput
                      label="Membership Number"
                      name="profMembership"
                      value={professionalDetails.membershipNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setProfessionalDetails({ ...professionalDetails, membershipNumber: val });
                        if (touched.profMembership) setErrors(prev => ({ ...prev, profMembership: validateField('profMembership', val) }));
                      }}
                      onBlur={handleBlur}
                      error={errors.profMembership}
                      required
                      placeholder="226526"
                    />
                    <FormInput
                      label="Certificate of Practice Number"
                      name="profCOP"
                      value={professionalDetails.copNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setProfessionalDetails({ ...professionalDetails, copNumber: val });
                        if (touched.profCOP) setErrors(prev => ({ ...prev, profCOP: validateField('profCOP', val) }));
                      }}
                      onBlur={handleBlur}
                      error={errors.profCOP}
                      required
                    />
                    <FormInput
                      label="Professional Email"
                      name="profEmail"
                      type="email"
                      value={professionalDetails.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setProfessionalDetails({ ...professionalDetails, email: e.target.value });
                        if (touched.profEmail) setErrors(prev => ({ ...prev, profEmail: validateField('profEmail', e.target.value) }));
                      }}
                      onBlur={handleBlur}
                      error={errors.profEmail}
                      required
                      placeholder="ca@example.com"
                    />

                  </div>

                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">📄</span>
                    Required Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FileUploader
                      label="Inside Office Photo (Director Room)"
                      name="insideOfficePhoto"
                      onChange={handleFileUpload('insideOfficePhoto')}
                      required
                      accept="image/*"
                      error={fileErrors.insideOfficePhoto}
                      uploadedFile={uploadedFiles.insideOfficePhoto as File}
                      existingUrl={existingDocs?.insideOfficePhoto?.url}
                    />
                    <FileUploader
                      label="Outside Office Photo (Building/Banner)"
                      name="outsideOfficePhoto"
                      onChange={handleFileUpload('outsideOfficePhoto')}
                      required
                      accept="image/*"
                      error={fileErrors.outsideOfficePhoto}
                      uploadedFile={uploadedFiles.outsideOfficePhoto as File}
                      existingUrl={existingDocs?.outsideOfficePhoto?.url}
                    />
                    <FileUploader
                      label="Board Resolution"
                      name="boardResolution"
                      onChange={handleFileUpload('boardResolution')}
                      required
                      error={fileErrors.boardResolution}
                      uploadedFile={uploadedFiles.boardResolution as File}
                      existingUrl={existingDocs?.boardResolution?.url}
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
                      disabled={isSubmitting || !isStepValid(currentStep)}
                      className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                    >
                      {isDraftSaving ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : null}
                      Save & Next Step →
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end w-full">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting || !isStepValid(currentStep)}
                      className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                    >

                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
              subscriberCount={subscriberPayments.length}
              uploadedCount={uploadedCount}
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
