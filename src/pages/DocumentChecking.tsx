import React, { useState } from 'react';
import './DocumentChecking.css';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
interface UploadedDocument {
  fileName: string;
  mimeType: string;
  fileBase64: string;
  fileSize: number;
  uploadTime: Date;
}

interface ExtractedData {
  companyName?: string;
  cinNumber?: string;
  registrationNumber?: string;
  panNumber?: string;
  registeredAddress?: string;
  dateOfIncorporation?: string;
  email?: string;
  authorizedCapital?: string;
  [key: string]: string | undefined;
}

interface ValidationCheck {
  field: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  pdfValue?: string | null;
  googleValue?: string | null;
}

interface VerificationResult {
  caseReference: string;
  timestamp: string;
  verificationStatus: 'VERIFIED' | 'PARTIAL_VERIFIED' | 'PENDING' | 'FAILED';
  overallScore: number;
  maxScore: number;
  validations: ValidationCheck[];
  discrepancies: string[];
  extractedData: ExtractedData;
  aiConfidence: number;
  recommendation: string;
  nextAction: string;
  message: string;
}

// ============================================================================
// HELPER: Format camelCase to Readable Uppercase
// ============================================================================
const formatFieldName = (field: string): string => {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
    .toUpperCase();
};

// ============================================================================
// HELPER: Get Status-based Message & Style
// ============================================================================
const getValidationDisplay = (check: ValidationCheck) => {
  const config = {
    PASS: { 
      icon: '✓', 
      color: '#10b981', 
      bg: 'rgba(16, 185, 129, 0.05)', 
      border: 'rgba(16, 185, 129, 0.2)',
      message: 'Data matched with document'
    },
    FAIL: { 
      icon: '✕', 
      color: '#ef4444', 
      bg: 'rgba(239, 68, 68, 0.05)', 
      border: 'rgba(239, 68, 68, 0.2)',
      message: 'Mismatch found'
    },
    WARNING: { 
      icon: '⚠', 
      color: '#f59e0b', 
      bg: 'rgba(245, 158, 11, 0.05)', 
      border: 'rgba(245, 158, 11, 0.2)',
      message: 'Data not found in document'
    }
  }[check.status] || { 
    icon: '?', 
    color: '#6b7280', 
    bg: 'rgba(107, 114, 128, 0.05)', 
    border: 'rgba(107, 114, 128, 0.2)',
    message: check.message 
  };

  const displayMessage = check.message && check.message.trim() 
    ? check.message 
    : config.message;

  return { ...config, displayMessage };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const DocumentChecking: React.FC = () => {
  const [caseReference, setCaseReference] = useState('DOC-PENDING');
  
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fix hydration mismatch by generating ID after mount
  React.useEffect(() => {
    setCaseReference(`DOC-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);
  }, []);

  const handleFileUpload = (file: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or Image file (JPG, PNG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newDoc: UploadedDocument = {
        fileName: file.name,
        mimeType: file.type,
        fileBase64: (reader.result as string).split(',')[1],
        fileSize: file.size,
        uploadTime: new Date()
      };
      setDocument(newDoc);
      setVerificationResult(null);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const removeDocument = () => {
    setDocument(null);
    setVerificationResult(null);
    setError(null);
  };

  const verifyDocuments = async () => {
    if (!document) {
      setError('Please upload a document to verify');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        caseReference: caseReference,
        documents: [{
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileBase64: document.fileBase64,
          fileSize: document.fileSize,
          uploadedAt: new Date().toISOString()
        }]
      };

      const WEBHOOK_URL = "http://localhost:5678/webhook/verify-documents";
      console.log('📤 Sending to n8n...');

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('📥 Response Status:', response.status);
      
      const responseText = await response.text();
      console.log('📥 Raw Response:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText || response.statusText}`);
      }

      const result = JSON.parse(responseText);
      console.log('✅ Full Result:', result);
      
      // 🔥 DEBUG: Log validations from backend
      console.log("VALIDATIONS:", result.validations);
      
      // Flexible structure handling
      let verificationData;
      
      if (result.data && result.data.verificationStatus) {
        verificationData = result.data;
      } else if (result.verificationStatus) {
        verificationData = result;
      } else if (result.json?.data?.verificationStatus) {
        verificationData = result.json.data;
      } else if (result.json?.verificationStatus) {
        verificationData = result.json;
      } else {
        console.warn('⚠️ Unexpected structure, using fallback');
        verificationData = {
          caseReference: caseReference,
          timestamp: new Date().toISOString(),
          verificationStatus: 'PENDING',
          overallScore: result.overallScore || 0,
          maxScore: 100,
          validations: result.validations || [],
          discrepancies: result.discrepancies || [],
          extractedData: result.extractedData || {},
          aiConfidence: result.aiConfidence || 0,
          recommendation: result.recommendation || 'Manual review required',
          nextAction: result.nextAction || 'REQUEST_MISSING_DOCUMENTS',
          message: result.message || 'Verification completed'
        };
      }

      console.log('✅ Final verification data:', verificationData);
      setVerificationResult(verificationData);
      
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setDocument(null);
    setVerificationResult(null);
    setError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="document-checking-container">
      <div className="page-header">
        <div className="header-content">
          <h1>📋 Document Verification</h1>
          <p>AI-Powered Document Analysis - Upload your document for instant verification</p>
        </div>
        <div className="case-badge">
          <span className="case-label">Case Reference:</span>
          <span className="case-value">{caseReference}</span>
        </div>
      </div>

      <div className="upload-section">
        {!document ? (
          <div 
            className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="file-input"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleInputChange}
            />
            <label htmlFor="file-upload" className="upload-label-content">
              <div className="upload-icon">📄</div>
              <h3>Drop your document here, or click to browse</h3>
              <p>Supports: PDF, JPG, PNG (Max 10MB)</p>
            </label>
          </div>
        ) : (
          <div className="uploaded-document">
            <div className="document-info">
              <div className="document-icon">
                {document.mimeType.includes('pdf') ? '📄' : '🖼️'}
              </div>
              <div className="document-details">
                <h4>{document.fileName}</h4>
                <p>{formatFileSize(document.fileSize)} • Uploaded: {document.uploadTime.toLocaleTimeString()}</p>
              </div>
            </div>
            <button onClick={removeDocument} className="remove-btn">Remove</button>
          </div>
        )}
      </div>

      {document && !verificationResult && (
        <div className="action-section">
          <button
            onClick={verifyDocuments}
            disabled={isLoading}
            className="verify-button"
          >
            {isLoading ? '🤖 AI Processing...' : '🔍 Verify Document with AI'}
          </button>
        </div>
      )}

      {error && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">✕</button>
        </div>
      )}

      {verificationResult && (
        <VerificationResults result={verificationResult} onReset={resetAll} />
      )}
    </div>
  );
};

