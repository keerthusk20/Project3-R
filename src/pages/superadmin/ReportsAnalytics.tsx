import React from 'react';
import { BarChart2 } from 'lucide-react';
import { UserProfile } from '../../types';

export const ReportsAnalytics: React.FC<{user: UserProfile}> = ({ user }) => (
  <div className="p-6 md:p-10 animate-fade-in relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen flex flex-col items-center justify-center">
    <BarChart2 size={64} className="text-purple-400 mb-6 opacity-80" />
    <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 tracking-tight text-center mb-4">Reports & Analytics</h1>
    <p className="text-muted-foreground text-center max-w-md">Export reports, revenue insights, user growth metrics, and service analytics.</p>
  </div>
);
