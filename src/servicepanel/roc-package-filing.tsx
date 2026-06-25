import React, { useMemo, useState, useEffect } from "react";
import {
    CheckCircle2,
    FileText,
    Landmark,
    ShieldCheck,
    Clock,
    ArrowRight,
    Phone,
    Loader2,
    Star,
    Package,
    Zap,
    Briefcase,
    BadgeCheck,
    ChevronLeft,
    CreditCard,
    Lock,
    AlertCircle,
    PenTool,
    Building2
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from "../data/pricingConfig";
import { useRazorpay } from "../hooks/useRazorpay";
import { RazorpaySuccessResponse } from "../services/razorpayService";

// ─────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────
type DocKey =
    | "boardResolution" | "auditorConsent" | "companyPan" | "coi"
    | "auditorCertificate" | "registeredOffice" | "financialStmt" | "intimationLetter"
    | "gstCert" | "msmeCert" | "mgt7" | "aoc4";

interface DocumentGroup {
    id: string;
    label: string;
    icon: React.ElementType;
    keys: DocKey[];
}

const ROC_DOCUMENTS: Record<DocKey, string> = {
    boardResolution: "Board Resolution - PDF",
    auditorConsent: "Auditor Consent Letter",
    companyPan: "Company PAN Card",
    coi: "Certificate of Incorporation",
    auditorCertificate: "Auditor's Eligibility Certificate",
    registeredOffice: "Registered Office Address Proof",
    financialStmt: "Financial Statements",
    intimationLetter: "Intimation Letter to Auditor",
    gstCert: "GST Registration Certificate",
    msmeCert: "MSME/Udyam Certificate",
    mgt7: "MGT-7 Annual Return",
    aoc4: "AOC-4 Financial Filing",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
    {
        id: "company-docs",
        label: "Company Documents",
        icon: Building2,
        keys: ["companyPan", "coi", "registeredOffice"],
    },
    {
        id: "appointment-docs",
        label: "Appointment Docs",
        icon: Briefcase,
        keys: ["boardResolution", "auditorConsent", "intimationLetter"],
    },
    {
        id: "compliance",
        label: "Compliance Certificates",
        icon: BadgeCheck,
        keys: ["auditorCertificate", "financialStmt"],
    },
    {
        id: "package-specific",
        label: "Bundle Add-ons",
        icon: Package,
        keys: ["gstCert", "msmeCert", "mgt7", "aoc4"],
    },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
    if (["companyPan", "coi", "financialStmt", "mgt7", "aoc4"].includes(key)) return FileText;
    if (["boardResolution", "auditorConsent", "intimationLetter"].includes(key)) return PenTool;
    if (["auditorCertificate", "msmeCert", "gstCert"].includes(key)) return BadgeCheck;
    if (["registeredOffice"].includes(key)) return Landmark;
    return FileText;
};

// ─────────────────────────────────────────────
// COLOR CONSTANTS (Matching ADT-1)
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

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ROCPackageFiling() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const { displayRazorpay } = useRazorpay();

    const packageOptions = useMemo(() => ({
        standard: {
            label: "Standard",
            price: PRICING_CONFIG["roc-package-standard"].fee,
            oldPrice: 1179,
            headline: "ROC Standard Package",
            description: "Core ROC filing bundle with ADT-1, INC-20A, DIR-3 KYC and MSME Registration.",
            includedServices: [
                { name: "MSME Registration", description: "Register MSME with Govt." },
                { name: "DIR-3 KYC Filing", description: "Director KYC compliance" },
                { name: "INC-20A Filing", description: "Commencement of business" },
                { name: "ADT-1 Filing", description: "Auditor appointment filing" },
                { name: "Auditor Consent Letter", description: "Auditor consent document" },
                { name: "Board Resolution - PDF", description: "Board resolution PDF document" },
            ],
            docKeys: ["companyPan", "coi", "registeredOffice", "boardResolution", "auditorConsent", "intimationLetter", "auditorCertificate", "financialStmt"] as DocKey[]
        },
        premium: {
            label: "Premium",
            price: PRICING_CONFIG["roc-package-premium"].fee,
            oldPrice: 1769,
            headline: "ROC Premium Package",
            description: "All ROC filings plus MSME, GST, ADT-1, INC-20A, AOC-4, MGT-7A and DIR-3 KYC bundled for smarter compliance.",
            includedServices: [
                { name: "MSME Registration", description: "Register MSME with Govt." },
                { name: "GST Registration", description: "GST registration included" },
                { name: "ADT-1 Filing", description: "Auditor appointment filing" },
                { name: "INC-20A Filing", description: "Commencement of business" },
                { name: "DIR-3 KYC Filing", description: "Director KYC compliance" },
                { name: "AOC-4 Filing", description: "Annual return filing" },
                { name: "MGT-7A Filing", description: "Annual compliance filing" },
                { name: "Auditor Consent Letter", description: "Auditor consent document" },
                { name: "Board Resolution - PDF", description: "Board resolution PDF document" },
            ],
            docKeys: ["companyPan", "coi", "registeredOffice", "boardResolution", "auditorConsent", "intimationLetter", "auditorCertificate", "financialStmt", "msmeCert", "gstCert", "aoc4", "mgt7"] as DocKey[]
        },
    }), []);

    const packageParam = useMemo(() => {
        const query = new URLSearchParams(location.search);
        const slug = query.get("package");
        return slug === "standard" || slug === "premium" ? slug : "premium";
    }, [location.search]) as "standard" | "premium";

    const [packageType, setPackageType] = useState<typeof packageParam>(packageParam);

    useEffect(() => {
        setPackageType(packageParam);
    }, [packageParam]);

    const currentPackage = useMemo(() => {
        return packageOptions[packageType];
    }, [packageType, packageOptions]);

    const handleStartApplication = async () => {
        if (isProcessing) return;
        if (!location.state?.requirementsConfirmed) {
            navigate(`/services/roc-package/requirements?type=${packageType}`, {
                state: { preSelectedType: packageType },
            });
            return;
        }

        setPaymentError(null);
        setIsProcessing(true);

        const fee = currentPackage.price;
        const total = calculateTotalWithGST(fee);
        const started = await displayRazorpay(
            total,
            (response: RazorpaySuccessResponse) => {
                const dest = packageType === "standard"
                    ? "/services/roc-standard-package"
                    : "/services/roc-premium-package";

                navigate(dest, {
                    state: {
                        packageType,
                        paymentInfo: response,
                        paymentAmount: total,
                        paymentCurrency: "INR",
                        paymentStatus: "paid",
                    },
                });
            },
            {
                name: `RegiBIZ ROC ${currentPackage.label} Package`,
                description: `Service Fee: ₹${fee.toLocaleString("en-IN")} + GST: ₹${calculateGST(fee).toLocaleString("en-IN")} = Total: ₹${total.toLocaleString("en-IN")}`,
                prefill: {
                    name: (location.state?.applicantName || "").toString(),
                    email: (location.state?.applicantEmail || "").toString(),
                    contact: (location.state?.applicantMobile || "").toString(),
                },
                onClosed: () => setIsProcessing(false),
            }
        );

        if (!started) {
            setPaymentError("Unable to start payment. Please try again.");
            setIsProcessing(false);
        }
    };

    const handleRequestCallback = () => {
        window.open("https://wa.me/6364562818", "_blank");
    };

    const benefits = [
        { text: "All ROC Filings in One Bundle", icon: Package },
        { text: "MCA Compliant Filing Process", icon: ShieldCheck },
        { text: "Expert Verification & Review", icon: BadgeCheck },
        { text: "Instant Filing Acknowledgment", icon: CheckCircle2 },
    ];

    const steps = [
        { step: "01", title: "Submit Documents", desc: "Upload required company & directors docs", icon: FileText },
        { step: "02", title: "Expert Review", desc: "Our CA reviews all docs for accuracy", icon: BadgeCheck },
        { step: "03", title: "MCA Filing", desc: "File ROC forms on portal with DSC", icon: Landmark },
    ];

    const stats = [
        { value: "10K+", label: "Packages Filed" },
        { value: "24 Hrs", label: "Processing Time" },
        { value: "100%", label: "Compliance Rate" },
        { value: `₹${currentPackage.price.toLocaleString()} + GST`, label: "Professional Service Fee | Govt charges applicable" },
    ];

    const PayBtn = ({ label, style = {}, variant = "primary" }: { label: string; style?: React.CSSProperties; variant?: "primary" | "secondary" }) => {
        const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
        const hoverGradient = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;

        return (
            <button
                onClick={handleStartApplication}
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
                {isProcessing ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                    <>{label}<ArrowRight size={16} /></>
                )}
            </button>
        );
    };

    return (
        <div className="bg-background min-h-screen text-[#e2e8f0]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

            {/* HEADER */}
            <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,12,27,0.95)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>

                    {/* Top row: back + title + price */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>

                        {/* Back + Title */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                            <button
                                onClick={() => navigate("/services/roc-selection")}
                                style={{
                                    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 10, padding: "7px", cursor: "pointer",
                                    color: "#6b7280", display: "flex", alignItems: "center",
                                    transition: "all 0.2s", flexShrink: 0,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "#f97316"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "transparent"; }}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{
                                        color: "#60a5fa", fontSize: 16, fontWeight: 800,
                                    }}>ROC Package</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, color: "#fff",
                                        background: GRADIENTS.button, borderRadius: 20,
                                        padding: "2px 8px", letterSpacing: "0.05em",
                                    }}>MCA Form</span>
                                </div>
                                {/* Package type switcher */}
                                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                    {Object.keys(packageOptions).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setPackageType(type as any)}
                                            style={{
                                                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                                                transition: "all 0.2s",
                                                background: packageType === type ? GRADIENTS.heading : "rgba(255,255,255,0.05)",
                                                color: packageType === type ? "#fff" : "#64748b",
                                                border: "none", cursor: "pointer",
                                            }}
                                        >
                                            {type.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Price + CTA — hidden on mobile */}
                        <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                    <span style={{
                                        ...(currentPackage.price === 0 ? FREE_TEXT_STYLE : { fontSize: 22, fontWeight: 800, color: "#fff" }),
                                    }}>
                                        {currentPackage.price === 0 ? "FREE" : `₹${currentPackage.price.toLocaleString()}`}
                                    </span>
                                    <span style={{ fontSize: 13, color: "#6b7280", textDecoration: "line-through", fontWeight: 500 }}>
                                        ₹{currentPackage.oldPrice}
                                    </span>
                                </div>
                                <p style={{ fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                                    {currentPackage.price === 0 ? "Limited Time Offer" : <><span>+ </span><span style={{ color: "#22d3ee" }}>Govt charges applicable</span></>}
                                </p>
                            </div>
                            <PayBtn label="Start Now" style={{ padding: "10px 18px", fontSize: 13 }} />
                        </div>
                    </div>

                    {/* Mobile-only CTA bar */}
                    <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
                        <PayBtn
                            label={`Apply ${currentPackage.label} — ${currentPackage.price === 0 ? "FREE" : `₹${currentPackage.price.toLocaleString()}`}`}
                            style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
                        />
                    </div>

                </div>
            </header>

            {/* MAIN */}
            <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>

                {/* HERO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 72, alignItems: "start" }} className="hero-grid">
                    {/* Left */}
                    <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "5px 14px", marginBottom: 24, boxShadow: "0 0 20px rgba(239,68,68,0.15)" }}>
                            <Star size={13} color="#f97316" fill="#f97316" />
                            <span style={{ fontSize: 12, fontWeight: 700 }}>Best {currentPackage.label} Filing Package</span>
                        </div>
                        <h1 style={{ fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
                            ROC {currentPackage.label}<br />
                            <span style={{ display: "inline-block", textShadow: GRADIENTS.headingGlow }}>Compliance Package</span>
                        </h1>
                        <p style={{ color: "#9ca3af", fontSize: 16, lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>{currentPackage.description} Mandatory compliance for all companies registered in India.</p>

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

                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                            {[{ icon: <Clock size={13} color="#f97316" />, label: "24 Hr Support" }, { icon: <CreditCard size={13} color="#06b6d4" />, label: "Secure Process" }, { icon: <Lock size={13} color="#10b981" />, label: "MCA Compliant" }].map(({ icon, label }, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>{icon}<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span></div>
                            ))}
                        </div>
                    </div>

                    {/* Right: How it Works */}
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: 36, backdropFilter: "blur(16px)", boxShadow: "0 8px 40px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, borderRadius: 24, padding: "1px", background: GRADIENTS.button, WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", pointerEvents: "none", opacity: 0.4 }} />
                        <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 36, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", }}>Full Package Process</h3>

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
                        <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
                            <button onClick={handleRequestCallback} disabled={isProcessing} style={{ flex: 1, background: "transparent", border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1, borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s" }} onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; } }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}><Phone size={14} color="#f97316" /><span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Request Callback</span></button>
                            <PayBtn label={`Apply for ${currentPackage.label}`} style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }} />
                        </div>
                        {paymentError && (
                            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                                <AlertCircle size={16} />
                                {paymentError}
                            </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24, background: "rgba(6,182,212,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)" }}>
                            {[{ v: "10K+", l: "Packages" }, { v: "24 Hrs", l: "Processing" }, { v: "100%", l: "Compliance" }].map(({ v, l }, i) => (
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
                        <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>Verification checklist for the {currentPackage.label} package.</p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22 }} className="doc-grid">
                        {DOCUMENT_GROUPS.map((group) => {
                            const activeKeys = group.keys.filter(k => currentPackage.docKeys.includes(k));
                            if (activeKeys.length === 0) return null;

                            return (
                                <div key={group.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: 26, transition: "all 0.25s", position: "relative" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.transform = "translateY(-4px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(239,68,68,0.3)" }}><group.icon size={18} color="#f97316" /></div>
                                        <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{group.label}</h4>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                                        {activeKeys.map((docKey) => {
                                            const Icon = getIconForDoc(docKey);
                                            return (
                                                <div key={docKey} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
                                                    <Icon size={14} color="#f97316" /><span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 500 }}>{ROC_DOCUMENTS[docKey]}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* SERVICES INCLUDED */}
                <div style={{ marginBottom: 72 }}>
                    <div style={{ textAlign: "center", marginBottom: 44 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>What's Included</p>
                        <h2 style={{ fontSize: 32, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 14px", textShadow: GRADIENTS.headingGlow }}>Bundle Services</h2>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                        {currentPackage.includedServices.map((service, i) => (
                            <div key={i} style={{ padding: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, display: "flex", gap: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: GRADIENTS.button, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Briefcase size={18} color="#fff" /></div>
                                <div>
                                    <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 4 }}>{service.name}</h4>
                                    <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{service.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* STATS BAR */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden", marginBottom: 72, padding: "4px" }}>
                    {stats.map(({ value, label }, i) => (
                        <div key={i} style={{ padding: "26px 16px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                            <div style={{ fontSize: 28, fontWeight: 800, background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 }}>{value}</div>
                            <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* IMPORTANT NOTICE */}
                <div style={{ marginBottom: 72, padding: "24px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 18, display: "flex", gap: 16, alignItems: "start" }}>
                    <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>Important: ROC Compliance Deadline</h4>
                        <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>Timely filing of ROC forms is essential to avoid heavy penalties and maintain active company status. Ensure all data is accurate before submission.</p>
                    </div>
                </div>

                {/* BOTTOM CTA */}
                <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "40px 20px", textAlign: "center" }}>
                    <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2 }}>Apply for <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: GRADIENTS.headingGlow }}>{currentPackage.label} Package</span></h2>
                    <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 42, maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7 }}>Comprehensive compliance solution for your business.</p>
                    <PayBtn label={`Avail ${currentPackage.label} — ${currentPackage.price === 0 ? "FREE" : `₹${currentPackage.price.toLocaleString()}`}`} variant="primary" style={{ borderRadius: 14, padding: "14px 20px", fontSize: 14, maxWidth: "100%", width: "100%" }} />
                </div>

                <footer style={{ marginTop: 72, paddingTop: 36, paddingBottom: 36, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
                </footer>
            </main>

            <style>{`
            @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            html { scroll-behavior: smooth; }
            ::selection { background: rgba(249,115,22,0.25); color: #fff; }

            @media (max-width: 640px) {
                .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
                .doc-grid { grid-template-columns: 1fr !important; }
                .header-cta { display: none !important; }
                .mobile-cta-bar { display: block !important; }
                .mobile-cta-bar button { width: 100% !important; font-size: 13px !important; padding: 12px 12px !important; }
            }

            @media (min-width: 641px) and (max-width: 1024px) {
                .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
                .doc-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            `}</style>
        </div>
    );
}
