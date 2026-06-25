// src/servicepanel/company-registartion.tsx
import React, { useState } from "react";
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
  CreditCard,
  ChevronLeft,
  Loader2,
  Star,
  BadgeCheck,
  Briefcase,
  FileCheck2,
  Users,
  Scale,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST } from "../data/pricingConfig";
import { initiateRazorpayPayment, RazorpaySuccessResponse } from "../services/razorpayService";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "pan" | "aadhaar" | "photo" | "addressProof" | "utilityBill"
  | "noc" | "rentAgreement" | "bankStatement" | "moa" | "aoa"
  | "dsc" | "masterData" | "din" | "spiceForm"
  | "llpAgreement" | "dpin" | "fillipForm";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
  type: "pvt" | "llp" | "both";
}

// ─────────────────────────────────────────────
// DOCUMENT DATA
// ─────────────────────────────────────────────
const ALL_DOCUMENTS: Record<DocKey, string> = {
  pan: "PAN Card of Directors / Partners",
  aadhaar: "Aadhaar Card of Directors / Partners",
  photo: "Passport Size Photograph",
  addressProof: "Address Proof of Directors / Partners",
  utilityBill: "Utility Bill of Registered Office",
  noc: "No Objection Certificate from Owner",
  rentAgreement: "Rent Agreement / Lease Deed",
  bankStatement: "Recent Bank Statement / Cancelled Cheque",
  moa: "Memorandum of Association (MOA)",
  aoa: "Articles of Association (AOA)",
  dsc: "Digital Signature Certificate (DSC)",
  masterData: "Business Activity & Capital Details",
  din: "Director Identification Number (DIN)",
  spiceForm: "SPICe+ Form Details",
  llpAgreement: "LLP Agreement (within 30 days of incorporation)",
  dpin: "Designated Partner Identification Number (DPIN)",
  fillipForm: "FiLLiP Form Details",
};

const PVT_DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "promoter",
    label: "Promoter / Director Documents",
    icon: User,
    keys: ["pan", "aadhaar", "photo", "addressProof"],
    type: "pvt",
  },
  {
    id: "office",
    label: "Registered Office",
    icon: Landmark,
    keys: ["utilityBill", "noc", "rentAgreement", "bankStatement"],
    type: "pvt",
  },
  {
    id: "company",
    label: "Company Details & Filings",
    icon: Building2,
    keys: ["masterData", "moa", "aoa", "spiceForm"],
    type: "pvt",
  },
];

const LLP_DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "partner",
    label: "Partner Documents",
    icon: Users,
    keys: ["pan", "aadhaar", "photo", "addressProof"],
    type: "llp",
  },
  {
    id: "office-llp",
    label: "Registered Office",
    icon: Landmark,
    keys: ["utilityBill", "noc", "rentAgreement", "bankStatement"],
    type: "llp",
  },
  {
    id: "llp-filing",
    label: "LLP Details & Filings",
    icon: Scale,
    keys: ["masterData", "dsc", "dpin", "fillipForm"],
    type: "llp",
  },
];

// ─────────────────────────────────────────────
// COMPANY TYPES
// ─────────────────────────────────────────────
type CompanyTypeId = "pvt_ltd" | "llp";

const COMPANY_TYPES: {
  id: CompanyTypeId;
  label: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  tagline: string;
  highlights: string[];
  timeline: string;
  serviceFee: string;
  minCapital: string;
}[] = [
    {
      id: "pvt_ltd",
      label: "Private Limited Company",
      shortLabel: "Pvt Ltd",
      badge: "Most Popular",
      badgeColor: "#f97316",
      icon: Building2,
      tagline: "Ideal for startups & growing businesses",
      highlights: [
        "Separate legal entity with limited liability",
        "Min. 2 directors & 2 shareholders",
        "Governed by Companies Act 2013",
        "Filed via SPICe+ on MCA Portal",
        "PAN, TAN & GST after incorporation",
      ],
      timeline: "7–12 Days",
      serviceFee: `₹${PRICING_CONFIG["company-registration"].fee.toLocaleString()} + 18% GST`,
      minCapital: "₹1 Lakh (Authorized)",
    },
    {
      id: "llp",
      label: "Limited Liability Partnership",
      shortLabel: "LLP",
      badge: "Professionals Favorite",
      badgeColor: "#06b6d4",
      icon: Scale,
      tagline: "Flexible structure for professionals & consultants",
      highlights: [
        "Hybrid of partnership & company — limited liability",
        "Min. 2 designated partners required",
        "Governed by LLP Act 2008",
        "Filed via FiLLiP Form on MCA Portal",
        "No concept of Authorized Capital",
      ],
      timeline: "10–15 Days",
      serviceFee: `₹${PRICING_CONFIG["company-registration"].fee.toLocaleString()} + 18% GST`,
      minCapital: "No minimum capital",
    },
  ];

