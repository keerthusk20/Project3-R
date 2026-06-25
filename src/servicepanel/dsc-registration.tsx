// src/servicepanel/dsc-registration.tsx
import React, { useState } from "react";
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
  Key,
  Globe,
  Lock,
  AlertCircle,
  Users,
  Briefcase,
  UserCheck,
  Scale,
  MessageCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST } from "../data/pricingConfig";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "identityProof" | "addressProof" | "panCard" | "photo"
  | "companyPan" | "coi" | "boardResolution" | "gstCert"
  | "ieCode" | "dgftDoc" | "authorisationLetter" | "llpAgreement"
  | "partnershipDeed" | "aadhaarCard" | "orgAddressProof"
  | "dgftRegCert" | "iecCertificate" | "importerExporterDecl";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}
// ─────────────────────────────────────────────
// DOCUMENT DATA
// ─────────────────────────────────────────────
const DSC_DOCUMENTS: Record<DocKey, string> = {
  identityProof: "Identity Proof (Aadhaar / Passport / Voter ID)",
  addressProof: "Address Proof (Aadhaar / Utility Bill / Bank Stmt)",
  panCard: "PAN Card (Mandatory)",
  photo: "Passport Size Photograph",
  aadhaarCard: "Aadhaar Card",
  companyPan: "Company / LLP / Firm PAN Card",
  coi: "Certificate of Incorporation (COI)",
  boardResolution: "Board Resolution / Authorization Letter",
  gstCert: "GST Certificate (if applicable)",
  authorisationLetter: "Authorisation Letter from Organisation",
  llpAgreement: "LLP Agreement (for LLP entities)",
  partnershipDeed: "Partnership Deed (for Partnership Firms)",
  orgAddressProof: "Organisation Address Proof",
  ieCode: "IEC (Importer Exporter Code) Certificate",
  dgftDoc: "DGFT Registration / Portal Proof",
  dgftRegCert: "DGFT Registration Certificate",
  iecCertificate: "IEC Certificate from DGFT Portal",
  importerExporterDecl: "Importer / Exporter Declaration",
};

// ─────────────────────────────────────────────
// DSC TYPES
// ─────────────────────────────────────────────
type DscTypeId = "individual" | "organization" | "dgft";

const DSC_TYPES: {
  id: DscTypeId;
  label: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  tagline: string;
  highlights: string[];
  timeline: string;
  validity: string;
  useCases: string;
}[] = [
    {
      id: "individual",
      label: "Individual DSC",
      shortLabel: "Individual",
      badge: "Most Common",
      badgeColor: "#f97316",
      icon: UserCheck,
      tagline: "For salaried professionals, freelancers & self-employed",
      highlights: [
        "Valid for Income Tax e-filing & MCA e-forms",
        "Used for signing legal contracts & agreements digitally",
        "PAN & Aadhaar are the primary identity documents",
        "Fastest issuance — Video KYC in 5 minutes",
        "Class 3 DSC: highest security level for individuals",
      ],
      timeline: "1–2 Days",
      validity: "1 / 2 / 3 Years",
      useCases: "Income Tax, MCA, Tenders",
    },
    {
      id: "organization",
      label: "Organisation DSC",
      shortLabel: "Organisation",
      badge: "For Businesses",
      badgeColor: "#06b6d4",
      icon: Building2,
      tagline: "For Pvt Ltd, LLP, Partnership Firms & Trusts",
      highlights: [
        "Issued to authorised signatory of the organisation",
        "Mandatory for GST, MCA filings & e-tendering",
        "COI / Partnership Deed / LLP Agreement required",
        "Board Resolution or Authorisation Letter needed",
        "Used for bulk signing of invoices, agreements & ROC forms",
      ],
      timeline: "2–3 Days",
      validity: "1 / 2 / 3 Years",
      useCases: "GST, MCA, ROC, Tenders",
    },
    {
      id: "dgft",
      label: "DGFT DSC",
      shortLabel: "DGFT",
      badge: "Export / Import",
      badgeColor: "#8b5cf6",
      icon: Globe,
      tagline: "Mandatory for importers & exporters on DGFT portal",
      highlights: [
        "Exclusively required for DGFT portal transactions",
        "Mandatory to update / modify IEC (Importer Exporter Code)",
        "Used for EXIM (Export-Import) licence applications",
        "IEC Certificate & DGFT Registration proof mandatory",
        "Covers both individual & organisation DGFT applicants",
      ],
      timeline: "2–3 Days",
      validity: "1 / 2 / 3 Years",
      useCases: "DGFT Portal, IEC, EXIM",
    },
  ];

