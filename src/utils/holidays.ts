export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national' | 'bank' | 'observance';
}

export const INDIAN_HOLIDAYS: Holiday[] = [
  // 2024
  { date: '2024-01-26', name: 'Republic Day', type: 'national' },
  { date: '2024-03-08', name: 'Maha Shivaratri', type: 'observance' },
  { date: '2024-03-25', name: 'Holi', type: 'observance' },
  { date: '2024-03-29', name: 'Good Friday', type: 'observance' },
  { date: '2024-04-11', name: 'Id-ul-Fitr', type: 'observance' },
  { date: '2024-04-14', name: 'Dr. Ambedkar Jayanti', type: 'observance' },
  { date: '2024-04-21', name: 'Mahavir Jayanti', type: 'observance' },
  { date: '2024-05-23', name: 'Buddha Purnima', type: 'observance' },
  { date: '2024-06-17', name: 'Id-ul-Zuha (Bakrid)', type: 'observance' },
  { date: '2024-07-17', name: 'Muharram', type: 'observance' },
  { date: '2024-08-15', name: 'Independence Day', type: 'national' },
  { date: '2024-08-26', name: 'Janmashtami', type: 'observance' },
  { date: '2024-09-16', name: 'Milad-un-Nabi', type: 'observance' },
  { date: '2024-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2024-10-12', name: 'Dussehra', type: 'observance' },
  { date: '2024-10-31', name: 'Diwali', type: 'observance' },
  { date: '2024-11-15', name: 'Guru Nanak Jayanti', type: 'observance' },
  { date: '2024-12-25', name: 'Christmas', type: 'observance' },
  
  // 2025 (Projected)
  { date: '2025-01-26', name: 'Republic Day', type: 'national' },
  { date: '2025-03-14', name: 'Holi', type: 'observance' },
  { date: '2025-08-15', name: 'Independence Day', type: 'national' },
  { date: '2025-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2025-10-20', name: 'Diwali', type: 'observance' },
  { date: '2025-12-25', name: 'Christmas', type: 'observance' },

  // 2026 (Projected)
  { date: '2026-01-26', name: 'Republic Day', type: 'national' },
  { date: '2026-03-03', name: 'Holi', type: 'observance' },
  { date: '2026-08-15', name: 'Independence Day', type: 'national' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { date: '2026-11-08', name: 'Diwali', type: 'observance' },
  { date: '2026-12-25', name: 'Christmas', type: 'observance' }
];

export const getHolidaysForMonth = (year: number, month: number): Holiday[] => {
  const monthStr = (month + 1).toString().padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  return INDIAN_HOLIDAYS.filter(h => h.date.startsWith(prefix));
};
