import React from 'react';
import { FileText } from 'lucide-react';
import { UserProfile } from '../../types';

export const ApplicationManagement: React.FC<{user: UserProfile}> = ({ user }) => (
  <div className="p-6 md:p-10 animate-fade-in relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen flex flex-col items-center justify-center">
    <FileText size={64} className="text-cyan-400 mb-6 opacity-80" />
    <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight text-center mb-4">Application Management</h1>
    <p className="text-muted-foreground text-center max-w-md">Manage all customer applications, filter by service type, assign to staff.</p>
  </div>
);