// ─────────────────────────────────────────────
// DOCUMENT GROUPS PER TYPE
// ─────────────────────────────────────────────
const INDIVIDUAL_GROUPS: DocumentGroup[] = [
  {
    id: "kyc",
    label: "Identity & KYC",
    icon: User,
    keys: ["identityProof", "aadhaarCard", "panCard", "photo"],
  },
  {
    id: "address",
    label: "Address Proof",
    icon: FileText,
    keys: ["addressProof"],
  },
];

const ORGANISATION_GROUPS: DocumentGroup[] = [
  {
    id: "entity",
    label: "Entity Documents",
    icon: Building2,
    keys: ["companyPan", "coi", "boardResolution", "authorisationLetter"],
  },
  {
    id: "signatory",
    label: "Authorised Signatory",
    icon: User,
    keys: ["identityProof", "panCard", "aadhaarCard", "photo"],
  },
  {
    id: "address",
    label: "Address & Compliance",
    icon: FileText,
    keys: ["orgAddressProof", "gstCert", "llpAgreement", "partnershipDeed"],
  },
];

const DGFT_GROUPS: DocumentGroup[] = [
  {
    id: "dgft-entity",
    label: "DGFT / IEC Documents",
    icon: Globe,
    keys: ["iecCertificate", "dgftRegCert", "ieCode", "importerExporterDecl"],
  },
  {
    id: "kyc",
    label: "Identity & KYC",
    icon: User,
    keys: ["panCard", "aadhaarCard", "photo", "identityProof"],
  },
  {
    id: "org-docs",
    label: "Organisation Docs (if applicable)",
    icon: Building2,
    keys: ["companyPan", "coi", "boardResolution", "orgAddressProof"],
  },
];

const TYPE_DOC_GROUPS: Record<DscTypeId, DocumentGroup[]> = {
  individual: INDIVIDUAL_GROUPS,
  organization: ORGANISATION_GROUPS,
  dgft: DGFT_GROUPS,
};

// ─────────────────────────────────────────────
// PROCESS STEPS PER TYPE
// ─────────────────────────────────────────────
const TYPE_PROCESS_STEPS: Record<
  DscTypeId,
  { num: string; title: string; desc: string; color: string }[]
