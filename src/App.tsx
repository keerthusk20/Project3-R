import React, { useState, useEffect } from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';

// --- Icons ---
import {
  Menu, Search, CheckCircle, X, Moon, Sun,
} from 'lucide-react';

// --- Pages ---
import Auth from './pages/Auth';
import AcceptInvite from './pages/AcceptInvite';
import EmailVerificationPage from './pages/EmailVerificationPage';
import ServiceHub from './pages/ServiceHub';
import Documents from './pages/Documents';
import AdminPanel from './pages/AdminPanel';
import Schedule from './pages/Schedule';
import StaffDashboard from './pages/StaffDashboard';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SignaturePad from './pages/SignaturePad';
import TaskBoard from './pages/TaskBoard';
import SupportDashboard from './pages/SupportDashboard';
import LandingPage from './pages/LandingPage';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
// import GoogleReviewsPage from './pages/GoogleReviewsPage';
import Support from './pages/Support';
import TicketsPage from './pages/TicketsPage';
import MyServices from './pages/MyServices';
import FAQs from './pages/FAQs';
import Help from './pages/Help';
import MySubscriptions from './pages/MySubscriptions';
import CustomerDashboard from './pages/CustomerDashboard';
import ProfilePage from './pages/ProfilePage';
import DocumentChecking from './pages/DocumentChecking';
import Workflows from './pages/Workflows';
import ServiceRequirementConfirmation from './pages/ServiceRequirementConfirmation';
import WhatsAppFloat from './components/WhatsAppFloat';
import ExpertRegistration from './pages/Expertregistration';
// @ts-ignore
import ExpertDashboard from './pages/ExpertDashboard';
// @ts-ignore
import ExpertApprovalPanel from './pages/ExpertApprovalPanel';
// --- NEW: Consultation System Pages ---
import BookConsultation from './pages/BookConsultation';
import ConsultationManagement from './pages/ConsultationManagement';
import Consultation from './pages/Consultation';

// --- Service Panels ---
import FssaiLicenseServicePanel from './servicepanel/fssai-license';
import GstRegistrationLanding from './servicepanel/gst-registration';
import MsmeRegistrationLanding from './servicepanel/msme-registration';
import TrademarkRegistration from './servicepanel/trademark-registration';
import StartupIndiaRegistration from './servicepanel/StartupIndia-registration';
import PanRegistrationLanding from './servicepanel/pan-registration';
import TradeLicenseServicePanel from './servicepanel/TradeLicenseServicePanel';
import DSCRegistration from './servicepanel/dsc-registration';
import CompanyRegistrationLanding from './servicepanel/company-registartion';
import ADT1Filing from './servicepanel/adt-1-filing';
import DIR3KYCFiling from './servicepanel/dir-3-kyc-filing';
import INC20AFiling from './servicepanel/inc-20a-filing';
import INC22AFiling from './servicepanel/inc-22a-filing';
import MGT7Filing from './servicepanel/mgt-7-filing';
import ROCPackageFiling from './servicepanel/roc-package-filing';
import ROCPackageSelection from './pages/ROCPackageSelection';
import A0C4Filing from './servicepanel/a0c4-filing';
import ROCComplianceLanding from './servicepanel/roc-compliance';
import ShopEstablishmentLicense from './servicepanel/shop-establishment-licence';

// --- Service Forms ---
import ADT1Form from './services/adtform';
import INC20AForm from './services/inc20aform';
import DIR3KYCForm from './services/dir-3-kycform';
import ROCPackageForm from './services/roc-packageform';
import RocStandardPackage from './services/roc-standard-package';
import RocPremiumPackage from './services/roc-premium-package';
import FssaiLicenseForm from './services/fssai-license-form';
import GstRegistrationForm from './services/gst/gst-registration-router';
import MsmeRegistrationForm from './services/msme-registration-form';
import TrademarkRegistrationForm from './services/trademark-registration-form';
import StartupIndiaRegistrationForm from './services/startup-india-form';
import PanRegistrationForm from './services/pan-registration-form';
import TradeLicenseForm from './services/TradeLicenseForm';
import DSCRegistrationForm from './services/dsc-registration-form';
import CompanyRegistrationForm from './services/company-registration/company-registration-form';
import INC22AForm from './services/inc22a-form';
import A0C4Form from './services/a0c4-form';
import MGT7Form from './services/mgt7-form';
import ShopEstablishmentLicenseForm from './services/shop-establishment-licence-form';

