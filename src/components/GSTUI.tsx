// src/components/GSTUI.tsx
// Reusable UI components for GST registration forms, matching the MSME style.

import React from 'react';

// ---------- Status Banner ----------
export const StatusBanner: React.FC = () => (
  <div className="bg-gradient-to-r from-teal-900/40 to-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-[0_8px_30px_rgba(0,0,0,0.5)] mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-slate-500 font-medium line-through text-lg">₹999</span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 font-extrabold text-2xl tracking-tight drop-shadow-sm">FREE</span>
        <span className="bg-cyan-500/20 text-cyan-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          Govt charges applicable
        </span>
      </div>
      <p className="text-slate-400 text-sm mt-1 font-medium">Includes Digital Signature & Filing</p>
    </div>
  </div>
);

// ---------- Progress Status ----------
interface ProgressStatusProps {
  currentStep: number;
  uploadedFiles: Record<string, boolean>;
  requiredDocs: Array<{ key: string; label: string; isRequired: boolean }>;
}
export const ProgressStatus: React.FC<ProgressStatusProps> = ({ currentStep, uploadedFiles, requiredDocs }) => {
  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'active';
    return 'pending';
  };

  const uploadedCount = requiredDocs.filter(doc => doc.isRequired && uploadedFiles[doc.key]).length;
  const requiredCount = requiredDocs.filter(doc => doc.isRequired).length;

  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-all duration-300">
      <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
        <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 0 012 2v14a2 2 0 01-2 2h-2a2 0 01-2-2z" />
          </svg>
        </span>
        Progress Status
      </h3>
      <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
        {[2, 3, 4, 5, 6, 7, 8].map(step => (
          <div key={step} className="ml-5 relative">
            <span
              className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${getStepStatus(step) === 'completed'
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : getStepStatus(step) === 'active'
                  ? 'bg-gradient-to-br from-teal-500 to-cyan-500 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,212,0.5)] scale-110'
                  : 'bg-slate-700'
                }`}
            ></span>
            <h4 className={`text-sm font-medium ${getStepStatus(step) === 'active'
              ? 'text-white'
              : getStepStatus(step) === 'completed'
                ? 'text-emerald-400'
                : 'text-slate-400'
              }`}
            >
              {step === 2 ? 'Enterprise Details' :
                step === 3 ? 'Financials & Activity' :
                  step === 4 ? 'Address Information' :
                    step === 5 ? 'Contact & Bank' :
                      step === 6 ? 'Partners Details' :
                        step === 7 ? 'Authorized Signatory' :
                          'Documents & Declaration'}
            </h4>
            <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
              {step === 8
                ? `${uploadedCount}/${requiredCount} Documents Uploaded`
                : getStepStatus(step) === 'completed'
                  ? 'Completed'
                  : getStepStatus(step) === 'active'
                    ? 'In Progress'
                    : 'Pending'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Required Documents ----------
interface RequiredDocsProps {
  requiredDocs: Array<{ key: string; label: string; isRequired: boolean }>;
  uploadedFiles: Record<string, boolean>;
}
export const RequiredDocuments: React.FC<RequiredDocsProps> = ({ requiredDocs, uploadedFiles }) => (
  <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl transition-all duration-300">
    <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
      <span className="bg-amber-500/20 p-1.5 rounded mr-2">
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </span>
      Required Documents
    </h3>
    <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
      {requiredDocs.map((item, idx) => {
        const isUploaded = uploadedFiles[item.key];
        return (
          <li key={idx} className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${item.isRequired
            ? isUploaded
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-slate-800/30 border border-slate-700/50'
            : 'bg-slate-800/20 border border-slate-700/30 opacity-60'
            }`}>
            <div className="flex items-center">
              <div className={`mr-3 w-5 h-5 rounded-full flex items-center justify-center ${isUploaded && item.isRequired
                ? 'bg-emerald-500 text-white'
                : item.isRequired
                  ? 'bg-slate-700 text-slate-500'
                  : 'bg-slate-700/50 text-slate-600'
                }`}>
                {isUploaded && item.isRequired ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <span className={`font-medium text-sm ${item.isRequired ? (isUploaded ? 'text-slate-100' : 'text-slate-300') : 'text-slate-500'}`}>
                {item.label}
              </span>
              {!item.isRequired && <span className="text-xs text-slate-600 ml-2">(Not Required)</span>}
            </div>
            {isUploaded && item.isRequired && (
              <span className="text-xs font-bold text-emerald-400 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">READY</span>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

// ---------- Info Sidebar (optional) ----------
export const InfoSidebar: React.FC<any> = (props) => {
  // Placeholder – GST forms can import this component and pass their own props.
  return null;
};
