import React, { useState, useEffect, useRef } from 'react';
import { useLiveSocialProof } from '../hooks/useLiveSocialProof';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  ArrowRight,
  Play,
  Zap,
  LayoutDashboard,
  FileText,
  Users,
  UserCheck,
  Shield,
  Lock,
  CheckCircle,
  Briefcase,
  Award,
  ChevronRight,
  ChevronDown,
  Building2,
  FileSignature,
  PenTool,
  Star,
  Clock,
  CreditCard,
  Phone,
  IndianRupee,
  AlertCircle,
  Mail,
  MapPin,
  PhoneCall,
  Youtube,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Github,
  Target,
  Globe,
  Rocket
} from 'lucide-react';

// --- Helper Component for Social Icons ---
const SocialIcon = ({ icon: Icon, link }: { icon: any, link: string }) => (
  <a href={link} target="_blank" rel="noopener noreferrer" className="landing-social-icon w-12 h-12 rounded-full bg-cyan-400/10 border border-cyan-200/35 flex items-center justify-center shadow-[0_12px_32px_rgba(8,145,178,0.18)] hover:-translate-y-1 hover:bg-orange-500 hover:border-orange-300 transition-all duration-300 group cursor-pointer">
    <Icon size={19} className="text-cyan-100 group-hover:text-white transition-colors" />
  </a>
);

const BrandLogo = () => (
  <>
    <div className="relative">
      <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full group-hover:bg-cyan-500/30 transition-all"></div>
      <img
        src="/roundmasa.webp"
        alt="RegiBIZ Logo"
        className="w-10 h-20 rounded-lg object-contain relative z-10 group-hover:scale-105 transition-transform"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>

    <div className="flex flex-col overflow-hidden">
      <div className="flex items-baseline">
        <span className="text-xl font-extrabold text-orange-500 tracking-tight drop-shadow-sm leading-none">
          Regi
        </span>
        <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 tracking-tight drop-shadow-sm leading-none">
          BIZ
        </span>
      </div>
      <div className="flex items-center gap-0.5 ml-7">
        <span className="brand-logo-by text-[9px] font-bold tracking-wider text-gray-200">by</span>
        <span className="text-[14px] font-extrabold tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Cloud</span>
          <span className="text-orange-500 ml-0.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">MaSa</span>
        </span>
      </div>
    </div>
  </>
);

const NetworkBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.fill();

        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.3 * (1 - distance / 150)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    draw();

    window.addEventListener('resize', () => {
      resize();
      createParticles();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
};

// --- Refund Policy Modal Component ---
const RefundPolicyModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-secondary backdrop-blur-sm animate-fade-in">
      <div className="bg-secondary w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-900/50 shadow-2xl relative custom-scrollbar">
        <div className="sticky top-0 z-10 bg-secondary/95 backdrop-blur-md border-b border-white/10 p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Refund & Cancellation Policy</h2>
            <p className="text-gray-400 text-sm mt-1">RegiBIZ (Powered by CloudMasa)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-8 space-y-8 text-gray-300 leading-relaxed text-sm md:text-base">
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">1</span> General Cancellation
            </h3>
            <div className="space-y-4 pl-2">
              <p>At RegiBIZ, powered by CloudMasa, we are committed to delivering high-quality business registration and compliance services. Your satisfaction is important to us.</p>
              <p>If you are not satisfied with our service at any stage, you may contact our support team. We will review your concern and, where applicable, take corrective action, offer service credits, or process a refund based on eligibility.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">2</span> Refund Eligibility
            </h3>
            <div className="space-y-4 pl-2">
              <p>All payments made to RegiBIZ are initially held against your service request and are considered advance fees. These fees are gradually earned as we progress through different stages of your service.</p>
              <p>Refund can be requested for earned fees under the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>If your application is rejected due to an error or negligence from our team</li>
                <li>If the service is not delivered within the promised timeline (SLA), excluding delays caused by government authorities or external dependencies</li>
                <li>If you have made a duplicate or excess payment by mistake</li>
              </ul>
              <p className="font-semibold text-white mt-4">Important Notes:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>Government fees, statutory charges, and third-party payments (such as filing fees, licenses, etc.) are strictly non-refundable</li>
                <li>Once a service milestone is completed, the corresponding portion of the fee is considered earned and non-refundable</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">3</span> Refund Process
            </h3>
            <div className="space-y-4 pl-2">
              <p>To request a refund, please email us at <strong>support@cloudmasa.com</strong> with the following details:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>Your Case ID / Order ID</li>
                <li>Registered email address</li>
                <li>Reason for the refund request</li>
              </ul>
              <p className="font-semibold text-white mt-4">Timeline:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>Refund requests must be submitted within 30 days from the date of purchase</li>
                <li>Approved refunds will be processed within 5–7 business days</li>
                <li>The refund will be credited to the original payment method</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">4</span> Cancellation Policy
            </h3>
            <div className="space-y-4 pl-2">
              <p>You may request cancellation of your service at any time before the work has started.</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>If the service has not yet been initiated, you may be eligible for a full or partial refund</li>
                <li>If the service is already in progress, the refund will be processed based on the work completed (milestone-based deduction)</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">5</span> Contact & Support
            </h3>
            <div className="space-y-4 pl-2">
              <p>For any refund or cancellation queries, feel free to reach out:</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2"><span className="text-cyan-400"><Mail size={16} /></span> <a href="mailto:support@cloudmasa.com" className="text-cyan-400 hover:underline">support@cloudmasa.com</a></li>
                <li className="flex items-center gap-2"><span className="text-cyan-400"><Clock size={16} /></span> Support Hours: Monday – Saturday, 10:00 AM – 6:00 PM</li>
              </ul>
            </div>
          </section>
        </div>
        <div className="sticky bottom-0 bg-secondary border-t border-white/10 p-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gradient-primary text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/20 transition-all">Close Policy</button>
        </div>
      </div>
    </div>
  );
};

