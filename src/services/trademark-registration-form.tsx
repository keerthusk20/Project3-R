// src/services/trademark-registration/form.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRazorpay } from '../hooks/useRazorpay';
import { db, storage } from './firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import FormBackButton from '../components/FormBackButton';

import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import { buildInitialApplicationStatus } from './applicationStatus';


// --- Validators ---
const validators = {
  required: (value: string) => value.trim().length > 0 || "This field is required",
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Please enter a valid email address",
  mobile: (value: string) => /^[6-9]\d{9}$/.test(value) || "Enter a valid 10-digit mobile number",
  pan: (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) || "Invalid PAN format (e.g., ABCDE1234F)",
  aadhaarLast4: (value: string) => /^\d{4}$/.test(value) || "Enter last 4 digits of Aadhaar",
  cin: (value: string) => /^[A-Z0-9]{21}$/.test(value) || "Invalid CIN format",
};

// --- Status Banner ---
const StatusBanner: React.FC = () => {
  const basePrice = 4500; // Individual base
  const gstAmount = calculateGST(basePrice);
  const totalPrice = calculateTotalWithGST(basePrice);

  return (
    <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
      <div className="z-10 mb-2 sm:mb-0">
        <div className="flex flex-col">
          <div className="flex items-baseline space-x-3">
            <span className="text-slate-500 font-medium line-through text-lg">₹9,999</span>
            <span className="text-emerald-400 font-bold text-2xl tracking-tight drop-shadow-sm">₹{totalPrice.toLocaleString('en-IN')}</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">Limited Offer</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">₹{basePrice.toLocaleString('en-IN')} fee + ₹{gstAmount.toLocaleString('en-IN')} GST (18%)</p>
        </div>
        <p className="text-slate-400 text-sm mt-1 font-medium">Service fees + professional assistance</p>
      </div>
      <div className="text-left sm:text-right z-10">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Case Reference</p>
        <p className="text-slate-200 font-mono font-medium text-sm md:text-base">TM-2026-{Math.random().toString(36).substr(2, 5).toUpperCase()}</p>
      </div>
    </div>
  );
};

// --- Form Input ---
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}
const FormInput: React.FC<FormInputProps> = ({ label, error, hint, optional, className, id, required, ...props }) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-white transition-colors group-focus-within:text-sky-400">
          {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <input
          id={inputId}
          className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-sky-500 focus:ring-sky-500/20'
            } ${className}`}
          aria-invalid={!!error}
          required={required}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

// --- Form Select ---
interface Option { value: string; label: string; }
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
  optional?: boolean;
}
const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, optional, id, required, value, ...props }) => {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <label htmlFor={selectId} className="block text-sm font-medium text-white transition-colors group-focus-within:text-sky-400">
          {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select
          id={selectId}
          className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 pr-10 appearance-none placeholder-slate-400 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none cursor-pointer ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-sky-500 focus:ring-sky-500/20'
            } ${!value ? 'text-slate-500' : 'text-white'}`}
          required={required}
          value={value}
          {...props}
        >
          <option value="" disabled>Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-900 bg-slate-100">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

