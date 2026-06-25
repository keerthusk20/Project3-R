import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  to?: string;
  text?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ to = "/", text = "Back to Dashboard" }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="group flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium text-gray-400 hover:text-cyan-400 transition-all duration-300 ease-out bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-full shadow-lg hover:shadow-cyan-500/20 transform hover:-translate-y-0.5 active:scale-95 w-fit"
    >
      <ArrowLeft 
        size={18} 
        className="transform transition-transform duration-300 group-hover:-translate-x-1" 
      />
      <span>{text}</span>
      
      {/* Subtle Glow Effect */}
      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md bg-cyan-500/10 -z-10" />
    </button>
  );
};

export default BackButton;
