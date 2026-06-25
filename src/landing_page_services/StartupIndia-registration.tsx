// src/servicepanel/StartupIndia-registration.tsx
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
  Rocket,
  Award,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
  | "incorporationCert" | "companyPan" | "companyMoa" | "companyAoa"
  | "llpAgreement" | "llpPan" | "directorPan" | "directorAadhaar"
  | "directorPhoto" | "pitchDeck" | "businessPlan" | "bankStatement"
  | "cancelledCheque" | "addressProof" | "rentAgreement" | "utilityBill"
  | "itr" | "digitalSignature";

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayPaymentOptions {
  amount: number;
  currency?: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  handler: (response: RazorpaySuccessResponse) => void;
  onClosed?: () => void;
}

// ─────────────────────────────────────────────
// DOCUMENT DATA
// ─────────────────────────────────────────────
const DPIIT_DOCUMENTS: Record<DocKey, string> = {
  incorporationCert: "Certificate of Incorporation",
  companyPan: "PAN Card of Entity",
  companyMoa: "Memorandum of Association",
  companyAoa: "Articles of Association",
  llpAgreement: "LLP Agreement",
  llpPan: "PAN Card of LLP",
  directorPan: "PAN Card of Directors",
  directorAadhaar: "Aadhaar Card of Directors",
  directorPhoto: "Passport Photographs",
  pitchDeck: "Pitch Deck / Presentation",
  businessPlan: "Detailed Business Plan",
  bankStatement: "Bank Statement (6 Months)",
  cancelledCheque: "Cancelled Cheque",
  addressProof: "Office Address Proof",
  rentAgreement: "Rent/Lease Agreement",
  utilityBill: "Electricity/Water Bill",
  itr: "ITR of Entity",
  digitalSignature: "Digital Signature (DSC)",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "entity",
    label: "Entity Registration",
    icon: Building2,
    keys: ["incorporationCert", "companyPan", "companyMoa", "companyAoa", "llpAgreement", "llpPan"],
  },
  {
    id: "promoter",
    label: "Promoter Details",
    icon: User,
    keys: ["directorPan", "directorAadhaar", "directorPhoto"],
  },
  {
    id: "business",
    label: "Business & Innovation",
    icon: Rocket,
    keys: ["pitchDeck", "businessPlan", "bankStatement", "cancelledCheque"],
  },
  {
    id: "address",
    label: "Office Address",
    icon: FileText,
    keys: ["addressProof", "rentAgreement", "utilityBill", "itr"],
  },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
  if (["companyPan", "llpPan", "directorPan", "incorporationCert", "companyMoa", "companyAoa", "llpAgreement"].includes(key)) return FileText;
  if (["cancelledCheque", "bankStatement"].includes(key)) return Landmark;
  if (["directorPhoto"].includes(key)) return User;
  if (["pitchDeck", "businessPlan"].includes(key)) return Rocket;
  if (["addressProof", "rentAgreement", "utilityBill", "itr"].includes(key)) return Building2;
  return FileText;
};

