import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, AlertCircle, Users, CheckCircle } from 'lucide-react';
import { ServiceDocument, UserProfile, UserRole } from '../types';
import { dbService } from '../services/dbService';

import { getPerformance } from "firebase/performance";


// --- Performance Monitoring Setup ---
let perf: any = null;
let trace: any = null;


// ----------------------------------

interface AssignTaskModalProps {
  doc: ServiceDocument;
  onClose: () => void;
  onAssignSuccess: () => void;
  currentUser: UserProfile;
}

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  doc,
  onClose,
  onAssignSuccess,
  currentUser
}) => {
  const [supportStaff, setSupportStaff] = useState<UserProfile[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      // Start Trace: Fetching Staff List
      const staffTrace = trace ? trace("fetch_support_staff_list") : null;
      if (staffTrace) staffTrace.start();

      try {
        const staffList = await dbService.getUsersByRole(UserRole.SUPPORT);
        setSupportStaff(staffList);

        if (staffTrace) {
          staffTrace.putAttribute("staff_count", staffList.length.toString());
          staffTrace.stop();
        }
      } catch (err) {
        console.error("Failed to load support staff:", err);
        if (staffTrace) {
          staffTrace.putAttribute("status", "failed");
          staffTrace.stop();
        }
        setError("Could not load staff list. Please check permissions.");
      }
    };
    fetchStaff();
  }, []);

  const handleAssign = async () => {
    if (!selectedStaffId) {
      setError("Please select a staff member from the list.");
      return;
    }

    setLoading(true);
    setError(null);

    // Start Trace: Task Assignment Flow
    const assignTrace = trace ? trace("assign_task_flow") : null;
    if (assignTrace) {
      assignTrace.start();
      assignTrace.putAttribute("doc_id", doc.id);
      assignTrace.putAttribute("assigner_role", currentUser.role);
      assignTrace.putAttribute("service_type", doc.title.substring(0, 20)); // Truncate long titles
    }

    try {
      console.log(`Assigning task ${doc.id} to ${selectedStaffId} by ${currentUser.uid}`);

      // Call the assignment function
      const sourceColl = (doc as any).sourceCollection || 'applications';
      await dbService.assignTask(doc.id, doc.userId, selectedStaffId, currentUser.uid, sourceColl);

      // Mark success in trace
      if (assignTrace) assignTrace.putAttribute("status", "success");

      // Success flow
      setIsSuccess(true);
      setTimeout(() => {
        onAssignSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Assignment error:", err);

      // Mark failure in trace
      if (assignTrace) {
        assignTrace.putAttribute("status", "failed");
        assignTrace.putAttribute("error_code", err?.code || "unknown");
      }

      // Specific error handling for Firebase Permissions
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        setError("Permission Denied: Your role may not have access to assign tasks, or Firestore Rules need updating.");
      } else if (err?.code === 'not-found') {
        setError("Staff member or Document not found.");
      } else {
        setError(`Failed to assign: ${err.message || "Unknown error"}`);
      }
    } finally {
      // Stop the trace regardless of success/failure
      if (assignTrace) assignTrace.stop();
      setLoading(false);
    }
  };

  // Helper to determine badge color based on valid status types
  const getStatusBadgeClass = (status?: string) => {
    if (!status) return 'bg-gray-500/20 text-gray-400';
    switch (status) {
      case 'submitted':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'processing':
      case 'assigned':
        return 'bg-blue-500/20 text-blue-400';
      case 'approved':
      case 'paid':
        return 'bg-green-500/20 text-green-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary/80 backdrop-blur-sm transition-opacity">
        <div className="bg-[#0c0c10] border border-emerald-500/30 rounded-2xl p-8 flex flex-col items-center justify-center max-w-sm w-full shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden transition-all duration-300 transform scale-100 opacity-100">
          <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tight uppercase">Assigned Successfully</h3>
            <p className="text-sm text-gray-400 text-center">The task has been routed to the selected support agent.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary backdrop-blur-sm transition-opacity"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-md border border-white/10 shadow-2xl p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Send size={20} className="text-orange-500" />
            Assign Task
          </h2>
          {!loading && (
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Task Info Card */}
        <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/5">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Service Request</p>
          <p className="text-white font-bold text-lg mt-1">{doc.title}</p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500 font-mono">ID: {doc.serviceId || 'N/A'}</p>
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeClass(doc.status)}`}>
              {doc.status || 'No Status'}
            </span>
          </div>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Staff Selection */}
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Support Staff
        </label>

        {supportStaff.length === 0 ? (
          <div className="w-full bg-background border border-dashed border-white/10 rounded-lg px-4 py-8 text-center text-gray-500 text-sm">
            <Users size={24} className="mx-auto mb-2 opacity-50" />
            No support staff found. <br /> Please invite users with the 'Support' role first.
          </div>
        ) : (
          <select
            value={selectedStaffId}
            onChange={(e) => {
              setSelectedStaffId(e.target.value);
              setError(null); // Clear error on change
            }}
            disabled={loading}
            className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all disabled:opacity-50 cursor-pointer"
          >
            <option value="">-- Choose a team member --</option>
            {supportStaff.map(staff => (
              <option key={staff.uid} value={staff.uid}>
                {staff.displayName || staff.email}
                {staff.email && staff.displayName ? ` (${staff.email})` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Action Button */}
        <button
          onClick={handleAssign}
          disabled={loading || !selectedStaffId || supportStaff.length === 0}
          className="w-full mt-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Assigning...</span>
            </>
          ) : (
            <>
              <span>Confirm Assignment</span>
              <Send size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AssignTaskModal;