// --- File Uploader ---
const FileUploader: React.FC<{
  label: string;
  name: string;
  accept?: string;
  onChange: (file: File | null) => void;
  required?: boolean;
}> = ({ label, name, accept = ".pdf,.jpg,.jpeg,.png", onChange, required }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    processFile(file);
  };

  const processFile = (file: File | null) => {
    if (file) {
      setFileName(file.name);
      onChange(file);
    } else {
      setFileName(null);
      onChange(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <label className="block text-sm font-medium text-white">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 ease-in-out cursor-pointer group ${isDragging ? 'border-sky-500 bg-sky-500/10' : fileName ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} name={name} accept={accept} className="hidden" onChange={handleFileChange} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 transition-colors ${fileName ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-sky-400'}`}>
            {fileName ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">File ready for upload</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-500 mt-0.5">PDF, JPEG, PNG (Max 5MB)</p>
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
              className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Info Sidebar ---
const InfoSidebar: React.FC<{
  formData: any;
  uploadedFiles: Record<string, boolean>;
  currentStep: number;
  onPreview: () => void;
}> = ({ formData, uploadedFiles, currentStep, onPreview }) => {
  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6 hidden lg:block">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-all duration-300">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
          <span className="bg-sky-500/20 p-1 rounded mr-2">
            <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          Progress Status
        </h3>
        <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-6 my-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="ml-5 relative">
              <span
                className={`absolute -left-[27px] w-3 h-3 rounded-full border-2 border-slate-800 transition-all duration-300 ${getStepStatus(step) === 'completed'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : getStepStatus(step) === 'active'
                    ? 'bg-sky-500 ring-4 ring-sky-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                    : 'bg-slate-700'
                  }`}
              ></span>
              <h4
                className={`text-xs font-medium transition-colors ${getStepStatus(step) === 'active'
                  ? 'text-white'
                  : getStepStatus(step) === 'completed'
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                  }`}
              >
                {step === 1 ? 'Brand Details' : step === 2 ? 'Applicant Info' : 'Docs & Payment'}
              </h4>
              <p className="text-slate-400 text-[10px] mt-0.5">
                {step === 3
                  ? `${Object.values(uploadedFiles).filter(Boolean).length}/3 Uploaded`
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
      <div
        className={`bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-opacity duration-300 ${currentStep === 3 ? 'opacity-100 ring-1 ring-sky-500/30' : 'opacity-70'
          }`}
      >
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-amber-500/20 p-1 rounded mr-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          Required Documents
        </h3>
        <ul className="space-y-2.5">
          {formData.applicantType === 'individual'
            ? [
              { label: 'PAN Card', key: 'panCard' },
              { label: 'Aadhaar Card', key: 'aadhaarCard' },
              { label: 'Logo (Optional)', key: 'logo' },
            ].map((item, idx) => {
              const isUploaded = uploadedFiles[item.key];
              return (
                <li key={idx} className="flex items-center text-xs text-slate-300 justify-between group">
                  <div className="flex items-center">
                    <div className={`mr-2.5 transition-all duration-500 ${isUploaded ? 'text-emerald-400 scale-110' : 'text-slate-600'}`}>
                      {isUploaded ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span className={isUploaded ? 'text-emerald-100 transition-colors' : 'transition-colors'}>{item.label}</span>
                  </div>
                  {isUploaded && <span className="text-[10px] text-emerald-500/80 font-mono">READY</span>}
                </li>
              );
            })
            : [
              { label: 'Incorporation Certificate', key: 'incorporationCert' },
              { label: 'Company PAN', key: 'companyPan' },
              { label: 'Logo (Optional)', key: 'logo' },
            ].map((item, idx) => {
              const isUploaded = uploadedFiles[item.key];
              return (
                <li key={idx} className="flex items-center text-xs text-slate-300 justify-between group">
                  <div className="flex items-center">
                    <div className={`mr-2.5 transition-all duration-500 ${isUploaded ? 'text-emerald-400 scale-110' : 'text-slate-600'}`}>
                      {isUploaded ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span className={isUploaded ? 'text-emerald-100 transition-colors' : 'transition-colors'}>{item.label}</span>
                  </div>
                  {isUploaded && <span className="text-[10px] text-emerald-500/80 font-mono">READY</span>}
                </li>
              );
            })}
        </ul>
      </div>

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
            <span className="text-white font-medium">₹{PRICING_CONFIG['trademark']?.fee?.toLocaleString() || '4,500'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">GST (18%)</span>
            <span className="text-white font-medium">₹{calculateGST(PRICING_CONFIG['trademark']?.fee || 4500).toLocaleString()}</span>
          </div>
          <div className="border-t border-slate-700/50 pt-2 flex justify-between font-bold">
            <span className="text-white">Total Payable</span>
            <span className="text-cyan-400">₹{calculateTotalWithGST(PRICING_CONFIG['trademark']?.fee || 4500).toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 italic">Inclusive of 18% GST</p>
        </div>
      </div>
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-rose-500/20 p-1 rounded mr-2">
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </span>
          Help Desk
        </h3>
        <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-white/5">
          <span className="text-slate-400 font-medium text-xs">contact Support</span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
          </div>
        </div>
      </div>
      <div className="pt-2 flex justify-center">
        <button
          onClick={onPreview}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600/50 text-white font-bold tracking-wide shadow-lg hover:bg-slate-700 hover:text-white hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all duration-300 flex items-center justify-center gap-2 group"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview Application
        </button>
      </div>
    </div >
  );
};

// --- Main Form ---
interface FormData {
  applicantType: string;
  applicationCategory: string;
  brandName: string;
  markType: string;
  niceClass: string;
  goodsServicesDescription: string;
  businessDescription: string;
  usageStatus: string;
  firstUseDate: string;
  requiresPoa: string;
  requiresUserAffidavit: string;
  fullName: string;
  pan: string;
  aadhaarLast4: string;
  companyName: string;
  cin: string;
  companyPan: string;
  email: string;
  mobile: string;
  address: string;
}

const initialData: FormData = {
  applicantType: '',
  applicationCategory: '',
  brandName: '',
  markType: '',
  niceClass: '',
  goodsServicesDescription: '',
  businessDescription: '',
  usageStatus: '',
  firstUseDate: '',
  requiresPoa: '',
  requiresUserAffidavit: '',
  fullName: '',
  pan: '',
  aadhaarLast4: '',
  companyName: '',
  cin: '',
  companyPan: '',
  email: '',
  mobile: '',
  address: '',
};

const applicantTypeOptions = [
  { value: 'individual', label: 'Individual Proprietor' },
  { value: 'company', label: 'Company / LLP' },
];

const usageStatusOptions = [
  { value: 'proposed', label: 'Proposed to be Used' },
  { value: 'used', label: 'Already in Use' },
];

interface TrademarkRegistrationFormProps {
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

export default function TrademarkRegistrationForm({ user, packageMode, onComplete, onBack, initialData: propsInitialData, existingDocs }: TrademarkRegistrationFormProps) {
  const navigate = useNavigate();
  const { displayRazorpay } = useRazorpay();
  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState({
    panCard: false,
    aadhaarCard: false,
    incorporationCert: false,
    companyPan: false,
    logo: false,
    powerOfAttorney: false,
    userAffidavit: false,
    msmeStartupProof: false,
  });
  const [captcha, setCaptcha] = useState({ val1: 0, val2: 0, userAnswer: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const servicePrice = formData.applicantType === 'company' ? 9000 : 4500;

  const generateCaptcha = useCallback(() => {
    setCaptcha({ val1: Math.floor(Math.random() * 10) + 1, val2: Math.floor(Math.random() * 10) + 1, userAnswer: '' });
  }, []);

  useEffect(() => {
    generateCaptcha();
  }, [generateCaptcha]);

  const handleFileUpload = (key: keyof typeof uploadedFiles) => (file: File | null) => {
    setUploadedFiles((prev) => ({ ...prev, [key]: !!file }));
  };

  const validateField = (name: keyof FormData, value: string): string => {
    switch (name) {
      case 'brandName':
      case 'businessDescription':
      case 'applicantType':
      case 'usageStatus':
      case 'fullName':
      case 'companyName':
      case 'address':
      case 'email':
      case 'mobile':
        return validators.required(value) === true ? '' : (validators.required(value) as string);
      case 'pan':
      case 'companyPan':
        return validators.pan(value) === true ? '' : (validators.pan(value) as string);
      case 'aadhaarLast4':
        return validators.aadhaarLast4(value) === true ? '' : (validators.aadhaarLast4(value) as string);
      case 'cin':
        return validators.cin(value) === true ? '' : (validators.cin(value) as string);
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const key = name as keyof FormData;
    let formattedValue = value;

    if (['pan', 'companyPan'].includes(key)) formattedValue = value.toUpperCase().slice(0, 10);
    if (key === 'mobile') formattedValue = value.replace(/\D/g, '').slice(0, 10);
    if (key === 'aadhaarLast4') formattedValue = value.replace(/\D/g, '').slice(0, 4);
    if (key === 'cin') formattedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 21);

    setFormData((prev) => ({ ...prev, [key]: formattedValue }));
    if (touched[key]) {
      setErrors((prev) => ({ ...prev, [key]: validateField(key, formattedValue) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const key = name as keyof FormData;
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, value) }));
  };

  const getStepFields = (step: number): (keyof FormData)[] => {
    switch (step) {
      case 1:
        const baseFields: (keyof FormData)[] = [
          'applicantType',
          'applicationCategory',
          'brandName',
          'markType',
          'niceClass',
          'goodsServicesDescription',
          'businessDescription',
          'usageStatus',
          'requiresPoa',
          'requiresUserAffidavit',
        ];
        if (formData.usageStatus === 'used') {
          return [...baseFields, 'firstUseDate'];
        }
        return baseFields;

      case 2:
        if (formData.applicantType === 'individual') {
          return [
            'fullName',
            'pan',
            'aadhaarLast4',
            'email',
            'mobile',
            'address',
          ];
        } else {
          return [
            'companyName',
            'cin',
            'companyPan',
            'email',
            'mobile',
            'address',
          ];
        }

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
        const touchedFields = { ...prev };
        fields.forEach((f) => (touchedFields[f] = true));
        return touchedFields;
      });
    }
    return isValid;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentStep((prev) => prev + 1);
    }
  };

  // Auto-submit after payment
  useEffect(() => {
    if (paymentInfo && !isSubmitting && !isSuccess) {
      handleFinalSubmission(paymentInfo);
    }
  }, [paymentInfo]);

  const handlePrevious = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => prev - 1);
  };

  const handleProceedToPayment = async () => {
    if (!validateCurrentStep()) return;

    // If in package mode or fee is 0, skip direct payment
    if (packageMode || (servicePrice as number) === 0) {
      handleFinalSubmission();
      return;
    }

    // Trigger payment
    setIsSubmitting(true);
    const started = await displayRazorpay(calculateTotalWithGST(servicePrice), (response) => {
      setPaymentInfo(response);
    }, {
      description: `Service Fee: ₹${servicePrice} + GST (18%): ₹${calculateGST(servicePrice)} = Total: ₹${calculateTotalWithGST(servicePrice)}`,
      prefill: {
        name: user?.displayName || formData.fullName || formData.companyName,
        email: user?.email || formData.email || '',
        contact: user?.phoneNumber || formData.mobile || ''
      }
    });

    if (!started) {
      alert("Failed to initiate payment. Please check your connection.");
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmission = async (payInfo?: RazorpaySuccessResponse) => {
    setIsSubmitting(true);
    try {
      const docId = `TM-${Date.now()}`;
      const applicationData = {
        id: docId,
        type: 'trademark',
        title: 'Trademark Registration',
        ...buildInitialApplicationStatus({ serviceType: 'trademark', serviceName: 'Trademark Registration', userId: user?.uid }),
        submittedAt: serverTimestamp(),
        formData: {
          ...formData,
          paymentStatus: payInfo ? 'paid' : (servicePrice > 0 && !packageMode ? 'pending' : 'free'),
          paymentId: payInfo?.razorpay_payment_id || '',
          orderId: payInfo?.razorpay_order_id || '',
        },
        userId: user?.uid || 'guest-user',
        folderId: 'regibiz',
        metaData: {
          submittedFrom: window.location.hostname,
          userAgent: navigator.userAgent,
        }
      };

      if (packageMode && onComplete) {
        onComplete(applicationData);
        return;
      }

      await setDoc(doc(db, "applications", docId), applicationData);

      await sendConfirmationEmail({
        name: formData.applicantType === 'individual' ? formData.fullName : formData.companyName,
        email: user.email,
        service: "Trademark Registration",
        caseId: docId
      });

      setIsSubmitting(false);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submission failed:', err);
      setIsSubmitting(false);
      alert('Submission failed. ' + (err.message || ''));
    }
  };

  // --- Preview Modal ---
  const PreviewModal = () => (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Trademark Application Preview</h3>
          <button
            onClick={() => setShowPreview(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-white mb-2">Brand Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Brand Name:</span>{' '}
                <span className="text-white">{formData.brandName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Usage Status:</span>{' '}
                <span className="text-white">
                  {usageStatusOptions.find((o) => o.value === formData.usageStatus)?.label || '—'}
                </span>
              </div>
              {formData.usageStatus === 'used' && (
                <div>
                  <span className="text-slate-500">First Use Date:</span>{' '}
                  <span className="text-white">{formData.firstUseDate || '—'}</span>
                </div>
              )}
              <div className="md:col-span-2">
                <span className="text-slate-500">Business Description:</span>{' '}
                <span className="text-white">{formData.businessDescription || '—'}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Applicant Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Applicant Type:</span>{' '}
                <span className="text-white">
                  {applicantTypeOptions.find((o) => o.value === formData.applicantType)?.label || '—'}
                </span>
              </div>
              {formData.applicantType === 'individual' ? (
                <>
                  <div>
                    <span className="text-slate-500">Full Name:</span>{' '}
                    <span className="text-white">{formData.fullName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">PAN:</span>{' '}
                    <span className="text-white">{formData.pan || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Aadhaar (Last 4):</span>{' '}
                    <span className="text-white">{formData.aadhaarLast4 || '—'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-slate-500">Company Name:</span>{' '}
                    <span className="text-white">{formData.companyName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">CIN:</span>{' '}
                    <span className="text-white">{formData.cin || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Company PAN:</span>{' '}
                    <span className="text-white">{formData.companyPan || '—'}</span>
                  </div>
                </>
              )}
              <div>
                <span className="text-slate-500">Email:</span>{' '}
                <span className="text-white">{formData.email || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Mobile:</span>{' '}
                <span className="text-white">{formData.mobile || '—'}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500">Address:</span>{' '}
                <span className="text-white">{formData.address || '—'}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Documents Uploaded</h4>
            <ul className="space-y-2">
              {Object.entries(uploadedFiles)
                .filter(([_, uploaded]) => uploaded)
                .map(([key, _]) => (
                  <li key={key} className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-300">
                      {key === 'panCard'
                        ? 'PAN Card'
                        : key === 'aadhaarCard'
                          ? 'Aadhaar Card'
                          : key === 'incorporationCert'
                            ? 'Incorporation Certificate'
                            : key === 'companyPan'
                              ? 'Company PAN'
                              : 'Brand Logo'}
                    </span>
                    <span className="text-emerald-400 font-medium flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ready
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              This is a preview only. No data is submitted until you click{' '}
              <span className="text-orange-400 font-medium">Proceed to Payment</span>.
            </p>
          </div>
        </div>
        <div className="p-6 bg-slate-800/50 flex justify-end gap-3">
          <button
            onClick={() => setShowPreview(false)}
            className="px-4 py-2 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700"
          >
            Close
          </button>
          <button
            onClick={handleProceedToPayment}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${isSubmitting
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
          >
            {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CelebrationPopup trigger={isSuccess} message="" />
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-700/50">
          <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
            <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Application Submitted!</h2>
          <p className="text-slate-300 mb-8">
            Your application has been received successfully. Your case ID is{' '}
            <span className="text-orange-400 font-mono">TM-2026-{Math.random().toString(36).substr(2, 5).toUpperCase()}</span>.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-700/50 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 border border-slate-600"
          >
            Start New Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">Trademark Registration</h1>
          <p className="text-orange-300/80 text-sm">Step {currentStep} of 3</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col">
            <div className="absolute top-5 left-5 z-20">
              <FormBackButton />
            </div>

            <div className="p-6 md:p-10 flex-grow">
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight drop-shadow-md">Trademark Registration</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
                  {currentStep === 1 &&
                    'Start by providing your brand details and usage information.'}
                  {currentStep === 2 &&
                    'Enter applicant details based on your entity type (Individual/Company).'}
                  {currentStep === 3 && 'Upload required documents and complete payment.'}
                </p>
              </div>
              <StatusBanner />
              <form noValidate>
                <div className="grid grid-cols-1 gap-y-10">
                  {currentStep === 1 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-sky-500 w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(56,189,248,0.5)]"></span>
                        Brand Details
                      </legend>
	                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput
                          label="Brand Name"
                          name="brandName"
                          value={formData.brandName}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.brandName}
                          placeholder="e.g., RegiBIZ"
                          required
                          autoFocus
                        />
	                        <FormSelect
	                          label="Applicant Type"
                          name="applicantType"
                          value={formData.applicantType}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.applicantType}
                          options={applicantTypeOptions}
                          required
	                        />
	                        <FormSelect
	                          label="Fee Category"
	                          name="applicationCategory"
	                          value={formData.applicationCategory}
	                          onChange={handleChange}
	                          onBlur={handleBlur}
	                          error={errors.applicationCategory}
	                          options={[
	                            { value: 'individual_startup_msme', label: 'Individual / Startup / MSME' },
	                            { value: 'others', label: 'Others' },
	                          ]}
	                          required
	                        />
	                      </div>
	                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	                        <FormSelect
	                          label="Mark Type"
	                          name="markType"
	                          value={formData.markType}
	                          onChange={handleChange}
	                          onBlur={handleBlur}
	                          error={errors.markType}
	                          options={[
	                            { value: 'word_mark', label: 'Word Mark' },
	                            { value: 'device_logo', label: 'Device / Logo Mark' },
	                            { value: 'composite', label: 'Composite Mark' },
	                          ]}
	                          required
	                        />
	                        <FormInput
	                          label="Nice Class"
	                          name="niceClass"
	                          value={formData.niceClass}
	                          onChange={handleChange}
	                          onBlur={handleBlur}
	                          error={errors.niceClass}
	                          placeholder="e.g., 35"
	                          required
	                        />
	                      </div>
	                      <FormInput
	                        label="Business Description"
                        name="businessDescription"
                        value={formData.businessDescription}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.businessDescription}
                        placeholder="Describe your products/services (e.g., SaaS platform for business registrations)"
                        required

	                      />
	                      <FormInput
	                        label="Goods / Services Description"
	                        name="goodsServicesDescription"
	                        value={formData.goodsServicesDescription}
	                        onChange={handleChange}
	                        onBlur={handleBlur}
	                        error={errors.goodsServicesDescription}
	                        placeholder="Exact goods/services to be filed in TM-A"
	                        required
	                      />
	                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormSelect
                          label="Usage Status"
                          name="usageStatus"
                          value={formData.usageStatus}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.usageStatus}
                          options={usageStatusOptions}
                          required
	                        />
	                        <FormSelect
	                          label="Power of Attorney Needed?"
	                          name="requiresPoa"
	                          value={formData.requiresPoa}
	                          onChange={handleChange}
	                          onBlur={handleBlur}
	                          error={errors.requiresPoa}
	                          options={[
	                            { value: 'yes', label: 'Yes - filing through agent/attorney' },
	                            { value: 'no', label: 'No' },
	                          ]}
	                          required
	                        />
	                        <FormSelect
	                          label="User Affidavit Needed?"
	                          name="requiresUserAffidavit"
	                          value={formData.requiresUserAffidavit}
	                          onChange={handleChange}
	                          onBlur={handleBlur}
	                          error={errors.requiresUserAffidavit}
	                          options={[
	                            { value: 'yes', label: 'Yes - already in use' },
	                            { value: 'no', label: 'No - proposed to be used' },
	                          ]}
	                          required
	                        />
	                        {formData.usageStatus === 'used' && (
                          <FormInput
                            label="First Use Date"
                            name="firstUseDate"
                            type="date"
                            value={formData.firstUseDate}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.firstUseDate}
                            required
                          />
                        )}
                      </div>
                    </fieldset>
                  )}
                  {currentStep === 2 && (
                    <fieldset className="space-y-4">
                      <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                        <span className="bg-emerald-500 w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                        Applicant Information
                      </legend>
                      {formData.applicantType === 'individual' ? (
                        <div className="space-y-5">
                          <FormInput
                            label="Full Name (as per PAN)"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.fullName}
                            placeholder="John Doe"
                            required
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormInput
                              label="PAN Number"
                              name="pan"
                              value={formData.pan}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              error={errors.pan}
                              placeholder="ABCDE1234F"
                              hint="Format: ABCDE1234F"
                              maxLength={10}
                              required
                            />
                            <FormInput
                              label="Aadhaar Last 4 Digits"
                              name="aadhaarLast4"
                              value={formData.aadhaarLast4}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              error={errors.aadhaarLast4}
                              placeholder="1234"
                              maxLength={4}
                              required
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <FormInput
                            label="Company Name (as per MCA)"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.companyName}
                            placeholder="RegiBIZ Technologies Pvt Ltd"
                            required
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormInput
                              label="CIN Number"
                              name="cin"
                              value={formData.cin}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              error={errors.cin}
                              placeholder="U72900MH2020PTC123456"
                              hint="21-character CIN from MCA"
                              maxLength={21}
                              required
                            />
                            <FormInput
                              label="Company PAN"
                              name="companyPan"
                              value={formData.companyPan}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              error={errors.companyPan}
                              placeholder="ABCDE1234F"
                              hint="Format: ABCDE1234F"
                              maxLength={10}
                              required
                            />
                          </div>
                        </div>
                      )}
                      <FormInput
                        type="email"
                        label="Email Address"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.email}
                        placeholder="you@business.com"
                        required
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput
                          type="tel"
                          label="Mobile Number"
                          name="mobile"
                          value={formData.mobile}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.mobile}
                          placeholder="9876543210"
                          maxLength={10}
                          required
                        />
                        <FormInput
                          label="Registered Address"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.address}
                          placeholder="Building No, Street, City, PIN"
                          required
                        />
                      </div>
                    </fieldset>
                  )}
                  {currentStep === 3 && (
                    <div>
                      <fieldset className="space-y-4 mb-8">
                        <legend className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
                          <span className="bg-amber-500 w-1 h-5 mr-3 rounded-full inline-block shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>
                          Document Uploads
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {formData.applicantType === 'individual' ? (
                            <>
                              <FileUploader
                                label="PAN Card"
                                name="panCard"
                                required
                                onChange={handleFileUpload('panCard')}
                              />
                              <FileUploader
                                label="Aadhaar Card"
                                name="aadhaarCard"
                                required
                                onChange={handleFileUpload('aadhaarCard')}
                              />
                            </>
                          ) : (
                            <>
                              <FileUploader
                                label="Incorporation Certificate"
                                name="incorporationCert"
                                required
                                onChange={handleFileUpload('incorporationCert')}
                              />
                              <FileUploader
                                label="Company PAN"
                                name="companyPan"
                                required
                                onChange={handleFileUpload('companyPan')}
                              />
                            </>
                          )}
	                          <FileUploader
	                            label="Brand Logo (Optional)"
                            name="logo"
                            accept=".png,.jpg,.jpeg,.svg"
	                            onChange={handleFileUpload('logo')}
	                          />
	                          {formData.requiresPoa === 'yes' && (
	                            <FileUploader
	                              label="Power of Attorney"
	                              name="powerOfAttorney"
	                              required
	                              onChange={handleFileUpload('powerOfAttorney')}
	                            />
	                          )}
	                          {(formData.requiresUserAffidavit === 'yes' || formData.usageStatus === 'used') && (
	                            <FileUploader
	                              label="User Affidavit"
	                              name="userAffidavit"
	                              required
	                              onChange={handleFileUpload('userAffidavit')}
	                            />
	                          )}
	                          {formData.applicationCategory === 'individual_startup_msme' && formData.applicantType === 'company' && (
	                            <FileUploader
	                              label="Startup / MSME Proof"
	                              name="msmeStartupProof"
	                              required
	                              onChange={handleFileUpload('msmeStartupProof')}
	                            />
	                          )}
                        </div>
                      </fieldset>
                      <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row items-center justify-between">
                        <div className="mb-4 sm:mb-0">
                          <h4 className="text-sm font-semibold text-white flex items-center">
                            <svg className="w-4 h-4 mr-2 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Security Verification
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">Please solve the math problem to prove you are human.</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 font-mono text-lg font-bold text-sky-400 tracking-wider">
                            {captcha.val1} + {captcha.val2} = ?
                          </div>
                          <input
                            type="number"
                            className="w-20 bg-slate-800 border border-slate-600 rounded-lg p-2 text-center text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                            placeholder="?"
                            value={captcha.userAnswer}
                            onChange={(e) => setCaptcha({ ...captcha, userAnswer: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={generateCaptcha}
                            className="p-2 text-slate-500 hover:text-white transition-colors"
                            title="Refresh Captcha"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
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
                    {currentStep < 3 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg bg-sky-500 text-white hover:bg-sky-400 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
                      >
                        Next Step
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        id="proceed-payment-btn"
                        type="button"
                        onClick={() => setShowPreview(true)}
                        disabled={isSubmitting}
                        className={`w-full md:w-auto px-8 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 transform border border-transparent ${isSubmitting
                          ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70 border-slate-700'
                          : 'bg-emerald-500/90 text-white hover:bg-emerald-500 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:translate-y-0 backdrop-blur-sm'
                          }`}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          `Pay ₹${calculateTotalWithGST(servicePrice).toLocaleString('en-IN')} & Submit`
                        )}
                      </button>
                    )}
                  </div>
                  <p className="mt-4 text-center text-xs text-slate-400">
                    Step {currentStep} of 3 — By continuing, you agree to our{' '}
                    <a href="#" className="text-sky-400 hover:text-sky-300 hover:underline transition-colors">
                      Terms
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-orange-400 hover:text-orange-300 hover:underline transition-colors">
                      Policy
                    </a>
                    .
                  </p>
                </div>
              </form>
            </div>
          </main>
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8">
            <InfoSidebar
              formData={formData}
              uploadedFiles={uploadedFiles}
              currentStep={currentStep}
              onPreview={() => setShowPreview(true)}
            />
          </aside>
        </div>
        <div className="mt-12 text-center text-slate-500 text-sm pb-8">&copy; 2026 RegiBIZ. All rights reserved.</div>
      </div>
      {showPreview && <PreviewModal />}
    </div>
  );
}