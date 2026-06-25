import React, { useState, ChangeEvent, FocusEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building, User, Mail, Phone, MapPin, FileText,
  Upload, CheckCircle, AlertCircle, FileCheck
} from 'lucide-react';
import { db, storage } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import { useRazorpay } from '../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import FormBackButton from '../components/FormBackButton';
import { RazorpaySuccessResponse } from './razorpayService';


// --- Reusable UI Components ---

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string;
}

const FormInput: React.FC<FormInputProps> = ({ label, icon, error, className, ...props }) => {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          className={`w-full bg-slate-900/50 border ${error ? 'border-red-500' : 'border-slate-700'} 
            rounded-lg py-2.5 ${icon ? 'pl-10' : 'pl-3'} pr-3 text-slate-100 
            placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 
            transition-all duration-200 ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1 flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> {error}</p>}
    </div>
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}

const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, ...props }) => {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">{label}</label>
      <div className="relative">
        <select
          className={`w-full bg-slate-900/50 border ${error ? 'border-red-500' : 'border-slate-700'} 
            rounded-lg py-2.5 pl-3 pr-10 text-slate-100 focus:outline-none 
            focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer`}
          {...props}
        >
          <option value="" disabled>Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
};

interface FileUploaderProps {
  label: string;
  name: string;
  required?: boolean;
  onChange: (file: File | null) => void;
  fileName?: string | null; // To display selected file name
}

const FileUploader: React.FC<FileUploaderProps> = ({ label, required, onChange, fileName }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
    } else {
      onChange(null);
    }
  };

  return (
    <div className={`border ${fileName ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-dashed border-slate-700 bg-slate-900/30'} rounded-lg p-4 hover:bg-slate-900/50 transition-colors`}>
      <label className="block text-sm font-medium text-white mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      {fileName ? (
        <div className="flex items-center justify-between p-2 bg-emerald-900/20 rounded border border-emerald-500/30">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-xs text-emerald-200 truncate">{fileName}</span>
          </div>
          <span className="text-xs text-emerald-400 font-medium">Uploaded</span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">PDF, JPG, PNG (Max 5MB)</span>
          <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2">
            <Upload className="w-3 h-3" />
            Choose File
            <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          </label>
        </div>
      )}
    </div>
  );
};

// --- Status Banner ---
const StatusBanner: React.FC<{ formId: string }> = ({ formId }) => {
  return (
    <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
      <div className="z-10 mb-2 sm:mb-0">
        <div className="flex items-baseline space-x-3">
          <span className="text-slate-500 font-medium line-through text-lg">₹499</span>
          <span className="text-emerald-400 font-bold text-2xl tracking-tight drop-shadow-sm">Free</span>
          <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
            Limited Offer
          </span>
        </div>
        <p className="text-slate-400 text-sm mt-1 font-medium">Service fee only — zero professional charges</p>
      </div>
      <div className="text-left sm:text-right z-10">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Case Reference</p>
        <p className="text-slate-200 font-mono font-medium text-sm md:text-base">
          {formId || `TL-2026-${Math.floor(1000 + Math.random() * 9000)}`}
        </p>
      </div>
    </div>
  );
};

