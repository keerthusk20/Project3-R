import React from 'react';
import { CheckCircle, Bell, FileText, Users } from 'lucide-react';
import BackButton from '../components/BackButton';

const MySubscriptions: React.FC = () => {
  // --- COLOR CONSTANTS ---
  const headingGradientClass = "text-primary bg-clip-text text-transparent";
  const actionGradientClass = "bg-gradient-to-r from-heading-from to-heading-to";
  const actionGradientHoverClass = "hover:from-red-600 hover:to-orange-600";
  const cardBgClass = "bg-[#0f172a] border border-white/10 shadow-xl";
  
  // Define classes here so they can be passed down or used internally
  const featureIconClass = "text-teal-400";
  const featureTextClass = "text-gray-300";

  // Internal Component to access parent scope variables if needed, 
  // but better to pass props for clean React practice.
  const FeatureItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
      <div className={`mt-0.5 ${featureIconClass} group-hover:scale-110 transition-transform`}>{icon}</div>
      <span className={`${featureTextClass} group-hover:text-white transition-colors`}>{text}</span>
    </div>
  );

  return (
    <div className="p-6 md:p-8 min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      <BackButton />

      {/* Heading: Teal/Cyan/Blue Gradient */}
      <h1 className={`text-2xl md:text-3xl font-bold mb-8 ${headingGradientClass}`}>My Subscriptions</h1>
      
      <div className={`${cardBgClass} rounded-2xl p-6 md:p-12 backdrop-blur-md flex-1 shadow-2xl relative overflow-hidden`}>
        {/* Decorative background glow removed in favor of global App background */}
        
        <div className="text-center mb-12 relative z-10">
          {/* Sub-Heading: Teal/Cyan/Blue Gradient */}
          <h2 className={`text-2xl font-bold mb-2 ${headingGradientClass}`}>
            No Plan Yet? Let's Make Compliance the Easiest Part of Your Business
          </h2>
          <p className="text-gray-400">
            We've bundled all the annual and mandatory compliances your business needs — into one smart subscription.
          </p>
        </div>
        
        {/* Icon Container with Dark Gradient Background */}
        <div className="flex justify-center mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-teal-900/30 to-blue-900/30 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
            <FileText size={64} className="text-teal-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)]" />
          </div>
        </div>
        
        <div className="mb-8">
          <h3 className={`text-lg font-semibold mb-4 ${headingGradientClass}`}>With every plan:</h3>
          <div className="space-y-4">
            <FeatureItem icon={<CheckCircle size={20} />} text="Core compliances covered — MSME, GST, and other essentials" />
            <FeatureItem icon={<CheckCircle size={20} />} text="Add-ons available — add what your business needs during checkout" />
            <FeatureItem icon={<Bell size={20} />} text="On-time alerts — automated reminders and expert nudges for upcoming tasks" />
            <FeatureItem icon={<Users size={20} />} text="End-to-end support — our experts collect documents & file on your behalf" />
          </div>
        </div>
        
        <p className="text-gray-400 italic mb-8 border-l-4 border-teal-500 pl-4">No missed deadlines, no last-minute rush.</p>
        
        {/* Offer Banner - Dark Background with Red/Orange Button */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden">
          {/* Subtle Glow */}
          {/* Subtle Glow removed */}
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="font-bold text-white mb-1">Special 10% offer only for new businesses like yours.</p>
              <p className="text-sm text-gray-400">Limited time offer - Claim now!</p>
            </div>
            
            {/* Button: Red/Orange Gradient */}
            <button className={`px-6 py-3 ${actionGradientClass} ${actionGradientHoverClass} text-white font-bold rounded-lg transition-all shadow-lg shadow-orange-500/20 transform hover:scale-105 whitespace-nowrap`}>
              Explore Plans & Claim Offer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySubscriptions;