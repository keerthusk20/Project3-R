import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import BackButton from '../components/BackButton';

const FAQs: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const topics = [
    { id: 'compliance', title: 'Compliance Calendar' },
    { id: 'messages', title: 'Messages' },
    { id: 'payments', title: 'Payments' },
  ];

  const faqs = {
    compliance: [
      { q: 'What are the compliances included?', a: 'Our compliance calendar includes GST, ROC, TDS, and other mandatory filings.' },
      { q: "I don't see few compliance deadlines, is it not applicable for me?", a: 'Compliance requirements vary based on your business type and registration.' },
      { q: 'I see few compliances that I have not availed in the past. What should I do now?', a: 'Contact our support team to help you with pending compliances.' },
      { q: 'Can I get a customised calendar for my business?', a: 'Yes, we can create a customized compliance calendar based on your specific needs.' },
      { q: 'The information here is different from the web.', a: 'Please contact support if you find any discrepancies in the information provided.' },
    ],
    messages: [
      { q: 'How do I send messages to support?', a: 'Use the Messages section in your dashboard to communicate with our team.' },
      { q: 'How quickly will I get a response?', a: 'We typically respond within 24 hours during business days.' },
    ],
    payments: [
      { q: 'What payment methods are accepted?', a: 'We accept UPI, Credit/Debit Cards, and Net Banking.' },
      { q: 'How do I download invoices?', a: 'Invoices are available in the My Services section under each service.' },
    ],    
  };

  // --- COLOR CONSTANTS ---
  // Heading: Teal/Cyan/Blue Gradient
  const headingGradientClass = "text-primary bg-clip-text text-transparent";
  
  // Dark Mode Base Styles
  const cardBgClass = "bg-[#0f172a] border border-white/10";
  const itemBgClass = "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-cyan-500/30";
  const textColorPrimary = "text-gray-200";
  
  // Internal Component for FAQ Items
  const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="border border-white/10 rounded-lg overflow-hidden bg-white/[0.02]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
        >
          <span className={`text-left font-medium ${textColorPrimary} group-hover:text-white`}>{question}</span>
          <ChevronDown 
            className={`text-gray-500 group-hover:text-cyan-400 transform transition-all duration-300 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} 
            size={20} 
          />
        </button>
        {isOpen && (
          <div className="p-4 border-t border-white/10 bg-background/20">
            <p className="text-gray-400 leading-relaxed">{answer}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      <BackButton />

      {/* Heading */}
      <h1 className={`text-2xl md:text-3xl font-bold mb-8 ${headingGradientClass}`}>Frequently Asked Questions</h1>
      
      {!selectedTopic ? (
        <div className={`${cardBgClass} rounded-2xl shadow-xl p-6 md:p-10 backdrop-blur-md flex-1 relative overflow-hidden`}>
          {/* Decorative background glow removed in favor of global App background */}
          <h2 className={`text-xl font-semibold mb-8 ${headingGradientClass}`}>Choose the topic where you need help</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.id)}
                className={`flex flex-col items-start justify-between p-8 rounded-2xl transition-all duration-300 group ${itemBgClass} text-left h-40`}
              >
                <span className={`text-xl font-bold ${textColorPrimary} group-hover:text-white`}>{topic.title}</span>
                <div className="flex items-center gap-2 text-sm text-cyan-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                  View Questions <ChevronRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`${cardBgClass} rounded-2xl shadow-xl p-6 md:p-10 backdrop-blur-md flex-1 relative overflow-hidden`}>
          {/* Decorative background glow removed in favor of global App background */}
          <button
            onClick={() => setSelectedTopic(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 mb-6 transition-colors group"
          >
            <ChevronRight className="rotate-180 transform transition-transform group-hover:-translate-x-1" size={20} />
            Back
          </button>
          
          <h2 className={`text-xl font-semibold mb-6 ${headingGradientClass}`}>
            {topics.find(t => t.id === selectedTopic)?.title}
          </h2>
          
          <div className="space-y-4">
            {faqs[selectedTopic as keyof typeof faqs]?.map((faq, index) => (
              <FAQItem key={index} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FAQs;