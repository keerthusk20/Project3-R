// src/servicepanel/StartupIndia-registration.tsx
import React, { useState, useCallback } from "react";
import {
  CheckCircle2,
  FileText,
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
  Rocket,
  Award,
  TrendingUp,
  AlertCircle,
  MessageCircle,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from "../data/pricingConfig";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "incorporationCert" | "panCard" | "officeAddressProof" | "passportPhotos"
  | "selfDeclaration" | "partnershipDeed" | "partnersAadhaar" | "partnersPan"
  | "llpDeed" | "designatedPartnerAadhaar" | "designatedPartnerPan"
  | "moa" | "aoa" | "directorAadhaar" | "directorPan"
  | "pitchDeck" | "productDemo" | "companyLogo" | "fundingProof"
  | "patentTrademark" | "recommendationLetter" | "itr" | "nocFromOwner";

type EntityType = "pvt_ltd" | "llp" | "partnership" | "opc";

// ─────────────────────────────────────────────
// ENTITY TYPE CONFIGURATION
// ─────────────────────────────────────────────
interface EntityConfig {
  value: EntityType;
  label: string;
  basePrice?: number;
  timeline: string;
  requiredCompanyDocs: DocKey[];
  requiredPeopleDocs: DocKey[];
  optionalDocs: DocKey[];
  conditionalDocs: DocKey[];
}

const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  pvt_ltd: {
    value: "pvt_ltd",
    label: "Private Limited",
    basePrice: 2999,
    timeline: "7–10 Days",
    requiredCompanyDocs: ["incorporationCert", "panCard", "officeAddressProof", "moa", "aoa", "selfDeclaration"],
    requiredPeopleDocs: ["passportPhotos", "directorAadhaar", "directorPan"],
    optionalDocs: ["pitchDeck", "productDemo", "companyLogo", "fundingProof", "patentTrademark", "recommendationLetter", "itr"],
    conditionalDocs: ["nocFromOwner"],
  },
  llp: {
    value: "llp",
    label: "LLP",
    basePrice: 2999,
    timeline: "7–10 Days",
    requiredCompanyDocs: ["incorporationCert", "panCard", "officeAddressProof", "llpDeed", "selfDeclaration"],
    requiredPeopleDocs: ["passportPhotos", "designatedPartnerAadhaar", "designatedPartnerPan"],
    optionalDocs: ["pitchDeck", "productDemo", "companyLogo", "fundingProof", "patentTrademark", "recommendationLetter", "itr"],
    conditionalDocs: ["nocFromOwner"],
  },
  partnership: {
    value: "partnership",
    label: "Partnership Firm",
    basePrice: 2999,
    timeline: "10–15 Days",
    requiredCompanyDocs: ["incorporationCert", "panCard", "officeAddressProof", "partnershipDeed", "selfDeclaration"],
    requiredPeopleDocs: ["passportPhotos", "partnersAadhaar", "partnersPan"],
    optionalDocs: ["pitchDeck", "productDemo", "companyLogo", "fundingProof", "patentTrademark", "recommendationLetter", "itr"],
    conditionalDocs: ["nocFromOwner"],
  },
  opc: {
    value: "opc",
    label: "One Person Company",
    basePrice: 2999,
    timeline: "7–10 Days",
    requiredCompanyDocs: ["incorporationCert", "panCard", "officeAddressProof", "moa", "aoa", "selfDeclaration"],
    requiredPeopleDocs: ["passportPhotos", "directorAadhaar", "directorPan"],
    optionalDocs: ["pitchDeck", "productDemo", "companyLogo", "fundingProof", "patentTrademark", "recommendationLetter", "itr"],
    conditionalDocs: ["nocFromOwner"],
  },
};

