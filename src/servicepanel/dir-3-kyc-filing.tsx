// src/servicepanel/dir-3-kyc-filing.tsx
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
  Badge,
  Mail,
  Calendar,
  MessageCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST, calculateGST } from "../data/pricingConfig";
import { initiateRazorpayPayment, RazorpaySuccessResponse } from "../services/razorpayService";


// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "panCard" | "aadhaar" | "passport" | "photo"
  | "mobileNumber" | "email" | "addressProof" | "nationality"
  | "dateOfBirth";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}


// ─────────────────────────────────────────────
// DOCUMENT DATA (Tailored for DIR-3 KYC)
// ─────────────────────────────────────────────
const DIR3KYC_DOCUMENTS: Record<DocKey, string> = {
  panCard: "PAN Card (Mandatory for Indian Nationals)",
  aadhaar: "Aadhaar Card (For Indian Nationals)",
  passport: "Passport (For Foreign Nationals)",
  photo: "Recent Passport Size Photograph",
  mobileNumber: "Mobile Number (OTP Verification Required)",
  email: "Personal Email Address (OTP Verification Required)",
  addressProof: "Address Proof (Utility Bill / Bank Statement)",
  nationality: "Nationality Proof",
  dateOfBirth: "Date of Birth Proof",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "identity",
    label: "Identity Proof",
    icon: Badge,
    keys: ["panCard", "aadhaar", "passport", "photo"],
  },
  {
    id: "contact",
    label: "Contact Details",
    icon: Mail,
    keys: ["mobileNumber", "email", "addressProof"],
  },
  {
    id: "personal",
    label: "Personal Information",
    icon: User,
    keys: ["nationality", "dateOfBirth", "panCard"],
  },
  {
    id: "general",
    label: "General Requirements",
    icon: FileText,
    keys: ["panCard", "aadhaar", "mobileNumber", "email"],
  },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (["panCard", "aadhaar", "passport"].includes(key)) return Badge;
  if (["mobileNumber", "email"].includes(key)) return Mail;
  if (["photo"].includes(key)) return User;
  if (["dateOfBirth"].includes(key)) return Calendar;
  if (["addressProof", "nationality"].includes(key)) return FileText;
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
// PAY BUTTON (matching GST fix pattern)
// ─────────────────────────────────────────────
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
        position: "relative", overflow: "hidden",
        // FIX 3: prevent button text overflow on narrow screens
        whiteSpace: "nowrap", maxWidth: "100%", textOverflow: "ellipsis",
        boxSizing: "border-box",
        ...style,
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
export default function DIR3KYCFiling() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleInitiatePayment = async () => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/dir-3-kyc-filing/requirements");
      return;
    }
    setIsProcessing(true);
    try {
      await initiateRazorpayPayment({
        amount: Math.round(calculateTotalWithGST(PRICING_CONFIG["dir-3-kyc"].fee) * 100),
        currency: "INR",
        name: "RegiBIZ - DIR-3 KYC Filing",
        description: `Service Fee: ₹${PRICING_CONFIG["dir-3-kyc"].fee} + GST (18%): ₹${calculateGST(PRICING_CONFIG["dir-3-kyc"].fee)} = Total: ₹${calculateTotalWithGST(PRICING_CONFIG["dir-3-kyc"].fee)}`,
        prefill: {
          name: localStorage.getItem("userName") || "",
          email: localStorage.getItem("userEmail") || "",
          contact: localStorage.getItem("userPhone") || "",
        },
        notes: { service: "dir-3-kyc-filing", source: "landing-page" },
        handler: (response: RazorpaySuccessResponse) => {
          sessionStorage.setItem("dir3kyc_payment_id", response.razorpay_payment_id);
          navigate("/services/dir-3-kyc-filing/form", {
            state: {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              verified: true,
            },
          });
        },
        onClosed: () => setIsProcessing(false),
      });
    } catch (error) {
      console.error("❌ Payment error:", error);
      alert("Something went wrong.");
      setIsProcessing(false);
    }
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const benefits = [
    { text: "Annual KYC for All Directors", icon: ShieldCheck },
    { text: "Mandatory Even for DIN Holders", icon: BadgeCheck },
    { text: "OTP Verification on Mobile & Email", icon: Lock },
    { text: "Avoid DIN Deactivation", icon: AlertCircle },
  ];

  const steps = [
    { step: "01", title: "Submit KYC Details", desc: "Provide PAN, Aadhaar, Contact Details", icon: Badge },
    { step: "02", title: "OTP Verification", desc: "Verify mobile number and email via OTP", icon: Lock },
    { step: "03", title: "MCA Filing", desc: "File DIR-3 KYC form on MCA portal", icon: Landmark },
  ];

  const stats = [
    { value: "5,000+", label: "DIR-3 KYC Filed" },
    { value: "24 Hrs", label: "Processing Time" },
    { value: "100%", label: "Compliance Rate" },
    { value: "₹699 + GST", label: "Professional Service Fee" },
  ];

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
                onClick={() => navigate("/services")}
                disabled={isProcessing}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "7px", cursor: isProcessing ? "not-allowed" : "pointer",
                  color: "#6b7280", display: "flex", alignItems: "center",
                  transition: "all 0.2s", flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.color = "#f97316";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                    e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{
                    color: "#60a5fa", fontSize: 16, fontWeight: 800,
                    textShadow: "0 0 20px rgba(249,115,22,0.15)",
                  }}>DIR-3 KYC</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: GRADIENTS.button, borderRadius: 20,
                    padding: "2px 8px", letterSpacing: "0.05em",
                    boxShadow: GRADIENTS.buttonGlow,
                  }}>Annual Filing</span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 15,000+ directors</p>
              </div>
            </div>

            {/* FIX 1: No inline display — CSS class controls visibility */}
            <div className="header-cta" style={{ alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>₹699 + GST</div>
                <p style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                  + <span style={{ color: "#22d3ee" }}>Govt charges applicable</span>
                </p>
              </div>
              <PayBtn
                label="Start Now"
                style={{ padding: "10px 18px", fontSize: 13 }}
                onClick={handleInitiatePayment}
                isProcessing={isProcessing}
              />
            </div>
          </div>

          {/* FIX 2: No inline display — CSS class controls visibility */}
          <div className="mobile-cta-bar" style={{ marginTop: 10 }}>
            <PayBtn
              label="Start Application — ₹699 + GST"
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10, boxSizing: "border-box" }}
              onClick={handleInitiatePayment}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>

        {/* PRICE HIGHLIGHT BANNER */}
        <div style={{
          background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)",
          borderRadius: 16, padding: "16px 24px", marginBottom: 32,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <ShieldCheck size={24} color="#06b6d4" />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
            Service Fee: <span style={{ color: "#22d3ee" }}>₹699 +GST+ Govt Charges Applicable.</span>
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
              boxShadow: "0 0 20px rgba(239,68,68,0.15)",
            }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                Fastest DIR-3 KYC Service
              </span>
            </div>

            <h1 style={{
              fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, color: "#fff",
              lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em",
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}>
              Director KYC<br />
              <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>
                Compliance Filing
              </span>
            </h1>

            <p style={{ color: "#9ca3af", fontSize: 15, lineHeight: 1.7, marginBottom: 28, maxWidth: 480 }}>
              Annual KYC filing for all DIN holders. Mandatory for every director to keep DIN active. Simple OTP-based verification process.
            </p>

            {/* Benefits */}
            <div style={{ marginBottom: 28 }}>
              <p style={{
                fontSize: 11, fontWeight: 800,
                letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <ShieldCheck size={13} color="#ef4444" /> Why Choose RegiBIZ?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {benefits.map(({ text, icon: Icon }, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, padding: "12px 16px", transition: "all 0.2s", cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
                      e.currentTarget.style.background = "rgba(239,68,68,0.06)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, border: "1px solid rgba(239,68,68,0.25)",
                    }}>
                      <Icon size={15} color="#f97316" />
                    </div>
                    <span style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.5, fontWeight: 500 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: <Clock size={13} color="#f97316" />, label: "24 Hr Processing" },
                { icon: <CreditCard size={13} color="#06b6d4" />, label: "Secure Payment" },
                { icon: <Lock size={13} color="#10b981" />, label: "OTP Verified" },
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
            <div style={{
              position: "absolute", inset: 0, borderRadius: 24, padding: "1px",
              background: GRADIENTS.button,
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor", maskComposite: "exclude",
              pointerEvents: "none", opacity: 0.4,
            }} />

            <h3 style={{
              fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 6,
            }}>
              How it works
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
              Annual KYC filing for DIN holders
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
                  • DIR-3 KYC filing on MCA portal
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Acknowledgment receipt for MCA filing 
                </p>
              </div>
            </div>

            {/* FIX 7: flexWrap + minWidth so buttons wrap on narrow screens */}
            <div style={{ display: "flex", gap: 8, marginTop: 28, flexWrap: "wrap" }}>
              <button
                onClick={handleRequestCallback}
                disabled={isProcessing}
                style={{
                  flex: 1, minWidth: 120, background: "transparent",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 12, padding: "12px 14px", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s",
                  boxSizing: "border-box",
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <MessageCircle size={14} color="#f97316" />
                <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Chat Us
                </span>
              </button>
              <PayBtn
                label="Avail Service"
                style={{ flex: 1, minWidth: 120, padding: "12px 14px", fontSize: 13, borderRadius: 12 }}
                onClick={handleInitiatePayment}
                isProcessing={isProcessing}
              />
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 20,
              background: "rgba(6,182,212,0.06)", borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(6,182,212,0.15)",
            }}>
              {[{ v: "15K+", l: "KYC Filed" }, { v: "24 Hrs", l: "Processing" }, { v: "100%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{
                  padding: "12px 8px", textAlign: "center",
                  borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none",
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DOCUMENTS SECTION ── */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{
              fontSize: 11, fontWeight: 800, background: GRADIENTS.heading,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
            }}>
              Checklist
            </p>
            <h2 style={{
              fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800,
              background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              margin: "0 0 12px", textShadow: GRADIENTS.headingGlow,
            }}>
              Documents Required
            </h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
              Keep these documents ready. Mobile and email must be active for OTP verification.
            </p>
          </div>

          <div className="doc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {DOCUMENT_GROUPS.map((group) => (
              <div
                key={group.id}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 18, padding: 22, transition: "all 0.25s",
                  position: "relative", overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
                  e.currentTarget.style.background = "rgba(239,68,68,0.05)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, position: "relative", zIndex: 1 }}>
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
                      <div
                        key={docKey}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 10, padding: "9px 10px", transition: "all 0.2s",
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
                        <Icon size={13} color="#f97316" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "#d1d5db", fontWeight: 500, lineHeight: 1.3 }}>
                          {DIR3KYC_DOCUMENTS[docKey]}
                        </span>
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
          borderRadius: 20, overflow: "hidden", marginBottom: 64, position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 20, padding: "1px",
            background: GRADIENTS.heading,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor", maskComposite: "exclude",
            pointerEvents: "none", opacity: 0.3,
          }} />
          {stats.map(({ value, label }, i) => (
            <div key={i} style={{
              padding: "22px 12px", textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
              position: "relative", zIndex: 1,
            }}>
              <div style={{
                fontSize: value.length > 8 ? 16 : 24, fontWeight: 800,
                background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                marginBottom: 6, textShadow: "0 0 25px rgba(249,115,22,0.2)",
              }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── IMPORTANT NOTICE ── */}
        <div style={{
          marginBottom: 64, padding: "24px",
          background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)",
          borderRadius: 18, display: "flex", gap: 16, alignItems: "start",
        }}>
          <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", marginBottom: 8, marginTop: 0 }}>
              Important: Annual Filing Deadline
            </h4>
            <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6, margin: 0 }}>
              DIR-3 KYC must be filed annually before 30th September. Late filing attracts a fee of ₹5,000 and may result in DIN deactivation. Applicable for all DIN holders.
            </p>
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{
          position: "relative", borderRadius: 24, overflow: "hidden",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
          padding: "40px 20px", textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}>
          <div style={{
            position: "absolute", top: -80, right: -80, width: 240, height: 240,
            background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)",
            filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", bottom: -80, left: -80, width: 240, height: 240,
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
            filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{
              fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800, color: "#fff",
              marginBottom: 14, letterSpacing: "-0.025em", lineHeight: 1.2,
            }}>
              File DIR-3 KYC{" "}
              <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>
                Today
              </span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 15, marginBottom: 36, maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.7 }}>
              Keep your DIN active. Quick OTP-based verification and filing.
            </p>
            {/* FIX 5: boxSizing border-box + reduced horizontal padding */}
            <PayBtn
              label="Start DIR-3 KYC Now — ₹699 + GST"
              variant="primary"
              style={{
                borderRadius: 14, padding: "14px 16px", fontSize: 14,
                width: "50%", boxSizing: "border-box",
                boxShadow: "0 10px 40px rgba(239,68,68,0.35)",
              }}
              onClick={handleInitiatePayment}
              isProcessing={isProcessing}
            />
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 18, fontWeight: 500 }}>
              <span style={{ color: "#60a5fa" }}>✓</span> MCA Compliant &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> No hidden charges &nbsp;•&nbsp;
              <span style={{ color: "#60a5fa" }}>✓</span> OTP Verified
            </p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 56, paddingTop: 28, paddingBottom: 28, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }

        /* FIX 1 & 2: Control header-cta and mobile-cta-bar via CSS only — no inline display */
        .header-cta { display: flex; }
        .mobile-cta-bar { display: none; }

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .doc-items-grid { grid-template-columns: 1fr !important; }

          /* FIX 4: Correct 2-col stats border — remove right border on even children */
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div:nth-child(even) { border-right: none !important; }
          .stats-grid > div:nth-child(1),
          .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
          .stats-grid > div:nth-child(3),
          .stats-grid > div:nth-child(4) { border-bottom: none !important; }

          /* FIX 1 & 2: Swap desktop CTA for mobile bar */
          .header-cta { display: none !important; }
          .mobile-cta-bar { display: block !important; }
        }

        @media (min-width: 641px) and (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .doc-items-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* FIX 6: Collapse doc-items to single col at 768px before cells get too narrow */
        @media (max-width: 768px) {
          .doc-items-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 1024px) {
          .doc-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
