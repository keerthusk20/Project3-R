import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Landmark,
  User,
  PenTool,
  Building2,
  ArrowRight,
  Phone,
  ShieldCheck,
  Clock,
  CreditCard,
  ChevronLeft,
  Loader2,
  Star,
  BadgeCheck,
  Users,
  Scale,
  Briefcase,
  UserCheck,
  MessageCircle,
  Store,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "proofOfConstitution" | "companyPan" | "companyCoi" | "companyMoa" | "companyAoa"
  | "llpPan" | "llpAgreement" | "partnershipDeed" | "partnershipPan"
  | "promoterPhoto" | "cancelledCheque" | "bankStatement"
  | "addressProof" | "noc" | "signature" | "promoterPan" | "promoterAadhaarDoc"
  | "rentAgreement" | "elecBill" | "taxReceipt" | "utilityBill" | "signPan"
  | "signAadhaar" | "signPhoto" | "bankProof" | "proprietorPan" | "proprietorAadhaar"
  | "shopAct" | "tradeNameProof";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}

// ─────────────────────────────────────────────
// DOCUMENT DATA
// ─────────────────────────────────────────────
const GST_DOCUMENTS: Record<DocKey, string> = {
  proofOfConstitution: "Proof of Constitution",
  companyPan: "Company PAN Card",
  companyCoi: "Certificate of Incorporation (COI)",
  companyMoa: "Memorandum of Association (MOA)",
  companyAoa: "Articles of Association (AOA)",
  llpPan: "LLP PAN Card",
  llpAgreement: "LLP Agreement",
  partnershipDeed: "Partnership Deed",
  partnershipPan: "Firm PAN Card",
  promoterPhoto: "Promoter / Director Photograph",
  promoterPan: "Promoter / Director PAN Card",
  promoterAadhaarDoc: "Promoter / Director Aadhaar Card",
  proprietorPan: "Proprietor PAN Card",
  proprietorAadhaar: "Proprietor Aadhaar Card",
  shopAct: "Shop & Establishment Certificate",
  tradeNameProof: "Trade Name Proof (if any)",
  signature: "Digital Signature Certificate (DSC)",
  signPan: "Signed PAN Declaration",
  signAadhaar: "Signed Aadhaar Declaration",
  signPhoto: "Signed Photograph",
  cancelledCheque: "Cancelled Cheque",
  bankStatement: "Bank Statement (Last 3 Months)",
  bankProof: "Bank Account Proof",
  addressProof: "Premises Address Proof",
  noc: "No Objection Certificate (NOC)",
  rentAgreement: "Own / Rent / Lease Agreement",
  elecBill: "Electricity Bill",
  taxReceipt: "Property Tax Receipt",
  utilityBill: "Utility Bill (Water / Gas / Telephone)",
};