// --- Privacy Policy Modal Component (UPDATED CONTENT) ---
const PrivacyPolicyModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-secondary backdrop-blur-sm animate-fade-in">
      <div className="bg-secondary w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-900/50 shadow-2xl relative custom-scrollbar">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-secondary/95 backdrop-blur-md border-b border-white/10 p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">
              Privacy Policy
            </h2>
            <p className="text-gray-400 text-sm mt-1">Last Updated: April 2026</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 text-gray-300 leading-relaxed text-sm md:text-base">

          {/* Section 1 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">1</span>
              General
            </h3>
            <div className="space-y-4 pl-2">
              <p><strong>a)</strong> This Privacy Policy is an electronic record in accordance with the Information Technology Act, 2000 and applicable rules. It does not require any physical or digital signature.</p>
              <p><strong>b)</strong> This Policy is published in compliance with applicable laws and governs the use of RegiBIZ (powered by CloudMasa) platform and services.</p>
              <p><strong>c)</strong> The platform www.regibiz.cloudmasa.com is owned and operated by RegiBIZ (powered by CloudMasa), hereinafter referred to as "Company", "We", "Us", or "Our".</p>
              <p><strong>d)</strong> For the purpose of this Policy:</p>
              <ul className="list-disc pl-6 space-y-1 marker:text-cyan-500">
                <li>"User" or "You" refers to any individual or entity using our platform</li>
                <li>"Company", "We", "Us", "Our" refers to RegiBIZ</li>
              </ul>
              <p><strong>e)</strong> By accessing or using our platform, you agree to be bound by this Privacy Policy and our Terms of Service.</p>
              <p><strong>f)</strong> We reserve the right to update or modify this Policy at any time. Continued use of the platform constitutes acceptance of such changes.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">2</span>
              Collection of Information
            </h3>
            <div className="space-y-4 pl-2">
              <p><strong>a)</strong> We collect personal information provided by you, including but not limited to:</p>
              <ul className="list-disc pl-6 space-y-1 marker:text-cyan-500">
                <li>Name, email address, phone number</li>
                <li>Business details and registration information</li>
                <li>Identity documents (if required for compliance services)</li>
              </ul>
              <p><strong>b)</strong> We may automatically collect technical data such as:</p>
              <ul className="list-disc pl-6 space-y-1 marker:text-cyan-500">
                <li>IP address</li>
                <li>Device information</li>
                <li>Browser type</li>
                <li>Usage behavior</li>
              </ul>
              <p><strong>c)</strong> If you purchase services, we may collect transaction-related details.</p>
              <p><strong>d)</strong> By using our services, you consent to receive communications via email, SMS, or phone, even if registered under DND, as permitted by applicable laws.</p>
              <p><strong>e)</strong> Any data shared via forms, chats, or feedback may be stored to improve service quality and customer experience.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">3</span>
              Cookies
            </h3>
            <div className="space-y-4 pl-2">
              <p><strong>a)</strong> We use cookies to enhance user experience, remember preferences, and improve platform performance.</p>
              <p><strong>b)</strong> Cookies help us:</p>
              <ul className="list-disc pl-6 space-y-1 marker:text-cyan-500">
                <li>Understand user behavior</li>
                <li>Improve services</li>
                <li>Provide personalized experience</li>
              </ul>
              <p><strong>c)</strong> You can disable cookies via browser settings, but some features may not function properly.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">4</span>
              Use & Sharing of Information
            </h3>
            <div className="space-y-4 pl-2">
              <p><strong>a)</strong> We use your information to:</p>
              <ul className="list-disc pl-6 space-y-1 marker:text-cyan-500">
                <li>Provide and manage services</li>
                <li>Process transactions</li>
                <li>Improve platform functionality</li>
                <li>Communicate updates and offers</li>
              </ul>
              <p><strong>b)</strong> We may share your data with:</p>
              <ul className="list-disc pl-6 space-y-1 marker:text-cyan-500">
                <li>Government authorities (for registrations/compliance)</li>
                <li>Trusted third-party service providers</li>
                <li>Payment gateways</li>
              </ul>
              <p><strong>c)</strong> We may disclose information if required by law or to protect legal rights.</p>
              <p><strong>d)</strong> In case of merger, acquisition, or restructuring, your data may be transferred to the new entity.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">5</span>
              Data Security
            </h3>
            <p className="pl-2">
              We implement appropriate security measures to protect your data from unauthorized access, misuse, or disclosure.
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500 mt-2">
              <li>Sensitive data is encrypted</li>
              <li>Payments are processed via secure third-party gateways</li>
              <li>We do not store your card or banking details</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">6</span>
              Third-Party Services
            </h3>
            <p className="pl-2">
              Our platform may include links or integrations with third-party services.
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500 mt-2">
              <li>We are not responsible for their privacy practices</li>
              <li>Users should review third-party policies before sharing data</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">7</span>
              User Consent
            </h3>
            <p className="pl-2">
              By using our platform, you consent to:
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500 mt-2">
              <li>Collection and use of your information</li>
              <li>Sharing of data as described in this Policy</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">8</span>
              Grievance Officer
            </h3>
            <div className="pl-2 space-y-3">
              <p>In accordance with the Information Technology Act, 2000 and applicable rules, the contact details of the Grievance Officer are provided below:</p>
              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                <a href="mailto:regibiz@cloudmasa.com" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
                  <Mail size={16} /> regibiz@cloudmasa.com
                </a>
                <a href="mailto:support@cloudmasa.com" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
                  <Mail size={16} /> support@cloudmasa.com
                </a>
              </div>
              <p className="text-sm text-gray-400 mt-2">All grievances will be acknowledged within 48 hours and resolved within 7 working days from the date of receipt.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">9</span>
              Use of Google User Data
            </h3>
            <p className="pl-2">
              If you connect your Google account:
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500 mt-2">
              <li>We access Google Calendar only to manage compliance reminders</li>
              <li>We do not use this data for AI/ML training</li>
              <li>Usage strictly complies with Google API policies</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">10</span>
              Data Retention & Deletion
            </h3>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
              <li>Data is retained only as long as necessary for service delivery</li>
              <li>Google data is not stored permanently</li>
              <li>You can revoke access anytime via Google settings</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">11</span>
              Dispute Resolution & Jurisdiction
            </h3>
            <div className="space-y-4 pl-2">
              <p><strong>a)</strong> Any disputes will first be resolved through mutual discussion.</p>
              <p><strong>b)</strong> If unresolved, disputes will be referred to arbitration.</p>
              <p><strong>c)</strong> This Policy is governed by the laws of India.</p>
              <p><strong>d)</strong> Jurisdiction: Chennai, Tamil Nadu</p>
            </div>
          </section>

        </div>

        {/* Footer of Modal */}
        <div className="sticky bottom-0 bg-secondary border-t border-white/10 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gradient-primary text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
          >
            Close Policy
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Terms of Service Modal Component (UPDATED CONTENT) ---
const TermsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-secondary backdrop-blur-sm animate-fade-in">
      <div className="bg-secondary w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-900/50 shadow-2xl relative custom-scrollbar">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-secondary/95 backdrop-blur-md border-b border-white/10 p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">
              Terms of Service
            </h2>
            <p className="text-gray-400 text-sm mt-1">RegiBIZ (Powered by CloudMasa)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 text-gray-300 leading-relaxed text-sm md:text-base">
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">1</span>
              Acceptance of Terms
            </h3>
            <div className="space-y-4 pl-2">
              <p>By accessing or using RegiBIZ (Powered by CloudMasa), you agree to comply with and be bound by these Terms of Service.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">2</span>
              Services Offered
            </h3>
            <div className="space-y-4 pl-2">
              <p>RegiBIZ provides business registration, compliance assistance, and related services. We act as a facilitator and do not guarantee approval from government authorities.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">3</span>
              User Responsibilities
            </h3>
            <div className="space-y-4 pl-2">
              <p>You agree to:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>Provide accurate and complete information</li>
                <li>Ensure documents submitted are valid and up-to-date</li>
                <li>Not misuse the platform for illegal or fraudulent activities</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">4</span>
              Payments & Fees
            </h3>
            <div className="space-y-4 pl-2">
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>All service fees must be paid in advance</li>
                <li>Government fees and third-party charges are separate</li>
                <li>Fees once earned based on service progress are non-refundable (refer Refund Policy)</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">5</span>
              Service Timelines
            </h3>
            <div className="space-y-4 pl-2">
              <p>We aim to deliver services within estimated timelines. However, delays caused by government authorities or external dependencies are beyond our control.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">6</span>
              Limitation of Liability
            </h3>
            <div className="space-y-4 pl-2">
              <p>RegiBIZ is not liable for:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>Rejection of applications by authorities</li>
                <li>Delays caused by third parties or incomplete user information</li>
                <li>Any indirect or consequential losses</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">7</span>
              Intellectual Property
            </h3>
            <div className="space-y-4 pl-2">
              <p>All content, branding, and materials on the platform belong to RegiBIZ / CloudMasa and cannot be copied or reused without permission.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">8</span>
              Termination
            </h3>
            <div className="space-y-4 pl-2">
              <p>We reserve the right to suspend or terminate access if:</p>
              <ul className="list-disc pl-6 space-y-2 marker:text-cyan-500">
                <li>Terms are violated</li>
                <li>Fraudulent activity is detected</li>
              </ul>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">9</span>
              Modifications
            </h3>
            <div className="space-y-4 pl-2">
              <p>We may update these Terms at any time. Continued use of the platform indicates acceptance of updated Terms.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">10</span>
              Governing Law
            </h3>
            <div className="space-y-4 pl-2">
              <p>These Terms are governed by the laws of India, and jurisdiction shall be Chennai, Tamil Nadu.</p>
            </div>
          </section>
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center text-cyan-400 text-sm border border-cyan-500/20">11</span>
              Contact
            </h3>
            <div className="space-y-4 pl-2">
              <p>For any queries:</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2"><span className="text-cyan-400"><Mail size={16} /></span> <a href="mailto:regibiz@cloudmasa.com" className="text-cyan-400 hover:underline">regibiz@cloudmasa.com</a></li>
                <li className="flex items-center gap-2"><span className="text-cyan-400"><Mail size={16} /></span> <a href="mailto:support@cloudmasa.com" className="text-cyan-400 hover:underline">support@cloudmasa.com</a></li>
              </ul>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-secondary border-t border-white/10 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gradient-primary text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
          >
            Close Terms
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Navbar Component ---
const Navbar = ({
  onOpenPrivacy,
  onOpenRefund,
  onOpenTerms,
}: {
  onOpenPrivacy: () => void;
  onOpenRefund: () => void;
  onOpenTerms: () => void;
}) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 w-full z-[100] transition-all duration-500 ${scrolled
        ? 'bg-[#030712]/98 backdrop-blur-xl border-b border-cyan-500/20 py-4 shadow-2xl shadow-cyan-900/20'
        : 'bg-black/20 backdrop-blur-sm py-6'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <BrandLogo />
        </div>

        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          <button onClick={() => scrollToSection('features')} className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">Features</button>
          <button onClick={() => scrollToSection('comprehensive-services')} className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">Services</button>
          <button onClick={() => scrollToSection('roles')} className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">How it Works</button>
          <button onClick={() => scrollToSection('about-us')} className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">About Us</button>
          <button onClick={() => scrollToSection('testimonials')} className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">Reviews</button>
          <div className="relative group">
            <button className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium flex items-center gap-1">
              Policies <ChevronDown size={14} />
            </button>
            <div className="absolute top-full left-0 mt-2 w-48 bg-secondary border border-cyan-900/50 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 py-2 overflow-hidden">
              <button onClick={onOpenPrivacy} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-cyan-400 transition-colors">Privacy Policy</button>
              <button onClick={onOpenRefund} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-cyan-400 transition-colors">Refund Policy</button>
              <button onClick={onOpenTerms} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-cyan-400 transition-colors">Terms of Service</button>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-2.5 rounded-full bg-gradient-primary text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:-translate-y-0.5 border border-cyan-500/20"
          >
            Log In
          </button>
        </div>

        <button
          className="lg:hidden text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-[#030712]/98 backdrop-blur-xl border-b border-cyan-500/30 p-6 flex flex-col gap-4 shadow-2xl animate-fade-in transition-all overflow-y-auto max-h-[calc(100vh-80px)]">
          <button onClick={() => scrollToSection('features')} className="text-gray-300 hover:text-cyan-400 text-left py-2">Features</button>
          <button onClick={() => scrollToSection('comprehensive-services')} className="text-gray-300 hover:text-cyan-400 text-left py-2">Services</button>
          <button onClick={() => scrollToSection('roles')} className="text-gray-300 hover:text-cyan-400 text-left py-2">How it Works</button>
          <button onClick={() => scrollToSection('about-us')} className="text-gray-300 hover:text-cyan-400 text-left py-2">About Us</button>
          <button onClick={() => scrollToSection('testimonials')} className="text-gray-300 hover:text-cyan-400 text-left py-2">Reviews</button>
          <button onClick={() => { onOpenPrivacy(); setMobileMenuOpen(false); }} className="text-gray-300 hover:text-cyan-400 text-left py-2">Privacy Policy</button>
          <button onClick={() => { onOpenRefund(); setMobileMenuOpen(false); }} className="text-gray-300 hover:text-cyan-400 text-left py-2">Refund Policy</button>
          <div className="h-px bg-white/10 my-2"></div>
          <button onClick={() => navigate('/auth')} className="text-white font-medium text-left py-2">Log In</button>
          <button onClick={() => navigate('/auth')} className="bg-gradient-primary text-white py-3 rounded-lg font-semibold w-full border border-cyan-500/20">Get Started</button>
        </div>
      )}
    </nav>
  );
};