// ─────────────────────────────────────────────
// PROCESS STEPS PER TYPE
// ─────────────────────────────────────────────
const TYPE_PROCESS_STEPS: Record<
  CompanyTypeId,
  { num: string; title: string; desc: string; color: string }[]
> = {
  pvt_ltd: [
    { num: "01", title: "DSC & DIN", desc: "Class 3 Digital Signature Certificate and Director Identification Number for all directors", color: "#60a5fa" },
    { num: "02", title: "Name Reservation", desc: "Apply via RUN (Reserve Unique Name) on MCA portal — upto 3 name options", color: "#60a5fa" },
    { num: "03", title: "Draft MOA & AOA", desc: "Memorandum and Articles of Association aligned with your object clause", color: "#60a5fa" },
    { num: "04", title: "SPICe+ Filing", desc: "Single integrated form combining Incorporation, DIN, PAN, TAN & bank account", color: "#60a5fa" },
    { num: "05", title: "COI from ROC", desc: "Certificate of Incorporation issued by Registrar of Companies confirming legal existence", color: "#60a5fa" },
    { num: "06", title: "PAN + TAN", desc: "Company PAN and TAN issued as part of SPICe+ — GST registration follows", color: "#60a5fa" },
  ],
  llp: [
    { num: "01", title: "DSC for Partners", desc: "Class 3 Digital Signature Certificate required for all Designated Partners", color: "#60a5fa" },
    { num: "02", title: "DPIN Application", desc: "Designated Partner Identification Number — similar to DIN for company directors", color: "#60a5fa" },
    { num: "03", title: "Name Reservation", desc: "Apply via RUN-LLP on MCA portal — LLP name must end with 'LLP'", color: "#60a5fa" },
    { num: "04", title: "FiLLiP Form", desc: "Form for Incorporation of Limited Liability Partnership — filed on MCA portal", color: "#60a5fa" },
    { num: "05", title: "LLP Certificate", desc: "Certificate of Incorporation for LLP issued by ROC confirming legal status", color: "#60a5fa" },
    { num: "06", title: "LLP Agreement", desc: "Must be filed within 30 days of incorporation — defines rights, duties & profit sharing", color: "#60a5fa" },
  ],
};

