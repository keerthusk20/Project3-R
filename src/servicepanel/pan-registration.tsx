import React, { useState } from "react";
import {
  CheckCircle,
  FileText,
  User,
  CreditCard,
  MapPin,
  Phone,
  ArrowLeft,
  Shield,
  Loader2,
  Star,
  BadgeCheck,
  ChevronRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST } from "../data/pricingConfig";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
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
// RAZORPAY SERVICE (inline)
// ─────────────────────────────────────────────
const RAZORPAY_KEY =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_RAZORPAY_KEY_ID) || "";

const MOCK_MODE =
  !RAZORPAY_KEY ||
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_USE_MOCK_PAYMENT === "true");

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

const initiateRazorpayPayment = async (
  options: RazorpayPaymentOptions
): Promise<boolean> => {
  // 🧪 MOCK MODE
  if (MOCK_MODE) {
    console.warn("🧪 [MOCK MODE] Simulating Razorpay payment...");
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse: RazorpaySuccessResponse = {
          razorpay_payment_id: `mock_pay_${Date.now()}`,
          razorpay_order_id: `mock_order_${Date.now()}`,
          razorpay_signature: "mock_signature_test",
        };
        console.log("✅ [MOCK] Payment Successful:", mockResponse);
        options.handler(mockResponse);
        resolve(true);
      }, 1500);
    });
  }

  // 🚀 REAL PAYMENT
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    alert("Payment gateway failed to load. Please check your connection.");
    return false;
  }

  if (!RAZORPAY_KEY) {
    console.error("❌ VITE_RAZORPAY_KEY_ID missing from .env");
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
      theme: { color: "#0891b2" },

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
              instruments: [
                { method: "card" },
                { method: "netbanking" },
                { method: "wallet" },
              ],
            },
          },
          sequence: ["block.upi_block", "block.other_methods"],
          preferences: { show_default_blocks: false },
        },
      },

      modal: {
        ondismiss: () => options.onClosed?.(),
        escape: true,
        animation: true,
      },
      handler: (response: RazorpaySuccessResponse) => {
        console.log("✅ Payment Successful:", response);
        options.handler(response);
      },
    };

    const razorpay = new (window as any).Razorpay(rzpOptions);

    razorpay.on("payment.failed", (failureResponse: any) => {
      console.error("❌ Payment failed:", failureResponse.error);
      alert(
        `Payment failed: ${failureResponse.error?.description ?? "Unknown error"
        }. Please try again.`
      );
      options.onClosed?.();
    });

    razorpay.open();
    return true;
  } catch (error) {
    console.error("❌ Razorpay init error:", error);
    alert(
      `Payment Error: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function PanRegistrationLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPanType, setSelectedPanType] = useState<"ephysical" | "edigital">("edigital");
  const searchParams = new URLSearchParams(location.search);
  const cameFromServiceRequirements = searchParams.get("returnTo") === "service-requirements";
  const returnServiceId = searchParams.get("serviceId");
  const returnTo = typeof location.state?.returnTo === "string"
    ? location.state.returnTo
    : cameFromServiceRequirements && returnServiceId
      ? `/services/${returnServiceId}/requirements${searchParams.get("type") ? `?type=${searchParams.get("type")}` : ""}`
      : "/services";
  const returnState = location.state?.returnState;

  // Pricing config (official NSDL/UTIITSL rates)
  const PRICING = {
    edigital: { amount: (calculateTotalWithGST(99) * 100), label: "e-PAN", display: `₹${calculateTotalWithGST(99).toLocaleString()}` }, // Digital only
    ephysical: { amount: (calculateTotalWithGST(PRICING_CONFIG["pan"].fee) * 100), label: "Physical PAN", display: `₹${calculateTotalWithGST(PRICING_CONFIG["pan"].fee).toLocaleString()}` }, // Physical card
  };

  const currentPricing = PRICING[selectedPanType];

  // ✅ Unified payment handler
  const handleInitiatePayment = async () => {
    if (isProcessing) return;
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/pan-registration/requirements", {
        state: { preSelectedType: selectedPanType },
      });
      return;
    }
    setIsProcessing(true);

    try {
      await initiateRazorpayPayment({
        amount: currentPricing.amount,
        currency: "INR",
        name: `RegiBIZ - ${currentPricing.label}`,
        description: `${currentPricing.label} Registration Service Fee`,
        prefill: {
          name: localStorage.getItem("userName") || "",
          email: localStorage.getItem("userEmail") || "",
          contact: localStorage.getItem("userPhone") || "",
        },
        notes: {
          service: "pan-registration",
          pan_type: selectedPanType,
          source: "landing-page",
          timestamp: new Date().toISOString(),
        },
        handler: (response: RazorpaySuccessResponse) => {
          sessionStorage.setItem("pan_payment_id", response.razorpay_payment_id);
          sessionStorage.setItem("pan_order_id", response.razorpay_order_id);
          sessionStorage.setItem("pan_type", selectedPanType);

          console.log("✅ Payment done. Redirecting to PAN form:", response);

          navigate("/services/pan-registration/form", {
            state: {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              verified: true,
              panType: selectedPanType,
            },
          });
        },
        onClosed: () => {
          console.log("💬 Payment modal closed");
          setIsProcessing(false);
        },
      });
    } catch (error) {
      console.error("❌ Payment error:", error);
      alert("Something went wrong. Please try again.");
      setIsProcessing(false);
    } finally {
      if (MOCK_MODE) setIsProcessing(false);
    }
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  // ─── Data ───────────────────────────────────
  const benefits = [
    { text: "Mandatory for filing income tax returns", icon: FileText },
    { text: "Required for opening bank accounts & financial transactions", icon: CreditCard },
    { text: "Acts as a valid photo ID across India", icon: BadgeCheck },
    { text: "Needed for high-value purchases (e.g., vehicles, property)", icon: Shield },
  ];

  // ─── Simplified Documents List (5-6 Key Documents Only) ─────────
  const documents = [
    { name: "Aadhaar Card", note: "For ID, Address & DOB proof" },
    { name: "Passport", note: "Valid ID & address proof" },
    { name: "Voter ID Card", note: "Government-issued photo ID" },
    { name: "Driving License", note: "Valid ID & address proof" },
    { name: "10th Mark Sheet", note: "For Date of Birth proof" },
    { name: "Recent Photo", note: "Passport-size, white background" },
  ];

  const steps = [
    {
      step: "01",
      icon: FileText,
      title: "Fill Details",
      desc: "Enter personal info & upload documents",
    },
    {
      step: "02",
      icon: Shield,
      title: "Expert Verification",
      desc: "Our experts validate & submit your application",
    },
    {
      step: "03",
      icon: CheckCircle,
      title: "Get PAN",
      desc: selectedPanType === "edigital" ? "Receive e-PAN via email in 2 days" : "Receive physical PAN card in 7-10 days",
    },
  ];

  const stats = [
    { value: "50,000+", label: "PAN Cards Issued" },
    { value: "2 Days", label: "e-PAN Delivery" },
    { value: "99.9%", label: "Success Rate" },
    { value: `₹${calculateTotalWithGST(PRICING_CONFIG["pan"].fee).toLocaleString()}`, label: "Service Fee (Incl. 18% GST)" },
  ];

  // ─── Reusable Pay Button ────────────────────
  const PayBtn = ({
    label,
    style = {},
    variant = "primary",
  }: {
    label: string;
    style?: React.CSSProperties;
    variant?: "primary" | "secondary";
  }) => {
    const gradient = variant === "primary"
      ? "linear-gradient(135deg, #0f766e, #0891b2, #1d4ed8)"
      : "linear-gradient(135deg, #ef4444, #f97316)";

    return (
      <button
        onClick={handleInitiatePayment}
        disabled={isProcessing}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontWeight: 700,
          cursor: isProcessing ? "not-allowed" : "pointer",
          opacity: isProcessing ? 0.7 : 1,
          transition: "all 0.3s ease",
          border: "none",
          color: "#fff",
          borderRadius: 12,
          background: gradient,
          boxShadow: "0 6px 24px rgba(8,145,178,0.35), 0 2px 8px rgba(0,0,0,0.2)",
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 10px 32px rgba(8,145,178,0.5), 0 4px 16px rgba(0,0,0,0.3)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(8,145,178,0.35), 0 2px 8px rgba(0,0,0,0.2)";
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Processing...
          </>
        ) : (
          <>
            {label}
            <ChevronRight size={16} />
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </button>
    );
  };

  // ─── Gradient Text Helper ───────────────────
  const GradientText = ({
    children,
    variant = "highlight",
    style = {},
  }: {
    children: React.ReactNode;
    variant?: "highlight" | "heading";
    style?: React.CSSProperties;
  }) => {
    const gradient = "linear-gradient(90deg, #ef4444, #f97316)";
    return (
      <span
        style={{
          background: gradient,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          ...style,
        }}
      >
        {children}
      </span>
    );
  };

  // ─── Render ─────────────────────────────────
  return (
    <div className="bg-background min-h-screen text-[#f8fafc] relative overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── HEADER ──────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(2,12,27,0.92)",
          backdropFilter: "blur(24px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => navigate(returnTo, { state: returnState })}
              disabled={isProcessing}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "8px 10px",
                cursor: isProcessing ? "not-allowed" : "pointer",
                color: "#9ca3af",
                display: "flex",
                alignItems: "center",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.color = "#f97316";
                  e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)";
                  e.currentTarget.style.background = "rgba(249,115,22,0.1)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9ca3af";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GradientText variant="heading" style={{ fontSize: 18, fontWeight: 800 }}>
                  PAN Registration
                </GradientText>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#60a5fa",
                    border: "1px solid rgba(249,115,22,0.4)",
                    borderRadius: 20,
                    padding: "2px 10px",
                    letterSpacing: "0.05em",
                    background: "rgba(249,115,22,0.1)",
                  }}
                >
                  Official Rates
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                RegiBIZ — Trusted by 50,000+ applicants
              </p>
            </div>
          </div>

          {/* Right: Pricing Selector + CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 4 }}>
              {/* PAN Type Toggle */}
              <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 3 }}>
                <button
                  onClick={() => setSelectedPanType("edigital")}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: selectedPanType === "edigital" ? "rgba(16,185,129,0.2)" : "transparent",
                    color: selectedPanType === "edigital" ? "#10b981" : "#9ca3af",
                    transition: "all 0.2s ease",
                  }}
                >
                  e-PAN ₹{calculateTotalWithGST(99).toLocaleString()}
                </button>
                <button
                  onClick={() => setSelectedPanType("ephysical")}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: selectedPanType === "ephysical" ? "rgba(16,185,129,0.2)" : "transparent",
                    color: selectedPanType === "ephysical" ? "#10b981" : "#9ca3af",
                    transition: "all 0.2s ease",
                  }}
                >
                  Physical ₹{calculateTotalWithGST(PRICING_CONFIG["pan"].fee).toLocaleString()}
                </button>
              </div>
              <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>
                {selectedPanType === "edigital" ? "Digital delivery via email" : "Physical card via post"}
              </p>
            </div>

            <PayBtn
              label={`Get ${currentPricing.label}`}
              style={{
                padding: "12px 20px",
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </header>

      {/* ── MAIN ──────────────────────────────────── */}
      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── HERO ──────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
            marginBottom: 72,
            alignItems: "start",
          }}
          className="hero-grid"
        >
          {/* Left */}
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(249,115,22,0.12)",
                border: "1px solid rgba(249,115,22,0.35)",
                borderRadius: 24,
                padding: "6px 14px",
                marginBottom: 24,
                boxShadow: "0 0 24px rgba(249,115,22,0.15)",
              }}
            >
              <Star size={13} color="#f97316" fill="#f97316" />
              <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700 }}>
                India's Fastest PAN Card Service
              </span>
            </div>

            <h1
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.15,
                margin: "0 0 16px",
                letterSpacing: "-0.03em",
                textShadow: "0 2px 16px rgba(0,0,0,0.4)",
              }}
            >
              Get PAN Card
              <br />
              <GradientText variant="heading" style={{ fontSize: 44, fontWeight: 800 }}>
                in 3 Simple Steps
              </GradientText>
            </h1>

            <p
              style={{
                color: "#cbd5e1",
                fontSize: 17,
                lineHeight: 1.75,
                marginBottom: 36,
                maxWidth: 480,
              }}
            >
              We handle the complex paperwork while you focus on your goals.
              Get your {selectedPanType === "edigital" ? "e-PAN" : "Physical PAN"} delivered
              in <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                {selectedPanType === "edigital" ? "48 hours" : "7-10 business days"}
              </span>.
            </p>

            {/* Benefits */}
            <div style={{ marginBottom: 36 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#60a5fa",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle size={14} color="#f97316" />
                Why Choose RegiBIZ?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {benefits.map(({ text, icon: Icon }, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      padding: "12px 16px",
                      transition: "all 0.25s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)";
                      e.currentTarget.style.background = "rgba(249,115,22,0.08)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: "rgba(249,115,22,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: "1px solid rgba(249,115,22,0.3)",
                      }}
                    >
                      <Icon size={16} color="#f97316" />
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#e2e8f0",
                        lineHeight: 1.5,
                        fontWeight: 500,
                      }}
                    >
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { icon: "⚡", label: selectedPanType === "edigital" ? "2 Day e-Delivery" : "7-10 Day Postal", color: "#fbbf24" },
                { icon: "🔒", label: "Secure Payment", color: "#60a5fa" },
                { icon: "↩️", label: "100% Refund if Rejected", color: "#60a5fa" },
              ].map(({ icon, label, color }, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: How it Works */}
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 24,
              padding: 36,
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <h3
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: "#fff",
                textAlign: "center",
                marginBottom: 36,
                textShadow: "0 1px 8px rgba(0,0,0,0.3)",
              }}
            >
              How it works
            </h3>

            {/* Steps with vertical connector */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((item, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 18, position: "relative" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(6,182,212,0.2))",
                        border: "2px solid rgba(249,115,22,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 4px 20px rgba(249,115,22,0.25)",
                        transition: "all 0.3s ease",
                      }}
                    >
                      <item.icon size={20} color="#f97316" />
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        style={{
                          width: 2,
                          height: 36,
                          background: "linear-gradient(to bottom, rgba(249,115,22,0.5), rgba(249,115,22,0.1))",
                          margin: "8px 0",
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      paddingBottom: i < steps.length - 1 ? 24 : 0,
                      paddingTop: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#60a5fa",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Step {item.step}
                    </span>
                    <h4
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#fff",
                        margin: "6px 0",
                      }}
                    >
                      {item.title}
                    </h4>
                    <p style={{ fontSize: 13.5, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "14px 14px",
                borderRadius: 12,
                background: "rgba(6,182,212,0.08)",
                border: "1px solid rgba(6,182,212,0.2)",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#22d3ee",
                }}
              >
                Deliverables
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Filled PAN application form (digitally signed by you)
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                  • Acknowledgment receipt with unique 15-digit PAN application number
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
              <button
                onClick={handleRequestCallback}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #ef4444, #f97316)",
                  border: "none",
                  borderRadius: 12,
                  padding: "14px 18px",
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isProcessing ? 0.65 : 1,
                  transition: "all 0.25s ease",
                  boxShadow: "0 6px 24px rgba(239,68,68,0.35)",
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 10px 32px rgba(239,68,68,0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 24px rgba(239,68,68,0.35)";
                }}
              >
                <Phone size={15} />
                Request Callback
              </button>

              <PayBtn
                label={`Get ${currentPricing.label} Now`}
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  fontSize: 13.5,
                }}
              />
            </div>

            {/* Mini stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                marginTop: 24,
                background: "rgba(249,115,22,0.08)",
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(249,115,22,0.2)",
              }}
            >
              {[
                { v: "50K+", l: "PAN Issued" },
                { v: selectedPanType === "edigital" ? "2 Days" : "7-10 Days", l: "Delivery" },
                { v: "99.9%", l: "Success" },
              ].map(({ v, l }, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 10px",
                    textAlign: "center",
                    borderRight: i < 2 ? "1px solid rgba(249,115,22,0.15)" : "none",
                  }}
                >
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#60a5fa", textShadow: "0 0 16px rgba(249,115,22,0.3)" }}>
                    {v}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── STATS BAR ─────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            background: "rgba(249,115,22,0.08)",
            border: "1px solid rgba(249,115,22,0.2)",
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 72,
            boxShadow: "0 4px 24px rgba(249,115,22,0.1)",
          }}
        >
          {stats.map(({ value, label }, i) => (
            <div
              key={i}
              style={{
                padding: "28px 16px",
                textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(249,115,22,0.15)" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  background: "linear-gradient(90deg, #ef4444, #f97316)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginBottom: 6,
                  textShadow: "0 0 24px rgba(249,115,22,0.25)",
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: 13.5, color: "#94a3b8", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── DOCUMENTS SECTION (Simplified) ─────────────────── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#60a5fa",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Quick Checklist
            </p>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: "0 0 14px",
              }}
            >
              <GradientText variant="heading">Documents Required</GradientText>
            </h2>
            <p
              style={{
                color: "#94a3b8",
                fontSize: 14.5,
                maxWidth: 520,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              Just these 6 key documents. Keep them ready in digital format (PDF/JPG).
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
            className="doc-grid"
          >
            {documents.map((doc, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  padding: 20,
                  transition: "all 0.25s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)";
                  e.currentTarget.style.background = "rgba(249,115,22,0.08)";
                  e.currentTarget.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(249,115,22,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(249,115,22,0.3)",
                    flexShrink: 0,
                  }}
                >
                  <BadgeCheck size={16} color="#f97316" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
                    {doc.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {doc.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM CTA ────────────────────────── */}
        <div
          style={{
            position: "relative",
            borderRadius: 28,
            overflow: "hidden",
            background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(2,12,27,0.98))",
            border: "1px solid rgba(16,185,129,0.25)",
            padding: "72px 48px",
            textAlign: "center",
            boxShadow: "0 12px 48px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              position: "absolute", top: -80, right: -80,
              width: 240, height: 240,
              background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
              borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute", bottom: -80, left: -80,
              width: 240, height: 240,
              background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
              borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <h2
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "#fff",
                marginBottom: 14,
                letterSpacing: "-0.02em",
                textShadow: "0 2px 20px rgba(0,0,0,0.4)",
              }}
            >
              Ready to get your <GradientText variant="heading">PAN Card</GradientText>?
            </h2>
            <p
              style={{
                color: "#cbd5e1",
                fontSize: 16,
                marginBottom: 40,
                maxWidth: 520,
                margin: "0 auto 40px",
                lineHeight: 1.7,
              }}
            >
              Join 50,000+ applicants who trusted RegiBIZ.
              Official rates: <span style={{ color: "#60a5fa", fontWeight: 700 }}>e-PAN ₹99</span> | <span style={{ color: "#60a5fa", fontWeight: 700 }}>Physical ₹149</span>
            </p>

            <PayBtn
              label={`Start Registration — ${currentPricing.display}`}
              style={{
                borderRadius: 14,
                padding: "16px 42px",
                fontSize: 16.5,
                boxShadow: "0 10px 36px rgba(239,68,68,0.4), 0 4px 16px rgba(8,145,178,0.3)",
              }}
            />

            <p style={{ fontSize: 12.5, color: "#64748b", marginTop: 20, fontWeight: 500 }}>
              🔐 Secure checkout &nbsp;•&nbsp; ✨ No hidden charges &nbsp;•&nbsp; ↩️ 100%
              Refund if rejected
            </p>
          </div>
        </div>

        {/* ── FOOTER ────────────────────────────── */}
        <footer
          style={{
            marginTop: 72,
            paddingTop: 36,
            paddingBottom: 36,
            textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>

      {/* Responsive + Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @media (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
        @media (max-width: 768px) {
          .doc-grid { grid-template-columns: 1fr !important; }
          main { padding: 32px 16px !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </div>
  );
}
