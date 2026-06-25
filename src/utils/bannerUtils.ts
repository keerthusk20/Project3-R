// src/utils/bannerUtils.ts
// ============================================================================
// PROFILE BANNER VISIBILITY HELPER
// ============================================================================
// Controls when the "Please upload a profile photo" banner is shown.
// Rules:
//   1. Only shown on the main customer dashboard route ("/")
//   2. Only shown for users with the 'customer' role
//   3. Not shown for admin, superadmin, support, expert, etc.

import { UserRole } from '../types';

/**
 * Routes where the profile photo reminder banner is allowed to appear.
 * Currently only the main dashboard.
 */
const BANNER_ALLOWED_ROUTES: string[] = ['/'];

/**
 * Roles for which the profile photo reminder banner should be shown.
 * Only customers see the banner.
 */
const BANNER_ALLOWED_ROLES: UserRole[] = [UserRole.CUSTOMER];

/**
 * Determines whether the "Please upload a profile photo" banner should be shown.
 *
 * @param userRole     - The current user's role (from UserProfile.role)
 * @param currentRoute - The current pathname (from useLocation().pathname)
 * @returns true if the banner should be rendered, false otherwise
 *
 * @example
 *   const show = shouldShowProfileBanner(user.role, location.pathname);
 */
export function shouldShowProfileBanner(
    userRole: UserRole | undefined | null,
    currentRoute: string
): boolean {
    if (!userRole) return false;

    const isAllowedRole = BANNER_ALLOWED_ROLES.includes(userRole);
    const isAllowedRoute = BANNER_ALLOWED_ROUTES.includes(currentRoute);

    return isAllowedRole && isAllowedRoute;
}
