// src/components/consultation/consultationService.ts

export interface TimeSlot {
  id: string | number;
  time: string;
  available: boolean;
  period?: 'Morning' | 'Afternoon' | 'Evening';
}

export const getAvailableSlots = async (date: string, expertType: string): Promise<TimeSlot[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: '1', time: '09:00 AM', available: true,  period: 'Morning'   },
        { id: '2', time: '10:00 AM', available: false, period: 'Morning'   },
        { id: '3', time: '11:00 AM', available: true,  period: 'Morning'   },
        { id: '4', time: '01:00 PM', available: true,  period: 'Afternoon' },
        { id: '5', time: '02:00 PM', available: false, period: 'Afternoon' },
        { id: '6', time: '03:00 PM', available: true,  period: 'Afternoon' },
        { id: '7', time: '04:00 PM', available: true,  period: 'Afternoon' },
      ]);
    }, 500);
  });
};