// --- Public Services ---
import GstRegistrationPublic from './landing_page_services/GstRegistration';
import PanRegistrationPublic from './landing_page_services/PanRegistration';
import MsmeRegistrationPublic from './landing_page_services/MsmeRegistration';
import FssaiLicensePublic from './landing_page_services/FssaiLicense';

// --- UI Components ---
import Sidebar from './components/Sidebar';
import AccountDropdown from './components/AccountDropdown';
import NotificationDropdown from './components/NotificationDropdown';
import ProfileReminder from './components/ProfileReminder';

// --- Services & Types ---
import { mockAuthService, mockDbService } from './services/mockFirebase';
import { UserProfile, UserRole } from './types';
import { canViewAdminPanel } from './utils/helpers';
import { shouldShowProfileBanner } from './utils/bannerUtils';
import ProtectedRoute from './components/ProtectedRoute';
import { NotificationProvider } from './context/NotificationContext';

// ============================================================================
// SCROLL RESTORATION
// ============================================================================
type AppTheme = 'dark' | 'light';

const scrollManagedContainers = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-app-scroll-container], [data-page-scroll-container]'));

const scrollManagedContainersToTop = (behavior: ScrollBehavior = 'auto') => {
  scrollManagedContainers().forEach((container) => {
    container.scrollTo({ top: 0, left: 0, behavior });
  });
};

