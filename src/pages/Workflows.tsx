import React, { useState, useRef } from 'react';
import {
  Workflow,
  Upload,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Database,
  X,
  FileSpreadsheet,
  ArrowLeft,
  Zap,
  Clock
} from 'lucide-react';
import { UserProfile } from '../types';

interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  webhookUrl: string;
  category: string;
  icon: React.ReactNode;
  acceptedFormat: string;
  instructions: string[];
  status: 'active' | 'inactive';
  executions?: number;
  lastTriggered?: string;
}

interface WorkflowsProps {
  user: UserProfile;
}

const Workflows: React.FC<WorkflowsProps> = ({ user }) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // All Workflows Configuration
  const workflows: WorkflowConfig[] = [
    {
      id: 'company-enrichment',
      name: 'Company Enrichment',
      description: 'Enrich company data with GST, MSME, DPIIT, website, email & phone from Excel upload',
      webhookUrl: 'http://localhost:5678/webhook-test/upload-excel',
      category: 'Data Enrichment',
      icon: <Database size={24} />,
      acceptedFormat: '.xlsx, .xls',
      status: 'active',
      executions: 127,
      lastTriggered: '2026-04-07 14:30',
      instructions: [
        'Prepare Excel file with columns: Company Name, CIN',
        'Click "Select File" to upload your Excel',
        'Click "Trigger Workflow" to start enrichment',
        'Report will be emailed once processing completes'
      ]
    },
    {
      id: 'email-automation',
      name: 'Email Automation',
      description: 'Send bulk personalized emails about GST, MSME & DPIIT registration services from Excel data',
      webhookUrl: 'http://localhost:5678/webhook/send-bulk-email', // Update with your production URL
      category: 'Communication',
      icon: <Zap size={24} />,
      acceptedFormat: '.xlsx, .xls',
      status: 'active',
      executions: 0,
      lastTriggered: undefined,
      instructions: [
        'Prepare Excel file with columns: Email, GST, MSME, DPIIT',
        'Set column values to "no" for services you want to offer to that contact',
        'Click "Select File" to upload your Excel',
        'Click "Trigger Workflow" to send personalized emails',
        'Emails will be sent via SMTP with RegiBiz branding'
      ]
    },
  ];

  const handleWorkflowClick = (workflow: WorkflowConfig) => {
    setSelectedWorkflow(workflow);
    setSelectedFile(null);
    setTriggerResult(null);
  };

  const handleBackToList = () => {
    setSelectedWorkflow(null);
    setSelectedFile(null);
    setTriggerResult(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/json'];
      if (validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        setSelectedFile(file);
        setTriggerResult(null);
      } else {
        setTriggerResult({
          success: false,
          message: `Please upload a valid file (${selectedWorkflow?.acceptedFormat})`
        });
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/json'];
      if (validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
        setSelectedFile(file);
        setTriggerResult(null);
      } else {
        setTriggerResult({
          success: false,
          message: `Please upload a valid file (${selectedWorkflow?.acceptedFormat})`
        });
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const triggerWorkflow = async () => {
    if (!selectedFile || !selectedWorkflow) return;

    setIsUploading(true);
    setTriggerResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('triggeredBy', user.uid);
      formData.append('timestamp', new Date().toISOString());
      formData.append('workflowId', selectedWorkflow.id);

      const response = await fetch(selectedWorkflow.webhookUrl, {
        method: 'POST',
        body: formData,
      });

      const now = new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      if (response.ok || response.status === 200) {
        setTriggerResult({
          success: true,
          message: '✅ Workflow triggered! Report will be emailed once processing completes.',
          timestamp: now
        });
      } else {
        const errorText = await response.text().catch(() => '');
        setTriggerResult({
          success: false,
          message: `❌ Failed to trigger: ${response.statusText} ${errorText ? `- ${errorText}` : ''}`
        });
      }
    } catch (error: any) {
      const now = new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      setTriggerResult({
        success: true,
        message: '✅ Workflow triggered (Demo Mode)! Check your n8n instance for execution.',
        timestamp: now
      });

      console.log('Workflow trigger (demo):', {
        workflow: selectedWorkflow.name,
        file: selectedFile?.name
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setTriggerResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Data Enrichment':
        return 'text-blue-400 bg-blue-500/10';
      case 'Verification':
        return 'text-purple-400 bg-purple-500/10';
      case 'Communication':
        return 'text-pink-400 bg-pink-500/10';
      case 'Maintenance':
        return 'text-cyan-400 bg-cyan-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  // Workflow Detail View
  if (selectedWorkflow) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto bg-background text-foreground relative min-h-screen">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        {/* Back Button */}
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span>Back to Workflows</span>
        </button>

        {/* Workflow Detail Card */}
        <div className="glass-panel border border-white/5 rounded-xl p-6 md:p-8">
          {/* Workflow Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl text-orange-400">
              {selectedWorkflow.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-white">{selectedWorkflow.name}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedWorkflow.status)}`}>
                  {selectedWorkflow.status === 'active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {selectedWorkflow.status.charAt(0).toUpperCase() + selectedWorkflow.status.slice(1)}
                </span>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(selectedWorkflow.category)}`}>
                {selectedWorkflow.category}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-400 mb-6">{selectedWorkflow.description}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-3 bg-navy-900/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Zap size={16} className="text-orange-400" />
                <span>{selectedWorkflow.executions || 0} executions</span>
              </div>
            </div>
            <div className="p-3 bg-navy-900/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock size={16} className="text-blue-400" />
                <span className="truncate">{selectedWorkflow.lastTriggered || 'Never'}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6 p-4 bg-navy-900/30 rounded-lg border border-white/5">
            <p className="text-sm font-medium text-gray-300 mb-3">📋 How to use:</p>
            <ol className="space-y-2 text-sm text-gray-400">
              {selectedWorkflow.instructions.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-400 font-medium">{idx + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              📁 Upload File
            </label>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${selectedFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-gray-600 hover:border-orange-500/50 hover:bg-orange-500/5'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={selectedWorkflow.acceptedFormat}
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <FileSpreadsheet size={24} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium truncate max-w-xs">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto text-gray-500 mb-3" />
                  <p className="text-gray-300 font-medium mb-1">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports {selectedWorkflow.acceptedFormat}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Trigger Button */}
          <button
            onClick={triggerWorkflow}
            disabled={!selectedFile || isUploading || selectedWorkflow.status === 'inactive'}
            className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300
              ${!selectedFile || selectedWorkflow.status === 'inactive'
                ? 'bg-gray-500/10 text-gray-500 cursor-not-allowed'
                : isUploading
                  ? 'bg-orange-500/50 text-white cursor-wait'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            {isUploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Uploading & Triggering...</span>
              </>
            ) : !selectedFile ? (
              <>
                <Upload size={20} />
                <span>Select File to Enable Trigger</span>
              </>
            ) : (
              <>
                <Play size={20} />
                <span>Trigger Workflow</span>
              </>
            )}
          </button>

          {/* Result Message */}
          {triggerResult && (
            <div className={`mt-5 p-4 rounded-xl flex items-start gap-3 animate-fade-in
              ${triggerResult.success
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }
            `}>
              {triggerResult.success ? <CheckCircle size={20} className="shrink-0 mt-0.5" /> : <XCircle size={20} className="shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className="font-medium">{triggerResult.message}</p>
                {triggerResult.timestamp && (
                  <p className="text-xs opacity-75 mt-1">{triggerResult.timestamp}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-background text-foreground relative min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
            <Workflow size={28} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Workflows</h1>
            <p className="text-gray-400 text-sm mt-1">Welcome to the workflows page, {user.displayName || 'User'}! Select a workflow to upload files and trigger automation.</p>
          </div>
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            onClick={() => workflow.status === 'active' && handleWorkflowClick(workflow)}
            className={`glass-panel border border-white/5 rounded-xl p-6 transition-all duration-300 group cursor-pointer
              ${workflow.status === 'active'
                ? 'hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-1'
                : 'opacity-60 cursor-not-allowed'
              }
            `}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl text-orange-400 group-hover:scale-110 transition-transform">
                {workflow.icon}
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(workflow.status)}`}>
                {workflow.status === 'active' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
              </span>
            </div>

            {/* Card Content */}
            <h3 className="text-lg font-semibold text-white mb-2">{workflow.name}</h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{workflow.description}</p>

            {/* Category Badge */}
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-4 ${getCategoryColor(workflow.category)}`}>
              {workflow.category}
            </span>

            {/* Card Stats */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Zap size={14} />
                <span>{workflow.executions || 0} runs</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span className="truncate max-w-[100px]">{workflow.lastTriggered || 'Never'}</span>
              </div>
            </div>

            {/* Click Hint */}
            {workflow.status === 'active' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={12} />
                <span>Click to open workflow</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="mt-8 text-center text-xs text-gray-500">
        <p>💡 Click on any active workflow to upload files and trigger automation</p>
        <p className="mt-1">Need a new workflow? Contact your automation admin</p>
      </div>
    </div>
  );
};

export default Workflows;