const PVT_GROUPS: DocumentGroup[] = [
  { id: "entity", label: "Company Documents", icon: Building2, keys: ["companyPan", "companyCoi", "companyMoa", "companyAoa"] },
  { id: "promoter", label: "Director / Signatory", icon: User, keys: ["promoterPhoto", "promoterPan", "promoterAadhaarDoc", "signature"] },
  { id: "bank", label: "Bank Details", icon: Landmark, keys: ["cancelledCheque", "bankStatement", "bankProof"] },
  { id: "address", label: "Address Proof", icon: FileText, keys: ["elecBill", "noc", "rentAgreement", "utilityBill"] },
];
const PROP_GROUPS: DocumentGroup[] = [
  { id: "proprietor", label: "Proprietor Documents", icon: User, keys: ["proprietorPan", "proprietorAadhaar", "promoterPhoto", "shopAct"] },
  { id: "trade", label: "Business Identity", icon: Briefcase, keys: ["tradeNameProof", "signPan", "signAadhaar", "signPhoto"] },
  { id: "bank", label: "Bank Details", icon: Landmark, keys: ["cancelledCheque", "bankStatement", "bankProof"] },
  { id: "address", label: "Address Proof", icon: FileText, keys: ["elecBill", "noc", "rentAgreement", "utilityBill"] },
];
const SHOP_GROUPS: DocumentGroup[] = [
  { id: "owner", label: "Shop Owner KYC", icon: User, keys: ["proprietorPan", "proprietorAadhaar", "promoterPhoto"] },
  { id: "shop", label: "Shop Identity", icon: Store, keys: ["shopAct", "tradeNameProof", "signPan", "signAadhaar"] },
  { id: "bank", label: "Bank Details", icon: Landmark, keys: ["cancelledCheque", "bankStatement", "bankProof"] },
  { id: "premises", label: "Shop Premises", icon: FileText, keys: ["elecBill", "noc", "rentAgreement", "utilityBill"] },
];
const LLP_GROUPS: DocumentGroup[] = [
  { id: "llp", label: "LLP Documents", icon: Scale, keys: ["llpPan", "llpAgreement", "companyCoi", "proofOfConstitution"] },
  { id: "partner", label: "Designated Partners", icon: User, keys: ["promoterPhoto", "promoterPan", "promoterAadhaarDoc", "signature"] },
  { id: "bank", label: "Bank Details", icon: Landmark, keys: ["cancelledCheque", "bankStatement", "bankProof"] },
  { id: "address", label: "Address Proof", icon: FileText, keys: ["elecBill", "noc", "rentAgreement", "utilityBill"] },
];
const PARTNER_GROUPS: DocumentGroup[] = [
  { id: "firm", label: "Partnership Firm", icon: Users, keys: ["partnershipDeed", "partnershipPan", "proofOfConstitution", "shopAct"] },
  { id: "partner", label: "Partners / Signatory", icon: User, keys: ["promoterPhoto", "promoterPan", "promoterAadhaarDoc", "signPhoto"] },
  { id: "bank", label: "Bank Details", icon: Landmark, keys: ["cancelledCheque", "bankStatement", "bankProof"] },
  { id: "address", label: "Address Proof", icon: FileText, keys: ["elecBill", "noc", "rentAgreement", "utilityBill"] },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (["companyPan", "llpPan", "proprietorPan", "partnershipPan", "promoterPan", "companyCoi", "companyMoa", "companyAoa", "llpAgreement", "partnershipDeed", "proofOfConstitution", "tradeNameProof", "shopAct"].includes(key)) return FileText;
  if (["cancelledCheque", "bankStatement", "bankProof"].includes(key)) return Landmark;
  if (["promoterPhoto", "signPhoto", "proprietorAadhaar", "promoterAadhaarDoc"].includes(key)) return User;
  if (["signature", "signPan", "signAadhaar"].includes(key)) return PenTool;
  if (["addressProof", "rentAgreement", "noc", "elecBill", "taxReceipt", "utilityBill"].includes(key)) return Building2;
  return FileText;
};

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const GRADIENTS = {
  heading: "linear-gradient(to right, #ef4444, #f97316)",
  headingGlow: "0 0 30px rgba(249, 115, 22, 0.25)",
  button: "linear-gradient(to right, #0f766e, #075985, #1e3a8a)",
  buttonHover: "linear-gradient(to right, #115e59, #0c4a6e, #1e40af)",
  buttonGlow: "0 4px 20px rgba(6, 182, 212, 0.35)",
};

const FREE_TEXT_STYLE: React.CSSProperties = {
  color: "#34d399",
  fontWeight: 900,
  textShadow: "0 0 18px rgba(52, 211, 153, 0.35)",
};

const FreeCornerRibbon = () => (
  <div
    aria-label="Free service"
    style={{
      position: "absolute",
      top: 20,
      right: -42,
      width: 150,
      padding: "8px 0",
      transform: "rotate(45deg)",
      transformOrigin: "center",
      background: "linear-gradient(135deg, #062c14ff 0%, #16a34a 55%, #15803d 100%)",
      color: "#fff",
      fontSize: 14,
      fontWeight: 900,
      letterSpacing: "0.14em",
      textAlign: "center",
      textTransform: "uppercase",
      boxShadow: "0 12px 28px rgba(22, 163, 74, 0.38)",
      border: "1px solid rgba(255,255,255,0.35)",
      zIndex: 3,
      pointerEvents: "none",
    }}
  >
    FREE
  </div>
);

type GstTypeId = "pvt_ltd" | "proprietorship" | "shops" | "llp" | "partnership";