// --- Hero Component ---
const Hero = () => {
  const navigate = useNavigate();

  const scrollToDemo = () => {
    document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-44 pb-16 md:pt-52 md:pb-24 lg:pt-80 lg:pb-32 overflow-hidden">
      {/* Enhanced Aurora Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-900/20 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center mt-4 md:mt-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-orange-500/30 mb-8 animate-fade-in-up shadow-[0_0_15px_rgba(249,115,22,0.2)]">
          <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_#f97316]"></span>
          <span className="text-xs font-bold text-orange-400 tracking-wide uppercase">v2.0 Now Live</span>
        </div>

        <h1
          className="text-4xl sm:text-4xl md:text-5xl lg:text-7xl font-black text-white filter mb-6 leading-[1.1] animate-fade-in-up delay-100 tracking-tight"
          style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
        >
          Start Compliance with <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 filter drop-shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            Transparent Service Fees</span>
          <br />
          <span className="text-2xl md:text-3xl text-gray-400 font-semibold"></span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed animate-fade-in-up delay-200 px-2">
          The fastest way to register <span className="text-white font-bold">GST, MSME, ROC, DSC, Startup India Registration and DPIIT</span>.
          Expert verification, real-time tracking, and effortless compliance management.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300 px-4">
          <button
            onClick={() => navigate('/auth')}
            className="w-full sm:w-auto group px-8 py-4 bg-gradient-primary rounded-xl font-bold text-white hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-1"
          >
            Get Started Free <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => window.open("https://wa.me/6364562818", "_blank")}
            className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-white hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2"
          >
            Talk to Expert
          </button>
          <button
            onClick={scrollToDemo}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 border border-white/20 text-white font-semibold text-lg hover:bg-white/10 hover:border-cyan-400/50 backdrop-blur-sm transition-all flex items-center justify-center gap-2 group shadow-lg"
          >
            <Play size={18} className="fill-current text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            View Demo
          </button>
        </div>

        <div id="comprehensive-services" className="relative mt-16 md:mt-20">
          <div className="relative z-20 w-screen left-1/2 -translate-x-1/2">
            <ServiceMarquee />
          </div>

          {/* Storylane Demo Embed */}
          {/* Temporarily commented out to fix Arcade iframe console errors*/}
          <div id="demo-section" className="relative mx-auto max-w-5xl mt-16 md:mt-20 animate-fade-in-up delay-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-orange-500 to-cyan-600 rounded-xl blur opacity-40"></div>
            <div className="relative rounded-xl border border-white/10 bg-[#0B1120]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="aspect-video w-full" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                <iframe
                  src="https://app.arcade.software/share/Ni14GoIj9nWa8kxZiBx0"
                  title="RegiBIZ Interactive Demo"
                  frameBorder="0"
                  allow="fullscreen"
                  allowFullScreen
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: '0.75rem'
                  }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

const ServiceMarquee = () => {
  const landingServices = [
    { name: 'GST Registration', path: '/services/gst-registration', tag: 'Popular', fee: 'FREE', description: 'Quick and hassle-free GST registration for businesses and individuals.' },
    { name: 'MSME Registration', path: '/services/msme-registration', tag: 'Trending', fee: 'FREE', description: 'Identify your business as an MSME and unlock exclusive gov. benefits.' },
    { name: 'Startup India', path: '/services/startup-india', tag: 'DPIIT', fee: '2,999', description: 'Official DPIIT recognition for startups to access tax exemptions and funding.' },
    { name: 'DSC Registration', path: '/services/dsc-registration', tag: 'New', fee: '1,350', description: 'Class-3 Digital Signature Certificate for secure and legal online filings.' },
    { name: 'Company Registration', path: '/services/company-registration', tag: 'Popular', fee: '2,999', description: 'End-to-end incorporation support for Pvt. Ltd and LLP entities.' },
    { name: 'ADT-1 Filing', path: '/services/adt-1-filing', tag: 'New', fee: '699 + 18% GST', description: 'Mandatory intimation of auditor appointment to the Registrar of Companies.' },
    { name: 'INC-20A Filing', path: '/services/inc-20a-filing', tag: 'Trending', fee: '699 + 18% GST', description: 'Compulsory declaration of commencement of business for new companies.' },
    { name: 'INC-22A (ACTIVE)', path: '/services/inc-22a-filing', tag: 'Trending', fee: '699 + 18% GST', description: 'Active compliance verification to maintain healthy corporate status.' },
    { name: 'MGT-7A Filing', path: '/services/mgt-7-filing', tag: 'Trending', fee: '699 + 18% GST', description: 'Annual return filing for small companies and one person companies.' },
    { name: 'AOC-4 Filing', path: '/services/a0c4-filing', tag: 'Trending', fee: '699 + 18% GST', description: 'Filing of financial statements and documents with the ROC annually.' },
    { name: 'DIR-3 KYC', path: '/services/dir-3-kyc-filing', tag: 'Trending', fee: '699 + 18% GST', description: 'Annual KYC verification for all active directors holding a DIN.' },
  ];

  const scrollData = [...landingServices, ...landingServices];

  return (
    <div className="relative group overflow-hidden py-4">
      <div className="flex w-max min-w-max animate-marquee-ltr hover:pause py-4 will-change-transform">
        {scrollData.map((service, idx) => (
          <ServiceHighlightCard key={idx} {...service} />
        ))}
      </div>
    </div>
  );
};

// --- SocialProofStrip Component (LIVE DATA) ---
const SocialProofStrip = () => {
  const { customerCount, reviewRating, reviewCount, isLoading, googleUrl } = useLiveSocialProof();

  const formatCount = (n: number): string => {
    if (n === 0 && isLoading) return '...';
    return n.toLocaleString();
  };

  // Build star icons based on live rating (supports half stars)
  const fullStars = Math.floor(reviewRating);
  const hasHalf = reviewRating % 1 >= 0.5;

  return (
    <section className="landing-social-proof w-full bg-[#0a0a0a] border-y border-white/5 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4">

          {/* Left: Customer Quote */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <p className="landing-proof-quote text-gray-300 text-sm md:text-base leading-relaxed italic">
              &ldquo;Registration, Filing, and Legal help in
              <br className="hidden sm:block" />
              one app just makes sense&rdquo;
            </p>
          </div>

          {/* Center Divider */}
          <div className="hidden md:block w-px h-16 bg-white/10"></div>

          {/* Center: Live Customer Badge */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              {/* Left laurel */}
              <svg viewBox="0 0 40 80" className="w-6 h-14 text-yellow-500/70 fill-yellow-500/70">
                <path d="M32 4C20 10 8 22 8 40c0 18 12 30 24 36-6-8-10-18-10-36 0-16 6-28 10-36z" />
              </svg>
              <div className="text-center">
                {/* Stars */}
                <div className="flex items-center justify-center gap-0.5 mb-1">
                  {[1, 2, 3].map(i => (
                    <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                {/* Live Happy Customers count */}
                <span
                  className="text-yellow-400 font-black text-lg block leading-none tabular-nums"
                  title="Live count from our platform"
                >
                  {formatCount(customerCount)}
                </span>
                <span className="landing-proof-label text-[10px] text-gray-400 font-semibold tracking-widest uppercase block mt-0.5">
                  Happy Customers
                </span>
              </div>
              {/* Right laurel (mirrored) */}
              <svg viewBox="0 0 40 80" className="w-6 h-14 text-yellow-500/70 fill-yellow-500/70" style={{ transform: 'scaleX(-1)' }}>
                <path d="M32 4C20 10 8 22 8 40c0 18 12 30 24 36-6-8-10-18-10-36 0-16 6-28 10-36z" />
              </svg>
            </div>
          </div>

          {/* Center Divider */}
          <div className="hidden md:block w-px h-16 bg-white/10"></div>

          <div className="flex-shrink-0">
            <a
              href={googleUrl || "https://www.google.com/search?q=CloudMaSa+Innovation+Lab+Private+Limited+Reviews"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
            >
              {/* Google G Logo */}
              <div className="flex-shrink-0 w-10 h-10">
                <svg viewBox="0 0 48 48" className="w-full h-full">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              {/* Content */}
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-sm leading-none mb-1.5">Google Reviews</span>
                <div className="flex items-center gap-0.5 mb-1">
                  {Array.from({ length: fullStars }).map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                  {hasHalf && (
                    <svg className="w-4 h-4" viewBox="0 0 20 20">
                      <defs>
                        <linearGradient id="halfStar">
                          <stop offset="50%" stopColor="#facc15" />
                          <stop offset="50%" stopColor="#374151" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#halfStar)" d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  )}
                  <span className="text-yellow-400 font-bold text-xs ml-0.5">{reviewRating.toFixed(1)}/5</span>
                </div>
                <span className="landing-proof-label text-gray-400 text-[11px]">
                  {isLoading ? '...' : `${reviewCount.toLocaleString()} reviews`}
                </span>
              </div>
            </a>
          </div>

        </div>
      </div>
    </section>
  );
};

// --- FeatureCard Component ---
const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-orange-500/30 transition-all group shadow-lg hover:shadow-orange-500/10">
    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-cyan-500/30">
      <Icon className="text-cyan-400 w-6 h-6 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{title}</h3>
    <p className="text-gray-400 leading-relaxed">{description}</p>
  </div>
);

// --- HowItWorksSection Component ---
const HowItWorksSection = () => (
  <section id="roles" className="py-16 md:py-24 lg:py-32 bg-background relative border-y border-white/5 overflow-hidden">
    {/* Subtle Background Glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[50%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none"></div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="text-center mb-24">
        <h2 className="text-sm font-bold text-cyan-400 tracking-widest uppercase mb-3">The Process</h2>
        <h3 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white mb-6">
          How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Works</span>
        </h3>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
          A seamless, transparent, and entirely digital path to complete compliance. No paperwork, no physical visits.
        </p>
      </div>

      <div className="relative">
        {/* Connecting Line (Desktop) */}
        <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-cyan-800/50 to-transparent"></div>

        <div className="grid md:grid-cols-3 gap-16 relative">
          {[
            {
              step: "01",
              title: "Intelligent Onboarding",
              desc: "Submit your details through our dynamic, AI-assisted forms designed to eliminate errors and compliance rejections.",
              icon: FileText
            },
            {
              step: "02",
              title: "Expert Execution",
              desc: "Our dedicated network of certified CAs and legal professionals validate, prepare, and file your documents instantly.",
              icon: Briefcase
            },
            {
              step: "03",
              title: "Real-Time Delivery",
              desc: "Track live progress via your dashboard and receive government-issued certificates securely in your digital vault.",
              icon: CheckCircle
            }
          ].map((item, idx) => (
            <div key={idx} className="relative group text-center">
              <div className="w-24 h-24 mx-auto bg-secondary rounded-2xl border border-cyan-900/50 flex items-center justify-center mb-8 relative z-10 group-hover:-translate-y-2 transition-all duration-500 shadow-xl shadow-cyan-900/20 group-hover:border-cyan-400/50 group-hover:shadow-cyan-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="absolute -top-4 -right-4 w-10 h-10 bg-background border-2 border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 font-bold shadow-lg transform group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white group-hover:border-cyan-400 transition-all duration-300">
                  {item.step}
                </span>
                <item.icon className="text-cyan-400 w-10 h-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(34,211,238,0.6)] transition-all duration-300" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors duration-300">{item.title}</h4>
              <p className="text-gray-400 leading-relaxed text-base px-4">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// --- ServicesGrid Component ---


// --- ExpertsSection Component ---
const ExpertsSection = () => (
  <section className="py-24 relative overflow-hidden bg-background border-y border-white/5">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-900/10 blur-[150px] rounded-full pointer-events-none"></div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="text-center mb-16">
        <h2 className="text-sm font-bold text-cyan-400 tracking-widest uppercase mb-3">Our Credibility</h2>
        <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
          Backed by <span className="text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Verified Professionals</span>
        </h3>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Your compliance isn't handled by bots. Every application is vetted, processed, and filed by our network of certified Chartered Accountants and Legal Experts.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          { name: "CA. Ramesh Kumar", role: "Chartered Accountant", exp: "12+ Years Exp", spec: "GST & Tax Compliances" },
          { name: "CS. Priya Sharma", role: "Company Secretary", exp: "8+ Years Exp", spec: "ROC & Corporate Law" },
          { name: "Adv. Arjun Reddy", role: "Corporate Lawyer", exp: "15+ Years Exp", spec: "Contracts & IPR" }
        ].map((expert, i) => (
          <div key={i} className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-center group">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full mb-6 border border-cyan-500/30 flex items-center justify-center">
              <UserCheck size={40} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-xl font-bold text-white mb-1">{expert.name}</h4>
            <p className="text-cyan-400 text-sm font-medium mb-4">{expert.role}</p>
            <div className="flex flex-col gap-2 text-sm text-gray-400">
              <span className="flex items-center justify-center gap-2"><Award size={16} className="text-orange-500" /> {expert.exp}</span>
              <span className="flex items-center justify-center gap-2"><Shield size={16} className="text-emerald-500" /> {expert.spec}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// --- NEW About Us Section Component ---
const AboutUsSection = () => {
  return (
    <section id="about-us" className="py-16 md:py-24 lg:py-32 bg-background relative overflow-hidden border-y border-white/5">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-sm font-bold text-cyan-400 tracking-widest uppercase mb-3">Who We Are</h2>
          <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
            Access High-Quality <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to text-2xl md:text-5xl">Service Fee Pricing</span>
          </h3>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
            RegiBIZ, powered by CloudMasa, is redefining how entrepreneurs interact with government regulations. We combine technology with legal expertise to make business registration effortless.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                <Target className="text-cyan-400 w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Our Mission</h4>
                <p className="text-gray-400 leading-relaxed">
                  To eliminate the complexity of bureaucratic processes by providing a seamless, transparent, and fully digital platform for business compliance in India.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/30">
                <Globe className="text-orange-400 w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Our Vision</h4>
                <p className="text-gray-400 leading-relaxed">
                  To become India's most trusted partner for startups and SMEs, enabling them to focus on growth while we handle the regulatory framework.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-secondary border border-white/10 rounded-2xl p-8 shadow-2xl">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 mb-1">10k+</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Businesses Served</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-1">99%</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Customer Satisfaction</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 mb-1">Fast</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Turnaround Time</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-1">Fixed</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Service Fees</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-cyan-900/20 via-blue-900/20 to-teal-900/20 rounded-3xl p-10 border border-white/5 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Why Trust RegiBIZ?</h3>
          <p className="text-gray-300 max-w-2xl mx-auto mb-8">
            We aren't just a software platform; we are a team of legal experts, Chartered Accountants, and tech enthusiasts dedicated to your success. Our automated systems ensure accuracy, while our human experts ensure compliance.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold text-cyan-300">
            <span className="px-4 py-2 rounded-full bg-cyan-900/30 border border-cyan-500/20">GST Experts</span>
            <span className="px-4 py-2 rounded-full bg-cyan-900/30 border border-cyan-500/20">Legal Advisors</span>
            <span className="px-4 py-2 rounded-full bg-cyan-900/30 border border-cyan-500/20">Tech Driven</span>
            <span className="px-4 py-2 rounded-full bg-cyan-900/30 border border-cyan-500/20">Secure & Private</span>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- SecuritySection Component ---
const SecuritySection = () => (
  <section id="security" className="landing-security-section py-24 bg-gradient-to-b from-[#07111f] via-[#050b14] to-[#020617] border-y border-cyan-400/10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900/20 border border-cyan-500/30 mb-6 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Bank-Grade Security</span>
          </div>
          <h2 className="landing-dark-title text-3xl md:text-4xl font-extrabold text-white mb-6">
            Your Data is Safe with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">256-bit Encryption</span>
          </h2>
          <p className="landing-dark-copy text-gray-400 text-lg mb-8 leading-relaxed">
            We prioritize your privacy and data security above all else. Our platform is built on enterprise-grade infrastructure.
          </p>
          <div className="space-y-4">
            {[
              "End-to-end 256-bit SSL encryption",
              "OTP-verified secure login sessions",
              "Firebase-backed secure document vault",
              "GDPR & ISO 27001 compliant practices"
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-900/30 flex items-center justify-center border border-cyan-500/20">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="landing-dark-list-text text-gray-300 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-[60px] rounded-full"></div>
          <div className="landing-security-card relative bg-[#dff0f8] border border-cyan-200/70 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-900/50 animate-pulse border border-cyan-500/30"></div>
                <div>
                  <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-16 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-cyan-900/30 text-cyan-400 text-xs font-mono border border-cyan-500/20">
                SECURE_CONNECTION
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-full bg-white/5 rounded border border-white/5 flex items-center px-4 text-gray-500 font-mono text-sm">
                •••• •••• •••• 8832
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-12 w-full bg-white/5 rounded border border-white/5"></div>
                <div className="h-12 w-full bg-white/5 rounded border border-white/5"></div>
              </div>
              <button className="w-full h-12 bg-gradient-primary rounded font-bold text-white mt-4 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-shadow border border-cyan-500/20">
                Verify Identity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// --- Testimonials Component ---
const Testimonials = () => (
  <section id="testimonials" className="py-24 relative">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to text-center mb-16">Trusted by Industry Leaders</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            name: "Praveen Dinavahi",
            role: "CEO, TELCOMET",
            text: "RegiBIZ streamlined our GST registration process for TELCOMET Global Solutions. The automated workflow saved us weeks of manual follow-ups. Highly efficient platform for IT infrastructure companies."
          },
          {
            name: "Manikandan S",
            role: "Founder & CEO, DuskCoder",
            text: "As a fast-growing tech startup in Puducherry, we needed quick MSME registration. RegiBIZ delivered in just 3 days with zero service charges. The real-time tracking dashboard is exceptional."
          },
          {
            name: "Bathri Narayanan",
            role: "Co-Founder & CEO, ALAN Technologies",
            text: "The DSC registration process was seamless. RegiBIZ handled everything digitally, and their support team guided us through every step. Perfect for software companies needing compliance solutions."
          },
          {
            name: "Siva Swarup Reddy Rachamalla",
            role: "CEO, CloudAce Technologies",
            text: "We registered our company and obtained GST through RegiBIZ. The platform's transparency and bank-grade security gave us confidence. A must-use for Hyderabad-based tech enterprises."
          }
        ].map((t, i) => (
          <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm relative hover:border-orange-500/30 transition-colors flex flex-col h-full">
            <div className="absolute -top-4 left-6 w-8 h-8 bg-gradient-to-br from-heading-from to-heading-to rounded-full flex items-center justify-center text-white font-serif text-xl shadow-lg">
              "
            </div>
            <p className="text-gray-300 mb-6 italic text-sm leading-relaxed flex-grow">{t.text}</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-900 to-blue-900 border border-cyan-500/30 flex items-center justify-center">
                <span className="text-cyan-400 font-bold text-sm">
                  {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">{t.name}</h4>
                <p className="text-xs text-cyan-400">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// --- Comprehensive Services Section ---
const ServiceHighlightCard = ({
  name,
  description,
  path,
  tag,
  fee,
}: {
  name: string;
  description: string;
  path: string;
  tag?: string;
  fee: string;
}) => {
  const navigate = useNavigate();
  const isFree = fee === 'FREE';
  return (
    <div
      onClick={() => {
        sessionStorage.setItem('postLoginRedirect', path);
        // ✅ Pass the service path as redirect target
        navigate('/auth', {
          state: { redirectTo: path }  // ← 'path' prop = '/services/gst-registration', '/services/msme-registration', etc.
        });
        window.scrollTo(0, 0);
      }}
      className="landing-service-card w-[300px] sm:w-[320px] shrink-0 mx-3 sm:mx-4 relative group p-8 rounded-2xl bg-white/5 border border-cyan-400/20 transition-all duration-300 flex flex-col h-[220px] hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] cursor-pointer overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 opacity-80" />
      <div className="flex justify-between items-start mb-4">
        <div className={`landing-service-price px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${isFree
          ? 'bg-emerald-400/15 border-emerald-300/40 text-emerald-200'
          : 'bg-orange-400/15 border-orange-300/40 text-orange-200'
          }`}>
          {isFree ? 'FREE' : `₹${fee}`}
        </div>
        {tag && (
          <div className="landing-service-tag px-2.5 py-1 rounded-full bg-cyan-400/15 border border-cyan-300/40 text-cyan-100 text-[10px] font-black tracking-widest uppercase">
            {tag}
          </div>
        )}
      </div>

      <div className="mb-auto">
        <h4 className="landing-service-title text-lg font-black text-white mb-2 leading-tight group-hover:text-cyan-200 transition-colors uppercase tracking-tight">{name}</h4>
        <p className="landing-service-description text-sm text-gray-400/80 leading-relaxed line-clamp-3 font-medium">
          {description}
        </p>
      </div>

      <div className="landing-service-link mt-4 flex items-center gap-2 text-cyan-200 text-xs font-black opacity-100 transition-all group-hover:translate-x-1">
        Explore Service <ArrowRight size={14} />
      </div>
    </div>
  );
};

const ComprehensiveServices = () => {
  return null;
};



// --- TrustSection Component (Why Choose Us) ---
const TrustSection = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h3 className="text-3xl md:text-5xl font-black text-white mb-4 animate-fade-in-up">Why Choose Us?</h3>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Experience transparency and expertise like never before with our commitment to founder success.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-20">
          {[
            "Fixed Service Fees",
            "Transparent Pricing",
            "No Hidden Charges",
            "Expert CA/CS Support",
            "100% Online Process"
          ].map((feature, i) => (
            <div key={i} className="flex flex-col items-center p-8 rounded-2xl bg-white/5 border border-white/10 text-center group hover:bg-white/10 transition-all duration-500 hover:-translate-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
                <CheckCircle size={28} />
              </div>
              <span className="text-white font-bold text-sm tracking-wide uppercase">{feature}</span>
            </div>
          ))}
        </div>

        <div className="p-10 rounded-3xl bg-white/5 border border-white/10 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-left">
              <h4 className="text-2xl font-bold text-white mb-2 tracking-tight">Need a custom compliance package?</h4>
              <p className="text-gray-400">Our experts can curate a personalized annual compliance calendar for your specific business type.</p>
            </div>
            <button
              onClick={() => window.open("https://wa.me/6364562818", "_blank")}
              className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-cyan-400 hover:text-white transition-all transform hover:-translate-y-1 shadow-lg flex items-center gap-2 whitespace-nowrap"
            >
              Contact Expert <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- Footer Component ---
const Footer = ({ onOpenPrivacy, onOpenRefund, onOpenTerms }: { onOpenPrivacy: () => void, onOpenRefund: () => void, onOpenTerms: () => void }) => {
  const navigate = useNavigate();
  const serviceLinks = [
    { label: 'GST Registration', path: '/services/gst-registration' },
    { label: 'MSME Registration', path: '/services/msme-registration' },
    { label: 'ROC Compliance Package', path: '/services/roc-selection' },
    { label: 'Startup India Registration', path: '/services/startup-india' },
    { label: 'DSC Registration', path: '/services/dsc-registration' },
    { label: 'Company Registration (MCA)', path: '/services/company-registration' },
  ];

  const handleNav = (path: string, isHash = false) => {
    if (isHash) {
      const element = document.getElementById(path);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/');
        setTimeout(() => document.getElementById(path)?.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    } else {
      navigate(path);
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <footer className="landing-footer bg-[#0f172a] border-t border-cyan-400/10 pt-16 pb-8 relative overflow-hidden">
        {/* Subtle background dots matching image */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 w-1 h-1 bg-white rounded-full"></div>
          <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full"></div>
          <div className="absolute bottom-20 left-1/4 w-1 h-1 bg-white rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

            {/* Column 1: Brand & Contact Info */}
            <div className="col-span-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-6 cursor-pointer group" onClick={() => handleNav('/')}>
                <BrandLogo />
              </div>
              <p className="landing-footer-copy text-gray-400 text-sm leading-relaxed mb-6 pr-4">
                We specialize in simplifying business compliance, registrations, and legal services for modern entrepreneurs. Fast, secure, and fully digital.
              </p>

              <div className="landing-footer-copy space-y-3 text-sm text-gray-400">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=3rd+Floor,+Shopping+Mall,+Jawaharlal+Nehru+St,+Heritage+Town,+Puducherry,+605001"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 hover:text-white transition-colors cursor-pointer group"
                >
                  <MapPin size={25} className="text-orange-500 mt-1 group-hover:scale-110 transition-transform" />
                  <span>3rd Floor, Shopping Mall, Jawaharlal Nehru St,<br />Puducherry, 605001</span>
                </a>
                <div className="flex items-center gap-3">
                  <PhoneCall size={16} className="text-orange-500" />
                  <a href="tel:+916364562818" className="hover:text-white transition-colors">+91 63645 62818</a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-orange-500" />
                  <a href="tel:04132262818" className="hover:text-white transition-colors">0413-2262818</a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-orange-500" />
                  <a href="mailto:regibiz.cloudmasa@gmail.com" className="hover:text-white transition-colors">regibiz.cloudmasa@gmail.com</a>
                </div>
              </div>
            </div>

            {/* Column 2: Services */}
            <div className="lg:pl-8 xl:pl-12">
              <h4 className="text-orange-500 font-bold text-xs uppercase tracking-wider mb-6">SERVICES</h4>
              <ul className="landing-footer-links space-y-4 text-sm text-gray-400">
                {serviceLinks.map((service) => (
                  <li key={service.label}>
                    <button onClick={() => handleNav(service.path)} className="hover:text-white transition-colors text-left whitespace-nowrap leading-tight text-[13px]">
                      {service.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div>
              <h4 className="text-orange-500 font-bold text-xs uppercase tracking-wider mb-6">RESOURCES</h4>
              <ul className="landing-footer-links space-y-4 text-sm text-gray-400">
                <li><button onClick={() => handleNav('/blog')} className="hover:text-white transition-colors">Documentation</button></li>
                <li><button onClick={() => handleNav('/blog')} className="hover:text-white transition-colors">Blog</button></li>
                <li><button onClick={() => handleNav('/help')} className="hover:text-white transition-colors">Help Center</button></li>
                <li><button onClick={() => handleNav('/about')} className="hover:text-white transition-colors">Case Studies</button></li>
              </ul>
            </div>

            {/* Column 4: Company */}
            <div>
              <h4 className="text-orange-500 font-bold text-xs uppercase tracking-wider mb-6">COMPANY</h4>
              <ul className="landing-footer-links space-y-4 text-sm text-gray-400">
                {/* UPDATED: About Us now scrolls to section */}
                <li><button onClick={() => handleNav('about-us', true)} className="hover:text-white transition-colors">About Us</button></li>

                {/* Legal Links for Razorpay Compliance */}
                <li>
                  <button onClick={onOpenPrivacy} className="hover:text-white transition-colors block mb-3">Privacy Policy</button>
                  <button onClick={onOpenRefund} className="hover:text-white transition-colors block mb-3">Refund Policy</button>
                  <button onClick={onOpenTerms} className="hover:text-white transition-colors block">Terms of Service</button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="landing-footer-muted text-gray-500 text-sm">
              © 2026 CloudMaSa Innovation Lab Pvt Ltd. All rights reserved.
            </p>

            <div className="flex flex-col items-center gap-4">
              <span className="text-orange-500 text-xs font-bold uppercase tracking-wider">FOLLOW US ON</span>
              <div className="flex gap-4">
                <SocialIcon icon={Youtube} link="https://www.youtube.com/@CloudMaSa_Technologies" />
                <SocialIcon icon={Instagram} link="https://www.instagram.com/cloudmasa_technology/" />
                <SocialIcon icon={Facebook} link="https://www.facebook.com/profile.php?id=61571775508898" />
                <SocialIcon icon={Linkedin} link="https://www.linkedin.com/in/cloudmasa-technologies" />
                <SocialIcon icon={Github} link="https://github.com/CloudMasa-Tech" />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

// --- Main LandingPage Component ---
interface LandingPageProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const LandingPage = ({ theme, onToggleTheme }: LandingPageProps) => {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  return (
    <div className="landing-page min-h-screen bg-transparent text-foreground font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden">
      {/* Custom Animations Style */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          will-change: transform, opacity;
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-500 { animation-delay: 0.5s; }
        
        /* Custom Scrollbar for Modal */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000000cc; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b; 
          border-radius: 4px;
        }
	        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
	          background: #06b6d4; 
	        }

	        .landing-service-card {
	          background:
	            radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 55%),
	            linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.96)) !important;
	          border-color: rgba(103, 232, 249, 0.24) !important;
	          box-shadow: 0 24px 70px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08);
	        }

	        .landing-service-card:hover {
	          border-color: rgba(34, 211, 238, 0.58) !important;
	          transform: translateY(-4px);
	          box-shadow: 0 30px 90px rgba(8, 145, 178, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12);
	        }

	        .landing-service-title,
	        .landing-dark-title {
	          color: #f8fafc !important;
	          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.35);
	        }

	        .landing-service-description,
	        .landing-dark-copy,
	        .landing-dark-list-text,
	        .landing-footer-copy,
	        .landing-footer-links,
	        .landing-footer-muted {
	          color: #cbd5e1 !important;
	        }

	        .landing-service-price,
	        .landing-service-tag,
	        .landing-service-link {
	          color: #ecfeff !important;
	        }

	        .landing-security-section {
	          position: relative;
	          box-shadow: inset 0 1px 0 rgba(103, 232, 249, 0.12), inset 0 -1px 0 rgba(103, 232, 249, 0.08);
	        }

	        .landing-security-section::before,
	        .landing-footer::before {
	          content: "";
	          position: absolute;
	          inset: 0;
	          pointer-events: none;
	          background:
	            radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.14), transparent 28rem),
	            radial-gradient(circle at 80% 10%, rgba(20, 184, 166, 0.1), transparent 26rem);
	        }

	        .landing-security-card {
	          background:
	            linear-gradient(145deg, rgba(232, 246, 252, 0.98), rgba(202, 228, 240, 0.98)) !important;
	          border-color: rgba(125, 211, 252, 0.75) !important;
	          box-shadow: 0 30px 90px rgba(8, 145, 178, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.35) inset !important;
	        }

	        .landing-footer {
	          background:
	            radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.16), transparent 22rem),
	            linear-gradient(180deg, #0f172a 0%, #07111f 100%) !important;
	        }

	        .landing-footer-links button,
	        .landing-footer-copy a,
	        .landing-footer-copy span {
	          color: #cbd5e1 !important;
	        }

	        .landing-footer-links button:hover,
	        .landing-footer-copy a:hover {
	          color: #67e8f9 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-service-card,
	        .landing-page .landing-service-card {
	          background:
	            radial-gradient(circle at top left, rgba(34, 211, 238, 0.2), transparent 58%),
	            linear-gradient(145deg, rgba(15, 23, 42, 0.99), rgba(2, 6, 23, 0.98)) !important;
	          border: 1px solid rgba(103, 232, 249, 0.32) !important;
	          box-shadow: 0 26px 74px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-service-card:hover,
	        .landing-page .landing-service-card:hover {
	          background:
	            radial-gradient(circle at top left, rgba(45, 212, 191, 0.28), transparent 56%),
	            linear-gradient(145deg, rgba(15, 23, 42, 1), rgba(8, 47, 73, 0.98)) !important;
	          border-color: rgba(34, 211, 238, 0.72) !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-service-title,
	        .landing-page .landing-service-title,
	        :root[data-theme='light'] .landing-page .landing-dark-title,
	        .landing-page .landing-dark-title {
	          color: #ffffff !important;
	          -webkit-text-fill-color: #ffffff !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-service-description,
	        .landing-page .landing-service-description {
	          color: #dbeafe !important;
	          -webkit-text-fill-color: #dbeafe !important;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-service-price,
	        :root[data-theme='light'] .landing-page .landing-service-tag,
	        :root[data-theme='light'] .landing-page .landing-service-link,
	        .landing-page .landing-service-price,
	        .landing-page .landing-service-tag,
	        .landing-page .landing-service-link {
	          color: #ecfeff !important;
	          -webkit-text-fill-color: #ecfeff !important;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-dark-copy,
	        :root[data-theme='light'] .landing-page .landing-dark-list-text,
	        .landing-page .landing-dark-copy,
	        .landing-page .landing-dark-list-text {
	          color: #dbeafe !important;
	          -webkit-text-fill-color: #dbeafe !important;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-footer-copy,
	        :root[data-theme='light'] .landing-page .landing-footer-links,
	        :root[data-theme='light'] .landing-page .landing-footer-muted,
	        .landing-page .landing-footer-copy,
	        .landing-page .landing-footer-links,
	        .landing-page .landing-footer-muted {
	          color: #cbd5e1 !important;
	          -webkit-text-fill-color: #cbd5e1 !important;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-social-icon,
	        .landing-page .landing-social-icon {
	          background: rgba(8, 145, 178, 0.16) !important;
	          border-color: rgba(165, 243, 252, 0.52) !important;
	          box-shadow: 0 14px 34px rgba(8, 145, 178, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-social-icon svg,
	        .landing-page .landing-social-icon svg {
	          color: #cffafe !important;
	          stroke-width: 2.25;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-social-icon:hover,
	        .landing-page .landing-social-icon:hover {
	          background: #f97316 !important;
	          border-color: rgba(255, 237, 213, 0.9) !important;
	          box-shadow: 0 18px 40px rgba(249, 115, 22, 0.35) !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-social-icon:hover svg,
	        .landing-page .landing-social-icon:hover svg {
	          color: #ffffff !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-social-proof,
	        .landing-page .landing-social-proof {
	          background:
	            radial-gradient(circle at 18% 50%, rgba(34, 211, 238, 0.12), transparent 24rem),
	            linear-gradient(90deg, #020617 0%, #07111f 48%, #020617 100%) !important;
	          border-color: rgba(103, 232, 249, 0.14) !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-proof-quote,
	        .landing-page .landing-proof-quote {
	          color: #f8fafc !important;
	          -webkit-text-fill-color: #f8fafc !important;
	          opacity: 1 !important;
	          text-shadow: 0 1px 18px rgba(34, 211, 238, 0.16);
	        }

	        :root[data-theme='light'] .landing-page .landing-proof-label,
	        .landing-page .landing-proof-label {
	          color: #cbd5e1 !important;
	          -webkit-text-fill-color: #cbd5e1 !important;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .brand-logo-by,
	        .landing-page .brand-logo-by {
	          color: #0f172a !important;
	          -webkit-text-fill-color: #0f172a !important;
	          opacity: 1 !important;
	        }

	        :root[data-theme='light'] .landing-page .landing-footer .brand-logo-by,
	        .landing-page .landing-footer .brand-logo-by {
	          color: #e2e8f0 !important;
	          -webkit-text-fill-color: #e2e8f0 !important;
	          text-shadow: 0 1px 12px rgba(34, 211, 238, 0.2);
	        }

	        :root[data-theme='light'] .landing-page .landing-social-proof .text-white,
	        :root[data-theme='light'] .landing-page .landing-security-section .text-white,
	        :root[data-theme='light'] .landing-page .landing-footer .text-white,
	        .landing-page .landing-social-proof .text-white,
	        .landing-page .landing-security-section .text-white,
	        .landing-page .landing-footer .text-white {
	          color: #ffffff !important;
	          -webkit-text-fill-color: #ffffff !important;
	        }
	      `}</style>

      <NetworkBackground />

      <Navbar
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenRefund={() => setIsRefundOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      <Hero />



      <SocialProofStrip />

      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-4">Why Choose RegiBIZ?</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            RegiBIZ isn't just a registration platform - it's your operational accelerator, turning regulatory complexity into competitive speed.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={Zap}
            title="Accelerated Processing"
            description="Leverage intelligent automation to expedite your compliance workflows, reducing turnaround times by up to 70% compared to traditional filing methods."
          />
          <FeatureCard
            icon={LayoutDashboard}
            title="Transparent Real-Time Tracking"
            description="Gain complete visibility into your application lifecycle with enterprise-grade dashboards, offering instant status updates and proactive notifications."
          />
          <FeatureCard
            icon={FileText}
            title="Intelligent Error-Free Forms"
            description="Eliminate rejection risks with AI-driven validation, smart auto-fill capabilities, and dynamic compliance checks before submission."
          />
        </div>
      </section>

      <HowItWorksSection />
      <TrustSection />

      <ExpertsSection />

      {/* New About Us Section inserted here */}
      <AboutUsSection />

      <SecuritySection />
      <Testimonials />

      <Footer
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenRefund={() => setIsRefundOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <RefundPolicyModal isOpen={isRefundOpen} onClose={() => setIsRefundOpen(false)} />
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </div>
  );
};

export default LandingPage;