// ============================================================================
// 🔥 RESULTS COMPONENT - SIDE-BY-SIDE COMPARISON UI 🔥
// ============================================================================
const VerificationResults: React.FC<{ result: VerificationResult; onReset: () => void }> = ({ result, onReset }) => {
  
  React.useEffect(() => {
    console.log('📊 VerificationResults received:', {
      status: result.verificationStatus,
      score: result.overallScore,
      validations: result.validations?.length,
      extractedData: result.extractedData,
      aiConfidence: result.aiConfidence
    });
  }, [result]);

  const getStatusConfig = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'verified': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: '✓', label: 'Verified' };
      case 'partial_verified': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: '!', label: 'Partially Verified' };
      case 'pending': return { color: '#667eea', bg: 'rgba(102, 126, 234, 0.1)', icon: '⏳', label: 'Pending Review' };
      default: return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: '✕', label: 'Failed' };
    }
  };

  const statusConfig = getStatusConfig(result.verificationStatus);

  // Group validations by status
  const mismatchedFields = (result.validations || []).filter(v => v.status === 'FAIL');
  const matchedFields = (result.validations || []).filter(v => v.status === 'PASS');
  const warningFields = (result.validations || []).filter(v => v.status === 'WARNING');

  // Field Comparison Card Component
  const FieldComparisonCard: React.FC<{ check: ValidationCheck }> = ({ check }) => {
    const isMatch = check.status === 'PASS';
    const pdfValue = check.pdfValue || 'Not Found';
    const googleValue = check.googleValue || 'Not Found';

    return (
      <div className={`comparison-card ${isMatch ? 'match' : 'mismatch'}`}>
        <div className="comparison-header">
          <span className="field-name">{formatFieldName(check.field)}</span>
          <div className={`status-badge ${isMatch ? 'match' : 'mismatch'}`}>
            <span>{isMatch ? 'Match' : 'Mismatch'}</span>
            <span className="badge-icon">{isMatch ? '✓' : '✕'}</span>
          </div>
        </div>
        <div className="comparison-content">
          <div className="data-source">
            <div className="source-label">
              <span className="source-icon pdf">📄</span>
              <span>PDF DATA</span>
            </div>
            <div className="source-value">{pdfValue}</div>
          </div>
          <div className="data-source">
            <div className="source-label">
              <span className="source-icon google">🌐</span>
              <span>GOOGLE DATA</span>
            </div>
            <div className="source-value">{googleValue}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="results-container comparison-ui">
      <div className="results-header">
        <div>
          <h2>Verification Results</h2>
          <p>{new Date(result.timestamp).toLocaleString()}</p>
        </div>
        <div className="status-badge" style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.color }}>
          <span className="status-icon" style={{ color: statusConfig.color }}>{statusConfig.icon}</span>
          <span className="status-text" style={{ color: statusConfig.color }}>{statusConfig.label}</span>
        </div>
      </div>

      {/* ✅ 1️⃣ MATCHED FIELDS SECTION - FIRST */}
      {matchedFields.length > 0 && (
        <div className="fields-section matched">
          <div className="section-header">
            <h3>✅ MATCHED FIELDS</h3>
            <span className="count-badge">{matchedFields.length}</span>
          </div>
          <div className="fields-grid">
            {matchedFields.map((check, index) => (
              <FieldComparisonCard key={`${check.field}-${index}`} check={check} />
            ))}
          </div>
        </div>
      )}

      {/* ⚠️ 2️⃣ MISMATCHED FIELDS SECTION - SECOND */}
      {mismatchedFields.length > 0 && (
        <div className="fields-section mismatched">
          <div className="section-header">
            <h3>⚠️ MISMATCHED FIELDS</h3>
            <span className="count-badge">{mismatchedFields.length}</span>
          </div>
          <div className="fields-grid">
            {mismatchedFields.map((check, index) => (
              <FieldComparisonCard key={`${check.field}-${index}`} check={check} />
            ))}
          </div>
        </div>
      )}

      {/* ⚡ 3️⃣ WARNING FIELDS - THIRD */}
      {warningFields.length > 0 && (
        <div className="fields-section warnings">
          <div className="section-header">
            <h3>⚡ FIELDS NOT FOUND</h3>
            <span className="count-badge">{warningFields.length}</span>
          </div>
          <div className="fields-grid">
            {warningFields.map((check, index) => (
              <FieldComparisonCard key={`${check.field}-${index}`} check={check} />
            ))}
          </div>
        </div>
      )}

      {/* METRICS */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Overall Score</div>
          <div className="metric-value">
            {result.overallScore}<span className="metric-max">/{result.maxScore || 100}</span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill"
              style={{ 
                width: `${(result.overallScore / (result.maxScore || 100)) * 100}%`,
                background: result.overallScore >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' :
                           result.overallScore >= 60 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                           'linear-gradient(90deg, #ef4444, #f87171)'
              }}
            />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">AI Confidence</div>
          <div className="metric-value confidence">
            {(result.aiConfidence || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 📋 4️⃣ DISCREPANCIES - FOURTH */}
      {result.discrepancies?.length > 0 && (
        <div className="discrepancies-section">
          <h3>📋 Discrepancies Summary</h3>
          <ul className="discrepancies-list">
            {result.discrepancies.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* RECOMMENDATION */}
      <div className="recommendation-box">
        <h3>💡 Recommendation</h3>
        <p>{result.recommendation}</p>
      </div>

      {/* ACTIONS */}
      <div className="results-actions">
        <button onClick={onReset} className="btn-secondary">
          Upload New Document
        </button>
        {result.nextAction === 'PROCEED_TO_NEXT_STEP' && (
          <button className="btn-primary">
            Proceed to Next Step →
          </button>
        )}
      </div>
    </div>
  );
};

export default DocumentChecking;