import React from 'react';
import { UserProfile } from '../types';
import { useLocation } from 'react-router-dom';
import RocStandardPackage from './roc-standard-package';
import RocPremiumPackage from './roc-premium-package';

interface ROCPackageFormProps {
  user: UserProfile;
}

export default function ROCPackageForm({ user }: ROCPackageFormProps) {
  const location = useLocation();
  const packageType = location.state?.packageType;

  if (packageType === 'premium') {
    return <RocPremiumPackage user={user} />;
  }

  return <RocStandardPackage user={user} />;
}