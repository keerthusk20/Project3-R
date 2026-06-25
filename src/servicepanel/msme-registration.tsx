import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Landmark,
  User,
  Building2,
  ArrowRight,
  Phone,
  ShieldCheck,
  Clock,
  ChevronLeft,
  Loader2,
  Star,
  BadgeCheck,
  MapPin,
  Users,
  Scale,
  UserCheck,
  Briefcase,
  Award,
  MessageCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG } from "../data/pricingConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "aadhaarCard" | "panCard" | "addressProof" | "businessRegistration"
  | "promoterPhoto" | "identityProof" | "contactDetails"
  | "cancelledCheque" | "bankAccountProof" | "ifscCode"
  | "rentAgreement" | "nocFromOwner" | "utilityBill" | "tradeLicense"
  | "companyCoi" | "companyMoa" | "companyAoa" | "companyPan"
  | "llpAgreement" | "llpPan" | "llpCoi"
  | "partnershipDeed" | "partnershipPan" | "partnerAadhaar"
  | "proprietorPan" | "proprietorAadhaar" | "shopAct";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}

// ─────────────────────────────────────────────
// DOCUMENT DATA
// ─────────────────────────────────────────────
const MSME_DOCUMENTS: Record<DocKey, string> = {
  aadhaarCard: "Aadhaar Card (Director / Partner)",
  panCard: "PAN Card of Business / Proprietor",
  addressProof: "Proof of Business Address",
  businessRegistration: "Business Registration Proof",
  promoterPhoto: "Photograph of Proprietor / Director",
  identityProof: "Identity Proof (Aadhaar / PAN / Voter ID)",
  contactDetails: "Contact Details (Mobile & Email)",
  cancelledCheque: "Cancelled Cheque",
  bankAccountProof: "Bank Account Proof",
  ifscCode: "IFSC Code & Bank Passbook",
  rentAgreement: "Rent / Lease Agreement",
  nocFromOwner: "NOC from Property Owner",
  utilityBill: "Utility Bill (Electricity / Water / Gas)",
  tradeLicense: "Municipal Trade License",
  companyPan: "Company PAN Card",
  companyCoi: "Certificate of Incorporation (COI)",
  companyMoa: "Memorandum of Association (MOA)",
  companyAoa: "Articles of Association (AOA)",
  llpPan: "LLP PAN Card",
  llpAgreement: "LLP Agreement",
  llpCoi: "LLP Certificate of Incorporation",
  partnershipDeed: "Partnership Deed",
  partnershipPan: "Firm PAN Card",
  partnerAadhaar: "Aadhaar of All Partners",
  proprietorPan: "Proprietor PAN Card",
  proprietorAadhaar: "Proprietor Aadhaar Card",
  shopAct: "Shop & Establishment Certificate",
};

// ── Per-type document groups ─────────────────
const PVT_GROUPS: DocumentGroup[] = [
  {
    id: "company",
    label: "Company Documents",
    icon: Building2,
    keys: ["companyPan", "companyCoi", "companyMoa", "companyAoa"],
  },
  {
    id: "promoter",
    label: "Director / Promoter",
    icon: User,
    keys: ["aadhaarCard", "promoterPhoto", "identityProof", "contactDetails"],
  },
  {
    id: "bank",
    label: "Bank Details",
    icon: Landmark,
    keys: ["cancelledCheque", "bankAccountProof", "ifscCode"],
  },
  {
    id: "address",
    label: "Address Proof",
    icon: MapPin,
    keys: ["utilityBill", "nocFromOwner", "rentAgreement", "tradeLicense"],
  },
];

const PROP_GROUPS: DocumentGroup[] = [
  {
    id: "proprietor",
    label: "Proprietor Identity",
    icon: UserCheck,
    keys: ["proprietorPan", "proprietorAadhaar", "promoterPhoto", "shopAct"],
  },
  {
    id: "business",
    label: "Business Details",
    icon: Briefcase,
    keys: ["businessRegistration", "tradeLicense", "contactDetails", "addressProof"],
  },
  {
    id: "bank",
    label: "Bank Details",
    icon: Landmark,
    keys: ["cancelledCheque", "bankAccountProof", "ifscCode"],
  },
  {
    id: "address",
    label: "Address Proof",
    icon: MapPin,
    keys: ["utilityBill", "nocFromOwner", "rentAgreement"],
  },
];

const LLP_GROUPS: DocumentGroup[] = [
  {
    id: "llp",
    label: "LLP Documents",
    icon: Scale,
    keys: ["llpPan", "llpAgreement", "llpCoi", "businessRegistration"],
  },
  {
    id: "partner",
    label: "Designated Partners",
    icon: User,
    keys: ["aadhaarCard", "promoterPhoto", "identityProof", "contactDetails"],
  },
  {
    id: "bank",
    label: "Bank Details",
    icon: Landmark,
    keys: ["cancelledCheque", "bankAccountProof", "ifscCode"],
  },
  {
    id: "address",
    label: "Address Proof",
    icon: MapPin,
    keys: ["utilityBill", "nocFromOwner", "rentAgreement", "tradeLicense"],
  },
];

const PARTNER_GROUPS: DocumentGroup[] = [
  {
    id: "firm",
    label: "Partnership Firm",
    icon: Users,
    keys: ["partnershipDeed", "partnershipPan", "businessRegistration", "shopAct"],
  },
  {
    id: "partners",
    label: "Partners' Documents",
    icon: User,
    keys: ["partnerAadhaar", "promoterPhoto", "identityProof", "contactDetails"],
  },
  {
    id: "bank",
    label: "Bank Details",
    icon: Landmark,
    keys: ["cancelledCheque", "bankAccountProof", "ifscCode"],
  },
  {
    id: "address",
    label: "Address Proof",
    icon: MapPin,
    keys: ["utilityBill", "nocFromOwner", "rentAgreement", "tradeLicense"],
  },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (["companyPan", "llpPan", "proprietorPan", "partnershipPan", "panCard", "businessRegistration", "companyCoi", "companyMoa", "companyAoa", "llpAgreement", "llpCoi", "partnershipDeed", "shopAct"].includes(key)) return FileText;
  if (["cancelledCheque", "bankAccountProof", "ifscCode"].includes(key)) return Landmark;
  if (["promoterPhoto", "proprietorAadhaar", "partnerAadhaar", "aadhaarCard", "identityProof"].includes(key)) return User;
  if (["addressProof", "rentAgreement", "nocFromOwner", "utilityBill", "tradeLicense"].includes(key)) return MapPin;
  if (["contactDetails"].includes(key)) return Phone;
  return FileText;
};

// ─────────────────────────────────────────────
// COLOR CONSTANTS
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

// ─────────────────────────────────────────────
// ENTITY TYPE DATA
// ─────────────────────────────────────────────
type EntityTypeId = "pvt_ltd" | "proprietorship" | "llp" | "partnership";

const ENTITY_TYPES: {
  id: EntityTypeId;
  label: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  tagline: string;
  highlights: string[];
  timeline: string;
  category: string;
  benefit: string;
}[] = [
    {
      id: "pvt_ltd",
      label: "Private Limited Company",
      shortLabel: "Pvt Ltd",
      badge: "Most Common",
      badgeColor: "#f97316",
      icon: Building2,
      tagline: "Udyam Registration for incorporated companies",
      highlights: [
        "COI, MOA, AOA & Company PAN required",
        "Director's Aadhaar used as primary identity",
        "Classified as Micro, Small or Medium based on turnover",
        "Enables access to government procurement portals",
        "Priority sector lending & collateral-free loans",
      ],
      timeline: "3–5 Days",
      category: "Micro / Small / Medium",
      benefit: "Priority lending & govt tenders",
    },
    {
      id: "proprietorship",
      label: "Sole Proprietorship",
      shortLabel: "Proprietorship",
      badge: "Simplest",
      badgeColor: "#10b981",
      icon: UserCheck,
      tagline: "Udyam Registration for individual business owners",
      highlights: [
        "Only Aadhaar & PAN of proprietor needed",
        "No separate company documents required",
        "Shop & Establishment certificate recommended",
        "Fastest and easiest MSME registration type",
        "Self-employed, traders & small businesses",
      ],
      timeline: "2–4 Days",
      category: "Micro / Small",
      benefit: "Subsidies & scheme eligibility",
    },
    {
      id: "llp",
      label: "Limited Liability Partnership",
      shortLabel: "LLP",
      badge: "Professional",
      badgeColor: "#06b6d4",
      icon: Scale,
      tagline: "Udyam Registration for LLP firms",
      highlights: [
        "LLP PAN, Agreement & COI are mandatory",
        "Designated Partners' Aadhaar required",
        "Eligible for MSME credit guarantee schemes",
        "Preferred for professional service firms",
        "Lower compliance burden post registration",
      ],
      timeline: "3–5 Days",
      category: "Micro / Small / Medium",
      benefit: "Credit guarantee & lower interest",
    },
    {
      id: "partnership",
      label: "Partnership Firm",
      shortLabel: "Partnership",
      badge: "Traditional",
      badgeColor: "#8b5cf6",
      icon: Users,
      tagline: "Udyam Registration for partnership firms",
      highlights: [
        "Partnership Deed & firm PAN are mandatory",
        "All partners' Aadhaar documents required",
        "Works for both registered & unregistered firms",
        "Access government subsidies & MSME schemes",
        "Eligible for credit-linked capital subsidy",
      ],
      timeline: "3–5 Days",
      category: "Micro / Small / Medium",
      benefit: "CLCSS subsidy & scheme access",
    },
  ];

