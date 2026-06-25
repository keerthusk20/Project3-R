
// src/services/dpiit-form.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, storage } from './firebase';
import { doc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { triggerNotification } from '../services/NotificationService';
import { useRazorpay } from '../hooks/useRazorpay';
import { useNotification } from '../context/NotificationContext';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import {
  ArrowLeft, CheckCircle, CheckCircle2, ChevronRight, Loader2,
  Rocket, FileText, Building2, MapPin,
  Shield, AlertCircle, Upload, X,
  BadgeCheck, Info, Eye, FileCheck
} from 'lucide-react';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import FormBackButton from '../components/FormBackButton';
import { buildInitialApplicationStatus } from './applicationStatus';

import { calculateGST, calculateTotalWithGST } from '../data/pricingConfig';


interface StartupFormLocationState {
  entityType?: string;
  totalCost?: number;
  totalPaid?: number;
  initialData?: any;
}

const SERVICE_NAME = 'DPIIT Recognition';
const CONSTITUTION_FEES: Record<string, number> = {
  partnership: 2999,
  llp: 2999,
  pvt_ltd: 2999,
  opc: 2999,
};

// ─── Info Tooltip Component ──────────────────────────────────────────────────
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-500 hover:text-white transition-colors focus:outline-none"
        aria-label="More information"
      >
        <Info className="w-4 h-4" />
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

// ─── Progress Status Component ───────────────────────────────────────────────
const ProgressStatus: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = ['Profile', 'Founder/Partners', 'Address', 'Docs'];
  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'active';
    return 'pending';
  };
  return (
    <div className="bg-slate-950/90 backdrop-blur-3xl border border-slate-700/50 rounded-xl p-4 shadow-xl">
      <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
        <span className="bg-white/10 p-1.5 rounded mr-2">
          <FileCheck className="w-4 h-4 text-white" />
        </span>
        Progress
      </h3>
      <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-3">
        {steps.map((label, idx) => {
          const stepNum = idx + 1;
          const status = getStepStatus(stepNum);
          return (
            <div key={idx} className="ml-4 relative">
              <span
                className={`absolute -left-[23px] w-3 h-3 rounded-full border-2 border-slate-800 transition-all ${status === 'completed'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : status === 'active'
                    ? 'bg-white ring-2 ring-white/30 scale-110'
                    : 'bg-slate-700'
                  }`}
              />
              <span className={`text-xs font-medium ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Required Documents Component ────────────────────────────────────────────
const RequiredDocuments: React.FC<{
  uploadedFiles: Record<string, File | null>;
  orgType: string;
}> = ({ uploadedFiles, orgType }) => {
  const getDocsForOrgType = () => {
    const baseDocs = [
      { key: 'incorporationCert', label: 'Incorporation/Registration Certificate', required: true },
      { key: 'panCard', label: 'PAN Card', required: true },
      { key: 'officeAddressProof', label: 'Registered Office Address Proof', required: true },
      { key: 'passportPhotos', label: 'Passport-size Photos (Directors/Partners)', required: true },
      { key: 'selfDeclaration', label: 'Self Declaration (Original/Innovative/Not Reconstructed)', required: true },
    ];
    if (orgType === 'partnership') {
      return [
        ...baseDocs,
        { key: 'partnershipDeed', label: 'Partnership Deed', required: true },
        { key: 'partnersAadhaar', label: 'Partners Aadhaar', required: true },
        { key: 'partnersPan', label: 'Partners PAN', required: true },
      ];
    } else if (orgType === 'llp') {
      return [
        ...baseDocs,
        { key: 'llpDeed', label: 'LLP Agreement', required: true },
        { key: 'designatedPartnerAadhaar', label: 'Designated Partner Aadhaar', required: true },
        { key: 'designatedPartnerPan', label: 'Designated Partner PAN', required: true },
      ];
    } else if (orgType === 'pvt_ltd') {
      return [
        ...baseDocs,
        { key: 'moa', label: 'MOA', required: true },
        { key: 'aoa', label: 'AOA', required: true },
        { key: 'directorAadhaar', label: 'Director Aadhaar', required: true },
        { key: 'directorPan', label: 'Director PAN', required: true },
      ];
    }
    return baseDocs;
  };

  const docs = getDocsForOrgType();

  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-xl">
      <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
        <span className="bg-amber-500/20 p-1.5 rounded mr-2">
          <FileText className="w-4 h-4 text-amber-400" />
        </span>
        Documents
      </h3>
      <ul className="space-y-2">
        {docs.map((doc) => {
          const isUploaded = !!uploadedFiles[doc.key];
          return (
            <li key={doc.key} className={`flex items-center justify-between py-1.5 px-2 rounded text-xs ${isUploaded ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800/30 text-slate-400'
              }`}>
              <span className="truncate">{doc.label} {doc.required && '*'}</span>
              {isUploaded && <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ─── Preview Modal Component ─────────────────────────────────────────────────
const PreviewModal: React.FC<{
  formData: any;
  uploadedFiles: Record<string, File | null>;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}> = ({ formData, uploadedFiles, onClose, onSubmit, isSubmitting }) => {
  const documentLabelMap: Record<string, string> = {
    incorporationCert: 'Certificate of Incorporation / Registration',
    panCard: 'Company / Entity PAN Card',
    officeAddressProof: 'Registered Office Address Proof',
    passportPhotos: 'Passport-size Photos',
    selfDeclaration: 'Self Declaration',
    partnershipDeed: 'Partnership Deed',
    partnersAadhaar: 'Partners Aadhaar Cards',
    partnersPan: 'Partners PAN Cards',
    llpDeed: 'LLP Agreement',
    designatedPartnerAadhaar: 'Designated Partner Aadhaar',
    designatedPartnerPan: 'Designated Partner PAN',
    moa: 'Memorandum of Association (MOA)',
    aoa: 'Articles of Association (AOA)',
    directorAadhaar: 'Directors Aadhaar Cards',
    directorPan: 'Directors PAN Cards',
    pitchDeck: 'Pitch Deck / Business Plan',
    productDemo: 'Product Demo / MVP',
    companyLogo: 'Company Logo',
    fundingProof: 'Funding Proof',
    patentTrademark: 'Patent / Trademark Details',
    recommendationLetter: 'Recommendation Letter',
    itr: 'Income Tax Returns (ITR)',
    nocFromOwner: 'NOC from Owner',
  };

  const fieldLabelMap: Record<string, string> = {
    startupName: 'Startup / Company Name',
    entityType: 'Entity Type',
    cin: 'CIN',
    llpin: 'LLPIN',
    incorporationYear: 'Year of Incorporation',
    pan: 'PAN of Entity',
    sector: 'Business Sector',
    websiteUrl: 'Website / Product URL',
    turnoverBelow100Cr: 'Turnover Below ₹100 Cr',
    innovationCategory: 'Innovation Criteria',
    isNotReconstructed: 'Not Reconstructed Declaration',
    officeOccupancyType: 'Office Occupancy Type',
    patentTrademarkDetails: 'Patent / Trademark Details',
    fundingDetails: 'Funding Details',
    proprietorName: 'Proprietor Name',
    proprietorAadhaar: 'Proprietor Aadhaar',
    partnershipDeedDate: 'Partnership Deed Date',
    llpDesignatedPartners: 'LLP Designated Partners',
    founderName: 'Founder / Director Name',
    founderDesignation: 'Designation',
    founderEmail: 'Founder Email',
    founderMobile: 'Founder Mobile',
    teamSize: 'Team Size',
    revenueStage: 'Revenue Stage',
    innovationBrief: 'Innovation / Uniqueness Brief',
    problemStatement: 'Problem Statement',
    address1: 'Address Line 1',
    address2: 'Address Line 2 / Landmark',
    state: 'State / UT',
    city: 'District / City',
    zip: 'Pincode',
  };

  const documentGroups = [
    {
      id: 'company',
      title: 'Company Details',
      keys: [
        'incorporationCert',
        'panCard',
        'officeAddressProof',
        'partnershipDeed',
        'llpDeed',
        'moa',
        'aoa',
        'selfDeclaration',
      ],
    },
    {
      id: 'people',
      title: 'Directors / Partners',
      keys: [
        'passportPhotos',
        'partnersAadhaar',
        'partnersPan',
        'designatedPartnerAadhaar',
        'designatedPartnerPan',
        'directorAadhaar',
        'directorPan',
      ],
    },
    {
      id: 'support',
      title: 'Supporting / Conditional',
      keys: [
        'pitchDeck',
        'productDemo',
        'companyLogo',
        'fundingProof',
        'patentTrademark',
        'recommendationLetter',
        'itr',
        'nocFromOwner',
      ],
    },
  ];

  const humanize = (key: string, value: string) => {
    if (!value) return value;
    if (key === 'turnoverBelow100Cr') return value === 'yes' ? 'Yes' : 'No';
    if (key === 'isNotReconstructed') return value === 'yes' ? 'Yes' : 'No';
    if (key === 'innovationCategory') {
      if (value === 'unique_problem') return 'Solving a Unique Problem';
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    if (key === 'entityType' || key === 'sector' || key === 'officeOccupancyType') {
      return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return value;
  };

  const filledFields = Object.entries(formData).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <h3 className="text-xl font-bold text-white">
            Preview Application
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
            <h4 className="font-bold text-white mb-3">All Filled Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {filledFields.map(([key, value]) => (
                <div key={key}>
                  <span className="text-slate-500">{fieldLabelMap[key] || key}:</span>
                  <p className="text-white font-medium break-words">
                    {humanize(key, String(value))}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
            <h4 className="font-bold text-white mb-3">Uploaded Documents</h4>
            <div className="space-y-4">
              {documentGroups.map((group) => {
                const groupDocs = group.keys
                  .map((key) => ({ key, file: uploadedFiles[key] }))
                  .filter((item) => !!item.file);

                if (groupDocs.length === 0) return null;

                return (
                  <div key={group.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                    <p className="text-xs font-semibold text-cyan-300 mb-2">{group.title}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {groupDocs.map(({ key, file }) => (
                        <div
                          key={key}
                          className="text-xs bg-emerald-500/10 text-emerald-200 px-3 py-2 rounded border border-emerald-500/30"
                        >
                          <p className="font-medium leading-relaxed">
                            ✓ {documentLabelMap[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-[11px] text-emerald-300/80 mt-1 truncate">{file?.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-5 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all">
            Edit
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2 ${isSubmitting
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-white hover:bg-slate-200 text-slate-950 shadow-lg shadow-white/10'
              }`}
          >
            {isSubmitting ? <><Loader2 className="animate-spin w-4 h-4" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Confirm & Submit</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ✅ PROCESSING MODAL COMPONENT ───────────────────────────────────────────
const ProcessingModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-background/88 backdrop-blur-[3px] flex items-center justify-center z-[100]">
      <div className="bg-slate-900/95 rounded-2xl px-8 py-9 max-w-sm w-[92%] border border-slate-700/80 shadow-[0_20px_70px_rgba(0,0,0,0.55)] text-center">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="absolute inset-0 border-4 border-slate-700/90 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-2">Processing...</h3>
        <p className="text-slate-400 text-sm">Please wait while we submit your application.</p>
        <p className="text-slate-600 text-xs mt-2">Do not close this window.</p>
      </div>
    </div>
  );
};

// ─── State + City Data ───────────────────────────────────────────────────────
const stateOptions = [
  { value: '', label: 'Select State' },
  { value: 'AP', label: 'Andhra Pradesh' }, { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' }, { value: 'BR', label: 'Bihar' },
  { value: 'CT', label: 'Chhattisgarh' }, { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' }, { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' }, { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' }, { value: 'KL', label: 'Kerala' },
  { value: 'MP', label: 'Madhya Pradesh' }, { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' }, { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' }, { value: 'NL', label: 'Nagaland' },
  { value: 'OD', label: 'Odisha' }, { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' }, { value: 'SK', label: 'Sikkim' }, { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' }, { value: 'TR', label: 'Tripura' }, { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' }, { value: 'WB', label: 'West Bengal' },
  { value: 'DL', label: 'Delhi' }, { value: 'JK', label: 'Jammu and Kashmir' }, { value: 'LA', label: 'Ladakh' },
  { value: 'PY', label: 'Puducherry' }, { value: 'CH', label: 'Chandigarh' },
  { value: 'AN', label: 'Andaman & Nicobar' },
  { value: 'DN', label: 'Dadra and Nagar Haveli' }, { value: 'DD', label: 'Daman and Diu' },
  { value: 'LD', label: 'Lakshadweep' },
];

const stateDistrictData: Record<string, string[]> = {
  TN: ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  MH: ['Ahmedabad', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
  KA: ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'],
  GJ: ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
  UP: ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kheri', 'Kushinagar', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjhanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
  RJ: ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  DL: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  WB: ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'],
  KL: ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'],
  TG: ['Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'],
  AP: ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  PB: ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar', 'Sangrur', 'Shaheed Bhagat Singh Nagar', 'Tarn Taran'],
  HR: ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  MP: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Rewa', 'Satna', 'Ratlam', 'Dewas', 'Chhindwara', 'Betul', 'Hoshangabad', 'Morena', 'Bhind', 'Katni', 'Datia', 'Damoh', 'Balaghat', 'Shivpuri', 'Mandsaur', 'Vidisha', 'Narsinghpur', 'Sehore', 'Neemuch', 'Rajgarh', 'Dhar', 'Khandwa', 'Khargone', 'Barwani', 'Jhabua', 'Alirajpur', 'Anuppur', 'Umaria', 'Shahdol', 'Mandla', 'Dindori', 'Seoni', 'Panna', 'Chhatarpur', 'Tikamgarh', 'Ashoknagar', 'Guna', 'Sheopur', 'Sidhi', 'Singrauli'],
  BR: ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
  PY: ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
};

// ─── Options ─────────────────────────────────────────────────────────────────
const entityTypeOptions = [
  { value: '', label: 'Select Entity Type' },
  { value: 'partnership', label: 'Partnership Firm' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
  { value: 'pvt_ltd', label: 'Private Limited Company' },
  { value: 'opc', label: 'One Person Company (OPC)' },
];

const turnoverDeclarationOptions = [
  { value: '', label: 'Select Turnover Declaration' },
  { value: 'yes', label: 'Yes, turnover is below ₹100 crore' },
  { value: 'no', label: 'No' },
];

const innovationCategoryOptions = [
  { value: '', label: 'Select Innovation Criteria' },
  { value: 'innovative', label: 'Innovative' },
  { value: 'scalable', label: 'Scalable' },
  { value: 'unique_problem', label: 'Solving a Unique Problem' },
];

const reconstructionDeclarationOptions = [
  { value: '', label: 'Select Declaration' },
  { value: 'yes', label: 'Yes, this is an original business (not reconstructed)' },
  { value: 'no', label: 'No' },
];

const officeOccupancyOptions = [
  { value: '', label: 'Select Office Occupancy Type' },
  { value: 'owned', label: 'Owned Office' },
  { value: 'rented', label: 'Rented / Leased Office' },
];

const sectorOptions = [
  { value: '', label: 'Select Business Sector' },
  { value: 'agritech', label: 'AgriTech / Agriculture' },
  { value: 'edtech', label: 'EdTech / Education' },
  { value: 'fintech', label: 'FinTech / Financial Services' },
  { value: 'healthtech', label: 'HealthTech / MedTech' },
  { value: 'ecommerce', label: 'E-Commerce / Retail' },
  { value: 'saas', label: 'SaaS / Enterprise Software' },
  { value: 'ai_ml', label: 'AI / Machine Learning / Data' },
  { value: 'cleantech', label: 'CleanTech / Environment / Energy' },
  { value: 'logistics', label: 'Logistics / Supply Chain' },
  { value: 'manufacturing', label: 'Manufacturing / Hardware' },
  { value: 'media', label: 'Media / Entertainment / Gaming' },
  { value: 'social', label: 'Social Impact / NGO / D2C' },
  { value: 'other', label: 'Other' },
];

// ─── Validators ──────────────────────────────────────────────────────────────
const validate = {
  required: (v: string) => v.trim().length > 0 || 'This field is required',
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Please enter a valid email address',
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v) || 'Enter a valid 10-digit mobile number (starts with 6-9)',
  pan: (v: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) || 'Invalid PAN format (e.g., ABCDE1234F)',
  cin: (v: string) => v === '' || /^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(v) || 'Invalid CIN format',
  zip: (v: string) => /^\d{6}$/.test(v) || 'Pincode must be 6 digits',
  url: (v: string) => v === '' || /^https?:\/\/.+/.test(v) || 'Enter a valid URL starting with http:// or https://',
  year: (v: string) => {
    const y = parseInt(v);
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 9;
    return y >= minYear && y <= currentYear || `Year must be between ${minYear} and ${currentYear}`;
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface FormData {
  startupName: string;
  entityType: string;
  cin: string;
  llpin: string;
  incorporationDate: string;
  incorporationYear: string;
  pan: string;
  sector: string;
  websiteUrl: string;
  turnoverBelow100Cr: string;
  innovationCategory: string;
  isNotReconstructed: string;
  isWithinTenYears: string;
  dpiitSelfDeclaration: string;
  officeOccupancyType: string;
  patentTrademarkDetails: string;
  fundingDetails: string;
  // Proprietor fields
  proprietorName: string;
  proprietorAadhaar: string;
  // Partnership fields
  partnershipDeedDate: string;
  // LLP fields
  llpDesignatedPartners: string;
  // Common fields
  founderName: string;
  founderDesignation: string;
  founderEmail: string;
  founderMobile: string;
  teamSize: string;
  revenueStage: string;
  innovationBrief: string;
  problemStatement: string;
  address1: string;
  address2: string;
  state: string;
  city: string;
  zip: string;
}

const initialData: FormData = {
  startupName: '', entityType: '', cin: '', llpin: '', incorporationDate: '', incorporationYear: '', pan: '',
  sector: '', websiteUrl: '', turnoverBelow100Cr: '', innovationCategory: '', isNotReconstructed: '',
  isWithinTenYears: '', dpiitSelfDeclaration: '',
  officeOccupancyType: '', patentTrademarkDetails: '', fundingDetails: '',
  proprietorName: '', proprietorAadhaar: '',
  partnershipDeedDate: '',
  llpDesignatedPartners: '2',
  founderName: '', founderDesignation: '', founderEmail: '',
  founderMobile: '', teamSize: '', revenueStage: '',
  innovationBrief: '', problemStatement: '', address1: '', address2: '',
  state: '', city: '', zip: '',
};

// ─── Reusable Form Components ────────────────────────────────────────────────
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  infoText?: string;
}

const Field: React.FC<FieldProps> = ({ label, error, hint, optional, infoText, required, id, className, ...rest }) => {
  const inputId = id || `f-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white transition-all duration-300 group-focus-within:text-cyan-300">
            {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <input
          id={inputId}
          className={`w-full bg-slate-900/40 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-md focus:ring-2 focus:outline-none ${error
            ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
            } ${className}`}
          required={required}
          {...rest}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  infoText?: string;
}

const TextArea: React.FC<TextAreaProps> = ({ label, error, hint, optional, infoText, required, id, className, ...rest }) => {
  const textareaId = id || `ta-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={textareaId} className="block text-sm font-medium text-white transition-all duration-300 group-focus-within:text-cyan-300">
            {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <textarea
        id={textareaId}
        className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none resize-none ${error
          ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
          : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
          } ${className}`}
        required={required}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  optional?: boolean;
  infoText?: string;
}

const Select: React.FC<SelectProps> = ({ label, options, error, optional, infoText, required, id, value, className, ...rest }) => {
  const selectId = id || `s-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={selectId} className="block text-sm font-medium text-white transition-all duration-300 group-focus-within:text-cyan-300">
            {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          className={`w-full bg-slate-900/40 border text-white text-sm rounded-lg block p-3 pr-10 appearance-none placeholder-slate-400 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-md focus:ring-2 focus:outline-none cursor-pointer ${error
            ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
            } ${!value ? 'text-slate-500' : 'text-white'} ${className}`}
          required={required}
          {...rest}
        >
          <option value="" disabled>Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-white bg-slate-900">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 w-4 h-4" />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <AlertCircle className="w-3 h-3 mr-1" />
          {error}
        </p>
      )}
    </div>
  );
};

interface FileFieldProps {
  label: string;
  name: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
  accept?: string;
  hint?: string;
  infoText?: string;
}

const FileField: React.FC<FileFieldProps> = ({ label, name, required, file, onChange, disabled, accept = '.pdf,.jpg,.jpeg,.png', hint, infoText }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const process = (f: File | null) => {
    if (!f) { onChange(null); return; }
    if (f.size > 5 * 1024 * 1024) { alert('File must be under 5MB'); return; }
    onChange(f);
  };

  return (
    <div className={`mb-5 transition-all duration-300 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label className={`block text-sm font-medium ${disabled ? 'text-slate-500' : 'text-white'}`}>
            {label} {required && !disabled && <span className="text-red-500">*</span>}
            {disabled && <span className="text-xs text-slate-600 ml-2">(Not Required)</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files?.[0] || null); }}
        className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all duration-200 ease-in-out ${dragging
          ? 'border-cyan-500 bg-cyan-500/10'
          : file
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
      >
        <input ref={inputRef} type="file" name={name} accept={accept} className="hidden" onChange={(e) => process(e.target.files?.[0] || null)} disabled={disabled} />
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 transition-colors ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/51 text-slate-400 group-hover:text-cyan-400'
            }`}>
            {file ? <CheckCircle className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            {file ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">File ready for upload</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-300 group-hover:text-white">Click or drag to upload</p>
                <p className="text-xs text-slate-500 mt-0.5">PDF, JPEG, PNG (Max 5MB)</p>
              </div>
            )}
            {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
          </div>
          {file && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
              className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};




// ── Status Banner (matching GST-LLP/MSME) ─────────────────────────────────────────
const StatusBanner: React.FC<{ 
  caseId: string; 
  amount: number; 
  entityType: string;
  isUnlocked: boolean;
}> = ({ caseId, amount, entityType, isUnlocked }) => {
  const constitutionLabel = entityTypeOptions.find((opt) => opt.value === entityType)?.label || 'Not Selected';

  return (
    <div className="bg-gradient-to-r from-cyan-900/30 to-blue-800/10 border border-cyan-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500 rounded-full blur-3xl opacity-10 pointer-events-none" />
      <div className="z-10 mb-2 sm:mb-0">
        <div className="flex items-baseline space-x-3">
          <span className="text-white font-bold text-2xl tracking-tight drop-shadow-sm">₹{amount.toLocaleString('en-IN')}</span>
          <span className={`bg-cyan-500/20 text-cyan-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30 ${!isUnlocked ? 'animate-pulse' : ''}`}>
            {isUnlocked ? 'Payment Verified' : 'Payment Required'}
          </span>
        </div>
        <p className="text-white text-sm mt-1">DPIIT Startup Recognition | {constitutionLabel}</p>
        <p className="text-sky-400 text-xs mt-2 font-medium flex items-center">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Verification will be done by Support Team after submission.
        </p>
      </div>
      <div className="text-left sm:text-right z-10">
        <p className="text-xs font-semibold text-white uppercase tracking-wider">Case Reference</p>
        <p className="text-white font-mono font-bold text-lg md:text-xl tracking-wider">{caseId || 'PENDING'}</p>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
interface StartupIndiaFormProps {
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

export default function StartupIndiaForm({ user, packageMode, onComplete, onBack, initialData: propsInitialData, existingDocs }: StartupIndiaFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as StartupFormLocationState;
  const { displayRazorpay } = useRazorpay();
  const { showNotification } = useNotification();
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [caseId, setCaseId] = useState<string>(`DPIIT-${new Date().getFullYear()}-000-DRAFT`);

  // Removed auto-submit after payment to allow form filling

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({ 
    ...propsInitialData?.formData || propsInitialData || navState?.initialData?.formData || navState?.initialData 
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    incorporationCert: null,
    panCard: null,
    officeAddressProof: null,
    passportPhotos: null,
    selfDeclaration: null,
    partnershipDeed: null,
    partnersAadhaar: null,
    partnersPan: null,
    llpDeed: null,
    designatedPartnerAadhaar: null,
    designatedPartnerPan: null,
    moa: null,
    aoa: null,
    directorAadhaar: null,
    directorPan: null,
    pitchDeck: null,
    productDemo: null,
    companyLogo: null,
    fundingProof: null,
    recommendationLetter: null,
    itr: null,
    nocFromOwner: null,
    patentTrademark: null,
  });

  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCaseId, setSuccessCaseId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [docUploadTab, setDocUploadTab] = useState<'company' | 'people' | 'support'>('company');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);

  const role =
    (localStorage.getItem('role') || localStorage.getItem('userRole') || '').toLowerCase();
  const isPrivilegedUser = role === 'admin' || role === 'superadmin';
  const baseCost =
    CONSTITUTION_FEES[formData.entityType] ??
    navState.totalCost ??
    navState.totalPaid ??
    CONSTITUTION_FEES.pvt_ltd;

  const gstAmount = calculateGST(baseCost);
  const selectedCost = calculateTotalWithGST(baseCost); // Using selectedCost here to minimize refactoring in Razorpay call
  const isFormUnlocked = isPaymentComplete || isPrivilegedUser;
  const isConstitutionLocked = isPaymentComplete && !isPrivilegedUser;

  useEffect(() => {
    if (navState.entityType && !formData.entityType) {
      setFormData((prev) => ({ ...prev, entityType: navState.entityType as FormData['entityType'] }));
    }
  }, [formData.entityType, navState.entityType]);

  useEffect(() => {
    const initial = propsInitialData || navState?.initialData;
    if (initial) {
      if (initial.currentStep) setCurrentStep(initial.currentStep);
      if (initial.caseId) setCaseId(initial.caseId);
      if (initial.formData) setFormData(initial.formData);
      if (initial.paymentStatus === 'paid') setIsPaymentComplete(true);
      if (initial.paymentInfo) setPaymentInfo(initial.paymentInfo);
    }
  }, [propsInitialData, navState]);

  const getCities = (code: string) =>
    [...(stateDistrictData[code] || [])].sort().map(c => ({ value: c, label: c }));

  const handleRazorpayPayment = useCallback(async () => {
    if (!user) {
      showNotification('Please login first.', 'error');
      return;
    }
    if (!formData.entityType) {
      setPaymentError('Select Constitution Type before payment.');
      return;
    }

    setPaymentError('');
    setIsPaying(true);
    const constitutionLabel = entityTypeOptions.find((opt) => opt.value === formData.entityType)?.label || formData.entityType;

    const started = await displayRazorpay(selectedCost, (response) => {
      setPaymentInfo(response);
      setIsPaymentComplete(true);
      setPaymentError('');
      setIsPaying(false);
    }, {
      description: `Service Fee: ₹${baseCost} + GST (18%): ₹${calculateGST(baseCost)} = Total: ₹${calculateTotalWithGST(baseCost)}`,
      prefill: {
        name: formData.founderName || user.displayName || '',
        email: user.email || '',
        contact: formData.founderMobile || user.phoneNumber || '',
      },
      onClosed: () => {
        setIsPaying(false);
        // Redirect back to panel if payment was not successful
        setTimeout(() => {
          if (!isPaymentComplete) {
            navigate('/services/startup-india');
          }
        }, 300);
      }
    });

    if (!started) {
      setPaymentError('Unable to start payment. Please retry.');
      setIsPaying(false);
      setTimeout(() => navigate('/services/startup-india'), 2000);
    }
  }, [displayRazorpay, user, formData, selectedCost]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const k = name as keyof FormData;
    let v = value;

    if (k === 'pan') v = value.toUpperCase().slice(0, 10);
    if (k === 'cin') v = value.toUpperCase().slice(0, 21);
    if (k === 'founderMobile' || k === 'proprietorAadhaar') v = value.replace(/\D/g, '').slice(0, k === 'proprietorAadhaar' ? 12 : 10);
    if (k === 'zip') v = value.replace(/\D/g, '').slice(0, 6);
    if (k === 'incorporationYear') v = value.replace(/\D/g, '').slice(0, 4);
    if (k === 'teamSize') v = value.replace(/\D/g, '');

    if (k === 'state') {
      setFormData(p => ({ ...p, state: v, city: '' }));
      setErrors(p => ({ ...p, state: '', city: '' }));
      return;
    }

    setFormData(p => ({ ...p, [k]: v }));
    if (touched[k]) {
      const errorMsg = validate[k as keyof typeof validate]?.(v);
      setErrors(p => ({ ...p, [k]: typeof errorMsg === 'string' ? errorMsg : '' }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const key = name as keyof FormData;
    setTouched((prev) => ({ ...prev, [key]: true }));
    const errorMsg = validate[key as keyof typeof validate]?.(value);
    setErrors((prev) => ({ ...prev, [key]: typeof errorMsg === 'string' ? errorMsg : '' }));
  };

  const validateStep = (step: number): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!formData.startupName.trim()) e.startupName = 'Startup name is required';
      if (!formData.entityType) e.entityType = 'Select entity type';
      if (formData.entityType === 'proprietorship') e.entityType = 'Proprietorship is not eligible for DPIIT';

      // Entity-specific validation
      if (formData.entityType === 'partnership') {
        if (!formData.partnershipDeedDate) e.partnershipDeedDate = 'Partnership deed date is required';
      } else if (formData.entityType === 'llp') {
        if (!formData.llpin) e.llpin = 'LLPIN is required';
      } else if (formData.entityType === 'pvt_ltd') {
        if (!formData.cin) e.cin = 'CIN is required';
      }

      if (!formData.incorporationDate) e.incorporationDate = 'Exact incorporation date is required';
      if (!formData.incorporationYear.trim()) e.incorporationYear = 'Year of incorporation is required';
      else {
        const yearError = validate.year(formData.incorporationYear);
        if (typeof yearError === 'string') e.incorporationYear = yearError;
      }

      const panError = validate.pan(formData.pan);
      if (typeof panError === 'string') e.pan = panError;

      if (!formData.sector) e.sector = 'Select business sector';
      if (formData.turnoverBelow100Cr !== 'yes') e.turnoverBelow100Cr = 'Turnover must be below ₹100 crore';
      if (formData.isWithinTenYears !== 'yes') e.isWithinTenYears = 'Startup must be within 10 years of incorporation';
      if (!formData.innovationCategory) e.innovationCategory = 'Select innovation/scalability criteria';
      if (formData.isNotReconstructed !== 'yes') e.isNotReconstructed = 'Only original, non-reconstructed businesses are eligible';
      if (formData.dpiitSelfDeclaration !== 'yes') e.dpiitSelfDeclaration = 'DPIIT self declaration is required';
      if (!formData.officeOccupancyType) e.officeOccupancyType = 'Select office occupancy type';
      if (formData.websiteUrl) {
        const urlError = validate.url(formData.websiteUrl);
        if (typeof urlError === 'string') e.websiteUrl = urlError;
      }
    }

    if (step === 2) {
      if (!formData.founderName.trim()) e.founderName = 'Founder/Director name is required';
      if (!formData.founderDesignation.trim()) e.founderDesignation = 'Designation is required';
      const emailError = validate.email(formData.founderEmail);
      if (typeof emailError === 'string') e.founderEmail = emailError;
      const mobileError = validate.mobile(formData.founderMobile);
      if (typeof mobileError === 'string') e.founderMobile = mobileError;
      if (!formData.innovationBrief.trim()) e.innovationBrief = 'Please describe your innovation';
    }

    if (step === 3) {
      if (!formData.address1.trim()) e.address1 = 'Address is required';
      if (!formData.state) e.state = 'Select state';
      if (!formData.city.trim()) e.city = 'Select city / district';
      const zipError = validate.zip(formData.zip);
      if (typeof zipError === 'string') e.zip = zipError;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid) return;
    setIsDraftSaving(true);
    try {
      const draftData = {
        userId: user.uid,
        userEmail: user.email || '',
        serviceType: 'startup-india',
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: caseId,
        paymentStatus: isPaymentComplete ? 'paid' : 'pending',
        paymentInfo: paymentInfo
      };
      await setDoc(doc(db, 'drafts', `startup_${user.uid}`), draftData, { merge: true });
    } catch (err) {
      console.error("Draft save failed:", err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  const goNext = async () => {
    if (!validateStep(currentStep)) return;
    await saveDraft(currentStep + 1);
    setCurrentStep(p => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Exit Confirmation Logic ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSuccess || isExiting) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isSuccess || isExiting) return;
      window.history.pushState(null, '', window.location.href);
      setShowExitConfirm(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSuccess, isExiting]);

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave) {
      await saveDraft();
      setShowDraftSuccessModal(true);
      setTimeout(() => {
        setShowDraftSuccessModal(false);
        setIsExiting(true);
        navigate('/services/startup-india');
      }, 1500);
    } else {
      setIsExiting(true);
      navigate('/services/startup-india');
    }
  };

  const goBack = () => {
    if (currentStep === 1) { navigate('/services/startup-india'); return; }
    setCurrentStep(p => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadFile = async (file: File, docId: string, key: string) => {
    if (!user?.uid) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() || 'bin';
    const path = `startup-applications/${user.uid}/${docId}/${key}_${Date.now()}.${ext}`;
    const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return await getDownloadURL(snap.ref);
  };

  const generateSequentialId = async (year: number) => {
    const counterRef = doc(db, 'counters', `startup_ids_${year}`);
    let newCount = 0;
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { count: 1, year: year, createdAt: serverTimestamp() });
        newCount = 1;
      } else {
        const currentCount = counterDoc.data()?.count || 0;
        newCount = currentCount + 1;
        transaction.update(counterRef, { count: newCount });
      }
    });
    const formattedCount = String(newCount).padStart(3, '0');
    return `DPIIT-${year}-${formattedCount}`;
  };

  const handleSubmit = async (payInfo?: RazorpaySuccessResponse) => {
    if (!user) { showNotification('Please login first.', 'error'); return; }
    if (!isFormUnlocked) {
      showNotification('Please complete the payment to unlock and submit the application.', 'warning');
      return;
    }
    if (!consentChecked) {
      showNotification('Please accept the terms and consent to proceed.', 'warning');
      return;
    }

    const finalPayInfo = payInfo || paymentInfo;

    // Validate required documents based on entity type
    const requiredDocs = ['incorporationCert', 'panCard', 'officeAddressProof', 'passportPhotos', 'selfDeclaration'];
    if (formData.entityType === 'partnership') {
      requiredDocs.push('partnershipDeed', 'partnersAadhaar', 'partnersPan');
    } else if (formData.entityType === 'llp') {
      requiredDocs.push('llpDeed', 'designatedPartnerAadhaar', 'designatedPartnerPan');
    } else if (formData.entityType === 'pvt_ltd') {
      requiredDocs.push('moa', 'aoa', 'directorAadhaar', 'directorPan');
    }
    if (formData.officeOccupancyType === 'rented') {
      requiredDocs.push('nocFromOwner');
    }

    const missingDocs = requiredDocs.filter(key => !uploadedFiles[key]);
    if (missingDocs.length > 0) {
      showNotification(`Please upload all required documents: ${missingDocs.join(', ')}`, 'error', { title: 'Missing Documents' });
      return;
    }

    setIsSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const generatedCaseId = await generateSequentialId(year);
      setCaseId(generatedCaseId);
      const docId = `STARTUP-${Date.now()}`;
      const fileUrls: Record<string, string> = {};

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file) fileUrls[key] = await uploadFile(file, docId, key);
      }

      const payload = {
        id: docId,
        caseId,
        type: 'startup',
        title: 'DPIIT Recognition Application',
        serviceType: 'dpiit',
        ...buildInitialApplicationStatus({ serviceType: 'startup', serviceName: 'DPIIT Recognition Application', userId: user.uid }),
        submittedAt: serverTimestamp(),
        formData,
        entityType: formData.entityType,
        uploadedFileUrls: fileUrls,
        userId: user.uid,
        folderId: 'regibiz',
        taskStatus: 'unassigned',
        userEmail: user.email,
        consentGiven: true,
        consentTimestamp: new Date().toISOString(),
        paymentStatus: isPaymentComplete ? 'paid' : (isPrivilegedUser ? 'bypassed_by_admin' : 'pending'),
        paymentAmount: selectedCost,
        paymentCurrency: 'INR',
        paymentId: paymentInfo?.razorpay_payment_id || null,
        paymentOrderId: paymentInfo?.razorpay_order_id || null,
        paymentSignature: paymentInfo?.razorpay_signature || null,
      };

      await setDoc(doc(db, 'startup-applications', docId), payload);
      await setDoc(doc(db, 'users', user.uid, 'documents', docId), {
        id: docId,
        caseId,
        type: 'startup',
        title: 'DPIIT Recognition Application',
        ...buildInitialApplicationStatus({ serviceType: 'startup', serviceName: 'DPIIT Recognition Application', userId: user.uid }),
        submittedAt: serverTimestamp(),
        userId: user.uid,
        folderId: 'regibiz',
        taskStatus: 'unassigned',
        formData: payload.formData,
        serviceType: 'dpiit',
        uploadedFileUrls: fileUrls,
        userEmail: user.email,
        consentGiven: true,
        consentTimestamp: new Date().toISOString(),
        paymentStatus: payload.paymentStatus,
        paymentAmount: selectedCost,
        paymentCurrency: 'INR',
        paymentId: paymentInfo?.razorpay_payment_id || null,
        paymentOrderId: paymentInfo?.razorpay_order_id || null,
        paymentSignature: paymentInfo?.razorpay_signature || null,
      });

      await sendConfirmationEmail({
        name: formData.startupName || formData.founderName || 'User',
        email: user.email || '',
        service: "DPIIT Recognition",
        caseId: caseId
      });


      await triggerNotification('FORM_SUBMITTED', {
        customerId: user.uid,
        customerName: formData.startupName || 'New Startup',
        formTitle: 'DPIIT Recognition Application',
        serviceId: docId,
        caseId,
        businessName: formData.startupName,
        serviceType: 'dpiit',
      });

      setSuccessCaseId(caseId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      showNotification(`Submission failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headingGrad = 'text-white';
  const primaryGrad = 'bg-white';
  const primaryBtn = `${primaryGrad} text-slate-950 font-semibold px-8 py-3 rounded-xl transition-all hover:bg-slate-200 hover:scale-105 shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`;
  const outlineBtn = 'border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 px-6 py-3 rounded-xl transition-all font-medium';
  const steps = ['Startup Profile', 'Founder & Business', 'Address', 'Documents'];

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center border border-white/10 bg-slate-900/60 backdrop-blur-xl">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="text-white" size={28} />
          </div>
          <h2 className={`text-xl font-bold ${headingGrad} mb-2`}>Login Required</h2>
          <p className="text-gray-400 text-sm mb-6">Please log in to apply for DPIIT Recognition.</p>
          <button onClick={() => navigate('/auth')} className={`${primaryBtn} w-full`}>Go to Login</button>
        </div>
      </div>
    );
  }

  if (successCaseId) {
    const submittedName =
      formData.startupName ||
      formData.founderName ||
      user?.displayName ||
      user?.email?.split('@')[0] ||
      'N/A';
    const submittedType =
      entityTypeOptions.find((opt) => opt.value === formData.entityType)?.label ||
      formData.entityType ||
      'N/A';
    const submittedMobile = formData.founderMobile ? `+91 ${formData.founderMobile}` : 'N/A';

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="relative w-full max-w-md animate-in zoom-in-95 duration-300">
          <CelebrationPopup trigger={!!successCaseId} message="" />
          {/* Background Glow Effect - Thin & Smooth */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-500 rounded-2xl blur-sm opacity-20"></div>

          <div className="relative rounded-2xl p-7 md:p-8 w-full text-center border border-slate-700/70 bg-slate-900 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-700 flex items-center justify-center mx-auto mb-5 shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-bounce">
              <CheckCircle2 className="text-white" size={36} />
            </div>

            <h2 className={`text-3xl md:text-[34px] leading-tight font-extrabold ${headingGrad} mb-2`}>
              DPIIT Application Submitted!
            </h2>
            <p className="text-slate-300 text-sm md:text-base mb-5 leading-relaxed">
              Your application has been received. Our team will contact you for OTP/Aadhaar verification and processing.
            </p>

            <div className="mb-5">
              <p className="text-xs text-slate-500 mb-1">Your Case ID:</p>
              <p className="text-lg font-mono font-bold text-cyan-400 tracking-wide">{successCaseId}</p>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-800/45 p-4 mb-5 text-left">
              <div className="grid grid-cols-[88px_1fr] gap-y-1.5 text-xs md:text-sm">
                <p className="text-slate-500">Name</p>
                <p className="text-slate-100 font-medium text-right">{submittedName}</p>
                <p className="text-slate-500">Type</p>
                <p className="text-slate-100 font-medium text-right">{submittedType}</p>
                <p className="text-slate-500">Mobile</p>
                <p className="text-slate-100 font-medium text-right">{submittedMobile}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/documents')}
                className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-200 text-slate-950 font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_10px_28px_rgba(255,255,255,0.10)]"
              >
                <Eye size={18} />
                View Submitted Application
              </button>
              <button
                onClick={() => navigate('/services')}
                className="w-full inline-flex items-center justify-center gap-2 border border-slate-600 text-slate-200 hover:text-white hover:bg-slate-800/70 px-6 py-3.5 rounded-xl transition-all font-medium"
              >
                <ArrowLeft size={18} />
                Back to Services
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {/* Draft Success Modal */}
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
              Your Startup India registration progress has been securely saved.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/5 py-2.5 px-5 rounded-full border border-emerald-400/10 w-fit mx-auto shadow-inner shadow-emerald-400/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Redirecting to Panel...
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirm Modal */}
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
          onClose={() => setShowPreview(false)}
          onSubmit={() => { setShowPreview(false); handleSubmit(); }}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <main className="lg:col-span-8 xl:col-span-9 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-700/50 bg-slate-900/40 p-6 md:p-10 pt-20">
            <div className="absolute top-5 left-5 z-20 flex items-center gap-4">
              <FormBackButton onBack={goBack} />
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Exit Session
              </button>
            </div>


            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">DPIIT Recognition</h1>
              <p className="text-slate-300 text-base max-w-lg mx-auto">Startup India Registration Portal</p>
            </div>

            <StatusBanner 
              caseId={caseId || ''} 
              amount={selectedCost} 
              entityType={formData.entityType}
              isUnlocked={isFormUnlocked}
            />

            {!isFormUnlocked ? (
              <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-950/80 backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.38)] p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-700/50">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 shadow-[0_8px_26px_rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0">
                    <Rocket size={16} className="text-white" />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${headingGrad}`}>Complete Payment to Continue</h2>
                    <p className="text-sm text-slate-400">Choose Constitution Type and pay to unlock full application form.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  <Select
                    label="Constitution Type"
                    name="entityType"
                    value={formData.entityType}
                    onChange={handleChange}
                    error={paymentError && !formData.entityType ? 'Select Constitution Type' : ''}
                    options={entityTypeOptions}
                    required
                    infoText="This decides the filing checklist, required documents, and service cost."
                  />
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5 min-h-[132px] flex flex-col justify-center space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">Service Fee</span>
                      <span className="text-slate-300 font-semibold">₹{baseCost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <p className="text-[10px] text-slate-500 mb-1">Total Payable</p>
                      <p className="text-3xl leading-none font-mono font-bold text-white">
                        ₹{baseCost.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Secure payment powered by Razorpay</p>
                  </div>
                </div>

                {paymentError && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3">
                    {paymentError}
                  </div>
                )}

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleRazorpayPayment}
                    disabled={isPaying || !formData.entityType}
                    className={`${primaryBtn} inline-flex items-center justify-center gap-2 min-w-[220px] text-[18px] px-8 py-3 ${(!formData.entityType || isPaying) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {isPaying ? <><Loader2 size={18} className="animate-spin" /> Opening Razorpay...</> : <>Pay Now & Unlock Form</>}
                  </button>
                  {isPrivilegedUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaymentComplete(true);
                        setPaymentInfo({
                          razorpay_payment_id: 'ADMIN_BYPASS',
                          razorpay_order_id: 'ADMIN_BYPASS',
                          razorpay_signature: 'ADMIN_BYPASS',
                        });
                        setPaymentError('');
                      }}
                      className={`${outlineBtn} whitespace-nowrap`}
                    >
                      Continue as {role === 'superadmin' ? 'Superadmin' : 'Admin'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Progress Steps */}
                <div className="mb-10 relative px-4">
                  {/* Background Line */}
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-800 mx-12" />
                  
                  {/* Active Progress Line */}
                  <div 
                    className="absolute top-4 left-0 h-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all duration-700 ease-in-out mx-12"
                    style={{ 
                      width: `calc(${(currentStep - 1) / (steps.length - 1) * 100}% - 96px)`,
                      maxWidth: 'calc(100% - 96px)'
                    }}
                  />

                  <div className="relative flex items-start justify-between">
                    {steps.map((label, i) => {
                      const stepNum = i + 1;
                      const isCompleted = stepNum < currentStep;
                      const isActive = stepNum === currentStep;
                      
                      return (
                        <div key={i} className="flex flex-col items-center relative z-10 w-24">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${
                            isCompleted || isActive
                              ? 'bg-gradient-to-br from-teal-600 to-blue-800 border-cyan-400 text-white ring-4 ring-cyan-500/10'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          } ${isActive ? 'scale-110 shadow-[0_0_20px_rgba(6,182,212,0.4)] border-white' : ''}`}>
                            {isCompleted ? <CheckCircle size={16} /> : stepNum}
                          </div>
                          <span className={`text-[10px] mt-3 text-center font-bold tracking-tight leading-tight transition-colors duration-300 ${
                            isActive ? 'text-white' : isCompleted ? 'text-cyan-400' : 'text-slate-600'
                          }`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass-panel rounded-2xl border border-slate-800/50 overflow-hidden bg-slate-950/80 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative">

                  {currentStep === 1 && (
                    <div className="p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                        <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                          <Rocket size={16} className="text-slate-950" />
                        </div>
                        <div>
                          <h2 className={`text-white font-bold ${headingGrad}`}>Startup Profile</h2>
                          <p className="text-xs text-slate-400">Legal and business information about your startup</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <Field
                          label="Startup / Company Name"
                          name="startupName"
                          value={formData.startupName}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.startupName}
                          placeholder="e.g., TechNova Solutions Pvt. Ltd."
                          required
                          infoText="Enter your registered business name as per incorporation documents"
                        />

                        <Select
                          label="Entity Type"
                          name="entityType"
                          value={formData.entityType}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.entityType}
                          disabled={isConstitutionLocked}
                          options={entityTypeOptions}
                          required
                          infoText="Select your legal business structure"
                        />
                        {isConstitutionLocked && (
                          <p className="text-xs text-cyan-500 -mt-3 mb-1">
                            Constitution is locked after payment.
                          </p>
                        )}
                        <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                          <p className="text-xs text-white font-medium">
                            DPIIT Note: Proprietorship is not eligible. Allowed entities are Private Limited, LLP, Partnership, and OPC.
                          </p>
                        </div>

                        {/* Entity-specific fields */}
                        {formData.entityType === 'partnership' && (
                          <Field
                            label="Partnership Deed Date"
                            name="partnershipDeedDate"
                            type="date"
                            value={formData.partnershipDeedDate}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.partnershipDeedDate}
                            required
                            infoText="Date of partnership deed execution"
                          />
                        )}

                        {formData.entityType === 'llp' && (
                          <Field
                            label="LLPIN (LLP Identification Number)"
                            name="llpin"
                            value={formData.llpin}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.llpin}
                            placeholder="AA-123456"
                            required
                            infoText="7-character LLPIN issued by MCA"
                          />
                        )}

                        {formData.entityType === 'pvt_ltd' && (
                          <Field
                            label="CIN (Corporate Identification Number)"
                            name="cin"
                            value={formData.cin}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.cin}
                            placeholder="U72900MH2020PTC123456"
                            maxLength={21}
                            required
                            infoText="21-character CIN issued by MCA"
                          />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	                          <Select
	                            label="Turnover Eligibility"
                            name="turnoverBelow100Cr"
                            value={formData.turnoverBelow100Cr}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.turnoverBelow100Cr}
                            options={turnoverDeclarationOptions}
                            required
	                            infoText="DPIIT requires turnover to be below ₹100 crore in any financial year."
	                          />
	                          <Select
	                            label="Age Eligibility"
	                            name="isWithinTenYears"
	                            value={formData.isWithinTenYears}
	                            onChange={handleChange}
	                            onBlur={handleBlur}
	                            error={errors.isWithinTenYears}
	                            options={[
	                              { value: '', label: 'Select Eligibility' },
	                              { value: 'yes', label: 'Within 10 years of incorporation' },
	                              { value: 'no', label: 'More than 10 years old' },
	                            ]}
	                            required
	                            infoText="DPIIT recognition is available only within the prescribed startup age window."
	                          />
	                        </div>

	                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	                          <Select
	                            label="Innovation / Scalability Criteria"
                            name="innovationCategory"
                            value={formData.innovationCategory}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.innovationCategory}
                            options={innovationCategoryOptions}
                            required
	                            infoText="Startup must be innovative, scalable, or solving a unique problem."
	                          />
	                          <Select
	                            label="DPIIT Self Declaration"
	                            name="dpiitSelfDeclaration"
	                            value={formData.dpiitSelfDeclaration}
	                            onChange={handleChange}
	                            onBlur={handleBlur}
	                            error={errors.dpiitSelfDeclaration}
	                            options={[
	                              { value: '', label: 'Select Declaration' },
	                              { value: 'yes', label: 'I confirm DPIIT eligibility declarations' },
	                              { value: 'no', label: 'Not confirmed' },
	                            ]}
	                            required
	                            infoText="Confirms originality, innovation/scalability, and non-reconstruction declarations for DPIIT filing."
	                          />
	                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <Select
                            label="Original Business Declaration"
                            name="isNotReconstructed"
                            value={formData.isNotReconstructed}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.isNotReconstructed}
                            options={reconstructionDeclarationOptions}
                            required
                            infoText="Business should not be formed by splitting or reconstruction of an existing business."
                          />
                          <Select
                            label="Registered Office Occupancy"
                            name="officeOccupancyType"
                            value={formData.officeOccupancyType}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.officeOccupancyType}
                            options={officeOccupancyOptions}
                            required
                            infoText="Used to determine whether NOC from owner is required."
                          />
                        </div>

	                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	                          <Field
	                            label="Exact Incorporation Date"
	                            name="incorporationDate"
	                            type="date"
	                            value={formData.incorporationDate}
	                            onChange={handleChange}
	                            onBlur={handleBlur}
	                            error={errors.incorporationDate}
	                            required
	                            infoText="Exact date as shown on COI / LLP certificate / partnership deed"
	                          />
	                          <Field
	                            label="Year of Incorporation"
                            name="incorporationYear"
                            value={formData.incorporationYear}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.incorporationYear}
                            placeholder={`e.g., ${new Date().getFullYear() - 2}`}
                            hint="Must be within last 10 years"
                            maxLength={4}
                            required
                            infoText="Year when your business was legally registered"
                          />
                          <Field
                            label="PAN of Entity"
                            name="pan"
                            value={formData.pan}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.pan}
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            required
                            infoText="Permanent Account Number of your business entity"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <Select
                            label="Business Sector"
                            name="sector"
                            value={formData.sector}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.sector}
                            options={sectorOptions}
                            required
                            infoText="Primary industry sector your startup operates in"
                          />
                          <Field
                            label="Website / Product URL"
                            name="websiteUrl"
                            value={formData.websiteUrl}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.websiteUrl}
                            placeholder="https://yourstartup.in"
                            optional
                            infoText="Your startup's website or product landing page"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-8 pt-6 border-t border-slate-700/50">
                        <button type="button" onClick={goNext} disabled={isDraftSaving} className={`${primaryBtn} flex items-center gap-2`}>
                          {isDraftSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                          Save & Next<ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                        <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                          <Building2 size={16} className="text-slate-950" />
                        </div>
                        <div>
                          <h2 className={`text-white font-bold ${headingGrad}`}>Founder Details</h2>
                          <p className="text-xs text-slate-400">Information about the primary contact person</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <Field
                            label="Founder/Director Name"
                            name="founderName"
                            value={formData.founderName}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.founderName}
                            placeholder="Full name"
                            required
                            infoText="Full legal name of the primary founder or Director"
                          />
                          <Field
                            label="Designation"
                            name="founderDesignation"
                            value={formData.founderDesignation}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.founderDesignation}
                            placeholder="e.g., Founder & Director"
                            required
                            infoText="Your official designation in the company"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <Field
                            type="email"
                            label="Email Address"
                            name="founderEmail"
                            value={formData.founderEmail}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.founderEmail}
                            placeholder="founder@startup.in"
                            required
                            infoText="Active email address for communication"
                          />
                          <Field
                            type="tel"
                            label="Mobile Number"
                            name="founderMobile"
                            value={formData.founderMobile}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.founderMobile}
                            placeholder="9876543210"
                            maxLength={10}
                            required
                            hint="Support team will contact this number for verification"
                            infoText="10-digit mobile number for OTP verification"
                          />
                        </div>

                        <TextArea
                          label="Innovation / Uniqueness Brief"
                          name="innovationBrief"
                          value={formData.innovationBrief}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.innovationBrief}
                          rows={4}
                          placeholder="Describe what makes your product/service innovative, scalable, or disruptive (50–300 words)..."
                          hint="This is submitted to DPIIT as your innovation brief. Be specific and factual."
                          required
                          infoText="Clearly explain your unique value proposition and innovation"
                        />

                        <TextArea
                          label="Problem Statement"
                          name="problemStatement"
                          value={formData.problemStatement}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          rows={3}
                          placeholder="What problem does your startup solve? Who is your target customer?"
                          optional
                          infoText="Describe the market problem your startup addresses"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <TextArea
                            label="Funding Details (if any)"
                            name="fundingDetails"
                            value={formData.fundingDetails}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            rows={3}
                            placeholder="Investor names, round type, amount raised, etc."
                            optional
                            infoText="Optional but useful to support your startup profile."
                          />
                          <TextArea
                            label="Patent / Trademark Details (if any)"
                            name="patentTrademarkDetails"
                            value={formData.patentTrademarkDetails}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            rows={3}
                            placeholder="Patent number / trademark application number and status"
                            optional
                            infoText="Provide details if filed or registered."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-8 pt-6 border-t border-slate-700/50">
                        <button type="button" onClick={goNext} disabled={isDraftSaving} className={`${primaryBtn} flex items-center gap-2`}>
                          {isDraftSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                          Save & Next<ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                        <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                          <MapPin size={16} className="text-slate-950" />
                        </div>
                        <div>
                          <h2 className={`text-white font-bold ${headingGrad}`}>Registered Office Address</h2>
                          <p className="text-xs text-slate-400">Address as per Certificate of Incorporation</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <Field
                          label="Address Line 1"
                          name="address1"
                          value={formData.address1}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.address1}
                          placeholder="Flat / Office No., Building Name, Street"
                          required
                          infoText="Complete street address including building name and number"
                        />
                        <Field
                          label="Address Line 2 / Landmark"
                          name="address2"
                          value={formData.address2}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Area / Colony / Locality"
                          optional
                          infoText="Additional address details like landmark, area name (optional)"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <Select
                            label="State / UT"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.state}
                            options={stateOptions}
                            required
                            infoText="State or Union Territory where your business is registered"
                          />
                          <Select
                            label="District / City"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.city}
                            options={getCities(formData.state)}
                            disabled={!formData.state}
                            required
                            infoText="Select your district based on the state selected above"
                          />
                        </div>

                        <Field
                          label="Pincode"
                          name="zip"
                          value={formData.zip}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={errors.zip}
                          placeholder="6-digit pincode"
                          maxLength={6}
                          required
                          infoText="6-digit postal code for your business address"
                        />
                      </div>

                      <div className="flex justify-end mt-8 pt-6 border-t border-slate-700/50">
                        <button type="button" onClick={goNext} disabled={isDraftSaving} className={`${primaryBtn} flex items-center gap-2`}>
                          {isDraftSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                          Save & Next <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700/50">
                        <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                          <FileText size={16} className="text-slate-950" />
                        </div>
                        <div>
                          <h2 className={`text-white font-bold ${headingGrad}`}>Document Uploads</h2>
                          <p className="text-xs text-slate-400">PDF / JPG / PNG — max 5MB each</p>
                        </div>
                      </div>

                      <StatusBanner 
                        caseId={caseId || ''} 
                        amount={selectedCost} 
                        entityType={formData.entityType}
                        isUnlocked={isFormUnlocked}
                      />

                      <div className="space-y-6 mb-8">
                        <div className="flex flex-wrap gap-2 p-2 rounded-xl border border-slate-700/50 bg-slate-800/30">
                          {[
                            { id: 'company', label: '1. Company Details' },
                            { id: 'people', label: '2. Directors / Partners' },
                            { id: 'support', label: '3. Supporting / Conditional' },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setDocUploadTab(tab.id as 'company' | 'people' | 'support')}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${docUploadTab === tab.id
                                ? 'bg-white text-slate-950 shadow-lg shadow-white/10'
                                : 'bg-slate-900/40 text-slate-300 hover:bg-slate-800/70'
                                }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {docUploadTab === 'company' && (
                          <div>
                            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                              <Shield size={14} className="text-white" /> Company Details Uploads (Required)
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FileField
                                label="Certificate of Incorporation / Registration"
                                name="incorporationCert"
                                required
                                file={uploadedFiles.incorporationCert}
                                onChange={f => setUploadedFiles(p => ({ ...p, incorporationCert: f }))}
                                hint={formData.entityType === 'partnership' ? 'Partnership registration certificate (if registered)' : 'Certificate of Incorporation from MCA / competent authority'}
                                infoText="Upload your business registration document"
                              />
                              <FileField
                                label="Company/Entity PAN Card"
                                name="panCard"
                                required
                                file={uploadedFiles.panCard}
                                onChange={f => setUploadedFiles(p => ({ ...p, panCard: f }))}
                                infoText="Upload clear scan of PAN card of your business entity"
                              />
                              <FileField
                                label="Registered Office Address Proof"
                                name="officeAddressProof"
                                required
                                file={uploadedFiles.officeAddressProof}
                                onChange={f => setUploadedFiles(p => ({ ...p, officeAddressProof: f }))}
                                hint="Electricity bill / rent agreement / property tax receipt"
                                infoText="Upload a recent registered office address proof document."
                              />

                              {formData.entityType === 'partnership' && (
                                <FileField
                                  label="Partnership Deed"
                                  name="partnershipDeed"
                                  required
                                  file={uploadedFiles.partnershipDeed}
                                  onChange={f => setUploadedFiles(p => ({ ...p, partnershipDeed: f }))}
                                  infoText="Upload registered or unregistered partnership deed"
                                />
                              )}

                              {formData.entityType === 'llp' && (
                                <FileField
                                  label="LLP Agreement"
                                  name="llpDeed"
                                  required
                                  file={uploadedFiles.llpDeed}
                                  onChange={f => setUploadedFiles(p => ({ ...p, llpDeed: f }))}
                                  infoText="Upload registered LLP agreement"
                                />
                              )}

                              {(formData.entityType === 'pvt_ltd' || formData.entityType === 'opc') && (
                                <>
                                  <FileField
                                    label="Memorandum of Association (MOA)"
                                    name="moa"
                                    required
                                    file={uploadedFiles.moa}
                                    onChange={f => setUploadedFiles(p => ({ ...p, moa: f }))}
                                    infoText="Upload signed MOA"
                                  />
                                  <FileField
                                    label="Articles of Association (AOA)"
                                    name="aoa"
                                    required
                                    file={uploadedFiles.aoa}
                                    onChange={f => setUploadedFiles(p => ({ ...p, aoa: f }))}
                                    infoText="Upload signed AOA"
                                  />
                                </>
                              )}

                              <FileField
                                label="Self Declaration (Original / Innovative / Not Reconstructed)"
                                name="selfDeclaration"
                                required
                                file={uploadedFiles.selfDeclaration}
                                onChange={f => setUploadedFiles(p => ({ ...p, selfDeclaration: f }))}
                                hint="Signed declaration on company letterhead"
                                infoText="Mandatory declaration confirming originality and non-reconstruction."
                              />
                            </div>
                          </div>
                        )}

                        {docUploadTab === 'people' && (
                          <div>
                            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                              <FileCheck size={14} className="text-cyan-400" /> Directors / Partners Details Uploads (Required)
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FileField
                                label="Passport-size Photos (Directors / Partners)"
                                name="passportPhotos"
                                required
                                file={uploadedFiles.passportPhotos}
                                onChange={f => setUploadedFiles(p => ({ ...p, passportPhotos: f }))}
                                hint="Single PDF/JPG containing all required photos"
                                infoText="Upload recent passport-size photos for all key persons."
                              />

                              {formData.entityType === 'partnership' && (
                                <>
                                  <FileField
                                    label="Partners Aadhaar Cards"
                                    name="partnersAadhaar"
                                    required
                                    file={uploadedFiles.partnersAadhaar}
                                    onChange={f => setUploadedFiles(p => ({ ...p, partnersAadhaar: f }))}
                                    infoText="Upload Aadhaar cards of all partners"
                                  />
                                  <FileField
                                    label="Partners PAN Cards"
                                    name="partnersPan"
                                    required
                                    file={uploadedFiles.partnersPan}
                                    onChange={f => setUploadedFiles(p => ({ ...p, partnersPan: f }))}
                                    infoText="Upload PAN cards of all partners"
                                  />
                                </>
                              )}

                              {formData.entityType === 'llp' && (
                                <>
                                  <FileField
                                    label="Designated Partner Aadhaar"
                                    name="designatedPartnerAadhaar"
                                    required
                                    file={uploadedFiles.designatedPartnerAadhaar}
                                    onChange={f => setUploadedFiles(p => ({ ...p, designatedPartnerAadhaar: f }))}
                                    infoText="Upload Aadhaar of designated partners"
                                  />
                                  <FileField
                                    label="Designated Partner PAN"
                                    name="designatedPartnerPan"
                                    required
                                    file={uploadedFiles.designatedPartnerPan}
                                    onChange={f => setUploadedFiles(p => ({ ...p, designatedPartnerPan: f }))}
                                    infoText="Upload PAN of designated partners"
                                  />
                                </>
                              )}

                              {(formData.entityType === 'pvt_ltd' || formData.entityType === 'opc') && (
                                <>
                                  <FileField
                                    label="Directors Aadhaar Cards"
                                    name="directorAadhaar"
                                    required
                                    file={uploadedFiles.directorAadhaar}
                                    onChange={f => setUploadedFiles(p => ({ ...p, directorAadhaar: f }))}
                                    infoText="Upload Aadhaar cards of all directors"
                                  />
                                  <FileField
                                    label="Directors PAN Cards"
                                    name="directorPan"
                                    required
                                    file={uploadedFiles.directorPan}
                                    onChange={f => setUploadedFiles(p => ({ ...p, directorPan: f }))}
                                    infoText="Upload PAN cards of all directors"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {docUploadTab === 'support' && (
                          <>
                            <div>
                              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                                <FileText size={14} className="text-cyan-400" /> Supporting / Optional Documents (Boost Approval)
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FileField
                                  label="Pitch Deck / Business Plan"
                                  name="pitchDeck"
                                  accept=".pdf,.ppt,.pptx"
                                  file={uploadedFiles.pitchDeck}
                                  onChange={f => setUploadedFiles(p => ({ ...p, pitchDeck: f }))}
                                  hint="PDF or PowerPoint, max 5MB"
                                  infoText="Upload your startup pitch deck or business plan document"
                                />
                                <FileField
                                  label="Product Demo / MVP"
                                  name="productDemo"
                                  file={uploadedFiles.productDemo}
                                  onChange={f => setUploadedFiles(p => ({ ...p, productDemo: f }))}
                                  hint="Demo PDF/video link snapshot/screenshots in PDF"
                                  infoText="Optional: upload demo artifacts to improve review clarity."
                                />
                                <FileField
                                  label="Company Logo"
                                  name="companyLogo"
                                  accept=".jpg,.jpeg,.png,.svg,.pdf"
                                  file={uploadedFiles.companyLogo}
                                  onChange={f => setUploadedFiles(p => ({ ...p, companyLogo: f }))}
                                  infoText="Optional: upload your startup logo."
                                />
                                <FileField
                                  label="Funding Proof (if any)"
                                  name="fundingProof"
                                  file={uploadedFiles.fundingProof}
                                  onChange={f => setUploadedFiles(p => ({ ...p, fundingProof: f }))}
                                  infoText="Optional: investment agreements, term sheets, etc."
                                />
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                                <AlertCircle size={14} className="text-white" /> Conditional Documents (If Applicable)
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FileField
                                  label="Patent / Trademark Details"
                                  name="patentTrademark"
                                  file={uploadedFiles.patentTrademark}
                                  onChange={f => setUploadedFiles(p => ({ ...p, patentTrademark: f }))}
                                  infoText="Upload documents/details only if available."
                                />
                                <FileField
                                  label="Recommendation Letter (if available)"
                                  name="recommendationLetter"
                                  file={uploadedFiles.recommendationLetter}
                                  onChange={f => setUploadedFiles(p => ({ ...p, recommendationLetter: f }))}
                                  infoText="Rarely needed, but can be uploaded when available."
                                />
                                <FileField
                                  label="Income Tax Returns (ITR)"
                                  name="itr"
                                  file={uploadedFiles.itr}
                                  onChange={f => setUploadedFiles(p => ({ ...p, itr: f }))}
                                  infoText="Upload if available."
                                />
                                <FileField
                                  label="NOC from Owner (for rented office)"
                                  name="nocFromOwner"
                                  required={formData.officeOccupancyType === 'rented'}
                                  file={uploadedFiles.nocFromOwner}
                                  onChange={f => setUploadedFiles(p => ({ ...p, nocFromOwner: f }))}
                                  infoText="Required only when registered office is rented/leased."
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Consent Section */}
                      <div className="mt-8 pt-6 border-t border-slate-700/50">
                        <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 mb-6">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              id="consent"
                              checked={consentChecked}
                              onChange={(e) => setConsentChecked(e.target.checked)}
                              className="w-4 h-4 mt-1 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500/20 cursor-pointer"
                            />
                            <label htmlFor="consent" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                              I confirm that all information provided is accurate. I consent to the processing of my personal data (including PAN, Aadhaar, and Financial Documents) solely for the purpose of{' '}
                              <span className="text-white font-medium">DPIIT Startup Recognition</span> filing and verification. I have read and agree to the{' '}
                              <a href="/privacy-policy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{' '}
                              <a href="/terms" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end items-center">
                          <button
                            type="button"
                            onClick={() => setShowPreview(true)}
                            disabled={isSubmitting || !consentChecked}
                            className={`${primaryBtn} flex items-center gap-2 ${!consentChecked ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isSubmitting ? (
                              <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                            ) : (
                              <><Eye size={18} /> Preview & Submit</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>

          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-6 space-y-4">
              {isFormUnlocked ? (
                <>
                  <ProgressStatus currentStep={currentStep} />
                  <RequiredDocuments
                    uploadedFiles={uploadedFiles}
                    orgType={formData.entityType}
                  />
                </>
              ) : (
                <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-xl p-5 shadow-xl">
                  <h3 className="text-sm font-bold text-white mb-3">Before You Pay</h3>
                  <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
                    <li>Select Constitution Type first.</li>
                    <li>Verify details in the Order Summary card.</li>
                    <li>Complete Razorpay payment to unlock full form.</li>
                  </ul>
                </div>
              )}

              {!isFormUnlocked && formData.entityType && (
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
                      <span className="text-white font-medium">₹{baseCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">GST (18%)</span>
                      <span className="text-white font-medium">₹{gstAmount.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-700/50 pt-2 flex justify-between font-bold">
                      <span className="text-white">Total Payable</span>
                      <span className="text-cyan-400">₹{selectedCost.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 italic">Inclusive of 18% GST</p>
                  </div>
                </div>
              )}
              <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-xl p-5 shadow-xl">
                <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
                  <span className="bg-rose-500/20 p-1.5 rounded mr-2">
                    <Shield className="w-4 h-4 text-rose-500" />
                  </span>
                  Need Help?
                </h3>
                <p className="text-sm text-slate-400 mb-4 leading-relaxed">Our support team will contact you for OTP/Aadhaar verification after submission.</p>
                <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 font-medium text-xs">contact Support</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8 pb-4">
          © 2026 RegiBIZ — DPIIT Recognition Portal • Secured by 256-bit Encryption
        </p>
      </div>

      <ProcessingModal isOpen={isSubmitting} />
    </div>
  );
}