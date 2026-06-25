import React, { useState } from 'react';
import { X, Mail, Phone, Calendar, User, Clock, FileText, CheckCircle, AlertCircle, Edit2 } from 'lucide-react';
import { UserProfile, ServiceDocument } from '../types';
import { formatDate } from '../utils/helpers';

interface CustomerModalProps {
  customer: UserProfile;
  requests: ServiceDocument[];
  onClose: () => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ customer, requests, onClose }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'requests' | 'activity'>('profile');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase"><CheckCircle size={10} /> Completed</span>;
      case 'processing': return <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold uppercase"><Clock size={10} /> In Progress</span>;
      case 'rejected': return <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold uppercase"><AlertCircle size={10} /> Rejected</span>;
      default: return <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase"><Clock size={10} /> Pending</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-background/20 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-2xl font-bold text-white">
                {customer.displayName ? customer.displayName.charAt(0).toUpperCase() : <User />}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{customer.displayName || 'Unknown User'}</h2>
              <p className="text-sm font-mono text-gray-500">{customer.userId}</p>
              <div className="flex items-center gap-2 mt-2">
                 <span className={`w-2 h-2 rounded-full ${customer.status === 'active' ? 'bg-teal-500' : 'bg-gray-500'}`}></span>
                 <span className="text-xs uppercase font-bold text-gray-400">{customer.status}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-white/5 px-6">
          {['profile', 'requests', 'activity'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-teal-500 text-teal-400' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'requests' ? 'Service Requests' : tab === 'activity' ? 'Activity Log' : 'Profile Details'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Contact Email</label>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Mail size={16} className="text-teal-500" />
                      {customer.email}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Phone Number</label>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Phone size={16} className="text-teal-500" />
                      {customer.phoneNumber || 'Not Provided'}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Joined Date</label>
                    <div className="flex items-center gap-2 text-gray-200">
                      <Calendar size={16} className="text-teal-500" />
                      {formatDate(customer.createdAt)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Role</label>
                    <div className="flex items-center gap-2 text-gray-200">
                      <User size={16} className="text-teal-500" />
                      <span className="capitalize">{customer.role}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                 <h4 className="text-sm font-bold text-blue-400 mb-2">Staff Notes</h4>
                 <p className="text-sm text-gray-400 italic">No notes added for this user yet.</p>
              </div>

              <div className="flex justify-end">
                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors border border-white/10">
                  <Edit2 size={14} /> Edit Profile
                </button>
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <FileText size={32} className="mx-auto mb-2 opacity-20" />
                  <p>No service requests found.</p>
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="p-4 rounded-lg bg-white/5 border border-white/5 hover:border-teal-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-white">{req.title}</h4>
                      {getStatusBadge(req.status || 'pending')}
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 font-mono">{req.serviceId || req.id}</p>
                        <p className="text-xs text-gray-500">Submitted: {formatDate(req.submittedAt)}</p>
                      </div>
                      <button className="text-xs text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">View Details →</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6 relative pl-2">
               <div className="absolute left-1.5 top-0 bottom-0 w-[1px] bg-white/10"></div>
               <div className="relative pl-6">
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-border"></div>
                  <p className="text-sm text-gray-300">Account Created</p>
                  <p className="text-xs text-gray-500">{formatDate(customer.createdAt)}</p>
               </div>
               {requests.slice(0, 3).map(req => (
                  <div key={'log-'+req.id} className="relative pl-6">
                     <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-border"></div>
                     <p className="text-sm text-gray-300">Submitted Request: <span className="text-white">{req.title}</span></p>
                     <p className="text-xs text-gray-500">{formatDate(req.submittedAt)}</p>
                  </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;