// ─────────────────────────────────────────────
// DOCUMENT DATA
// ─────────────────────────────────────────────
const DPIIT_DOCUMENTS: Record<DocKey, string> = {
  incorporationCert: "Certificate of Incorporation / Registration",
  panCard: "PAN Card of Entity",
  officeAddressProof: "Registered Office Address Proof",
  passportPhotos: "Passport-size Photos",
  selfDeclaration: "Self Declaration",
  partnershipDeed: "Partnership Deed",
  partnersAadhaar: "Partners Aadhaar Cards",
  partnersPan: "Partners PAN Cards",
  llpDeed: "LLP Agreement",
  designatedPartnerAadhaar: "Designated Partner Aadhaar",
  designatedPartnerPan: "Designated Partner PAN",
  moa: "Memorandum of Association (MOA)",
  aoa: "Articles of Association (AOA)",
  directorAadhaar: "Directors Aadhaar Cards",
  directorPan: "Directors PAN Cards",
  pitchDeck: "Pitch Deck / Business Plan",
  productDemo: "Product Demo / MVP",
  companyLogo: "Company Logo",
  fundingProof: "Funding Proof",
  patentTrademark: "Patent / Trademark Details",
  recommendationLetter: "Recommendation Letter",
  itr: "Income Tax Returns (ITR)",
  nocFromOwner: "NOC from Owner (for rented office)",
};

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (
    ["incorporationCert", "panCard", "selfDeclaration", "partnershipDeed", "llpDeed", "moa", "aoa", "patentTrademark", "recommendationLetter", "itr"].includes(key)
  ) return FileText;
  if (["passportPhotos", "partnersAadhaar", "partnersPan", "designatedPartnerAadhaar", "designatedPartnerPan", "directorPan", "directorAadhaar"].includes(key)) return User;
  if (["pitchDeck", "productDemo", "companyLogo", "fundingProof"].includes(key)) return Rocket;
  if (["officeAddressProof", "nocFromOwner"].includes(key)) return Building2;
  return FileText;
};

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const G = {
  orange: "linear-gradient(to right, #ef4444, #f97316)",
  blue: "linear-gradient(to right, #0f766e, #075985, #1e3a8a)",
  blueHover: "linear-gradient(to right, #115e59, #0c4a6e, #1e40af)",
  blueGlow: "0 4px 20px rgba(6, 182, 212, 0.35)",
  orangeGlow: "0 0 30px rgba(249, 115, 22, 0.25)",
};

// ─────────────────────────────────────────────
// PAY BUTTON
// ─────────────────────────────────────────────
interface PayBtnProps {
  label: string;
  onClick: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const PayBtn: React.FC<PayBtnProps> = ({ label, onClick, style = {}, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.25s ease",
      opacity: disabled ? 0.7 : 1,
      border: "none", color: "#fff", borderRadius: 12,
      background: G.blue, boxShadow: G.blueGlow,
      // ✅ Mobile fix: prevent wrapping / squeezing
      whiteSpace: "nowrap", flexShrink: 0,
      ...style,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = G.blueHover;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 30px rgba(6,182,212,0.5)";
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = G.blue;
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = G.blueGlow;
    }}
  >
    <>{label} <ArrowRight size={15} /></>
  </button>
);

// ─────────────────────────────────────────────
// ENTITY TYPE SELECTOR
// ─────────────────────────────────────────────
interface EntitySelectorProps {
  selected: EntityType;
  onChange: (type: EntityType) => void;
}

