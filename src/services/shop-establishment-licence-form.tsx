import React, { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  FileText,
  Loader2,
  Shield,
  Store,
  Upload,
  X,
} from "lucide-react";
import CelebrationPopup from "../components/CelebrationPopup";
import { useRazorpay } from "../hooks/useRazorpay";
import { calculateGST, calculateTotalWithGST, PRICING_CONFIG } from "../data/pricingConfig";
import { triggerNotification } from "./NotificationService";
import { RazorpaySuccessResponse } from "./razorpayService";
import FormBackButton from "../components/FormBackButton";

import { db, storage } from "./firebase";
import { sendConfirmationEmail } from "./emailService";
import { buildInitialApplicationStatus } from "./applicationStatus";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type DocKey =
  | "incorporationDocs"
  | "premisesProof"
  | "directorKyc"
  | "companyPan"
  | "bankStatement"
  | "employeeDetails"
  | "electricityBill"
  | "ownerIdProof"
  | "ownerAddressProof"
  | "photo"
  | "authorizationLetter";

interface ShopFormProps {
  user: {
    uid: string;
    email?: string;
    displayName?: string;
    phoneNumber?: string;
  };
}

interface ShopFormLocationState {
  entityType?: string;
  totalCost?: number;
  totalPaid?: number;
}

interface FormData {
  businessName: string;
  tradeName: string;
  constitution: string;
  panNumber: string;
  dateOfCommencement: string;
  gstin: string;
  cinOrLlpin: string;
  establishmentCategory: string;
  natureOfBusiness: string;
  businessDescription: string;
  employerName: string;
  employerFatherName: string;
  employerDob: string;
  employerDesignation: string;
  employerAadhaar: string;
  employerMobile: string;
  employerEmail: string;
  managerName: string;
  managerMobile: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  state: string;
  district: string;
  pincode: string;
  policeStation: string;
  municipality: string;
  wardNumber: string;
  zoneName: string;
  labourOfficeCircle: string;
  ownershipType: string;
  propertyOwnerName: string;
  maleEmployees: string;
  femaleEmployees: string;
  otherEmployees: string;
  totalEmployees: string;
  openTime: string;
  closeTime: string;
  weeklyHoliday: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  declaration1: boolean;
  declaration2: boolean;
}

const SERVICE_ID = "shop-establishment";
const SERVICE_NAME = "Shop & Establishment License";
const BASE_PRICE = PRICING_CONFIG[SERVICE_ID]?.fee || 1999;

const STORAGE_KEY = "shopEstablishmentFormData";
const UPLOADED_DOCS_KEY = "shopEstablishmentUploadedDocs";

const initialData: FormData = {
  businessName: "",
  tradeName: "",
  constitution: "",
  panNumber: "",
  dateOfCommencement: "",
  gstin: "",
  cinOrLlpin: "",
  establishmentCategory: "",
  natureOfBusiness: "",
  businessDescription: "",
  employerName: "",
  employerFatherName: "",
  employerDob: "",
  employerDesignation: "",
  employerAadhaar: "",
  employerMobile: "",
  employerEmail: "",
  managerName: "",
  managerMobile: "",
  addressLine1: "",
  addressLine2: "",
  locality: "",
  state: "",
  district: "",
  pincode: "",
  policeStation: "",
  municipality: "",
  wardNumber: "",
  zoneName: "",
  labourOfficeCircle: "",
  ownershipType: "",
  propertyOwnerName: "",
  maleEmployees: "",
  femaleEmployees: "",
  otherEmployees: "",
  totalEmployees: "",
  openTime: "",
  closeTime: "",
  weeklyHoliday: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  declaration1: false,
  declaration2: false,
};

const constitutionOptions = [
  { value: "Private Limited Company", label: "Private Limited Company" },
  { value: "LLP", label: "LLP (Limited Liability Partnership)" },
  { value: "Partnership", label: "Partnership Firm" },
  { value: "Proprietorship", label: "Proprietorship" },
];

const stateOptions = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab",
  "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
].sort();

const establishmentCategories = [
  { value: "shop", label: "Shop" },
  { value: "commercial_establishment", label: "Commercial Establishment" },
  { value: "office", label: "Office / Corporate Office" },
  { value: "restaurant", label: "Restaurant / Food Business" },
  { value: "warehouse", label: "Warehouse / Godown" },
  { value: "service_center", label: "Service Centre" },
  { value: "other", label: "Other Establishment" },
];

const businessNatureOptions = [
  { value: "retail", label: "Retail Trading" },
  { value: "wholesale", label: "Wholesale Trading" },
  { value: "services", label: "Professional / Business Services" },
  { value: "manufacturing", label: "Manufacturing / Processing" },
  { value: "food", label: "Food / Restaurant / Catering" },
  { value: "it", label: "IT / Software / Consulting" },
  { value: "healthcare", label: "Healthcare / Clinic" },
  { value: "education", label: "Education / Training" },
  { value: "other", label: "Other" },
];

