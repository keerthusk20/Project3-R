// src/components/consultation/AdminConsultationPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin panel for managing consultations:
// - View all bookings with filters
// - Assign experts to bookings
// - Mark completed / cancel
// - Resolve reported issues
// - Add notes
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Search, Filter, Download, UserCog, CheckCircle2, XCircle,
  AlertCircle, ChevronDown, Loader2, Calendar, Clock, User,
  FileText, MessageSquare, Phone, Flag, StickyNote, RefreshCw,
} from 'lucide-react';
import {
  BookingData, ExpertRecord,
  assignExpert, markBookingCompleted, cancelBooking,
  resolveIssue, addAdminNote, sendEmailNotification, emailTemplates,
  fetchExperts,
} from '../../services/consultationService';
import { auth } from '../../services/firebase';
import { ExpertType } from '../../Types/consultation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminPanelProps {
  bookings: BookingData[];
  loading: boolean;
  onRefresh?: () => void;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    confirmed: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
};

// ─── Assign Expert Modal ──────────────────────────────────────────────────────

const AssignExpertModal: React.FC<{
  booking: BookingData;
  experts: ExpertRecord[];
  onAssign: (expertId: string, expertName: string, scheduledDate: Date) => Promise<void>;
  onClose: () => void;
}> = ({ booking, experts, onAssign, onClose }) => {
  const [selectedExpert, setSelectedExpert] = useState<ExpertRecord | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const relevantExperts = experts.filter(e => e.expertise === booking.consultationType);

  const handleSubmit = async () => {
    if (!selectedExpert || !scheduledDate || !scheduledTime) {
      setError('Please select an expert, date and time.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const date = new Date(`${scheduledDate}T${scheduledTime}`);
      await onAssign(selectedExpert.id, selectedExpert.name, date);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to assign expert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10">
              <UserCog size={18} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-white font-bold">Assign Expert</h3>
              <p className="text-slate-400 text-xs">Case {booking.caseId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Expert Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select {booking.consultationType} Expert
            </label>
            {relevantExperts.length === 0 ? (
              <p className="text-slate-500 text-sm py-3 text-center border border-dashed border-slate-700 rounded-xl">
                No {booking.consultationType} experts found in the database.
              </p>
            ) : (
              <div className="space-y-2">
                {relevantExperts.map(expert => (
                  <button
                    key={expert.id}
                    onClick={() => setSelectedExpert(expert)}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                      ${selectedExpert?.id === expert.id
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                      }
                    `}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-900 to-slate-800 flex items-center justify-center text-cyan-400 font-bold text-sm border border-slate-700 shrink-0">
                      {expert.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{expert.name}</p>
                      <p className="text-slate-400 text-xs">{expert.experience} · ★ {expert.rating?.toFixed(1)}</p>
                    </div>
                    {selectedExpert?.id === expert.id && (
                      <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Call Date</label>
              <input
                type="date"
                value={scheduledDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl p-3 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Call Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl p-3 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>
          </div>

          {/* Booking context */}
          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <User size={12} className="shrink-0" />
              <span>Client: <span className="text-slate-200 font-medium">{booking.userName}</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar size={12} className="shrink-0" />
              <span>Preferred: <span className="text-slate-200">{booking.date} · {booking.time}</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Phone size={12} className="shrink-0" />
              <span>Phone: <span className="text-slate-200">{booking.userPhone || 'Not provided'}</span></span>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <AlertCircle size={12} />
              {error}
            </p>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedExpert || !scheduledDate || !scheduledTime}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <UserCog size={16} />}
            Assign Expert
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

const BookingDetailModal: React.FC<{
  booking: BookingData;
  experts: ExpertRecord[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ booking, experts, onClose, onRefresh }) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [note, setNote] = useState(booking.notes || '');
  const [savingNote, setSavingNote] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAssign = async (expertId: string, expertName: string, scheduledDate: Date) => {
    await assignExpert(booking.id, expertId, expertName, scheduledDate);
    // Notify customer
    if (booking.userEmail) {
      await sendEmailNotification({
        to: booking.userEmail,
        ...emailTemplates.expertAssigned({ ...booking, assignedExpertName: expertName }),
      });
    }
    onRefresh();
  };

  const handleMarkComplete = async () => {
    setActionLoading('complete');
    try {
      await markBookingCompleted(booking.id);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this booking? This cannot be undone.')) return;
    setActionLoading('cancel');
    try {
      await cancelBooking(booking.id, 'Cancelled by admin');
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveIssue = async (index: number) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setActionLoading(`issue-${index}`);
    try {
      await resolveIssue(booking.id, index, uid, booking.issues || []);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await addAdminNote(booking.id, note);
    } finally {
      setSavingNote(false);
    }
  };

  const openIssues = (booking.issues || []).filter(i => i.status === 'open');

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
        <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-800">
                <FileText size={18} className="text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-bold">{booking.caseId}</h3>
                  <StatusBadge status={booking.status} />
                  {openIssues.length > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                      {openIssues.length} Issue{openIssues.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{booking.consultationType} Consultation</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Client Details */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Client</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-200">{booking.userName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-200 break-all">{booking.userEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-200">{booking.userPhone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-200">{booking.date} · {booking.time}</span>
                </div>
              </div>
            </div>

            {/* Assignment */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expert Assignment</p>
                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    <UserCog size={14} />
                    {booking.assignedTo ? 'Reassign' : 'Assign Expert'}
                  </button>
                )}
              </div>
              {booking.assignedTo ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-900 to-slate-800 flex items-center justify-center text-cyan-400 font-bold border border-slate-700">
                    {(booking.assignedExpertName || 'E').charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{booking.assignedExpertName}</p>
                    {booking.scheduledDate && (
                      <p className="text-slate-400 text-xs mt-0.5">
                        Call scheduled:{' '}
                        {(booking.scheduledDate as any).toDate
                          ? (booking.scheduledDate as any).toDate().toLocaleString('en-IN')
                          : String(booking.scheduledDate)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm py-2">No expert assigned yet.</p>
              )}
            </div>

            {/* Payment */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Payment</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                  <StatusBadge status={booking.paymentStatus} />
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Amount</p>
                  <p className="text-green-400 font-bold">₹{((booking.amount || 0) / 100).toFixed(0)}</p>
                </div>
                {booking.paymentId && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs">Payment ID</p>
                    <p className="text-slate-300 font-mono text-xs break-all">{booking.paymentId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Open Issues */}
            {openIssues.length > 0 && (
              <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-4">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Flag size={12} />
                  Open Issues ({openIssues.length})
                </p>
                <div className="space-y-3">
                  {(booking.issues || []).map((issue, i) => {
                    if (issue.status !== 'open') return null;
                    return (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-slate-200 text-sm">{issue.reason}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            Reported by: {issue.reportedBy.slice(0, 8)}...
                          </p>
                        </div>
                        <button
                          onClick={() => handleResolveIssue(i)}
                          disabled={actionLoading === `issue-${i}`}
                          className="shrink-0 flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                        >
                          {actionLoading === `issue-${i}` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          Resolve
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <StickyNote size={12} />
                Admin Notes
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="Add internal notes about this booking..."
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl p-3 placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 resize-none"
              />
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 transition-colors"
              >
                {savingNote ? <Loader2 size={12} className="animate-spin" /> : null}
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          {booking.status !== 'completed' && booking.status !== 'cancelled' && (
            <div className="p-5 border-t border-slate-800 shrink-0 flex gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={handleMarkComplete}
                disabled={actionLoading === 'complete'}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50"
              >
                {actionLoading === 'complete' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Mark Complete
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 transition-all disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {showAssignModal && (
        <AssignExpertModal
          booking={booking}
          experts={experts}
          onAssign={handleAssign}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </>
  );
};

// ─── Main Admin Panel ─────────────────────────────────────────────────────────

export const AdminConsultationPanel: React.FC<AdminPanelProps> = ({
  bookings,
  loading,
  onRefresh,
}) => {
  const [experts, setExperts] = useState<ExpertRecord[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const ITEMS = 10;

  useEffect(() => {
    fetchExperts().then(setExperts);
  }, []);

  // Filters
  const filtered = bookings.filter(b => {
    if (statusFilter !== 'All' && b.status !== statusFilter) return false;
    if (typeFilter !== 'All' && b.consultationType !== typeFilter) return false;
    if (issuesOnly && !(b.issues || []).some(i => i.status === 'open')) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.caseId?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        b.userName?.toLowerCase().includes(q) ||
        b.userEmail?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS);
  const paginated = filtered.slice((page - 1) * ITEMS, page * ITEMS);
  const openIssuesTotal = bookings.filter(b => (b.issues || []).some(i => i.status === 'open')).length;

  // Export CSV
  const exportCSV = () => {
    const headers = ['Case ID', 'Client', 'Email', 'Type', 'Date', 'Time', 'Status', 'Payment', 'Expert', 'Amount'];
    const rows = filtered.map(b => [
      b.caseId, b.userName, b.userEmail, b.consultationType,
      b.date, b.time, b.status, b.paymentStatus,
      b.assignedExpertName || 'Unassigned',
      `₹${((b.amount || 0) / 100).toFixed(0)}`,
    ].join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: bookings.length, color: 'text-white' },
          { label: 'Pending', value: bookings.filter(b => b.status === 'pending').length, color: 'text-orange-400' },
          { label: 'Confirmed', value: bookings.filter(b => b.status === 'confirmed').length, color: 'text-cyan-400' },
          { label: 'Open Issues', value: openIssuesTotal, color: openIssuesTotal > 0 ? 'text-red-400' : 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700 flex-1 min-w-[180px]">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search case, client..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-slate-300 outline-none placeholder-slate-600 w-full"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-slate-900/80 text-sm text-slate-300 px-3 py-2 rounded-xl border border-slate-700 outline-none cursor-pointer"
        >
          <option value="All">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-slate-900/80 text-sm text-slate-300 px-3 py-2 rounded-xl border border-slate-700 outline-none cursor-pointer"
        >
          <option value="All">All Types</option>
          <option value="CA">CA</option>
          <option value="Lawyer">Lawyer</option>
        </select>

        <button
          onClick={() => { setIssuesOnly(v => !v); setPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            issuesOnly ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flag size={14} />
          {issuesOnly ? 'All' : 'Issues'}
        </button>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <Download size={14} className="text-cyan-500" />
          Export
        </button>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading bookings...</span>
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p>No bookings match your filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Case ID', 'Client', 'Type', 'Date/Time', 'Status', 'Expert', 'Amount', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginated.map(booking => {
                  const hasOpenIssues = (booking.issues || []).some(i => i.status === 'open');
                  return (
                    <tr key={booking.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400 font-mono font-medium">{booking.caseId}</span>
                          {hasOpenIssues && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Open issues" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-200 font-medium">{booking.userName}</p>
                        <p className="text-slate-500 text-xs truncate max-w-[150px]">{booking.userEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${booking.consultationType === 'CA' ? 'bg-orange-500/10 text-orange-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                          {booking.consultationType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        <div>{booking.date}</div>
                        <div className="text-slate-500">{booking.time}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${booking.assignedExpertName ? 'text-slate-200' : 'text-slate-600'}`}>
                          {booking.assignedExpertName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-400 font-semibold text-xs">
                        ₹{((booking.amount || 0) / 100).toFixed(0)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginated.map(booking => {
              const hasOpenIssues = (booking.issues || []).some(i => i.status === 'open');
              return (
                <div key={booking.id} className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-mono font-medium text-sm">{booking.caseId}</span>
                        {hasOpenIssues && <span className="w-2 h-2 rounded-full bg-red-500" />}
                      </div>
                      <p className="text-slate-300 text-sm mt-0.5">{booking.userName}</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                    <span>{booking.consultationType}</span>
                    <span>{booking.date}</span>
                    <span>{booking.time}</span>
                  </div>
                  <button
                    onClick={() => setSelectedBooking(booking)}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                  >
                    Manage Booking
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                ‹
              </button>
              <span className="text-slate-400 text-sm">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          experts={experts}
          onClose={() => setSelectedBooking(null)}
          onRefresh={() => {
            setSelectedBooking(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};