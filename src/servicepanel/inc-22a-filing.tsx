// src/servicepanel/inc-22a-filing.tsx
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
    AlertCircle,
    MapPin,
    Upload,
    MessageCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST, calculateGST } from "../data/pricingConfig";
import { initiateRazorpayPayment, RazorpaySuccessResponse } from "../services/razorpayService";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
    | "cinCertificate" | "registeredOfficePhoto" | "boardResolution"
    | "directorList" | "directoryProof" | "aoc4Filing" | "mgt7Filing";

interface DocumentGroup {
    id: string;
    label: string;
    icon: React.ElementType;
    keys: DocKey[];
}



// ─────────────────────────────────────────────
// DOCUMENT DATA (Tailored for INC-22A ACTIVE)
// ─────────────────────────────────────────────
const INC22A_DOCUMENTS: Record<DocKey, string> = {
    cinCertificate: "Certificate of Incorporation (COI) with CIN",
    registeredOfficePhoto: "Photo of Registered Office (Inside & Outside)",
    boardResolution: "Board Resolution Authorizing Filing",
    directorList: "List of Directors with DIN Details",
    directoryProof: "Proof of Directors' Address & Identity",
    aoc4Filing: "AOC-4 Filing Receipt/Proof (if applicable)",
    mgt7Filing: "MGT-7A Filing Receipt/Proof (if applicable)",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
    {
        id: "company-docs",
        label: "Company Documents",
        icon: Building2,
        keys: ["cinCertificate", "boardResolution"],
    },
    {
        id: "office-verification",
        label: "Office Verification",
        icon: MapPin,
        keys: ["registeredOfficePhoto"],
    },
    {
        id: "director-info",
        label: "Director Details",
        icon: User,
        keys: ["directorList", "directoryProof"],
    },
    {
        id: "compliance-filings",
        label: "Annual Filings",
        icon: FileText,
        keys: ["aoc4Filing", "mgt7Filing"],
    },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
    if (["cinCertificate", "boardResolution"].includes(key)) return FileText;
    if (["registeredOfficePhoto"].includes(key)) return Building2;
    if (["directorList", "directoryProof"].includes(key)) return User;
    if (["aoc4Filing", "mgt7Filing"].includes(key)) return BadgeCheck;
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
export default function INC22AFiling() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleInitiatePayment = async () => {
        if (isProcessing) return;
        if (!location.state?.requirementsConfirmed) {
            navigate("/services/inc-22a-filing/requirements");
            return;
        }
        setIsProcessing(true);
        try {
            const servicePrice = PRICING_CONFIG["inc-22a"]?.fee ?? 0;
            await initiateRazorpayPayment({
                amount: Math.round(calculateTotalWithGST(servicePrice) * 100),
                currency: "INR",
                name: "RegiBIZ - INC-22A Filing",
                description: `Service Fee: ₹${PRICING_CONFIG["inc-22a"].fee} + GST (18%): ₹${calculateGST(PRICING_CONFIG["inc-22a"].fee)} = Total: ₹${calculateTotalWithGST(PRICING_CONFIG["inc-22a"].fee)}`,
                prefill: {
                    name: localStorage.getItem("userName") || "",
                    email: localStorage.getItem("userEmail") || "",
                    contact: localStorage.getItem("userPhone") || "",
                },
                notes: { service: "inc-22a-filing", source: "landing-page" },
                handler: (response: RazorpaySuccessResponse) => {
                    sessionStorage.setItem("inc22a_payment_id", response.razorpay_payment_id);
                    navigate("/services/inc-22a-filing/form", {
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
        { text: "Maintain Active Company Status", icon: ShieldCheck },
        { text: "Update Director & Office Details", icon: Building2 },
        { text: "Comply with ROC Requirements", icon: CheckCircle2 },
        { text: "Instant Acknowledgment", icon: Clock },
    ];

    const steps = [
        { step: "01", title: "Enter Company Details", desc: "Provide CIN, address, and director information", icon: FileText },
        { step: "02", title: "Upload Documents", desc: "Submit office photos and resolution", icon: FileText },
        { step: "03", title: "MCA Filing", desc: "File INC-22A with DSC on MCA portal", icon: Landmark },
    ];

    const stats = [
        { value: "5,000+", label: "INC-22A Filed" },
        { value: "24 Hrs", label: "Processing Time" },
        { value: "100%", label: "Compliance Rate" },
        { value: "₹699 + GST", label: "Professional Service Fee" },
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
                        color: "#60a5fa", position: "absolute", top: 0, left: "-100%", width: "100%", height: "100%",
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
        <div className="bg-background min-h-screen text-[#e2e8f0]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

            {/* HEADER */}
            <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,12,27,0.95)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: "0 1 auto" }}>
                        <button onClick={() => navigate("/services")} disabled={isProcessing} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px", cursor: isProcessing ? "not-allowed" : "pointer", color: "#6b7280", display: "flex", alignItems: "center", transition: "all 0.2s" }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.color = "#f97316"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; } }} onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "transparent"; }}><ChevronLeft size={18} /></button>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>INC-22A (ACTIVE)</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: GRADIENTS.button, borderRadius: 20, padding: "3px 10px", letterSpacing: "0.05em", boxShadow: GRADIENTS.buttonGlow }}>Compliance</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>RegiBIZ — Keep your company active & compliant</p>
                        </div>
                    </div>
                    <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>₹699 + GST</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                                + <span style={{ color: "#22d3ee" }}>Govt charges applicable</span>
                            </p>
                        </div>
                        <PayBtn label="Start now" style={{ padding: "12px 24px", fontSize: 14, borderRadius: 12 }} />
                    </div>
                    {/* Mobile-only CTA bar */}
                    <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10, width: "100%" }}>
                        <PayBtn
                            label="Start Application — ₹699 + GST"
                            style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
                        />
                    </div>

                </div>
            </header>

            {/* MAIN */}
            <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>
                {/* FREE HIGHLIGHT BANNER */}
                <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "16px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
                    <ShieldCheck size={24} color="#2c9bcf" />
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                        Service Fee: <span style={{ color: "#22d3ee" }}>₹699 +GST+ Govt Charges Applicable.</span>
                    </p>
                </div>

                {/* HERO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 72, alignItems: "start" }} className="hero-grid">
                    {/* Left */}
                    <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "5px 14px", marginBottom: 24, boxShadow: "0 0 20px rgba(239,68,68,0.15)" }}>
                            <Star size={13} color="#f97316" fill="#f97316" />
                            <span style={{ fontSize: 12, fontWeight: 700 }}>Mandatory for Active Companies</span>
                        </div>
                        <h1 style={{ fontSize: "clamp(26px, 6vw, 44px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
                            Keep Your Company<br />
                            <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>Active & Compliant</span>
                        </h1>
                        <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>File INC-22A to update company details, director information, and maintain active status with MCA. Avoid disqualification and penalties.</p>

                        {/* Benefits */}
                        <div style={{ marginBottom: 36 }}>
                            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={13} color="#ef4444" /> Why File INC-22A?</p>
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
                            {[
                                { Icon: Clock, label: "24 Hr Processing", color: "#60a5fa" },
                                { Icon: CreditCard, label: "Secure Filing", color: "#60a5fa" },
                                { Icon: ShieldCheck, label: "MCA Compliant", color: "#60a5fa" }
                            ].map(({ Icon, label, color }, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                                    <Icon size={13} color={color} />
                                    <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
                                </div>
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
                  • INC-22A Filing with  Ministry of Corporate Affairs (MCA)
                </p>
                <p style={{ margin: 0, fontSize: 13, color:"#d1d5db", lineHeight: 1.5 }}>
                  • Acknowledgment Receipt with SRN for tracking status on MCA portal
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
                            <button onClick={handleRequestCallback} disabled={isProcessing} style={{ flex: 1, background: "transparent", border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1, borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s" }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}><MessageCircle size={14} color="#f97316" /><span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chat Us</span></button>
                            <PayBtn label="Avail Service" style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
                            {[{ v: "2K+", l: "Filed" }, { v: "24 Hrs", l: "Processing" }, { v: "98%", l: "Success" }].map(({ v, l }, i) => (
                                <div key={i} style={{ padding: "14px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none" }}>
                                    <div style={{ fontSize: 17, fontWeight: 800, background: GRADIENTS.button, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{v}</div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* DOCUMENTS SECTION */}
                <div style={{ marginBottom: 72 }}>
                    <div style={{ textAlign: "center", marginBottom: 44 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Checklist</p>
                        <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>Documents Required</h2>
                        <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Keep these documents ready for INC-22A filing to maintain active company status.</p>
                    </div>

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
                                                <Icon size={14} color="#f97316" /><span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 500 }}>{INC22A_DOCUMENTS[docKey]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* STATS BAR */}
                <div className="stats-bar" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden", marginBottom: 72, padding: "4px", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: 20, padding: "1px", background: GRADIENTS.heading, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.3 }} />
                    {stats.map(({ value, label }, i) => (
                        <div key={i} style={{ padding: "26px 16px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", position: "relative", zIndex: 1 }}>
                            <div style={{ fontSize: 28, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6, textShadow: "0 0 25px rgba(249,115,22,0.2)" }}>{value}</div>
                            <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* IMPORTANT NOTICE */}
                <div style={{ marginBottom: 72, padding: "24px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 18, display: "flex", gap: 16, alignItems: "start" }}>
                    <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>Important: INC-22A Compliance</h4>
                        <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}> INC-22A must be filed whenever there is a change in the company's registered office, directors, or other particulars. Keep company details updated to avoid penalties and maintain active status with MCA.</p>
                    </div>
                </div>

                {/* BOTTOM CTA */}
                <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "40px 20px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
                    <div style={{ position: "absolute", top: -80, right: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 6s ease-in-out infinite" }} />
                    <div style={{ position: "absolute", bottom: -80, left: -80, width: 240, height: 240, background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(70px)", pointerEvents: "none", animation: "pulse 8s ease-in-out infinite reverse" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>Keep Your Company <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>Active</span></h2>
                        <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>Update your company details and maintain compliance with MCA regulations.</p>
                        <PayBtn label="Start INC-22A Now — ₹699 + GST" variant="primary" style={{ borderRadius: 14, padding: "14px 24px", fontSize: 14, maxWidth: "100%", boxShadow: "0 10px 40px rgba(239,68,68,0.35)" }} />
                        <p style={{ fontSize: 12, color: "#4b5563", marginTop: 20, fontWeight: 500 }}><span style={{ color: "#60a5fa" }}>✓</span> MCA Compliant &nbsp;•&nbsp; <span style={{ color: "#60a5fa" }}>✓</span> No hidden charges &nbsp;•&nbsp; <span style={{ color: "#60a5fa" }}>✓</span> Expert Support</p>
                    </div>
                </div>

                {/* FOOTER */}
                <footer style={{ marginTop: 72, paddingTop: 36, paddingBottom: 36, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
                </footer>
            </main>

            {/* Global Styles */}
            <style>{`
  @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  .mobile-cta-bar { display: none; }

  @media (max-width: 640px) {
    .header-cta { display: none !important; }
    .mobile-cta-bar { display: block !important; }
    .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .doc-grid { grid-template-columns: 1fr !important; }
    .stats-bar { grid-template-columns: repeat(2, 1fr) !important; }
  }

  @media (min-width: 641px) and (max-width: 768px) {
    .hero-grid { grid-template-columns: 1fr !important; }
    .doc-grid { grid-template-columns: 1fr !important; }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .doc-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }

  html { scroll-behavior: smooth; }
  ::selection { background: rgba(249,115,22,0.25); color: #fff; }
  .card-border { opacity: 1 !important; }
`}</style>
        </div>
    );
}
