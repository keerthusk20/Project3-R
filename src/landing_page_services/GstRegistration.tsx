import React, { useEffect } from "react";
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
  ChevronLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- Types & Configuration ---

type DocKey =
  | 'proofOfConstitution' | 'companyPan' | 'companyCoi' | 'companyMoa' | 'companyAoa'
  | 'llpPan' | 'llpAgreement' | 'promoterPhoto' | 'cancelledCheque' | 'bankStatement'
  | 'addressProof' | 'noc' | 'signature' | 'promoterPan' | 'promoterAadhaarDoc'
  | 'rentAgreement' | 'elecBill' | 'taxReceipt' | 'utilityBill' | 'signPan'
  | 'signAadhaar' | 'signPhoto' | 'bankProof';

interface DocumentGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  keys: DocKey[];
}

const GST_DOCUMENTS: Record<DocKey, string> = {
  // Entity
  proofOfConstitution: "Proof of Constitution",
  companyPan: "Company PAN Card",
  companyCoi: "Certificate of Incorporation (COI)",
  companyMoa: "Memorandum of Association (MOA)",
  companyAoa: "Articles of Association (AOA)",
  llpPan: "LLP PAN Card",
  llpAgreement: "LLP Agreement",

  // Promoter
  promoterPhoto: "Promoter Photograph",
  promoterPan: "Promoter PAN Card",
  promoterAadhaarDoc: "Promoter Aadhaar Card",
  signature: "Digital Signature Certificate",
  signPan: "Signed PAN Declaration",
  signAadhaar: "Signed Aadhaar Declaration",
  signPhoto: "Signed Photograph",

  // Bank
  cancelledCheque: "Cancelled Cheque",
  bankStatement: "Bank Statement (Last 3 Months)",
  bankProof: "Bank Account Proof",

  // Address
  addressProof: "Principal Place of Business Proof",
  noc: "No Objection Certificate (NOC)",
  rentAgreement: "Rent/Lease Agreement",
  elecBill: "Electricity Bill",
  taxReceipt: "Property Tax Receipt",
  utilityBill: "Utility Bill (Water/Gas/Telephone)",
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    id: "entity",
    label: "Entity Documents",
    icon: Building2,
    keys: ['proofOfConstitution', 'companyPan', 'companyCoi', 'companyMoa', 'companyAoa', 'llpPan', 'llpAgreement'],
  },
  {
    id: "promoter",
    label: "Promoter & Signatory",
    icon: User,
    keys: ['promoterPhoto', 'promoterPan', 'promoterAadhaarDoc', 'signature', 'signPan', 'signAadhaar', 'signPhoto'],
  },
  {
    id: "bank",
    label: "Bank Details",
    icon: Landmark,
    keys: ['cancelledCheque', 'bankStatement', 'bankProof'],
  },
  {
    id: "address",
    label: "Address Proof",
    icon: FileText,
    keys: ['addressProof', 'noc', 'rentAgreement', 'elecBill', 'taxReceipt', 'utilityBill'],
  },
];

const getIconForDoc = (key: DocKey) => {
  if (['companyPan', 'llpPan', 'promoterPan', 'companyCoi', 'companyMoa', 'companyAoa', 'llpAgreement', 'proofOfConstitution'].includes(key)) return FileText;
  if (['cancelledCheque', 'bankStatement', 'bankProof'].includes(key)) return Landmark;
  if (['promoterPhoto', 'signPhoto'].includes(key)) return User;
  if (['signature', 'signPan', 'signAadhaar'].includes(key)) return PenTool;
  if (['addressProof', 'rentAgreement', 'noc', 'elecBill', 'taxReceipt', 'utilityBill'].includes(key)) return Building2;
  return FileText;
};

