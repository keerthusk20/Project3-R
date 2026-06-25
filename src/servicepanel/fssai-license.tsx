// src/servicepanel/fssai-license.tsx
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
  MapPin,
  Award,
  IndianRupee,
  MessageCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST, calculateGST } from "../data/pricingConfig";
import { initiateRazorpayPayment, RazorpaySuccessResponse } from "../services/razorpayService";


// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "aadhaar" | "pan" | "photo" | "electricityBill"
  | "rentAgreement" | "noc" | "cancelledCheque" | "businessProof";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  keys: DocKey[];
}



// ─────────────────────────────────────────────
// SIMPLIFIED DOCUMENT DATA (Customer Friendly)
// ─────────────────────────────────────────────
const FSSAI_DOCUMENTS: Record<DocKey, string> = {
  aadhaar: "Aadhaar Card (Directors/Partners)",
  pan: "PAN Card (Directors/Partners)",
  photo: "Passport Size Photograph",
  electricityBill: "Latest Electricity Bill",
  rentAgreement: "Rent Agreement (If Rented)",
  noc: "NOC from Owner (If Rented)",
  cancelledCheque: "Cancelled Cheque",
  businessProof: "Bank Statement  ",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "personal",
    label: "Personal KYC",
    icon: User,
    description: "Identity proof of Directors/Partners",
    keys: ["aadhaar", "pan", "photo"],
  },
  {
    id: "address",
    label: "Business Address",
    icon: MapPin,
    description: "Proof of where business operates",
    keys: ["electricityBill", "rentAgreement", "noc"],
  },
  {
    id: "bank",
    label: "Bank Details",
    icon: Landmark,
    description: "For verification purposes",
    keys: ["cancelledCheque", "businessProof"],
  },
];


// ─────────────────────────────────────────────
// COLOR CONSTANTS (Your Gradients)
// ─────────────────────────────────────────────
const GRADIENTS = {
  heading: "linear-gradient(to right, #ef4444, #f97316)",
  headingGlow: "0 0 30px rgba(249, 115, 22, 0.25)",
  button: "linear-gradient(to right, #0f766e, #075985, #1e3a8a)",
  buttonHover: "linear-gradient(to right, #115e59, #0c4a6e, #1e40af)",
  buttonGlow: "0 4px 20px rgba(6, 182, 212, 0.35)",
};

// ─────────────────────────────────────────────
// LICENSE TYPE DATA (FSSAI - GOVT FEES ONLY)
// ─────────────────────────────────────────────
const LICENSE_TYPES = [
  {
    id: "basic",
    name: "Basic Registration",
    turnover: "Below ₹12 Lakhs / year",
    validity: "1–5 Years",
    price: calculateTotalWithGST(PRICING_CONFIG["fssai"].fee) * 100, // ₹100 Service fee + 18% GST (in paise)
    displayPrice: `₹${calculateTotalWithGST(PRICING_CONFIG["fssai"].fee)}`,
    displayPriceRange: `₹${PRICING_CONFIG["fssai"].fee}/year`,
    originalPrice: "₹2,999",
    processingTime: "7–10 Working Days",
    badge: "Small Business",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    examples: ["Home Bakers", "Small Dhabas", "Petty Vendors", "Cottage Industry"],
    sortOrder: 1,
    govFee: false, // Changed to false as it now uses Service Fee labeling
  },
  {
    id: "state",
    name: "State License",
    turnover: "₹12 Lakhs – ₹20 Crores / year",
    validity: "1–5 Years",
    price: calculateTotalWithGST(2000) * 100, // ₹2,000 Service fee min + 18% GST (in paise)
    displayPrice: `₹${calculateTotalWithGST(2000)}`,
    displayPriceRange: "₹2,000–₹5,000/year",
    originalPrice: "₹6,999",
    processingTime: "15–20 Working Days",
    badge: "Mid-Size Business",
    badgeClass: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    examples: ["Restaurants", "Mid-size Manufacturers", "Storage Units", "Catering"],
    sortOrder: 2,
    govFee: true,
  },
  {
    id: "central",
    name: "Central License",
    turnover: "Above ₹20 Crores / year",
    validity: "1–5 Years",
    price: calculateTotalWithGST(7500) * 100, // ₹7,500 Service fee + 18% GST (in paise)
    displayPrice: `₹${calculateTotalWithGST(7500)}`,
    displayPriceRange: "₹7,500/year",
    originalPrice: "₹12,999",
    processingTime: "20–30 Working Days",
    badge: "Large Business",
    badgeClass: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    examples: ["Large Food Chains", "Importers/Exporters", "Multi-state Businesses", "Airport Units"],
    sortOrder: 3,
    govFee: true,
  },
];

