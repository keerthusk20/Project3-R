// src/pages/DSCTracker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  Key, CheckCircle, Clock, AlertTriangle, XCircle,
  RefreshCw, Loader2, Shield, Plus, ChevronRight,
  Calendar, FileText, Bell, Info
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DSCRecord {
  id: string;
  caseId: string;
  dscType: string;
  dscStatus: 'pending' | 'processing' | 'issued' | 'expiring' | 'expired';
  status: string;
  submittedAt: number;
  dscExpiryDate: string | null;
  dscIssuedDate: string | null;
  dscSerialNumber: string | null;
  formData: {
    applicantName: string;
    pan: string;
    email: string;
    mobile: string;
    purpose: string;
    entityType: string;
    organisationName?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const dscTypeLabel: Record<string, string> = {
  class3_individual: 'Class 3 — Individual',
  class3_organisation: 'Class 3 — Organisation',
  dgft: 'DGFT DSC',
};

const purposeLabel: Record<string, string> = {
  gst: 'GST Registration / Filing',
  income_tax: 'Income Tax Returns',
  mca: 'MCA / Company Registration',
  fssai: 'FSSAI License',
  startup_india: 'Startup India / DPIIT',
  dgft: 'DGFT / Import-Export',
  etendering: 'e-Tendering',
  multiple: 'Multiple Purposes',
};

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate).getTime();
  const now = Date.now();
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
}