export default function GstRegistrationLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    "100% Legal Compliance & Penalty Protection",
    "Instant Current Account Opening Eligibility",
    "Claim Input Tax Credit (ITC) on Purchases",
    "Essential for B2B Sales & E-commerce Listing",
  ];

  const steps = [
    {
      step: 1,
      title: "Share Details",
      desc: "Upload basic KYC and business docs",
      icon: FileText
    },
    {
      step: 2,
      title: "Expert Verification",
      desc: "Our CA experts validate & file your application",
      icon: ShieldCheck
    },
    {
      step: 3,
      title: "Get GSTIN",
      desc: "Receive your certificate in 3-5 working days",
      icon: CheckCircle2
    },
  ];

  // Disabled button styles
  const disabledBtnClass = "opacity-50 cursor-not-allowed";
  const disabledPrimaryClass = `bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg shadow-emerald-900/20 ${disabledBtnClass}`;
  const disabledSecondaryClass = `flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-white/10 text-slate-500 ${disabledBtnClass}`;
  const disabledCtaClass = `inline-flex items-center gap-2 bg-white text-[#000000] px-8 py-4 rounded-xl font-bold text-lg shadow-xl ${disabledBtnClass}`;

  return (
    <div className="min-h-screen bg-background text-slate-300 font-sans selection:bg-emerald-500/30">

      {/* --- Navbar --- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/services")}
              className="p-2 -ml-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-bold text-white tracking-tight">RegiBIZ</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xl font-bold text-emerald-400">FREE</span>
              <span className="text-xs text-slate-500 line-through">₹999</span>
            </div>
            {/* DISABLED: Start Now Button */}
            <button
              disabled
              className={disabledPrimaryClass}
              title="Service temporarily unavailable"
            >
              Start Now
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 lg:py-12">

        {/* --- Hero Section --- */}
        <div className="grid lg:grid-cols-12 gap-12 mb-16">

          {/* Left: Value Prop */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
                Get GST Registered <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  in 3 Simple Steps
                </span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                We handle the complex paperwork and compliance while you focus on growing your business. Get your GSTIN in as little as 3 days.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Why Choose RegiBIZ?
              </h3>
              <ul className="space-y-3">
                {benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-3 group">
                    <div className="mt-1 min-w-[20px]">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500/70 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <span className="text-slate-300 group-hover:text-white transition-colors">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 flex items-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>3-5 Days Turnaround</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Secure Payment</span>
              </div>
            </div>
          </div>

          {/* Right: Steps Visual */}
          <div className="lg:col-span-7">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-8 text-center">How it works</h3>

              <div className="relative">
                {/* Connector Line (Desktop) */}
                <div className="hidden md:block absolute top-6 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/20 via-emerald-500/50 to-emerald-500/20" />

                <div className="grid md:grid-cols-3 gap-8 relative">
                  {steps.map((item, i) => (
                    <div key={i} className="relative flex flex-col items-center text-center group">
                      {/* Step Icon */}
                      <div className="w-12 h-12 rounded-full bg-background border-2 border-emerald-500/30 group-hover:border-emerald-400 group-hover:shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center justify-center mb-4 transition-all duration-300 z-10">
                        <item.icon className="w-6 h-6 text-emerald-400" />
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-lg font-bold text-white">{item.title}</h4>
                        <p className="text-sm text-slate-400 px-2">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row gap-4">
                {/* DISABLED: Request a Call Back Button */}
                <button
                  disabled
                  className={disabledSecondaryClass}
                  title="Service temporarily unavailable"
                >
                  <Phone className="w-4 h-4" />
                  Request a Call Back
                </button>
                {/* DISABLED: Avail Service Now Button */}
                <button
                  disabled
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-900/20 ${disabledBtnClass}`}
                  title="Service temporarily unavailable"
                >
                  Avail Service Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Documents Section --- */}
        <div className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold text-white mb-3">Documents Required</h2>
            <p className="text-slate-400">
              Keep these documents ready in digital format (PDF/JPG) for a smooth application process.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {DOCUMENT_GROUPS.map((group) => (
              <div
                key={group.id}
                className="bg-white/[0.02] border border-white/5 rounded-xl p-6 hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <group.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{group.label}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.keys.map((docKey) => {
                    const Icon = getIconForDoc(docKey);
                    return (
                      <div
                        key={docKey}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-white/5"
                      >
                        <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm text-slate-300 leading-snug">
                          {GST_DOCUMENTS[docKey]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Final CTA --- */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-900/40 to-[#000000] border border-emerald-500/20 p-8 lg:p-12 text-center">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-cyan-500/10 blur-3xl rounded-full" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
              Ready to make your business compliant?
            </h2>
            <p className="text-slate-400 mb-8 text-lg">
              Join thousands of businesses who trusted RegiBIZ for their GST registration.
            </p>
            {/* DISABLED: Start Your Registration Button */}
            <button
              disabled
              className={disabledCtaClass}
              title="Service temporarily unavailable"
            >
              Start Your Registration
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="mt-4 text-xs text-slate-500">
              Secure checkout • No hidden charges • 100% Refund if rejected
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-background py-8 text-center">
        <p className="text-slate-600 text-sm">
          &copy; 2026 RegiBIZ. All rights reserved.
        </p>
      </footer>
    </div>
  );
}