> = {
  individual: [
    { num: "01", title: "Submit Application", desc: "Fill in personal details — name, email, mobile & PAN on the online form", color: "#60a5fa" },
    { num: "02", title: "Upload KYC Docs", desc: "Upload PAN, Aadhaar, address proof & passport-size photograph in PDF / JPG", color: "#60a5fa" },
    { num: "03", title: "Video KYC Call", desc: "Complete a 5-minute live video verification call with our certified RA officer", color: "#60a5fa" },
    { num: "04", title: "Identity Verified", desc: "KYC documents and video verification are reviewed and approved by CA", color: "#60a5fa" },
    { num: "05", title: "DSC Generated", desc: "Class 3 Individual DSC is generated and loaded onto your USB token (dongle)", color: "#60a5fa" },
    { num: "06", title: "Token Dispatched", desc: "USB token with DSC delivered to your address within 1–2 working days", color: "#60a5fa" },
  ],
  organization: [
    { num: "01", title: "Organisation Details", desc: "Provide entity type (Pvt Ltd / LLP / Firm), CIN / LLPIN, PAN and contact details", color: "#60a5fa" },
    { num: "02", title: "Upload Entity Docs", desc: "Upload COI, PAN, MOA/AOA or LLP Agreement, Board Resolution or Auth Letter", color: "#60a5fa" },
    { num: "03", title: "Signatory KYC", desc: "Upload PAN, Aadhaar & photo of the authorised signatory / director", color: "#60a5fa" },
    { num: "04", title: "Video KYC Call", desc: "Authorised signatory completes a 5-minute live video verification with RA officer", color: "#60a5fa" },
    { num: "05", title: "Verification & Approval", desc: "Entity documents and signatory KYC reviewed and approved by CA team", color: "#60a5fa" },
    { num: "06", title: "DSC Issued & Dispatched", desc: "Organisation Class 3 DSC loaded on USB token and delivered in 2–3 working days", color: "#60a5fa" },
  ],
  dgft: [
    { num: "01", title: "IEC & DGFT Details", desc: "Provide your IEC number, DGFT registration details and entity type (Individual / Org)", color: "#60a5fa" },
    { num: "02", title: "Upload DGFT Docs", desc: "Upload IEC Certificate, DGFT Registration Certificate and Importer-Exporter Declaration", color: "#60a5fa" },
    { num: "03", title: "KYC Submission", desc: "Upload PAN, Aadhaar, photo and entity documents (COI / Partnership Deed if org)", color: "#60a5fa" },
    { num: "04", title: "Video KYC Call", desc: "Complete live video verification with our RA officer — takes under 5 minutes", color: "#60a5fa" },
    { num: "05", title: "DGFT-Specific Verification", desc: "IEC details cross-verified against DGFT portal records before DSC generation", color: "#60a5fa" },
    { num: "06", title: "DGFT DSC Issued", desc: "DGFT Class 3 DSC loaded onto USB token and dispatched within 2–3 working days", color: "#60a5fa" },
  ],
};

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (
    ["panCard", "companyPan", "coi", "ieCode", "dgftDoc", "gstCert", "llpAgreement",
      "partnershipDeed", "dgftRegCert", "iecCertificate", "importerExporterDecl"].includes(key)
  ) return FileText;
  if (["identityProof", "addressProof", "orgAddressProof", "aadhaarCard"].includes(key)) return BadgeCheck;
  if (["photo"].includes(key)) return User;
  if (["boardResolution", "authorisationLetter"].includes(key)) return PenTool;
  if (["ieCode", "dgftDoc", "dgftRegCert", "iecCertificate"].includes(key)) return Globe;
  return FileText;
};

