
import React, { useState, useEffect } from 'react';
import {
  Search, Filter, CheckCircle, X, Clock, AlertCircle, Briefcase,
  FileText, Mail, Phone, Calendar, User, ChevronDown, Download,
  Eye, MessageSquare, TrendingUp, TrendingDown
} from 'lucide-react';
import { mockDbService } from '../services/mockFirebase';
import { auth, storage } from '../services/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import { UserRole, UserProfile } from '../types';

interface ExpertApprovalPanelProps {
  user: UserProfile;
}

const ExpertApprovalPanel: React.FC<ExpertApprovalPanelProps> = ({ user }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const allApps = await mockDbService.getAllExpertApplications();
      setApplications(allApps);
      filterApplications(allApps, selectedTab, searchQuery);

      const statsCalc = {
        total: allApps.length,
        pending: allApps.filter(a => a.status === 'pending').length,
        approved: allApps.filter(a => a.status === 'approved').length,
        rejected: allApps.filter(a => a.status === 'rejected').length
      };
      setStats(statsCalc);
    } catch (e) {
      console.error('Error fetching applications:', e);
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = (apps: any[], tab: string, query: string) => {
    let filtered = apps;
    if (tab !== 'all') {
      filtered = filtered.filter(a => a.status === tab);
    }
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(a =>
        a.fullName?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phoneNumber?.includes(q) ||
        a.userId?.includes(q)
      );
    }
    setFilteredApplications(filtered);
  };

  const handleTabChange = (tab: 'pending' | 'approved' | 'rejected') => {
    setSelectedTab(tab);
    filterApplications(applications, tab, searchQuery);
    setSelectedApplication(null);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    filterApplications(applications, selectedTab, query);
  };

  const handleApprove = async (applicationId: string, userId: string) => {
    setProcessingId(applicationId);
    try {
      const canApprove = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(user.role);

      if (!canApprove) {
        throw new Error('Only a superadmin, admin, or support user can approve experts.');
      }

      const targetUid = userId || applicationId;
      await mockDbService.approveExpertApplication(applicationId, user.uid, targetUid);

      await fetchApplications();
      setSelectedApplication(null);
      alert('Expert approved successfully. The expert profile is now active.');
    } catch (e) {
      console.error('Approval failed:', e);
      alert(e instanceof Error ? e.message : 'Approval failed. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenDocument = async (path: string, name: string) => {
    if (!path) {
      alert(`${name} is not available.`);
      return;
    }

    setDownloadingDoc(path);
    try {
      const url = path.startsWith('http') ? path : await getDownloadURL(ref(storage, path));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('Document download failed:', error);
      const isPermissionError = error?.code === 'storage/unauthorized';
      alert(isPermissionError
        ? 'Storage rules blocked this document. Staff must be allowed to read expert_documents while the application is pending.'
        : `Could not open ${name}. Please try again.`);
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !rejectionReason.trim()) return;

    setProcessingId(selectedApplication.id);
    try {
      await mockDbService.rejectExpertApplication(
        selectedApplication.id,
        user.uid,
        rejectionReason
      );

      await fetchApplications();
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedApplication(null);
    } catch (e) {
      console.error('Rejection failed:', e);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
      case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/30';
      default: return 'bg-secondary text-muted-foreground border-border';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const ApplicationCard: React.FC<{ app: any }> = ({ app }) => (
    <div
      className={`bg-card border rounded-xl p-4 transition-all cursor-pointer hover:border-amber-500/30 ${selectedApplication?.id === app.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-border hover:bg-secondary/50'}`}
      onClick={() => setSelectedApplication(app)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
            {app.fullName?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{app.fullName || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">{app.email || 'N/A'}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(app.status)}`}>
          {app.status}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Briefcase size={12} className="text-muted-foreground" />
          <span>{app.professionalDetails?.professionalType === 'ca' ? 'CA' : 'Advocate'}</span>
        </div>
        <div className="flex items-center gap-2">
          <User size={12} className="text-muted-foreground" />
          <span>{app.professionalDetails?.firmName || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-muted-foreground" />
          <span>{app.professionalDetails?.yearsOfExperience || 0} years experience</span>
        </div>
        {app.professionalDetails?.specializationAreas?.slice(0, 2).map((area: string, i: number) => (
          <span key={i} className="inline-block px-2 py-0.5 rounded bg-secondary text-muted-foreground text-[10px]">
            {area}
          </span>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Applied: {formatDate(app.createdAt)}</span>
        {app.reviewedAt && <span>Reviewed: {formatDate(app.reviewedAt)}</span>}
      </div>
    </div>
  );

  const ApplicationDetail: React.FC<{ app: any }> = ({ app }) => (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Briefcase size={28} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">{app.fullName || 'N/A'}</h2>
            <p className="text-muted-foreground">Expert Application</p>
          </div>
        </div>
        <span className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border ${getStatusColor(app.status)}`}>
          {app.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-4">Personal Information</h3>
          <InfoRow icon={<User size={16} />} label="Full Name" value={app.fullName || 'N/A'} />
          <InfoRow icon={<Mail size={16} />} label="Email" value={app.email || 'N/A'} />
          <InfoRow icon={<Phone size={16} />} label="Primary Phone" value={`+91 ${app.phoneNumber || 'N/A'}`} />
          <InfoRow icon={<Phone size={16} />} label="Secondary Phone" value={`+91 ${app.secondaryPhone || 'N/A'}`} />
        </div>

        {/* Professional Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-4">Professional Details</h3>
          <InfoRow icon={<Briefcase size={16} />} label="Type" value={app.professionalDetails?.professionalType === 'ca' ? 'CA' : 'Advocate'} />
          <InfoRow icon={<Briefcase size={16} />} label="Firm/Chamber" value={app.professionalDetails?.firmName || 'N/A'} />
          <InfoRow icon={<Briefcase size={16} />} label="PAN Number" value={app.professionalDetails?.panNumber || 'N/A'} />
          <InfoRow icon={<Calendar size={16} />} label="Years of Experience" value={`${app.professionalDetails?.yearsOfExperience || 0} years`} />

          {app.professionalDetails?.professionalType === 'ca' && (
            <>
              <InfoRow label="ICAI Membership" value={app.professionalDetails.icaiMembershipNumber || 'N/A'} />
              <InfoRow label="Membership Type" value={app.professionalDetails.membershipType || 'N/A'} />
              <InfoRow label="COP Number" value={app.professionalDetails.copNumber || 'Not provided'} />
            </>
          )}

          {app.professionalDetails?.professionalType === 'lawyer' && (
            <>
              <InfoRow label="Bar Council Number" value={app.professionalDetails.barCouncilNumber || 'N/A'} />
              <InfoRow label="Bar Council State" value={app.professionalDetails.barCouncilState || 'N/A'} />
              <InfoRow label="Enrollment Year" value={app.professionalDetails.enrollmentYear || 'N/A'} />
            </>
          )}
        </div>
      </div>

      {/* Specializations */}
      {app.professionalDetails?.specializationAreas && app.professionalDetails.specializationAreas.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-3">Specialization Areas</h3>
          <div className="flex flex-wrap gap-2">
            {app.professionalDetails.specializationAreas.map((area: string, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-medium">
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="mt-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-3">Uploaded Documents</h3>
        <div className="space-y-2">
          {(app.documents?.professionalCert || app.documents?.professionalCertificate) && (
            <DocumentRow name={`Certificate: ${app.professionalDetails?.professionalType === 'ca' ? 'ICAI Membership' : 'Bar Council'}`} path={app.documents.professionalCert || app.documents.professionalCertificate} />
          )}
          {app.documents?.panCard && <DocumentRow name="PAN Card" path={app.documents.panCard} />}
          {app.documents?.dscFile && <DocumentRow name="Digital Signature Certificate (DSC)" path={app.documents.dscFile} />}
          {app.documents?.cancelledCheque && <DocumentRow name="Cancelled Cheque" path={app.documents.cancelledCheque} />}
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-3">Timeline</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span>Application submitted: {formatDate(app.createdAt)}</span>
          </div>
          {app.reviewedAt && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${app.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span>{app.status === 'approved' ? 'Approved' : 'Rejected'}: {formatDate(app.reviewedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rejection Reason */}
      {app.rejectionReason && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-500 font-bold mb-1">Rejection Reason:</p>
          <p className="text-sm text-red-500/80">{app.rejectionReason}</p>
        </div>
      )}

      {/* Action Buttons */}
      {app.status === 'pending' && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => handleApprove(app.id, app.uid)}
            disabled={!!processingId}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {processingId === app.id ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Approving...</>
            ) : (
              <><CheckCircle size={18} /> Approve Expert</>
            )}
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={!!processingId}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
          >
            {processingId === app.id ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
            ) : (
              <><X size={18} /> Reject</>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const InfoRow: React.FC<{ icon?: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-xs text-muted-foreground min-w-[100px]">{label}:</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );

  const DocumentRow: React.FC<{ name: string; path: string }> = ({ name, path }) => (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-border">
      <FileText size={14} className="text-muted-foreground" />
      <span className="text-xs text-foreground flex-1 truncate">{name}</span>
      <button
        type="button"
        onClick={() => handleOpenDocument(path, name)}
        disabled={downloadingDoc === path}
        className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
        title="Open document"
      >
        {downloadingDoc === path ? (
          <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
        ) : (
          <Download size={14} className="text-muted-foreground" />
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight mb-1">Expert Approval Panel</h1>
              <p className="text-muted-foreground text-sm">Review and manage expert registration requests</p>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-4">
              <div className="bg-card border border-border rounded-xl px-4 py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Pending</span>
                <p className="text-2xl font-black text-amber-500">{stats.pending}</p>
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Approved</span>
                <p className="text-2xl font-black text-emerald-500">{stats.approved}</p>
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Rejected</span>
                <p className="text-2xl font-black text-red-500">{stats.rejected}</p>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search experts..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-xl">
              <button
                onClick={() => handleTabChange('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedTab === 'pending' ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => handleTabChange('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedTab === 'approved' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Approved ({stats.approved})
              </button>
              <button
                onClick={() => handleTabChange('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedTab === 'rejected' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Rejected ({stats.rejected})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Application List */}
            <div className="xl:col-span-1 space-y-4">
              {filteredApplications.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-2xl">
                  <Briefcase size={32} className="text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No applications found</p>
                </div>
              ) : (
                filteredApplications.map(app => <ApplicationCard key={app.id} app={app} />)
              )}
            </div>

            {/* Application Detail */}
            <div className="xl:col-span-2">
              {selectedApplication ? (
                <ApplicationDetail app={selectedApplication} />
              ) : (
                <div className="h-full min-h-[300px] bg-card border border-border rounded-2xl flex items-center justify-center">
                  <p className="text-muted-foreground">Select an application to review</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-black text-foreground mb-4">Reject Application</h3>
            <p className="text-muted-foreground mb-4">Are you sure you want to reject this expert application? Please provide a reason:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500/50 transition-all min-h-[100px] resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="flex-1 py-3 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpertApprovalPanel;