// src/components/ServiceDetailModal.tsx

import React, { useState } from 'react';
import { X, Calendar, Clock, User, FileText, MessageSquare, CheckCircle, Download, Eye } from 'lucide-react';
import { useServiceListener } from '../hooks/useServiceListener';

interface ServiceDetailModalProps {
    serviceId: string;
    onClose: () => void;
}

const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({ serviceId, onClose }) => {
    const { service, loading, error } = useServiceListener(serviceId);
    const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'chat'>('details');

    if (loading) return <div className="p-10 text-center text-gray-400">Loading details...</div>;
    if (error || !service) return <div className="p-10 text-center text-red-400">Error loading service.</div>;

    // Helper for status colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'processing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#020617] rounded-3xl border border-white/10 w-full max-w-4xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0f172a]/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-cyan-500">
                                {service.serviceName}
                            </span>
                            <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(service.currentStatus)}`}>
                                {service.currentStatus?.toUpperCase()}
                            </span>
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">ID: {service.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-white/5 bg-[#0f172a]/30">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'details' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-gray-400 hover:text-white'}`}
                    >
                        Application Details
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'documents' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-gray-400 hover:text-white'}`}
                    >
                        Submitted Documents ({service.documents?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-gray-400 hover:text-white'}`}
                    >
                        Support Chat
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">

                    {/* --- TAB 1: DETAILS --- */}
                    {activeTab === 'details' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Applied On</label>
                                    <div className="text-white flex items-center gap-2">
                                        <Calendar size={16} className="text-cyan-500" />
                                        {new Date(service.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Assigned Agent</label>
                                    <div className="text-white flex items-center gap-2">
                                        <User size={16} className="text-cyan-500" />
                                        {service.assignedAgent?.name || 'Not Assigned Yet'}
                                    </div>
                                </div>
                            </div>

                            {/* Status History Timeline */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Status History</h3>
                                <div className="space-y-4 border-l-2 border-slate-700 ml-2 pl-6">
                                    {service.statusHistory?.map((entry, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-cyan-500"></div>
                                            <p className="text-sm text-cyan-400 font-medium">{entry.status.replace('_', ' ').toUpperCase()}</p>
                                            <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                                            {entry.note && <p className="text-sm text-gray-300 mt-1">{entry.note}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB 2: DOCUMENTS (THE REQUESTED FEATURE) --- */}
                    {activeTab === 'documents' && (
                        <div className="space-y-4">
                            {(!service.documents || service.documents.length === 0) ? (
                                <div className="text-center py-10 text-gray-500 border-2 border-dashed border-slate-700 rounded-xl">
                                    <FileText size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>No documents submitted yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {service.documents.map((doc: any, index: number) => (
                                        <div key={index} className="group p-4 rounded-xl bg-[#1e293b]/50 border border-white/5 hover:border-cyan-500/30 hover:bg-[#1e293b] transition-all flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-medium text-sm truncate max-w-[150px]">{doc.name || 'Document'}</h4>
                                                    <p className="text-xs text-gray-500">{doc.type || 'PDF'} • {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <a
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-lg bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                                                    title="View Document"
                                                >
                                                    <Eye size={18} />
                                                </a>
                                                <a
                                                    href={doc.url}
                                                    download
                                                    className="p-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                                                    title="Download"
                                                >
                                                    <Download size={18} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB 3: CHAT (Placeholder for Phase 4) --- */}
                    {activeTab === 'chat' && (
                        <div className="text-center py-10 text-gray-500">
                            <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
                            <p>Chat feature coming in next update.</p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-[#0f172a]/80 flex justify-end">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white font-semibold transition-all">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServiceDetailModal;