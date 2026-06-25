import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Clock,
  FileText,
  Plus,
  ExternalLink,
  MessageCircle,
  Briefcase,
  Shield,
  ChevronRight,
  UserCheck,
  Scale,
  PenTool,
  Rocket,
  Building,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  FolderOpen,
  ClipboardList,
  UploadCloud,
  Hash,
  Copy
} from 'lucide-react';
import { UserProfile } from '../types';
import { formatDate } from '../utils/helpers';
import { useCustomerServices } from '../hooks/useCustomerServices';
import { Application } from '../Types/Application';
import CelebrationPopup from '../components/CelebrationPopup';


// ─── Inline status helpers (scoped to dashboard, avoids serviceUtils dep) ───
const getStatusLabel = (status?: string): string => {
  switch (status) {
    case 'submitted': return 'Submitted';
    case 'processing': return 'Processing';
    case 'pending': return 'Pending';
    case 'paid': return 'Paid';
    case 'approved': return 'Approved';
    case 'completed': return 'Completed';
    case 'rejected': return 'Rejected';
    case 'editing': return 'Editing';
    default: return status ?? 'Unknown';
  }
};
const getStatusColors = (status?: string): string => {
  switch (status) {
    case 'processing': return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'pending': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'paid': return 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30';
    case 'submitted': return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'approved': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'completed': return 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/30';
    case 'rejected': return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30';
    default: return 'text-muted-foreground bg-gray-500/10 border-gray-500/30';
  }
};

// Document checklist using Application's formData + uploadedFileUrls
const REQUIRED_DOCS_MAP: Record<string, string[]> = {
  gst: ['PAN Card', 'Aadhaar Card', 'Business Address Proof', 'Bank Statement'],
  msme: ['PAN Card', 'Aadhaar Card', 'Business Proof'],
  pan: ['Proof of Identity', 'Proof of Address', 'Proof of Date of Birth'],
  trademark: ['Trademark Logo / Word Mark', 'PAN Card', 'Business Proof'],
  startup: ['Incorporation Certificate', 'PAN Card', 'DPIIT Certificate'],
  'trade-license': ['Aadhaar Card', 'Address Proof', 'NOC from Landlord'],
  dsc: ['PAN Card', 'Aadhaar Card', 'Passport Photo'],
  fssai: ['PAN Card', 'Aadhaar Card', 'Food Safety Plan'],
  company_registration: ['PAN Card', 'Aadhaar Card', 'MOA', 'AOA'],
  dir3kyc: ['PAN Card', 'Aadhaar Card', 'DIN Details'],
  inc20a: ['COI', 'Bank Account Proof', 'Registered Office Proof'],
  adt1: ['Auditor Consent Letter', 'Board Resolution'],
  roc: ['AOC-4', 'MGT-7A', 'Financial Statements'],
};

function getDocumentChecklist(app: Application): { uploaded: string[]; pending: string[] } {
  const required = REQUIRED_DOCS_MAP[app.type] ?? [];
  if (required.length === 0) return { uploaded: [], pending: [] };
  const uploadedKeys = Object.keys(app.uploadedFileUrls || {}).map(k => k.toLowerCase());
  const formKeys = Object.keys(app.formData || {}).map(k => k.toLowerCase());
  const allKeys = [...uploadedKeys, ...formKeys];
  const uploaded: string[] = [];
  const pending: string[] = [];
  for (const doc of required) {
    const words = doc.toLowerCase().split(' ').filter(w => w.length > 2);
    const found = words.some(w => allKeys.some(k => k.includes(w)));
    if (found) uploaded.push(doc); else pending.push(doc);
  }
  return { uploaded, pending };
}

// ============================================================================
// COLOR CONSTANTS
// ============================================================================
const GRADIENT_ACTION = 'bg-gradient-to-r from-cyan-500 to-blue-600';
const GRADIENT_ACTION_HOVER = 'hover:from-cyan-400 hover:to-blue-500';
const SHADOW_ACTION = 'shadow-cyan-500/20';

