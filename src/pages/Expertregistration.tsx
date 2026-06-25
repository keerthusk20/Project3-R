import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Upload, ChevronRight, ChevronLeft, User, Briefcase, FileText, Lock, Clock } from 'lucide-react';
import { auth, db, storage } from '../services/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, updateProfile } from 'firebase/auth';
import { UserRole, ProfessionalType } from '../types';

// ─────────────────────────────────────────────────────────────
// ✅ FIXED: Moved OUTSIDE the main component so they are never
//    recreated on re-render → fixes the "loses focus" bug
// ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, error, required, hint, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
      {label}{required && <span className="text-amber-400 ml-1">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    {error && (
      <p className="text-xs text-red-400 flex items-center gap-1">
        <AlertCircle size={11} />{error}
      </p>
    )}
  </div>
);

interface FileFieldProps {
  label: string;
  required?: boolean;
  fieldName: string;
  accept: string;
  error?: string;
  value: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => void;
}

const FileField: React.FC<FileFieldProps> = ({ label, required, fieldName, accept, error, value, onChange }) => (
  <Field label={label} error={error} required={required}>
    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
      value
        ? 'border-emerald-500/50 bg-emerald-500/5'
        : error
        ? 'border-red-500/60 bg-red-500/5'
        : 'border-slate-700/60 bg-slate-800/60 hover:border-amber-500/50 hover:bg-slate-800'
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
        value ? 'bg-emerald-500/20' : 'bg-slate-700/60 group-hover:bg-amber-500/20'
      }`}>
        {value
          ? <CheckCircle2 size={16} className="text-emerald-400" />
          : <Upload size={16} className="text-slate-400 group-hover:text-amber-400 transition-colors" />
        }
      </div>
      <div className="flex-1 min-w-0">
        {value
          ? <p className="text-sm text-emerald-400 truncate font-medium">{value.name}</p>
          : <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Click to upload file</p>
        }
        <p className="text-xs text-slate-500 mt-0.5">
          {accept.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')}
        </p>
      </div>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e, fieldName)}
        className="hidden"
      />
    </label>
  </Field>
);

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const caSpecializations = [
  'Tax Audit', 'GST Filing', 'Income Tax', 'Company Audit',
  'Transfer Pricing', 'FEMA/RBI', 'Insolvency', 'Forensic Audit'
];

const lawyerSpecializations = [
  'Corporate Law', 'Tax Law', 'Civil Litigation', 'Criminal Law',
  'IP Law', 'Labour Law', 'Family Law', 'Real Estate'
];

const steps = [
  { id: 1, label: 'Basic Info', icon: User },
  { id: 2, label: 'Professional', icon: Briefcase },
  { id: 3, label: 'Documents', icon: FileText },
];

// ─────────────────────────────────────────────────────────────
// Helper: input class builder (outside component = stable ref)
// ─────────────────────────────────────────────────────────────
const inputCls = (error?: string) =>
  `w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 bg-slate-800/60 border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 ${
    error ? 'border-red-500/60 bg-red-500/5' : 'border-slate-700/60 hover:border-slate-600'
  }`;

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

const ExpertRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [professionalType, setProfessionalType] = useState<ProfessionalType>('ca');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    secondaryPhone: '',
    firmName: '',
    panNumber: '',
    yearsOfExperience: '',
    specializationAreas: [] as string[],
    icaiMembershipNumber: '',
    membershipType: 'associate' as 'associate' | 'fellow',
    copNumber: '',
    barCouncilNumber: '',
    barCouncilState: '',
    enrollmentYear: '',
    documents: {
      professionalCert: null as File | null,
      panCard: null as File | null,
      dscFile: null as File | null,
      cancelledCheque: null as File | null,
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const allowOnlyNumbers = (value: string) => value.replace(/[^0-9]/g, '');
  const allowOnlyLettersAndSpaces = (value: string) => value.replace(/[^a-zA-Z\s.&'-]/g, '');
  const allowPANFormat = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  const allowAlphanumeric = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    switch (name) {
      case 'phone':
      case 'secondaryPhone':
        processedValue = allowOnlyNumbers(value).slice(0, 10); break;
      case 'panNumber': processedValue = allowPANFormat(value); break;
      case 'icaiMembershipNumber': processedValue = allowOnlyNumbers(value).slice(0, 6); break;
      case 'copNumber': processedValue = allowAlphanumeric(value).slice(0, 20); break;
      case 'barCouncilNumber': processedValue = allowAlphanumeric(value).slice(0, 30); break;
      case 'yearsOfExperience': processedValue = allowOnlyNumbers(value).slice(0, 2); break;
      case 'enrollmentYear': processedValue = allowOnlyNumbers(value).slice(0, 4); break;
      case 'fullName': processedValue = allowOnlyLettersAndSpaces(value).slice(0, 100); break;
      case 'firmName': processedValue = allowOnlyLettersAndSpaces(value).slice(0, 150); break;
      default: processedValue = value;
    }
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name]) {
      setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, documents: { ...prev.documents, [fieldName]: file } }));
  };

  const handleSpecializationToggle = (area: string) => {
    setFormData(prev => ({
      ...prev,
      specializationAreas: prev.specializationAreas.includes(area)
        ? prev.specializationAreas.filter(a => a !== area)
        : [...prev.specializationAreas, area]
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
      else if (formData.fullName.length < 3) newErrors.fullName = 'At least 3 characters required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Use at least 6 characters';
      if (formData.confirmPassword !== formData.password) newErrors.confirmPassword = 'Passwords do not match';
      if (!formData.phone.trim()) newErrors.phone = 'Primary phone is required';
      else if (!/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Enter valid 10-digit number';
      if (!formData.secondaryPhone.trim()) newErrors.secondaryPhone = 'Secondary phone is required';
      else if (!/^\d{10}$/.test(formData.secondaryPhone)) newErrors.secondaryPhone = 'Enter valid 10-digit number';
      else if (formData.secondaryPhone === formData.phone) newErrors.secondaryPhone = 'Must differ from primary number';
    }
    if (step === 2) {
      if (!formData.firmName.trim()) newErrors.firmName = 'Firm name is required';
      if (!formData.panNumber.trim()) newErrors.panNumber = 'PAN is required';
      else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) newErrors.panNumber = 'Invalid PAN (e.g. ABCDE1234F)';
      if (professionalType === 'ca') {
        if (!formData.icaiMembershipNumber) newErrors.icaiMembershipNumber = 'ICAI number is required';
        else if (!/^\d{6}$/.test(formData.icaiMembershipNumber)) newErrors.icaiMembershipNumber = 'Must be 6 digits';
      }
      if (professionalType === 'lawyer') {
        if (!formData.barCouncilNumber) newErrors.barCouncilNumber = 'Bar Council number is required';
        if (!formData.barCouncilState) newErrors.barCouncilState = 'Select your state';
      }
    }
    if (step === 3) {
      if (!formData.documents.professionalCert) newErrors.professionalCert = 'Certificate is required';
      if (!formData.documents.panCard) newErrors.panCard = 'PAN card is required';
      if (professionalType === 'ca' && !formData.documents.dscFile) newErrors.dscFile = 'DSC file is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) { setCurrentStep(p => p + 1); window.scrollTo(0, 0); }
  };
  const prevStep = () => { setCurrentStep(p => p - 1); window.scrollTo(0, 0); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    setIsSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await updateProfile(credential.user, { displayName: formData.fullName });
      const userId = credential.user.uid;
      const expertCode = `EXP-${Date.now().toString().slice(-6)}`;

      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        name: formData.fullName,
        displayName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        phoneNumber: formData.phone,
        role: UserRole.EXPERT,
        isExpert: false,
        status: 'pending',
        userId: expertCode,
        createdAt: serverTimestamp(),
        isVerifiedExpert: false,
        justRegistered: true,
      });

      await sendEmailVerification(credential.user, {
        url: `${window.location.origin}/#/verify-email`,
        handleCodeInApp: true,
      });

      const uploadFile = async (file: File | null, path: string): Promise<string> => {
        if (!file) return '';
        const filePath = `expert_documents/${userId}/${path}_${Date.now()}`;
        const ext = file.name.split('.').pop()?.toLowerCase();
        const contentType =
          file.type ||
          (ext === 'pdf' ? 'application/pdf' :
            ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
              ext === 'png' ? 'image/png' :
                ext === 'webp' ? 'image/webp' :
                  ext === 'pfx' || ext === 'p12' ? 'application/x-pkcs12' :
                    'application/octet-stream');
        await uploadBytes(ref(storage, filePath), file, { contentType });
        return filePath;
      };
      const [professionalCertPath, panCardPath, dscPath, chequePath] = await Promise.all([
        uploadFile(formData.documents.professionalCert, 'professional_cert'),
        uploadFile(formData.documents.panCard, 'pan_card'),
        uploadFile(formData.documents.dscFile, 'dsc'),
        uploadFile(formData.documents.cancelledCheque, 'cancelled_cheque'),
      ]);
      const expertData = {
        uid: userId,
        name: formData.fullName,
        displayName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        phoneNumber: formData.phone,
        secondaryPhone: formData.secondaryPhone,
        role: UserRole.EXPERT,
        isExpert: false,
        expertise: professionalType === 'ca' ? 'Chartered Accountant' : 'Lawyer',
        experience: formData.yearsOfExperience,
        status: 'pending',
        createdAt: serverTimestamp(),
        userId: expertCode,
        isVerifiedExpert: false,
        justRegistered: true,
        professionalDetails: {
          professionalType,
          firmName: formData.firmName,
          panNumber: formData.panNumber,
          yearsOfExperience: formData.yearsOfExperience,
          specializationAreas: formData.specializationAreas,
          ...(professionalType === 'ca' && {
            icaiMembershipNumber: formData.icaiMembershipNumber,
            membershipType: formData.membershipType,
            copNumber: formData.copNumber,
          }),
          ...(professionalType === 'lawyer' && {
            barCouncilNumber: formData.barCouncilNumber,
            barCouncilState: formData.barCouncilState,
          }),
          verificationStatus: 'pending',
        },
        documents: {
          professionalCertificate: professionalCertPath,
          panCard: panCardPath,
          dscFile: dscPath,
          cancelledCheque: chequePath,
        },
      };
      await setDoc(doc(collection(db, 'users'), userId), expertData);
      await setDoc(doc(collection(db, 'expert_applications'), userId), {
        applicationId: userId, ...expertData, appliedAt: serverTimestamp(),
        reviewedBy: null, reviewedAt: null, rejectionReason: null,
      });
      await signOut(auth);
      setSubmittedEmail(formData.email);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Submission failed. Error: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1a1f2e 0%, #0a0d14 60%)' }}>
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={30} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Application Submitted</h1>
          <p className="text-slate-400 text-sm leading-6 mb-6">
            We sent a verification email to <span className="text-slate-200 font-semibold">{submittedEmail}</span>.
            Verify your email now. You can sign in only after admin approval activates your expert account.
          </p>
          <div className="text-left bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-6 space-y-2">
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-400" />
              Check your inbox and spam folder for the verification email.
            </p>
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <Clock size={13} className="text-amber-400" />
              Admin review usually takes 3-5 business days.
            </p>
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <Lock size={13} className="text-cyan-400" />
              Login remains blocked until your status becomes active.
            </p>
          </div>
          <button
            onClick={() => navigate('/auth', {
              state: {
                email: submittedEmail,
                successMsg: 'Expert application submitted. Verify your email, then sign in after admin approval.'
              }
            })}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14]" style={{ background: 'radial-gradient(ellipse at top, #1a1f2e 0%, #0a0d14 60%)' }}>

      {/* Top accent line */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, #f59e0b, transparent)' }} />

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors mb-8 group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 mb-2">RegiBIZ Platform</p>
              <h1 className="text-3xl font-bold text-white tracking-tight">Expert Registration</h1>
              <p className="text-slate-400 text-sm mt-2">Join our verified network of CAs and Legal professionals</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-full px-4 py-2 flex-shrink-0">
              <span className="text-xs text-slate-400">Step</span>
              <span className="text-sm font-bold text-white ml-1">{currentStep}</span>
              <span className="text-xs text-slate-500">/3</span>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center mt-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isCompleted ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                      : isActive ? 'bg-amber-500 shadow-lg shadow-amber-500/30'
                      : 'bg-slate-800 border border-slate-700'
                    }`}>
                      {isCompleted
                        ? <CheckCircle2 size={18} className="text-white" />
                        : <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                      }
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${
                      isActive ? 'text-amber-400' : isCompleted ? 'text-emerald-400' : 'text-slate-600'
                    }`}>{step.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-px mx-2 mb-5 transition-all duration-500 ${
                      currentStep > step.id ? 'bg-emerald-500/50' : 'bg-slate-700/50'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">

            {/* Card Header */}
            <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-800/30">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = steps[currentStep - 1].icon;
                  return (
                    <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
                      <Icon size={16} className="text-amber-400" />
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {currentStep === 1 && 'Basic Information'}
                    {currentStep === 2 && 'Professional Details'}
                    {currentStep === 3 && 'Document Upload'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {currentStep === 1 && 'Your personal and contact information'}
                    {currentStep === 2 && 'Your professional credentials and expertise'}
                    {currentStep === 3 && 'Upload your verification documents'}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-5">

              {/* ── STEP 1 ── */}
              {currentStep === 1 && (
                <>
                  {/* Professional Type Selector */}
                  <Field label="I am a" required>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      {[
                        { value: 'ca', title: 'Chartered Accountant', sub: 'ICAI Member', badge: 'CA' },
                        { value: 'lawyer', title: 'Lawyer', sub: 'Bar Council Member', badge: 'LW' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProfessionalType(opt.value as ProfessionalType)}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                            professionalType === opt.value
                              ? 'border-amber-500/70 bg-amber-500/8 shadow-lg shadow-amber-500/10'
                              : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                            professionalType === opt.value ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400'
                          }`}>{opt.badge}</div>
                          <p className={`font-semibold text-sm ${professionalType === opt.value ? 'text-white' : 'text-slate-300'}`}>
                            {opt.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
                          {professionalType === opt.value && (
                            <div className="flex items-center gap-1 mt-2">
                              <CheckCircle2 size={11} className="text-amber-400" />
                              <span className="text-xs text-amber-400 font-medium">Selected</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Full Name" error={errors.fullName} required>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="As per official records"
                      maxLength={100}
                      className={inputCls(errors.fullName)}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.email} required>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className={inputCls(errors.email)}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Password" error={errors.password} required>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Create login password"
                          className={`${inputCls(errors.password)} pl-10`}
                        />
                      </div>
                    </Field>
                    <Field label="Confirm Password" error={errors.confirmPassword} required>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="password"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Repeat password"
                          className={`${inputCls(errors.confirmPassword)} pl-10`}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Primary Phone" error={errors.phone} required hint="10-digit mobile number">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium select-none">+91</span>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="9876543210"
                          maxLength={10}
                          inputMode="numeric"
                          className={`${inputCls(errors.phone)} pl-12`}
                        />
                      </div>
                    </Field>
                    <Field label="Secondary Phone" error={errors.secondaryPhone} required hint="Alternate contact number">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium select-none">+91</span>
                        <input
                          type="tel"
                          name="secondaryPhone"
                          value={formData.secondaryPhone}
                          onChange={handleChange}
                          placeholder="9876543210"
                          maxLength={10}
                          inputMode="numeric"
                          className={`${inputCls(errors.secondaryPhone)} pl-12`}
                        />
                      </div>
                    </Field>
                  </div>
                </>
              )}

              {/* ── STEP 2 ── */}
              {currentStep === 2 && (
                <>
                  <Field label="Firm / Chamber Name" error={errors.firmName} required>
                    <input
                      type="text"
                      name="firmName"
                      value={formData.firmName}
                      onChange={handleChange}
                      placeholder="Your firm or chamber name"
                      maxLength={150}
                      className={inputCls(errors.firmName)}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="PAN Number" error={errors.panNumber} required hint="Format: ABCDE1234F">
                      <input
                        type="text"
                        name="panNumber"
                        value={formData.panNumber}
                        onChange={handleChange}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className={`${inputCls(errors.panNumber)} uppercase tracking-widest`}
                      />
                    </Field>
                    <Field label="Years of Experience">
                      <input
                        type="text"
                        name="yearsOfExperience"
                        value={formData.yearsOfExperience}
                        onChange={handleChange}
                        placeholder="e.g. 8"
                        maxLength={2}
                        inputMode="numeric"
                        className={inputCls()}
                      />
                    </Field>
                  </div>

                  {/* CA Fields */}
                  {professionalType === 'ca' && (
                    <div className="space-y-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/40">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-500/80">CA — ICAI Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="ICAI Membership No." error={errors.icaiMembershipNumber} required hint="6-digit number">
                          <input
                            type="text"
                            name="icaiMembershipNumber"
                            value={formData.icaiMembershipNumber}
                            onChange={handleChange}
                            placeholder="123456"
                            maxLength={6}
                            inputMode="numeric"
                            className={inputCls(errors.icaiMembershipNumber)}
                          />
                        </Field>
                        <Field label="Membership Type">
                          <select
                            name="membershipType"
                            value={formData.membershipType}
                            onChange={handleChange}
                            className={inputCls()}
                          >
                            <option value="associate">Associate (ACA)</option>
                            <option value="fellow">Fellow (FCA)</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="COP Number" hint="Certificate of Practice — optional">
                        <input
                          type="text"
                          name="copNumber"
                          value={formData.copNumber}
                          onChange={handleChange}
                          placeholder="Enter COP number"
                          maxLength={20}
                          className={`${inputCls()} uppercase`}
                        />
                      </Field>
                    </div>
                  )}

                  {/* Lawyer Fields */}
                  {professionalType === 'lawyer' && (
                    <div className="space-y-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/40">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-500/80">Lawyer — Bar Council Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Bar Council Number" error={errors.barCouncilNumber} required>
                          <input
                            type="text"
                            name="barCouncilNumber"
                            value={formData.barCouncilNumber}
                            onChange={handleChange}
                            placeholder="Enrollment number"
                            maxLength={30}
                            className={`${inputCls(errors.barCouncilNumber)} uppercase`}
                          />
                        </Field>
                        <Field label="Year of Enrollment">
                          <input
                            type="text"
                            name="enrollmentYear"
                            value={formData.enrollmentYear}
                            onChange={handleChange}
                            placeholder="e.g. 2018"
                            maxLength={4}
                            inputMode="numeric"
                            className={inputCls()}
                          />
                        </Field>
                      </div>
                      <Field label="Bar Council State" error={errors.barCouncilState} required>
                        <select
                          name="barCouncilState"
                          value={formData.barCouncilState}
                          onChange={handleChange}
                          className={inputCls(errors.barCouncilState)}
                        >
                          <option value="">Select your state</option>
                          {[
                            'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
                            'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
                            'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
                            'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
                            'Uttarakhand','West Bengal'
                          ].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}

                  {/* Specializations */}
                  <Field label="Specialization Areas" hint="Select all that apply">
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {(professionalType === 'ca' ? caSpecializations : lawyerSpecializations).map(area => {
                        const checked = formData.specializationAreas.includes(area);
                        return (
                          <label
                            key={area}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                              checked
                                ? 'border-amber-500/50 bg-amber-500/8 text-amber-300'
                                : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                              checked ? 'bg-amber-500 border-amber-500' : 'border-slate-600'
                            }`}>
                              {checked && <CheckCircle2 size={10} className="text-black" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleSpecializationToggle(area)}
                              className="hidden"
                            />
                            <span className="text-xs font-medium">{area}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                </>
              )}

              {/* ── STEP 3 ── */}
              {currentStep === 3 && (
                <>
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-300">Document Requirements</p>
                      <p className="text-xs text-amber-400/70 mt-0.5">
                        Max 10MB per file · Accepted formats: PDF, JPG, PNG · Ensure all documents are clear and legible
                      </p>
                    </div>
                  </div>

                  <FileField
                    label={professionalType === 'ca' ? 'ICAI Membership Certificate' : 'Bar Council Certificate'}
                    required
                    fieldName="professionalCert"
                    accept=".pdf,.jpg,.png"
                    error={errors.professionalCert}
                    value={formData.documents.professionalCert}
                    onChange={handleFileChange}
                  />
                  <FileField
                    label="PAN Card"
                    required
                    fieldName="panCard"
                    accept=".pdf,.jpg,.png"
                    error={errors.panCard}
                    value={formData.documents.panCard}
                    onChange={handleFileChange}
                  />
                  {professionalType === 'ca' && (
                    <FileField
                      label="Digital Signature Certificate (DSC)"
                      required
                      fieldName="dscFile"
                      accept=".pfx,.p12"
                      error={errors.dscFile}
                      value={formData.documents.dscFile}
                      onChange={handleFileChange}
                    />
                  )}
                  <FileField
                    label="Cancelled Cheque (Optional)"
                    fieldName="cancelledCheque"
                    accept=".pdf,.jpg,.png"
                    value={formData.documents.cancelledCheque}
                    onChange={handleFileChange}
                  />

                  {/* Declaration */}
                  <label className="flex items-start gap-3 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl cursor-pointer group">
                    <input
                      type="checkbox"
                      required
                      className="mt-0.5 w-4 h-4 rounded border-slate-600 flex-shrink-0 accent-amber-500"
                    />
                    <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                      I hereby declare that all information provided is true, accurate and complete to the best of my knowledge.
                      I authorize <strong className="text-slate-300 font-semibold">RegiBIZ</strong> to verify my professional
                      credentials with the relevant regulatory bodies.
                    </p>
                  </label>
                </>
              )}
            </div>

            {/* Card Footer */}
            <div className="px-6 py-5 border-t border-slate-800/80 bg-slate-800/20 flex items-center justify-between gap-4">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800/60 border border-slate-700/50 hover:text-white hover:border-slate-600 transition-all"
                >
                  <ChevronLeft size={15} /> Previous
                </button>
              ) : <div />}

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 transition-all duration-200 ml-auto"
                  style={{ boxShadow: '0 4px 15px rgba(245,158,11,0.25)' }}
                >
                  Continue <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  style={{ boxShadow: '0 4px 15px rgba(245,158,11,0.25)' }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      Submit Application
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Bottom note */}
          <p className="text-center text-xs text-slate-600 mt-6">
            Verification takes 3–5 business days · Credentials will be sent to your registered email
          </p>
        </form>
      </div>
    </div>
  );
};

export default ExpertRegistration;