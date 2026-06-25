import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface FormBackButtonProps {
  onBack?: () => void;
}

const FormBackButton: React.FC<FormBackButtonProps> = ({ onBack }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="group flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-cyan-500/50 transition-all duration-300 shadow-lg backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
    </button>
  );
};

export default FormBackButton;
