import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { generateServiceId } from '../utils/helpers';
// 🔥 Firebase Imports
import { db, storage } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import FormBackButton from '../components/FormBackButton';

import { useRazorpay } from '../hooks/useRazorpay';
import { calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import { UserProfile } from '../types';
import { useCallback } from 'react';
import { buildInitialApplicationStatus } from './applicationStatus';


// --- Types ---
type NotificationType = 'success' | 'error' | 'info';
type PanType = 'edigital' | 'ephysical';

interface NotificationState {
  type: NotificationType;
  message: string;
  visible: boolean;
}

// --- Validators ---
const validators = {
  required: (value: string) => value.trim().length > 0 || "This field is required",
  name: (value: string) => /^[A-Za-z\s.-]{2,50}$/.test(value) || "Enter a valid name (Letters, spaces, dots, hyphens only)",
  dob: (value: string) => {
    if (!value.trim()) return "Date of birth is required";
    const parts = value.split('/');
    if (parts.length !== 3) return "Enter date as DD/MM/YYYY";
    const [d, m, y] = parts.map(Number);
    const dob = new Date(y, m - 1, d);
    if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) {
      return "Enter a valid date (DD/MM/YYYY)";
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
    return (age >= 18 && age <= 100) || "Applicant must be between 18 and 100 years old";
  },
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Please enter a valid email address",
  mobile: (value: string) => /^[6-9]\d{9}$/.test(value) || "Enter a valid 10-digit mobile number (Starts with 6-9)",
  aadhaar: (value: string) => /^\d{12}$/.test(value) || "Aadhaar must be exactly 12 digits",
  consent: (value: boolean) => value === true || "This declaration is required",
  pincode: (value: string) => /^\d{6}$/.test(value) || "Pincode must be exactly 6 digits",
  address: (value: string) => value.trim().length >= 3 || "Please enter a valid address detail (min 3 characters)"
};

// --- Reusable Form Input Component ---
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({ label, error, hint, optional, className = "", id, required, ...props }) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  const baseClasses = "w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none";
  const errorClasses = error
    ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/20"
    : "border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600";
  const fullClasses = `${baseClasses} ${errorClasses} ${className}`;

  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
          {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <input id={inputId} className={fullClasses} aria-invalid={!!error} required={required} {...props} />
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

// --- Select Input Component ---
interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  required?: boolean;
}

const SelectInput: React.FC<SelectInputProps> = ({ label, error, options, required, className = "", ...props }) => {
  const baseClasses = "w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none";
  const errorClasses = error
    ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/20"
    : "border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600";
  const fullClasses = `${baseClasses} ${errorClasses} ${className}`;

  return (
    <div className="mb-5 group">
      <label className="block text-sm font-medium text-white mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select className={fullClasses} required={required} {...props}>
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};

type FilesToUpload = { proofdoc: File | null; photo: File | null; signature: File | null; }

// 🔥 File Uploader with Size Validation
const FileUploader: React.FC<{ label: string; name: string; accept?: string; onChange: (file: File | null) => void; required?: boolean; disabled?: boolean; hint?: string; }> = ({ label, name, accept = ".pdf,.jpg,.jpeg,.png", onChange, required, disabled = false, hint }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processFile = (file: File | null) => {
    if (file) {
      if (file.size > 2 * 1024 * 1024) return;
      setFileName(file.name);
      onChange(file);
    } else {
      setFileName(null);
      onChange(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  };

  return (
    <div className={`mb-5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-baseline mb-1.5">
        <label className={`block text-sm font-medium ${disabled ? 'text-slate-500' : 'text-white'}`}>
          {label} {required && <span className="text-red-500">*</span>}
          {disabled && <span className="text-xs text-slate-500 ml-2">(Not Required)</span>}
        </label>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 ease-in-out cursor-pointer group ${isDragging ? 'border-cyan-500 bg-cyan-500/10' : fileName ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} name={name} accept={accept} className="hidden" onChange={(e) => processFile(e.target.files?.[0] || null)} disabled={disabled} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 transition-colors ${fileName ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-cyan-400'}`}>
            {fileName ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">Ready to upload</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">{disabled ? 'Skipped (not applicable)' : 'Click to upload or drag & drop'}</p>
                {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
              </div>
            )}
          </div>
          {fileName && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setFileName(null); onChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Status Banner Component ---
const StatusBanner: React.FC<{ panType: PanType }> = ({ panType }) => {
  const pricing = panType === 'edigital' ? { display: '₹99', original: '₹149' } : { display: '₹149', original: '₹199' };

  return (
    <div className="bg-gradient-to-r from-orange-900/30 to-orange-800/10 border border-orange-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
      <div className="z-10 mb-2 sm:mb-0">
        <div className="flex items-baseline space-x-3">
          <span className="text-slate-500 font-medium line-through text-lg">{pricing.original}</span>
          <span className="text-white font-bold text-2xl tracking-tight drop-shadow-sm">{pricing.display}</span>
          <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">Official Rate</span>
        </div>
        <p className="text-slate-400 text-sm mt-1 font-medium">
          {panType === 'edigital' ? 'e-PAN delivered via email in 48 hours' : 'Physical PAN card delivered via post in 7-10 days'}
        </p>
      </div>
      <div className="text-left sm:text-right z-10">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected Type</p>
        <p className="text-orange-400 font-mono font-medium text-sm md:text-base">
          {panType === 'edigital' ? 'e-PAN (Digital)' : 'Physical PAN Card'}
        </p>
      </div>
    </div>
  );
};

// --- 🔥 CENTERED Toast Notification Component ---
const Toast: React.FC<{ notification: NotificationState; onClose: () => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.visible, onClose]);

  if (!notification.visible) return null;

  const styles = {
    success: "bg-emerald-900/95 border-emerald-500/50 text-emerald-100",
    error: "bg-red-900/95 border-red-500/50 text-red-100",
    info: "bg-blue-900/95 border-blue-500/50 text-blue-100",
  };

  const icons = {
    success: <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    error: <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    info: <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };

  const titles = { success: "Success", error: "Error", info: "Notice" };

  return (
    <>
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[55] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
        <div className={`flex items-start gap-4 p-5 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-md w-[90%] mx-4 pointer-events-auto animate-scale-in ${styles[notification.type]}`} role="alert" aria-live="polite">
          <div className="flex-shrink-0 mt-0.5">{icons[notification.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold mb-1">{titles[notification.type]}</p>
            <p className="text-sm opacity-90 leading-relaxed">{notification.message}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors opacity-70 hover:opacity-100" aria-label="Close notification">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    </>
  );
};

// --- Types & Interfaces ---
interface FormData {
  fullName: string; fatherName: string; dob: string; gender: string; email: string; mobile: string;
  aadhaar: string; address: string; city: string; consent1: boolean; consent2: boolean;
  flatNumber: string; premisesName: string; roadStreet: string; areaLocality: string;
  district: string; state: string; pincode: string; country: string; sourceOfIncome: string[];
  applicantCategory: string; applicationMode: string; poiDocumentType: string; poaDocumentType: string;
  dobDocumentType: string; communicationPreference: string;
}

const initialData: FormData = {
  fullName: '', fatherName: '', dob: '', gender: '', email: '', mobile: '', aadhaar: '',
  address: '', city: '', consent1: false, consent2: false, flatNumber: '', premisesName: '',
  roadStreet: '', areaLocality: '', district: '', state: '', pincode: '', country: 'INDIA', sourceOfIncome: [],
  applicantCategory: 'individual_citizen', applicationMode: 'ekyc_esign',
  poiDocumentType: 'aadhaar', poaDocumentType: 'aadhaar', dobDocumentType: 'aadhaar',
  communicationPreference: 'physical_pan_and_epan',
};

const indianStates = [
  { value: 'ANDAMAN_NICOBAR', label: 'Andaman and Nicobar Islands' },
  { value: 'ANDHRA_PRADESH', label: 'Andhra Pradesh' },
  { value: 'ARUNACHAL_PRADESH', label: 'Arunachal Pradesh' },
  { value: 'ASSAM', label: 'Assam' },
  { value: 'BIHAR', label: 'Bihar' },
  { value: 'CHANDIGARH', label: 'Chandigarh' },
  { value: 'CHHATTISGARH', label: 'Chhattisgarh' },
  { value: 'DADRA_NAGAR_HAVELI_DAMAN_DIU', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DELHI', label: 'Delhi' },
  { value: 'GOA', label: 'Goa' },
  { value: 'GUJARAT', label: 'Gujarat' },
  { value: 'HARYANA', label: 'Haryana' },
  { value: 'HIMACHAL_PRADESH', label: 'Himachal Pradesh' },
  { value: 'JAMMU_KASHMIR', label: 'Jammu and Kashmir' },
  { value: 'JHARKHAND', label: 'Jharkhand' },
  { value: 'KARNATAKA', label: 'Karnataka' },
  { value: 'KERALA', label: 'Kerala' },
  { value: 'LADAKH', label: 'Ladakh' },
  { value: 'LAKSHADWEEP', label: 'Lakshadweep' },
  { value: 'MADHYA_PRADESH', label: 'Madhya Pradesh' },
  { value: 'MAHARASHTRA', label: 'Maharashtra' },
  { value: 'MANIPUR', label: 'Manipur' },
  { value: 'MEGHALAYA', label: 'Meghalaya' },
  { value: 'MIZORAM', label: 'Mizoram' },
  { value: 'NAGALAND', label: 'Nagaland' },
  { value: 'ODISHA', label: 'Odisha' },
  { value: 'PUDUCHERRY', label: 'Puducherry' },
  { value: 'PUNJAB', label: 'Punjab' },
  { value: 'RAJASTHAN', label: 'Rajasthan' },
  { value: 'SIKKIM', label: 'Sikkim' },
  { value: 'TAMIL_NADU', label: 'Tamil Nadu' },
  { value: 'TELANGANA', label: 'Telangana' },
  { value: 'TRIPURA', label: 'Tripura' },
  { value: 'UTTAR_PRADESH', label: 'Uttar Pradesh' },
  { value: 'UTTARAKHAND', label: 'Uttarakhand' },
  { value: 'WEST_BENGAL', label: 'West Bengal' },
];

// 🔥 MAIN COMPONENT
export default function PanRegistrationForm({ user }: { user: UserProfile }) {
  const navigate = useNavigate();
  const [generatedCaseId, setGeneratedCaseId] = useState<string>('');
  const { displayRazorpay } = useRazorpay();

  // 🔥 Notification State
  const [notification, setNotification] = useState<NotificationState>({ type: 'info', message: '', visible: false });
  const showNotification = (type: NotificationType, message: string) => setNotification({ type, message, visible: true });
  const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));


  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'panType', string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);

  // Auto-submit after payment
  useEffect(() => {
    if (paymentInfo) {
      handleProceed();
    }
  }, [paymentInfo]);

  // ✅ Updated: Now 7 steps (Step 1 = PAN Type Selection)
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  // ✅ NEW: PAN Type State
  const [panType, setPanType] = useState<PanType | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<FilesToUpload>({ proofdoc: null, photo: null, signature: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const datePickerRef = useRef<any>(null);

  // ✅ ENHANCED VALIDATION FUNCTION
  const validateField = (name: keyof FormData | 'panType', value: any): string => {
    if (name === 'panType') return value ? '' : 'Please select a PAN type';
    switch (name) {
      case 'fullName': case 'fatherName':
        return validators.name(value as string) === true ? '' : (validators.name(value as string) as string);
      case 'dob': return validators.dob(value as string) === true ? '' : (validators.dob(value as string) as string);
      case 'gender': if (!value) return "Please select gender"; return '';
      case 'email': return validators.email(value as string) === true ? '' : (validators.email(value as string) as string);
      case 'mobile': return validators.mobile(value as string) === true ? '' : (validators.mobile(value as string) as string);
      case 'aadhaar': if (!(value as string) || (value as string).trim() === '') return "Aadhaar number is required";
        return validators.aadhaar(value as string) === true ? '' : (validators.aadhaar(value as string) as string);
      case 'flatNumber': case 'roadStreet': case 'areaLocality': case 'district': case 'premisesName':
        if (!(value as string) || (value as string).trim() === '') return "This field is required";
        return validators.address(value as string) === true ? '' : (validators.address(value as string) as string);
      case 'state': if (!(value as string) || (value as string).trim() === '') return "Please select a state"; return '';
      case 'pincode': return validators.pincode(value as string) === true ? '' : (validators.pincode(value as string) as string);
      case 'applicantCategory': case 'applicationMode': case 'poiDocumentType': case 'poaDocumentType':
      case 'dobDocumentType': case 'communicationPreference':
        return value ? '' : 'This portal field is required';
      case 'consent1': case 'consent2': return (value as boolean) ? '' : "This declaration is required";
      default: return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    let formattedValue: any = value;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === 'sourceOfIncome') {
        const currentSources = formData.sourceOfIncome || [];
        formattedValue = checked ? [...currentSources, value] : currentSources.filter(s => s !== value);
      } else { formattedValue = checked; }
    }

    if (['mobile'].includes(key)) formattedValue = (value as string).replace(/\D/g, '').slice(0, 10);
    if (key === 'aadhaar') formattedValue = (value as string).replace(/\D/g, '').slice(0, 12);
    if (['pincode'].includes(key)) formattedValue = (value as string).replace(/\D/g, '').slice(0, 6);

    setFormData((prev) => ({ ...prev, [key]: formattedValue }));
    if (touched[key]) setErrors((prev) => ({ ...prev, [key]: validateField(key, formattedValue) }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, finalValue) }));
  };

  // ✅ FIXED: Handle DOB Input with Auto-formatting (DD/MM/YYYY) - NO VALIDATION WHILE TYPING
  const handleDobChange = (value: string) => {
    // Remove all non-digits
    let numbers = value.replace(/[^0-9]/g, '').slice(0, 8); // Max 8 digits for DDMMYYYY

    let formatted = '';

    if (numbers.length > 0) {
      formatted = numbers.slice(0, 2);
    }
    if (numbers.length > 2) {
      formatted += '/' + numbers.slice(2, 4);
    }
    if (numbers.length > 4) {
      formatted += '/' + numbers.slice(4, 8);
    }

    setFormData((prev) => ({ ...prev, dob: formatted }));
    setTouched((prev) => ({ ...prev, dob: true }));
    // ✅ REMOVED: No validation while typing - only on blur
  };

  // ✅ Handle Date Picker Selection
  const handleDateSelect = (date: Date | null) => {
    if (date) {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      const formatted = `${dd}/${mm}/${yyyy}`;
      setFormData((prev) => ({ ...prev, dob: formatted }));
      setTouched((prev) => ({ ...prev, dob: true }));
      setErrors((prev) => ({ ...prev, dob: validateField('dob', formatted) }));
    }
  };

  // ✅ Parse DD/MM/YYYY to Date object
  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  };

  const getStepFields = (step: number): (keyof FormData | 'panType')[] => {
    switch (step) {
      case 1: return ['panType'];
      case 2: return ['fullName', 'fatherName', 'dob', 'gender'];
      case 3: return ['email', 'mobile', 'aadhaar'];
      case 4: return ['flatNumber', 'roadStreet', 'areaLocality', 'district', 'state', 'pincode', 'premisesName'];
      case 5: return [];
      case 6: return ['applicantCategory', 'applicationMode', 'poiDocumentType', 'poaDocumentType', 'dobDocumentType', 'communicationPreference'];
      case 7: return ['consent1', 'consent2'];
      default: return [];
    }
  };

  const validateCurrentStep = (): boolean => {
    const fields = getStepFields(currentStep);
    const newErrors: Partial<Record<keyof FormData | 'panType', string>> = {};
    let isValid = true;

    fields.forEach((key) => {
      const error = validateField(key, key === 'panType' ? panType : formData[key as keyof FormData]);
      if (error) { newErrors[key as keyof FormData] = error; isValid = false; }
    });

    if (!isValid) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      setTouched((prev) => { const t = { ...prev }; fields.forEach(f => t[f as keyof FormData] = true); return t; });
      return false;
    }

    // Step 5 Validation (Income Source)
    if (currentStep === 5) {
      if (!formData.sourceOfIncome || formData.sourceOfIncome.length === 0) {
        return false;
      }
    }

    // Step 6 Validation (Documents)
    if (currentStep === 6) {
      const hasSignatureFile = filesToUpload.signature !== null;
      if (!filesToUpload.proofdoc || !filesToUpload.photo || !hasSignatureFile) {
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => prev - 1);
  };

  const handleFileUpload = (key: keyof FilesToUpload) => (file: File | null) => {
    setFilesToUpload((prev) => ({ ...prev, [key]: file }));
  };

  const uploadFileToStorage = async (file: File, docId: string, fieldName: string) => {
    if (!user || !user.uid) throw new Error("User not authenticated. Cannot upload.");
    const originalName = file.name.trim();
    const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileExt = cleanName.split('.').pop() || 'bin';
    const baseName = cleanName.split('.').slice(0, -1).join('.');
    const fileName = `${baseName}_${Date.now()}.${fileExt}`;
    const path = `pan-applications/${user.uid}/${docId}/${fileName}`;
    const storageRef = ref(storage, path);

    try {
      const metadata = { contentType: file.type || 'application/octet-stream' };
      const snapshot = await uploadBytes(storageRef, file, metadata);
      return await getDownloadURL(snapshot.ref);
    } catch (error: any) {
      console.error(`❌ Error uploading ${fieldName}:`, error);
      if (error.code === 'storage/unauthorized') throw new Error(`Permission denied. Check Storage Rules.`);
      throw new Error(`Failed to upload ${fieldName}. ${error.message}`);
    }
  };

  const handleProceed = async () => {
    if (!user || !user.uid) {
      showNotification('error', "You must be logged in to submit.");
      navigate("/login");
      return;
    }

    if (!panType) {
      return;
    }

    if (!validateCurrentStep()) return;

    if (!paymentInfo) {
      setIsPaying(true);
      try {
        const baseAmount = panType === 'edigital' ? 99 : 149;
        const amount = calculateTotalWithGST(baseAmount);
        const started = await displayRazorpay(amount, (response) => {
          setPaymentInfo(response);
          setIsPaying(false);
          // Trigger the same function again but this time paymentInfo will be present
          // We can't call handleProceed directly here because it's an async closure, 
          // but we can proceed manually. 
          // Better yet, just call a separate function or wait.
          // Actually, the easiest way is to just call handleProceed again or have a separate submit function.
        }, {
          description: `Service Fee: ₹${baseAmount} + GST (18%): ₹${calculateGST(baseAmount)} = Total: ₹${calculateTotalWithGST(baseAmount)}`,
          prefill: {
            name: formData.fullName,
            email: formData.email,
            contact: formData.mobile
          }
        });
        if (!started) {
          showNotification('error', "Failed to initiate payment. Please try again.");
          setIsPaying(false);
        }
        return; // Wait for payment handler
      } catch (error) {
        console.error("Payment error:", error);
        showNotification('error', "Payment initialization failed.");
        setIsPaying(false);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const docId = `PAN-${Date.now()}`;
      const serviceId = generateServiceId('PAN');
      setGeneratedCaseId(docId);

      const uploadedFileUrls: { [key: string]: string } = {};

      showNotification('info', 'Uploading documents securely...');

      for (const [key, file] of Object.entries(filesToUpload)) {
        if (file) {
          const url = await uploadFileToStorage(file, docId, key);
          uploadedFileUrls[key] = url;
        }
      }

      await setDoc(doc(db, "pan-applications", docId), {
        id: docId, serviceId, type: 'pan', title: 'PAN Card Registration',
        ...buildInitialApplicationStatus({ serviceType: 'pan', serviceName: 'PAN Card Registration', userId: user.uid }),
        submittedAt: Date.now(), formData, panType,
        // ✅ Only save the files actually uploaded via the file inputs (proofdoc, photo, signature)
        uploadedFileUrls: uploadedFileUrls,
        userId: user.uid, folderId: 'regibiz', userEmail: user.email, caseId: docId,
        paymentId: paymentInfo?.razorpay_payment_id || null,
        orderId: paymentInfo?.razorpay_order_id || null,
        paymentStatus: paymentInfo ? 'paid' : 'pending'
      });
      await sendConfirmationEmail({
        name: formData.fullName,
        email: user.email,
        service: "PAN Card Registration",
        caseId: docId
      });
      setIsSubmitting(false);
      setShowSuccessPopup(true);
      setTimeout(() => {
        setShowSuccessPopup(false);
        setIsSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 3000);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setIsSubmitting(false);
      showNotification('error', `Submission failed: ${err.message || 'Please try again.'}`);
    }
  };

  // Add CSS animations to document head on mount
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scale-in { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
      .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-700/50">
        <h2 className="text-2xl font-bold text-white mb-4">Login Required</h2>
        <p className="text-slate-300 mb-6">Please log in to submit your PAN registration.</p>
        <button onClick={() => navigate("/login")} className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/25">Go to Login</button>
      </div>
    </div>
  );

  const PreviewModal = () => (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <h3 className="text-xl font-bold text-white">Application Preview</h3>
          <button onClick={() => setShowPreview(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-6">
          <div><h4 className="font-semibold text-white mb-2">PAN Type</h4><p className="text-white">{panType === 'edigital' ? 'e-PAN (Digital Delivery)' : 'Physical PAN Card (Postal Delivery)'}</p></div>
          <div><h4 className="font-semibold text-white mb-2">Personal Details</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div><span className="text-slate-500">Full Name:</span> <span className="text-white">{formData.fullName || '—'}</span></div><div><span className="text-slate-500">Father's Name:</span> <span className="text-white">{formData.fatherName || '—'}</span></div><div><span className="text-slate-500">DOB:</span> <span className="text-white">{formData.dob || '—'}</span></div><div><span className="text-slate-500">Gender:</span> <span className="text-white">{formData.gender || '—'}</span></div></div></div>
          <div><h4 className="font-semibold text-white mb-2">Contact Info</h4><div className="text-sm"><div><span className="text-slate-500">Email:</span> <span className="text-white">{formData.email || '—'}</span></div><div><span className="text-slate-500">Mobile:</span> <span className="text-white">{formData.mobile || '—'}</span></div><div><span className="text-slate-500">Aadhaar:</span> <span className="text-white">{formData.aadhaar || 'Not provided'}</span></div></div></div>
          <div><h4 className="font-semibold text-white mb-2">Address</h4><div className="text-sm text-white"><p>{formData.flatNumber}, {formData.premisesName}</p><p>{formData.roadStreet}, {formData.areaLocality}</p><p>{formData.district}, {formData.state} - {formData.pincode}</p></div></div>
          <div><h4 className="font-semibold text-white mb-2">Documents Uploaded</h4><ul className="space-y-2">{[{ key: 'proofdoc', label: 'Identity Proof' }, { key: 'addressProof', label: 'Address Proof' }, { key: 'dobProof', label: 'DOB Proof' }, { key: 'photo', label: 'Photo' }, { key: 'signature', label: 'Signature' }].map((doc) => (<li key={doc.key} className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg"><span className="text-slate-300">{doc.label}</span>{filesToUpload[doc.key as keyof FilesToUpload] ? (<span className="text-emerald-400 font-medium flex items-center"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Ready</span>) : <span className="text-slate-500">Pending</span>}</li>))}</ul></div>
        </div>
        <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0">
          <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700">Close</button>
          <button onClick={handleProceed} disabled={isSubmitting} className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isSubmitting ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white shadow-lg shadow-cyan-500/25'}`}>{isSubmitting ? 'Processing...' : 'PROCEED'}</button>
        </div>
      </div>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <CelebrationPopup trigger={isSuccess} message="" />
      <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-32 bg-orange-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
        <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">PAN Application Submitted!</h2>
        <p className="text-slate-300 mb-2">Your application has been received successfully.</p>
        <p className="text-slate-400 text-sm mb-8">Your Case ID is: <br /><span className="text-orange-400 font-mono text-lg font-bold">{generatedCaseId}</span></p>
        <p className="text-slate-300 mb-6">Selected: <span className="text-orange-400 font-semibold">{panType === 'edigital' ? 'e-PAN (Digital)' : 'Physical PAN Card'}</span></p>
        <div className="space-y-3">
          <button onClick={() => navigate('/documents')} className="w-full flex items-center justify-center gap-2 bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg shadow-cyan-500/25"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>View Submitted Application</button>
          <button onClick={() => navigate('/services')} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-xl border border-white/10 transition-all duration-200"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back to Services</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* 🔥 Toast Notification Container */}
      <Toast notification={notification} onClose={closeNotification} />

      {/* 🔥 Processing Overlay with Blur */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 animate-scale-in">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-emerald-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
            </div>
            <p className="text-white text-xl font-semibold">Processing...</p>
            <p className="text-slate-400 text-sm">Please wait while we submit your application</p>
          </div>
        </div>
      )}

      {/* ✅ Green Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[110] flex items-center justify-center animate-fade-in">
          <div className="bg-emerald-900/95 border-2 border-emerald-500 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 animate-scale-in max-w-md w-[90%]">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.6)]">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-emerald-100">Submitted!</h3>
            <p className="text-emerald-200 text-center">Your PAN application has been submitted successfully</p>
            <div className="w-full bg-emerald-800/50 rounded-full h-1 mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full animate-[shrink_3s_linear_forwards]" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Aurora Glows */}
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[1600px] mx-auto relative z-10">
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">PAN Card Registration</h1>
          <p className="text-sky-200/80 text-sm">Step {currentStep} of {totalSteps}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-5 left-5 z-20">
              <FormBackButton />
            </div>

            <div className="p-6 md:p-10 flex-grow">
              <div className="mb-8 hidden lg:block text-center">
                <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">PAN Card Registration</h1>
                <p className="text-slate-300 text-base max-w-lg leading-relaxed mt-1 mx-auto">
                  {currentStep === 1 && 'Select your preferred PAN delivery type.'}
                  {currentStep === 2 && 'Enter your personal and family details.'}
                  {currentStep === 3 && 'Provide contact information and Aadhaar.'}
                  {currentStep === 4 && 'Enter your residential address details.'}
                  {currentStep === 5 && 'Income details.'}
                  {currentStep === 6 && 'Upload required documents.'}
                  {currentStep === 7 && 'Provide your consent.'}
                </p>
              </div>

              {/* ✅ Pass panType to StatusBanner */}
              {panType && <StatusBanner panType={panType} />}

              <form onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 gap-y-10">
                  {/* ✅ STEP 1: PAN TYPE SELECTION */}
                  {currentStep === 1 && (
                    <fieldset className="space-y-6">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Select PAN Type
                      </legend>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* e-PAN Option */}
                        <label className={`relative cursor-pointer p-5 rounded-xl border-2 transition-all duration-200 ${panType === 'edigital' ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}>
                          <input type="radio" name="panType" value="edigital" checked={panType === 'edigital'} onChange={() => { setPanType('edigital'); setErrors(prev => ({ ...prev, panType: '' })); }} className="sr-only" />
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${panType === 'edigital' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold text-lg">e-PAN (Digital)</h4>
                              <p className="text-slate-400 text-sm mt-1">Instant delivery via email</p>
                              <p className="text-emerald-400 font-bold text-xl mt-2">₹99</p>
                              <p className="text-slate-500 text-xs mt-1">Official NSDL/UTIITSL rate</p>
                            </div>
                          </div>
                          {panType === 'edigital' && <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                        </label>

                        {/* Physical PAN Option */}
                        <label className={`relative cursor-pointer p-5 rounded-xl border-2 transition-all duration-200 ${panType === 'ephysical' ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}>
                          <input type="radio" name="panType" value="ephysical" checked={panType === 'ephysical'} onChange={() => { setPanType('ephysical'); setErrors(prev => ({ ...prev, panType: '' })); }} className="sr-only" />
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${panType === 'ephysical' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold text-lg">Physical PAN Card</h4>
                              <p className="text-slate-400 text-sm mt-1">Delivered to your address via post</p>
                              <p className="text-emerald-400 font-bold text-xl mt-2">₹149</p>
                              <p className="text-slate-500 text-xs mt-1">Official NSDL/UTIITSL rate</p>
                            </div>
                          </div>
                          {panType === 'ephysical' && <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                        </label>
                      </div>
                      {errors.panType && <p className="text-red-400 text-sm flex items-center"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{errors.panType}</p>}
                      <div className="bg-slate-800/30 rounded-lg p-4 mt-4">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2">What's the difference?</h4>
                        <ul className="text-xs text-slate-400 space-y-1">
                          <li>• <strong>e-PAN:</strong> Digitally signed PDF, valid everywhere, delivered in 48 hours via email</li>
                          <li>• <strong>Physical PAN:</strong> Laminated card sent to your postal address in 7-10 business days</li>
                          <li>• Both have the same PAN number and legal validity</li>
                        </ul>
                      </div>
                    </fieldset>
                  )}

                  {/* STEP 2: Personal Information */}
                  {currentStep === 2 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Personal Information
                      </legend>
                      <FormInput label="Full Name (as per AADHAR)" name="fullName" value={formData.fullName} onChange={handleChange} onBlur={handleBlur} error={errors.fullName} placeholder="e.g., Rajesh Kumar" required autoFocus />
                      <FormInput label="Father's Name" name="fatherName" value={formData.fatherName} onChange={handleChange} onBlur={handleBlur} error={errors.fatherName} placeholder="e.g., Suresh Kumar" required />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* ✅ FIXED: Date of Birth with Calendar Picker - DD/MM/YYYY Format */}
                        <div className="mb-5 relative">
                          <label htmlFor="dob" className="block text-sm font-medium text-white mb-2">
                            Date of Birth <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              id="dob"
                              name="dob"
                              type="text"
                              value={formData.dob}
                              onChange={(e) => handleDobChange(e.target.value)}
                              onBlur={handleBlur}
                              placeholder="DD/MM/YYYY"
                              maxLength={10}
                              className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 pr-12 placeholder-slate-500 focus:ring-2 focus:outline-none ${errors.dob
                                ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/20"
                                : "border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600"
                                }`}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => datePickerRef.current?.setOpen(true)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors focus:outline-none"
                              tabIndex={-1}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          {/* ✅ DatePicker with DD/MM/YYYY format */}
                          <DatePicker
                            ref={datePickerRef}
                            selected={parseDate(formData.dob)}
                            onChange={handleDateSelect}
                            dateFormat="dd/MM/yyyy"
                            placeholderText="DD/MM/YYYY"
                            maxDate={new Date()}
                            minDate={new Date(1926, 0, 1)}
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={100}
                            className="hidden"
                            wrapperClassName="w-full"
                            popperPlacement="bottom-start"
                            popperClassName="!bg-slate-900 !border !border-slate-700 !rounded-lg !shadow-xl !shadow-cyan-500/10 z-50"
                            calendarClassName="!bg-slate-900 !text-white !font-sans"
                            dayClassName={(date: Date) =>
                              `!text-slate-200 hover:!bg-cyan-500/20 hover:!text-cyan-300 ${date.toDateString() === new Date().toDateString()
                                ? '!bg-cyan-500/30 !text-cyan-200 font-semibold'
                                : ''
                              }`
                            }
                            monthClassName={() => "!text-slate-300"}
                            yearClassName={() => "!text-slate-300"}
                          />
                          {errors.dob ? (
                            <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {errors.dob}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-xs text-slate-500 font-mono">Format: DD/MM/YYYY</p>
                          )}
                        </div>

                        {/* Gender Selection */}
                        <div className="mb-5">
                          <label className="block text-sm font-medium text-white mb-1.5">
                            Gender <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-4 pt-1">
                            {(['Male', 'Female', 'Other'] as const).map((g) => (
                              <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="radio"
                                  name="gender"
                                  value={g}
                                  checked={formData.gender === g}
                                  onChange={handleChange}
                                  className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-600 focus:ring-cyan-500 focus:ring-2"
                                />
                                <span className="text-slate-300">{g}</span>
                              </label>
                            ))}
                          </div>
                          {errors.gender && <p className="mt-1.5 text-xs text-red-400">{errors.gender}</p>}
                        </div>
                      </div>
                    </fieldset>
                  )}

                  {/* STEP 3: Contact & Identity */}
                  {currentStep === 3 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Contact & Identity
                      </legend>
                      <FormInput type="email" label="Email Address" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} error={errors.email} placeholder="you@example.com" required />
                      <FormInput type="tel" label="Mobile Number" name="mobile" value={formData.mobile} onChange={handleChange} onBlur={handleBlur} error={errors.mobile} placeholder="9876543210" maxLength={10} required />
                      <FormInput label="Aadhaar Number" name="aadhaar" value={formData.aadhaar} onChange={handleChange} onBlur={handleBlur} error={errors.aadhaar} placeholder="123456789012" maxLength={12} required />
                    </fieldset>
                  )}

                  {/* STEP 4: Address Details */}
                  {currentStep === 4 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Address Details
                      </legend>
                      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 mb-4">
                        <p className="text-sm text-emerald-300"><span className="font-semibold">Resident State:</span> Details will be captured based on Aadhaar Details</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput label="Flat/Door/Block Number" name="flatNumber" value={formData.flatNumber} onChange={handleChange} onBlur={handleBlur} error={errors.flatNumber} placeholder="e.g., A-101" required />
                        <FormInput label="Premises/Building Name" name="premisesName" value={formData.premisesName} onChange={handleChange} onBlur={handleBlur} error={errors.premisesName} placeholder="e.g., Sunrise Apts" required />
                        <FormInput label="Road/Street/Lane/Post Office" name="roadStreet" value={formData.roadStreet} onChange={handleChange} onBlur={handleBlur} error={errors.roadStreet} placeholder="e.g., MG Road" required />
                        <FormInput label="Area/Locality/Taluka/Sub-Division" name="areaLocality" value={formData.areaLocality} onChange={handleChange} onBlur={handleBlur} error={errors.areaLocality} placeholder="e.g., Andheri West" required />
                        <FormInput label="Town/City/District" name="district" value={formData.district} onChange={handleChange} onBlur={handleBlur} error={errors.district} placeholder="e.g., Mumbai" required />
                        <SelectInput label="Select Residential State" name="state" value={formData.state} onChange={handleChange} onBlur={handleBlur} error={errors.state} options={indianStates} required />
                        <FormInput label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} onBlur={handleBlur} error={errors.pincode} placeholder="400053" maxLength={6} required />
                        <FormInput label="Country" name="country" value={formData.country} onChange={handleChange} disabled required />
                      </div>
                    </fieldset>
                  )}

                  {/* STEP 5: Other Details */}
                  {currentStep === 5 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Other Details
                      </legend>
                      <div className="pt-4">
                        <h4 className="text-sm font-semibold text-white mb-4">Source of Income</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {['Salary', 'Income from House Property', 'Capital Gains', 'Income from Other source', 'Business / Profession', 'No Income'].map((source) => (
                            <label key={source} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                name="sourceOfIncome"
                                value={source}
                                checked={(formData.sourceOfIncome || []).includes(source)}
                                onChange={handleChange}
                                className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500"
                              />
                              <span className="text-slate-300">{source}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </fieldset>
                  )}

                  {/* STEP 6: Documents Upload */}
                  {currentStep === 6 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Documents Upload
                      </legend>
                      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 mb-6">
                        <p className="text-sm text-emerald-300"><span className="font-semibold">Resident State:</span> Details will be captured based on Aadhaar Details</p>
                        <p className="text-xs text-red-400 mt-1">(Uploaded pdf file should not be password protected otherwise Application will be rejected)</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SelectInput label="Applicant Category" name="applicantCategory" value={formData.applicantCategory} onChange={handleChange} onBlur={handleBlur} error={errors.applicantCategory} required options={[
                          { value: 'individual_citizen', label: 'Individual - Indian Citizen' },
                          { value: 'minor', label: 'Minor through Parent / Guardian' },
                          { value: 'representative_assessee', label: 'Representative Assessee / Authorized Representative' },
                        ]} />
                        <SelectInput label="Application Mode" name="applicationMode" value={formData.applicationMode} onChange={handleChange} onBlur={handleBlur} error={errors.applicationMode} required options={[
                          { value: 'ekyc_esign', label: 'Paperless e-KYC / e-Sign' },
                          { value: 'physical_documents', label: 'Physical documents dispatch' },
                          { value: 'dsc', label: 'DSC based submission' },
                        ]} />
                        <SelectInput label="Proof of Identity Type" name="poiDocumentType" value={formData.poiDocumentType} onChange={handleChange} onBlur={handleBlur} error={errors.poiDocumentType} required options={[
                          { value: 'aadhaar', label: 'Aadhaar' },
                          { value: 'passport', label: 'Passport' },
                          { value: 'voter_id', label: 'Voter ID' },
                          { value: 'driving_license', label: 'Driving License' },
                        ]} />
                        <SelectInput label="Proof of Address Type" name="poaDocumentType" value={formData.poaDocumentType} onChange={handleChange} onBlur={handleBlur} error={errors.poaDocumentType} required options={[
                          { value: 'aadhaar', label: 'Aadhaar' },
                          { value: 'passport', label: 'Passport' },
                          { value: 'voter_id', label: 'Voter ID' },
                          { value: 'driving_license', label: 'Driving License' },
                        ]} />
                        <SelectInput label="Proof of DOB Type" name="dobDocumentType" value={formData.dobDocumentType} onChange={handleChange} onBlur={handleBlur} error={errors.dobDocumentType} required options={[
                          { value: 'aadhaar', label: 'Aadhaar' },
                          { value: 'passport', label: 'Passport' },
                          { value: 'birth_certificate', label: 'Birth Certificate' },
                          { value: 'matriculation_certificate', label: 'Matriculation Certificate' },
                        ]} />
                        <SelectInput label="PAN Delivery Preference" name="communicationPreference" value={formData.communicationPreference} onChange={handleChange} onBlur={handleBlur} error={errors.communicationPreference} required options={[
                          { value: 'physical_pan_and_epan', label: 'Physical PAN + e-PAN' },
                          { value: 'epan_only', label: 'e-PAN only' },
                        ]} />
                      </div>
                      <FileUploader label="Upload Selected Proof Document" name="proofdoc" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload('proofdoc')} required hint="Upload the document selected above. PDF/JPEG/PNG (Max 2MB)" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FileUploader label="Applicant Photo File" name="photo" accept=".jpg,.jpeg,.png" onChange={handleFileUpload('photo')} required hint="Photo: 300 dpi, Color, 213 x 213 px (Size: less than 30 kb)" />
                        <FileUploader label="Applicant Signature File" name="signature" accept=".jpg,.jpeg,.png" onChange={handleFileUpload('signature')} hint="Signature: 600 dpi, Black & White (Size: less than 60 kb)" />
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-4 mt-6">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2">Scanning Specification</h4>
                        <ul className="text-xs text-slate-400 space-y-1">
                          <li>• Photo Scanning 300 dpi, Colour, 213 X 213 px (Size: less than 30 kb)</li>
                          <li>• Signature scanning 600 dpi black and white (Size: less than 60 kb)</li>
                        </ul>
                      </div>
                    </fieldset>
                  )}

                  {/* STEP 7: Consent */}
                  {currentStep === 7 && (
                    <fieldset className="space-y-6">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>Consent
                      </legend>
                      <div className="space-y-4">
                        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                          <div className="flex items-start gap-4">
                            <input
                              type="checkbox"
                              id="consent1"
                              name="consent1"
                              checked={formData.consent1}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className="mt-1 w-5 h-5 text-cyan-500 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <label htmlFor="consent1" className="text-sm text-slate-300 cursor-pointer leading-relaxed block">
                                I authorize RegiBIZ to submit my PAN application on my behalf to the Income Tax Department.
                              </label>
                              {errors.consent1 && <span className="text-red-400 block mt-2 text-sm font-medium">{errors.consent1}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                          <div className="flex items-start gap-4">
                            <input
                              type="checkbox"
                              id="consent2"
                              name="consent2"
                              checked={formData.consent2}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className="mt-1 w-5 h-5 text-cyan-500 bg-slate-800 border-slate-600 rounded focus:ring-cyan-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <label htmlFor="consent2" className="text-sm text-slate-300 cursor-pointer leading-relaxed block">
                                I hereby declare that the details furnished above are true and correct to the best of my knowledge and belief and I undertake to inform you of any changes therein, immediately. In case any of the above information is found to be false or untrue or misleading or misrepresenting, I am aware that I may be held liable for it.
                              </label>
                              {errors.consent2 && <span className="text-red-400 block mt-2 text-sm font-medium">{errors.consent2}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>

                <div className="mt-12 pt-6 border-t border-slate-700/50">
                  <div className="flex flex-col-reverse md:flex-row items-center gap-4 justify-between">
                    <div className="w-full md:w-auto flex gap-4">
                      {currentStep > 1 && (
                        <button
                          type="button"
                          onClick={handlePrevious}
                          className="w-full md:w-auto px-6 py-4 rounded-xl font-semibold text-slate-300 border border-slate-600 hover:bg-slate-800 hover:text-white transition-all duration-200"
                        >
                          Back
                        </button>
                      )}
                    </div>
                    {currentStep < totalSteps ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center shadow-cyan-500/25"
                      >
                        Next Step
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleProceed}
                        disabled={isSubmitting}
                        className={`w-full md:w-auto px-8 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 transform border border-transparent ${isSubmitting
                          ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70 border-slate-700'
                          : 'bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:translate-y-0 backdrop-blur-sm'
                          }`}
                      >
                        {isSubmitting ? 'Processing...' : 'PROCEED '}
                      </button>
                    )}
                  </div>
                  <p className="mt-4 text-center text-xs text-slate-400">
                    Step {currentStep} of {totalSteps} — By continuing, you agree to our{' '}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300 hover:underline">Terms</a> and{' '}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300 hover:underline">Policy</a>.
                  </p>
                </div>
              </form>
            </div>
          </main>

          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8 hidden lg:block">
            <div className="space-y-6">
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
                <h3 className="text-white text-sm font-semibold mb-4">Progress Status</h3>
                <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-6 my-2">
                  {[...Array(totalSteps)].map((_, idx) => {
                    const step = idx + 1;
                    const isActive = step === currentStep;
                    const isCompleted = step < currentStep;
                    const stepLabels = ['PAN Type', 'Personal Details', 'Contact & Aadhaar', 'Address Details', 'Other Details', 'Documents Upload', 'Consent'];

                    return (
                      <button
                        key={step}
                        onClick={() => setCurrentStep(step)}
                        className="ml-5 relative w-full text-left group focus:outline-none"
                      >
                        <span
                          className={`absolute -left-[27px] w-3 h-3 rounded-full border-2 border-slate-800 transition-all duration-300 ${isCompleted
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : isActive
                              ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                              : 'bg-slate-700 group-hover:bg-slate-600'
                            }`}
                        ></span>
                        <h4
                          className={`text-xs font-medium transition-colors duration-200 ${isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'
                            }`}
                        >
                          {stepLabels[idx]}
                        </h4>
                        {step === 6 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {Object.values(filesToUpload).filter(Boolean).length}/3 Uploaded
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {panType && (
                <>
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
                  <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
                    <span className="bg-emerald-500/20 p-1.5 rounded mr-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    Price Breakdown
                  </h3>
                  <div className="space-y-3 pt-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Service Fee</span>
                      <span className="text-white font-medium">₹{panType === 'edigital' ? '99' : '149'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">GST (18%)</span>
                      <span className="text-white font-medium">₹{calculateGST(panType === 'edigital' ? 99 : 149).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-700/50 pt-2 flex justify-between font-bold">
                      <span className="text-white">Total Payable</span>
                      <span className="text-cyan-400">₹{calculateTotalWithGST(panType === 'edigital' ? 99 : 149).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 italic">Inclusive of 18% GST</p>
                  </div>
                </div>
            
            <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl mt-6">
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
                </>
              )}
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600/50 text-cyan-400 font-bold tracking-wide shadow-lg hover:bg-slate-600 hover:text-white hover:border-cyan-500/50 transition-all duration-300"
                >
                  Preview Application
                </button>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm pb-8">
          &copy; 2026 RegiBIZ. All rights reserved.
        </div>
      </div>

      {showPreview && <PreviewModal />}
    </div>
  );
}