// ─────────────────────────────────────────────
// RAZORPAY SERVICE
// ─────────────────────────────────────────────
const RAZORPAY_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_RAZORPAY_KEY_ID) || "";
const MOCK_MODE = !RAZORPAY_KEY || (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_USE_MOCK_PAYMENT === "true");

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const initiateRazorpayPayment = async (options: RazorpayPaymentOptions): Promise<boolean> => {
  if (MOCK_MODE) {
    console.warn("🧪 [MOCK MODE] Simulating Startup India payment...");
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse: RazorpaySuccessResponse = {
          razorpay_payment_id: `mock_pay_startup_${Date.now()}`,
          razorpay_order_id: `mock_order_startup_${Date.now()}`,
          razorpay_signature: "mock_signature_startup_test",
        };
        options.handler(mockResponse);
        resolve(true);
      }, 1500);
    });
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    alert("Payment gateway failed to load.");
    return false;
  }
  if (!RAZORPAY_KEY) {
    console.error("❌ VITE_RAZORPAY_KEY_ID missing");
    return false;
  }

  try {
    const rzpOptions: Record<string, any> = {
      key: RAZORPAY_KEY,
      amount: options.amount,
      currency: options.currency ?? "INR",
      name: options.name,
      description: options.description,
      prefill: options.prefill ?? {},
      notes: options.notes ?? {},
      theme: { color: "#0f766e" },
      config: {
        display: {
          blocks: {
            upi_block: {
              name: "Pay via UPI",
              instruments: [
                { method: "upi", flows: ["intent"], apps: ["google_pay"] },
                { method: "upi", flows: ["intent"], apps: ["phonepe"] },
                { method: "upi", flows: ["intent"], apps: ["paytm"] },
                { method: "upi", flows: ["collect"] },
              ],
            },
            other_methods: {
              name: "Other Payment Methods",
              instruments: [{ method: "card" }, { method: "netbanking" }, { method: "wallet" }],
            },
          },
          sequence: ["block.upi_block", "block.other_methods"],
          preferences: { show_default_blocks: false },
        },
      },
      modal: { ondismiss: () => options.onClosed?.(), escape: true, animation: true },
      handler: (response: RazorpaySuccessResponse) => {
        options.handler(response);
      },
    };

    const razorpay = new (window as any).Razorpay(rzpOptions);
    razorpay.on("payment.failed", (failureResponse: any) => {
      alert(`Payment failed: ${failureResponse.error?.description ?? "Unknown error"}`);
      options.onClosed?.();
    });
    razorpay.open();
    return true;
  } catch (error) {
    console.error("❌ Razorpay init error:", error);
    return false;
  }
};

