import React from 'react';
import { UserProfile } from '../../types';
import SharedConsultationManagement from '../ConsultationManagement';

export const ConsultationManagement: React.FC<{user: UserProfile}> = ({ user }) => (
  <div className="w-full h-full">
    <SharedConsultationManagement user={user} />
  </div>
);
