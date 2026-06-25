import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  Phone,
  ShieldCheck,
  Star,
  Store,
  User,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from "../data/pricingConfig";

type EntityType = "pvt_ltd" | "llp" | "partnership" | "proprietorship";
type DocKey =
  | "incorporation"
  | "premises"
  | "directors"
  | "pan"
  | "bank"
  | "employees"
  | "electricity"
  | "ownerId"
  | "ownerAddress"
  | "photo"
  | "authorization";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}

const SERVICE_ID = "shop-establishment";
const BASE_PRICE = PRICING_CONFIG[SERVICE_ID]?.fee || 1999;
const GST_AMOUNT = calculateGST(BASE_PRICE);
const TOTAL_PRICE = calculateTotalWithGST(BASE_PRICE);

const GRADIENTS = {
  heading: "linear-gradient(to right, #ef4444, #f97316)",
  button: "linear-gradient(to right, #0f766e, #075985, #1e3a8a)",
  buttonHover: "linear-gradient(to right, #115e59, #0c4a6e, #1e40af)",
  buttonGlow: "0 4px 20px rgba(6, 182, 212, 0.35)",
};

const PRICE_STYLE: React.CSSProperties = {
  color: "#34d399",
  fontWeight: 900,
  textShadow: "0 0 18px rgba(52, 211, 153, 0.35)",
};

const DOCUMENTS: Record<DocKey, string> = {
  incorporation: "Incorporation Certificate, MoA and AoA",
  premises: "Rent Agreement / Sale Deed with property tax receipt",
  directors: "Directors / partners list with Aadhaar and PAN",
  pan: "Company / firm PAN card",
  bank: "Bank statement till date",
  employees: "Employee details Excel with DOJ and salary",
  electricity: "Recent electricity bill of the property",
  ownerId: "Employer / authorised signatory ID proof",
  ownerAddress: "Employer / authorised signatory address proof",
  photo: "Passport-size photograph",
  authorization: "Board resolution / authorization letter",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  { id: "entity", label: "Entity Documents", icon: Building2, keys: ["incorporation", "pan", "authorization"] },
  { id: "premises", label: "Premises Proof", icon: Store, keys: ["premises", "electricity"] },
  { id: "signatory", label: "Employer / Signatory", icon: User, keys: ["directors", "ownerId", "ownerAddress", "photo"] },
  { id: "operations", label: "Operations & Bank", icon: Landmark, keys: ["bank", "employees"] },
];

const ENTITY_OPTIONS: {
  id: EntityType;
  label: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  timeline: string;
  tagline: string;
  highlights: string[];
}[] = [
    {
      id: "pvt_ltd",
      label: "Private Limited Company",
      shortLabel: "Pvt Ltd",
      badge: "Most Common",
      badgeColor: "#f97316",
      icon: Building2,
      timeline: "7-10 Days",
      tagline: "License filing for incorporated businesses",
      highlights: [
        "COI, MoA, AoA and company PAN captured",
        "Director / authorised signatory KYC collected",
        "Premises proof and electricity bill checklist",
        "Employee details prepared for department filing",
      ],
    },
    {
      id: "llp",
      label: "Limited Liability Partnership",
      shortLabel: "LLP",
      badge: "Professional",
      badgeColor: "#06b6d4",
      icon: BadgeCheck,
      timeline: "7-10 Days",
      tagline: "Shop Act license support for LLP firms",
      highlights: [
        "LLP incorporation and PAN documents verified",
        "Designated partner details collected cleanly",
        "Premises occupancy proof checked before filing",
        "Application status tracked in Documents module",
      ],
    },
    {
      id: "partnership",
      label: "Partnership Firm",
      shortLabel: "Partnership",
      badge: "Traditional",
      badgeColor: "#8b5cf6",
      icon: Users,
      timeline: "10-15 Days",
      tagline: "Registration filing for partnership firms",
      highlights: [
        "Firm PAN and partner KYC reviewed",
        "Premises and business activity details organized",
        "Employee and working-hour details captured",
        "Certificate deliverable tracked after submission",
      ],
    },
    {
      id: "proprietorship",
      label: "Sole Proprietorship",
      shortLabel: "Proprietorship",
      badge: "Simple",
      badgeColor: "#10b981",
      icon: User,
      timeline: "7-10 Days",
      tagline: "License support for owner-managed shops",
      highlights: [
        "Proprietor PAN, Aadhaar and photo collected",
        "Shop address and occupancy details validated",
        "Employee and weekly-holiday details captured",
        "Suitable for shops, offices and service centres",
      ],
    },
  ];

