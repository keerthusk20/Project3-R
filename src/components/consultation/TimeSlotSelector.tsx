import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { TimeSlot } from '../../types/consultation';

interface TimeSlotSelectorProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
  accentGradient?: string; // e.g. "from-amber-500 to-orange-500"
}

export const TimeSlotSelector: React.FC<TimeSlotSelectorProps> = ({
  slots,
  selectedSlot,
  onSelect,
  accentGradient = 'from-amber-500 to-orange-500',
}) => {
  // Group by period
  const groups = slots.reduce((acc, slot) => {
    const p = slot.period || 'Other';
    if (!acc[p]) acc[p] = [];
    acc[p].push(slot);
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  const periodOrder = ['Morning', 'Afternoon', 'Evening', 'Other'];
  const orderedGroups = periodOrder.filter(p => groups[p]);

  if (slots.length === 0) {
    return (
      <div className="bg-white/3 rounded-2xl border border-white/10 p-8 text-center">
        <Clock size={28} className="mx-auto text-slate-600 mb-3" />
        <p className="text-slate-500 text-sm">No slots available for this date.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/3 rounded-2xl border border-white/10 p-4 space-y-5">
      {orderedGroups.map(period => (
        <div key={period}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-slate-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{period}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {groups[period].map(slot => {
              const isSelected = selectedSlot?.id === slot.id;
              return (
                <button
                  key={slot.id}
                  disabled={!slot.available}
                  onClick={() => slot.available && onSelect(slot)}
                  className={`relative py-2.5 px-2 rounded-xl text-xs font-bold border transition-all duration-150 flex flex-col items-center justify-center gap-0.5
                    ${!slot.available
                      ? 'bg-white/2 border-white/5 text-slate-700 cursor-not-allowed'
                      : isSelected
                      ? `bg-gradient-to-br ${accentGradient} border-transparent text-white shadow-xl`
                      : 'bg-white/3 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/20 hover:text-white'}`}>
                  {isSelected && (
                    <CheckCircle2 size={10} className="absolute top-1 right-1 text-white/80" />
                  )}
                  <span className={!slot.available ? 'line-through text-slate-700' : ''}>{slot.time}</span>
                  {!slot.available && (
                    <span className="text-[9px] text-slate-700 font-normal no-underline">Booked</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-3 border-t border-white/8">
        {[
          { label: 'Selected', cls: `bg-gradient-to-br ${accentGradient}` },
          { label: 'Available', cls: 'bg-white/10' },
          { label: 'Booked', cls: 'bg-white/3 border border-white/8' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${cls}`} />
            <span className="text-[10px] text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};