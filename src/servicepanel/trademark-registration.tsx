// servicepanel/trademark-registration.tsx
import React from "react";
import {
  CheckCircle,
  ShieldCheck,
  Tag,
  FileText,
  Search,
  Phone,
  ArrowLeft,
  User,
  CreditCard,
  MapPin,
  Building
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useLocation, useNavigate } from "react-router-dom";
import { PRICING_CONFIG, calculateTotalWithGST } from "../data/pricingConfig";

export default function TrademarkRegistrationLanding() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleStartApplication = () => {
    if (!location.state?.requirementsConfirmed) {
      navigate("/services/trademark-registration/requirements");
      return;
    }
    navigate("/services/trademark-registration/form");
  };

  const handleRequestCallback = () => {
    window.open("https://wa.me/6364562818", "_blank");
  };

  const handleGoBack = () => {
    navigate("/services");
  };

  const benefits = [
    "Protect your brand name & logo legally across India",
    "Exclusive rights to use ® symbol after approval",
    "Prevent competitors from copying your identity",
    "Valid for 10 years & renewable lifetime"
  ];

  const documents = {
    entity: [
      "PAN Card of Applicant (Individual/Company)",
      "Certificate of Incorporation (if Company/LLP)",
      "Partnership Deed (if applicable)",
      "GST Registration (if applicable)",
    ],
    promoter: [
      "Aadhaar Card of Proprietor/Partners/Directors",
      "Passport-sized Photograph",
      "Contact Details (Mobile & Email)",
      "Identity Proof (Voter ID/Passport)",
    ],
    bank: [
      "Cancelled Cheque",
      "Bank Account Proof",
      "IFSC Code",
    ],
    trademark: [
      "Brand Name & Logo (if applicable)",
      "Description of Goods/Services",
      "Class Selection (Nice Classification)",
      "User Affidavit (if prior use claimed)",
      "Power of Attorney (Form TM-48)",
    ],
  };

  const steps = [
    {
      icon: Search,
      title: "Trademark Search",
      desc: "We check availability & conflict in IP India database"
    },
    {
      icon: FileText,
      title: "Expert Filing",
      desc: "Our experts prepare & file your TM application"
    },
    {
      icon: ShieldCheck,
      title: "Get Acknowledgment",
      desc: "Receive TM application number instantly"
    },
  ];

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto text-white hover:bg-transparent hover:text-emerald-400"
              onClick={handleGoBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">RegiBIZ</h1>
              <p className="text-xs text-emerald-400">Trademark Registration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-400">₹{calculateTotalWithGST(PRICING_CONFIG["trademark"].fee).toLocaleString()}</span>
              <p className="text-[10px] text-gray-500 line-through">₹7,999</p>
              <p className="text-[10px] text-emerald-500/80 font-medium">Service Fee (Incl. 18% GST)</p>
            </div>
            <Button
              onClick={handleStartApplication}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              Start Now
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Left Content */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Protect Your Brand
              </h1>
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-teal-400 to-cyan-400 mb-4">
                in 3 Simple Steps
              </h2>
              <p className="text-gray-400 leading-relaxed max-w-lg">
                We handle the complex trademark filing process while you focus on building your brand.
                Get your TM acknowledgment number instantly and full registration support.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-orange-400" />
                Why Choose RegiBIZ?
              </h3>
              <ul className="space-y-3">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border border-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-orange-400" />
                    </div>
                    <span className="text-sm text-gray-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                Instant Acknowledgment
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                Secure Payment
              </div>
            </div>
          </div>

          {/* Right - How it Works */}
          <Card className="glass-card border border-white/10 bg-white/5">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-white text-center mb-8">How it works</h3>

              <div className="relative">
                <div className="absolute top-6 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500/30 via-teal-500/30 to-cyan-500/30 hidden md:block" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {steps.map((item, i) => (
                    <div key={i} className="relative text-center">
                      <div className="w-12 h-12 rounded-full bg-secondary border-2 border-orange-500/50 flex items-center justify-center mx-auto mb-3 relative z-10">
                        <item.icon className="w-5 h-5 text-orange-400" />
                      </div>
                      <h4 className="font-semibold text-white text-sm mb-1">{item.title}</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3.5">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-cyan-300">Deliverables</p>
                <div className="flex flex-col gap-1.5">
                  <p className="m-0 text-[13px] leading-relaxed text-gray-300">• Government registration number / filing acknowledgement</p>
                  <p className="m-0 text-[13px] leading-relaxed text-gray-300">• Portal login credentials (if applicable)</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
                  onClick={handleRequestCallback}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Request a Call Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-orange-500 via-teal-600 to-cyan-600 hover:from-orange-600 hover:via-teal-700 hover:to-cyan-700 text-white"
                  onClick={handleStartApplication}
                >
                  Avail Service Now
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Required Section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">Documents Required</h3>
            <p className="text-gray-400 text-sm max-w-2xl mx-auto">
              Keep these documents ready in digital format (PDF/JPG) for a smooth application process.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Entity Documents */}
            <Card className="glass-card border border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Building className="w-5 h-5 text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-white">Entity Documents</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {documents.entity.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/5">
                      <Building className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-300">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Promoter & Signatory */}
            <Card className="glass-card border border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-white">Promoter & Signatory</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {documents.promoter.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/5">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-300">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card className="glass-card border border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-white">Bank Details</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {documents.bank.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/5">
                      <CreditCard className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-300">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trademark Details */}
            <Card className="glass-card border border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-white">Trademark Details</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {documents.trademark.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/5">
                      <Tag className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-300">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom CTA */}
        <Card className="bg-gradient-to-r from-teal-900/50 via-cyan-900/50 to-blue-900/50 border border-teal-500/20">
          <CardContent className="p-12 text-center">
            <h3 className="text-3xl font-bold text-white mb-3">
              Ready to protect your brand identity?
            </h3>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses who trusted RegiBIZ for their trademark registration.
            </p>
            <Button
              size="lg"
              className="bg-white hover:bg-gray-100 font-semibold px-8 rounded-lg text-black"
              onClick={handleStartApplication}
            >
              <span className="text-black font-bold">Start Your Registration</span>
              <svg className="w-5 h-5 ml-2 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
            <p className="text-xs text-gray-500 mt-4">
              Secure checkout • No hidden charges • Expert support included
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-600 text-sm pb-8">
          <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>© 2026 RegiBIZ-Powered by CloudMaSa. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
