// src/pages/DSCAdminPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import {
  collection, query, getDocs, orderBy, doc, updateDoc, where
} from 'firebase/firestore';
import {
  Key, CheckCircle, Clock, AlertTriangle, XCircle,
  Loader2, Search, X, Filter, Save, RefreshCw,
  User, Calendar, Bell, ChevronDown, ChevronUp, ChevronRight,
  FileText, Shield, Edit2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DSCRecord {
  id: string;
  caseId: string;
  dscType: string;
  dscStatus: 'pending' | 'processing' | 'issued' | 'expiring' | 'expired';
  status: string;
  taskStatus: string;
  submittedAt: number;
  dscExpiryDate: string | null;
  dscIssuedDate: string | null;
  dscSerialNumber: string | null;
  notificationSent: boolean;
  userId: string;
  formData: {
    applicantName: string;
    pan: string;
    email: string;
    mobile: string;
    purpose: string;
    entityType: string;
    organisationName?: string;
    dscType: string;
    state: string;
    city: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const dscTypeLabel: Record<string, string> = {
  class3_individual: 'Class 3 Individual',
  class3_organisation: 'Class 3 Organisation',
  dgft: 'DGFT',
};

const DSC_STATUS_OPTIONS = [
  { value: 'pending', label: '⏳ Pending' },
  { value: 'processing', label: '🔄 Processing' },
  { value: 'issued', label: '✅ Issued' },
  { value: 'expiring', label: '⚠️ Expiring Soon' },
  { value: 'expired', label: '❌ Expired' },
];

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    processing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    issued: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    expiring: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return map[status] || 'bg-white/10 text-white border-white/20';
}

// ─── Edit Modal Component ─────────────────────────────────────────────────────

interface EditModalProps {
  record: DSCRecord;
  onClose: () => void;
  onSave: (id: string, updates: Partial<DSCRecord>) => Promise<void>;
}

const EditModal: React.FC<EditModalProps> = ({ record, onClose, onSave }) => {
  const [dscStatus, setDscStatus] = useState(record.dscStatus);
  const [dscIssuedDate, setDscIssuedDate] = useState(record.dscIssuedDate || '');
  const [dscExpiryDate, setDscExpiryDate] = useState(record.dscExpiryDate || '');
  const [dscSerialNumber, setDscSerialNumber] = useState(record.dscSerialNumber || '');
  const [taskStatus, setTaskStatus] = useState(record.taskStatus || 'unassigned');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(record.id, {
        dscStatus,
        dscIssuedDate: dscIssuedDate || null,
        dscExpiryDate: dscExpiryDate || null,
        dscSerialNumber: dscSerialNumber || null,
        taskStatus,
        status: dscStatus === 'issued' ? 'approved' : record.status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-card/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  return (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary rounded-2xl max-w-lg w-full border border-white/10 shadow-2xl">
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold">Update DSC Record</h3>
            <p className="text-xs text-gray-500 mt-0.5">{record.caseId} · {record.formData?.applicantName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>DSC Status</label>
            <select value={dscStatus} onChange={e => setDscStatus(e.target.value as any)}
              className={`${inputCls} appearance-none cursor-pointer`}>
              {DSC_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>DSC Serial Number</label>
            <input value={dscSerialNumber} onChange={e => setDscSerialNumber(e.target.value)}
              placeholder="Enter serial number from CA certificate" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date of Issue</label>
              <input type="date" value={dscIssuedDate} onChange={e => setDscIssuedDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" value={dscExpiryDate} onChange={e => setDscExpiryDate(e.target.value)} className={inputCls} />
              <p className="text-xs text-gray-600 mt-1">Usually 2 years from issue date</p>
            </div>
          </div>
          <div>
            <label className={labelCls}>Task Status</label>
            <select value={taskStatus} onChange={e => setTaskStatus(e.target.value)}
              className={`${inputCls} appearance-none cursor-pointer`}>
              {['unassigned', 'assigned', 'in-progress', 'completed'].map(s => (
                <option key={s} value={s} className="bg-slate-900 capitalize">{s}</option>
              ))}
            </select>
          </div>

          {/* Auto-fill helper */}
          {dscIssuedDate && !dscExpiryDate && (
            <button type="button"
              onClick={() => {
                const d = new Date(dscIssuedDate);
                d.setFullYear(d.getFullYear() + 2);
                setDscExpiryDate(d.toISOString().split('T')[0]);
              }}
              className="text-xs text-orange-400 hover:underline">
              Auto-fill expiry (issued + 2 years)
            </button>
          )}
        </div>
        <div className="p-5 border-t border-white/10 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm hover:bg-white/5">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DSCAdminPanel() {
  const [records, setRecords] = useState<DSCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DSCRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'dsc-applications'), orderBy('submittedAt', 'desc'));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as DSCRecord)));
    } catch (err) {
      console.error('Error fetching DSC records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleUpdate = async (id: string, updates: Partial<DSCRecord>) => {
    await updateDoc(doc(db, 'dsc-applications', id), {
      ...updates,
      updatedAt: Date.now(),
    });
    // Also update user subcollection
    const record = records.find(r => r.id === id);
    if (record?.userId) {
      await updateDoc(doc(db, 'users', record.userId, 'documents', id), {
        dscStatus: updates.dscStatus,
        dscExpiryDate: updates.dscExpiryDate,
        dscIssuedDate: updates.dscIssuedDate,
        status: updates.status,
      });
    }
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const filtered = records.filter(r => {
    if (filterStatus !== 'all' && r.dscStatus !== filterStatus) return false;
    if (filterType !== 'all' && r.dscType !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.formData?.applicantName?.toLowerCase().includes(q) ||
        r.formData?.pan?.toLowerCase().includes(q) ||
        r.caseId?.toLowerCase().includes(q) ||
        r.formData?.email?.toLowerCase().includes(q) ||
        r.formData?.mobile?.includes(q)
      );
    }
    return true;
  });

  const headingGrad = 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent';
  const primaryGrad = 'bg-gradient-to-r from-orange-500 to-red-500';

  const expiringCount = records.filter(r => {
    const d = getDaysUntilExpiry(r.dscExpiryDate);
    return r.dscStatus === 'issued' && d !== null && d <= 30 && d > 0;
  }).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className={`text-3xl font-bold ${headingGrad} mb-2`}>DSC Management</h2>
          <p className="text-gray-400">Track, update, and manage all customer Digital Signature Certificates.</p>
        </div>
        <button onClick={fetchRecords}
          className="px-4 py-2 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total', value: records.length, color: 'text-white' },
          { label: 'Pending', value: records.filter(r => r.dscStatus === 'pending').length, color: 'text-gray-400' },
          { label: 'Processing', value: records.filter(r => r.dscStatus === 'processing').length, color: 'text-cyan-400' },
          { label: 'Active', value: records.filter(r => r.dscStatus === 'issued').length, color: 'text-emerald-400' },
          { label: 'Expiring Soon', value: expiringCount, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card rounded-xl p-4 border border-white/10 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Expiry alert */}
      {expiringCount > 0 && (
        <div className="mb-6 p-4 glass-card border border-amber-500/30 rounded-xl flex items-center gap-3">
          <Bell size={18} className="text-amber-400" />
          <p className="text-sm text-amber-400 font-medium">
            {expiringCount} customer DSC{expiringCount > 1 ? 's' : ''} expiring within 30 days — contact customers to renew.
          </p>
          <button onClick={() => setFilterStatus('expiring')} className="ml-auto text-xs text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10">
            View All
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="glass-card rounded-xl p-4 mb-6 border border-white/10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by name, PAN, Case ID, email, mobile..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-card/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><X size={16} /></button>}
          </div>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-card/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none cursor-pointer appearance-none pr-8">
              <option value="all">All Status</option>
              {DSC_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-card/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none cursor-pointer appearance-none pr-8">
              <option value="all">All Types</option>
              {Object.entries(dscTypeLabel).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v}</option>)}
            </select>
            {(filterStatus !== 'all' || filterType !== 'all' || searchQuery) && (
              <button onClick={() => { setFilterStatus('all'); setFilterType('all'); setSearchQuery(''); }}
                className="px-3 py-2 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm">
                Clear
              </button>
            )}
          </div>
        </div>
        {filtered.length !== records.length && (
          <p className="text-xs text-gray-500 mt-3">Showing {filtered.length} of {records.length} records</p>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-gray-400 flex items-center justify-center gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading records...
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 glass-card rounded-2xl border border-white/10">
          <Key size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No DSC records found</p>
          <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Records Table */}
      {!loading && filtered.length > 0 && (
        <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h3 className={`font-bold ${headingGrad}`}>DSC Applications ({filtered.length})</h3>
          </div>
          <div className="divide-y divide-white/5">
            {filtered.map(record => {
              const daysLeft = getDaysUntilExpiry(record.dscExpiryDate);
              const isExpanded = expandedId === record.id;

              return (
                <div key={record.id} className={`transition-all ${isExpanded ? 'bg-white/5' : 'hover:bg-white/5'}`}>

                  {/* Row */}
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : record.id)}>
                    <div className="flex items-center gap-4">
                      {/* Name + Case ID */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm">{record.formData?.applicantName || '—'}</span>
                          {record.formData?.organisationName && (
                            <span className="text-xs text-gray-500">· {record.formData.organisationName}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{record.caseId} · {record.formData?.pan} · {record.formData?.mobile}</p>
                      </div>

                      {/* Type */}
                      <div className="hidden md:block text-xs text-gray-400 min-w-[120px]">
                        {dscTypeLabel[record.dscType] || record.dscType}
                      </div>

                      {/* Expiry */}
                      <div className="hidden md:block text-xs min-w-[100px]">
                        {record.dscExpiryDate ? (
                          <span className={daysLeft !== null && daysLeft <= 30 ? 'text-amber-400 font-semibold' : 'text-gray-300'}>
                            {new Date(record.dscExpiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {daysLeft !== null && daysLeft <= 30 && daysLeft > 0 && ` (${daysLeft}d)`}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </div>

                      {/* Status badge */}
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusBadge(record.dscStatus)}`}>
                        {DSC_STATUS_OPTIONS.find(o => o.value === record.dscStatus)?.label || record.dscStatus}
                      </span>

                      {/* Edit button */}
                      <button
                        onClick={e => { e.stopPropagation(); setEditingRecord(record); }}
                        className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                        <Edit2 size={15} />
                      </button>

                      <ChevronRight size={16} className={`text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 animate-fade-in">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          ['Email', record.formData?.email],
                          ['Mobile', record.formData?.mobile],
                          ['Entity Type', record.formData?.entityType],
                          ['Purpose', record.formData?.purpose],
                          ['State', record.formData?.state],
                          ['City', record.formData?.city],
                          ['Serial No.', record.dscSerialNumber || 'Not issued yet'],
                          ['Issued On', record.dscIssuedDate ? new Date(record.dscIssuedDate).toLocaleDateString('en-IN') : 'Pending'],
                        ].map(([k, v]) => (
                          <div key={k} className="bg-card/50 rounded-lg p-3 border border-white/5">
                            <p className="text-xs text-gray-500 mb-0.5">{k}</p>
                            <p className="text-sm text-white capitalize truncate">{v || '—'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setEditingRecord(record)}
                          className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                          <Edit2 size={14} /> Update DSC Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <EditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  );
}