// ─────────────────────────────────────────────
// RAZORPAY SERVICE
// ─────────────────────────────────────────────
const RAZORPAY_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_RAZORPAY_KEY_ID) || "";
const MOCK_MODE = !RAZORPAY_KEY || (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_USE_MOCK_PAYMENT === "true");

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

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function DSCRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<DscTypeId>("individual");

  const searchParams = new URLSearchParams(location.search);
  const cameFromCompanyRequirements = searchParams.get("returnTo") === "company-requirements";
  const cameFromServiceRequirements = searchParams.get("returnTo") === "service-requirements";
  const returnServiceId = searchParams.get("serviceId");
  const returnType = searchParams.get("type") === "llp" ? "llp" : "pvt_ltd";
  const returnTo = typeof location.state?.returnTo === "string"
    ? location.state.returnTo
    : cameFromServiceRequirements && returnServiceId
      ? `/services/${returnServiceId}/requirements${searchParams.get("type") ? `?type=${returnType}` : ""}`
    : cameFromCompanyRequirements
      ? "/services/company-registration/requirements"
      : "/services";
  const returnState = location.state?.returnState || ((cameFromCompanyRequirements || searchParams.get("type")) ? { preSelectedType: returnType } : undefined);

  const activeType = DSC_TYPES.find((t) => t.id === activeTab)!;
  const activeDocGroups = TYPE_DOC_GROUPS[activeTab];
  const activeProcess = TYPE_PROCESS_STEPS[activeTab];

  const handleStartApplication = () => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/dsc-registration/requirements", {
        state: { preSelectedType: activeTab },
      });
      return;
    }
    setIsProcessing(true);
    navigate("/services/dsc-registration/form", {
      state: {
        verified: false,
        source: "landing-page",
        dscType: activeTab,
        returnTo,
        returnState,
        returnSearch: location.search,
      },
    });
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const steps = [
    { step: "01", title: "Submit Application", desc: "Fill details & upload KYC documents", icon: FileText },
    { step: "02", title: "Video KYC", desc: "Complete a quick 5-min video verification call", icon: User },
    { step: "03", title: "DSC Issued", desc: `Receive your USB token in ${activeType.timeline}`, icon: CheckCircle2 },
  ];

  const stats = [
    { value: "8,000+", label: "DSCs Issued" },
    { value: activeType.timeline, label: "Avg. Delivery" },
    { value: "99.8%", label: "Success Rate" },
    { value: `₹${PRICING_CONFIG["dsc"].fee.toLocaleString()}`, label: "Service Fee" },
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
                  }}>DSC Registration</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: GRADIENTS.button, borderRadius: 20,
                    padding: "2px 8px", letterSpacing: "0.05em",
                  }}>Class 3</span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 8,000+ professionals</p>
              </div>
            </div>

            {/* Price + CTA — hidden on very small, shown on sm+ */}
            <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 22, fontWeight: 800, color: "#fff"
                }}>₹{PRICING_CONFIG["dsc"].fee.toLocaleString()} + GST </div>
                <p style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                  + <span style={{ color: "#22d3ee" }}>Govt charges applicable</span>
                </p>
              </div>
              <PayBtn
                label="Start Now"
                style={{ padding: "10px 18px", fontSize: 13 }}
                onClick={handleStartApplication}
                isProcessing={isProcessing}
              />
            </div>
          </div>

          {/* Mobile-only CTA bar */}
          <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
            <PayBtn
              label={`Start DSC Registration — ₹${PRICING_CONFIG["dsc"].fee.toLocaleString()}`}
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
              onClick={handleStartApplication}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px", position: "relative", zIndex: 1 }}>
        {/* PRICE HIGHLIGHT BANNER */}
        <div style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 16, padding: "16px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
          <ShieldCheck size={24} color="#06b6d4" />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Service Fee: <span style={{ color: "#60a5fa" }}>₹{PRICING_CONFIG["dsc"].fee.toLocaleString()}</span> <span style={{ color: "#22d3ee" }}>+GST+ Govt Charges Applicable.</span>
          </p>
        </div>

        {/* ── HERO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 72, alignItems: "start" }} className="hero-grid">

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "5px 14px", marginBottom: 24, boxShadow: "0 0 20px rgba(239,68,68,0.15)" }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>India's Most Trusted DSC Service</span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              Get Your Digital Signature<br />
              <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>in 3 Simple Steps</span>
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
              Legally valid under IT Act 2000. Required for GST filing, MCA incorporation, Income Tax returns, e-tendering and DGFT transactions. Includes secure Video KYC.
            </p>

            {/* ── TYPE SELECTOR TABS ── */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Key size={13} color="#ef4444" /> Choose Your DSC Type
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
                {DSC_TYPES.map((type) => (
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
                  { label: "Validity", value: activeType.validity, color: "#60a5fa" },
                  { label: "Use Cases", value: activeType.useCases, color: "#60a5fa" },
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
                { icon: <Clock size={13} color="#f97316" />, label: `${activeType.timeline} Delivery` },
                { icon: <CreditCard size={13} color="#06b6d4" />, label: "No Hidden Charges" },
                { icon: <Lock size={13} color="#10b981" />, label: "Video KYC Included" },
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
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 8, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", }}>How it works</h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 28 }}>
              DSC Registration — {activeType.label}
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
                  • Class 3 DSC loaded on secure USB token (dongle)
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
              <button
                onClick={handleRequestCallback}
                disabled={isProcessing}
                style={{ flex: 1, background: "transparent", border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1, borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s" }}
                onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <MessageCircle size={14} color="#f97316" />
                <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chat Us</span>
              </button>
              <PayBtn
                label="Avail Service"
                style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }}
                onClick={handleStartApplication}
                isProcessing={isProcessing}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[{ v: "8K+", l: "DSCs Issued" }, { v: activeType.timeline, l: "Delivery" }, { v: "99.8%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none" }}>
                  <div style={{ fontSize: v.length > 7 ? 13 : 17, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DSC PROCESS STEPS ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Issuance Process</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>
              DSC Issuance Steps — {activeType.shortLabel}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              End-to-end process from document submission to USB token dispatch
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="process-grid">
            {activeProcess.map((item, i) => (
              <div
                key={i}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 18px", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${item.color}40`; e.currentTarget.style.background = `${item.color}08`; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
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
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Keep these ready in digital format (PDF or JPG) for a smooth DSC application process.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 22 }} className="doc-grid">
            {activeDocGroups.map((group) => (
              <div
                key={group.id}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 26, transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
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
                      <div
                        key={docKey}
                        style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", transition: "all 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      >
                        <Icon size={14} color="#f97316" />
                        <span style={{ fontSize: 12, color: "#d1d5db", fontWeight: 500 }}>{DSC_DOCUMENTS[docKey]}</span>
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
            <div key={i} style={{ padding: "26px 16px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: value.length > 8 ? 18 : 28, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6, textShadow: "0 0 25px rgba(249,115,22,0.2)" }}>{value}</div>
              <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── DSC TYPE COMPARISON ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Quick Reference</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>DSC Types & Their Use Cases</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="compare-grid">
            {[
              {
                title: "Individual DSC",
                usedFor: "Income Tax, MCA, LLP / Pvt Ltd e-forms, e-Tenders, EPFO",
                note: "Issued to individuals. PAN & Aadhaar are sufficient for KYC.",
                color: "#60a5fa",
                icon: <UserCheck size={15} color="#f97316" />,
              },
              {
                title: "Organisation DSC",
                usedFor: "GST Portal, MCA ROC filings, e-Tenders, e-Procurement, TRACES",
                note: "Issued to authorised signatory of the entity. Entity + individual KYC required.",
                color: "#60a5fa",
                icon: <Building2 size={15} color="#06b6d4" />,
              },
              {
                title: "DGFT DSC",
                usedFor: "DGFT Portal only — IEC update, EXIM licences, FTP scheme applications",
                note: "Exclusively for DGFT portal. IEC Certificate & DGFT Registration proof mandatory.",
                color: "#60a5fa",
                icon: <Globe size={15} color="#8b5cf6" />,
              },
            ].map((row, i) => (
              <div
                key={i}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px", transition: "all 0.2s", display: "flex", gap: 14, alignItems: "flex-start" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${row.color}30`; e.currentTarget.style.background = `${row.color}06`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${row.color}18`, border: `1px solid ${row.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.icon}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{row.title}</span>
                  </div>
                  <p style={{ fontSize: 11, color: row.color, fontWeight: 600, margin: "0 0 6px" }}>{row.usedFor}</p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{row.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── IMPORTANT NOTICE ── */}
        <div style={{ marginBottom: 72, padding: "24px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 18, display: "flex", gap: 16, alignItems: "start" }}>
          <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>Important: DSC Token & Security</h4>
            <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>Your DSC private key is stored on a physical USB token (dongle) that stays with you at all times. RegiBIZ only tracks your DSC metadata (type, expiry, status) — we never store or access your private key. Keep your token safe and never share it with anyone.</p>
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "40px 20px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
              Ready to go{" "}
              <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>digital?</span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>
              Join 8,000+ professionals who trusted RegiBIZ for their {activeType.label}.
            </p>
            <PayBtn
              label={`Start Now ${activeType.shortLabel} DSC — ₹${PRICING_CONFIG["dsc"].fee.toLocaleString()}`}
              variant="primary"
              style={{ borderRadius: 14, padding: "14px 20px", fontSize: 14, maxWidth: "100%", width: "100%", boxShadow: "0 10px 40px rgba(239,68,68,0.35)" }}
              onClick={handleStartApplication}
              isProcessing={isProcessing}
            />
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 20, fontWeight: 500 }}>
              <span style={{ color: "#60a5fa" }}>✓</span> Secure checkout &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> No hidden charges &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> Video KYC Included
            </p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 72, paddingTop: 36, paddingBottom: 36, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      {/* Global Responsive Styles */}
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
        .stats-grid > div { border-right: 1px solid rgba(255,255,255,0.08) !important; }
        .stats-grid > div:nth-child(2n) { border-right: none !important; }
        .stats-grid > div:nth-child(1),
        .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
        .header-cta { display: none !important; }
        .mobile-cta-bar { display: block !important; }
        .mobile-cta-bar button { width: 100% !important; font-size: 13px !important; padding: 12px 12px !important; }
      }

        @media (min-width: 641px) and (max-width: 1024px) {
        .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        .doc-grid { grid-template-columns: 1fr !important; }
        .doc-items-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .compare-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .process-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }
      `}</style>
    </div>
  );
}