// ─────────────────────────────────────────────
// MAIN COMPONENT (FSSAI - ZERO SERVICE CHARGES)
// ─────────────────────────────────────────────
export default function FssaiLicenseServicePanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLicenseType, setSelectedLicenseType] = useState<string>("basic");

  const handleInitiatePayment = async (licenseType: string) => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/fssai-license/requirements", {
        state: { preSelectedType: licenseType },
      });
      return;
    }
    setIsProcessing(true);
    const license = LICENSE_TYPES.find(l => l.id === licenseType);
    if (!license) {
      setIsProcessing(false);
      return;
    }
    const baseFee = (licenseType === "basic") ? PRICING_CONFIG["fssai"].fee : (licenseType === "state" ? 2000 : 7500);
    const gstAmount = calculateGST(baseFee);
    const totalAmount = calculateTotalWithGST(baseFee);

    try {
      await initiateRazorpayPayment({
        amount: license.price,
        currency: "INR",
        name: `RegiBIZ - FSSAI ${license.name}`,
        description: `Service Fee: ₹${baseFee} + GST (18%): ₹${gstAmount} = Total: ₹${totalAmount}`,
        prefill: {
          name: localStorage.getItem("userName") || "",
          email: localStorage.getItem("userEmail") || "",
          contact: localStorage.getItem("userPhone") || "",
        },
        notes: {
          service: "fssai-license",
          licenseType: licenseType,
          source: "landing-page",
          zeroServiceCharges: "true",
          timestamp: new Date().toISOString(),
        },
        handler: (response: RazorpaySuccessResponse) => {
          sessionStorage.setItem("fssai_payment_id", response.razorpay_payment_id);
          sessionStorage.setItem("fssai_order_id", response.razorpay_order_id);
          sessionStorage.setItem("fssai_license_type", licenseType);
          navigate("/services/fssai-license/form", {
            state: {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              licenseType,
              verified: true,
            },
          });
        },
        onClosed: () => setIsProcessing(false),
      });
    } catch (error) {
      console.error("❌ Payment error:", error);
      alert("Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const benefits = [
    { text: "Legally Mandatory for All Food Businesses — Even Home-based", icon: ShieldCheck },
    { text: "Build Consumer Trust with FSSAI Logo on Your Packaging", icon: BadgeCheck },
    { text: "Required for E-commerce Food Sales (Amazon, Swiggy, Zomato)", icon: Building2 },
    { text: "Avoid Fines up to ₹5 Lakh or Imprisonment under FSS Act, 2006", icon: Award },
  ];

  const steps = [
    { step: "01", title: "Share Details", desc: "Fill business info, turnover, and premises details in our simple form", icon: FileText },
    { step: "02", title: "Expert Review", desc: "Our CA/legal experts verify documents and prepare your application", icon: ShieldCheck },
    { step: "03", title: "Government Filing", desc: "Application submitted to FSSAI portal with all required documents", icon: Landmark },
    { step: "04", title: "License Issued", desc: "FSSAI certificate delivered to your email within promised timeline", icon: CheckCircle2 },
  ];

  const stats = [
    { value: "10,000+", label: "FSSAI Licenses" },
    { value: "7 Days", label: "Avg. Turnaround" },
    { value: "99.2%", label: "Success Rate" },
    { value: `₹${calculateTotalWithGST(PRICING_CONFIG["fssai"].fee).toLocaleString()}`, label: "Service Fee" },
  ];

  const PayBtn = ({
    label, licenseType, style = {}, variant = "primary", isProcessing,
  }: {
    label: string; licenseType: string; style?: React.CSSProperties; variant?: "primary" | "secondary";
    isProcessing: boolean;
  }) => {
    const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
    const hoverGradient = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;

    return (
      <button
        onClick={() => handleInitiatePayment(licenseType)}
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

      {/* ── HEADER ─ */}
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
                  }}>FSSAI License</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: GRADIENTS.button, borderRadius: 20,
                    padding: "2px 8px", letterSpacing: "0.05em",
                  }}>REGISTRATION</span>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>RegiBIZ — Trusted by 10,000+ businesses</p>
              </div>
            </div>

            {/* Price + CTA — hidden on very small, shown on sm+ */}
            <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>₹{calculateTotalWithGST(PRICING_CONFIG["fssai"].fee)}</span>
                  <span style={{ fontSize: 11, color: "#4b5563", textDecoration: "line-through" }}>₹2,999</span>
                </div>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, whiteSpace: "nowrap" }}>
                  Service Fee | <span style={{ color: "#60a5fa" }}>No Pro Fee</span>
                </p>
              </div>
              <PayBtn
                label="Start Now"
                licenseType="basic"
                style={{ padding: "10px 18px", fontSize: 13 }}
                isProcessing={isProcessing}
              />
            </div>
          </div>

          {/* Mobile-only CTA bar */}
          <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
            <PayBtn
              label={`Start FSSAI Registration — ₹${calculateTotalWithGST(PRICING_CONFIG["fssai"].fee)}`}
              licenseType="basic"
              style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px", position: "relative", zIndex: 1 }}>

        {/* ── HERO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 72, alignItems: "start" }} className="hero-grid">
          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "5px 14px", marginBottom: 24, boxShadow: "0 0 20px rgba(239,68,68,0.15)" }}>
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>India's Most Trusted FSSAI Service</span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              Get Your FSSAI License<br />
              <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>Hassle-Free in 4 Steps</span>
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>We handle the complex paperwork and government compliance while you focus on growing your food business. Expert-assisted FSSAI license with <span style={{ color: "#60a5fa", fontWeight: 600 }}>ZERO service charges</span> - pay only government fees.</p>

            {/* Benefits */}
            <div style={{ marginBottom: 36 }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={13} color="#ef4444" /> Why Choose RegiBIZ?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {benefits.map(({ text, icon: Icon }, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", transition: "all 0.2s", cursor: "default" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.background = "rgba(239,68,68,0.06)"; e.currentTarget.style.transform = "translateX(4px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateX(0)"; }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(239,68,68,0.25)" }}><Icon size={15} color="#f97316" /></div>
                    <span style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.5, fontWeight: 500 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[{ icon: <Clock size={13} color="#f97316" />, label: "7–10 Day Turnaround" }, { icon: <CreditCard size={13} color="#06b6d4" />, label: "Secure Payment" }, { icon: <ShieldCheck size={13} color="#10b981" />, label: "CA Verified" }].map(({ icon, label }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>{icon}<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span></div>
              ))}
            </div>
          </div>

          {/* Right: How it Works */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 36, backdropFilter: "blur(16px)", boxShadow: "0 8px 40px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, padding: "1px", background: GRADIENTS.button, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.4 }} />
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 36, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", }}>How it works</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 18, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: GRADIENTS.button, border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: GRADIENTS.buttonGlow, position: "relative", zIndex: 1 }}><item.icon size={20} color="#fff" /></div>
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
                  • FSSAI License Certificate (PDF).
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • FSSAI Logo and License Number for Packaging and Marketing.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Expert Support for Renewal and Compliance.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
              <button onClick={handleRequestCallback} disabled={isProcessing} style={{ flex: 1, background: "transparent", border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1, borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s" }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}><MessageCircle size={14} color="#f97316" /><span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chat Us</span></button>
              <PayBtn
                label="Avail Service Now"
                licenseType="basic"
                style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }}
                isProcessing={isProcessing}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[{ v: "10K+", l: "FSSAI Filed" }, { v: "7 Days", l: "Turnaround" }, { v: "99.2%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TRUST BADGES (ZERO SERVICE CHARGES) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 48 }}>
          {[
            { icon: IndianRupee, label: "Low Service Fees", desc: "Pay only starting charges", color: "#60a5fa" },
            { icon: ShieldCheck, label: "100% Transparent", desc: "No hidden costs ever", color: "#60a5fa" },
            { icon: Award, label: "Expert Assistance", desc: "Free professional help", color: "#60a5fa" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Icon size={24} color={color} />
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{label}</h4>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── LICENSE TYPE CARDS ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Choose Your License</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>Select Based on Turnover</h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Choose the license type that matches your annual business turnover and scale. <span style={{ color: "#60a5fa", fontWeight: 600 }}>Zero service charges - pay only government fees.</span></p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }} className="license-grid">
            {LICENSE_TYPES.sort((a, b) => a.sortOrder - b.sortOrder).map((lt) => (
              <div key={lt.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 26, transition: "all 0.25s", position: "relative", overflow: "hidden" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 18, padding: "1px", background: GRADIENTS.heading, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0, transition: "opacity 0.25s" }} className="card-border" />

                {/* ZERO SERVICE CHARGES Badge */}
                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, textAlign: "center", marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, margin: 0 }}>✓ +GST+ Govt Charges Applicable</p>
                  <p style={{ fontSize: 10, color: "#6b9ac4", margin: "2px 0 0" }}>Pay only minimum service fees</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, position: "relative", zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0 }}><Building2 size={18} color="#f97316" /></div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{lt.name}</h4>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{lt.displayPrice}</span>
                  <span style={{ fontSize: 13, color: "#4b5563", textDecoration: "line-through" }}>{lt.originalPrice}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Turnover", value: lt.turnover },
                    { label: "Validity", value: lt.validity },
                    { label: "Processing", value: lt.processingTime },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>{label}</span>
                      <span style={{ color: "#d1d5db", fontWeight: 500, textAlign: "right" }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                  {lt.examples.map((ex) => (
                    <span key={ex} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>{ex}</span>
                  ))}
                </div>
                <button onClick={() => handleInitiatePayment(lt.id)} disabled={isProcessing} style={{ width: "100%", background: GRADIENTS.button, border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", transition: "all 0.25s", opacity: isProcessing ? 0.7 : 1 }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = GRADIENTS.buttonHover; e.currentTarget.style.transform = "translateY(-2px)"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = GRADIENTS.button; e.currentTarget.style.transform = "translateY(0)"; }}>
                  Apply for {lt.name}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── DOCUMENTS SECTION (SIMPLIFIED) ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 8px" }}>Documents Required</h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto" }}>Keep these ready in digital format (PDF or JPG, max 2MB)</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }} className="doc-grid">
            {DOCUMENT_GROUPS.map((group) => (
              <div key={group.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 24, transition: "all 0.25s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.transform = "translateY(-4px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <group.icon size={16} color="#f97316" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{group.label}</h4>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{group.description}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.keys.map((docKey) => (
                    <div key={docKey} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                      <span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 500 }}>{FSSAI_DOCUMENTS[docKey]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ✅ Conditional Note for Manufacturing */}
          <div style={{ marginTop: 24, textAlign: "center", padding: 12, background: "rgba(239,68,68,0.05)", border: "1px dashed rgba(239,68,68,0.3)", borderRadius: 12 }}>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
              <span style={{ color: "#60a5fa", fontWeight: 600 }}>Note:</span> For Manufacturing Units or State/Central Licenses, additional documents (Layout Plan, Water Report) will be requested later by our team.
            </p>
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

        {/* ── BOTTOM CTA ── */}
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "72px 48px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>Ready to make your food business <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>compliant?</span></h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>Join 10,000+ food businesses who trusted RegiBIZ for their FSSAI license registration with <span style={{ color: "#60a5fa", fontWeight: 600 }}>Govt charges applicable</span>.</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 20 }}>
              {LICENSE_TYPES.sort((a, b) => a.sortOrder - b.sortOrder).map((lt) => (
                <PayBtn
                  key={lt.id}
                  label={`${lt.name} — ${lt.displayPrice}`}
                  licenseType={lt.id}
                  variant="primary"
                  style={{ borderRadius: 14, padding: "14px 28px", fontSize: 14 }}
                  isProcessing={isProcessing}
                />
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#60a5fa", marginTop: 20, fontWeight: 600 }}><span style={{ color: "#60a5fa" }}>✓</span> Low Service Fee &nbsp;•&nbsp; <span style={{ color: "#60a5fa" }}>✓</span> Pay Only Service Fees &nbsp;•&nbsp; <span style={{ color: "#60a5fa" }}>✓</span> 100% Transparent Pricing</p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 72, paddingTop: 36, paddingBottom: 36, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      {/* Global Responsive Styles */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .license-grid { grid-template-columns: 1fr !important; }
          .doc-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stats-grid > div { border-right: 1px solid rgba(255,255,255,0.08) !important; }
          .stats-grid > div:nth-child(2n) { border-right: none !important; }
          .stats-grid > div:nth-child(1),
          .stats-grid > div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .header-cta { display: none !important; }
          .mobile-cta-bar { display: block !important; }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .license-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .doc-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