const EntitySelector: React.FC<EntitySelectorProps> = ({ selected, onChange }) => (
  <div style={{ marginBottom: 24 }}>
    <p style={{
      fontSize: 11, fontWeight: 800,
      letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <Building2 size={13} color="#ef4444" /> Choose Your Business Type
    </p>
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
      padding: 4, background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
    }}>
      {([
        { id: "pvt_ltd", label: "Pvt Ltd", icon: Building2 },
        { id: "opc", label: "OPC", icon: User },
        { id: "llp", label: "LLP", icon: Award },
        { id: "partnership", label: "Partnership", icon: Users },
      ] as { id: EntityType; label: string; icon: any }[]).map((type) => {
        const isSelected = selected === type.id;
        const Icon = type.icon;
        return (
          <button
            key={type.id}
            onClick={() => onChange(type.id)}
            style={{
              padding: "10px 12px", borderRadius: 10, border: "none",
              cursor: "pointer", fontWeight: 700, fontSize: 12,
              transition: "all 0.25s ease",
              background: isSelected ? G.blue : "transparent",
              color: isSelected ? "#fff" : "#6b7280",
              boxShadow: isSelected ? G.blueGlow : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Icon size={13} />{type.label}
          </button>
        );
      })}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function StartupIndiaRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>("pvt_ltd");
  const [isProcessing, setIsProcessing] = useState(false);

  const cfg = ENTITY_CONFIGS[selectedEntityType];
  const basePrice = cfg.basePrice ?? PRICING_CONFIG["startup"].fee;

  const handleStartApplication = useCallback(() => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/startup-india/requirements", {
        state: { preSelectedType: selectedEntityType },
      });
      return;
    }
    setIsProcessing(true);
    navigate("/services/startup-india/form", {
      state: { verified: false, entityType: selectedEntityType },
    });
  }, [navigate, selectedEntityType, isProcessing, location.state]);

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const steps = [
    { step: "01", title: "Eligibility Check", desc: "We verify your startup against DPIIT criteria", icon: FileText },
    { step: "02", title: "Document Filing", desc: "Experts prepare & file on Startup India Portal", icon: ShieldCheck },
    { step: "03", title: "Get Recognised", desc: "Receive DPIIT Certificate in 7–15 days", icon: CheckCircle2 },
  ];

  const requiredDocGroups: {
    id: string; label: string; icon: React.ElementType; description: string; keys: DocKey[];
  }[] = [
    {
      id: "entity",
      label: "Company Details",
      icon: Building2,
      description: "Core registration and business proof documents",
      keys: cfg.requiredCompanyDocs,
    },
    {
      id: "promoter",
      label: "Directors / Partners",
      icon: User,
      description: "Identity documents for people attached to the entity",
      keys: cfg.requiredPeopleDocs,
    },
  ].filter((g) => g.keys.length > 0);

  const optionalDocs = cfg.optionalDocs;
  const conditionalDocs = cfg.conditionalDocs;

  const stats = [
    { value: "5,000+", label: "Startups Helped" },
    { value: cfg.timeline, label: "Avg. Timeline" },
    { value: "99.9%", label: "Success Rate" },
    { value: `₹${basePrice.toLocaleString()}`, label: "Service Fee" },
  ];

  const constitutionDocSummary =
    selectedEntityType === "partnership"
      ? "Shows partnership deed and partner KYC documents."
      : selectedEntityType === "llp"
        ? "Shows LLP agreement and designated partner documents."
        : selectedEntityType === "opc"
          ? "Shows OPC company documents and director KYC."
          : "Shows private limited company documents and director KYC.";

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

          {/* ✅ Top row: back + title + price/CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>

            {/* Left: back + branding */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <button
                onClick={() => navigate("/services")}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "7px", cursor: "pointer",
                  color: "#6b7280", display: "flex", alignItems: "center",
                  transition: "all 0.2s", flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#f97316";
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                  e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "transparent";
                }}
                aria-label="Go back"
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{
                    color: "#60a5fa", fontSize: 16, fontWeight: 800,
                  }}>
                    Startup India
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: G.blue, borderRadius: 20, padding: "2px 8px", letterSpacing: "0.05em",
                  }}>
                    DPIIT
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 5,000+ startups</p>
              </div>
            </div>

            {/* ✅ Right: price + CTA — hidden on mobile via .header-cta CSS class */}
            <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                  ₹{basePrice.toLocaleString()} + GST
                </div>
                <p style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                  + <span style={{ color: "#22d3ee" }}>Govt charges applicable</span>
                </p>
              </div>
              <PayBtn
                label="Start Now"
                onClick={handleStartApplication}
                disabled={isProcessing}
                style={{ padding: "10px 18px", fontSize: 13 }}
              />
            </div>
          </div>

          {/* ✅ Mobile-only full-width CTA bar — shown only on ≤640px */}
          <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
            <PayBtn
              label={`Start Application — ₹${basePrice.toLocaleString()} + GST`}
              onClick={handleStartApplication}
              disabled={isProcessing}
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
            />
          </div>

        </div>
      </header>

      {/* ── MAIN ── */}
      {/* ✅ Reduced padding to match GST */}
      <main className="startup-service-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>

        {/* PRICE HIGHLIGHT BANNER */}
        <div style={{
          background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)",
          borderRadius: 16, padding: "16px 24px", marginBottom: 32,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <ShieldCheck size={24} color="#06b6d4" />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            Service Fee:{" "}
            <span style={{ color: "#60a5fa" }}>₹{basePrice.toLocaleString()}</span>{" "}
            <span style={{ color: "#22d3ee" }}>+GST+ Govt Charges Applicable.</span>
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
              <span style={{ fontSize: 12, color: "#f97316", fontWeight: 700 }}>
                Official DPIIT Recognition Partner
              </span>
            </div>

            {/* ✅ clamp() for fluid font scaling */}
            <h1 style={{
              fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.15, margin: "0 0 14px", letterSpacing: "-0.03em",
            }}>
              Get DPIIT Recognised<br />
              <span style={{ color: "#fff", display: "inline-block" }}>
                Unlock Startup Benefits
              </span>
            </h1>

            <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.7, marginBottom: 28, maxWidth: 480 }}>
              Secure your official Startup India certificate. Access tax holidays, IPR fast-tracking, and government funding opportunities with our expert assistance.
            </p>

            <EntitySelector selected={selectedEntityType} onChange={setSelectedEntityType} />

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: <Clock size={13} color="#f97316" />, label: cfg.timeline },
                { icon: <CreditCard size={13} color="#06b6d4" />, label: "Transparent Pricing" },
                { icon: <ShieldCheck size={13} color="#10b981" />, label: "Expert Verified" },
              ].map(({ icon, label }, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "6px 12px", background: "rgba(255,255,255,0.03)",
                  borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  {icon}
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
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
            {/* Gradient border overlay */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: 24, padding: 1,
              background: G.blue,
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor", maskComposite: "exclude",
              pointerEvents: "none", opacity: 0.4,
            }} />

            <h3 style={{
              fontSize: 19, fontWeight: 800, textAlign: "center", marginBottom: 6,
              color: "#f97316",
            }}>
              How it works
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
              DPIIT Recognition — {cfg.label}
            </p>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", background: G.blue,
                      border: "2px solid rgba(255,255,255,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, boxShadow: G.blueGlow, zIndex: 1,
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
                    <span style={{
                      color: "#60a5fa", fontSize: 10, fontWeight: 800,
                      letterSpacing: "0.12em", display: "inline-block",
                    }}>
                      STEP {item.step}
                    </span>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "4px 0" }}>{item.title}</h4>
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
                  • DPIIT Recognition Certificate and official registration documents
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Detailed report on government schemes and benefits you qualify for as a recognized startup
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={handleRequestCallback}
                disabled={isProcessing}
                style={{
                  flex: 1, background: "transparent",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 12, padding: "12px 14px", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: isProcessing ? 0.6 : 1,
                  transition: "all 0.25s",
                }}
                onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <MessageCircle size={14} color="#f97316" />
                <span style={{ background: G.orange, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Chat Us
                </span>
              </button>
              <PayBtn
                label="Avail Service"
                onClick={handleStartApplication}
                disabled={isProcessing}
                style={{ flex: 1, padding: "12px 14px", fontSize: 13, borderRadius: 12 }}
              />
            </div>

            {/* Stats row */}
            <div className="info-stats-grid" style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 20,
              background: "rgba(6,182,212,0.06)", borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(6,182,212,0.15)",
            }}>
              {[{ v: "5K+", l: "Startups" }, { v: cfg.timeline, l: "Timeline" }, { v: "98.5%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{
                  padding: "12px 8px", textAlign: "center",
                  borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none",
                }}>
                  <div style={{
                    fontSize: v.length > 7 ? 12 : 16, fontWeight: 800,
                    background: G.blue, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DOCUMENTS SECTION ── */}
        <div style={{ margin: "0 auto 64px" }}>
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <p style={{
              fontSize: 13, fontWeight: 800, color: "#f97316",
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
            }}>
              Checklist
            </p>
            {/* ✅ clamp() on section heading */}
            <h2 style={{
              fontSize: "clamp(30px, 8vw, 64px)", fontWeight: 600, color: "#f97316", margin: "0 0 16px",
              letterSpacing: "-0.02em", lineHeight: 1.1
            }}>
              Documents Required
            </h2>
            <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
              This section changes based on the selected constitution and follows the DPIIT form checklist.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{
              display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "12px 18px", borderRadius: 14,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              minWidth: 280, maxWidth: "90%",
            }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <BadgeCheck size={15} color="#f97316" />
                <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                  Required documents for {cfg.label}
                </span>
              </div>
              <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, textAlign: "center" }}>
                {constitutionDocSummary}
              </span>
            </div>
          </div>

          {/* Required docs grid */}
          <div key={selectedEntityType} className="doc-grid" style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            justifyContent: "center", 
            gap: 20 
          }}>
            {requiredDocGroups.map((group) => (
              <div
                key={group.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, padding: 18, transition: "all 0.25s ease",
                  position: "relative", overflow: "hidden",
                  boxShadow: "0 14px 40px rgba(2,12,27,0.28)",
                  flex: "1 1 340px",
                  maxWidth: 380,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 18px 48px rgba(2,12,27,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 14px 40px rgba(2,12,27,0.28)";
                }}
              >
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(135deg, rgba(239,68,68,0.04), transparent 42%, rgba(6,182,212,0.04))",
                  pointerEvents: "none",
                }} />

                <div style={{
                  position: "relative", zIndex: 1,
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                  gap: 10, marginBottom: 14, flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 7,
                      background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center",
                      justifyContent: "center", border: "1px solid rgba(239,68,68,0.30)", flexShrink: 0,
                    }}>
                      <group.icon size={13} color="#f97316" />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 3px" }}>{group.label}</h4>
                      <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{group.description}</p>
                    </div>
                  </div>
                  <div style={{
                    padding: "3px 8px", borderRadius: 999,
                    background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)",
                    color: "#a7f3d0", fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>
                    Required
                  </div>
                </div>

                <div className="doc-items-grid" style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {group.keys.map((docKey) => {
                    const Icon = getIconForDoc(docKey);
                    return (
                      <div
                        key={docKey}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 10, background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8, padding: "8px 10px", transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                          e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: 6,
                            background: "rgba(239,68,68,0.12)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            <Icon size={11} color="#f97316" />
                          </span>
                          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500, lineHeight: 1.4 }}>
                            {DPIIT_DOCUMENTS[docKey]}
                          </span>
                        </div>
                        <CheckCircle2 size={12} color="#10b981" style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Optional + Conditional docs */}
          <div key={`${selectedEntityType}-secondary`} className="doc-grid-secondary" style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            justifyContent: "center", 
            gap: 18, 
            marginTop: 18 
          }}>

            {/* Optional */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: 18,
              flex: "1 1 400px",
              maxWidth: 580,
            }}>
              <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                gap: 12, marginBottom: 14, flexWrap: "wrap",
              }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Optional Support Documents</h4>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Helpful for review, but not mandatory in the form.</p>
                </div>
                <div style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#cbd5e1", fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>
                  Optional
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {optionalDocs.map((docKey) => {
                  const Icon = getIconForDoc(docKey);
                  return (
                    <div key={docKey} style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 999, padding: "7px 10px",
                    }}>
                      <Icon size={11} color="#94a3b8" />
                      <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 500 }}>{DPIIT_DOCUMENTS[docKey]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conditional */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: 18,
              flex: "1 1 400px",
              maxWidth: 580,
            }}>
              <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                gap: 12, marginBottom: 14, flexWrap: "wrap",
              }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Conditional Document</h4>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Required only when the office occupancy is rented or leased.</p>
                </div>
                <div style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.20)",
                  color: "#fcd34d", fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>
                  Conditional
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {conditionalDocs.map((docKey) => {
                  const Icon = getIconForDoc(docKey);
                  return (
                    <div key={docKey} style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 999, padding: "7px 10px",
                    }}>
                      <Icon size={11} color="#fbbf24" />
                      <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{DPIIT_DOCUMENTS[docKey]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {/* ✅ className="stats-grid" for mobile 2x2 reflow — outer wrapper div removed */}
        <div className="stats-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14, overflow: "hidden", margin: "0 auto 48px", position: "relative",
        }}>
          {stats.map(({ value, label }, i) => (
            <div key={i} style={{
              padding: "22px 12px", textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
              position: "relative", zIndex: 1,
            }}>
              <div style={{
                fontSize: value.length > 8 ? 16 : 24, fontWeight: 800,
                color: "#f97316",
                marginBottom: 6,
              }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── ELIGIBILITY NOTICE ── */}
        <div style={{
          margin: "0 auto 48px", padding: "18px 22px",
          background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.2)",
          borderRadius: 18, display: "flex", gap: 16, alignItems: "flex-start",
        }}>
          <AlertCircle size={22} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa", margin: "0 0 8px" }}>
              Important: DPIIT Eligibility
            </h4>
            <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7, margin: 0 }}>
              Your startup should be less than 10 years old, have annual turnover under ₹100 Cr, and work towards
              innovation / development of new products or services. Our experts will verify eligibility before filing.
            </p>
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        {/* ✅ className="bottom-cta" for mobile padding override */}
        <div className="bottom-cta" style={{
          position: "relative", borderRadius: 24, overflow: "hidden",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
          padding: "44px 24px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          margin: "0 auto",
        }}>
          <div style={{
            position: "absolute", top: -80, right: -80, width: 240, height: 240,
            background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)",
            filter: "blur(70px)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -80, left: -80, width: 240, height: 240,
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
            filter: "blur(70px)", pointerEvents: "none",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* ✅ clamp() on CTA heading */}
            <h2 style={{
              fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, color: "#fff",
              marginBottom: 14, lineHeight: 1.2,
            }}>
              Ready to scale your{" "}
              <span style={{ color: "#f97316" }}>
                startup journey?
              </span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 15, margin: "0 auto 36px", maxWidth: 520, lineHeight: 1.7 }}>
              Join 5,000+ startups who trusted RegiBIZ for their DPIIT Recognition and benefits.
            </p>
            <PayBtn
              label={`Start Application — ₹${basePrice.toLocaleString()} + GST`}
              onClick={handleStartApplication}
              disabled={isProcessing}
              style={{
                borderRadius: 14, padding: "14px 20px", fontSize: 14,
                boxShadow: G.blueGlow,
              }}
            />
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 18, fontWeight: 500 }}>
              <span style={{ color: "#60a5fa" }}>✓</span> No upfront payment &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> No hidden charges &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> Form-based service onboarding
            </p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{
          marginTop: 56, paddingTop: 28, paddingBottom: 28,
          textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }

        /* ── MOBILE ≤640px ── */
        @media (max-width: 640px) {
          .hero-grid          { grid-template-columns: 1fr !important; gap: 24px !important; }
          .doc-grid           { grid-template-columns: 1fr !important; }
          .doc-items-grid     { grid-template-columns: 1fr !important; }
          .doc-grid-secondary { grid-template-columns: 1fr !important; }
          .stats-grid         { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div:nth-child(2) { border-right: none !important; }
          .stats-grid > div:nth-child(1),
          .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .info-stats-grid    { grid-template-columns: 1fr !important; }
          .info-stats-grid > div { border-right: none !important; border-bottom: 1px solid rgba(6,182,212,0.12); }
          .info-stats-grid > div:last-child { border-bottom: none !important; }
          .header-cta         { display: none !important; }
          .mobile-cta-bar     { display: block !important; }
          .mobile-cta-bar button { width: 100% !important; font-size: 13px !important; padding: 12px 12px !important; }
          .bottom-cta         { padding: 40px 20px !important; }
          .startup-service-main { padding: 24px 14px !important; }
        }

        /* ── TABLET 641px–900px ── */
        @media (min-width: 641px) and (max-width: 900px) {
          .hero-grid          { grid-template-columns: 1fr !important; gap: 28px !important; }
          .doc-grid           { grid-template-columns: 1fr !important; }
          .doc-items-grid     { grid-template-columns: repeat(2, 1fr) !important; }
          .doc-grid-secondary { grid-template-columns: 1fr !important; }
        }

        /* ── LARGE TABLET 901px–1024px ── */
        @media (min-width: 901px) and (max-width: 1024px) {
          .doc-grid           { grid-template-columns: repeat(2, 1fr) !important; }
          .doc-grid-secondary { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
