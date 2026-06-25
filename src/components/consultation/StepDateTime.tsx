import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { ExpertType } from '../../Types/consultation';
import { getAvailableSlots, TimeSlot } from './consultationService';

interface StepDateTimeProps {
  expertType: ExpertType;
  selectedDate: string | null;
  selectedTime: string | null;
  onSelect: (date: string, time: string) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toDateString = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const isPast = (y: number, m: number, d: number) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(y, m, d) < today;
};

const isDisabledDay = (y: number, m: number, d: number) =>
  isPast(y, m, d) || new Date(y, m, d).getDay() === 0; // Sundays off

const isToday = (y: number, m: number, d: number) => {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
};

export const StepDateTime: React.FC<StepDateTimeProps> = ({
  expertType, selectedDate, selectedTime, onSelect,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [localDate, setLocalDate] = useState<string | null>(selectedDate);
  const [localTime, setLocalTime] = useState<string | null>(selectedTime);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const isCA = expertType === 'CA';
  const gradient = isCA ? 'from-amber-500 to-orange-500' : 'from-cyan-500 to-blue-600';
  const selectedBg = isCA ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-cyan-500 to-blue-600';
  const accentText = isCA ? 'text-amber-400' : 'text-cyan-400';
  const accentBorder = isCA ? 'border-amber-500/40' : 'border-cyan-500/40';
  const ringColor = isCA ? 'ring-amber-500/30' : 'ring-cyan-500/30';

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      const result = await getAvailableSlots(date, expertType);
      setSlots(result);
    } finally {
      setLoadingSlots(false);
    }
  }, [expertType]);

  useEffect(() => {
    if (localDate) fetchSlots(localDate);
  }, [localDate, fetchSlots]);

  useEffect(() => {
    if (localDate && localTime) onSelect(localDate, localTime);
  }, [localDate, localTime, onSelect]);

  const handleDateClick = (y: number, m: number, d: number) => {
    if (isDisabledDay(y, m, d)) return;
    setLocalDate(toDateString(y, m, d));
    setLocalTime(null);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const morningSlots = slots.filter(s => {
    const h = parseInt(s.time.split(':')[0]);
    const isPM = s.time.includes('PM');
    const hour24 = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
    return hour24 < 12;
  });
  const afternoonSlots = slots.filter(s => {
    const h = parseInt(s.time.split(':')[0]);
    const isPM = s.time.includes('PM');
    const hour24 = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
    return hour24 >= 12;
  });

  const SlotGroup: React.FC<{ label: string; slotList: TimeSlot[] }> = ({ label, slotList }) => {
    if (slotList.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{label}</p>
        <div className="grid grid-cols-3 gap-2">
          {slotList.map(slot => {
            const isSelected = slot.time === localTime;
            return (
              <button key={slot.id} onClick={() => !slot.available ? null : setLocalTime(slot.time)}
                disabled={!slot.available}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-all duration-150
                  ${!slot.available
                    ? 'bg-white/2 border-white/5 text-slate-700 cursor-not-allowed line-through'
                    : isSelected
                    ? `${selectedBg} border-transparent text-white shadow-lg ring-2 ${ringColor}`
                    : 'bg-white/3 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/20 hover:text-white'}`}>
                {slot.time}
                {!slot.available && <span className="block text-[9px] text-slate-700 mt-0.5 no-underline">Booked</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">

      {/* Calendar */}
      <div className="bg-white/3 rounded-2xl border border-white/10 p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <ChevronLeft size={16} />
          </button>
          <h4 className="text-white font-black text-sm">{MONTHS[viewMonth]} {viewYear}</h4>
          <button onClick={nextMonth}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className={`text-center text-[10px] font-bold py-1 uppercase tracking-wide ${d === 'Sun' ? 'text-red-600/50' : 'text-slate-600'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const dateStr = toDateString(viewYear, viewMonth, day);
            const disabled = isDisabledDay(viewYear, viewMonth, day);
            const selected = dateStr === localDate;
            const todayDay = isToday(viewYear, viewMonth, day);

            return (
              <button key={dateStr} onClick={() => handleDateClick(viewYear, viewMonth, day)} disabled={disabled}
                className={`aspect-square rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center
                  ${disabled ? 'text-white/10 cursor-not-allowed' : 'cursor-pointer'}
                  ${selected
                    ? `${selectedBg} text-white shadow-lg ring-1 ${ringColor} scale-105`
                    : todayDay && !disabled
                    ? `border ${accentBorder} ${accentText} hover:bg-white/8`
                    : !disabled ? 'text-slate-300 hover:bg-white/8 hover:text-white' : ''}`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {localDate && (
        <div className="bg-white/3 rounded-2xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={15} className={accentText} />
              <h4 className="text-white font-black text-sm">
                {new Date(localDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </h4>
            </div>
            {!loadingSlots && (
              <button onClick={() => fetchSlots(localDate)}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                <RefreshCw size={12} />
              </button>
            )}
          </div>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8 gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Checking availability...</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-6">No slots available for this date.</p>
          ) : (
            <div className="space-y-4">
              <SlotGroup label="Morning" slotList={morningSlots} />
              <SlotGroup label="Afternoon" slotList={afternoonSlots} />
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/8">
            {[
              { label: 'Selected', color: selectedBg },
              { label: 'Available', color: 'bg-white/10' },
              { label: 'Booked', color: 'bg-white/3 border border-white/5' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${color}`} />
                <span className="text-[10px] text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {localDate && localTime && (
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${accentBorder} bg-white/3`}>
          <div className={`w-9 h-9 rounded-xl ${selectedBg} flex items-center justify-center shrink-0`}>
            <Calendar size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Selected Slot</p>
            <p className="text-white font-bold text-sm">
              {new Date(localDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {localTime}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};