function getStatusConfig(status: string, daysLeft: number | null) {
  if (status === 'expired' || (daysLeft !== null && daysLeft <= 0)) {
    return { label: 'Expired', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', icon: XCircle, dot: 'bg-red-500' };
  }
  if (status === 'expiring' || (daysLeft !== null && daysLeft <= 30)) {
    return { label: `Expiring in ${daysLeft} days`, color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', icon: AlertTriangle, dot: 'bg-amber-500 animate-pulse' };
  }
  if (status === 'issued') {
    return { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', icon: CheckCircle, dot: 'bg-emerald-500' };
  }
  if (status === 'processing') {
    return { label: 'Processing', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30', icon: RefreshCw, dot: 'bg-cyan-500 animate-pulse' };
  }
  return { label: 'Pending', color: 'text-gray-400', bg: 'bg-white/10 border-white/20', icon: Clock, dot: 'bg-gray-500' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DSCTracker() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dscRecords, setDscRecords] = useState<DSCRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DSCRecord | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, u => { setCurrentUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  const fetchDSCRecords = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'dsc-applications'),
        where('userId', '==', uid),
        orderBy('submittedAt', 'desc')
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as DSCRecord));
      setDscRecords(records);
    } catch (err) {
      console.error('Error fetching DSC records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchDSCRecords(currentUser.uid);
  }, [currentUser, fetchDSCRecords]);

  const headingGrad = 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent';
  const primaryGrad = 'bg-gradient-to-r from-orange-500 to-red-500';

  if (authLoading || loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="flex items-center gap-3 text-gray-400">
        <Loader2 className="animate-spin text-orange-500" size={28} />
        <span>Loading DSC records...</span>
      </div>
    </div>
  );

  const expiringCount = dscRecords.filter(r => {
    const days = getDaysUntilExpiry(r.dscExpiryDate);
    return r.dscStatus === 'issued' && days !== null && days <= 30 && days > 0;
  }).length;

  const activeCount = dscRecords.filter(r => r.dscStatus === 'issued').length;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className={`text-3xl font-bold ${headingGrad} mb-2`}>My DSC Tracker</h2>
          <p className="text-gray-400">Track your Digital Signature Certificates — status, expiry, and renewals.</p>
        </div>
        <button
          onClick={() => navigate('/services/dsc-registration')}
          className={`${primaryGrad} text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-orange-500/25 hover:opacity-90 transition-all`}>
          <Plus size={18} /> Apply for New DSC
        </button>
      </div>

      {/* Stats row */}
      {dscRecords.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total DSCs', value: dscRecords.length, icon: Key, color: 'text-blue-400', bg: 'bg-blue-500/20' },
            { label: 'Active', value: activeCount, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
            { label: 'Expiring Soon', value: expiringCount, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
            { label: 'Pending', value: dscRecords.filter(r => r.dscStatus === 'pending' || r.dscStatus === 'processing').length, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="glass-card rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={20} className={color} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-xl font-bold text-white">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expiring warning */}
      {expiringCount > 0 && (
        <div className="mb-6 p-4 glass-card border border-amber-500/30 rounded-xl flex items-start gap-3">
          <Bell size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-400">
              {expiringCount} DSC{expiringCount > 1 ? 's' : ''} expiring soon!
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">Renew before expiry to avoid disruption in government filings.</p>
          </div>
          <button onClick={() => navigate('/services/dsc-registration')}
            className="text-xs text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors whitespace-nowrap">
            Renew Now
          </button>
        </div>
      )}

      {/* Empty state */}
      {dscRecords.length === 0 && (
        <div className="text-center py-20 glass-card rounded-2xl border border-white/10">
          <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-5">
            <Key size={36} className="text-orange-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No DSC Applications Yet</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
            Apply for a Digital Signature Certificate to sign government forms electronically.
          </p>
          <button onClick={() => navigate('/services/dsc-registration')}
            className={`${primaryGrad} text-white px-6 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2 shadow-lg shadow-orange-500/25`}>
            <Plus size={18} /> Apply for DSC
          </button>
        </div>
      )}

      {/* DSC Cards */}
      {dscRecords.length > 0 && (
        <div className="space-y-4">
          {dscRecords.map(record => {
            const daysLeft = getDaysUntilExpiry(record.dscExpiryDate);
            const statusCfg = getStatusConfig(record.dscStatus, daysLeft);
            const StatusIcon = statusCfg.icon;
            const isExpanded = selectedRecord?.id === record.id;

            return (
              <div key={record.id}
                className={`glass-card rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded ? 'border-orange-500/40' : 'border-white/10 hover:border-white/20'}`}>

                {/* Card header — always visible */}
                <div className="p-5 cursor-pointer" onClick={() => setSelectedRecord(isExpanded ? null : record)}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Status dot + icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${statusCfg.bg}`}>
                        <StatusIcon size={22} className={statusCfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white font-bold">
                            {dscTypeLabel[record.dscType] || record.dscType}
                          </h3>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5 truncate">
                          {record.formData?.applicantName} · {record.formData?.pan}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {record.dscExpiryDate && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-gray-500">Expires</p>
                          <p className={`text-sm font-semibold ${daysLeft !== null && daysLeft <= 30 ? 'text-amber-400' : 'text-gray-300'}`}>
                            {new Date(record.dscExpiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {record.dscStatus === 'pending' || record.dscStatus === 'processing' ? (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-gray-500">Applied On</p>
                          <p className="text-sm text-gray-300">{new Date(record.submittedAt).toLocaleDateString('en-IN')}</p>
                        </div>
                      ) : null}
                      <ChevronRight size={18} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-5 space-y-5 animate-fade-in">

                    {/* DSC Details grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        ['Case ID', record.caseId],
                        ['DSC Type', dscTypeLabel[record.dscType] || record.dscType],
                        ['Purpose', purposeLabel[record.formData?.purpose] || record.formData?.purpose || '—'],
                        ['Serial No.', record.dscSerialNumber || '—'],
                        ['Issued On', record.dscIssuedDate ? new Date(record.dscIssuedDate).toLocaleDateString('en-IN') : '—'],
                        ['Expires On', record.dscExpiryDate ? new Date(record.dscExpiryDate).toLocaleDateString('en-IN') : '—'],
                        ['Email', record.formData?.email || '—'],
                        ['Mobile', record.formData?.mobile || '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-white/5 rounded-lg p-3 border border-white/5">
                          <p className="text-xs text-gray-500 mb-0.5">{k}</p>
                          <p className="text-sm text-white font-medium truncate">{v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Expiry progress bar */}
                    {record.dscStatus === 'issued' && record.dscIssuedDate && record.dscExpiryDate && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                          <span>DSC Validity</span>
                          <span className={daysLeft !== null && daysLeft <= 30 ? 'text-amber-400 font-semibold' : 'text-gray-300'}>
                            {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            daysLeft !== null && daysLeft <= 30 ? 'bg-amber-500'
                            : daysLeft !== null && daysLeft <= 90 ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                          }`} style={{
                            width: `${Math.max(0, Math.min(100, (daysLeft! / 730) * 100))}%`
                          }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>{new Date(record.dscIssuedDate).toLocaleDateString('en-IN')}</span>
                          <span>{new Date(record.dscExpiryDate).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                    )}

                    {/* Status info */}
                    {(record.dscStatus === 'pending' || record.dscStatus === 'processing') && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2 text-sm">
                        <Info size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-blue-300 text-xs">
                          {record.dscStatus === 'pending'
                            ? 'Your application is under review. Our team will contact you within 24 hours to schedule Video KYC.'
                            : 'Your documents are verified. Video KYC is being scheduled by the Certifying Authority.'}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 flex-wrap">
                      {(record.dscStatus === 'expiring' || (daysLeft !== null && daysLeft <= 30 && daysLeft > 0)) && (
                        <button onClick={() => navigate('/services/dsc-registration')}
                          className={`${primaryGrad} text-white px-5 py-2 rounded-lg text-sm font-medium`}>
                          🔄 Renew DSC
                        </button>
                      )}
                      {record.dscStatus === 'expired' && (
                        <button onClick={() => navigate('/services/dsc-registration')}
                          className={`${primaryGrad} text-white px-5 py-2 rounded-lg text-sm font-medium`}>
                          Apply for New DSC
                        </button>
                      )}
                      <button onClick={() => navigate('/documents')}
                        className="border border-white/10 text-gray-400 hover:text-white px-5 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5 flex items-center gap-2">
                        <FileText size={15} /> View Documents
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}