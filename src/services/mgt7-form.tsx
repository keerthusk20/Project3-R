import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CelebrationPopup from '../components/CelebrationPopup';
import { UserProfile } from '../types';
import { sendConfirmationEmail } from '../services/emailService';
import { useRazorpay } from '../hooks/useRazorpay';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
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

  date: (value: string): boolean => {
    if (!value || value.trim().length === 0) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime());
  },

  financialYear: (value: string): boolean => {
    const cleanValue = value.trim();
    const match = cleanValue.match(/^(\d{4})-(\d{4})$/);
    if (!match) return false;
    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);
    return endYear === startYear + 1 && startYear >= 1950 && startYear <= 2100;
  },

  number: (value: string, min: number = 1, max: number = Infinity): boolean => {
    const cleanValue = value.trim();
    if (!/^\d+$/.test(cleanValue)) return false;
    const num = parseInt(cleanValue, 10);
    return num >= min && num <= max;
  },

  email: (value: string): boolean => {
    const cleanValue = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue) && cleanValue.length <= 254;
  },

  din: (value: string): boolean => {
    return /^\d{8}$/.test(value.trim());
  },

  membershipNumber: (value: string): boolean => {
    return /^\d{5,7}$/.test(value.trim());
  },

  copNumber: (value: string): boolean => {
    return /^\d{4,8}$/.test(value.trim());
  },
};

const errorMessages = {
  required: "This field is required",
  cin: "Invalid CIN format (e.g., U62099PY2026PTC009629)",
  date: "Please enter a valid date",
  financialYear: "Invalid format. Use YYYY-YYYY (e.g., 2024-2025)",
  number: "Please enter a valid positive number",
  numberRange: (min: number, max: number) => `Value must be between ${min} and ${max}`,
  email: "Please enter a valid email address",
  din: "DIN must be exactly 8 digits",
  membershipNumber: "Invalid membership number (5-7 digits expected)",
  copNumber: "Invalid COP number (4-8 digits expected)",
  agmDateRange: "AGM date must fall within the selected financial year (Apr 1 - Mar 31)",
  fileRequired: (label: string) => `${label} is required`,
  fileType: (label: string) => `${label} must be a PDF file`,
  fileSize: (label: string) => `${label} must be less than 10MB`,
};

// ============================================================================
// FORM INPUT COMPONENT
// ============================================================================