const TYPE_DOC_GROUPS: Record<EntityTypeId, DocumentGroup[]> = {
  pvt_ltd: PVT_GROUPS,
  proprietorship: PROP_GROUPS,
  llp: LLP_GROUPS,
  partnership: PARTNER_GROUPS,
};

const TYPE_PROCESS_STEPS: Record<EntityTypeId, { num: string; title: string; desc: string; color: string }[]> = {
  pvt_ltd: [
    { num: "01", title: "Collect Director KYC", desc: "Aadhaar & PAN of all directors — Aadhaar is the primary identity on Udyam portal", color: "#60a5fa" },
    { num: "02", title: "Company Documents", desc: "COI, MOA, AOA and Company PAN needed to verify legal entity status", color: "#60a5fa" },
    { num: "03", title: "Business Classification", desc: "Classify as Micro, Small or Medium based on investment & annual turnover", color: "#60a5fa" },
    { num: "04", title: "Udyam Portal Filing", desc: "Application filed on Udyam Registration Portal using Aadhaar OTP verification", color: "#60a5fa" },
    { num: "05", title: "NIC Code Selection", desc: "National Industrial Classification code selected for primary business activity", color: "#60a5fa" },
    { num: "06", title: "Udyam Certificate", desc: "Udyam Registration Certificate with unique Udyam Number issued — lifetime valid", color: "#60a5fa" },
  ],
  proprietorship: [
    { num: "01", title: "Proprietor KYC", desc: "Proprietor's Aadhaar and PAN — Aadhaar OTP verification is mandatory", color: "#60a5fa" },
    { num: "02", title: "Business Proof", desc: "Shop & Establishment certificate or any trade name / business proof", color: "#60a5fa" },
    { num: "03", title: "Business Classification", desc: "Classify as Micro or Small based on investment in plant & annual turnover", color: "#60a5fa" },
    { num: "04", title: "Udyam Portal Filing", desc: "Simplest and quickest filing — no complex entity documents needed", color: "#60a5fa" },
    { num: "05", title: "NIC Code Selection", desc: "Select appropriate NIC code for your trade / service / manufacturing activity", color: "#60a5fa" },
    { num: "06", title: "Udyam Certificate", desc: "Certificate issued within 2–4 days — Udyam Number is permanent & lifetime valid", color: "#60a5fa" },
  ],
  llp: [
    { num: "01", title: "LLP Documents", desc: "LLP PAN, LLP Agreement and Certificate of Incorporation from MCA portal", color: "#60a5fa" },
    { num: "02", title: "Designated Partner KYC", desc: "Aadhaar of all Designated Partners — Aadhaar OTP verification on portal", color: "#60a5fa" },
    { num: "03", title: "Business Classification", desc: "Classify LLP as Micro, Small or Medium based on investment & turnover", color: "#60a5fa" },
    { num: "04", title: "Udyam Portal Filing", desc: "Application filed on Udyam portal with LLP entity & partner Aadhaar details", color: "#60a5fa" },
    { num: "05", title: "NIC Code Selection", desc: "Select NIC code matching the LLP's primary professional / business activity", color: "#60a5fa" },
    { num: "06", title: "Udyam Certificate", desc: "Udyam Certificate with unique number issued — no renewal required", color: "#60a5fa" },
  ],
  partnership: [
    { num: "01", title: "Partnership Deed", desc: "Registered or notarised Partnership Deed with all partners listed clearly", color: "#60a5fa" },
    { num: "02", title: "Firm & Partner KYC", desc: "Firm PAN and Aadhaar of all partners — Aadhaar OTP required per partner", color: "#60a5fa" },
    { num: "03", title: "Business Classification", desc: "Classify firm as Micro, Small or Medium based on investment & annual turnover", color: "#60a5fa" },
    { num: "04", title: "Udyam Portal Filing", desc: "Application submitted with firm details and partner Aadhaar verifications", color: "#60a5fa" },
    { num: "05", title: "NIC Code Selection", desc: "Select NIC code for the firm's primary business / trade / manufacturing activity", color: "#60a5fa" },
    { num: "06", title: "Udyam Certificate", desc: "Certificate issued within 3–5 days — valid for lifetime, no renewal needed", color: "#60a5fa" },
  ],
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function MsmeRegistrationLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<EntityTypeId>("pvt_ltd");
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
      ["pvt_ltd", "proprietorship", "llp", "partnership"].includes(preSelectedType) &&
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
        const snap = await getDoc(doc(db, "drafts", `msme_${uid}`));
        const draft = snap.exists() ? snap.data() as any : null;
        const draftOrgType = String(draft?.formData?.orgType || draft?.orgType || "").toLowerCase();
        const expectedOrgType = activeTab === "pvt_ltd" ? "pvtltd" : activeTab;
        const matches = draft?.status === "draft" && draftOrgType === expectedOrgType;
        if (!cancelled) setHasMatchingDraft(Boolean(matches));
      } catch (err) {
        console.error("Failed to check MSME draft availability:", err);
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
      navigate("/services/msme-registration/requirements", {
        state: { preSelectedType: activeTab },
      });
      return;
    }
    setShowStartChoice(true);
  };

  const handleStartNew = () => {
    setIsProcessing(true);
    const userContext = {
      name: localStorage.getItem("userName") || "",
      email: localStorage.getItem("userEmail") || "",
      phone: localStorage.getItem("userPhone") || "",
      timestamp: new Date().toISOString(),
    };
    sessionStorage.setItem("msme_user_context", JSON.stringify(userContext));
    sessionStorage.setItem("msme_start_new_application", "true");
    sessionStorage.removeItem("msme_ignore_draft_after_submit");
    navigate(`/services/msme-registration/form?mode=new&type=${activeTab}`, {
      state: {
        verified: true,
        source: "start-new",
        preSelectedType: activeTab,
        startNewApplication: true,
      },
    });
    setTimeout(() => setIsProcessing(false), 800);
  };

  const handleExistingDraft = () => {
    if (!hasMatchingDraft || isDraftChecking) return;
    setIsProcessing(true);
    sessionStorage.removeItem("msme_start_new_application");
    sessionStorage.removeItem("msme_ignore_draft_after_submit");
    sessionStorage.setItem("msme_pre_selected_type", activeTab);
    navigate("/documents", { state: { defaultTab: "drafts" } });
    setTimeout(() => setIsProcessing(false), 800);
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const activeType = ENTITY_TYPES.find((t) => t.id === activeTab)!;
  const activeDocGroups = TYPE_DOC_GROUPS[activeTab];
  const activeProcess = TYPE_PROCESS_STEPS[activeTab];

  const steps = [
    { step: "01", title: "Share Details", desc: "Upload basic KYC and business documents", icon: FileText },
    { step: "02", title: "Expert Verification", desc: "Our CA experts validate & file your Udyam application", icon: ShieldCheck },
    { step: "03", title: "Get Udyam Number", desc: `Receive your certificate in ${activeType.timeline}`, icon: CheckCircle2 },
  ];

  const stats = [
    { value: "12,000+", label: "Udyam Filed" },
    { value: activeType.timeline, label: "Turnaround" },
    { value: "100%", label: "Success Rate" },
    { value: `₹${PRICING_CONFIG["msme"].fee.toLocaleString()}`, label: "Service Fee" },
  ];

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
        {isProcessing ? (
          <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
        ) : (
          <>{label}<ArrowRight size={16} /></>
        )}
      </button>
    );
  };

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
              <h3 className="mb-2 text-2xl font-black uppercase tracking-tight text-white">MSME Application</h3>
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
                  title={!hasMatchingDraft ? "No draft found for the selected MSME type" : "Open your draft documents"}
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
                  }}>MSME Registration</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: GRADIENTS.button, borderRadius: 20,
                    padding: "2px 8px", letterSpacing: "0.05em",
                  }}>UDYAM</span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 10,000+ businesses</p>
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
              label={`Start MSME Registration — Free`}
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
              onClick={handleStartRegistration}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>
        {/* FREE HIGHLIGHT BANNER */}
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "16px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
          <CheckCircle2 size={24} color="#10b981" />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            This service is <span style={FREE_TEXT_STYLE}>FREE</span>. Only govt charges apply.
          </p>
        </div>

        {/* ── HERO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 72, alignItems: "start" }} className="hero-grid">

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "5px 14px", marginBottom: 24, boxShadow: "0 0 20px rgba(239,68,68,0.15)" }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>India's Most Trusted MSME Service</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px, 6vw, 44px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              Get MSME Registered<br />
              <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>in 3 Simple Steps</span>
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
              We handle the Udyam portal filing and compliance while you focus on growing your business. Get your Udyam Registration Certificate fast — for any type of business entity.
            </p>

            {/* ── TYPE SELECTOR TABS ── */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={13} color="#ef4444" /> Choose Your Business Type
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
                {ENTITY_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setActiveTab(type.id)}
                    style={{
                      padding: "10px 14px", borderRadius: 10, border: "none",
                      cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all 0.25s ease",
                      background: activeTab === type.id ? GRADIENTS.button : "transparent",
                      color: activeTab === type.id ? "#fff" : "#6b7280",
                      boxShadow: activeTab === type.id ? GRADIENTS.buttonGlow : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}
                  >
                    <type.icon size={13} />
                    {type.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* ── ACTIVE TYPE CARD ── */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "18px 20px", marginBottom: 28, transition: "all 0.3s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <activeType.icon size={16} color="#f97316" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{activeType.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: activeType.badgeColor, borderRadius: 20, padding: "2px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {activeType.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 1 }}>{activeType.tagline}</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
                {activeType.highlights.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <CheckCircle2 size={13} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>{h}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Timeline", value: activeType.timeline, color: "#60a5fa" },
                  { label: "Category", value: activeType.category, color: "#60a5fa" },
                  { label: "Key Benefit", value: activeType.benefit, color: "#60a5fa" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                    <p style={{ fontSize: 11, color, margin: 0, fontWeight: 700 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { icon: <Clock size={13} color="#f97316" />, label: `${activeType.timeline} Turnaround` },
                { icon: <ShieldCheck size={13} color="#10b981" />, label: "Data Encrypted" },
                { icon: <BadgeCheck size={13} color="#06b6d4" />, label: "CA Verified" },
              ].map(({ icon, label }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                  {icon}<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: How it Works */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 36, backdropFilter: "blur(16px)", boxShadow: "0 8px 40px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, padding: "1px", background: GRADIENTS.button, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.4 }} />
            <FreeCornerRibbon />
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 8, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", }}>How it works</h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 28 }}>
              Udyam Registration — {activeType.label}
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 18, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: GRADIENTS.button, border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: GRADIENTS.buttonGlow, position: "relative", zIndex: 1 }}>
                      <item.icon size={20} color="#fff" />
                    </div>
                    {i < steps.length - 1 && <div style={{ width: 2, height: 36, background: "linear-gradient(to bottom, rgba(6,182,212,0.5), rgba(6,182,212,0.08))", margin: "8px 0", borderRadius: 2 }} />}
                  </div>
                  <div style={{ paddingBottom: i < steps.length - 1 ? 24 : 0, paddingTop: 10, flex: 1 }}>
                    <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", display: "inline-block", }}>STEP {item.step}</span>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "6px 0" }}>{item.title}</h4>
                    <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{
              marginTop: 18,
              padding: "14px 14px",
              borderRadius: 12,
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.2)",
            }}>
              <p style={{
                margin: "0 0 8px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#22d3ee",
              }}>
                Deliverables
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Udyam Registration Certificate with unique Udyam Number
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Lifetime validity — no renewal needed
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
              <button onClick={handleRequestCallback} disabled={isProcessing}
                style={{ flex: 1, background: "transparent", border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1, borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s" }}
                onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <MessageCircle size={14} color="#f97316" />
                <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chat Us</span>
              </button>
              <PayBtn
                label="Avail Service"
                style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }}
                onClick={handleStartRegistration}
                isProcessing={isProcessing}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[{ v: "10K+", l: "MSME Filed" }, { v: activeType.timeline, l: "Turnaround" }, { v: "99.8%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none" }}>
                  <div style={{ fontSize: v.length > 7 ? 13 : 17, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── UDYAM PROCESS STEPS ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Filing Process</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>
              Udyam Filing Steps — {activeType.shortLabel}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              End-to-end process from document collection to Udyam Certificate issuance
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="process-grid">
            {activeProcess.map((item, i) => (
              <div key={i}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 18px", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${item.color}40`; e.currentTarget.style.background = `${item.color}08`; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: item.color, opacity: 0.2, position: "absolute", top: 12, right: 16, lineHeight: 1, pointerEvents: "none" }}>{item.num}</div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}20`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: item.color }}>{item.num}</span>
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>{item.title}</h4>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── DOCUMENTS SECTION ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Checklist</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>
              Documents Required — {activeType.shortLabel}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Keep these ready in digital format (PDF or JPG) for a smooth Udyam registration process.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 22 }} className="doc-grid">
            {activeDocGroups.map((group) => (
              <div key={group.id}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 26, transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, position: "relative", zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0 }}>
                    <group.icon size={18} color="#f97316" />
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{group.label}</h4>
                </div>
                <div className="doc-items-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>

                  {group.keys.map((docKey) => {
                    const Icon = getIconForDoc(docKey);
                    return (
                      <div key={docKey}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", transition: "all 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}>
                        <Icon size={14} color="#f97316" />
                        <span style={{ fontSize: 12, color: "#d1d5db", fontWeight: 500 }}>{MSME_DOCUMENTS[docKey]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden", marginBottom: 72, padding: "4px", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 20, padding: "1px", background: GRADIENTS.heading, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.3 }} />
          {stats.map(({ value, label }, i) => (
            <div key={i} style={{ padding: "26px 12px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: value.length > 8 ? 16 : 24, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 }}>{value}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── MSME CLASSIFICATION GUIDE ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Quick Reference</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>MSME Classification — Investment & Turnover Limits</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="classification-grid">
            {[
              { title: "Micro Enterprise", investment: "≤ ₹1 Crore", turnover: "≤ ₹5 Crore", color: "#60a5fa", icon: <UserCheck size={15} color="#10b981" />, note: "Eligible for maximum government scheme benefits, subsidies & priority lending" },
              { title: "Small Enterprise", investment: "≤ ₹10 Crore", turnover: "≤ ₹50 Crore", color: "#60a5fa", icon: <Building2 size={15} color="#f97316" />, note: "Access to credit guarantee schemes, government tenders & export promotion" },
              { title: "Medium Enterprise", investment: "≤ ₹50 Crore", turnover: "≤ ₹250 Crore", color: "#60a5fa", icon: <Briefcase size={15} color="#06b6d4" />, note: "Eligible for CLCSS, technology upgradation schemes & institutional finance" },
            ].map((row, i) => (
              <div key={i}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 18px", transition: "all 0.2s", position: "relative", overflow: "hidden" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${row.color}35`; e.currentTarget.style.background = `${row.color}06`; e.currentTarget.style.transform = "translateY(-3px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${row.color}18`, border: `1px solid ${row.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.icon}</div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{row.title}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Investment</span>
                    <span style={{ fontSize: 13, color: row.color, fontWeight: 800 }}>{row.investment}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Annual Turnover</span>
                    <span style={{ fontSize: 13, color: row.color, fontWeight: 800 }}>{row.turnover}</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{row.note}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "14px 20px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Award size={16} color="#10b981" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "#6ee7b7", margin: 0, lineHeight: 1.6 }}>
              <strong>Note:</strong> Classification is based on <strong>composite criteria</strong> — both investment in plant & machinery AND annual turnover. If a business crosses either limit, it moves to the next category. Udyam Registration is free on the government portal and valid for lifetime — no renewal required.
            </p>
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "40px 20px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
              Ready to get your {activeType.shortLabel} business{" "}
              <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>Udyam certified?</span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>
              Join 10,000+ businesses who trusted RegiBIZ for their MSME / Udyam registration.
            </p>
            <PayBtn
              label={`Start ${activeType.shortLabel} Udyam - Free`}
              variant="primary"
              style={{ borderRadius: 14, padding: "14px 24px", fontSize: 14, maxWidth: "50%", boxShadow: "0 10px 40px rgba(239,68,68,0.35)" }}
              onClick={handleStartRegistration}
              isProcessing={isProcessing}
            />
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 20, fontWeight: 500 }}>
              <span style={{ color: "#60a5fa" }}>✓</span> No hidden charges &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> Lifetime valid certificate &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> CA verified filing
            </p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 72, paddingTop: 36, paddingBottom: 36, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .process-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .classification-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div { border-right: 1px solid rgba(255,255,255,0.08) !important; }
          .stats-grid > div:nth-child(2n) { border-right: none !important; }
          .stats-grid > div:nth-child(1),
          .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .header-cta { display: none !important; }
          .mobile-cta-bar { display: block !important; }
          .doc-items-grid { grid-template-columns: 1fr !important; }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .compare_grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