const documentList: Array<{
  key: DocKey;
  label: string;
  required: boolean;
  helperText: string;
  accept?: string;
  acceptedLabel?: string;
}> = [
  {
    key: "incorporationDocs",
    label: "Business Registration Documents",
    required: true,
    helperText: "Upload the certificate that proves your business is registered. For companies, include COI, MoA and AoA. For LLPs or firms, upload the LLP agreement or partnership deed.",
  },
  {
    key: "premisesProof",
    label: "Shop / Office Address Proof",
    required: true,
    helperText: "Upload proof for the place where the business runs. Use a rent agreement, lease deed, sale deed or property tax receipt.",
  },
  {
    key: "directorKyc",
    label: "Owner / Director / Partner KYC",
    required: true,
    helperText: "Upload PAN and Aadhaar for the owner, authorised signatory, directors or partners. A single combined PDF is easiest.",
  },
  {
    key: "companyPan",
    label: "Business PAN Card",
    required: true,
    helperText: "Upload the PAN card issued in the name of the company, LLP, firm or proprietor.",
  },
  {
    key: "bankStatement",
    label: "Business Bank Statement",
    required: true,
    helperText: "Upload the latest bank statement or passbook page showing account holder name, account number and IFSC.",
  },
  {
    key: "employeeDetails",
    label: "Employee Details Sheet",
    required: true,
    helperText: "Upload a sheet with employee name, father's name, date of joining and salary. Excel or CSV is preferred, but PDF is also accepted.",
    accept: ".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv",
    acceptedLabel: "PDF, image, Excel or CSV",
  },
  {
    key: "electricityBill",
    label: "Recent Electricity Bill",
    required: true,
    helperText: "Upload the latest electricity bill for the shop, office or business premises. The address should match your business address.",
  },
  {
    key: "ownerIdProof",
    label: "Authorised Person ID Proof",
    required: true,
    helperText: "Upload any government ID for the owner or authorised signatory, such as Aadhaar, passport, voter ID or driving licence.",
  },
  {
    key: "ownerAddressProof",
    label: "Authorised Person Address Proof",
    required: true,
    helperText: "Upload address proof for the owner or authorised signatory, such as Aadhaar, bank statement, utility bill or passport.",
  },
  {
    key: "photo",
    label: "Authorised Person Photo",
    required: true,
    helperText: "Upload a clear passport-size photo of the owner or authorised signatory.",
    accept: ".jpg,.jpeg,.png",
    acceptedLabel: "JPG or PNG image",
  },
  {
    key: "authorizationLetter",
    label: "Authorization Letter",
    required: false,
    helperText: "Upload this only if someone other than the owner is signing or submitting the application. A board resolution or authorization letter works.",
  },
];

const stepLabels = [
  { id: 1, label: "Business Details" },
  { id: 2, label: "Employer Details" },
  { id: 3, label: "Place of Business" },
  { id: 4, label: "Employees & Hours" },
  { id: 5, label: "Documents" },
  { id: 6, label: "Consent" },
];

const loadSavedData = (): FormData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialData, ...JSON.parse(saved) } : initialData;
  } catch {
    return initialData;
  }
};

const validate = {
  pan: (v: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v),
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v),
  pincode: (v: string) => /^\d{6}$/.test(v),
  ifsc: (v: string) => v === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v),
  gstin: (v: string) => v === "" || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v),
};

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative ml-2 inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-500 transition-colors hover:text-cyan-400"
        aria-label="More information"
      >
        <AlertCircle className="h-4 w-4" />
      </button>
      {show && (
        <div className="absolute left-1/2 top-full z-[100] mt-2 w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-center text-[11px] font-normal normal-case tracking-normal text-slate-300 shadow-2xl">
          {text}
          <div className="absolute -top-1 left-1/2 -ml-1 h-2 w-2 rotate-45 border-l border-t border-slate-700 bg-slate-900" />
        </div>
      )}
    </div>
  );
};

const FormInput = ({
  label,
  error,
  hint,
  optional,
  infoText,
  required,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  infoText?: string;
}) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="mb-4 group">
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white transition-colors group-focus-within:text-cyan-400">
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs font-medium text-slate-500">Optional</span>}
      </div>
      <input
        id={inputId}
        required={required}
        aria-invalid={!!error}
        className={`block w-full rounded-lg border bg-slate-800/50 p-3 text-sm text-white shadow-sm outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-slate-500 focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-slate-700 hover:border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
        } ${className || ""}`}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 flex items-center text-xs text-red-400">
          <AlertCircle className="mr-1 h-3 w-3 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs font-mono text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
};