const PROCESS_STEPS = [
  { num: "01", title: "Share Details", desc: "Select entity type and complete secure payment", color: "#60a5fa" },
  { num: "02", title: "Business Profile", desc: "Enter constitution, premises, owner and employee details", color: "#60a5fa" },
  { num: "03", title: "Upload Documents", desc: "Submit identity, premises, employee and bank documents", color: "#60a5fa" },
  { num: "04", title: "Expert Review", desc: "Our team verifies details before department filing", color: "#60a5fa" },
  { num: "05", title: "Application Filing", desc: "Application is prepared and filed on the applicable portal", color: "#60a5fa" },
  { num: "06", title: "Certificate Delivery", desc: "Registration certificate is delivered and tracked in documents", color: "#60a5fa" },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (["bank"].includes(key)) return Landmark;
  if (["employees"].includes(key)) return FileSpreadsheet;
  if (["directors", "ownerId", "ownerAddress", "photo"].includes(key)) return User;
  if (["premises", "electricity"].includes(key)) return Store;
  return FileText;
};

const PayBtn = ({
  label,
  onClick,
  isProcessing,
  style = {},
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  isProcessing: boolean;
  style?: React.CSSProperties;
  variant?: "primary" | "secondary";
}) => {
  const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isProcessing}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontWeight: 800,
        cursor: isProcessing ? "not-allowed" : "pointer",
        opacity: isProcessing ? 0.7 : 1,
        transition: "all 0.25s ease",
        border: "none",
        color: "#fff",
        borderRadius: 12,
        background: baseGradient,
        boxShadow: variant === "primary" ? GRADIENTS.buttonGlow : "none",
        whiteSpace: "nowrap",
        ...style,
      }}
      onMouseEnter={(event) => {
        if (!isProcessing) {
          event.currentTarget.style.background = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;
          event.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = baseGradient;
        event.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {isProcessing ? (
        <>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...
        </>
      ) : (
        <>
          {label}
          <ArrowRight size={16} />
        </>
      )}
    </button>
  );
};

export default function ShopEstablishmentLicense() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<EntityType>("pvt_ltd");

  useEffect(() => {
    const preSelectedType = location.state?.preSelectedType;
    if (
      location.state?.requirementsConfirmed &&
      ["pvt_ltd", "llp", "partnership", "proprietorship"].includes(preSelectedType) &&
      activeTab !== preSelectedType
    ) {
      setActiveTab(preSelectedType);
    }
  }, [location.state, activeTab]);

  const activeType = ENTITY_OPTIONS.find((item) => item.id === activeTab) || ENTITY_OPTIONS[0];
  const steps = [
    { step: "01", title: "Share Details", desc: "Select constitution and make secure payment", icon: FileText },
    { step: "02", title: "Expert Verification", desc: "Our team checks documents and business details", icon: ShieldCheck },
    { step: "03", title: "Get Certificate", desc: `Receive your certificate in ${activeType.timeline}`, icon: CheckCircle2 },
  ];

  const startApplication = () => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/shop-establishment-license/requirements", {
        state: { preSelectedType: activeTab },
      });
      return;
    }
    setIsProcessing(true);
    navigate("/services/shop-establishment-license/form", {
      state: { entityType: activeTab, totalCost: BASE_PRICE, totalPaid: TOTAL_PRICE },
    });
    setTimeout(() => setIsProcessing(false), 800);
  };

  const requestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-[#e2e8f0]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(2,12,27,0.95)",
          backdropFilter: "blur(24px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <button
                type="button"
                onClick={() => navigate("/services")}
                disabled={isProcessing}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: "7px",
                  cursor: "pointer",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: "#60a5fa", fontSize: 16, fontWeight: 800 }}>Shop & Establishment License</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#fff",
                      background: GRADIENTS.button,
                      borderRadius: 20,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    SHOP ACT
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Registration certificate support</p>
              </div>
            </div>

            <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, ...PRICE_STYLE }}>₹{TOTAL_PRICE.toLocaleString("en-IN")}</div>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, whiteSpace: "nowrap" }}>
                  ₹{BASE_PRICE.toLocaleString("en-IN")} + GST
                </p>
              </div>
              <PayBtn label="Start Now" style={{ padding: "10px 18px", fontSize: 13 }} onClick={startApplication} isProcessing={isProcessing} />
            </div>
          </div>

          <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
            <PayBtn
              label={`Start Application — ₹${BASE_PRICE.toLocaleString("en-IN")} + GST`}
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
              onClick={startApplication}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 64, alignItems: "start" }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 20,
                padding: "5px 14px",
                marginBottom: 20,
              }}
            >
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 800 }}>Shop Act Registration Service</span>
            </div>

            <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 900, color: "#fff", lineHeight: 1.12, margin: "0 0 14px" }}>
              Get Shop Act License
              <br />
              in 3 Simple Steps
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.7, marginBottom: 28, maxWidth: 500 }}>
              Apply for Shop & Establishment registration with guided details, secure payment, document upload, and application tracking.
            </p>

            <div style={{ marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Building2 size={13} color="#ef4444" /> Choose Your Business Type
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  padding: 4,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                }}
              >
                {ENTITY_OPTIONS.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setActiveTab(type.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: 12,
                      transition: "all 0.25s ease",
                      background: activeTab === type.id ? GRADIENTS.button : "transparent",
                      color: activeTab === type.id ? "#fff" : "#6b7280",
                      boxShadow: activeTab === type.id ? GRADIENTS.buttonGlow : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <type.icon size={13} />
                    {type.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "rgba(6,182,212,0.1)",
                border: "1px solid rgba(6,182,212,0.2)",
                borderRadius: 14,
                padding: "14px 18px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ShieldCheck size={20} color="#06b6d4" />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff" }}>
                Service Fee: <span style={{ color: "#22d3ee" }}>₹{BASE_PRICE.toLocaleString("en-IN")}</span>{" "}
                <span style={{ color: "#9ca3af", fontSize: 13 }}>+GST+ Govt Charges Applicable.</span>
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: "16px 18px",
                marginBottom: 22,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(239,68,68,0.25)",
                    flexShrink: 0,
                  }}
                >
                  <activeType.icon size={16} color="#f97316" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{activeType.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: "#fff",
                        background: activeType.badgeColor,
                        borderRadius: 20,
                        padding: "2px 8px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {activeType.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>{activeType.tagline}</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {activeType.highlights.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <CheckCircle2 size={13} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#d1d5db" }}>{item}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
                {[
                  { label: "Timeline", value: activeType.timeline },
                  { label: "GST", value: `₹${GST_AMOUNT.toLocaleString("en-IN")}` },
                  { label: "Total", value: `₹${TOTAL_PRICE.toLocaleString("en-IN")}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ flex: 1, minWidth: 80 }}>
                    <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 3px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                    <p style={{ fontSize: 12, color: "#60a5fa", margin: 0, fontWeight: 800 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: <Clock size={13} color="#f97316" />, label: `${activeType.timeline} Turnaround` },
                { icon: <CreditCard size={13} color="#06b6d4" />, label: "Secure Payment" },
                { icon: <ShieldCheck size={13} color="#10b981" />, label: "Expert Reviewed" },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 12px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {icon}
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 24,
              padding: 32,
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <h3 style={{ fontSize: 19, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 6 }}>How it works</h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>Shop Act License — {activeType.label}</p>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, index) => (
                <div key={item.step} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: GRADIENTS.button,
                        border: "2px solid rgba(255,255,255,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: GRADIENTS.buttonGlow,
                        zIndex: 1,
                      }}
                    >
                      <item.icon size={18} color="#fff" />
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        style={{
                          width: 2,
                          height: 32,
                          background: "linear-gradient(to bottom, rgba(6,182,212,0.5), rgba(6,182,212,0.08))",
                          margin: "6px 0",
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: index < steps.length - 1 ? 20 : 0, paddingTop: 8, flex: 1 }}>
                    <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", display: "inline-block" }}>STEP {item.step}</span>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: "4px 0" }}>{item.title}</h4>
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
                  • Shop & Establishment registration certificate in digital format
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Acknowledgment receipt and application tracking details for government portal
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Expert support for any queries during the application process
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                type="button"
                onClick={requestCallback}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Phone size={14} color="#f97316" />
                <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Callback</span>
              </button>
              <PayBtn label="Avail Service" style={{ flex: 1, padding: "12px 14px", fontSize: 13, borderRadius: 12 }} onClick={startApplication} isProcessing={isProcessing} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                marginTop: 20,
                background: "rgba(6,182,212,0.06)",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(6,182,212,0.15)",
              }}
            >
              {[
                { value: "Online", label: "Process" },
                { value: activeType.timeline, label: "Turnaround" },
                { value: "Tracked", label: "Documents" },
              ].map(({ value, label }, index) => (
                <div
                  key={label}
                  style={{
                    padding: "12px 8px",
                    textAlign: "center",
                    borderRight: index < 2 ? "1px solid rgba(6,182,212,0.12)" : "none",
                  }}
                >
                  <div style={{ fontSize: value.length > 7 ? 12 : 16, fontWeight: 900, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 900, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Filing Process</p>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 900, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 12px" }}>
              Shop Act Filing Steps
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>End-to-end process from application details to certificate delivery.</p>
          </div>
          <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {PROCESS_STEPS.map((item) => (
              <div
                key={item.num}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: "18px 16px",
                  transition: "all 0.25s",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 900, color: item.color, opacity: 0.2, position: "absolute", top: 10, right: 14, lineHeight: 1 }}>{item.num}</div>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${item.color}20`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: item.color }}>{item.num}</span>
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>{item.title}</h4>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 900, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Checklist</p>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 900, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 12px" }}>
              Documents Required
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>Keep these ready in digital format for a smooth application process.</p>
          </div>

          <div className="doc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {DOCUMENT_GROUPS.map((group) => (
              <div key={group.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0 }}>
                    <group.icon size={17} color="#f97316" />
                  </div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{group.label}</h4>
                </div>

                <div className="doc-items-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {group.keys.map((docKey) => {
                    const Icon = getIconForDoc(docKey);
                    return (
                      <div key={docKey} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 10px" }}>
                        <Icon size={13} color="#f97316" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "#d1d5db", fontWeight: 600, lineHeight: 1.3 }}>{DOCUMENTS[docKey]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden", marginBottom: 64 }}>
          {[
            { value: `₹${BASE_PRICE.toLocaleString("en-IN")}`, label: "Service Fee" },
            { value: `₹${GST_AMOUNT.toLocaleString("en-IN")}`, label: "GST" },
            { value: activeType.timeline, label: "Turnaround" },
            { value: "Certificate", label: "Deliverable" },
          ].map(({ value, label }, index) => (
            <div key={label} style={{ padding: "22px 12px", textAlign: "center", borderRight: index < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
              <div style={{ fontSize: value.length > 8 ? 16 : 24, fontWeight: 900, ...(index === 0 ? PRICE_STYLE : { background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }), marginBottom: 6 }}>{value}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "40px 20px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900, color: "#fff", marginBottom: 14, lineHeight: 1.2 }}>
            Ready to register your{" "}
            <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{activeType.shortLabel}</span> establishment?
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 36, maxWidth: 540, margin: "0 auto 36px", lineHeight: 1.7 }}>
            Complete payment, upload documents, and track your certificate from the Documents module.
          </p>
          <PayBtn label={`Start Application — ₹${BASE_PRICE.toLocaleString("en-IN")} + 18% GST`} style={{ borderRadius: 14, padding: "14px 20px", fontSize: 14, maxWidth: "50%", width: "50%" }} onClick={startApplication} isProcessing={isProcessing} />
          <p style={{ fontSize: 12, color: "#4b5563", marginTop: 18, fontWeight: 600 }}>
            <span style={{ color: "#60a5fa" }}>✓</span> Secure payment &nbsp;•&nbsp;
            <span style={{ color: "#60a5fa" }}>✓</span> Document tracking &nbsp;•&nbsp;
            <span style={{ color: "#60a5fa" }}>✓</span> Expert verification
          </p>
        </div>

        <footer style={{ marginTop: 56, paddingTop: 28, paddingBottom: 28, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }

        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .doc-items-grid { grid-template-columns: 1fr !important; }
          .process-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div:nth-child(2) { border-right: none !important; }
          .stats-grid > div:nth-child(1),
          .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .header-cta { display: none !important; }
          .mobile-cta-bar { display: block !important; }
        }

        @media (min-width: 641px) and (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .process-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
