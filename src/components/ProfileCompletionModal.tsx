import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { mockAuthService } from '../services/mockFirebase';
import {
  X, Camera, User, Phone, Save, Loader2,
  AlertCircle, BadgeCheck, Lock, CheckCircle, Info, Edit2,
} from 'lucide-react';

interface ProfileCompletionModalProps {
  user: UserProfile;
  onClose: () => void;
  onPhotoUpdated: (newPhotoURL: string) => void;
  onSaved?: () => void;
  forced?: boolean;
  inline?: boolean;
}

interface AddressObject {
  line1: string;
  line2?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

// ── ModalWrapper defined OUTSIDE component to prevent remount on re-render ──
const ModalWrapper: React.FC<{ children: React.ReactNode; forced: boolean; inline?: boolean }> = ({ children, forced, inline }) => (
  <div
    className={inline
      ? 'relative z-0 flex w-full items-start justify-center'
      : 'fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300 pointer-events-auto'
    }
    onClick={(e) => { if (!inline && forced) e.stopPropagation(); }}
  >
    {children}
  </div>
);

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  user,
  onClose,
  onPhotoUpdated,
  onSaved,
  forced = false,
  inline = false,
}) => {
  const isCustomer = user.role === UserRole.CUSTOMER;
  const isStrictlyLocked = !isCustomer && (user.profileCompleted === true || !!user.phoneNumber);

  const [isViewMode, setIsViewMode] = useState(false);

  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [alternatePhone, setAlternatePhone] = useState(user.alternatePhone || '');
  const [dob, setDob] = useState(user.dob || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(user.gender || 'other');

  const [addressLine1, setAddressLine1] = useState<string>(
    typeof user.address === 'object' ? (user.address as any)?.line1 || '' : ''
  );
  const [addressLine2, setAddressLine2] = useState<string>(
    typeof user.address === 'object' ? (user.address as any)?.line2 || '' : ''
  );
  const [addressDistrict, setAddressDistrict] = useState<string>(
    typeof user.address === 'object' ? (user.address as any)?.district || '' : ''
  );
  const [addressState, setAddressState] = useState<string>(
    typeof user.address === 'object' ? (user.address as any)?.state || '' : ''
  );
  const [addressPincode, setAddressPincode] = useState<string>(
    typeof user.address === 'object' ? (user.address as any)?.pincode || '' : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(user.photoURL || null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (forced) {
      setIsViewMode(isStrictlyLocked);
    } else {
      if (user.profileCompleted === true || (user.phoneNumber && !isCustomer)) {
        setIsViewMode(true);
      } else {
        setIsViewMode(false);
      }
    }
  }, [user.profileCompleted, user.phoneNumber, isCustomer, forced, isStrictlyLocked]);

  const getRoleLabel = (role: UserRole): string => {
    const labels: Record<UserRole, string> = {
      [UserRole.SUPERADMIN]: 'Super Admin',
      [UserRole.ADMIN]: 'Admin',
      [UserRole.SUPPORT]: 'Support Staff',
      [UserRole.CUSTOMER]: 'Customer',
      [UserRole.EXPERT]: 'Expert',
    };
    return labels[role] || 'User';
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isStrictlyLocked) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      setPreviewURL(URL.createObjectURL(file));
      setError(null);
    }
  };

  const buildAddressObject = (): AddressObject => ({
    line1: addressLine1,
    line2: addressLine2,
    city: '',
    district: addressDistrict,
    state: addressState,
    pincode: addressPincode,
  });

  const handleEditClick = () => {
    setIsViewMode(false);
    setError(null);
  };

  const handleCancelClick = () => {
    setDisplayName(user.displayName || '');
    setPhoneNumber(user.phoneNumber || '');
    setAlternatePhone(user.alternatePhone || '');
    setDob(user.dob || '');
    setGender(user.gender || 'other');
    setAddressLine1(typeof user.address === 'object' ? (user.address as any)?.line1 || '' : '');
    setAddressLine2(typeof user.address === 'object' ? (user.address as any)?.line2 || '' : '');
    setAddressDistrict(typeof user.address === 'object' ? (user.address as any)?.district || '' : '');
    setAddressState(typeof user.address === 'object' ? (user.address as any)?.state || '' : '');
    setAddressPincode(typeof user.address === 'object' ? (user.address as any)?.pincode || '' : '');
    setPreviewURL(user.photoURL || null);
    setPhotoFile(null);
    setIsViewMode(true);
    setError(null);
  };

  const handleSave = async () => {
    if (isStrictlyLocked) { onClose(); return; }
    const trimmedName = displayName.trim();
    const cleanedPhone = phoneNumber.replace(/\s/g, '');

    if (!trimmedName) {
      setError('Full Name is required.');
      return;
    }

    if (!/^\d{10}$/.test(cleanedPhone)) {
      setError('Phone Number must be exactly 10 digits.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let newPhotoURL: string | null | undefined = user.photoURL;
      if (photoFile) {
        try {
          newPhotoURL = await mockAuthService.uploadProfilePhoto(user.uid, photoFile);
        } catch (uploadErr: any) {
          setError('Photo upload failed: ' + (uploadErr.message || 'Please try again'));
          setLoading(false);
          return;
        }
      }

      const updateData: Partial<UserProfile> = {
        displayName: trimmedName,
        phoneNumber: cleanedPhone,
        alternatePhone: alternatePhone.trim() ? alternatePhone.replace(/\s/g, '') : '',
        gender,
        profileCompleted: true,
      };

      if (newPhotoURL && newPhotoURL !== user.photoURL) {
        updateData.photoURL = newPhotoURL;
      }

      if (isCustomer) {
        updateData.dob = dob;
        updateData.address = buildAddressObject();
      }

      await mockAuthService.updateUserProfile(user.uid, updateData);

      if (newPhotoURL && newPhotoURL !== user.photoURL) {
        setPreviewURL(newPhotoURL);
        onPhotoUpdated(newPhotoURL);
      }

      if (!forced && onSaved) {
        onSaved();
        return;
      }

      setShowSuccess(true);
      setTimeout(() => {
        setIsViewMode(true);
        setShowSuccess(false);
        onSaved?.();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Block Escape when forced
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && forced) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [forced]);

  // Precomputed stable class strings — avoids new string on every keystroke
  // which would cause React to remount inputs and drop focus
  const BASE = 'w-full bg-background border rounded-xl py-3 pr-4 focus:outline-none transition-all duration-300 font-medium text-foreground placeholder:text-muted-foreground/70';
  const LOCKED = 'border-border text-muted-foreground cursor-not-allowed bg-secondary/70';
  const ACTIVE = 'border-border focus:border-primary focus:ring-4 focus:ring-primary/10 hover:border-primary/50';
  const inputClass = `${BASE} pl-4 ${isStrictlyLocked ? LOCKED : ACTIVE}`;
  const inputClassIcon = `${BASE} pl-10 ${isStrictlyLocked ? LOCKED : ACTIVE}`;
  const hasValidRequiredFields = displayName.trim().length > 0 && /^\d{10}$/.test(phoneNumber.replace(/\s/g, ''));

  // ── Success Screen ──
  if (showSuccess) {
    return (
      <ModalWrapper forced={forced} inline={inline}>
        <div className="bg-background rounded-3xl border border-border w-full max-w-md shadow-2xl p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-teal-500/20 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-700 via-cyan-800 to-blue-900 flex items-center justify-center shadow-lg shadow-cyan-900/50">
              <CheckCircle size={40} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-cyan-500 mb-2">
              Profile Updated!
            </h3>
            <p className="text-muted-foreground mb-8">Your details have been saved successfully.</p>
            <div className="flex justify-center gap-1">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  // ── View Mode ──
  if (isViewMode) {
    return (
      <ModalWrapper forced={forced} inline={inline}>
        <div className="bg-card rounded-3xl border border-border w-full max-w-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[calc(100dvh-8rem)]">
          <div className="h-1 w-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500" />

          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-secondary/45">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-foreground flex flex-wrap items-center gap-2 md:gap-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">
                  Profile Details
                </span>
                <span className="text-[10px] md:text-xs font-semibold px-2 md:px-3 py-0.5 md:py-1 bg-gradient-primary text-cyan-100 rounded-full flex items-center gap-1 border border-cyan-500/30">
                  <BadgeCheck size={12} /> {getRoleLabel(user.role)}
                </span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 truncate">Your profile information</p>
            </div>
            {!forced && (
              <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all flex-shrink-0">
                <X size={20} />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 overflow-y-auto space-y-6 custom-scrollbar">
            {/* Photo */}
            <div className="flex flex-col items-center p-6 border border-border rounded-2xl bg-secondary/45">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 p-[2px] mb-4">
                <div className="w-full h-full rounded-full bg-background overflow-hidden flex items-center justify-center">
                  {previewURL || user.photoURL ? (
                    <img src={previewURL || user.photoURL || undefined} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="text-muted-foreground" />
                  )}
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Profile Photo</p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Full Name</label>
                <div className="bg-background border border-border rounded-xl py-3 px-4 text-foreground">{displayName || 'Not provided'}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</label>
                <div className="bg-background border border-border rounded-xl py-3 px-4 text-foreground">{phoneNumber || 'Not provided'}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email</label>
                <div className="bg-background border border-border rounded-xl py-3 px-4 text-muted-foreground">{user.email}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Gender</label>
                <div className="bg-background border border-border rounded-xl py-3 px-4 text-foreground capitalize">{gender}</div>
              </div>
              {isCustomer && dob && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Date of Birth</label>
                  <div className="bg-background border border-border rounded-xl py-3 px-4 text-foreground font-medium">
                    {new Date(dob).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

            {/* Address */}
            {isCustomer && (
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Address</label>
                <div className="bg-background border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
                  <p>{addressLine1}</p>
                  {addressLine2 && <p>{addressLine2}</p>}
                  <p>{[addressDistrict, addressState, addressPincode].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}

            {!isCustomer && (
              <div className="rounded-xl p-4 flex items-start gap-3 border bg-secondary/50 border-border text-muted-foreground">
                <Lock size={20} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span className="text-sm leading-relaxed">Profile is locked. Contact Super Admin to make changes.</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 border-t border-border bg-secondary/70 flex flex-col sm:flex-row justify-end gap-3">
            {!forced && (
              <button onClick={onClose} className="w-full sm:w-auto px-6 py-2.5 md:py-3 rounded-xl border border-border bg-card text-foreground hover:bg-background font-semibold transition-all text-sm md:text-base">
                Close
              </button>
            )}
            {!isStrictlyLocked && (
              <button onClick={handleEditClick} className="w-full sm:w-auto px-8 py-2.5 md:py-3 rounded-xl bg-gradient-to-r from-teal-700 to-blue-900 text-white font-bold flex items-center justify-center gap-2 hover:from-teal-600 hover:to-blue-800 transition-all text-sm md:text-base">
                <Edit2 size={18} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </ModalWrapper>
    );
  }

  // ── Edit Mode ──
  return (
    <ModalWrapper forced={forced} inline={inline}>
      <div className="bg-card rounded-3xl border border-border w-full max-w-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[calc(100dvh-8rem)]">
        <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-secondary/45">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            {forced ? 'Complete Profile' : 'Edit Profile'}
          </h2>
          {!forced && (
            <button onClick={handleCancelClick} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Cancel profile edit">
              <X size={22} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {error && (
            <div className="bg-red-500/10 border-l-4 border-red-500 text-red-400 px-4 py-3 rounded-r-lg flex items-center gap-3 text-sm shadow-lg">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Photo Upload */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-24 h-24 mb-2 group">
              <div className="w-full h-full rounded-full bg-background overflow-hidden border-2 border-border group-hover:border-primary transition-colors flex items-center justify-center">
                {previewURL ? (
                  <img src={previewURL} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} className="text-muted-foreground" />
                )}
              </div>
              {!isStrictlyLocked && (
                <label className="absolute bottom-0 right-0 p-2 bg-cyan-600 rounded-full cursor-pointer hover:bg-cyan-500 transition-colors shadow-lg">
                  <Camera size={16} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isStrictlyLocked ? 'Photo view only' : 'Click camera icon to upload photo (max 5MB)'}
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  disabled={isStrictlyLocked}
                  className={inputClassIcon}
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Phone Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhoneNumber(val);
                  }}
                  disabled={isStrictlyLocked}
                  className={inputClassIcon}
                  placeholder="Phone Number"
                />
              </div>
              {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                <p className="text-[10px] text-amber-400 px-1">{10 - phoneNumber.length} more digit{10 - phoneNumber.length !== 1 ? 's' : ''} required</p>
              )}
              {phoneNumber.length === 10 && (
                <p className="text-[10px] text-emerald-400 px-1">✓ Valid phone number</p>
              )}
            </div>

            {/* Alternate Phone */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">
                Alternate Phone <span className="text-muted-foreground/80 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={alternatePhone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setAlternatePhone(val);
                  }}
                  disabled={isStrictlyLocked}
                  className={inputClassIcon}
                  placeholder="Alternate Phone"
                />
              </div>
              {alternatePhone.length > 0 && alternatePhone.length < 10 && (
                <p className="text-[10px] text-amber-400 px-1">{10 - alternatePhone.length} more digit{10 - alternatePhone.length !== 1 ? 's' : ''} required</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Gender</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                disabled={isStrictlyLocked}
                className={inputClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Customer-only fields */}
          {isCustomer && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  disabled={isStrictlyLocked}
                  max={new Date().toISOString().split('T')[0]}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Address Details</label>
                <div className="grid gap-3">
                  <input
                    value={addressLine1}
                    onChange={e => setAddressLine1(e.target.value)}
                    disabled={isStrictlyLocked}
                    className={inputClass}
                    placeholder="Address Line 1"
                  />
                  <input
                    value={addressLine2}
                    onChange={e => setAddressLine2(e.target.value)}
                    disabled={isStrictlyLocked}
                    className={inputClass}
                    placeholder="Address Line 2 (Optional)"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={addressDistrict}
                      onChange={e => setAddressDistrict(e.target.value)}
                      disabled={isStrictlyLocked}
                      className={inputClass}
                      placeholder="District"
                    />
                    <input
                      value={addressState}
                      onChange={e => setAddressState(e.target.value)}
                      disabled={isStrictlyLocked}
                      className={inputClass}
                      placeholder="State"
                    />
                  </div>
                  <input
                    value={addressPincode}
                    onChange={e => setAddressPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={isStrictlyLocked}
                    className={inputClass}
                    placeholder="Pincode"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Staff note */}
          {!isCustomer && (
            <div className={`rounded-xl p-4 flex items-start gap-3 border ${isStrictlyLocked
              ? 'bg-secondary/50 border-border text-muted-foreground'
              : 'bg-primary/10 border-primary/20 text-foreground'
            }`}>
              <Info size={20} className="mt-0.5 flex-shrink-0 text-cyan-500" />
              <span className="text-sm leading-relaxed">
                {isStrictlyLocked
                  ? 'Profile locked after initial setup. Only Super Admin can modify these details.'
                  : 'Please complete your profile details. Once submitted, staff profiles are permanently locked.'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-border bg-secondary/70 flex flex-col-reverse sm:flex-row justify-end gap-3">
          {!forced && (
            <button
              onClick={handleCancelClick}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border bg-card text-foreground hover:bg-background font-semibold transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || isStrictlyLocked || !hasValidRequiredFields}
            className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center min-w-[160px] ${
              (isStrictlyLocked || !hasValidRequiredFields)
                ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border shadow-none'
                : 'text-white bg-gradient-to-r from-teal-700 to-blue-900 hover:from-teal-600 hover:to-blue-800 shadow-cyan-900/40'
            }`}
          >
            {loading ? (
              <><Loader2 size={20} className="animate-spin mr-2" /> Saving...</>
            ) : isStrictlyLocked ? (
              <><Lock size={20} className="mr-2" /> Closed</>
            ) : (
              <><Save size={20} className="mr-2" /> {forced ? 'Complete & Continue' : 'Save Changes'}</>
            )}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default ProfileCompletionModal;