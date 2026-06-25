import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Briefcase,
  FileText,
  Calendar,
  MessageSquare,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ClipboardList,
  Headset,
  Ticket,
  FileCheck,
  Workflow,
  Zap,
  UserCheck,
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  userRole: UserRole;
  onLogout: () => void;
  isOpen: boolean;
  onClose?: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  assignedTasksCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  userRole,
  onLogout,
  isOpen,
  onClose,
  isCollapsed,
  toggleCollapse,
  assignedTasksCount = 0,
}) => {
  const location = useLocation();

  const BrandLogo = () => (
    <>
      <div className="relative shrink-0">
        <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full group-hover:bg-cyan-500/30 transition-all" />
        <img
          src="/roundmasa.webp"
          alt="RegiBIZ Logo"
          className="w-10 h-20 rounded-lg object-contain relative z-10 group-hover:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      <div className="flex flex-col overflow-hidden">
        <div className="flex items-baseline">
          <span className="text-xl font-extrabold text-orange-500 tracking-tight drop-shadow-sm leading-none">
            Regi
          </span>
          <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 tracking-tight drop-shadow-sm leading-none">
            BIZ
          </span>
        </div>
        <div className="flex items-center gap-0.5 ml-7">
          <span className="text-[9px] font-bold tracking-wider text-gray-200">by</span>
          <span className="text-[14px] font-extrabold tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Cloud</span>
            <span className="text-orange-500 ml-0.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">MaSa</span>
          </span>
        </div>
      </div>
    </>
  );

  const navItems = [
    // ── Dashboard (Customer, Admin, Superadmin) ──
    {
      label: 'Dashboard',
      path: '/',
      icon: <Home size={18} />,
      allowed: [UserRole.CUSTOMER, UserRole.EXPERT, UserRole.ADMIN, UserRole.SUPERADMIN],
    },
    // ── Support Overview (Support only) ──
    {
      label: 'Support Overview',
      path: '/support',
      icon: <Headset size={18} />,
      allowed: [UserRole.SUPPORT],
    },
    // ── Services ──
    {
      label: 'Services',
      path: '/services',
      icon: <Briefcase size={18} />,
      allowed: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.CUSTOMER],
    },
    // ── Documents ──
    {
      label: 'Documents',
      path: '/documents',
      icon: <FileText size={18} />,
      allowed: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPPORT, UserRole.CUSTOMER, UserRole.EXPERT],
    },
    // ── Schedule ──
    {
      label: 'Schedule',
      path: '/calendar',
      icon: <Calendar size={18} />,
      allowed: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPPORT, UserRole.CUSTOMER],
    },

    // ── FIX: CUSTOMER sees "Book Consultation" → /consult (renders BookConsultation) ──
    {
      label: 'Book Consultation',
      path: '/consult',
      icon: <MessageSquare size={18} />,
      allowed: [UserRole.CUSTOMER],
    },
    {
      label: 'My Consultations',
      path: '/consult',
      icon: <MessageSquare size={18} />,
      allowed: [UserRole.EXPERT],
    },
    // ── FIX: STAFF/ADMIN sees "Consultation Mgmt" → /consultation-management ──
    {
      label: 'Consult Management',
      path: '/consultation-management',
      icon: <MessageSquare size={18} />,
      allowed: [UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPERADMIN],
    },
    {
      label: 'Expert Approvals',
      path: '/expert-approvals',
      icon: <UserCheck size={18} />,
      allowed: [UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPERADMIN],
    },

    // ── User Management ──
    {
      label: 'User Management',
      path: '/admin',
      icon: <ShieldCheck size={18} />,
      allowed: [UserRole.SUPERADMIN, UserRole.ADMIN],
    },
    // ── Task Board ──
    {
      label: 'Task Board',
      path: '/tasks',
      icon: <ClipboardList size={18} />,
      allowed: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPPORT],
    },
    // ── Tickets ──
    {
      label: 'Tickets',
      path: '/tickets',
      icon: <Ticket size={18} />,
      allowed: [UserRole.CUSTOMER, UserRole.EXPERT, UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPERADMIN],
    },
    // ── Document Checking ──
    {
      label: 'Document Checking',
      path: '/document-checking',
      icon: <FileCheck size={18} />,
      allowed: [UserRole.SUPPORT],
    },
    // ── Workflows ──
    {
      label: 'Workflows',
      path: '/workflows',
      icon: <Workflow size={18} />,
      allowed: [UserRole.SUPPORT],
    },
  ];

  const filteredNavItems = navItems.filter((item) => item.allowed.includes(userRole));

  const isActive = (path: string) => {
    const currentPath = location.pathname;
    if (userRole === UserRole.SUPPORT && path === '/support') {
      return currentPath === '/support' || currentPath === '/';
    }
    if (path === '/services') {
      return currentPath === '/services' || currentPath.startsWith('/services/');
    }
    return currentPath === path;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[50] transition-opacity duration-500 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed top-0 left-0 h-full md:top-4 md:left-4 md:h-[calc(100vh-2rem)] bg-card border-r md:border border-border flex flex-col z-[60] transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${isCollapsed ? 'w-20' : 'w-72'}
          backdrop-blur-xl md:rounded-[2.5rem] shadow-2xl
        `}
      >
        {/* Decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-40" />

        {/* Logo */}
        <div className="h-24 flex items-center transition-all duration-500 px-6 relative z-10">
          <div
            className={`group flex items-center w-full transition-all duration-500 ${isCollapsed ? 'justify-center' : 'gap-4'
              }`}
          >
            {isCollapsed ? (
              <div className="relative shrink-0 group">
                <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full group-hover:bg-cyan-500/30 transition-all" />
                <img
                  src="/roundmasa.webp"
                  alt="RegiBIZ Logo"
                  className="w-10 h-20 rounded-lg object-contain relative z-10 group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <BrandLogo />
            )}

            {/* Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              className={`hidden md:flex ml-auto w-8 h-8 items-center justify-center rounded-xl bg-secondary/70 border border-border text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 ${isCollapsed
                  ? 'rotate-180 absolute -right-4 top-1/2 -translate-y-1/2 bg-card border-border z-50 shadow-xl'
                  : ''
                }`}
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="px-6 mb-4">
            <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-4 space-y-1.5 overflow-y-auto no-scrollbar relative z-10">
          {!isCollapsed && (
            <p className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-4 mt-2">
              Management
            </p>
          )}

          {filteredNavItems.map((item) => {
            const isTaskBoard = item.path === '/tasks';
            const showBadge = isTaskBoard && assignedTasksCount > 0;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`sidebar-nav-item ${active ? 'sidebar-nav-item-active' : ''} flex items-center gap-4 px-4 py-3.5 rounded-[1.25rem] text-sm font-black transition-all group relative overflow-hidden
                  ${active
                    ? 'bg-gradient-to-r from-teal-700 via-cyan-800 to-blue-900 text-white shadow-[0_16px_36px_-20px_rgba(21,94,117,0.95)] border border-cyan-800/70'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border hover:border-[#007f8a]/45'
                  }
                  ${isCollapsed ? 'justify-center px-0' : ''}
                `}
              >
                {active && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/8 to-transparent pointer-events-none" />
                )}

                <span
                  className={`sidebar-active-icon relative z-10 shrink-0 transition-all duration-300 ${active
                      ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]'
                      : 'text-muted-foreground group-hover:text-[#007f8a]'
                    }`}
                >
                  {React.cloneElement(item.icon as React.ReactElement, {
                    size: 20,
                    strokeWidth: active ? 2.5 : 2,
                  })}
                </span>

                {!isCollapsed && (
                  <span
                    className={`sidebar-active-label relative z-10 truncate tracking-tight transition-colors ${active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                  >
                    {item.label}
                  </span>
                )}

                {showBadge && (
                  <span
                    className={`absolute flex h-2 w-2 ${isCollapsed ? 'top-3 right-3' : 'right-4 top-1/2 -translate-y-1/2'
                      }`}
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  </span>
                )}

                {!isCollapsed && active && (
                  <div className="sidebar-active-dot relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                )}

                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-2 bg-card text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 border border-border shadow-2xl translate-x-[-10px] group-hover:translate-x-0">
                    {item.label}
                    {showBadge && (
                      <span className="ml-2 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/40 relative z-10">
          <button
            onClick={onLogout}
            className={`flex items-center gap-4 w-full px-4 py-3.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/5 rounded-2xl transition-all text-sm font-black group relative ${isCollapsed ? 'justify-center px-0' : ''
              }`}
          >
            <div className="shrink-0 transition-transform duration-300 group-hover:scale-110">
              <LogOut size={20} strokeWidth={2} />
            </div>

            {!isCollapsed && (
              <span className="uppercase tracking-widest text-[11px]">Secure Exit</span>
            )}

            {isCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-2xl translate-x-[-10px] group-hover:translate-x-0">
                Logout System
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;