import React from 'react';
import { UserProfile } from '../../types';
import SharedDocumentChecking from '../DocumentChecking';

export const DocumentVerification: React.FC<{user: UserProfile}> = ({ user }) => (
  <div className="w-full h-full">
    <SharedDocumentChecking />
  </div>
);
