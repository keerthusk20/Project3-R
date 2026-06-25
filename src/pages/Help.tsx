import React, { useState } from 'react';
import { Send, Mail, Phone } from 'lucide-react';
import BackButton from '../components/BackButton';

const Help: React.FC = () => {
  const [formData, setFormData] = useState({
    topic: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Help request:', formData);
    alert('Thank you! We will get back to you soon.');
    setFormData({ topic: '', message: '' });
  };

  // --- COLOR CONSTANTS ---
  // Heading: Teal/Cyan/Blue Gradient
  const headingGradientClass = "text-primary bg-clip-text text-transparent";

  // Button: Red/Orange Gradient
  const actionGradientClass = "bg-gradient-to-r from-heading-from to-heading-to";
  const actionGradientHoverClass = "hover:from-red-600 hover:to-orange-600";

  // Dark Mode Base Styles
  const cardBgClass = "bg-[#0f172a] border border-white/10 shadow-xl";
  const inputClass = "w-full px-4 py-3 bg-[#1e293b] border border-white/10 rounded-lg text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all outline-none";
  const labelClass = "block text-sm font-medium text-gray-400 mb-2";

  return (
    <div className="p-6 md:p-8 min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      <BackButton />

      {/* Heading */}
      <h1 className={`text-2xl md:text-3xl font-bold mb-8 ${headingGradientClass}`}>Help & Support</h1>

      <div className={`${cardBgClass} rounded-2xl p-6 md:p-10 backdrop-blur-md flex-1 shadow-2xl relative overflow-hidden`}>
        {/* Decorative background glow removed in favor of global App background */}
        
        <p className="text-gray-400 mb-10 text-lg">
          Need assistance? Fill out the form below or reach out via our direct channels.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={labelClass}>
              Where do you need help with?
            </label>
            <select
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className={inputClass}
              required
            >
              <option value="" className="bg-[#1e293b]">Select</option>
              <option value="compliance" className="bg-[#1e293b]">Compliance</option>
              <option value="billing" className="bg-[#1e293b]">Billing</option>
              <option value="technical" className="bg-[#1e293b]">Technical Support</option>
              <option value="other" className="bg-[#1e293b]">Other</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Describe your feedback
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Type your message here"
              rows={6}
              className={`${inputClass} resize-none`}
              required
            />
          </div>

          {/* Submit Button: Red/Orange Gradient */}
          <button
            type="submit"
            disabled={!formData.topic || !formData.message}
            className={`px-8 py-3 ${actionGradientClass} ${actionGradientHoverClass} text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-orange-500/20 transform hover:scale-[1.02]`}
          >
            <Send size={18} />
            Send
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 text-gray-400">
            <a href="mailto:regibiz.cloudmasa@gmail.com" className="flex items-center gap-3 group cursor-pointer">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                <Mail size={18} />
              </div>
              <span className="group-hover:text-white transition-colors">regibiz.cloudmasa@gmail.com</span>
            </a>
            <a href="tel:04132262818" className="flex items-center gap-3 group cursor-pointer">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                <Phone size={18} />
              </div>
              <span className="group-hover:text-white transition-colors">0413-2262818</span>
            </a>
            <a href="tel:+916364562818" className="flex items-center gap-3 group cursor-pointer">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                <Phone size={18} />
              </div>
              <span className="group-hover:text-white transition-colors">+91 63645 62818</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;