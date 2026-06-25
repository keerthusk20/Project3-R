import React, { useEffect, useState } from "react";
import {
    CheckCircle2,
    FileText,
    Landmark,
    User,
    Building2,
    ArrowRight,
    Phone,
    Clock,
    CreditCard,
    ChevronLeft,
    Loader2,
    Star,
    BadgeCheck,
    Briefcase,
    FileCheck2,
    ShieldCheck,
    ScrollText,
    BookOpen,
    Scale,
    Users,
    Gavel,
    BarChart3,
    CalendarCheck,
    AlertTriangle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST } from "../data/pricingConfig";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type DocKey =
    | "pan"
    | "aadhaar"
    | "addressProof"
    | "utilityBill"
    | "cancelledCheque"
    | "bankStatement"
    | "cin"
    | "din"
    | "boardResolution"
    | "auditorConsent"
    | "financialStatement"
    | "insidePhoto"
    | "outsidePhoto"
    | "signature"
    | "msmeRegistration"
    | "gstCertificate";

// ─────────────────────────────────────────────
// COLOR CONSTANTS  (identical to company landing)
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
// DOCUMENT DATA
// ─────────────────────────────────────────────
const ALL_DOCUMENTS: Record<DocKey, string> = {
    pan: "PAN Card (Proprietor / Director)",
    aadhaar: "Aadhaar Card (Authorized Signatory)",
    addressProof: "Registered Office Address Proof",
    utilityBill: "Utility Bill / Electricity Bill",
    cancelledCheque: "Cancelled Cheque / Bank Proof",
    bankStatement: "Latest Bank Statement",
    cin: "Certificate of Incorporation (COI / CIN)",
    din: "Director Identification Number (DIN)",
    boardResolution: "Board Resolution (Certified Copy)",
    auditorConsent: "Auditor Consent Letter",
    financialStatement: "Latest Financial Statements",
    insidePhoto: "Inside Office Photograph",
    outsidePhoto: "Outside Office / Building Photo",
    signature: "Authorized Signatory's Signature",
    msmeRegistration: "Existing MSME / Udyam Certificate (if any)",
    gstCertificate: "GST Certificate (if applicable)",
};

// ─────────────────────────────────────────────
// FORM PACKAGES DATA
// ─────────────────────────────────────────────
const ROC_FORMS = [
    {
        id: "msme",
        label: "MSME / Udyam Registration",
        shortLabel: "MSME",
        badge: "Govt. Free",
        badgeColor: "#10b981",
        icon: Briefcase,
        tagline: "Udyam portal registration for micro, small & medium enterprises",
        highlights: [
            "Zero government fees — 100% free on Udyam portal",
            "Aadhaar & PAN-based — no document upload required",
            "Covers manufacturing & service enterprises",
            "Benefits: bank loans, subsidies, GST exemptions",
            "Instant Udyam certificate after submission",
        ],
        deadline: "No mandatory deadline",
        serviceFee: "₹0 (Free)",
        timeline: "1–2 Days",
    },
    {
        id: "dir3",
        label: "DIR-3 KYC",
        shortLabel: "DIR-3",
        badge: "Annual",
        badgeColor: "#f97316",
        icon: User,
        tagline: "Mandatory annual KYC for every DIN holder to keep DIN active",
        highlights: [
            "Every director with a DIN must file DIR-3 KYC annually",
            "OTP verification via mobile & email on MCA portal",
            "Failure = DIN deactivation & ₹5,000 penalty",
            "Web-based KYC (DIR-3 KYC-WEB) for subsequent years",
            "Due by 30 September each financial year",
        ],
        deadline: "30 September (Annual)",
        serviceFee: "₹699 + GST",
        timeline: "Same Day",
    },
    {
        id: "inc20a",
        label: "INC-20A",
        shortLabel: "INC-20A",
        badge: "Mandatory",
        badgeColor: "#ef4444",
        icon: Building2,
        tagline: "Declaration of commencement of business — filed within 180 days of COI",
        highlights: [
            "Mandatory within 180 days of incorporation for Pvt Ltd / Public Ltd",
            "Confirms share capital received by subscribers",
            "Requires registered office verification with photos",
            "Non-filing invites ₹50,000+ penalty on company & directors",
            "Not applicable to companies incorporated without share capital",
        ],
        deadline: "Within 180 days of COI",
        serviceFee: "₹699 + GST",
        timeline: "2–4 Days",
    },
    {
        id: "adt1",
        label: "ADT-1",
        shortLabel: "ADT-1",
        badge: "First Year",
        badgeColor: "#8b5cf6",
        icon: Gavel,
        tagline: "Appointment of first statutory auditor — filed within 15 days of AGM",
        highlights: [
            "Filed by the company when appointing an auditor",
            "First auditor must be appointed within 30 days of incorporation",
            "Board resolution authorizing auditor appointment required",
            "Auditor consent letter (Form ADT-1) required from CA/CPA firm",
            "Penalty of ₹10,000 for delay or non-filing",
        ],
        deadline: "Within 15 days of AGM / 30 days of incorporation",
        serviceFee: "₹699 + GST",
        timeline: "2–3 Days",
    },
    {
        id: "gst",
        label: "GST Registration",
        shortLabel: "GST Reg.",
        badge: "Business",
        badgeColor: "#06b6d4",
        icon: Building2,
        tagline: "Goods and Services Tax Registration for your business",
        highlights: [
            "Mandatory for turnover above threshold",
            "Enables Input Tax Credit (ITC) claim",
            "Improves business credibility",
            "Filed directly on the GST portal",
            "ARN and GSTIN generated upon processing",
        ],
        deadline: "Within 30 days of liability",
        serviceFee: "₹0 (Free)",
        timeline: "3–5 Days",
    },
    {
        id: "aoc4",
        label: "AOC-4",
        shortLabel: "AOC-4",
        badge: "Annual",
        badgeColor: "#10b981",
        icon: BarChart3,
        tagline: "Filing of financial statements with the ROC annually",
        highlights: [
            "Mandatory for all companies",
            "Includes Balance Sheet and P&L account",
            "Filed within 30 days of AGM",
            "Requires CA/CS certification",
            "Penalty of ₹100 per day of default",
        ],
        deadline: "Within 30 days of AGM",
        serviceFee: "₹699 + GST",
        timeline: "1–2 Days",
    },
    {
        id: "mgt7a",
        label: "MGT-7A",
        shortLabel: "MGT-7A",
        badge: "Annual",
        badgeColor: "#f59e0b",
        icon: Users,
        tagline: "Annual return filing for OPCs and small companies",
        highlights: [
            "Mandatory annual compliance",
            "Details of directors, shareholders, and meetings",
            "Filed within 60 days of AGM",
            "Certified by a Company Secretary",
            "Heavy penalties for non-compliance",
        ],
        deadline: "Within 60 days of AGM",
        serviceFee: "₹699 + GST",
        timeline: "1–2 Days",
    }
];

interface DocGroup {
    id: string;
    label: string;
    icon: React.ElementType;
    keys: DocKey[];
}

const DOCUMENT_GROUPS: DocGroup[] = [
    {
        id: "identity",
        label: "Promoter / Director Identity",
        icon: User,
        keys: ["pan", "aadhaar", "signature"],
    },
    {
        id: "office",
        label: "Registered Office Proof",
        icon: Landmark,
        keys: ["addressProof", "utilityBill", "insidePhoto", "outsidePhoto"],
    },
    {
        id: "company",
        label: "Company / Corporate Documents",
        icon: Building2,
        keys: ["cin", "din", "boardResolution", "financialStatement"],
    },
    {
        id: "bank",
        label: "Financial & Bank Documents",
        icon: BarChart3,
        keys: ["cancelledCheque", "bankStatement", "auditorConsent", "gstCertificate"],
    },
];

const getIconForDoc = (key: DocKey): React.ElementType => {
    if (["pan", "aadhaar", "signature"].includes(key)) return User;
    if (["addressProof", "utilityBill", "insidePhoto", "outsidePhoto"].includes(key)) return Landmark;
    if (["cin", "din", "boardResolution", "financialStatement"].includes(key)) return FileText;
    if (["cancelledCheque", "bankStatement", "auditorConsent", "gstCertificate"].includes(key)) return BarChart3;
    if (["msmeRegistration"].includes(key)) return BadgeCheck;
    return FileText;
};

// ─────────────────────────────────────────────
// SHARED BUTTON COMPONENT (identical to company landing)
// ─────────────────────────────────────────────
interface PayBtnProps {
    label: string;
    style?: React.CSSProperties;
    variant?: "primary" | "secondary";
    onClick: () => void;
    disabled?: boolean;
    isProcessing?: boolean;
}

const ActionBtn: React.FC<PayBtnProps> = ({
    label,
    style = {},
    variant = "primary",
    onClick,
    disabled = false,
    isProcessing = false,
}) => {
    const baseGradient = variant === "primary" ? GRADIENTS.button : GRADIENTS.heading;
    const hoverGradient = variant === "primary" ? GRADIENTS.buttonHover : GRADIENTS.heading;

    return (
        <button
            onClick={onClick}
            disabled={disabled || isProcessing}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontWeight: 700,
                cursor: disabled || isProcessing ? "not-allowed" : "pointer",
                opacity: disabled || isProcessing ? 0.7 : 1,
                transition: "all 0.25s ease",
                border: "none",
                color: "#fff",
                borderRadius: 12,
                background: baseGradient,
                boxShadow: variant === "primary" ? GRADIENTS.buttonGlow : "none",
                position: "relative",
                overflow: "hidden",
                ...style,
            }}
            onMouseEnter={(e) => {
                if (!disabled && !isProcessing) {
                    e.currentTarget.style.background = hoverGradient;
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                        variant === "primary"
                            ? "0 8px 30px rgba(6, 182, 212, 0.5)"
                            : GRADIENTS.headingGlow;
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = baseGradient;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                    variant === "primary" ? GRADIENTS.buttonGlow : "none";
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
                    <ArrowRight size={16} />
                </>
            )}
        </button>
    );
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ROCComplianceLanding() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeForm, setActiveForm] = useState<string>("msme");

    const activeFormData = ROC_FORMS.find((f) => f.id === activeForm)!;

    useEffect(() => {
        const preSelectedType = location.state?.preSelectedType;
        if (
            location.state?.requirementsConfirmed &&
            ROC_FORMS.some((form) => form.id === preSelectedType) &&
            activeForm !== preSelectedType
        ) {
            setActiveForm(preSelectedType);
        }
    }, [location.state, activeForm]);

    const handleStartFiling = () => {
        if (isProcessing) return;
        if (!location.state?.requirementsConfirmed) {
            navigate("/services/roc-compliance/requirements", {
                state: { preSelectedType: activeForm },
            });
            return;
        }
        setIsProcessing(true);
        navigate("/services/roc-compliance/form", {
            state: {
                verified: true,
                source: "landing-page",
                preSelectedForm: activeForm,
            },
        });
        setTimeout(() => setIsProcessing(false), 800);
    };

    const handleRequestCallback = () => {
        window.open("https://wa.me/6364562818", "_blank");
    };

    // Process steps vary by active form
    const processStepsMap: Record<string, { num: string; title: string; desc: string; color: string }[]> = {
        msme: [
            { num: "01", title: "Aadhaar OTP Verification", desc: "Mobile OTP linked to Aadhaar — portal verifies your identity via UIDAI", color: "#60a5fa" },
            { num: "02", title: "Business Details Entry", desc: "NIC code, investment amount, turnover, employees & date of commencement", color: "#60a5fa" },
            { num: "03", title: "Bank & Address Details", desc: "Registered office address and business bank account information", color: "#60a5fa" },
            { num: "04", title: "Submit on Udyam Portal", desc: "We file directly on https://udyamregistration.gov.in on your behalf", color: "#60a5fa" },
            { num: "05", title: "Udyam Certificate", desc: "Download the official Udyam Registration Certificate — valid for lifetime", color: "#60a5fa" },
            { num: "06", title: "Post-Registration Benefits", desc: "Access MSME schemes, priority lending, government tenders & subsidies", color: "#60a5fa" },
        ],
        dir3: [
            { num: "01", title: "Fetch DIN Details", desc: "DIN verified on MCA portal — pre-filled data reviewed and confirmed", color: "#60a5fa" },
            { num: "02", title: "Update KYC Information", desc: "Current residential address, mobile, email — must match MCA records", color: "#60a5fa" },
            { num: "03", title: "OTP Verification", desc: "Dual OTP via registered mobile + email linked on MCA portal", color: "#60a5fa" },
            { num: "04", title: "Upload Documents", desc: "Identity proof and address proof uploaded on MCA V3 portal", color: "#60a5fa" },
            { num: "05", title: "DSC Signing", desc: "Form digitally signed using Class 3 DSC of the director", color: "#60a5fa" },
            { num: "06", title: "DIN Status Active", desc: "DIN marked KYC-done for the financial year — confirmation email sent", color: "#60a5fa" },
        ],
        inc20a: [
            { num: "01", title: "Verify CIN & Company Details", desc: "Confirm Certificate of Incorporation number, registered office & email", color: "#60a5fa" },
            { num: "02", title: "Share Capital Confirmation", desc: "Subscriber-wise payment details — bank, IFSC, amount & date of receipt", color: "#60a5fa" },
            { num: "03", title: "Registered Office Photos", desc: "Inside & outside photos of registered office with visible address board", color: "#60a5fa" },
            { num: "04", title: "Board Resolution Upload", desc: "Certified true copy of board resolution authorizing commencement", color: "#60a5fa" },
            { num: "05", title: "DSC & DIN Verification", desc: "Director DIN verified and form signed with Class 3 Organization DSC", color: "#60a5fa" },
            { num: "06", title: "Filed on MCA Portal", desc: "INC-20A filed and SRN generated — commencement certificate issued", color: "#60a5fa" },
        ],
        adt1: [
            { num: "01", title: "Auditor Selection", desc: "Confirm appointment of CA/CPA firm as statutory auditor at board meeting", color: "#60a5fa" },
            { num: "02", title: "Board Resolution", desc: "Resolution authorizing auditor appointment — certified true copy required", color: "#60a5fa" },
            { num: "03", title: "Auditor Consent Letter", desc: "Written consent from auditor confirming their eligibility and willingness", color: "#60a5fa" },
            { num: "04", title: "ADT-1 Form Preparation", desc: "Auditor details — membership number, FRN, address, PAN & email", color: "#60a5fa" },
            { num: "05", title: "DSC Signing & Filing", desc: "Form signed with director's Class 3 DSC and filed on MCA portal", color: "#60a5fa" },
            { num: "06", title: "SRN & Acknowledgment", desc: "Service Request Number generated — auditor appointment officially recorded", color: "#60a5fa" },
        ],
        gst: [
            { num: "01", title: "Collect Documents", desc: "PAN, Aadhaar, photo & business proof of promoters", color: "#60a5fa" },
            { num: "02", title: "GST Portal Filing", desc: "Application filed on GST portal with entity details", color: "#60a5fa" },
            { num: "03", title: "ARN Generated", desc: "Application Reference Number issued within minutes", color: "#60a5fa" },
            { num: "04", title: "Dept. Verification", desc: "GST officer reviews application for completeness", color: "#60a5fa" },
            { num: "05", title: "Clarifications (If Any)", desc: "Respond to any notices issued by the GST officer", color: "#60a5fa" },
            { num: "06", title: "GSTIN Issued", desc: "15-digit GSTIN and certificate issued successfully", color: "#60a5fa" },
        ],
        aoc4: [
            { num: "01", title: "Prepare Financials", desc: "Finalize Balance Sheet and P&L account", color: "#60a5fa" },
            { num: "02", title: "Board Approval", desc: "Board of Directors approves the financial statements", color: "#60a5fa" },
            { num: "03", title: "Auditor's Report", desc: "Obtain the auditor's report on the financials", color: "#60a5fa" },
            { num: "04", title: "Fill AOC-4", desc: "Fill the e-form AOC-4 with financial data", color: "#60a5fa" },
            { num: "05", title: "CA/CS Certification", desc: "Form certified by a practicing professional", color: "#60a5fa" },
            { num: "06", title: "MCA Filing", desc: "File AOC-4 on MCA portal and generate SRN", color: "#60a5fa" },
        ],
        mgt7a: [
            { num: "01", title: "Compile Data", desc: "Gather details of directors, members, and meetings", color: "#60a5fa" },
            { num: "02", title: "Draft Annual Return", desc: "Prepare the annual return in form MGT-7A", color: "#60a5fa" },
            { num: "03", title: "Board Approval", desc: "Board approves the draft annual return", color: "#60a5fa" },
            { num: "04", title: "Digital Signatures", desc: "Affix DSC of director to the e-form", color: "#60a5fa" },
            { num: "05", title: "Professional Cert.", desc: "Form certified by a Company Secretary if required", color: "#60a5fa" },
            { num: "06", title: "MCA Filing", desc: "File MGT-7A on MCA portal and generate SRN", color: "#60a5fa" },
        ],
    };

    const currentSteps = processStepsMap[activeForm] || processStepsMap.msme;

    const howItWorksSteps = [
        {
            step: "01",
            title: "Select Your Filing",
            desc: "Choose from MSME, GST, ADT-1, INC-20A, DIR-3 KYC, AOC-4 or MGT-7A — or file them together as a package",
            icon: ScrollText,
        },
        {
            step: "02",
            title: "Submit Details & Documents",
            desc: "Fill in business, director, or auditor details. Upload required documents section by section",
            icon: FileCheck2,
        },
        {
            step: "03",
            title: "We File & You Get SRN",
            desc: "Our CA team files on MCA / Udyam portal and sends you the SRN, acknowledgment & certificate",
            icon: BadgeCheck,
        },
    ];

    const stats = [
        { value: "8K+", label: "Filings Done" },
        { value: `₹${calculateTotalWithGST(PRICING_CONFIG["roc-package"].fee).toLocaleString()}`, label: "Service Fee (Incl. 18% GST)" },
        { value: "98%", label: "SRN Success" },
        { value: "Same Day", label: "Turnaround" },
    ];

    const complianceComparison = [
        { form: "MSME / Udyam", who: "All business owners", deadline: "No deadline — do it anytime", penalty: "Loss of MSME benefits", serviceFee: "FREE", color: "#60a5fa" },
        { form: "DIR-3 KYC", who: "Every DIN holder", deadline: "30 September annually", penalty: "₹5,000 + DIN deactivation", serviceFee: "₹699 + GST", color: "#60a5fa" },
        { form: "INC-20A", who: "Pvt Ltd / Public Ltd", deadline: "Within 180 days of COI", penalty: "₹50,000+ on company & directors", serviceFee: "₹299 + GST", color: "#60a5fa" },
        { form: "ADT-1", who: "All companies", deadline: "30 days of incorp / 15 days of AGM", penalty: "₹10,000 per day of default", serviceFee: "₹699 + GST", color: "#60a5fa" },
        { form: "GST Reg.", who: "Turnover > threshold", deadline: "Within 30 days of liability", penalty: "100% of tax due or ₹10k", serviceFee: "FREE", color: "#60a5fa" },
        { form: "AOC-4", who: "All companies", deadline: "30 days of AGM", penalty: "₹100 per day of default", serviceFee: "₹699 + GST", color: "#60a5fa" },
        { form: "MGT-7A", who: "OPCs / Small Companies", deadline: "60 days of AGM", penalty: "₹100 per day of default", serviceFee: "₹699 + GST", color: "#60a5fa" },
    ];

    return (
        <div className="bg-background min-h-screen text-[#e2e8f0]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

            {/* ── HEADER ── */}
            <header
                style={{
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(2,12,27,0.95)",
                    backdropFilter: "blur(24px)",
                    position: "sticky", top: 0, zIndex: 50,
                }}
            >
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>

                    {/* Top row: back + title + price */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>

                        {/* Back + Title */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                            <button
                                onClick={() => navigate("/services")}
                                disabled={isProcessing}
                                style={{
                                    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 10, padding: 8, cursor: isProcessing ? "not-allowed" : "pointer",
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
                                        fontSize: 16, fontWeight: 800,
                                        background: GRADIENTS.heading,
                                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    }}>
                                        ROC Compliance Package
                                    </span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, color: "#fff",
                                        background: GRADIENTS.button, borderRadius: 20,
                                        padding: "2px 8px", letterSpacing: "0.05em",
                                    }}>
                                        MCA
                                    </span>
                                </div>
                                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
                                    RegiBIZ — Guided Compliance Filing
                                </p>
                            </div>
                        </div>

                        {/* Price + CTA — hidden on mobile */}
                        <div className="header-cta" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                    <span style={{
                                        fontSize: 22, fontWeight: 800, color: "#fff",
                                    }}>
                                        ₹{calculateTotalWithGST(PRICING_CONFIG["roc-package"].fee).toLocaleString()}
                                    </span>
                                    <span style={{ fontSize: 12, color: "#4b5563", textDecoration: "line-through" }}>
                                        ₹3,999
                                    </span>
                                </div>
                                <p style={{
                                    fontSize: 12, color: "#d1d5db", fontWeight: 700, margin: 0, whiteSpace: "nowrap",
                                }}>
                                    Full 7-Form Package
                                </p>
                            </div>
                            <ActionBtn
                                label="Start Filing"
                                style={{ padding: "10px 18px", fontSize: 13 }}
                                onClick={handleStartFiling}
                                isProcessing={isProcessing}
                            />
                        </div>
                    </div>

                    {/* Mobile-only CTA bar */}
                    <div className="mobile-cta-bar" style={{ display: "none", marginTop: 10 }}>
                        <ActionBtn
                            label={`Start ROC Package — ₹${calculateTotalWithGST(PRICING_CONFIG["roc-package"].fee).toLocaleString()}`}
                            style={{ width: "100%", padding: "12px 16px", fontSize: 13, borderRadius: 10 }}
                            onClick={handleStartFiling}
                            isProcessing={isProcessing}
                        />
                    </div>

                </div>
            </header>

            {/* ── MAIN ── */}
            <main
                style={{
                    maxWidth: 1200, margin: "0 auto", padding: "32px 16px",
                    position: "relative", zIndex: 1,
                }}
            >
                {/* ── HERO ── */}
                <div
                    style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: 48, marginBottom: 72, alignItems: "start",
                    }}
                    className="hero-grid"
                >
                    {/* Left */}
                    <div>
                        {/* Alert badge */}
                        <div
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: 20, padding: "5px 14px", marginBottom: 24,
                                boxShadow: "0 0 20px rgba(239,68,68,0.15)",
                            }}
                        >
                            <AlertTriangle size={13} color="#f97316" />
                            <span
                                style={{
                                    fontSize: 12, background: GRADIENTS.heading,
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    fontWeight: 700,
                                }}
                            >
                                Compliance Deadlines — File Before Penalties
                            </span>
                        </div>

                        <h1
                            style={{
                                fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1.15,
                                margin: "0 0 16px", letterSpacing: "-0.03em",
                                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
                            }}
                        >
                            Stay Compliant.
                            <br />
                            <span
                                style={{
                                    background: GRADIENTS.heading,
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    display: "inline-block", textShadow: GRADIENTS.headingGlow,
                                }}
                            >
                                Avoid Penalties.
                            </span>
                        </h1>
                        <p
                            style={{
                                color: "#9ca3af", fontSize: 16, lineHeight: 1.7,
                                marginBottom: 32, maxWidth: 480,
                            }}
                        >
                            File MSME Registration, GST Registration, ADT-1, INC-20A, DIR-3 KYC, AOC-4, and MGT-7A in one guided flow.
                            Our CA team handles the entire MCA portal filing — you just provide the details.
                        </p>

                        {/* ── FORM SELECTOR TABS ── */}
                        <div style={{ marginBottom: 28 }}>
                            <p
                                style={{
                                    fontSize: 11, fontWeight: 800,
                                    background: GRADIENTS.heading,
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    letterSpacing: "0.12em", textTransform: "uppercase",
                                    marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
                                }}
                            >
                                <ScrollText size={13} color="#ef4444" /> Select Form to Preview
                            </p>
                            <div
                                style={{
                                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
                                    padding: 4, background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
                                }}
                            >
                                {ROC_FORMS.map((form) => (
                                    <button
                                        key={form.id}
                                        onClick={() => setActiveForm(form.id)}
                                        style={{
                                            padding: "9px 8px", borderRadius: 10, border: "none",
                                            cursor: "pointer", fontWeight: 700, fontSize: 12,
                                            transition: "all 0.25s ease",
                                            background: activeForm === form.id ? GRADIENTS.button : "transparent",
                                            color: activeForm === form.id ? "#fff" : "#6b7280",
                                            boxShadow: activeForm === form.id ? GRADIENTS.buttonGlow : "none",
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center", gap: 5,
                                        }}
                                    >
                                        <form.icon size={13} />
                                        {form.shortLabel}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── ACTIVE FORM CARD ── */}
                        <div
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 14, padding: "18px 20px", marginBottom: 28,
                                transition: "all 0.3s ease",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div
                                    style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: "rgba(239,68,68,0.12)", display: "flex",
                                        alignItems: "center", justifyContent: "center",
                                        border: "1px solid rgba(239,68,68,0.25)", flexShrink: 0,
                                    }}
                                >
                                    <activeFormData.icon size={16} color="#f97316" />
                                </div>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                                            {activeFormData.label}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 9, fontWeight: 800, color: "#fff",
                                                background: activeFormData.badgeColor, borderRadius: 20,
                                                padding: "2px 8px", letterSpacing: "0.06em", textTransform: "uppercase",
                                            }}
                                        >
                                            {activeFormData.badge}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 1 }}>
                                        {activeFormData.tagline}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
                                {activeFormData.highlights.map((h, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                                        <CheckCircle2 size={13} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                                        <span style={{ fontSize: 13, color: "#d1d5db" }}>{h}</span>
                                    </div>
                                ))}
                            </div>

                            <div
                                style={{
                                    display: "flex", gap: 12, paddingTop: 12,
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                {[
                                    { label: "Deadline", value: activeFormData.deadline, color: "#60a5fa" },
                                    { label: "Timeline", value: activeFormData.timeline, color: "#60a5fa" },
                                    { label: "Service Fee", value: activeFormData.serviceFee, color: "#60a5fa" },
                                ].map(({ label, value, color }) => {
                                    const isFreeValue = String(value).toLowerCase().includes("free") || value === "₹0 (Free)";

                                    return (
                                        <div key={label} style={{ flex: 1 }}>
                                            <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                {label}
                                            </p>
                                            <p style={{
                                                fontSize: 12,
                                                ...(isFreeValue ? FREE_TEXT_STYLE : { color, fontWeight: 700 }),
                                                margin: 0,
                                            }}>{value}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Trust badges */}
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            {[
                                { icon: <Clock size={13} color="#f97316" />, label: "Same-Day Filing Available" },
                                { icon: <CreditCard size={13} color="#06b6d4" />, label: "Transparent Pricing" },
                                { icon: <Phone size={13} color="#10b981" />, label: "CA-Verified Filing" },
                            ].map(({ icon, label }, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8,
                                        padding: "6px 12px", background: "rgba(255,255,255,0.03)",
                                        borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                >
                                    {icon}
                                    <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: How It Works */}
                    <div
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 24, padding: 36,
                            backdropFilter: "blur(16px)",
                            boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                            position: "relative", overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute", inset: 0, borderRadius: 24, padding: "1px",
                                background: GRADIENTS.button,
                                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                WebkitMaskComposite: "xor", maskComposite: "exclude",
                                pointerEvents: "none", opacity: 0.4,
                            }}
                        />

                        <h3
                            style={{
                                fontSize: 19, fontWeight: 800, color: "#fff",
                                textAlign: "center", marginBottom: 8,
                                background: GRADIENTS.heading,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            }}
                        >
                            How it works
                        </h3>
                        <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 28 }}>
                            Complete all 4 forms in one guided flow
                        </p>

                        <div style={{ display: "flex", flexDirection: "column" }}>
                            {howItWorksSteps.map((item, i) => (
                                <div key={i} style={{ display: "flex", gap: 18, position: "relative" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                        <div
                                            style={{
                                                width: 48, height: 48, borderRadius: "50%",
                                                background: GRADIENTS.button,
                                                border: "2px solid rgba(255,255,255,0.15)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                flexShrink: 0, boxShadow: GRADIENTS.buttonGlow, position: "relative", zIndex: 1,
                                            }}
                                        >
                                            <item.icon size={20} color="#fff" />
                                        </div>
                                        {i < howItWorksSteps.length - 1 && (
                                            <div
                                                style={{
                                                    width: 2, height: 36,
                                                    background: "linear-gradient(to bottom, rgba(6,182,212,0.5), rgba(6,182,212,0.08))",
                                                    margin: "8px 0", borderRadius: 2,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div style={{ paddingBottom: i < howItWorksSteps.length - 1 ? 24 : 0, paddingTop: 10, flex: 1 }}>
                                        <span
                                            style={{
                                                fontSize: 10, fontWeight: 800,
                                                color: "#60a5fa",
                                                letterSpacing: "0.12em", display: "inline-block",
                                            }}
                                        >
                                            STEP {item.step}
                                        </span>
                                        <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "6px 0" }}>{item.title}</h4>
                                        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
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
                                    • SRN, acknowledgment & filing status updates for each form
                                </p>
                                <p style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
                                    • Certificate of MSME Registration, GST Registration, and INC-20A commencement (where applicable)
                                </p>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
                            <button
                                onClick={handleRequestCallback}
                                disabled={isProcessing}
                                style={{
                                    flex: 1, background: "transparent",
                                    border: "2px solid", borderImage: GRADIENTS.heading, borderImageSlice: 1,
                                    borderRadius: 12, padding: "13px 16px", color: "#fff",
                                    fontSize: 13, fontWeight: 700,
                                    cursor: isProcessing ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                    opacity: isProcessing ? 0.6 : 1, transition: "all 0.25s",
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
                                <Phone size={14} color="#f97316" />
                                <span style={{ background: GRADIENTS.heading, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                    Callback
                                </span>
                            </button>
                            <ActionBtn
                                label="Start Package"
                                style={{ flex: 1, padding: "13px 16px", fontSize: 13, borderRadius: 12 }}
                                onClick={handleStartFiling}
                                isProcessing={isProcessing}
                            />
                        </div>

                        {/* Mini stats */}
                        <div
                            style={{
                                display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                                marginTop: 24, background: "rgba(6,182,212,0.06)",
                                borderRadius: 14, overflow: "hidden", border: "1px solid rgba(6,182,212,0.15)",
                            }}
                        >
                            {[
                                { v: "8K+", l: "Filings" },
                                { v: "7 Forms", l: "One Flow" },
                                { v: "98%", l: "Success" },
                            ].map(({ v, l }, i) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: "14px 10px", textAlign: "center",
                                        borderRight: i < 2 ? "1px solid rgba(6,182,212,0.12)" : "none",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 17, fontWeight: 800,
                                            background: GRADIENTS.button,
                                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        {v}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, fontWeight: 500 }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── MCA PROCESS STEPS (dynamic per active form) ── */}
                <div style={{ marginBottom: 72 }}>
                    <div style={{ textAlign: "center", marginBottom: 44 }}>
                        <p
                            style={{
                                fontSize: 11, fontWeight: 800,
                                background: GRADIENTS.heading,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10,
                            }}
                        >
                            Filing Process
                        </p>
                        <h2
                            style={{
                                fontSize: 32, fontWeight: 800,
                                background: GRADIENTS.heading,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                margin: "0 0 14px", textShadow: GRADIENTS.headingGlow,
                            }}
                        >
                            {activeFormData.label} — Step by Step
                        </h2>
                        <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
                            Switch between forms above to see the exact filing process for each compliance form.
                        </p>
                    </div>

                    <div
                        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}
                        className="process-grid"
                    >
                        {currentSteps.map((item, i) => (
                            <div
                                key={i}
                                style={{
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 14, padding: "20px 18px", transition: "all 0.25s",
                                    position: "relative", overflow: "hidden",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `${item.color}40`;
                                    e.currentTarget.style.background = `${item.color}08`;
                                    e.currentTarget.style.transform = "translateY(-4px)";
                                    e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.3)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 28, fontWeight: 900, color: item.color, opacity: 0.2,
                                        position: "absolute", top: 12, right: 16, lineHeight: 1, pointerEvents: "none",
                                    }}
                                >
                                    {item.num}
                                </div>
                                <div
                                    style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: `${item.color}20`, border: `1px solid ${item.color}40`,
                                        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
                                    }}
                                >
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
                        <p
                            style={{
                                fontSize: 11, fontWeight: 800,
                                background: GRADIENTS.heading,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10,
                            }}
                        >
                            Documents Checklist
                        </p>
                        <h2
                            style={{
                                fontSize: 32, fontWeight: 800,
                                background: GRADIENTS.heading,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                margin: "0 0 14px", textShadow: GRADIENTS.headingGlow,
                            }}
                        >
                            What You'll Need — Full Package
                        </h2>
                        <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                            Keep these ready across all four forms. Our team will guide you on which documents apply to your specific filing.
                        </p>
                    </div>

                    <div
                        style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 22 }}
                        className="doc-grid"
                    >
                        {DOCUMENT_GROUPS.map((group) => (
                            <div
                                key={group.id}
                                style={{
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 18, padding: 26, transition: "all 0.25s",
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
                                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, position: "relative", zIndex: 1 }}>
                                    <div
                                        style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            background: "rgba(239,68,68,0.12)", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            border: "1px solid rgba(239,68,68,0.3)", flexShrink: 0,
                                        }}
                                    >
                                        <group.icon size={18} color="#f97316" />
                                    </div>
                                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>
                                        {group.label}
                                    </h4>
                                </div>
                                <div className="doc-items-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                                    {group.keys.map((docKey) => {
                                        const Icon = getIconForDoc(docKey);
                                        return (
                                            <div
                                                key={docKey}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 10,
                                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                                    borderRadius: 10, padding: "10px 12px", transition: "all 0.2s",
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
                                                <Icon size={14} color="#f97316" />
                                                <span style={{ fontSize: 12, color: "#d1d5db", fontWeight: 500 }}>
                                                    {ALL_DOCUMENTS[docKey]}
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
                <div
                    style={{
                        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 20, overflow: "hidden", marginBottom: 72, padding: "4px",
                        position: "relative",
                    }}
                >
                    <div
                        style={{
                            position: "absolute", inset: 0, borderRadius: 20, padding: "1px",
                            background: GRADIENTS.heading,
                            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite: "xor", maskComposite: "exclude",
                            pointerEvents: "none", opacity: 0.3,
                        }}
                    />
                    {stats.map(({ value, label }, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "26px 16px", textAlign: "center",
                                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
                                position: "relative", zIndex: 1,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: value.length > 7 ? 20 : 28, fontWeight: 800,
                                    background: GRADIENTS.heading,
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    marginBottom: 6, textShadow: "0 0 25px rgba(249,115,22,0.2)",
                                }}
                            >
                                {value}
                            </div>
                            <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* ── COMPLIANCE COMPARISON TABLE ── */}
                <div style={{ marginBottom: 72 }}>
                    <div style={{ textAlign: "center", marginBottom: 36 }}>
                        <p
                            style={{
                                fontSize: 11, fontWeight: 800,
                                background: GRADIENTS.heading,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10,
                            }}
                        >
                            Quick Comparison
                        </p>
                        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>
                            All 4 Forms at a Glance
                        </h2>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* Table header */}
                        <div
                            className="compliance-table-header"
                            style={{
                                display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr 1fr",
                                gap: 12, padding: "10px 18px",
                            }}
                        >
                            {["Form", "Filed By", "Deadline", "Penalty for Default", "Service Fee"].map((h) => (
                                <span
                                    key={h}
                                    style={{
                                        fontSize: 10, fontWeight: 800, color: "#6b7280",
                                        textTransform: "uppercase", letterSpacing: "0.1em",
                                    }}
                                >
                                    {h}
                                </span>
                            ))}
                        </div>

                        {complianceComparison.map((row, i) => (
                            <div
                                key={i}
                                className="compliance-table-row"
                                style={{
                                    display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr 1fr",
                                    gap: 12, padding: "16px 18px",
                                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                                    borderRadius: 12, transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `${row.color}30`;
                                    e.currentTarget.style.background = `${row.color}06`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div
                                        style={{
                                            width: 8, height: 8, borderRadius: "50%",
                                            background: row.color, flexShrink: 0,
                                            boxShadow: `0 0 8px ${row.color}60`,
                                        }}
                                    />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{row.form}</span>
                                </div>
                                <span style={{ fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center" }}>
                                    {row.who}
                                </span>
                                <span
                                    style={{
                                        fontSize: 12, color: "#60a5fa", fontWeight: 600,
                                        display: "flex", alignItems: "center",
                                    }}
                                >
                                    {row.deadline}
                                </span>
                                <span
                                    style={{
                                        fontSize: 12, color: "#60a5fa", fontWeight: 600,
                                        display: "flex", alignItems: "center",
                                    }}
                                >
                                    {row.penalty}
                                </span>
                                <span
                                    style={{
                                        fontSize: 12,
                                        ...(row.serviceFee === "FREE" ? FREE_TEXT_STYLE : { color: "#60a5fa", fontWeight: 700 }),
                                        display: "flex", alignItems: "center",
                                    }}
                                >
                                    {row.serviceFee}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── BOTTOM CTA ── (identical structure to company landing) */}
                <div
                    style={{
                        position: "relative", borderRadius: 28, overflow: "hidden",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                        padding: "40px 20px", textAlign: "center",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                    }}
                >
                    <div
                        style={{
                            position: "absolute", top: -80, right: -80, width: 240, height: 240,
                            background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)",
                            filter: "blur(70px)", pointerEvents: "none",
                            animation: "pulse 6s ease-in-out infinite",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute", bottom: -80, left: -80, width: 240, height: 240,
                            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
                            filter: "blur(70px)", pointerEvents: "none",
                            animation: "pulse 8s ease-in-out infinite reverse",
                        }}
                    />
                    <div style={{ position: "relative", zIndex: 1 }}>
                        <h2
                            style={{
                                fontSize: 36, fontWeight: 800, color: "#fff",
                                marginBottom: 16, letterSpacing: "-0.025em", lineHeight: 1.2,
                            }}
                        >
                            Don't let compliance deadlines catch you off guard.
                        </h2>
                        <p
                            style={{
                                color: "#9ca3af", fontSize: 16, marginBottom: 42,
                                maxWidth: 520, margin: "0 auto 42px", lineHeight: 1.7,
                            }}
                        >
                            File MSME, GST, ADT-1, INC-20A, DIR-3 KYC, AOC-4, and MGT-7A together. One flow, guided documentation,
                            CA-verified MCA filing — no penalties, no missed deadlines.
                        </p>
                        <ActionBtn
                            label={`Start Full Compliance Package — ₹${calculateTotalWithGST(PRICING_CONFIG["roc-package"].fee).toLocaleString()}`}
                            variant="primary"
                            style={{
                                borderRadius: 14, padding: "14px 20px", fontSize: 14,
                                maxWidth: "100%", width: "100%",
                                boxShadow: "0 10px 40px rgba(239,68,68,0.35)",
                            }}
                            onClick={handleStartFiling}
                            isProcessing={isProcessing}
                        />
                        <p style={{ fontSize: 12, color: "#4b5563", marginTop: 20, fontWeight: 500 }}>
                            <span style={{ color: "#60a5fa" }}>✓</span> CA-verified filing &nbsp;•&nbsp;
                            <span style={{ color: "#60a5fa" }}>✓</span> Same-day turnaround &nbsp;•&nbsp;
                            <span style={{ color: "#60a5fa" }}>✓</span> SRN + certificate delivered
                        </p>
                    </div>
                </div>

                {/* ── FOOTER ── */}
                <footer
                    style={{
                        marginTop: 72, paddingTop: 36, paddingBottom: 36,
                        textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
                </footer>
            </main>

            {/* Global styles — identical to company landing */}
            <style>{`
  @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  html { scroll-behavior: smooth; }
  ::selection { background: rgba(249,115,22,0.25); color: #fff; }

  @media (max-width: 640px) {
    .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .doc-grid { grid-template-columns: 1fr !important; }
    .doc-items-grid { grid-template-columns: 1fr !important; }
    .process-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
    .header-cta { display: none !important; }
    .mobile-cta-bar { display: block !important; }
    .mobile-cta-bar button { width: 100% !important; font-size: 13px !important; padding: 12px 12px !important; }
    .compliance-table-header { display: none !important; }
    .compliance-table-row {
      grid-template-columns: 1fr !important;
      gap: 6px !important;
      padding: 14px !important;
    }
    .compliance-table-row span { font-size: 12px !important; }
  }

  @media (min-width: 641px) and (max-width: 1024px) {
    .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .doc-grid { grid-template-columns: 1fr !important; }
    .doc-items-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .process-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .compliance-table-row { grid-template-columns: 1.5fr 1fr 1.5fr !important; }
    .compliance-table-header { grid-template-columns: 1.5fr 1fr 1.5fr !important; }
    .compliance-table-row span:nth-child(4),
    .compliance-table-row span:nth-child(5),
    .compliance-table-header span:nth-child(4),
    .compliance-table-header span:nth-child(5) { display: none !important; }
  }
`}</style>
        </div>
    );
}