const GST_TYPES: {
  id: GstTypeId; label: string; shortLabel: string; badge: string;
  badgeColor: string; icon: React.ElementType; tagline: string;
  highlights: string[]; timeline: string; threshold: string; turnover: string;
}[] = [
    { id: "shops", label: "Shops & Retail Businesses", shortLabel: "Shops", badge: "Retail Ready", badgeColor: "#14b8a6", icon: Store, tagline: "GST for physical shops and local retailers", highlights: ["Ideal for grocery, boutique, pharmacy, hardware, mobile and retail stores", "Shop Act / trade license helps prove your business identity", "Required for GST invoices, supplier credibility and B2B sales", "Supports input tax credit on eligible business purchases", "Uses the proprietorship GST form for single-owner shops"], timeline: "2-4 Days", threshold: "Rs. 40L for goods / Rs. 20L for services", turnover: "Voluntary below threshold" },
    { id: "pvt_ltd", label: "Private Limited Company", shortLabel: "Pvt Ltd", badge: "Most Common", badgeColor: "#f97316", icon: Building2, tagline: "GST for incorporated companies", highlights: ["Mandatory if turnover exceeds ₹20L (₹40L for goods)", "COI, MOA & AOA needed along with director KYC", "Authorised signatory must have valid DSC", "Required for B2B invoicing & e-commerce platforms", "Enables Input Tax Credit on purchases"], timeline: "3–5 Days", threshold: "₹20L (Services) / ₹40L (Goods)", turnover: "Mandatory above threshold" },
    { id: "proprietorship", label: "Sole Proprietorship", shortLabel: "Proprietorship", badge: "Simplest", badgeColor: "#10b981", icon: UserCheck, tagline: "GST for individual business owners", highlights: ["Proprietor's PAN & Aadhaar serve as identity proof", "No separate company documents needed", "Shop & Establishment certificate recommended", "Easiest and fastest GST registration process", "Single-owner businesses & freelancers"], timeline: "2–4 Days", threshold: "₹20L (Services) / ₹40L (Goods)", turnover: "Voluntary below threshold" },
    { id: "llp", label: "Limited Liability Partnership", shortLabel: "LLP", badge: "Professional Choice", badgeColor: "#06b6d4", icon: Scale, tagline: "GST for LLP firms", highlights: ["LLP PAN, Agreement & COI are mandatory", "Designated Partners' KYC required", "DSC of authorised partner needed for filing", "Suitable for professional service firms", "Enables ITC claims on business expenses"], timeline: "3–5 Days", threshold: "₹20L (Services) / ₹40L (Goods)", turnover: "Mandatory above threshold" },
    { id: "partnership", label: "Partnership Firm", shortLabel: "Partnership", badge: "Traditional", badgeColor: "#8b5cf6", icon: Users, tagline: "GST for registered & unregistered partnerships", highlights: ["Partnership Deed & firm PAN are mandatory", "All partners' KYC documents required", "Works for both registered & unregistered firms", "Required for inter-state supply of goods/services", "Enables Input Tax Credit for the firm"], timeline: "3–5 Days", threshold: "₹20L (Services) / ₹40L (Goods)", turnover: "Mandatory above threshold" },
  ];

const TYPE_DOC_GROUPS: Record<GstTypeId, DocumentGroup[]> = {
  pvt_ltd: PVT_GROUPS, proprietorship: PROP_GROUPS, shops: SHOP_GROUPS, llp: LLP_GROUPS, partnership: PARTNER_GROUPS,
};