const TYPE_DOC_GROUPS: Record<CompanyTypeId, DocumentGroup[]> = {
  pvt_ltd: PVT_DOCUMENT_GROUPS,
  llp: LLP_DOCUMENT_GROUPS,
};

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (["pan", "aadhaar", "photo", "addressProof"].includes(key)) return User;
  if (["utilityBill", "noc", "rentAgreement", "bankStatement"].includes(key)) return Landmark;
  if (["moa", "aoa", "masterData", "spiceForm", "llpAgreement", "fillipForm"].includes(key)) return FileText;
  if (["dsc", "din", "dpin"].includes(key)) return BadgeCheck;
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

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function CompanyRegistrationLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<CompanyTypeId>("pvt_ltd");

  const searchParams = new URLSearchParams(location.search);
  const cameFromServiceRequirements = searchParams.get("returnTo") === "service-requirements";
  const returnServiceId = searchParams.get("serviceId");
  const returnTo = typeof location.state?.returnTo === "string"
    ? location.state.returnTo
    : cameFromServiceRequirements && returnServiceId
      ? `/services/${returnServiceId}/requirements${searchParams.get("type") ? `?type=${searchParams.get("type")}` : ""}`
      : "/services";
  const returnState = location.state?.returnState;

  const activeType = COMPANY_TYPES.find((t) => t.id === activeTab)!;
  const activeDocGroups = TYPE_DOC_GROUPS[activeTab];
  const activeProcess = TYPE_PROCESS_STEPS[activeTab];

  const handleStartRegistration = async () => {
    if (isProcessing) return;
    if (location.state?.requirementsConfirmed) {
      setIsProcessing(true);
      const basePrice = PRICING_CONFIG["company-registration"].fee;
      const totalAmountPaise = calculateTotalWithGST(basePrice) * 100;
      try {
        const started = await initiateRazorpayPayment({
          amount: totalAmountPaise,
          currency: "INR",
          name: `RegiBIZ - ${activeTab === 'llp' ? 'LLP' : 'Company'} Registration`,
          description: `${activeTab === 'llp' ? 'LLP' : 'Private Limited'} Service Fee Payment (Incl. 18% GST)`,
          prefill: {
            name: localStorage.getItem("userName") || "",
            email: localStorage.getItem("userEmail") || "",
            contact: localStorage.getItem("userPhone") || "",
          },
          notes: {
            serviceId: "company-registration",
            type: activeTab,
            source: "requirement-confirmed-panel",
            timestamp: new Date().toISOString(),
          },
          handler: (response: RazorpaySuccessResponse) => {
            navigate("/services/company-registration/form", {
              state: {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                verified: true,
                preSelectedType: activeTab,
                source: "requirement-confirmed-panel",
              },
            });
          },
          onClosed: () => setIsProcessing(false),
        });
        if (!started) setIsProcessing(false);
      } catch (error) {
        console.error("Payment Error:", error);
        alert("Failed to initiate payment. Please try again.");
        setIsProcessing(false);
      }
      return;
    }
    navigate("/services/company-registration/requirements", {
      state: { preSelectedType: activeTab },
    });
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const steps = [
    { step: "01", title: "Share Business Details", desc: activeTab === "pvt_ltd" ? "Company type, proposed names, capital structure & object clause" : "LLP name, business activity, contribution & profit sharing ratio", icon: Briefcase },
    { step: "02", title: "Upload KYC & Office Docs", desc: activeTab === "pvt_ltd" ? "Director KYC, registered office proof & Master Data Sheet" : "Partner KYC, registered office proof & LLP Agreement", icon: FileCheck2 },
    { step: "03", title: "Get Incorporated", desc: activeTab === "pvt_ltd" ? "Receive Certificate of Incorporation, PAN & TAN from ROC" : "Receive LLP Certificate of Incorporation & file LLP Agreement", icon: BadgeCheck },
  ];

  const stats = [
    { value: "5,000+", label: "Companies Registered" },
    { value: activeType.timeline, label: "Avg. Delivery" },
    { value: "98%", label: "Success Rate" },
    { value: `₹${PRICING_CONFIG["company-registration"].fee.toLocaleString()}`, label: "Service Fee" },
  ];

  const PayBtn = ({
    label, style = {}, variant = "primary", onClick, isProcessing: btnProcessing,
  }: {
    label: string; style?: React.CSSProperties; variant?: "primary" | "secondary";
    onClick: () => void; isProcessing: boolean;
  }) => {
    const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
    const hoverGradient = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;

    return (
      <button
        onClick={onClick}
        disabled={btnProcessing}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontWeight: 700, cursor: btnProcessing ? "not-allowed" : "pointer",
          opacity: btnProcessing ? 0.7 : 1, transition: "all 0.25s ease",
          border: "none", color: "#fff", borderRadius: 12,
          background: baseGradient,
          boxShadow: variant === "primary" ? GRADIENTS.buttonGlow : "none",
          position: "relative", overflow: "hidden", whiteSpace: "nowrap", ...style,
        }}
        onMouseEnter={(e) => {
          if (!btnProcessing) {
            e.currentTarget.style.background = hoverGradient;
            e.currentTarget.style.transform = "translateY(-2px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = baseGradient;
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {btnProcessing ? (
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
                  }}>Company Registration</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: GRADIENTS.button, borderRadius: 20,
                    padding: "2px 8px", letterSpacing: "0.05em",
                  }}>MCA</span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 5,000+ businesses</p>
              </div>
            </div>

            {/* Price + CTA — hidden on very small, shown on sm+ */}
            <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 22, fontWeight: 800, color: "#fff"
                }}>₹{PRICING_CONFIG["company-registration"].fee.toLocaleString()} + GST </div>
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
              label={`Start Application — ₹${PRICING_CONFIG["company-registration"].fee.toLocaleString()} + GST`}
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
              onClick={handleStartRegistration}
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
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Service Fee: <span style={{ color: "#22d3ee" }}>₹{PRICING_CONFIG["company-registration"].fee.toLocaleString()} +GST+ Govt Charges Applicable.</span>
          </p>
        </div>

        {/* ── HERO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 72, alignItems: "start" }} className="hero-grid">

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "5px 14px", marginBottom: 24, boxShadow: "0 0 20px rgba(239,68,68,0.15)" }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Incorporation Support</span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              Register Your Company<br />
              <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>Without the Usual Chaos</span>
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
              We help founders handle company incorporation smoothly with guided documentation, MCA filing support, and a clear next-step process.
            </p>

            {/* ── TYPE SELECTOR TABS ── */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={13} color="#ef4444" /> Choose Registration Type
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
                {COMPANY_TYPES.map((type) => (
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
                  { label: "Min Capital", value: activeType.minCapital, color: "#60a5fa" },
                  { label: "Service Fee", value: activeType.serviceFee, color: "#60a5fa" },
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
                { icon: <CreditCard size={13} color="#06b6d4" />, label: "Transparent Pricing" },
                { icon: <Phone size={13} color="#10b981" />, label: "Expert CA Support" },
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
              {activeTab === "pvt_ltd" ? "Private Limited Company — SPICe+ Flow" : "LLP — FiLLiP Filing Flow"}
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
                  • Certificate of Incorporation, MOA, AOA, and DIN number from ROC (for Pvt Ltd))
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Company PAN & TAN (for Pvt Ltd) / LLP Certificate & Agreement (for LLP)
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
                onClick={handleStartRegistration}
                isProcessing={isProcessing}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[{ v: "5K+", l: "Companies" }, { v: activeType.timeline, l: "Delivery" }, { v: "98%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none" }}>
                  <div style={{ fontSize: v.length > 7 ? 13 : 17, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PROCESS STEPS ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>MCA Process</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>
              {activeTab === "pvt_ltd" ? "Pvt Ltd Incorporation Process" : "LLP Registration Process"}
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              {activeTab === "pvt_ltd"
                ? "Filing via SPICe+ on MCA Portal — ROC verified & COI issued"
                : "Filing via FiLLiP on MCA Portal — LLP Certificate issued"}
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
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Keep these ready in digital format (PDF or JPG) for a smooth filing process.</p>
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
                        <span style={{ fontSize: 12, color: "#d1d5db", fontWeight: 500 }}>{ALL_DOCUMENTS[docKey]}</span>
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

        {/* ── COMPARISON SECTION ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Quick Compare</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>Pvt Ltd vs LLP — Which is right for you?</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="compare-grid">
            {[
              { feature: "Liability", pvt: "Limited to share capital", llp: "Limited to contribution amount", color: "#60a5fa", icon: <ShieldCheck size={15} color="#f97316" /> },
              { feature: "Governing Law", pvt: "Companies Act 2013", llp: "LLP Act 2008", color: "#60a5fa", icon: <Scale size={15} color="#06b6d4" /> },
              { feature: "Minimum Members", pvt: "2 Directors + 2 Shareholders", llp: "2 Designated Partners", color: "#60a5fa", icon: <Users size={15} color="#8b5cf6" /> },
              { feature: "Capital Requirement", pvt: "Min. ₹1 Lakh authorized capital", llp: "No minimum capital requirement", color: "#60a5fa", icon: <CreditCard size={15} color="#10b981" /> },
              { feature: "Filing Form", pvt: "SPICe+ (INC-32) on MCA", llp: "FiLLiP Form on MCA", color: "#60a5fa", icon: <FileText size={15} color="#eab308" /> },
              { feature: "Best Suited For", pvt: "Startups seeking funding & scale", llp: "Professionals, consultants, SMEs", color: "#60a5fa", icon: <Briefcase size={15} color="#ef4444" /> },
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{row.feature}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, margin: "0 0 4px" }}>Pvt Ltd: {row.pvt}</p>
                  <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600, margin: "0 0 0" }}>LLP: {row.llp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── IMPORTANT NOTICE ── */}
        <div style={{ marginBottom: 72, padding: "24px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 18, display: "flex", gap: 16, alignItems: "start" }}>
          <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>Important: Post-Incorporation Compliance</h4>
            <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>After incorporation, your company must comply with annual filing requirements including ROC filings, audited financial statements, and annual returns (AOC-4 & MGT-7 for Pvt Ltd, Form 8 & 11 for LLP). Non-compliance may attract penalties. RegiBIZ offers post-incorporation compliance packages to keep your entity in good standing.</p>
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "40px 20px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
              Ready to incorporate your{" "}
              <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>{activeTab === "pvt_ltd" ? "Pvt Ltd" : "LLP"}?</span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>
              Join 5,000+ founders who trusted RegiBIZ for their {activeType.label} incorporation.
            </p>
            <PayBtn
              label={`Start Application — ₹${PRICING_CONFIG["company-registration"].fee.toLocaleString()} + GST`}
              variant="primary"
              style={{ borderRadius: 14, padding: "14px 20px", fontSize: 14, maxWidth: "50%", width: "50%", boxShadow: "0 10px 40px rgba(239,68,68,0.35)" }}
              onClick={handleStartRegistration}
              isProcessing={isProcessing}
            />
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 20, fontWeight: 500 }}>
              <span style={{ color: "#60a5fa" }}>✓</span> Expert CA guidance &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> Document review &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> MCA filing support
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