// ============================================================================
// ROTATING SERVICES DATA
// ============================================================================
const rotatingServices = [
  {
    title: 'GST Registration',
    description:
      'Complete GST registration with expert guidance. Get your GSTIN within 7 working days with zero errors.',
    icon: <Briefcase className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
    route: '/services/gst-registration',
    benefits: ['Instant GSTIN', 'Expert Support', '100% Online'],
  },
  {
    title: 'MSME (UDYAM) Registration',
    description:
      'Register under MSME scheme and avail government benefits, subsidies, and collateral-free loans up to ₹1 Crore.',
    icon: <Shield className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />,
    route: '/services/msme-registration',
    benefits: ['Govt. Benefits', 'Easy Loans', 'Tax Exemptions'],
  },
  {
    title: 'Digital Signature Certificate (DSC)',
    description:
      'Get your Class 3 Digital Signature Certificate for e-filing, tenders, and MCA compliance instantly.',
    icon: <PenTool className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
    route: '/services/dsc-registration',
    benefits: ['Class 3 DSC', 'USB Token', 'Same Day Issue'],
  },
  {
    title: 'Startup Registration (DPIIT)',
    description:
      'Official recognition for your startup. Avail tax holidays, IPR fast-tracking, and easier compliance norms.',
    icon: <Rocket className="w-6 h-6 text-orange-600 dark:text-orange-400" />,
    route: '/services/startup-india',
    benefits: ['Tax Holidays', 'IPR Fast-Track', 'Govt. Tenders'],
  },
  {
    title: 'Company Registration (ROC)',
    description:
      'Register your Private Limited or LLP with MCA. Complete ROC compliance and filing services.',
    icon: <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
    route: '/services/company-registration',
    benefits: ['MCA Approved', 'DIN & DSC Included', 'Fast Processing'],
  },
  {
    title: 'ROC Annual Filing',
    description:
      'Complete annual compliance package for Private Limited Companies including AOC-4 and MGT-7A filing.',
    icon: <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
    route: '/services/roc-compliance',
    benefits: ['AOC-4 & MGT-7A', 'Penalty Avoidance', 'Expert Support'],
  },
  {
    title: 'ADT-1 Auditor Appointment',
    description:
      'File form ADT-1 for the appointment of the first auditor or subsequent auditors of your company.',
    icon: <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
    route: '/services/adt-1-filing',
    benefits: ['Mandatory Compliance', 'Timely Filing', 'No Penalties'],
  },
  {
    title: 'INC-20A Filing',
    description:
      'Mandatory filing for new companies to declare the commencement of business and avoid strike-off.',
    icon: <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />,
    route: '/services/inc-20a-filing',
    benefits: ['Bank Auth', 'Business Start', 'MCA Compliance'],
  },
  {
    title: 'DIR-3 KYC',
    description:
      'Annual KYC filing for all directors holding a Director Identification Number (DIN) to keep it active.',
    icon: <UserCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
    route: '/services/dir-3-kyc-filing',
    benefits: ['Active DIN', 'Web/E-form Filing', 'Same Day Processing'],
  },
  {
    title: 'INC-22A (ACTIVE)',
    description:
      'Mandatory e-filing for physical verification of the registered office of the company to maintain active status.',
    icon: <Building className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />,
    route: '/services/inc-22a-filing',
    benefits: ['Active Status', 'Office Verify', 'Fast Approval'],
  },
  {
    title: 'MGT-7A Filing',
    description:
      'Annual return containing details of shares, indebtedness, and directors of the company for the financial year.',
    icon: <Briefcase className="w-6 h-6 text-orange-600 dark:text-orange-400" />,
    route: '/services/mgt-7-filing',
    benefits: ['Annual Return', 'Compliance', 'Audit Proof'],
  },
  {
    title: 'AOC-4 Filing',
    description:
      'File financial statements, balance sheets, and profit & loss accounts of your company every financial year.',
    icon: <FileText className="w-6 h-6 text-pink-600 dark:text-pink-400" />,
    route: '/services/a0c4-filing',
    benefits: ['Finance Audit', 'MCA Compliance', 'Transparent'],
  },
];