const TYPE_PROCESS_STEPS: Record<GstTypeId, { num: string; title: string; desc: string; color: string }[]> = {
  pvt_ltd: [
    { num: "01", title: "Collect Director KYC", desc: "PAN, Aadhaar, photo & DSC of all directors / authorised signatory", color: "#60a5fa" },
    { num: "02", title: "Company Documents", desc: "COI, MOA, AOA, Company PAN & registered office address proof", color: "#60a5fa" },
    { num: "03", title: "GST Portal Filing", desc: "Application filed on GST portal with all entity & individual details", color: "#60a5fa" },
    { num: "04", title: "ARN Generated", desc: "Application Reference Number (ARN) issued within minutes of filing", color: "#60a5fa" },
    { num: "05", title: "Dept. Verification", desc: "GST officer reviews application — may raise queries or seek clarification", color: "#60a5fa" },
    { num: "06", title: "GSTIN Issued", desc: "15-digit GSTIN and GST Certificate issued — usually within 3–5 working days", color: "#60a5fa" },
  ],
  proprietorship: [
    { num: "01", title: "Proprietor KYC", desc: "Proprietor's PAN, Aadhaar, passport-size photo for identity verification", color: "#60a5fa" },
    { num: "02", title: "Business Proof", desc: "Shop & Establishment cert or any trade name proof for the business", color: "#60a5fa" },
    { num: "03", title: "Address Proof", desc: "Electricity bill, rent agreement or utility bill of business premises", color: "#60a5fa" },
    { num: "04", title: "GST Portal Filing", desc: "Application submitted on GST portal — quickest process among all types", color: "#60a5fa" },
    { num: "05", title: "ARN Generated", desc: "Application Reference Number issued immediately upon submission", color: "#60a5fa" },
    { num: "06", title: "GSTIN Issued", desc: "GSTIN and certificate issued within 2–4 working days", color: "#60a5fa" },
  ],
  shops: [
    { num: "01", title: "Owner KYC", desc: "Proprietor PAN, Aadhaar and photo are collected for GST identity verification", color: "#60a5fa" },
    { num: "02", title: "Shop Proof", desc: "Shop Act certificate, trade license or trade name proof is verified", color: "#60a5fa" },
    { num: "03", title: "Premises Proof", desc: "Electricity bill, rent agreement, NOC or utility bill confirms the shop address", color: "#60a5fa" },
    { num: "04", title: "Goods / HSN Details", desc: "Main goods or retail categories are mapped before GST portal filing", color: "#60a5fa" },
    { num: "05", title: "GST Portal Filing", desc: "Application is submitted as a proprietorship shop registration", color: "#60a5fa" },
    { num: "06", title: "GSTIN Issued", desc: "GSTIN and certificate are issued after department verification", color: "#60a5fa" },
  ],
  llp: [
    { num: "01", title: "LLP Documents", desc: "LLP PAN, LLP Agreement, Certificate of Incorporation from MCA", color: "#60a5fa" },
    { num: "02", title: "Partner KYC", desc: "PAN, Aadhaar & photo of all Designated Partners of the LLP", color: "#60a5fa" },
    { num: "03", title: "DSC of Partner", desc: "Class 3 DSC of the authorised Designated Partner for digital signing", color: "#60a5fa" },
    { num: "04", title: "GST Portal Filing", desc: "Application filed on GST portal with LLP entity & partner details", color: "#60a5fa" },
    { num: "05", title: "ARN Generated", desc: "Application Reference Number issued on successful form submission", color: "#60a5fa" },
    { num: "06", title: "GSTIN Issued", desc: "GSTIN and GST Certificate issued within 3–5 working days", color: "#60a5fa" },
  ],
  partnership: [
    { num: "01", title: "Partnership Deed", desc: "Registered or notarised Partnership Deed with all partners listed", color: "#60a5fa" },
    { num: "02", title: "Firm & Partner PAN", desc: "Firm's PAN card and individual PAN of all partners / managing partners", color: "#60a5fa" },
    { num: "03", title: "Partners' KYC", desc: "Aadhaar, photograph and address proof of all partners", color: "#60a5fa" },
    { num: "04", title: "GST Portal Filing", desc: "Application filed on GST portal with firm & partner details", color: "#60a5fa" },
    { num: "05", title: "ARN Generated", desc: "Application Reference Number issued upon successful submission", color: "#60a5fa" },
    { num: "06", title: "GSTIN Issued", desc: "GSTIN and GST Certificate issued within 3–5 working days", color: "#60a5fa" },
  ],
};

// ─────────────────────────────────────────────
// PAY BUTTON
// ─────────────────────────────────────────────
const clearGstDraftStorage = () => {
  const prefixes = ["gstCommon", "gstProprietor", "gstPrivate", "gstLLP", "gstPartnership", "gst_part"];
  Object.keys(localStorage).forEach((key) => {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  });
};