interface FormInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  pattern?: string;
  inputMode?: "search" | "text" | "none" | "tel" | "url" | "numeric" | "decimal" | "email";
  autoCapitalize?: string;
  autoComplete?: string;
  className?: string;
  style?: React.CSSProperties;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  type = "text",
  placeholder,
  min,
  max,
  maxLength,
  pattern,
  inputMode,
  autoCapitalize,
  autoComplete,
  className = "",
  style
}) => (
  <div className="mb-5">
    <label
      htmlFor={name}
      className="block text-sm font-medium text-white mb-1.5 transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900"
    >
      {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
    </label>
    <input
      id={name}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      min={min}
      max={max}
      maxLength={maxLength}
      pattern={pattern}
      inputMode={inputMode}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      aria-invalid={!!error}
      aria-describedby={error ? `${name}-error` : undefined}
      className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg p-3 ${error ? 'border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500'
        } focus:ring-2 focus:outline-none transition-colors ${className}`}
      style={style}
    />
    {error && (
      <p id={`${name}-error`} className="mt-1 text-xs text-red-400 animate-pulse" role="alert" aria-live="polite">
        {error}
      </p>
    )}
  </div>
);

// ============================================================================
// FILE UPLOADER COMPONENT
// ============================================================================

interface FileUploaderProps {
  label: string;
  name: string;
  onChange: (file: File | null) => void;
  onValidate?: (isValid: boolean, error?: string) => void;
  required?: boolean;
  accept?: string;
  error?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  name,
  onChange,
  onValidate,
  required = false,
  accept = ".pdf",
  error
}) => {
  const [fileName, setFileName] = useState<string>("");

  const validateFile = (file: File): string | null => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) return errorMessages.fileType(label);
    if (file.size > MAX_FILE_SIZE) return errorMessages.fileSize(label);
    return null;
  };

  return (
    <div className="mb-5">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-white mb-1.5 transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900"
      >
        {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
      </label>
      <div className={`border-2 border-dashed rounded-lg p-4 transition-colors ${error ? 'border-red-500 bg-red-500/5' : 'border-slate-700 hover:border-cyan-500'
        }`}>
        <input
          type="file"
          name={name}
          id={name}
          accept={accept}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] || null;

            if (file) {
              const validationError = validateFile(file);
              if (validationError) {
                onValidate?.(false, validationError);
                setFileName("");
                onChange(null);
                return;
              }
              onValidate?.(true);
              setFileName(file.name);
              onChange(file);
            } else {
              setFileName("");
              onChange(null);
              onValidate?.(false, required ? errorMessages.fileRequired(label) : undefined);
            }
          }}
          className="hidden"
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <label
          htmlFor={name}
          className="cursor-pointer flex items-center justify-center text-center"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById(name)?.click();
            }
          }}
        >
          {fileName ? (
            <span className="text-emerald-400 text-sm font-medium break-all">{fileName}</span>
          ) : (
            <span className="text-slate-400 text-sm">Click to upload {accept.replace(/\./g, '').toUpperCase()} file</span>
          )}
        </label>
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-400 animate-pulse" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// PROGRESS SIDEBAR COMPONENT
// ============================================================================

const ProgressSidebar: React.FC<{
  currentStep: number;
  formId: string;
  uploadedCount: number;
  formData: FormData;
  packageMode?: boolean;
  isDraftSaving?: boolean;
  lastDraftSavedAt?: Date | null;
  onPreview: () => void;
}> = ({
  currentStep,
  formId,
  uploadedCount,
  formData,
  packageMode,
  isDraftSaving,
  lastDraftSavedAt,
  onPreview,
}) => {
    const steps = [
      { label: 'Company Info', step: 1 },
      { label: 'Financial Details', step: 2 },
      { label: 'Documents & Signatures', step: 3 },
    ];

    return (
      <div className="space-y-6 hidden lg:block">
        {/* Preview Button */}
        <button
          onClick={onPreview}
          className="w-full group relative overflow-hidden p-4 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-500 shadow-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-500 shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="text-left">
              <h4 className="text-white font-black text-[10px] uppercase tracking-widest mb-0.5">Preview Application</h4>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-tight">Review your data</p>
            </div>
            <div className="ml-auto w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>

        {/* Filing Progress */}
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

        {/* MGT-7A Summary */}
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
            <span className="bg-amber-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            MGT-7A Summary
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Case ID</span>
              <span className="text-cyan-400 font-mono">{formId || 'Generating...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Financial Year</span>
              <span className="text-white font-medium">{formData.financialYear || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Documents</span>
              <span className="text-white font-medium">{uploadedCount}/3 ready</span>
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
                <span className="text-white font-medium">₹{PRICING_CONFIG['mgt7']?.fee?.toLocaleString() || '2999'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">GST (18%)</span>
                <span className="text-white font-medium">₹{calculateGST(PRICING_CONFIG['mgt7']?.fee || 2999).toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-700/50 pt-2 flex justify-between text-base">
                <span className="text-white font-bold">Total Payable</span>
                <span className="text-cyan-400 font-bold">₹{calculateTotalWithGST(PRICING_CONFIG['mgt7']?.fee || 2999).toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">* Exclusive of ROC portal filing fees</p>
            </div>
          </div>
        )}

        {/* Filing Note */}
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
            Ensure all financial statements are audited before uploading. The MGT-7A form must be filed within 60 days of the AGM.
          </p>
        </div>
      </div>
    );
  };

// ============================================================================
// TYPES
// ============================================================================

interface FormData {
  cin: string;
  companyName: string;
  email: string;
  financialYear: string;
  agmDate: string;
  numberOfMembers: string;
  numberOfDirectors: string;
  directorDIN: string;
  membershipNumber: string;
  copNumber: string;
  professionalEmail: string;
}

interface ServiceFormProps {
  packageMode?: boolean;
  onComplete?: (data: any) => void;
}

interface MGT7FormProps extends ServiceFormProps {
  user: UserProfile;
  onBack?: () => void;
}

// ============================================================================
// MAIN COMPONENT: MGT-7A FORM
// ============================================================================

const PSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h4 className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
      <span className="w-8 h-[1px] bg-emerald-500/30" />
      {title}
    </h4>
    {children}
  </div>
);

const PGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
    {children}
  </div>
);

const PItem: React.FC<{ label: string; value: string | undefined; full?: boolean }> = ({ label, value, full }) => (
  <div className={`flex flex-col gap-1 ${full ? 'md:col-span-2' : ''}`}>
    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{label}</span>
    <span className="text-slate-200 text-sm font-medium leading-relaxed">{value || <span className="text-slate-600 italic">Not provided</span>}</span>
  </div>
);

const PreviewModal: React.FC<{
  formData: FormData;
  uploadedFiles: any;
  onClose: () => void;
  formId: string;
}> = ({ formData, uploadedFiles, onClose, formId }) => (
  <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative overflow-hidden my-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      {/* Header */}
      <div className="relative border-b border-slate-700/50 p-6 sm:p-8 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Review Application</h2>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Form MGT-7A • Case ID: {formId}</p>
        </div>
        <button onClick={onClose} className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700/50 group">
          <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-10 max-h-[70vh] overflow-y-auto custom-scrollbar relative">
        <PSection title="Company Identification">
          <PGrid>
            <PItem label="Corporate Identification Number (CIN)" value={formData.cin} />
            <PItem label="Company Name" value={formData.companyName} />
            <PItem label="Registered Email" value={formData.email} />
          </PGrid>
        </PSection>

        <PSection title="Filing Details">
          <PGrid>
            <PItem label="Financial Year" value={formData.financialYear} />
            <PItem label="Date of AGM" value={formData.agmDate} />
            <PItem label="Number of Members" value={formData.numberOfMembers} />
            <PItem label="Number of Directors" value={formData.numberOfDirectors} />
          </PGrid>
        </PSection>

        <PSection title="Professional Certification">
          <PGrid>
            <PItem label="Director/Signatory DIN" value={formData.directorDIN} />
            <PItem label="Membership Number" value={formData.membershipNumber} />
            <PItem label="COP Number" value={formData.copNumber} />
            <PItem label="Professional Email" value={formData.professionalEmail} />
          </PGrid>
        </PSection>

        <PSection title="Uploaded Documentation">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { id: 'balanceSheet', label: 'Balance Sheet' },
              { id: 'annualReport', label: 'Annual Report' },
              { id: 'shareholderList', label: 'Shareholder List' }
            ].map(doc => (
              <div key={doc.id} className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${uploadedFiles[doc.id] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{doc.label}</span>
                  <span className="text-xs font-medium text-slate-300">{uploadedFiles[doc.id] ? 'Uploaded' : 'Missing'}</span>
                </div>
              </div>
            ))}
          </div>
        </PSection>

        <div className="mt-12 p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[11px] text-amber-200/60 leading-relaxed font-medium">
              Please ensure all details match exactly with the company records. Incorrect information may lead to rejection by the ROC. You can edit any details by closing this preview.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-md flex justify-end">
        <button onClick={onClose} className="px-10 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20">
          Done Reviewing
        </button>
      </div>
    </div>
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

export default function MGT7Form({ user, packageMode = false, onComplete, onBack }: MGT7FormProps) {
  const navigate = useNavigate();
  const initialFormData: FormData = {
    cin: '',
    companyName: '',
    email: '',
    financialYear: '',
    agmDate: '',
    numberOfMembers: '1',
    numberOfDirectors: '1',
    directorDIN: '',
    membershipNumber: '',
    copNumber: '',
    professionalEmail: '',
  };
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [formId, setFormId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Draft state
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    balanceSheet: null,
    annualReport: null,
    shareholderList: null,
  });

  const uploadedCount = Object.values(uploadedFiles).filter(Boolean).length;
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const { displayRazorpay } = useRazorpay();
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const selectedCost = packageMode ? 0 : PRICING_CONFIG['mgt7']?.fee || 699;
  const isFormUnlocked = selectedCost === 0 || isPaymentComplete;

  const handleRazorpayPayment = useCallback(async () => {
    if (!user) {
      alert('Please login first.');
      return;
    }

    setSubmitError(null);
    setIsPaying(true);
    const feeToCharge = calculateTotalWithGST(selectedCost);

    const started = await displayRazorpay(feeToCharge, (response) => {
      setPaymentInfo(response);
      setIsPaymentComplete(true);
      setSubmitError(null);
      setIsPaying(false);
    }, {
      description: `Service Fee: ₹${selectedCost} + GST (18%): ₹${calculateGST(selectedCost)} = Total: ₹${calculateTotalWithGST(selectedCost)}`,
      prefill: {
        name: user.displayName || '',
        email: user.email || '',
        contact: '',
      }
    });

    if (!started) {
      setSubmitError('Unable to start payment. Please retry.');
      setIsPaying(false);
    }
  }, [displayRazorpay, user, formData.companyName, selectedCost]);

  useEffect(() => {
    if (isPaymentComplete && !isSubmitting && !isSuccess) {
      handleSubmit();
    }
  }, [isPaymentComplete]);

  // ============================================================================
  // INDEXEDDB HELPERS
  // ============================================================================

  const initDB = (): Promise<IDBDatabase> => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('RegiBIZFormDB', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files');
        }
      };
    });
  };

  const saveFileToIndexedDB = async (formIdVal: string, key: string, file: File) => {
    try {
      const db = await initDB();
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      await new Promise((resolve, reject) => {
        const req = store.put(file, `${formIdVal}_${key}`);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Could not save file to IndexedDB:', e);
    }
  };

  const getFileFromIndexedDB = async (formIdVal: string, key: string): Promise<File | null> => {
    try {
      const db = await initDB();
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      return new Promise((resolve, reject) => {
        const req = store.get(`${formIdVal}_${key}`);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Could not retrieve file from IndexedDB:', e);
      return null;
    }
  };

  const deleteFileFromIndexedDB = async (formIdVal: string, key: string) => {
    try {
      const db = await initDB();
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      await new Promise((resolve, reject) => {
        const req = store.delete(`${formIdVal}_${key}`);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Could not delete file from IndexedDB:', e);
    }
  };

  const clearAllFilesFromIndexedDB = async (formIdVal: string) => {
    const fileKeys = ['balanceSheet', 'annualReport', 'shareholderList'];
    await Promise.all(fileKeys.map((key) => deleteFileFromIndexedDB(formIdVal, key)));
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const initializeForm = async () => {
      let id = localStorage.getItem('mgt7a_formId');
      if (!id) {
        id = `MGT7A-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
        localStorage.setItem('mgt7a_formId', id);
      }
      setFormId(id);

      const fileKeys = ['balanceSheet', 'annualReport', 'shareholderList'];
      const restoredFiles: Record<string, File | null> = {};

      for (const key of fileKeys) {
        const file = await getFileFromIndexedDB(id, key);
        if (file) {
          restoredFiles[key] = file;
        }
      }

      setUploadedFiles(prev => ({ ...prev, ...restoredFiles }));
    };

    initializeForm();
  }, [user?.uid, packageMode]);

  // Firestore saveDraft
  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid || packageMode) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `mgt7_${user.uid}`), {
        userId: user.uid,
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: formId,
        serviceType: 'mgt7',
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
        const snap = await getDoc(doc(db, 'drafts', `mgt7_${user.uid}`));
        if (snap.exists()) {
          const data = snap.data();
          if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));
          if (data.currentStep) setCurrentStep(Math.min(Math.max(data.currentStep, 1), 3));
          if (data.caseId) setFormId(data.caseId);
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
  }, [currentStep, formData, isSuccess, packageMode]);

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
        navigate('/services/mgt-7-filing');
      } catch (err) {
        console.error('Exit save failed:', err);
      } finally {
        setIsDraftSaving(false);
      }
    } else {
      setShowExitConfirm(false);
      navigate('/services/mgt-7-filing');
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

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Special handler for CIN that forces uppercase
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

  // Special handler for numeric-only fields
  const handleNumericChange = (fieldName: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleFieldBlur = useCallback((fieldName: string, value: string) => {
    if (!value.trim()) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      let isValid = true;
      let errorMsg = '';

      switch (fieldName) {
        case 'cin':
          isValid = validators.cin(value);
          errorMsg = errorMessages.cin;
          break;
        case 'email':
        case 'professionalEmail':
          isValid = validators.email(value);
          errorMsg = errorMessages.email;
          break;
        case 'directorDIN':
          isValid = validators.din(value);
          errorMsg = errorMessages.din;
          break;
        case 'membershipNumber':
          isValid = validators.membershipNumber(value);
          errorMsg = errorMessages.membershipNumber;
          break;
        case 'copNumber':
          isValid = validators.copNumber(value);
          errorMsg = errorMessages.copNumber;
          break;
        case 'numberOfMembers':
          isValid = validators.number(value, 1, 10000);
          errorMsg = errorMessages.numberRange(1, 10000);
          break;
        case 'numberOfDirectors':
          isValid = validators.number(value, 1, 20);
          errorMsg = errorMessages.numberRange(1, 20);
          break;
        case 'financialYear':
          isValid = validators.financialYear(value);
          errorMsg = errorMessages.financialYear;
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

  const handleFileValidation = (key: string) => (isValid: boolean, error?: string) => {
    if (!isValid && error) {
      setFileErrors(prev => ({ ...prev, [key]: error }));
    } else if (isValid && fileErrors[key]) {
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

      if (!validators.required(formData.email)) {
        newErrors.email = errorMessages.required;
        firstInvalidField ||= 'email';
      } else if (!validators.email(formData.email)) {
        newErrors.email = errorMessages.email;
        firstInvalidField ||= 'email';
      }
    }

    if (step === 2) {
      if (!validators.required(formData.financialYear)) {
        newErrors.financialYear = errorMessages.required;
        firstInvalidField ||= 'financialYear';
      } else if (!validators.financialYear(formData.financialYear)) {
        newErrors.financialYear = errorMessages.financialYear;
        firstInvalidField ||= 'financialYear';
      }

      if (!formData.agmDate) {
        newErrors.agmDate = errorMessages.required;
        firstInvalidField ||= 'agmDate';
      } else if (!validators.date(formData.agmDate)) {
        newErrors.agmDate = errorMessages.date;
        firstInvalidField ||= 'agmDate';
      } else {
        // Cross-field validation: AGM must be within financial year
        const agmDate = new Date(formData.agmDate);
        const fyMatch = formData.financialYear.match(/^(\d{4})-(\d{4})$/);

        if (fyMatch && validators.financialYear(formData.financialYear)) {
          const fyStart = new Date(`${fyMatch[1]}-04-01`);
          const fyEnd = new Date(`${fyMatch[2]}-03-31`);

          if (agmDate < fyStart || agmDate > fyEnd) {
            newErrors.agmDate = errorMessages.agmDateRange;
            firstInvalidField ||= 'agmDate';
          }
        }
      }

      if (!validators.required(formData.numberOfMembers)) {
        newErrors.numberOfMembers = errorMessages.required;
        firstInvalidField ||= 'numberOfMembers';
      } else if (!validators.number(formData.numberOfMembers, 1, 10000)) {
        newErrors.numberOfMembers = errorMessages.numberRange(1, 10000);
        firstInvalidField ||= 'numberOfMembers';
      }

      if (!validators.required(formData.numberOfDirectors)) {
        newErrors.numberOfDirectors = errorMessages.required;
        firstInvalidField ||= 'numberOfDirectors';
      } else if (!validators.number(formData.numberOfDirectors, 1, 20)) {
        newErrors.numberOfDirectors = errorMessages.numberRange(1, 20);
        firstInvalidField ||= 'numberOfDirectors';
      }
    }

    if (step === 3) {
      if (!validators.required(formData.directorDIN)) {
        newErrors.directorDIN = errorMessages.required;
        firstInvalidField ||= 'directorDIN';
      } else if (!validators.din(formData.directorDIN)) {
        newErrors.directorDIN = errorMessages.din;
        firstInvalidField ||= 'directorDIN';
      }

      if (!validators.required(formData.membershipNumber)) {
        newErrors.membershipNumber = errorMessages.required;
        firstInvalidField ||= 'membershipNumber';
      } else if (!validators.membershipNumber(formData.membershipNumber)) {
        newErrors.membershipNumber = errorMessages.membershipNumber;
        firstInvalidField ||= 'membershipNumber';
      }

      if (!validators.required(formData.copNumber)) {
        newErrors.copNumber = errorMessages.required;
        firstInvalidField ||= 'copNumber';
      } else if (!validators.copNumber(formData.copNumber)) {
        newErrors.copNumber = errorMessages.copNumber;
        firstInvalidField ||= 'copNumber';
      }

      if (!validators.required(formData.professionalEmail)) {
        newErrors.professionalEmail = errorMessages.required;
        firstInvalidField ||= 'professionalEmail';
      } else if (!validators.email(formData.professionalEmail)) {
        newErrors.professionalEmail = errorMessages.email;
        firstInvalidField ||= 'professionalEmail';
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
      balanceSheet: 'Balance Sheet',
      annualReport: 'Annual Report',
      shareholderList: 'Shareholder List',
    };

    Object.entries(requiredDocs).forEach(([key, label]) => {
      if (!uploadedFiles[key]) {
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
          onConfirm: () => navigate('/services/mgt-7-filing')
        });
      }
      return;
    }
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================================================
  // SUBMISSION LOGIC
  // ============================================================================

  const handleSubmit = async () => {
    setSubmitError(null);

    const stepValid = validateStep(3);
    const filesValid = validateFiles();

    if (!stepValid || !filesValid) {
      setSubmitError("Please fill all required fields and upload all documents");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!isFormUnlocked) {
      await handleRazorpayPayment();
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedFileUrls: Record<string, string> = {};

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (!file) continue;

        const filePath = `mgt7a/${user.uid}/${formId}/${key}_${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        uploadedFileUrls[key] = await getDownloadURL(storageRef);
      }

      const submissionPayload = {
        id: formId,
        caseId: formId,
        type: 'mgt7a',
        title: 'MGT-7A - Annual Return Filing',
        ...buildInitialApplicationStatus({ serviceType: 'mgt7a', serviceName: 'MGT-7A - Annual Return Filing', userId: user.uid }),
        formData,
        uploadedFileUrls,
        userId: user.uid,
        folderId: 'regibiz',
        submittedAt: serverTimestamp(),
        paymentStatus: isPaymentComplete ? 'paid' : (packageMode ? 'package_included' : 'pending'),
        paymentInfo: paymentInfo || null,
        metaData: {
          submittedFrom: window.location.hostname,
          userAgent: navigator.userAgent,
        }
      };

      if (packageMode) {
        await clearAllFilesFromIndexedDB(formId);
        localStorage.removeItem('mgt7a_formId');
        onComplete?.(submissionPayload);
        return;
      }

      await setDoc(doc(db, "applications", formId), submissionPayload);
      await clearAllFilesFromIndexedDB(formId);
      localStorage.removeItem('mgt7a_formId');
      // Mark Firestore draft as submitted
      try { await setDoc(doc(db, 'drafts', `mgt7_${user.uid}`), { status: 'submitted' }, { merge: true }); } catch (_) { }

      await sendConfirmationEmail({
        name: formData.companyName,
        email: user.email || '',
        service: "MGT-7A Filing",
        caseId: formId
      });

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error("MGT-7A Submission failed:", error);
      setSubmitError(error.message || "Submission failed. Please try again.");
      alert(`Error: ${error.message || "Submission failed"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // PROCESSING OVERLAY
  // ============================================================================

  const ProcessingOverlay: React.FC = () => (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="processing-title">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6">
          <svg className="animate-spin w-full h-full text-cyan-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h3 id="processing-title" className="text-xl font-semibold text-white mb-2">Processing...</h3>
        <p className="text-slate-400 text-sm">Please wait while we submit your application.</p>
      </div>
    </div>
  );

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
            MGT-7A Application Submitted!
          </h2>
          <p className="text-slate-400 mb-4 text-sm">
            Your annual return filing has been received successfully. Our team will review the documents and contact you if any clarification is required.
          </p>
          <div className="mb-6">
            <p className="text-slate-500 text-xs mb-1">Your Case ID:</p>
            <p className="text-orange-400 font-mono font-bold text-sm tracking-wide break-all">{formId}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700 space-y-2">
            {[
              ['Company', formData.companyName || '—'],
              ['CIN', formData.cin || '—'],
              ['Financial Year', formData.financialYear || '—'],
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
              onClick={() => navigate('/services/mgt-7-filing')}
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
      {showPreview && (
        <PreviewModal
          formData={formData}
          uploadedFiles={uploadedFiles}
          formId={formId}
          onClose={() => setShowPreview(false)}
        />
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
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Form MGT-7A</h1>
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
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Form MGT-7A</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">Annual Return Filing</p>
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
                    />
                    <div className="md:col-span-2">
                      <FormInput
                        label="Email ID"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={(e) => handleFieldBlur('email', e.target.value)}
                        error={errors.email}
                        required
                        placeholder="contact@company.com"
                        autoCapitalize="none"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Financial Details */}
              {currentStep === 2 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm" aria-hidden="true">2</span>
                    Financial Details
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                      label="Financial Year"
                      name="financialYear"
                      type="text"
                      value={formData.financialYear}
                      onChange={handleChange}
                      onBlur={(e) => handleFieldBlur('financialYear', e.target.value)}
                      error={errors.financialYear}
                      required
                      placeholder="2024-2025"
                      maxLength={9}
                    />
                    <FormInput
                      label="AGM Date"
                      name="agmDate"
                      type="date"
                      value={formData.agmDate}
                      onChange={handleChange}
                      error={errors.agmDate}
                      required
                      min={formData.financialYear ? `${formData.financialYear.split('-')[0]}-04-01` : undefined}
                      max={formData.financialYear ? `${formData.financialYear.split('-')[1]}-03-31` : undefined}
                    />
                    <FormInput
                      label="Number of Members/Shareholders"
                      name="numberOfMembers"
                      type="number"
                      value={formData.numberOfMembers}
                      onChange={handleChange}
                      onBlur={(e) => handleFieldBlur('numberOfMembers', e.target.value)}
                      error={errors.numberOfMembers}
                      required
                      min="1"
                      max="10000"
                      inputMode="numeric"
                    />
                    <FormInput
                      label="Number of Directors"
                      name="numberOfDirectors"
                      type="number"
                      value={formData.numberOfDirectors}
                      onChange={handleChange}
                      onBlur={(e) => handleFieldBlur('numberOfDirectors', e.target.value)}
                      error={errors.numberOfDirectors}
                      required
                      min="1"
                      max="20"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Declaration & Documents */}
              {currentStep === 3 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm" aria-hidden="true">3</span>
                    Declaration & Documents
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                    <FormInput
                      label="Director DIN"
                      name="directorDIN"
                      value={formData.directorDIN}
                      onChange={handleNumericChange('directorDIN')}
                      onBlur={(e) => handleFieldBlur('directorDIN', e.target.value)}
                      error={errors.directorDIN}
                      required
                      placeholder="10842644"
                      maxLength={8}
                      inputMode="numeric"
                      pattern="\d*"
                    />
                    <FormInput
                      label="CA Membership Number"
                      name="membershipNumber"
                      value={formData.membershipNumber}
                      onChange={handleNumericChange('membershipNumber')}
                      onBlur={(e) => handleFieldBlur('membershipNumber', e.target.value)}
                      error={errors.membershipNumber}
                      required
                      placeholder="226526"
                      maxLength={7}
                      inputMode="numeric"
                      pattern="\d*"
                    />
                    <FormInput
                      label="Certificate of Practice (COP) Number"
                      name="copNumber"
                      value={formData.copNumber}
                      onChange={handleNumericChange('copNumber')}
                      onBlur={(e) => handleFieldBlur('copNumber', e.target.value)}
                      error={errors.copNumber}
                      required
                      maxLength={8}
                      inputMode="numeric"
                      pattern="\d*"
                    />
                    <FormInput
                      label="Professional Email"
                      name="professionalEmail"
                      type="email"
                      value={formData.professionalEmail}
                      onChange={handleChange}
                      onBlur={(e) => handleFieldBlur('professionalEmail', e.target.value)}
                      error={errors.professionalEmail}
                      required
                      placeholder="ca@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs" aria-hidden="true">📄</span>
                    Required Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FileUploader
                      label="Balance Sheet"
                      name="balanceSheet"
                      onChange={handleFileUpload('balanceSheet')}
                      onValidate={handleFileValidation('balanceSheet')}
                      required
                      error={fileErrors.balanceSheet}
                    />
                    <FileUploader
                      label="Annual Report"
                      name="annualReport"
                      onChange={handleFileUpload('annualReport')}
                      onValidate={handleFileValidation('annualReport')}
                      required
                      error={fileErrors.annualReport}
                    />
                    <FileUploader
                      label="Shareholder/Member List"
                      name="shareholderList"
                      onChange={handleFileUpload('shareholderList')}
                      onValidate={handleFileValidation('shareholderList')}
                      required
                      error={fileErrors.shareholderList}
                    />
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
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
                      disabled={isSubmitting || isPaying}
                      className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                    >
                      {isSubmitting || isPaying ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {isPaying ? 'Processing Payment...' : 'Submitting...'}
                        </>
                      ) : (
                        <>{isFormUnlocked ? '✓ Submit Application' : `Pay ₹${selectedCost} & Submit`}</>
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
              uploadedCount={uploadedCount}
              formData={formData}
              packageMode={packageMode}
              isDraftSaving={isDraftSaving}
              lastDraftSavedAt={lastDraftSavedAt}
              onPreview={() => setShowPreview(true)}
            />
          </aside>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm pb-8">© 2026 RegiBIZ. All rights reserved.</div>
      </div>
    </div>
  );
}

