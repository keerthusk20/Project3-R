import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
// import GoogleReviewSection from '../components/GoogleReviewSection';

const GoogleReviewsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-slate-100">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 shadow-sm transition hover:border-cyan-500/30 hover:bg-white/[0.05]"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>

          <div className="hidden sm:block text-sm font-semibold text-slate-400">
            Share your feedback with RegiBIZ
          </div>

          <a
            href="https://www.google.com/search?sca_esv=c615aacbb620d3c2&sxsrf=ANbL-n49vuHIGEMPE0FrwhfAkAPUjXirNQ:1777898448603&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOWy5ey5FnoUyD0Aoa6_dtcDaVYe5QRrHme1atLb9aV_syE6yF9BRqYIMT8HAPwuzmsevpDIGTniGe5jIVBFGC-SuWgq6NRrX3ypPQUTwOFLQjHs5SvF0jRATlUVgkEDzu8JHLIw%3D&q=CloudMaSa+Innovation+Lab+Private+Limited+Reviews&sa=X&ved=2ahUKEwiV8ebr05-UAxV9R2wGHYPKIeUQ0bkNegQIOBAH&biw=1854&bih=961&dpr=1#lrd=0x3a53614383b45d25:0x6e51b3d397031e56,3,,,,"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-500 hover:to-red-500"
          >
            <ExternalLink size={16} />
            Open Google Reviews
          </a>
        </div>
      </div>

      {/* <GoogleReviewSection /> */}
    </div>
  );
};

export default GoogleReviewsPage;