const SelectInput = ({
  label,
  error,
  options,
  required,
  optional,
  infoText,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
  infoText?: string;
}) => (
  <div className="mb-4 group">
    <div className="mb-1.5 flex items-baseline justify-between">
      <div className="flex items-center">
        <label className="block text-sm font-medium text-white">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      {optional && <span className="text-xs font-medium text-slate-500">Optional</span>}
    </div>
    <div className="relative">
      <select
        required={required}
        className={`block w-full appearance-none rounded-lg border bg-slate-800/50 p-3 pr-10 text-sm text-white shadow-sm outline-none backdrop-blur-sm transition-all duration-200 focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-slate-700 hover:border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
        }`}
        {...props}
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-500" />
    </div>
    {error && (
      <p className="mt-1.5 flex items-center text-xs text-red-400">
        <AlertCircle className="mr-1 h-3 w-3" /> {error}
      </p>
    )}
  </div>
);

const TextAreaInput = ({
  label,
  error,
  required,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) => (
  <div className="mb-4 group">
    <label className="mb-1.5 block text-sm font-medium text-white">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    <textarea
      required={required}
      className={`block min-h-[110px] w-full resize-none rounded-lg border bg-slate-800/50 p-3 text-sm text-white shadow-sm outline-none backdrop-blur-sm transition-all duration-200 placeholder:text-slate-500 focus:ring-2 ${
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
          : "border-slate-700 hover:border-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20"
      }`}
      {...props}
    />
    {error && (
      <p className="mt-1.5 flex items-center text-xs text-red-400">
        <AlertCircle className="mr-1 h-3 w-3" /> {error}
      </p>
    )}
  </div>
);

const FileUploader = ({
  label,
  helperText,
  value,
  onChange,
  required,
  accept = ".pdf,.jpg,.jpeg,.png",
  acceptedLabel = "PDF, JPG or PNG",
  error,
}: {
  label: string;
  helperText: string;
  value: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  accept?: string;
  acceptedLabel?: string;
  error?: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit");
      return;
    }
    onChange(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    processFile(event.dataTransfer.files?.[0] || null);
  };

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="block text-sm font-medium text-white">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {!required && <span className="text-xs font-medium text-slate-500">Optional</span>}
      </div>
      <p className="mb-2 text-xs leading-5 text-slate-400">{helperText}</p>
      <div
        className={`group relative cursor-pointer rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
          error
            ? "border-red-500 bg-red-500/5"
            : isDragging
              ? "border-cyan-500 bg-cyan-500/10"
              : value
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => processFile(event.target.files?.[0] || null)}
        />
        <div className="flex items-center gap-3">
          <div className={`shrink-0 rounded-lg p-2 transition-colors ${value ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/50 text-slate-400 group-hover:text-cyan-400"}`}>
            {value ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            {value ? (
              <>
                <p className="truncate text-sm font-medium text-emerald-400">{value.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Selected and ready to submit</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-300 group-hover:text-white">Click or drag to upload</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{acceptedLabel} only, up to 5MB</p>
              </>
            )}
          </div>
          {value && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                processFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};

const PaymentBanner = ({
  amount,
  paid,
  paymentId,
}: {
  amount: number;
  paid: boolean;
  paymentId?: string | null;
}) => (
  <div className="relative mb-8 overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/70 via-slate-950/80 to-blue-950/60 p-4 shadow-[0_0_20px_rgba(6,182,212,0.16)] backdrop-blur-sm md:p-5">
    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500 opacity-20 blur-3xl" />
    <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-lg font-medium text-slate-500 line-through">₹2999</span>
          <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
            ₹{amount.toLocaleString("en-IN")}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${paid ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300" : "border-cyan-500/30 bg-cyan-500/20 text-cyan-300"}`}>
            {paid ? "Payment verified" : "GST included"}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-400">
          {paid ? `Payment ID: ${paymentId || "Verified"}` : "Complete payment once, then fill the government portal details."}
        </p>
      </div>
      <BadgeCheck className={paid ? "text-emerald-300" : "text-cyan-300"} size={28} />
    </div>
  </div>
);

const ProgressSidebar = ({
  currentStep,
  uploadedDocs,
}: {
  currentStep: Step;
  uploadedDocs: Record<string, boolean>;
}) => {
  const uploadedRequired = documentList.filter((item) => item.required && uploadedDocs[item.key]).length;
  const totalRequired = documentList.filter((item) => item.required).length;

  return (
    <aside className="sticky top-8 hidden lg:col-span-5 lg:block xl:col-span-4">
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-5 shadow-xl backdrop-blur-xl">
          <h3 className="mb-4 flex items-center text-sm font-semibold text-white">
            <span className="mr-2 rounded bg-cyan-500/20 p-1.5">
              <FileCheck className="h-4 w-4 text-cyan-400" />
            </span>
            Progress Status
          </h3>
          <div className="relative ml-2 space-y-5 border-l-2 border-slate-700/60">
            {stepLabels.map((item) => {
              const isActive = item.id === currentStep;
              const isDone = item.id < currentStep;
              return (
                <div key={item.id} className="relative ml-5">
                  <span className={`absolute -left-[27px] h-3.5 w-3.5 rounded-full border-2 border-slate-800 transition-all ${
                    isDone
                      ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                      : isActive
                        ? "scale-110 bg-gradient-to-br from-cyan-500 to-blue-700 ring-4 ring-cyan-500/20"
                        : "bg-slate-700"
                  }`} />
                  <h4 className={`text-sm font-medium ${isActive || isDone ? "text-white" : "text-slate-400"}`}>{item.label}</h4>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-300">
                    {item.id === 5 ? `${uploadedRequired}/${totalRequired} Documents Uploaded` : isDone ? "Completed" : isActive ? "In Progress" : "Pending"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-5 shadow-xl backdrop-blur-xl">
          <h3 className="mb-3 flex items-center text-sm font-semibold text-white">
            <span className="mr-2 rounded bg-amber-500/20 p-1.5">
              <FileText className="h-4 w-4 text-amber-400" />
            </span>
            Required Documents
          </h3>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-2">
            {documentList.map((item) => {
              const uploaded = uploadedDocs[item.key];
              return (
                <li
                  key={item.key}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 transition ${
                    uploaded
                      ? "border-cyan-500/30 bg-cyan-500/10"
                      : item.required
                        ? "border-slate-700/50 bg-slate-800/30"
                        : "border-slate-700/30 bg-slate-800/20 opacity-70"
                  }`}
                >
                  <span className="min-w-0 pr-3 text-sm font-medium text-slate-200">{item.label}</span>
                  {uploaded ? (
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-xs font-bold text-white">READY</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-900/70 p-5 shadow-xl backdrop-blur-xl">
          <h3 className="mb-2 text-sm font-semibold text-white">Government Portal Coverage</h3>
          <p className="text-sm leading-6 text-slate-400">
            Captures business constitution, employer/manager details, premises, employee count, working hours, bank details,
            required identity, premises, employee and entity documents.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default function ShopEstablishmentLicenseForm({ user }: ShopFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as ShopFormLocationState;
  const { displayRazorpay } = useRazorpay();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>(() => loadSavedData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<DocKey, File | null>>({
    incorporationDocs: null,
    premisesProof: null,
    directorKyc: null,
    companyPan: null,
    bankStatement: null,
    employeeDetails: null,
    electricityBill: null,
    ownerIdProof: null,
    ownerAddressProof: null,
    photo: null,
    authorizationLetter: null,
  });
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocKey, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(UPLOADED_DOCS_KEY) || "{}");
    } catch {
      return {} as Record<DocKey, boolean>;
    }
  });
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCaseId, setSuccessCaseId] = useState<string | null>(null);

  const role = (localStorage.getItem("role") || localStorage.getItem("userRole") || "").toLowerCase();
  const isPrivilegedUser = role === "admin" || role === "superadmin";
  const baseCost = navState.totalCost || BASE_PRICE;
  const totalPayable = calculateTotalWithGST(baseCost);
  const isFormUnlocked = isPaymentComplete || isPrivilegedUser;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem(UPLOADED_DOCS_KEY, JSON.stringify(uploadedDocs));
  }, [uploadedDocs]);

  useEffect(() => {
    if (navState.entityType && !formData.constitution) {
      const mapped: Record<string, string> = {
        pvt_ltd: "Private Limited Company",
        llp: "LLP",
        partnership: "Partnership",
        proprietorship: "Proprietorship",
      };
      setFormData((prev) => ({ ...prev, constitution: mapped[navState.entityType || ""] || prev.constitution }));
    }
  }, [formData.constitution, navState.entityType]);

  useEffect(() => {
    const total =
      Number(formData.maleEmployees || 0) +
      Number(formData.femaleEmployees || 0) +
      Number(formData.otherEmployees || 0);
    if (String(total) !== formData.totalEmployees) {
      setFormData((prev) => ({ ...prev, totalEmployees: String(total) }));
    }
  }, [formData.femaleEmployees, formData.maleEmployees, formData.otherEmployees, formData.totalEmployees]);

  const handleRazorpayPayment = useCallback(async () => {
    if (!user) {
      alert("Please login first.");
      return;
    }
    if (!formData.businessName || !formData.constitution || !validate.pan(formData.panNumber) || !formData.dateOfCommencement) {
      setPaymentError("Complete business name, constitution, PAN and commencement date before payment.");
      return;
    }

    setPaymentError("");
    setIsPaying(true);
    const started = await displayRazorpay(
      totalPayable,
      (response) => {
        setPaymentInfo(response);
        setIsPaymentComplete(true);
        setIsPaying(false);
      },
      {
        description: `Service Fee: ₹${baseCost} + GST (18%): ₹${calculateGST(baseCost)} = Total: ₹${totalPayable}`,
        prefill: {
          name: formData.employerName || user.displayName || "",
          email: user.email || formData.employerEmail || "",
          contact: formData.employerMobile || user.phoneNumber || "",
        },
        onClosed: () => setIsPaying(false),
      }
    );
    if (!started) {
      setPaymentError("Unable to start payment. Please retry.");
      setIsPaying(false);
    }
  }, [baseCost, displayRazorpay, formData, totalPayable, user]);

  const validateStep = (step: Step) => {
    const next: Record<string, string> = {};
    const required = (key: keyof FormData, label: string) => {
      if (typeof formData[key] === "string" && !String(formData[key]).trim()) next[key] = `${label} is required`;
    };

    if (step === 1) {
      required("businessName", "Name of Business");
      required("constitution", "Constitution");
      required("dateOfCommencement", "Date of commencement");
      if (!validate.pan(formData.panNumber)) next.panNumber = "Invalid PAN format (ABCDE1234F)";
      if (!validate.gstin(formData.gstin)) next.gstin = "Invalid GSTIN format";
      if (!isFormUnlocked) next.payment = "Complete payment to continue";
    }
    if (step === 2) {
      required("employerName", "Employer name");
      required("employerFatherName", "Father / spouse name");
      required("employerDesignation", "Designation");
      if (!validate.email(formData.employerEmail)) next.employerEmail = "Enter a valid email";
      if (!validate.mobile(formData.employerMobile)) next.employerMobile = "Enter a valid 10-digit mobile";
      if (formData.employerAadhaar && !/^\d{12}$/.test(formData.employerAadhaar)) next.employerAadhaar = "Aadhaar must be 12 digits";
      if (formData.managerMobile && !validate.mobile(formData.managerMobile)) next.managerMobile = "Enter valid manager mobile";
    }
    if (step === 3) {
      required("addressLine1", "Premises address");
      required("locality", "Locality");
      required("state", "State");
      required("district", "District");
      if (!validate.pincode(formData.pincode)) next.pincode = "Pincode must be 6 digits";
      required("ownershipType", "Occupancy type");
      required("propertyOwnerName", "Property owner name");
      required("establishmentCategory", "Establishment category");
      required("natureOfBusiness", "Nature of business");
      required("businessDescription", "Business description");
    }
    if (step === 4) {
      required("maleEmployees", "Male employee count");
      required("femaleEmployees", "Female employee count");
      required("otherEmployees", "Other employee count");
      required("openTime", "Opening time");
      required("closeTime", "Closing time");
      required("weeklyHoliday", "Weekly holiday");
      if (formData.ifsc && !validate.ifsc(formData.ifsc)) next.ifsc = "Invalid IFSC format";
    }
    if (step === 5) {
      documentList.forEach((item) => {
        if (item.required && !uploadedFiles[item.key]) next[item.key] = `${item.label} is required`;
      });
    }
    if (step === 6) {
      if (!formData.declaration1) next.declaration1 = "Declaration is required";
      if (!formData.declaration2) next.declaration2 = "Authorization is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const key = name as keyof FormData;
    let nextValue: string | boolean = type === "checkbox" ? (event.target as HTMLInputElement).checked : value;
    if (key === "panNumber") nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    if (key === "gstin") nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
    if (key === "cinOrLlpin") nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 21);
    if (["employerMobile", "managerMobile"].includes(key)) nextValue = value.replace(/\D/g, "").slice(0, 10);
    if (key === "employerAadhaar") nextValue = value.replace(/\D/g, "").slice(0, 12);
    if (key === "pincode") nextValue = value.replace(/\D/g, "").slice(0, 6);
    if (["maleEmployees", "femaleEmployees", "otherEmployees"].includes(key)) nextValue = value.replace(/\D/g, "").slice(0, 5);
    if (key === "ifsc") nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    setFormData((prev) => ({ ...prev, [key]: nextValue }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleFileUpload = (key: DocKey) => (file: File | null) => {
    setUploadedFiles((prev) => ({ ...prev, [key]: file }));
    setUploadedDocs((prev) => ({ ...prev, [key]: !!file }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(6, prev + 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrevious = () => {
    if (currentStep === 1) {
      navigate("/services/shop-establishment-license");
      return;
    }
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadFile = async (file: File, docId: string, key: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `shop-establishment-applications/${user.uid}/${docId}/${key}_${Date.now()}.${ext}`;
    const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return getDownloadURL(snap.ref);
  };

  const generateSequentialId = async (year: number) => {
    const counterRef = doc(db, "counters", `shop_establishment_ids_${year}`);
    let newCount = 0;
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { count: 1, year, createdAt: serverTimestamp() });
        newCount = 1;
      } else {
        newCount = (counterDoc.data()?.count || 0) + 1;
        transaction.update(counterRef, { count: newCount });
      }
    });
    return `SHOP-${year}-${String(newCount).padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    const invalidStep = stepLabels.find((item) => !validateStep(item.id as Step));
    if (invalidStep) {
      setCurrentStep(invalidStep.id as Step);
      return;
    }

    setIsSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const caseId = await generateSequentialId(year);
      const docId = `SHOP-${Date.now()}`;
      const uploadedFileUrls: Record<string, string> = {};

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file) uploadedFileUrls[key] = await uploadFile(file, docId, key);
      }

      const payload = {
        id: docId,
        caseId,
        type: SERVICE_ID,
        title: `${SERVICE_NAME} Application`,
        serviceType: SERVICE_ID,
        ...buildInitialApplicationStatus({ serviceType: SERVICE_ID, serviceName: SERVICE_NAME, userId: user.uid }),
        submittedAt: serverTimestamp(),
        formData,
        commonData: {
          businessName: formData.businessName,
          tradeName: formData.tradeName,
          constitution: formData.constitution,
          dateOfCommencement: formData.dateOfCommencement,
          panNumber: formData.panNumber,
        },
        uploadedFileUrls,
        userId: user.uid,
        folderId: "regibiz",
        taskStatus: "unassigned",
        userEmail: user.email,
        consentGiven: true,
        consentTimestamp: new Date().toISOString(),
        paymentStatus: isPaymentComplete ? "paid" : isPrivilegedUser ? "bypassed_by_admin" : "pending",
        paymentAmount: totalPayable,
        paymentCurrency: "INR",
        paymentId: paymentInfo?.razorpay_payment_id || null,
        paymentOrderId: paymentInfo?.razorpay_order_id || null,
        paymentSignature: paymentInfo?.razorpay_signature || null,
      };

      await setDoc(doc(db, "shop-establishment-applications", docId), payload);
      await setDoc(doc(db, "users", user.uid, "documents", docId), payload);

      await sendConfirmationEmail({
        name: formData.businessName || formData.employerName || "User",
        email: user.email || formData.employerEmail || "",
        service: SERVICE_NAME,
        caseId,
      });

      await triggerNotification("FORM_SUBMITTED", {
        customerId: user.uid,
        customerName: formData.businessName || formData.employerName,
        formTitle: `${SERVICE_NAME} Application`,
        serviceId: docId,
        caseId,
        businessName: formData.businessName,
        serviceType: SERVICE_ID,
      });

      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(UPLOADED_DOCS_KEY);
      setSuccessCaseId(caseId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-2">
          <FormInput label="Name of Business (as per PAN)" name="businessName" value={formData.businessName} onChange={handleChange} required error={errors.businessName} infoText="Enter the exact legal name as mentioned on PAN or incorporation documents." />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput label="Trade Name" name="tradeName" value={formData.tradeName} onChange={handleChange} optional hint="Name displayed on shop board, if different from legal name" />
            <SelectInput label="Constitution of Business" name="constitution" value={formData.constitution} onChange={handleChange} required error={errors.constitution} options={constitutionOptions} />
            <FormInput label="Date of Commencement" name="dateOfCommencement" type="date" value={formData.dateOfCommencement} onChange={handleChange} required error={errors.dateOfCommencement} max={new Date().toISOString().split("T")[0]} style={{ colorScheme: "dark" }} />
            <FormInput
              label="Firm PAN Number"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              required
              error={errors.panNumber}
              className="uppercase font-mono"
              placeholder="ABCDE1234F"
              maxLength={10}
              infoText="Enter your 10-digit Permanent Account Number. For companies/firms, enter the entity's PAN."
              hint="Permanent Account Number of the Business"
            />
            <FormInput label="GSTIN" name="gstin" value={formData.gstin} onChange={handleChange} optional error={errors.gstin} placeholder="Optional, if available" />
            <FormInput label="CIN / LLPIN / Registration No." name="cinOrLlpin" value={formData.cinOrLlpin} onChange={handleChange} optional />
          </div>
          {!isFormUnlocked && (
            <div className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <p className="mb-3 text-sm font-semibold text-cyan-200">Payment is required before continuing.</p>
              {errors.payment && <p className="mb-2 text-xs text-red-400">{errors.payment}</p>}
              {paymentError && <p className="mb-2 text-xs text-red-400">{paymentError}</p>}
              <button type="button" onClick={handleRazorpayPayment} disabled={isPaying} className="w-full rounded-xl bg-gradient-to-r from-teal-700 via-sky-700 to-blue-800 px-6 py-4 font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 disabled:opacity-60">
                {isPaying ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Opening payment...</> : `Pay ₹${totalPayable.toLocaleString("en-IN")} & Unlock Application`}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormInput label="Employer / Authorized Signatory Name" name="employerName" value={formData.employerName} onChange={handleChange} required error={errors.employerName} />
          <FormInput label="Father / Spouse Name" name="employerFatherName" value={formData.employerFatherName} onChange={handleChange} required error={errors.employerFatherName} />
          <FormInput label="Date of Birth" name="employerDob" type="date" value={formData.employerDob} onChange={handleChange} optional style={{ colorScheme: "dark" }} />
          <FormInput label="Designation" name="employerDesignation" value={formData.employerDesignation} onChange={handleChange} required error={errors.employerDesignation} />
          <FormInput label="Aadhaar Number" name="employerAadhaar" value={formData.employerAadhaar} onChange={handleChange} optional error={errors.employerAadhaar} maxLength={12} />
          <FormInput label="Mobile Number" name="employerMobile" value={formData.employerMobile} onChange={handleChange} required error={errors.employerMobile} />
          <FormInput label="Email Address" name="employerEmail" type="email" value={formData.employerEmail} onChange={handleChange} required error={errors.employerEmail} />
          <FormInput label="Manager Name" name="managerName" value={formData.managerName} onChange={handleChange} optional />
          <FormInput label="Manager Mobile" name="managerMobile" value={formData.managerMobile} onChange={handleChange} optional error={errors.managerMobile} />
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SelectInput label="Establishment Category" name="establishmentCategory" value={formData.establishmentCategory} onChange={handleChange} required error={errors.establishmentCategory} options={establishmentCategories} />
            <SelectInput label="Nature of Business" name="natureOfBusiness" value={formData.natureOfBusiness} onChange={handleChange} required error={errors.natureOfBusiness} options={businessNatureOptions} />
          </div>
          <TextAreaInput label="Business Description / Activity" name="businessDescription" value={formData.businessDescription} onChange={handleChange} required error={errors.businessDescription} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput label="Premises Address Line 1" name="addressLine1" value={formData.addressLine1} onChange={handleChange} required error={errors.addressLine1} />
            <FormInput label="Address Line 2 / Landmark" name="addressLine2" value={formData.addressLine2} onChange={handleChange} optional />
            <FormInput label="Locality / Area" name="locality" value={formData.locality} onChange={handleChange} required error={errors.locality} />
            <SelectInput label="State / UT" name="state" value={formData.state} onChange={handleChange} required error={errors.state} options={stateOptions.map((state) => ({ value: state, label: state }))} />
            <FormInput label="District / City" name="district" value={formData.district} onChange={handleChange} required error={errors.district} />
            <FormInput label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} required error={errors.pincode} maxLength={6} />
            <FormInput label="Police Station" name="policeStation" value={formData.policeStation} onChange={handleChange} optional />
            <FormInput label="Municipality / Local Body" name="municipality" value={formData.municipality} onChange={handleChange} optional />
            <FormInput label="Ward Number" name="wardNumber" value={formData.wardNumber} onChange={handleChange} optional />
            <FormInput label="Zone / Circle" name="zoneName" value={formData.zoneName} onChange={handleChange} optional />
            <FormInput label="Labour Office / Inspector Circle" name="labourOfficeCircle" value={formData.labourOfficeCircle} onChange={handleChange} optional />
            <SelectInput label="Occupancy Type" name="ownershipType" value={formData.ownershipType} onChange={handleChange} required error={errors.ownershipType} options={[{ value: "owned", label: "Owned" }, { value: "rented", label: "Rented / Leased" }, { value: "licensed", label: "Licensed / Shared Premises" }]} />
            <FormInput label="Property Owner Name" name="propertyOwnerName" value={formData.propertyOwnerName} onChange={handleChange} required error={errors.propertyOwnerName} />
          </div>
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput label="Male Employees" name="maleEmployees" value={formData.maleEmployees} onChange={handleChange} required error={errors.maleEmployees} />
            <FormInput label="Female Employees" name="femaleEmployees" value={formData.femaleEmployees} onChange={handleChange} required error={errors.femaleEmployees} />
            <FormInput label="Other Employees" name="otherEmployees" value={formData.otherEmployees} onChange={handleChange} required error={errors.otherEmployees} />
            <FormInput label="Total Employees" name="totalEmployees" value={formData.totalEmployees} readOnly hint="Auto-calculated" />
            <FormInput label="Opening Time" name="openTime" type="time" value={formData.openTime} onChange={handleChange} required error={errors.openTime} style={{ colorScheme: "dark" }} />
            <FormInput label="Closing Time" name="closeTime" type="time" value={formData.closeTime} onChange={handleChange} required error={errors.closeTime} style={{ colorScheme: "dark" }} />
            <FormInput label="Weekly Holiday" name="weeklyHoliday" value={formData.weeklyHoliday} onChange={handleChange} required error={errors.weeklyHoliday} placeholder="e.g., Sunday" />
            <FormInput label="Bank Name" name="bankName" value={formData.bankName} onChange={handleChange} optional />
            <FormInput label="Bank Account Number" name="accountNumber" value={formData.accountNumber} onChange={handleChange} optional />
            <FormInput label="IFSC Code" name="ifsc" value={formData.ifsc} onChange={handleChange} optional error={errors.ifsc} />
          </div>
        </div>
      );
    }

    if (currentStep === 5) {
      return (
        <div className="grid grid-cols-1 gap-5">
          {documentList.map((item) => (
            <FileUploader
              key={item.key}
              label={item.label}
              helperText={item.helperText}
              value={uploadedFiles[item.key]}
              onChange={handleFileUpload(item.key)}
              required={item.required}
              accept={item.accept}
              acceptedLabel={item.acceptedLabel}
              error={errors[item.key]}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
          <h3 className="mb-3 text-lg font-bold text-white">Review Summary</h3>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <p><span className="text-slate-500">Business:</span> <span className="font-semibold text-white">{formData.businessName || "N/A"}</span></p>
            <p><span className="text-slate-500">Constitution:</span> <span className="font-semibold text-white">{formData.constitution || "N/A"}</span></p>
            <p><span className="text-slate-500">PAN:</span> <span className="font-semibold text-white">{formData.panNumber || "N/A"}</span></p>
            <p><span className="text-slate-500">Employees:</span> <span className="font-semibold text-white">{formData.totalEmployees || "0"}</span></p>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4 text-sm text-slate-300">
          <input type="checkbox" name="declaration1" checked={formData.declaration1} onChange={handleChange} className="mt-1" />
          <span>I confirm the information provided is true and matches the documents submitted for Shop & Establishment registration.</span>
        </label>
        {errors.declaration1 && <p className="text-xs text-red-400">{errors.declaration1}</p>}
        <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4 text-sm text-slate-300">
          <input type="checkbox" name="declaration2" checked={formData.declaration2} onChange={handleChange} className="mt-1" />
          <span>I authorize RegiBiz to process this application on the government portal and contact me for OTP/verification if required.</span>
        </label>
        {errors.declaration2 && <p className="text-xs text-red-400">{errors.declaration2}</p>}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/70 p-7 text-center">
          <Shield className="mx-auto mb-4 text-cyan-300" size={36} />
          <h2 className="mb-2 text-xl font-bold text-white">Login Required</h2>
          <p className="mb-5 text-sm text-slate-400">Please log in to apply for Shop & Establishment License.</p>
          <button type="button" onClick={() => navigate("/auth")} className="w-full rounded-xl bg-gradient-to-r from-teal-700 via-sky-700 to-blue-800 px-6 py-4 font-bold text-white">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (successCaseId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 text-center shadow-2xl">
          <CelebrationPopup trigger={!!successCaseId} message="" />
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-700">
            <CheckCircle2 className="text-white" size={36} />
          </div>
          <h2 className="mb-2 text-3xl font-extrabold text-white">Submitted</h2>
          <p className="text-sm text-slate-400">Your Shop & Establishment License application has been submitted.</p>
          <div className="my-6 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Case ID</p>
            <p className="mt-1 font-mono text-xl font-bold text-white">{successCaseId}</p>
          </div>
          <button type="button" onClick={() => navigate("/documents")} className="w-full rounded-xl bg-gradient-to-r from-teal-700 via-sky-700 to-blue-800 px-6 py-4 font-bold text-white">
            View in Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 text-center lg:hidden">
          <h1 className="text-2xl font-extrabold text-white">
            Shop & Establishment License
          </h1>
          <p className="mt-1 text-sm font-medium text-cyan-300/80">Step {currentStep} of 6</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <main className="glass-panel relative flex min-h-[650px] flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] lg:col-span-7 xl:col-span-8">
            <div className="absolute top-5 left-5 z-40">
              <FormBackButton />
            </div>


            <div className="flex-grow p-6 pt-14 md:p-10 md:pt-14">
              <div className="mb-8 hidden text-center lg:block">
                <h1 className="pb-1 text-4xl font-extrabold tracking-tight text-white">
                  Shop & Establishment License
                </h1>
                <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-slate-300">
                  {currentStep === 1 && "Enter business legal details, PAN and complete payment to begin."}
                  {currentStep === 2 && "Provide employer, authorized signatory and manager details."}
                  {currentStep === 3 && "Enter establishment category, business activity and premises address."}
                  {currentStep === 4 && "Provide employee strength, working hours and bank details."}
                  {currentStep === 5 && "Upload the documents required for government portal filing."}
                  {currentStep === 6 && "Review and provide declarations for submission."}
                </p>
              </div>

              <PaymentBanner amount={totalPayable} paid={isFormUnlocked} paymentId={paymentInfo?.razorpay_payment_id || null} />

              <form noValidate>
                <div className="grid grid-cols-1 gap-y-10">{renderStep()}</div>

                <div className="mt-12 border-t border-slate-700/50 pt-6">
                  <div className="flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="w-full rounded-xl border border-slate-600 px-6 py-4 font-semibold text-slate-300 transition-all duration-200 hover:bg-slate-800 hover:text-white md:w-auto"
                    >
                      Back
                    </button>
                    {currentStep < 6 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={currentStep === 1 && !isFormUnlocked}
                        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal-700 via-sky-700 to-blue-800 px-10 py-4 text-lg font-bold tracking-wide text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-1 hover:from-teal-800 hover:via-sky-800 hover:to-blue-900 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                      >
                        Next Step <ChevronRight className="ml-2 h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal-700 via-sky-700 to-blue-800 px-10 py-4 text-lg font-bold tracking-wide text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                      >
                        {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : "Submit Application"}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </main>

          <ProgressSidebar currentStep={currentStep} uploadedDocs={uploadedDocs} />
        </div>

        <div className="mt-12 pb-8 text-center text-sm font-medium tracking-wide text-slate-500">
          &copy; 2026 RegiBIZ. All rights reserved.
        </div>
      </div>
    </div>
  );
}