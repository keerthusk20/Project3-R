import React from 'react';
import { Briefcase } from 'lucide-react';
import { UserProfile } from '../../types';

interface PlaceholderProps { user: UserProfile; title: string; icon: any; }

const PlaceholderPage: React.FC<PlaceholderProps> = ({ user, title, icon: Icon }) => (
  <div className="p-6 md:p-10 animate-fade-in relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen flex flex-col items-center justify-center">
    <Icon size={64} className="text-cyan-400 mb-6 opacity-80" />
    <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight text-center mb-4">
      {title}
    </h1>
    <p className="text-muted-foreground text-center max-w-md">
      This module is clearly separated as per your architecture request. You can expand it with tables, forms, and charts anytime.
    </p>
  </div>
);

export const ServiceManagement: React.FC<{user: UserProfile}> = ({ user }) => <PlaceholderPage user={user} title="Service Management" icon={Briefcase} />;
