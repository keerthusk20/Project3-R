import { UserProfile, UserRole } from '../types';

/**
 * Hook to check profile completion and photo status.
 * Only name + phone are required â€” dob/address are optional.
 */
export function useRequireProfile(user: UserProfile | null) {
    if (!user) return { isProfileIncomplete: false, isPhotoMissing: false };

    // Only require display name and phone number
    const hasBasicInfo = !!user.displayName && !!user.phoneNumber;

    // Incomplete = missing basic info only (no address/dob gate)
    const isProfileIncomplete = !hasBasicInfo;

    // Photo check
    const isPhotoMissing = !user.photoURL;

    return { isProfileIncomplete, isPhotoMissing };
}