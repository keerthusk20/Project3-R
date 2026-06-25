import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarGridProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  accentGradient?: string; // e.g. "from-amber-500 to-orange-500"
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  selectedDate,
  onSelectDate,
  accentGradient = 'from-amber-500 to-orange-500',
}) => {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const isDisabled = (day: number) => {
    const d = new Date(year, month, day);
    return d < today || d.getDay() === 0; // no past, no Sundays
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const isToday = (day: number) => {
    const t = new Date();
    return t.getDate() === day && t.getMonth() === month && t.getFullYear() === year;
  };

  return (
    <div className="bg-white/3 rounded-2xl border border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <ChevronLeft size={16} />
        </button>
        <h4 className="text-white font-black text-sm">{MONTHS[month]} {year}</h4>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className={`text-center text-[10px] font-bold py-1 uppercase tracking-wide ${d === 'Sun' ? 'text-red-600/50' : 'text-slate-600'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const disabled = isDisabled(day);
          const selected = isSelected(day);
          const todayDay = isToday(day);

          return (
            <button
              key={day}
              disabled={disabled}
              onClick={() => !disabled && onSelectDate(new Date(year, month, day))}
              className={`aspect-square rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center
                ${disabled ? 'text-white/10 cursor-not-allowed' : 'cursor-pointer'}
                ${selected
                  ? `bg-gradient-to-br ${accentGradient} text-white shadow-lg scale-105`
                  : todayDay && !disabled
                  ? 'border border-white/20 text-white/80 hover:bg-white/8'
                  : !disabled ? 'text-slate-300 hover:bg-white/8 hover:text-white' : ''}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};