function ScrollRestoration() {
  const location = useLocation();

  useEffect(() => {
    const originalScrollTo = window.scrollTo.bind(window);

    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      originalScrollTo(...args);

      const firstArg = args[0];
      const behavior =
        firstArg && typeof firstArg === 'object'
          ? (firstArg as ScrollToOptions).behavior ?? 'auto'
          : 'auto';
      const requestedTop =
        firstArg && typeof firstArg === 'object'
          ? (firstArg as ScrollToOptions).top ?? 0
          : args[1] ?? 0;

      if (requestedTop !== 0) {
        return;
      }

      scrollManagedContainersToTop(behavior);
    }) as typeof window.scrollTo;

    return () => {
      window.scrollTo = originalScrollTo;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => scrollManagedContainersToTop('auto'));
  }, [location.pathname, location.search]);

  return null;
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================
const Header: React.FC<{
  user: UserProfile;
  toggleSidebar: () => void;
  isCollapsed: boolean;
  openProfile: () => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  isProfileIncomplete?: boolean;
  onDropdownToggle?: (v: boolean) => void;
}> = ({ user, toggleSidebar, isCollapsed, openProfile, theme, onToggleTheme, isProfileIncomplete, onDropdownToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await mockAuthService.logout();
    navigate('/');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return user.role === UserRole.CUSTOMER ? 'Dashboard Overview' : (user.role === UserRole.EXPERT ? 'Expert Dashboard' : (user.role === UserRole.SUPPORT ? 'Support Desk' : 'Staff Dashboard'));
    if (path === '/services') return 'Service Hub';
    if (path === '/documents') return 'My Documents';
    if (path === '/tasks') return 'Task Board';
    if (path === '/tickets') return 'Support Tickets';
    if (path === '/document-checking') return 'Document Verification';
    if (path === '/consult') return user.role === UserRole.EXPERT ? 'My Consultations' : 'Book Consultation';
    if (path === '/book-consultation') return 'Book Consultation';
    if (path === '/consultation-management') return 'Consultation Management';
    return '';
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/90 backdrop-blur-md border-b border-border px-3 sm:px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        <button
          onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
          className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-lg md:text-xl font-black text-gradient-heading truncate tracking-tight">
          {getPageTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden sm:flex items-center bg-secondary/50 border border-border rounded-xl px-4 py-2 w-48 lg:w-72 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5 transition-all group">
          <Search size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors mr-2" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none text-xs text-foreground focus:outline-none w-full placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            type="button"
            onClick={onToggleTheme}
            className="h-10 w-10 rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-all flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <NotificationDropdown user={user} onToggle={onDropdownToggle} />
          <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block" />
          <AccountDropdown
            user={user}
            onLogout={handleLogout}
            onOpenProfile={openProfile}
            onPhotoUpdate={() => { }}
            isProfileIncomplete={isProfileIncomplete}
            onToggle={onDropdownToggle}
          />
        </div>
      </div>
    </header>
  );
};

// ============================================================================
// AUTHENTICATED LAYOUT COMPONENT
// ============================================================================
interface AuthenticatedLayoutProps {
  user: UserProfile;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  myTaskCount: number;
  isProfileIncomplete: boolean;
  isPhotoMissing: boolean;
  handlePhotoUpdated: (url: string) => void;
  toastMsg: string | null;
  setToastMsg: (v: string | null) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
}

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  user,
  sidebarOpen,
  setSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  myTaskCount,
  isProfileIncomplete,
  isPhotoMissing,
  handlePhotoUpdated,
  toastMsg,
  setToastMsg,
  theme,
  onToggleTheme,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);

  // Prevent stale blur state when navigating from dropdown actions
  // (e.g., open profile -> save -> redirect back to dashboard).
  useEffect(() => {
    setIsHeaderBlurred(false);
  }, [location.pathname]);

  useEffect(() => {
    const redirectPath = sessionStorage.getItem('postLoginRedirect');

    if (redirectPath && redirectPath.startsWith('/services/')) {
      sessionStorage.removeItem('postLoginRedirect');
      navigate(redirectPath, { replace: true });
    }
  }, [navigate]);

  const showProfileBanner =
    (isProfileIncomplete || isPhotoMissing) &&
    shouldShowProfileBanner(user.role, location.pathname);

  return (
    <div className={`flex h-dvh min-h-0 overflow-hidden bg-transparent text-foreground font-sans selection:bg-cyan-500/30 ${isHeaderBlurred ? 'overflow-hidden' : ''}`}>
      <Sidebar
        userRole={user.role}
        onLogout={() => mockAuthService.logout()}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        assignedTasksCount={myTaskCount}
      />

      <div className={`flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300 
        ${isSidebarCollapsed ? 'md:ml-[6.5rem]' : 'md:ml-[20rem]'} 
        md:mt-4 md:mr-4 md:mb-4 md:rounded-[2.5rem] md:border border-border
        bg-background/70 backdrop-blur-sm overflow-hidden shadow-2xl mb-0 relative z-10`}>

        <Header
          user={user}
          toggleSidebar={() => setSidebarOpen(true)}
          isCollapsed={isSidebarCollapsed}
          openProfile={() => navigate('/profile')}
          theme={theme}
          onToggleTheme={onToggleTheme}
          isProfileIncomplete={isProfileIncomplete}
          onDropdownToggle={setIsHeaderBlurred}
        />

        <div className={`flex-1 flex flex-col min-h-0 transition-all duration-500 ${isHeaderBlurred ? 'blur-xl grayscale-[0.2] opacity-40 scale-[0.98] pointer-events-none' : ''}`}>
          {showProfileBanner && (
            <ProfileReminder
              isProfileIncomplete={isProfileIncomplete}
              isPhotoMissing={isPhotoMissing}
              onOpenProfile={() => navigate('/profile')}
              onDismiss={() => { }}
            />
          )}

          <main data-app-scroll-container className="flex-1 min-h-0 overflow-y-auto scroll-smooth relative bg-background">
            <Routes>
              {/* ── Root redirect by role ── */}
              <Route
                path="/"
                element={
                  user.role === UserRole.CUSTOMER ? (
                    <CustomerDashboard
                      user={user}
                      isProfileIncomplete={isProfileIncomplete}
                      openProfile={() => navigate('/profile')}
                    />
                  ) : user.role === UserRole.EXPERT ? (
                    <ExpertDashboard user={user} />
                  ) : user.role === UserRole.SUPPORT ? (
                    <Navigate to="/support" replace />
                  ) : user.role === UserRole.SUPERADMIN ? (
                    <SuperAdminDashboard user={user} />
                  ) : (
                    <StaffDashboard user={user} />
                  )
                }
              />

              {/* ── Core pages ── */}
              <Route path="/profile" element={<ProfilePage user={user} onPhotoUpdated={handlePhotoUpdated} />} />
              <Route path="/my-services" element={<MyServices user={user} />} />
              <Route path="/services" element={<ServiceHub user={user} />} />
              <Route path="/documents" element={<Documents user={user} />} />
              <Route path="/calendar" element={<Schedule user={user} />} />
              <Route
                path="/consult"
                element={
                  user.role === UserRole.EXPERT ? (
                    <Consultation user={user} />
                  ) : user.role === UserRole.CUSTOMER ? (
                    <BookConsultation user={user} />
                  ) : (
                    <Navigate to="/consultation-management" replace />
                  )
                }
              />
              <Route path="/staff/customer/:uid" element={<CustomerDetailPage staffUser={user} />} />
              <Route path="/faqs" element={<FAQs />} />
              <Route path="/help" element={<Help />} />
              <Route path="/subscriptions" element={<MySubscriptions />} />
              <Route path="/chat" element={<Support user={user} />} />
              <Route path="/tasks" element={<TaskBoard user={user} />} />

              {/* ── NEW: Consultation system routes ── */}

              {/* Customer: book a consultation */}
              <Route
                path="/book-consultation"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.CUSTOMER]}
                    userRole={user.role}
                  >
                    <BookConsultation user={user} />
                  </ProtectedRoute>
                }
              />

              {/* Support / Admin / Superadmin: manage & assign consultations */}
              <Route
                path="/consultation-management"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPERADMIN]}
                    userRole={user.role}
                  >
                    <ConsultationManagement user={user} />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tickets"
                element={
                  <ProtectedRoute
                    allowedRoles={[UserRole.CUSTOMER, UserRole.EXPERT, UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPERADMIN]}
                    userRole={user.role}
                  >
                    <TicketsPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/document-checking"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.SUPPORT]} userRole={user.role}>
                    <DocumentChecking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workflows"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.SUPPORT]} userRole={user.role}>
                    <Workflows user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/support"
                element={
                  user.role === UserRole.SUPPORT ? (
                    <SupportDashboard user={user} />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />

              {/* ── Service landing pages ── */}
              <Route path="/services/fssai-license" element={<FssaiLicenseServicePanel />} />
              <Route path="/services/gst-registration" element={<GstRegistrationLanding />} />
              <Route path="/services/msme-registration" element={<MsmeRegistrationLanding />} />
              <Route path="/services/trademark-registration" element={<TrademarkRegistration />} />
              <Route path="/services/startup-india" element={<StartupIndiaRegistration />} />
              <Route path="/services/pan-registration" element={<PanRegistrationLanding />} />
              <Route path="/services/trade-license" element={<TradeLicenseServicePanel />} />
              <Route path="/services/dsc-registration" element={<DSCRegistration />} />
              <Route path="/services/company-registration" element={<CompanyRegistrationLanding />} />
              <Route path="/services/company-registration/requirements" element={<ServiceRequirementConfirmation />} />
              <Route path="/services/:serviceSlug/requirements" element={<ServiceRequirementConfirmation />} />
              <Route path="/services/adt-1-filing" element={<ADT1Filing />} />
              <Route path="/services/inc-20a-filing" element={<INC20AFiling />} />
              <Route path="/services/dir-3-kyc-filing" element={<DIR3KYCFiling />} />
              <Route path="/services/roc-compliance" element={<ROCComplianceLanding />} />
              <Route path="/services/mgt-7-filing" element={<MGT7Filing />} />
              <Route path="/services/a0c4-filing" element={<A0C4Filing />} />
              <Route path="/services/roc-selection" element={<ROCPackageSelection />} />
              <Route path="/services/roc-package" element={<ROCPackageFiling />} />
              <Route path="/services/inc-22a-filing" element={<INC22AFiling />} />
              <Route path="/services/shop-establishment-license" element={<ShopEstablishmentLicense />} />

              {/* ── Service forms ── */}
              <Route path="/services/fssai-license/form" element={<FssaiLicenseForm user={user} />} />
              <Route path="/services/gst-registration/form" element={<GstRegistrationForm user={user} />} />
              <Route path="/services/msme-registration/form" element={<MsmeRegistrationForm user={user} />} />
              <Route path="/services/trademark-registration/form" element={<TrademarkRegistrationForm user={user} />} />
              <Route path="/services/startup-india/form" element={<StartupIndiaRegistrationForm user={user} />} />
              <Route path="/services/pan-registration/form" element={<PanRegistrationForm user={user} />} />
              <Route path="/services/trade-license/form" element={<TradeLicenseForm user={user} />} />
              <Route path="/services/dsc-registration/form" element={<DSCRegistrationForm user={user} />} />
              <Route path="/services/company-registration/form" element={<CompanyRegistrationForm user={user} />} />
              <Route path="/services/adt-1-filing/form" element={<ADT1Form user={user} />} />
              <Route path="/services/inc-20a-filing/form" element={<INC20AForm user={user} />} />
              <Route path="/services/dir-3-kyc-filing/form" element={<DIR3KYCForm user={user} />} />
              <Route path="/services/roc-compliance/form" element={<ROCPackageForm user={user} />} />
              <Route path="/services/inc-22a-filing/form" element={<INC22AForm user={user} />} />
              <Route path="/services/mgt-7-filing/form" element={<MGT7Form user={user} />} />
              <Route path="/services/a0c4-filing/form" element={<A0C4Form user={user} />} />
              <Route path="/services/roc-package/form" element={<ROCPackageForm user={user} />} />
              <Route path="/services/roc-standard-package" element={<RocStandardPackage user={user} />} />
              <Route path="/services/roc-premium-package" element={<RocPremiumPackage user={user} />} />
              <Route path="/services/shop-establishment-license/form" element={<ShopEstablishmentLicenseForm user={user} />} />

              {/* ── Admin ── */}
              <Route path="/admin" element={canViewAdminPanel(user.role) ? <AdminPanel user={user} /> : <Navigate to="/" />} />
              <Route
                path="/expert-approvals"
                element={
                  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(user.role)
                    ? <ExpertApprovalPanel user={user} />
                    : <Navigate to="/" />
                }
              />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [myTaskCount, setMyTaskCount] = useState(0);
  const [theme, setTheme] = useState<AppTheme>('dark');

  // Load preferences after mount to avoid SSR hydration mismatches
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme') as AppTheme;
    if (savedTheme) setTheme(savedTheme);
    
    const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    setIsSidebarCollapsed(savedCollapsed);
  }, []);

  const isProfileIncomplete = !!(user && (!user.displayName || !user.phoneNumber));
  const isPhotoMissing = !!(user && !user.photoURL);

  const handlePhotoUpdated = (newPhotoURL: string) => {
    setUser(prev => prev ? { ...prev, photoURL: newPhotoURL } : prev);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const unsubscribe = mockAuthService.subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const fetchCount = async () => {
          const canReadAllDocs = [
            UserRole.SUPERADMIN,
            UserRole.ADMIN,
            UserRole.SUPPORT,
          ].includes(currentUser.role);
          if (!canReadAllDocs) {
            setMyTaskCount(0);
            return;
          }
          try {
            const allApps = await mockDbService.getAllDocuments();
            const count = allApps.filter(
              item => item.doc.assignedTo === currentUser.uid && item.doc.taskStatus !== 'completed'
            ).length;
            setMyTaskCount(count);
          } catch (error) {
            console.error('Error fetching task count', error);
          }
        };
        fetchCount();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (user) {
      try {
        await mockAuthService.updateUserProfile(user.uid, data);
        setUser(prev => prev ? { ...prev, ...data } : prev);
        if (data.photoURL) handlePhotoUpdated(data.photoURL);
        setToastMsg('Profile Updated!');
        setTimeout(() => setToastMsg(null), 3000);
      } catch (error) {
        console.error('Profile update failed:', error);
        setToastMsg('Failed to update profile');
        setTimeout(() => setToastMsg(null), 3000);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-red-500/20" />
      </div>
    );
  }

  return (
    <NotificationProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollRestoration />


      {/* Global Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>



      <Routes>
        <Route path="/register" element={<AcceptInvite />} />
        <Route path="/signature" element={<SignaturePad />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        {/* <Route path="/google-reviews" element={<GoogleReviewsPage />} /> */}

        <Route
          path="*"
          element={
            !user ? (
              <Routes>
                <Route path="/auth" element={<Auth onLogin={setUser} />} />
                <Route path="/expert-registration" element={<ExpertRegistration />} />
                <Route path="/landing_page_service/gst-registration" element={<GstRegistrationPublic />} />
                <Route path="/landing_page_service/pan-registration" element={<PanRegistrationPublic />} />
                <Route path="/landing_page_service/msme-registration" element={<MsmeRegistrationPublic />} />
                <Route path="/landing_page_service/fssai-license" element={<FssaiLicensePublic />} />
                <Route path="*" element={<LandingPage theme={theme} onToggleTheme={handleToggleTheme} />} />
              </Routes>
            ) : (
              <AuthenticatedLayout
                user={user}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                myTaskCount={myTaskCount}
                isProfileIncomplete={isProfileIncomplete}
                isPhotoMissing={isPhotoMissing}
                handlePhotoUpdated={handlePhotoUpdated}
                toastMsg={toastMsg}
                setToastMsg={setToastMsg}
                theme={theme}
                onToggleTheme={handleToggleTheme}
              />
            )
          }
        />
      </Routes>

      <WhatsAppFloat />
      </Router>
    </NotificationProvider>
  );
};

export default App;