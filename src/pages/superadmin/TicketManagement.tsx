import React from 'react';
import { UserProfile } from '../../types';
import SharedTicketManagement from '../TicketsPage';

export const TicketManagement: React.FC<{user: UserProfile}> = ({ user }) => (
  <div className="w-full h-full">
    <SharedTicketManagement user={user} />
  </div>
);