// --- Info Sidebar ---
const InfoSidebar: React.FC<{ title: string, steps: any[], tips: string[], packageMode?: boolean }> = ({ title, steps, tips, packageMode }) => (
  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 backdrop-blur-sm sticky top-6">
    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <CheckCircle className="w-5 h-5 text-emerald-400" /> {title}
    </h3>
    <div className="space-y-4 mb-6">
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">
            {idx + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">{step.title}</p>
            <p className="text-xs text-slate-400">{step.desc}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="pt-4 border-t border-slate-700/50">
      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Pro Tips</p>
      <ul className="space-y-2 mb-6">
        {tips.map((tip, idx) => (
          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span> {tip}
          </li>
        ))}
      </ul>
    </div>

    {!packageMode && (
      <div className="pt-4 border-t border-slate-700/50">
        <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Price Breakdown</p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Service Fee</span>
            <span className="text-white font-medium">₹{PRICING_CONFIG['trade-license']?.fee?.toLocaleString() || '0'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">GST (18%)</span>
            <span className="text-white font-medium">₹{calculateGST(PRICING_CONFIG['trade-license']?.fee || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1">
            <span className="text-white">Total Amount</span>
            <span className="text-cyan-400">₹{calculateTotalWithGST(PRICING_CONFIG['trade-license']?.fee || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    )}
  </div>
);

// --- Main Form Logic ---

interface FormData {
  businessName: string;
  pan: string;
  constitution: string;
  premiseType: string;
  email: string;
  mobile: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  gstin: string;
}

const initialData: FormData = {
  businessName: '',
  pan: '',
  constitution: '',
  premiseType: '',
  email: '',
  mobile: '',
  address1: '',
  city: '',
  state: '',
  zip: '',
  gstin: '',
};

const constitutionOptions = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'pvtltd', label: 'Private Limited Company' },
  { value: 'llp', label: 'Limited Liability Partnership' },
  { value: 'huf', label: 'Hindu Undivided Family' },
];

const premiseOptions = [
  { value: 'retail', label: 'Retail Shop' },
  { value: 'commercial', label: 'Commercial Office' },
  { value: 'manufacturing', label: 'Manufacturing Unit' },
  { value: 'food', label: 'Restaurant / Food Business' },
];

const stateOptions = [
  { value: 'MH', label: 'Maharashtra' },
  { value: 'DL', label: 'Delhi' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'GJ', label: 'Gujarat' },
];

interface TradeLicenseFormProps {
  user: { uid: string; email?: string; displayName?: string; phoneNumber?: string };
  packageMode?: boolean;
  onComplete?: (data: any) => void;
  onBack?: () => void;
  initialData?: any;
  existingDocs?: any;
}

export default function TradeLicenseForm({ user, packageMode, onComplete, onBack, initialData: propsInitialData, existingDocs }: TradeLicenseFormProps) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>(propsInitialData || initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formId, setFormId] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const { displayRazorpay } = useRazorpay();
  const servicePrice = PRICING_CONFIG['trade-license']?.fee ?? 0;

  // Store actual file objects here
  const [files, setFiles] = useState<Record<string, File | null>>({
    panCard: null,
    premiseProof: null,
    photoId: null,
    layoutPlan: null,
  });

  // Store just boolean status for UI feedback
  const [uploadedStatus, setUploadedStatus] = useState<Record<string, boolean>>({
    panCard: !!existingDocs?.panCard,
    premiseProof: !!existingDocs?.premiseProof,
    photoId: !!existingDocs?.photoId,
    layoutPlan: !!existingDocs?.layoutPlan,
  });

  React.useEffect(() => {
    const id = `TL-${Date.now()}`;
    setFormId(id);
  }, []);

  // Payment-Gated Auto-Submit Effect
  React.useEffect(() => {
    if (paymentInfo && !isSubmitting && !isSuccess) {
      handleFinalSubmission(paymentInfo);
    }
  }, [paymentInfo]);

  const handleFinalSubmission = async (payInfo?: RazorpaySuccessResponse) => {
    setIsSubmitting(true);
    try {
      const uploadedFileUrls: Record<string, any> = { ...existingDocs };

      for (const [key, file] of Object.entries(files)) {
        if (file) {
          const filePath = `trade-license/${user.uid}/${formId}/${key}_${Date.now()}_${file.name}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);

          uploadedFileUrls[key] = {
            url,
            name: file.name,
            type: file.type,
            uploadedAt: new Date()
          };
        }
      }

      const submissionData = {
        id: formId,
        type: 'trade-license',
        title: 'Trade License Application',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        formData,
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
        onComplete(submissionData);
        return;
      }

      await setDoc(doc(db, "applications", formId), submissionData);
      try {
        await sendConfirmationEmail({
          name: formData.businessName,
          email: user.email || formData.email || '',
          service: "Trade License Application",
          caseId: formId
        });
      } catch (err) {
        console.error("Email failed", err);
      }
      setIsSuccess(true);
      window.scrollTo(0, 0);
    } catch (error: any) {
      console.error("Trade License Submission failed:", error);
      alert(error.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepFields = (step: number): (keyof FormData)[] => {
    switch (step) {
      case 1:
        return ['businessName', 'pan', 'constitution', 'premiseType'];
      case 2:
        return ['email', 'mobile', 'address1', 'city', 'zip', 'state', 'gstin'];
      default:
        return [];
    }
  };

  // --- Robust Validation Logic ---
  const validateField = (name: keyof FormData, value: string): string => {
    const trimmedValue = typeof value === 'string' ? value.trim() : value;

    switch (name) {
      case 'businessName':
        return trimmedValue.length > 0 ? '' : 'Business Name is required';
      case 'pan':
        const panVal = trimmedValue.toUpperCase();
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panVal)
          ? ''
          : 'Invalid PAN format (e.g., ABCDE1234F)';
      case 'constitution':
        return trimmedValue.length > 0 ? '' : 'Constitution Type is required';
      case 'premiseType':
        return trimmedValue.length > 0 ? '' : 'Premises Type is required';
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
          ? ''
          : 'Valid email is required';
      case 'mobile':
        return /^[6-9]\d{9}$/.test(trimmedValue)
          ? ''
          : 'Valid 10-digit mobile number is required';
      case 'address1':
        return trimmedValue.length > 0 ? '' : 'Address is required';
      case 'city':
        return trimmedValue.length > 0 ? '' : 'City is required';
      case 'state':
        return trimmedValue.length > 0 ? '' : 'State is required';
      case 'zip':
        return /^\d{6}$/.test(trimmedValue) ? '' : '6-digit Pincode required';
      case 'gstin':
        if (!trimmedValue) return ''; // Optional
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(trimmedValue.toUpperCase())
          ? ''
          : 'Invalid GSTIN format';
      default:
        return '';
    }
  };

  const validateCurrentStep = (): boolean => {
    const stepFields = getStepFields(currentStep);
    let isValid = true;
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    stepFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'pan' || name === 'gstin') {
      finalValue = value.toUpperCase();
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));

    if (touched[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name as keyof FormData, finalValue) }));
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name as keyof FormData, formData[name as keyof FormData]) }));
  };

  const handleFileUpload = (name: string) => (file: File | null) => {
    setFiles(prev => ({ ...prev, [name]: file }));
    setUploadedStatus(prev => ({ ...prev, [name]: !!file }));
  };

  const nextStep = () => {
    const isValid = validateCurrentStep();
    if (!isValid) {
      const errorKeys = Object.keys(errors);
      if (errorKeys.length > 0) {
        alert(`Please fix these errors before proceeding:\n- ${errorKeys.join('\n- ')}`);
      }
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 3));
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCurrentStep()) return;

    const requiredDocs = ['panCard', 'premiseProof', 'photoId'];
    if (formData.premiseType === 'manufacturing') requiredDocs.push('layoutPlan');

    const missingDocs = requiredDocs.filter(docKey => !uploadedStatus[docKey] && !existingDocs?.[docKey]);

    if (missingDocs.length > 0) {
      alert(`Please upload the following documents: ${missingDocs.join(', ')}`);
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
        name: user?.displayName || formData.businessName,
        email: user?.email || formData.email || '',
        contact: user?.phoneNumber || formData.mobile || ''
      }
    });

    if (!started) {
      alert("Failed to initiate payment. Please check your connection.");
      setIsPaying(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CelebrationPopup trigger={isSuccess} message="" />
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-700/50">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Application Submitted!</h2>
          <p className="text-slate-300 mb-8">
            Your trade license application has been received. We will verify your documents and contact you shortly.
            <br />
            <span className="text-sky-400 font-mono block mt-2">Ref: {formId}</span>
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/services/trade-license")}
              className="w-full bg-slate-700/50 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 border border-slate-600"
            >
              Back to Services
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold py-3 px-6 rounded-lg transition-colors duration-200 border border-emerald-500/30"
            >
              Start New Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white p-4 md:p-8 font-sans relative">
      <div className="absolute top-5 left-5 z-20">
        <FormBackButton />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <StatusBanner formId={formId} />

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
            <div className="mb-8 border-b border-slate-700/50 pb-4">
              <h1 className="text-2xl font-bold text-white mb-2">Trade License Application</h1>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className={`px-2 py-1 rounded ${currentStep >= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700'}`}>1. Business</span>
                <span className="h-px w-4 bg-slate-700"></span>
                <span className={`px-2 py-1 rounded ${currentStep >= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700'}`}>2. Contact</span>
                <span className="h-px w-4 bg-slate-700"></span>
                <span className={`px-2 py-1 rounded ${currentStep >= 3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700'}`}>3. Documents</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <FormInput
                    label="Business Name"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    error={errors.businessName}
                    icon={<Building className="w-4 h-4" />}
                    placeholder="e.g., Sharma Electronics"
                  />
                  <FormInput
                    label="PAN Card Number"
                    name="pan"
                    value={formData.pan}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    error={errors.pan}
                    icon={<FileText className="w-4 h-4" />}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <FormSelect
                    label="Constitution Type"
                    name="constitution"
                    value={formData.constitution}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    error={errors.constitution}
                    options={constitutionOptions}
                  />
                  <FormSelect
                    label="Premises Type"
                    name="premiseType"
                    value={formData.premiseType}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    error={errors.premiseType}
                    options={premiseOptions}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      error={errors.email}
                      icon={<Mail className="w-4 h-4" />}
                      placeholder="you@business.com"
                    />
                    <FormInput
                      label="Mobile Number"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      error={errors.mobile}
                      icon={<Phone className="w-4 h-4" />}
                      placeholder="9876543210"
                      maxLength={10}
                    />
                  </div>
                  <FormInput
                    label="Business Address"
                    name="address1"
                    value={formData.address1}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    error={errors.address1}
                    icon={<MapPin className="w-4 h-4" />}
                    placeholder="Plot No. 123, Street Name, Area"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <FormInput
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      error={errors.city}
                      placeholder="Mumbai"
                    />
                    <FormSelect
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      error={errors.state}
                      options={stateOptions}
                    />
                    <FormInput
                      label="Pincode"
                      name="zip"
                      value={formData.zip}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      error={errors.zip}
                      placeholder="400001"
                      maxLength={6}
                    />
                  </div>
                  <FormInput
                    label="GSTIN (Optional)"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    error={errors.gstin}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg mb-4">
                    <p className="text-sm text-blue-200">
                      Please ensure all documents are clear and readable. Max file size 5MB.
                    </p>
                  </div>

                  <FileUploader
                    label="PAN Card Copy"
                    name="panCard"
                    required
                    onChange={handleFileUpload('panCard')}
                    fileName={files.panCard?.name || null}
                  />
                  <FileUploader
                    label="Proof of Premises (Rent Agreement / Property Tax Receipt)"
                    name="premiseProof"
                    required
                    onChange={handleFileUpload('premiseProof')}
                    fileName={files.premiseProof?.name || null}
                  />
                  <FileUploader
                    label="Photo ID Proof (Aadhaar / Voter ID / Passport)"
                    name="photoId"
                    required
                    onChange={handleFileUpload('photoId')}
                    fileName={files.photoId?.name || null}
                  />
                  <FileUploader
                    label={
                      formData.premiseType === 'manufacturing'
                        ? "Layout Plan (Mandatory for Manufacturing)"
                        : "Layout Plan (Optional)"
                    }
                    name="layoutPlan"
                    required={formData.premiseType === 'manufacturing'}
                    onChange={handleFileUpload('layoutPlan')}
                    fileName={files.layoutPlan?.name || null}
                  />
                </div>
              )}

              <div className="flex justify-between mt-10 pt-6 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all ${currentStep === 1
                    ? 'opacity-50 cursor-not-allowed text-slate-500'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  Previous
                </button>

                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-8 py-2.5 rounded-lg font-bold text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 shadow-lg shadow-cyan-900/20 transition-all transform hover:scale-105"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-2.5 rounded-lg font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="hidden lg:block">
          <InfoSidebar
            title="Application Guide"
            steps={[
              { title: "Business Details", desc: "Share name, PAN, and premises type." },
              { title: "Contact Info", desc: "Provide address, email, and phone." },
              { title: "Upload Docs", desc: "PAN, address proof, ID, and layout plan." },
            ]}
            tips={[
              "No digital signature needed for this step.",
              "For rented premises, submit notarized rent agreement.",
              "Manufacturing units require a layout plan.",
              "Service fee ranges ₹500–₹5,000 based on city & business size."
            ]}
            packageMode={packageMode}
          />
        </div>
      </div>
    </div>
  );
}