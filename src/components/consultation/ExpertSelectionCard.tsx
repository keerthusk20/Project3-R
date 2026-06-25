// src/components/consultation/ExpertSelectionCard.tsx
// NOTE: filename must be exactly ExpertSelectionCard.tsx (case-sensitive on Linux)
import React from 'react';
import { motion } from 'framer-motion';
import { Star, Briefcase, CheckCircle, Clock, WifiOff } from 'lucide-react';
import type { ExpertProfile } from '../../Types/consultation';

interface Props {
  expert: ExpertProfile;
  selected: boolean;
  onSelect: (expert: ExpertProfile) => void;
}

const statusConfig = {
  Available: { color: 'text-emerald-400', dot: 'bg-emerald-400' },
  Busy:      { color: 'text-amber-400',   dot: 'bg-amber-400'   },
  Offline:   { color: 'text-slate-400',   dot: 'bg-slate-400'   },
};

export const ExpertSelectionCard: React.FC<Props> = ({ expert, selected, onSelect }) => {
  const status = statusConfig[expert.availabilityStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(expert)}
      className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-300 backdrop-blur-md overflow-hidden
        ${selected
          ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
          : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8'}`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center">
          <CheckCircle size={12} className="text-[#020c1b]" strokeWidth={3} />
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-white font-bold text-lg">
            {expert.name.charAt(0).toUpperCase()}
          </div>
          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#020c1b] ${status.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm leading-tight truncate">{expert.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5">{expert.role} · {expert.specialization}</p>

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <Star size={11} className="text-amber-400 fill-amber-400" />
              <span className="text-amber-300 text-xs font-medium">{expert.rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Briefcase size={11} className="text-slate-400" />
              <span className="text-slate-400 text-xs">{expert.totalConsultations} sessions</span>
            </div>
            <span className={`text-xs font-medium ${status.color}`}>
              {expert.availabilityStatus}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ExpertSelectionCard;