const PayBtn = ({
  label, style = {}, variant = "primary", onClick, isProcessing,
}: {
  label: string; style?: React.CSSProperties; variant?: "primary" | "secondary";
  onClick: () => void; isProcessing: boolean;
}) => {
  const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
  const hoverGradient = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;
  return (
    <button
      onClick={onClick}
      disabled={isProcessing}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
        opacity: isProcessing ? 0.7 : 1, transition: "all 0.25s ease",
        border: "none", color: "#fff", borderRadius: 12,
        background: baseGradient,
        boxShadow: variant === "primary" ? GRADIENTS.buttonGlow : "none",
        position: "relative", overflow: "hidden", whiteSpace: "nowrap", ...style,
      }}
      onMouseEnter={(e) => {
        if (!isProcessing) {
          e.currentTarget.style.background = hoverGradient;
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseGradient;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {isProcessing
        ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
        : <>{label}<ArrowRight size={16} /></>
      }
    </button>
  );
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function GstRegistrationLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<GstTypeId>("shops");
  const [showStartChoice, setShowStartChoice] = useState(false);
  const [isDraftChecking, setIsDraftChecking] = useState(false);
  const [hasMatchingDraft, setHasMatchingDraft] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(auth.currentUser?.uid || null);
  const searchParams = new URLSearchParams(location.search);
  const cameFromServiceRequirements = searchParams.get("returnTo") === "service-requirements";
  const returnServiceId = searchParams.get("serviceId");
  const returnTo = typeof location.state?.returnTo === "string"
    ? location.state.returnTo
    : cameFromServiceRequirements && returnServiceId
      ? `/services/${returnServiceId}/requirements${searchParams.get("type") ? `?type=${searchParams.get("type")}` : ""}`
      : "/services";
  const returnState = location.state?.returnState;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const preSelectedType = location.state?.preSelectedType;
    if (
      location.state?.requirementsConfirmed &&
      ["shops", "proprietorship", "partnership", "llp", "pvt_ltd"].includes(preSelectedType) &&
      activeTab !== preSelectedType
    ) {
      setActiveTab(preSelectedType);
    }
  }, [location.state, activeTab]);

  useEffect(() => {
    if (location.state?.requirementsConfirmed && location.state?.autoOpenStartChoice && !showStartChoice) {
      setShowStartChoice(true);
    }
  }, [location.state, showStartChoice]);

  useEffect(() => {
    let cancelled = false;

    const checkDraft = async () => {
      const uid = currentUserId;
      if (!uid) {
        setHasMatchingDraft(false);
        return;
      }

      setIsDraftChecking(true);
      try {
        const sharedSnap = await getDoc(doc(db, "drafts", `gst_${uid}`));
        const shared = sharedSnap.exists() ? sharedSnap.data() as any : null;
        const constitution = String(shared?.constitution || shared?.commonData?.constitution || "").toLowerCase();
        const servicePanelType = String(shared?.servicePanelType || shared?.routeState?.preSelectedType || "").toLowerCase();

        let matches = false;
        if (activeTab === "llp") {
          const llpSnap = await getDoc(doc(db, "drafts", `gst_llp_${uid}`));
          matches = llpSnap.exists() || constitution.includes("llp") || servicePanelType === "llp";
        } else if (activeTab === "pvt_ltd") {
          matches = constitution.includes("private") || servicePanelType === "pvt_ltd";
        } else if (activeTab === "partnership") {
          const partnershipSnap = await getDoc(doc(db, "drafts", `gst_partnership_${uid}`));
          matches = partnershipSnap.exists() || constitution.includes("partnership") || servicePanelType === "partnership";
        } else if (activeTab === "shops") {
          matches = servicePanelType === "shops";
        } else if (activeTab === "proprietorship") {
          matches = servicePanelType === "proprietorship" || (!servicePanelType && constitution.includes("proprietorship"));
        }

        if (!cancelled) setHasMatchingDraft(matches);
      } catch (err) {
        console.error("Failed to check GST draft availability:", err);
        if (!cancelled) setHasMatchingDraft(false);
      } finally {
        if (!cancelled) setIsDraftChecking(false);
      }
    };

    checkDraft();
    return () => { cancelled = true; };
  }, [activeTab, currentUserId]);

  const handleStartRegistration = () => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/gst-registration/requirements", {
        state: { preSelectedType: activeTab },
      });
      return;
    }
    setShowStartChoice(true);
  };

  const handleStartNew = () => {
    setIsProcessing(true);
    sessionStorage.setItem("gst_pre_selected_type", activeTab);
    sessionStorage.removeItem("gst_ignore_draft_after_submit");
    sessionStorage.setItem("gst_start_new_application", "true");
    sessionStorage.setItem("gst_start_at_common_step", "true");
    navigate(`/services/gst-registration/form?mode=new&type=${activeTab}`, {
      state: {
        verified: true,
        source: "start-new",
        preSelectedType: activeTab,
        startAtCommonStep: true,
        startNewApplication: true,
      },
    });
    setTimeout(() => setIsProcessing(false), 800);
  };

  const handleExistingDraft = () => {
    if (!hasMatchingDraft || isDraftChecking) return;
    setIsProcessing(true);
    sessionStorage.removeItem("gst_start_new_application");
    sessionStorage.removeItem("gst_start_at_common_step");
    sessionStorage.removeItem("gst_ignore_draft_after_submit");
    sessionStorage.setItem("gst_pre_selected_type", activeTab);
    navigate("/documents", { state: { defaultTab: "drafts" } });
    setTimeout(() => setIsProcessing(false), 800);
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const activeType = GST_TYPES.find((t) => t.id === activeTab)!;
  const activeDocGroups = TYPE_DOC_GROUPS[activeTab];
  const activeProcess = TYPE_PROCESS_STEPS[activeTab];
  const deliverables = [
    "GSTIN and government registration certificate",
    "ARN / filing acknowledgement",
    "GST portal login guidance",
    "CA verified filing summary",
  ];

  const steps = [
    { step: "01", title: "Share Details", desc: "Upload basic KYC and business documents", icon: FileText },
    { step: "02", title: "Expert Verification", desc: "Our CA experts validate & file your application", icon: ShieldCheck },
    { step: "03", title: "Get GSTIN", desc: `Receive your certificate in ${activeType.timeline}`, icon: CheckCircle2 },
  ];

  return (
    <div className="bg-background min-h-screen text-[#e2e8f0]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {showStartChoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-700 bg-slate-900 p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.12), transparent 55%)" }} />
            <div className="relative text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <FileText size={28} />
              </div>
              <h3 className="mb-2 text-2xl font-black uppercase tracking-tight text-white">GST Application</h3>
              <p className="mb-7 text-sm font-medium leading-6 text-slate-400">
                Choose how you want to continue.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleStartNew}
                  disabled={isProcessing}
                  className="w-full rounded-xl bg-orange-600 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 disabled:opacity-60"
                >
                  Start New Form
                </button>
                <button
                  type="button"
                  onClick={handleExistingDraft}
                  disabled={isProcessing || isDraftChecking || !hasMatchingDraft}
                  title={!hasMatchingDraft ? "No draft found for the selected GST type" : "Open your draft documents"}
                  className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-cyan-100 transition-all hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDraftChecking ? "Checking Draft..." : "Existing Draft Form"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartChoice(false)}
                  disabled={isProcessing}
                  className="w-full rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-all hover:text-white disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(2,12,27,0.95)",
        backdropFilter: "blur(24px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>
          {/* Top row: back + title + price */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <button
                onClick={() => navigate(returnTo, { state: returnState })}
                disabled={isProcessing}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "7px", cursor: "pointer",
                  color: "#6b7280", display: "flex", alignItems: "center",
                  transition: "all 0.2s", flexShrink: 0,
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{
                    color: "#60a5fa", fontSize: 16, fontWeight: 800,
                  }}>GST Registration</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: GRADIENTS.button, borderRadius: 20,
                    padding: "2px 8px", letterSpacing: "0.05em",
                  }}>GSTIN</span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 15,000+ businesses</p>
              </div>
            </div>

            {/* Price + CTA — hidden on very small, shown on sm+ */}
            <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, ...FREE_TEXT_STYLE }}>Free</div>
                <p style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                  + <span style={{ color: "#22d3ee" }}>Govt charges applicable</span>
                </p>
              </div>
              <PayBtn
                label="Start Now"
                style={{ padding: "10px 18px", fontSize: 13 }}
                onClick={handleStartRegistration}
                isProcessing={isProcessing}
              />
            </div>
          </div>

          {/* Mobile-only CTA bar */}
          <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
            <PayBtn
              label="Start GST Registration — Free"
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
              onClick={handleStartRegistration}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "16px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
          <CheckCircle2 size={24} color="#10b981" />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            This service is <span style={FREE_TEXT_STYLE}>FREE</span>. Only govt charges apply.
          </p>
        </div>
        {/* ── HERO ── */}
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 64, alignItems: "start" }}>

          {/* Left */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 20, padding: "5px 14px", marginBottom: 20,
            }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                India's Most Trusted GST Service
              </span>
            </div>

            <h1 style={{
              fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.15, margin: "0 0 14px", letterSpacing: "-0.03em",
            }}>
              Get GST Registered<br />
              <span style={{ display: "inline-block" }}>
                in 3 Simple Steps
              </span>
            </h1>

            <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.7, marginBottom: 28, maxWidth: 480 }}>
              We handle the complex paperwork and compliance while you focus on growing your business.
            </p>

            {/* Type Selector */}
            <div style={{ marginBottom: 24 }}>
              <p style={{
                fontSize: 11, fontWeight: 800,
                letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Building2 size={13} color="#ef4444" /> Choose Your Business Type
              </p>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(148,163,184,0.16)", borderRadius: 16,
                overflow: "hidden",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>
                {GST_TYPES.map((type, index) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveTab(type.id)}
                    style={{
                      padding: "13px 14px", borderRadius: activeTab === type.id ? 12 : 0,
                      border: "none",
                      borderRight: index % 2 === 0 && index !== GST_TYPES.length - 1 ? "1px solid rgba(148,163,184,0.12)" : "none",
                      borderBottom: index < GST_TYPES.length - (GST_TYPES.length % 2 === 0 ? 2 : 1) ? "1px solid rgba(148,163,184,0.12)" : "none",
                      cursor: "pointer", fontWeight: 700, fontSize: 12,
                      transition: "all 0.25s ease",
                      background: activeTab === type.id ? GRADIENTS.button : "transparent",
                      color: activeTab === type.id ? "#fff" : "#7c879a",
                      boxShadow: activeTab === type.id ? GRADIENTS.buttonGlow : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      margin: activeTab === type.id ? 4 : 0,
                      minHeight: 48,
                    }}
                  >
                    <type.icon size={13} />{type.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Free badge */}
            <div style={{
              background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)",
              borderRadius: 14, padding: "14px 18px", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <ShieldCheck size={20} color="#06b6d4" />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                Service Fee: <span style={FREE_TEXT_STYLE}>FREE</span>{" "}
                <span style={{ color: "#22d3ee", fontSize: 13 }}>+ Govt Charges Applicable</span>
              </p>
            </div>

            {/* Active type card */}
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14, padding: "16px 18px", marginBottom: 22,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(239,68,68,0.25)", flexShrink: 0,
                }}>
                  <activeType.icon size={16} color="#f97316" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{activeType.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: "#fff",
                      background: activeType.badgeColor, borderRadius: 20,
                      padding: "2px 8px", letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                      {activeType.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>{activeType.tagline}</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {activeType.highlights.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <CheckCircle2 size={13} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>{h}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
                {[
                  { label: "Timeline", value: activeType.timeline, color: "#60a5fa" },
                  { label: "Threshold", value: activeType.threshold, color: "#60a5fa" },
                  { label: "Registration", value: activeType.turnover, color: "#60a5fa" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, minWidth: 80 }}>
                    <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                    <p style={{ fontSize: 11, color, margin: 0, fontWeight: 700 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: <Clock size={13} color="#f97316" />, label: `${activeType.timeline} Turnaround` },
                { icon: <CreditCard size={13} color="#06b6d4" />, label: "No Hidden Charges" },
                { icon: <ShieldCheck size={13} color="#10b981" />, label: "CA Verified" },
              ].map(({ icon, label }, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "6px 12px", background: "rgba(255,255,255,0.03)",
                  borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  {icon}<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: How it Works */}
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 24, padding: 32, backdropFilter: "blur(16px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden",
          }}>
            <FreeCornerRibbon />
            <h3 style={{
              fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 6,
            }}>How it works</h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
              GST Registration — {activeType.label}
            </p>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", background: GRADIENTS.button,
                      border: "2px solid rgba(255,255,255,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, boxShadow: GRADIENTS.buttonGlow, zIndex: 1,
                    }}>
                      <item.icon size={18} color="#fff" />
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{
                        width: 2, height: 32,
                        background: "linear-gradient(to bottom, rgba(6,182,212,0.5), rgba(6,182,212,0.08))",
                        margin: "6px 0", borderRadius: 2,
                      }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < steps.length - 1 ? 20 : 0, paddingTop: 8, flex: 1 }}>
                    <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", display: "inline-block", }}>
                      STEP {item.step}
                    </span>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "4px 0" }}>{item.title}</h4>
                    <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 24,
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.2)",
              borderRadius: 14,
              padding: "16px 18px",
            }}>
              <p style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#22d3ee",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}>
                Deliverables
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deliverables.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.5 }}>•</span>
                    <span style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={handleRequestCallback}
                style={{
                  flex: 1, background: "transparent",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 12, padding: "12px 14px", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.25s",
                }}
              >
                <MessageCircle size={14} color="#f97316" />
                <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chat Us</span>
              </button>
              <PayBtn
                label="Avail Service"
                style={{ flex: 1, padding: "12px 14px", fontSize: 13, borderRadius: 12 }}
                onClick={handleStartRegistration}
                isProcessing={isProcessing}
              />
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 20,
              background: "rgba(6,182,212,0.06)", borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(6,182,212,0.15)",
            }}>
              {[{ v: "15K+", l: "GST Filed" }, { v: activeType.timeline, l: "Turnaround" }, { v: "99.9%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{
                  padding: "12px 8px", textAlign: "center",
                  borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none",
                }}>
                  <div style={{ fontSize: v.length > 7 ? 12 : 16, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PROCESS STEPS ── */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Filing Process</p>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 12px" }}>
              GST Filing Steps — {activeType.shortLabel}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              End-to-end process from document collection to GSTIN issuance
            </p>
          </div>
          <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {activeProcess.map((item, i) => (
              <div key={i}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14, padding: "18px 16px", transition: "all 0.25s",
                  position: "relative", overflow: "hidden",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${item.color}40`; e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ fontSize: 26, fontWeight: 900, color: item.color, opacity: 0.2, position: "absolute", top: 10, right: 14, lineHeight: 1, pointerEvents: "none" }}>{item.num}</div>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${item.color}20`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: item.color }}>{item.num}</span>
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>{item.title}</h4>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── DOCUMENTS ── */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Checklist</p>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 12px" }}>
              Documents Required — {activeType.shortLabel}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
              Keep these ready in digital format (PDF or JPG) for a smooth application.
            </p>
          </div>

          <div className="doc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {activeDocGroups.map((group) => (
              <div key={group.id}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 18, padding: 22, transition: "all 0.25s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* ✅ Fixed: removed duplicate nested div */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0,
                  }}>
                    <group.icon size={17} color="#f97316" />
                  </div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{group.label}</h4>
                </div>

                <div className="doc-items-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {group.keys.map((docKey) => {
                    const Icon = getIconForDoc(docKey);
                    return (
                      <div key={docKey}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 10, padding: "9px 10px", transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      >
                        <Icon size={13} color="#f97316" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "#d1d5db", fontWeight: 500, lineHeight: 1.3 }}>{GST_DOCUMENTS[docKey]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        <div className="stats-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, overflow: "hidden", marginBottom: 64,
        }}>
          {[
            { value: "15,000+", label: "GST Filed" },
            { value: activeType.timeline, label: "Turnaround" },
            { value: "99.9%", label: "Success Rate" },
            { value: "FREE", label: "Service Fee" },
          ].map(({ value, label }, i) => (
            <div key={i} style={{
              padding: "22px 12px", textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}>
              <div style={{
                fontSize: value.length > 8 ? 16 : 24,
                fontWeight: 800,
                ...(value === "FREE"
                  ? FREE_TEXT_STYLE
                  : { background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }),
                marginBottom: 6,
              }}>{value}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── TURNOVER GUIDE ── */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Quick Reference</p>
            <h2 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, color: "#fff", margin: 0 }}>
              GST Turnover Thresholds & Applicability
            </h2>
          </div>
          <div className="compare-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {[
              { title: "Services (All Entities)", threshold: "₹20 Lakhs", note: "Mandatory registration if aggregate turnover exceeds ₹20L in a financial year", color: "#60a5fa", icon: <Briefcase size={15} color="#f97316" /> },
              { title: "Goods (All Entities)", threshold: "₹40 Lakhs", note: "Mandatory registration if aggregate turnover in goods business exceeds ₹40L per year", color: "#60a5fa", icon: <Building2 size={15} color="#06b6d4" /> },
              { title: "Special Category States", threshold: "₹10 Lakhs", note: "Lower threshold applies to NE states, Uttarakhand, HP — both goods & services", color: "#60a5fa", icon: <Landmark size={15} color="#10b981" /> },
              { title: "Voluntary Registration", threshold: "Any Turnover", note: "Any business can voluntarily register for GST to avail ITC benefits & build B2B credibility", color: "#60a5fa", icon: <BadgeCheck size={15} color="#8b5cf6" /> },
            ].map((row, i) => (
              <div key={i}
                style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "16px 18px", transition: "all 0.2s",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${row.color}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${row.color}18`, border: `1px solid ${row.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.icon}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{row.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: row.color }}>{row.threshold}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{row.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{
          position: "relative", borderRadius: 24, overflow: "hidden",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
          padding: "40px 20px", textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, color: "#fff", marginBottom: 14, lineHeight: 1.2 }}>
            Ready to make your {activeType.shortLabel} business{" "}
            <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>compliant?</span>
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 36, maxWidth: 500, margin: "0 auto 36px", lineHeight: 1.7 }}>
            Join 15,000+ businesses who trusted RegiBIZ for their GST registration.
          </p>
          <PayBtn
            label={`Start ${activeType.shortLabel} GST Registration — FREE`}
            variant="primary"
            style={{ borderRadius: 14, padding: "14px 20px", fontSize: 14, maxWidth: "50%", width: "50%" }}
            onClick={handleStartRegistration}
            isProcessing={isProcessing}
          />
          <p style={{ fontSize: 12, color: "#4b5563", marginTop: 18, fontWeight: 500 }}>
            <span style={{ color: "#60a5fa" }}>✓</span> Secure & confidential &nbsp;•&nbsp;
            <span style={{ color: "#60a5fa" }}>✓</span> No hidden charges &nbsp;•&nbsp;
            <span style={{ color: "#60a5fa" }}>✓</span> CA verified filing
          </p>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 56, paddingTop: 28, paddingBottom: 28, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .doc-items-grid { grid-template-columns: 1fr !important; }
          .process-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .compare-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div:nth-child(2) { border-right: none !important; }
          .stats-grid > div:nth-child(1),
          .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .header-cta { display: none !important; }
          .mobile-cta-bar { display: block !important; }
          .mobile-cta-bar button { width: 100% !important; font-size: 13px !important; padding: 12px 12px !important; }
        }
          .

        @media (min-width: 641px) and (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .doc-items-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .process-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .compare-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