// ─────────────────────────────────────────────
// COLOR CONSTANTS
// ─────────────────────────────────────────────
const GRADIENTS = {
  heading: "linear-gradient(to right, #ef4444, #f97316)", // Red to Orange
  headingGlow: "0 0 30px rgba(249, 115, 22, 0.25)",
  button: "linear-gradient(to right, #0f766e, #075985, #1e3a8a)", // Teal to Blue
  buttonHover: "linear-gradient(to right, #115e59, #0c4a6e, #1e40af)",
  buttonGlow: "0 4px 20px rgba(6, 182, 212, 0.35)",
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function StartupIndiaRegistration() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleInitiatePayment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await initiateRazorpayPayment({
        amount: 299900, // ₹2,999
        currency: "INR",
        name: "RegiBIZ - DPIIT Recognition",
        description: "Startup India Registration Service Fee",
        prefill: {
          name: localStorage.getItem("userName") || "",
          email: localStorage.getItem("userEmail") || "",
          contact: localStorage.getItem("userPhone") || "",
        },
        notes: { service: "startup-india-dpiit", source: "landing-page" },
        handler: (response: RazorpaySuccessResponse) => {
          sessionStorage.setItem("startup_payment_id", response.razorpay_payment_id);
          navigate("/services/startup-india/form", {
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
    } finally {
      if (MOCK_MODE) setIsProcessing(false);
    }
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const benefits = [
    { text: "Official DPIIT Recognition Certificate", icon: BadgeCheck },
    { text: "Eligible for 3-Year Tax Exemption (80-IAC)", icon: Award },
    { text: "80% Rebate on Patent Filing Fees", icon: ShieldCheck },
    { text: "Access to ₹10,000 Cr Fund of Funds", icon: TrendingUp },
  ];

  const steps = [
    { step: "01", title: "Eligibility Check", desc: "We verify your startup against DPIIT criteria", icon: FileText },
    { step: "02", title: "Document Filing", desc: "Experts prepare & file on Startup India Portal", icon: ShieldCheck },
    { step: "03", title: "Get Recognised", desc: "Receive DPIIT Certificate in 7–15 days", icon: CheckCircle2 },
  ];

  const PayBtn = ({ label, style = {}, variant = "primary" }: { label: string; style?: React.CSSProperties; variant?: "primary" | "secondary" }) => {
    const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
    const hoverGradient = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;
    
    return (
      <button
        onClick={handleInitiatePayment}
        disabled={isProcessing}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
          opacity: isProcessing ? 0.7 : 1, transition: "all 0.25s ease",
          border: "none", color: "#fff", borderRadius: 12,
          background: baseGradient, boxShadow: variant === "primary" ? GRADIENTS.buttonGlow : "none",
          position: "relative", overflow: "hidden", ...style,
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.background = hoverGradient;
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = variant === "primary" ? "0 8px 30px rgba(6, 182, 212, 0.5)" : GRADIENTS.headingGlow;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = baseGradient;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = variant === "primary" ? GRADIENTS.buttonGlow : "none";
        }}
      >
        <span
          style={{
            position: "absolute", top: 0, left: "-100%", width: "100%", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
            transition: "left 0.5s",
          }}
          onMouseEnter={(e) => { if (!isProcessing) (e.currentTarget as HTMLElement).style.left = "100%"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.left = "-100%"; }}
        />
        {isProcessing ? (
          <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
        ) : (
          <>{label}<ArrowRight size={16} /></>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </button>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "#000000", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e2e8f0" }}>
      
      {/* Aurora glow effects */}
      <div style={{ position: "fixed", top: "-30%", right: "-20%", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)", filter: "blur(100px)", pointerEvents: "none", zIndex: 0, animation: "pulse 10s ease-in-out infinite" }} />
      <div style={{ position: "fixed", bottom: "-30%", left: "-20%", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)", filter: "blur(100px)", pointerEvents: "none", zIndex: 0, animation: "pulse 12s ease-in-out infinite reverse" }} />

      {/* ── HEADER ─ */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,12,27,0.95)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate("/services")} disabled={isProcessing} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px", cursor: isProcessing ? "not-allowed" : "pointer", color: "#6b7280", display: "flex", alignItems: "center", transition: "all 0.2s" }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.color = "#f97316"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; } }} onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "transparent"; }}><ChevronLeft size={18} /></button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 20px rgba(249,115,22,0.15)" }}>Startup India</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: GRADIENTS.button, borderRadius: 20, padding: "3px 10px", letterSpacing: "0.05em", boxShadow: GRADIENTS.buttonGlow }}>DPIIT</span>
              </div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>RegiBIZ — Empowering 5,000+ Startups</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>₹2,999</span>
                <span style={{ fontSize: 13, color: "#4b5563", textDecoration: "line-through" }}>₹5,999</span>
              </div>
              <p style={{ fontSize: 11, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 600, margin: 0 }}>50% OFF — Limited time</p>
            </div>
            <PayBtn label="Apply Now" style={{ padding: "12px 24px", fontSize: 14, borderRadius: 12 }} />
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
              <span style={{ fontSize: 12, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 700 }}>Official DPIIT Recognition Partner</span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              Get DPIIT Recognised<br />
              <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline-block", textShadow: GRADIENTS.headingGlow }}>Unlock Startup Benefits</span>
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>Secure your official Startup India certificate. Access tax holidays, IPR fast-tracking, and government funding opportunities with our expert assistance.</p>
            
            {/* Benefits */}
            <div style={{ marginBottom: 36 }}>
              <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><Rocket size={13} color="#ef4444" /> Why DPIIT Recognition?</p>
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
              {[{ icon: <Clock size={13} color="#f97316" />, label: "7–15 Day Turnaround" }, { icon: <CreditCard size={13} color="#06b6d4" />, label: "Secure Payment" }, { icon: <ShieldCheck size={13} color="#10b981" />, label: "Expert Verified" }].map(({ icon, label }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>{icon}<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span></div>
              ))}
            </div>
          </div>

          {/* Right: How it Works */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 36, backdropFilter: "blur(16px)", boxShadow: "0 8px 40px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, padding: "1px", background: GRADIENTS.button, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.4 }} />
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 36, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>How it works</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 18, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: GRADIENTS.button, border: "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: GRADIENTS.buttonGlow, position: "relative", zIndex: 1 }}><item.icon size={20} color="#fff" /></div>
                    {i < steps.length - 1 && <div style={{ width: 2, height: 36, background: "linear-gradient(to bottom, rgba(6,182,212,0.5), rgba(6,182,212,0.08))", margin: "8px 0", borderRadius: 2 }} />}
                  </div>
                  <div style={{ paddingBottom: i < steps.length - 1 ? 24 : 0, paddingTop: 10, flex: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.12em", display: "inline-block" }}>STEP {item.step}</span>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "6px 0" }}>{item.title}</h4>
                    <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
              <button onClick={handleRequestCallback} disabled={isProcessing} style={{ flex: 1, background: "transparent", border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1, borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s" }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}><Phone size={14} color="#f97316" /><span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Request Callback</span></button>
              <PayBtn label="Avail Service Now" style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[{ v: "5K+", l: "Startups" }, { v: "10 Days", l: "Timeline" }, { v: "98.5%", l: "Success" }].map(({ v, l }, i) => (
                <div key={i} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DOCUMENTS SECTION ── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Checklist</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>Documents Required</h2>
            <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Keep these ready in digital format (PDF or JPG) for a smooth DPIIT application process.</p>
          </div>
          
          {/* ✅ UPDATED: Grid now shows 4 boxes in a single row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22 }} className="doc-grid">
            {DOCUMENT_GROUPS.map((group) => (
              <div key={group.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 26, transition: "all 0.25s", position: "relative", overflow: "hidden" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 18, padding: "1px", background: GRADIENTS.heading, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0, transition: "opacity 0.25s" }} className="card-border" />
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, position: "relative", zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0 }}><group.icon size={18} color="#f97316" /></div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{group.label}</h4>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  {group.keys.map((docKey) => {
                    const Icon = getIconForDoc(docKey);
                    return (
                      <div key={docKey} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}>
                        <Icon size={14} color="#f97316" /><span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 500 }}>{DPIIT_DOCUMENTS[docKey]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ ADDED: STATS BAR (Like your image) */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(4, 1fr)", 
            background: "rgba(255,255,255,0.03)", 
            border: "1px solid rgba(239,68,68,0.2)", 
            borderRadius: 20, 
            overflow: "hidden", 
            padding: "4px", 
            position: "relative",
            boxShadow: "0 0 30px rgba(239,68,68,0.05)"
          }}>
            {/* Border Glow Effect */}
            <div style={{ position: "absolute", inset: 0, borderRadius: 20, padding: "1px", background: GRADIENTS.heading, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.5 }} />
            
            {[
              { value: "5,000+", label: "Startups Helped" },
              { value: "10 Days", label: "Avg. Timeline" },
              { value: "98.5%", label: "Success Rate" },
              { value: "₹0", label: "Service Fee" }
            ].map(({ value, label }, i) => (
              <div key={i} style={{ 
                padding: "26px 16px", 
                textAlign: "center", 
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", 
                position: "relative", 
                zIndex: 1 
              }}>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 800, 
                  background: GRADIENTS.heading, 
                  WebkitBackgroundClip: "text", 
                  WebkitTextFillColor: "transparent", 
                  marginBottom: 6, 
                  textShadow: "0 0 25px rgba(249,115,22,0.3)" 
                }}>{value}</div>
                <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "72px 48px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>Ready to scale your <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>startup journey?</span></h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>Join 5,000+ startups who trusted RegiBIZ for their DPIIT Recognition and benefits.</p>
            <PayBtn label="Get DPIIT Recognised — ₹2,999" variant="primary" style={{ borderRadius: 14, padding: "16px 42px", fontSize: 16, boxShadow: "0 10px 40px rgba(239,68,68,0.35)" }} />
            <p style={{ fontSize: 12, color: "#4b5563", marginTop: 20, fontWeight: 500 }}><span style={{ color: "#10b981" }}>✓</span> Secure checkout &nbsp;•&nbsp; <span style={{ color: "#10b981" }}>✓</span> No hidden charges &nbsp;•&nbsp; <span style={{ color: "#10b981" }}>✓</span> 100% Refund if rejected</p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ marginTop: 72, paddingTop: 36, paddingBottom: 36, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ color: "#4b5563", fontSize: 13, margin: "0 0 8px" }}>© 2026 RegiBIZ. All rights reserved.</p>
          <p style={{ color: "#374151", fontSize: 12, margin: 0 }}>RegiBIZ v2.0.1 &nbsp;•&nbsp; Secured by 256-bit Encryption</p>
        </footer>
      </main>

      {/* Global Styles */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) { .doc-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 768px) { .hero-grid { grid-template-columns: 1fr !important; } .doc-grid { grid-template-columns: 1fr !important; } }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(249,115,22,0.25); color: #fff; }
        .card-border { opacity: 1 !important; }
      `}</style>
    </div>
  );
}