// ============================================================================
// SERVICE TYPE → ICON COLOR
// ============================================================================
const getIconStyle = (title?: string): string => {
  const t = (title || '').toLowerCase();
  if (t.includes('gst')) return 'bg-teal-500/20 text-teal-600 dark:text-teal-400';
  if (t.includes('msme')) return 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400';
  if (t.includes('dsc') || t.includes('signature')) return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
  if (t.includes('roc') || t.includes('company')) return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
  if (t.includes('adt')) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  if (t.includes('inc')) return 'bg-green-500/20 text-green-600 dark:text-green-400';
  if (t.includes('dir')) return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
  if (t.includes('dpiit') || t.includes('startup')) return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
  if (t.includes('pan')) return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
  if (t.includes('fssai')) return 'bg-rose-500/20 text-rose-600 dark:text-rose-400';
  if (t.includes('trademark')) return 'bg-pink-500/20 text-pink-600 dark:text-pink-400';
  return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
};

// ============================================================================
// SERVICE DETAIL MODAL
// ============================================================================
interface ServiceDetailModalProps {
  service: Application;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({ service, onClose, onNavigate }) => {
  const checklist = getDocumentChecklist(service);
  const docTitle = service.title || 'Application';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIconStyle(docTitle)}`}>
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{docTitle}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">ID: {service.id.slice(0, 10).toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 flex-1">

          {/* Status & Date */}
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded-full border font-semibold capitalize ${getStatusColors(service.status)}`}>
              {getStatusLabel(service.status)}
            </span>
            <span className="text-xs text-muted-foreground">Submitted: {formatDate(service.submittedAt)}</span>
          </div>

          {/* Uploaded Documents */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UploadCloud size={15} className="text-green-600 dark:text-green-400" />
              <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">
                Uploaded Documents
                <span className="ml-2 text-xs font-normal text-muted-foreground">({checklist.uploaded.length})</span>
              </h4>
            </div>
            {checklist.uploaded.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-5">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {checklist.uploaded.map((doc, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-foreground bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2">
                    <CheckCircle size={14} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pending Documents Checklist */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={15} className="text-amber-600 dark:text-amber-400" />
              <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Pending Documents
                <span className="ml-2 text-xs font-normal text-muted-foreground">({checklist.pending.length})</span>
              </h4>
            </div>
            {checklist.pending.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 pl-5 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> All required documents collected!
              </p>
            ) : (
              <ul className="space-y-2">
                {checklist.pending.map((doc, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-foreground bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                    <XCircle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    {doc}
                    <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 font-medium">Required</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Note if no checklist available */}
          {checklist.uploaded.length === 0 && checklist.pending.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Document checklist not available for this service type.
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={() => onNavigate(service.id)}
            className={`flex-1 ${GRADIENT_ACTION} ${GRADIENT_ACTION_HOVER} text-white text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${SHADOW_ACTION}`}
          >
            <ExternalLink size={14} /> View Full Details
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-card hover:bg-secondary border border-border text-foreground text-xs font-medium rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SERVICE LIST MODAL  (Active / Pending / Completed list view)
// ============================================================================
interface ServiceListModalProps {
  title: string;
  icon: React.ReactNode;
  services: Application[];
  onClose: () => void;
  onSelectService: (svc: Application) => void;
  onNavigate: (id: string) => void;
}

const ServiceListModal: React.FC<ServiceListModalProps> = ({
  title, icon, services, onClose, onSelectService, onNavigate,
}) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 pointer-events-auto"
    onClick={onClose}
  >
    <div
      className="bg-background border border-border rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
      onClick={e => e.stopPropagation()}
    >

      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-teal-500 to-blue-600 dark:from-teal-400 dark:to-blue-400 bg-clip-text text-transparent">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">{services.length} application{services.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 overflow-y-auto custom-scrollbar space-y-3 flex-1">
        {services.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No applications in this category.</p>
          </div>
        ) : (
          services.map(svc => {
            const docTitle = svc.title || 'Application';
            return (
              <div
                key={svc.id}
                className="group flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-teal-500/30 hover:bg-secondary transition-all cursor-pointer"
                onClick={() => onSelectService(svc)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIconStyle(docTitle)}`}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="text-foreground font-medium text-sm group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
                      {docTitle}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      ID: {svc.id.slice(0, 8).toUpperCase()} · {formatDate(svc.submittedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${getStatusColors(svc.status)}`}>
                    {getStatusLabel(svc.status)}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-border bg-card rounded-b-2xl text-center">
        <p className="text-xs text-muted-foreground">Click any application to view documents & details</p>
      </div>
    </div>
  </div>
);

// ============================================================================
// STAT CARD
// ============================================================================
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  accentColor: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, icon, badge, badgeColor, accentColor, onClick,
}) => (
  <div
    onClick={onClick}
    className={`glass-card p-4 rounded-lg border border-border ${onClick ? 'cursor-pointer hover:bg-secondary transition-all group' : ''}`}
    style={onClick ? { borderColor: 'hsl(var(--border))' } : undefined}
    onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = accentColor)}
    onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = 'hsl(var(--border))')}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeColor}`}>{badge}</span>
    </div>
    <h3 className="text-2xl font-bold text-foreground mb-0.5">{value}</h3>
    <p className={`text-xs text-muted-foreground ${onClick ? 'group-hover:text-teal-600 dark:group-hover:text-teal-300' : ''} transition-colors`}>
      {label}
    </p>
  </div>
);

// ============================================================================
// CUSTOMER DASHBOARD — MAIN COMPONENT
// ============================================================================
const CustomerDashboard: React.FC<{
  user: UserProfile;
  isProfileIncomplete?: boolean;
  openProfile?: () => void;
}> = ({ user, isProfileIncomplete, openProfile }) => {
  const navigate = useNavigate();
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);

  // — Modal state —
  const [listModalType, setListModalType] = useState<'active' | 'pending' | 'completed' | null>(null);
  const [detailService, setDetailService] = useState<Application | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');

  // Detect first login
  useEffect(() => {
    if (!localStorage.getItem('regibiz_has_celebrated_login')) {
      const timer = setTimeout(() => {
        setCelebrationMessage(""); // Removed message text
        setShowCelebration(true);
        localStorage.setItem('regibiz_has_celebrated_login', 'true');
      }, 1500); // Small delay for effect
      return () => clearTimeout(timer);
    }
  }, []);


  // ✅ One-time fetch hook — NO real-time listeners, NO polling
  const {
    categorized,
    loading,
    refreshing,
    error,
    lastFetchedAt,
    refresh,
  } = useCustomerServices(user.uid);

  // Auto-rotate service promo cards
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentServiceIndex(prev => (prev + 1) % rotatingServices.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // ——————————————————————————————————————————
  // LOADING SKELETON
  // ——————————————————————————————————————————
  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-6 min-h-screen bg-background relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-secondary rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-40 bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ——————————————————————————————————————————
  // MODAL HELPERS
  // ——————————————————————————————————————————
  const getListForModal = () => {
    if (listModalType === 'active') return categorized.active;
    if (listModalType === 'pending') return categorized.pending;
    if (listModalType === 'completed') return categorized.completed;
    return [];
  };

  const listModalTitle = () => {
    if (listModalType === 'active') return 'Active Services';
    if (listModalType === 'pending') return 'Pending Reviews';
    if (listModalType === 'completed') return 'Completed Services';
    return '';
  };

  const listModalIcon = () => {
    if (listModalType === 'active')
      return <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30"><Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" /></div>;
    if (listModalType === 'pending')
      return <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30"><Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>;
    return <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30"><CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>;
  };

  // (totalSpent removed — 4th stat card shows total application count)

  // ——————————————————————————————————————————
  // RENDER
  // ——————————————————————————————————————————
  // ——————————————————————————————————————————
  // RENDER
  // ——————————————————————————————————————————
  const isAnyModalOpen = !!listModalType || !!detailService;

  return (
    <div className="min-h-screen bg-background text-foreground relative" style={{ fontFamily: 'Yanaku, sans-serif' }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <CelebrationPopup
        trigger={showCelebration}
        message={celebrationMessage}
        onComplete={() => setShowCelebration(false)}
      />


      {/* ── MAIN DASHBOARD CONTENT (This blurs) ── */}
      <div className={`p-4 sm:p-6 md:p-10 space-y-8 relative z-10 transition-all duration-500 ${isAnyModalOpen ? 'blur-md grayscale-[0.3] opacity-50 scale-[0.98]' : 'animate-fade-in'}`}>

        {/* ── TOP BAR: Welcome + Refresh ── */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700 dark:from-teal-400 dark:via-cyan-400 dark:to-blue-500 bg-clip-text text-transparent tracking-tight">
              Hello, {user.displayName ? user.displayName.split(' ')[0] : 'User'}
            </h1>
            {lastFetchedAt && (
              <p className="text-xs text-muted-foreground font-medium">
                Last updated: {new Date(lastFetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/services')}
              className={`${GRADIENT_ACTION} ${GRADIENT_ACTION_HOVER} text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${SHADOW_ACTION} flex items-center justify-center gap-2 flex-1 sm:flex-none`}
            >
              <Plus size={18} /> New Application
            </button>
            <button
              onClick={() => navigate('/documents')}
              className="bg-card text-foreground border border-border px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:bg-secondary flex-1 sm:flex-none"
            >
              <ExternalLink size={18} /> Documents
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="bg-secondary text-teal-600 dark:text-teal-400 border border-teal-500/20 hover:bg-teal-500/10 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Sync'}
            </button>
            {isProfileIncomplete && openProfile && (
              <button
                onClick={openProfile}
                className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:bg-cyan-500/20 animate-pulse w-full sm:w-auto"
              >
                <UserCheck size={18} /> Complete Profile
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-sm animate-fade-in">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
            <button onClick={refresh} className="ml-auto text-xs underline hover:no-underline">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="glass-card rounded-xl p-6 relative overflow-hidden border border-border bg-card/85 shadow-lg">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 dark:from-teal-400 dark:via-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">
                  Start Your Business Registration
                </h2>
                <p className="text-muted-foreground mb-4 text-sm font-medium">GST, MSME, DSC, DPIIT — Everything you need.</p>

                <div
                  className="rounded-xl p-4 mb-4 border border-teal-500/35 bg-[linear-gradient(135deg,rgba(20,184,166,0.16),rgba(37,99,235,0.10))] cursor-pointer hover:border-teal-500/60 hover:shadow-[0_16px_38px_-30px_rgba(15,118,110,0.8)] transition-all"
                  onClick={() => navigate(rotatingServices[currentServiceIndex].route)}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {React.cloneElement(rotatingServices[currentServiceIndex].icon, { className: 'w-6 h-6 text-teal-600 dark:text-teal-400' })}
                    <span className="text-black dark:text-white font-bold">{rotatingServices[currentServiceIndex].title}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-300 text-xs mb-3 leading-relaxed font-medium">
                    {rotatingServices[currentServiceIndex].description}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {rotatingServices[currentServiceIndex].benefits?.map((benefit, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-3 py-1.5 rounded-lg bg-teal-50 !text-slate-950 border border-teal-200 dark:bg-teal-500/20 dark:!text-teal-100 dark:border-teal-400/35 font-bold shadow-sm"
                        style={{ WebkitTextFillColor: 'currentColor' }}
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center gap-2 mb-4">
                  {rotatingServices.map((_, index) => (
                    <button
                      key={index}
                      onClick={e => { e.stopPropagation(); setCurrentServiceIndex(index); }}
                      className={`h-2.5 rounded-full transition-all border ${index === currentServiceIndex
                        ? 'w-7 bg-teal-600 border-teal-700 dark:bg-teal-400 dark:border-teal-300 shadow-[0_0_0_3px_rgba(20,184,166,0.14)]'
                        : 'w-2.5 bg-slate-300 border-slate-400 hover:bg-slate-400 dark:bg-slate-600/85 dark:border-slate-700/70 dark:hover:bg-slate-500'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6 relative overflow-hidden border border-border bg-card/85 shadow-lg">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 dark:from-teal-400 dark:via-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">
                    Get Expert Advice. Instantly.
                  </h2>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                    <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Backed by 1000+ verified experts</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => navigate('/consult')} className="group flex items-center justify-center gap-3 bg-card hover:bg-secondary/80 border border-border hover:border-teal-500/50 rounded-xl p-4 transition-all duration-300 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-foreground font-semibold">Talk to CA</div>
                      <div className="text-xs text-muted-foreground font-medium">Tax & Accounting</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-teal-600 dark:group-hover:text-teal-500 transition-colors" />
                  </button>
                  <button onClick={() => navigate('/consult')} className="group flex items-center justify-center gap-3 bg-card hover:bg-secondary/80 border border-border hover:border-blue-500/50 rounded-xl p-4 transition-all duration-300 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Scale className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-foreground font-semibold">Talk to a Lawyer</div>
                      <div className="text-xs text-muted-foreground font-medium">Legal Advice</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors" />
                  </button>
                </div>
              </div>
            </div>

            {categorized.all.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Activity size={15} className="text-teal-600 dark:text-teal-400" /> Recent Applications
                  </h3>
                  <button
                    onClick={() => setListModalType('active')}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-2">
                  {categorized.all.slice(0, 4).map(svc => {
                    const docTitle = (svc as any).title || 'Application';
                    return (
                      <div
                        key={svc.id}
                        className="group flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-teal-500/25 hover:bg-secondary transition-all cursor-pointer"
                        onClick={() => setDetailService(svc)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getIconStyle(docTitle)}`}>
                            <FileText size={14} />
                          </div>
                          <div>
                            <p className="text-sm text-foreground font-medium group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">{docTitle}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(svc.submittedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getStatusColors(svc.status)}`}>
                            {getStatusLabel(svc.status)}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!error && categorized.all.length === 0 && (
              <div className="glass-card rounded-xl p-10 text-center">
                <FolderOpen className="w-14 h-14 mx-auto mb-3 text-muted-foreground opacity-60" />
                <h3 className="text-foreground font-semibold mb-1">No Applications Yet</h3>
                <p className="text-muted-foreground text-sm mb-5">
                  Start your first registration to see it here.
                </p>
                <button
                  onClick={() => navigate('/services')}
                  className={`${GRADIENT_ACTION} ${GRADIENT_ACTION_HOVER} text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${SHADOW_ACTION} inline-flex items-center gap-2`}
                >
                  <Plus size={16} /> Browse Services
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:space-y-4 h-fit">
            <StatCard
              label="Active Apps"
              value={refreshing ? <Loader2 size={18} className="animate-spin text-teal-600 dark:text-teal-400" /> as any : categorized.active.length}
              icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
              badge="Live"
              badgeColor="text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20"
              accentColor="rgba(20,184,166,0.5)"
              onClick={() => setListModalType('active')}
            />
            <StatCard
              label="In Progress"
              value={refreshing ? <Loader2 size={18} className="animate-spin text-amber-600 dark:text-amber-400" /> as any : categorized.pending.length}
              icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              badge="Review"
              badgeColor="text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20"
              accentColor="rgba(245,158,11,0.5)"
              onClick={() => setListModalType('pending')}
            />
            <StatCard
              label="Completed"
              value={refreshing ? <Loader2 size={18} className="animate-spin text-emerald-600 dark:text-emerald-400" /> as any : categorized.completed.length}
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              badge="Done"
              badgeColor="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              accentColor="rgba(16,185,129,0.5)"
              onClick={() => setListModalType('completed')}
            />
            <StatCard
              label="Total Apps"
              value={refreshing ? <Loader2 size={18} className="animate-spin text-blue-600 dark:text-blue-400" /> as any : categorized.all.length}
              icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              badge="All"
              badgeColor="text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
              accentColor=""
            />
          </div>
        </div>
      </div>

      {/* ── MODALS (Rendered outside the blurred div to stay sharp) ── */}
      {listModalType && !detailService && (
        <ServiceListModal
          title={listModalTitle()}
          icon={listModalIcon()}
          services={getListForModal()}
          onClose={() => setListModalType(null)}
          onSelectService={svc => setDetailService(svc)}
          onNavigate={id => { setListModalType(null); navigate(`/application/${id}`); }}
        />
      )}

      {detailService && (
        <ServiceDetailModal
          service={detailService}
          onClose={() => setDetailService(null)}
          onNavigate={id => { setDetailService(null); navigate(`/application/${id}`); }}
        />
      )}
    </div>
  );
};

export default CustomerDashboard;