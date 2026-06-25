// src/components/Documents/ApplicationDetailView.tsx
import React from 'react';
import {
  FileText, Download, ExternalLink, Users, CheckCircle2, AlertCircle,
  Calendar, Mail, User, Hash, Building, MapPin, Phone, CreditCard,
  Briefcase, Home, FileCheck, FileSignature, Shield, Globe, Edit2, Save, X,
  Pen
} from 'lucide-react';
import { Application } from '../../Types/Application';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email?: string;
  [key: string]: any;
}

export interface ApplicationDetailViewProps {
  application: Application;
  onDownload: (url: string, fileName: string) => void;
  isAdmin: boolean;
  isSupport: boolean;
  allUsers: UserProfile[];
  isEditMode?: boolean;
  editableSections?: Record<string, boolean>;
  editedValues?: Record<string, any>;
  onEditSection?: (section: string) => void;
  onToggleEdit?: (section: string) => void;
  onEditChange?: (field: string, value: any) => void;
  onSave?: (section: string) => void;
  onCancel?: (section: string) => void;
}

const ApplicationDetailView: React.FC<ApplicationDetailViewProps> = ({
  application,
  onDownload,
  isAdmin,
  isSupport,
  allUsers,
  onToggleEdit,
  isEditMode = false,
  editableSections = {},
  editedValues = {},
  onEditChange,
  onSave,
  onCancel
}) => {
  const formData = application.formData || {};
  const commonData = application.commonData || {};
  const rawFiles = application.uploadedFileUrls || {};
  delete rawFiles.digitalSignatureCertificate;
  delete rawFiles.dsc;
  delete rawFiles.digitalSignature;
  const files = rawFiles;
  const directors = application.directors || [];
  const partners = application.partners || [];
  const signatoryDetails = application.signatoryDetails || null;

  // Format Date
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  // Get Real User Name
  const getRealUserName = (userId: string): string | null => {
    const foundUser = allUsers.find(u => u.uid === userId);
    return foundUser ? foundUser.displayName : null;
  };

  // Get User Login Email
  const getUserLoginEmail = (userId: string): string => {
    const foundUser = allUsers.find(u => u.uid === userId);
    return foundUser?.email || 'N/A';
  };

  // Get Customer Name
  const getCustomerName = (): string => {
    const realName = getRealUserName(application.userId);
    if (realName) return realName;
    return (
      commonData.businessName || formData.businessName || formData.tradeName ||
      formData.companyName || formData.proprietorName || formData.applicantName ||
      formData.enterpriseName || formData.promoterName || formData.name ||
      formData.fullName || formData.firmName ||
      application.userEmail?.split('@')[0] || 'Unknown Customer'
    );
  };

  // Format Status Text
  const getStatusText = (status: string): string => {
    return status?.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Unknown';
  };

  // Extended State to Indian State Mapping
  const getStateName = (stateCode: string): string => {
    const states: Record<string, string> = {
      '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
      '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
      '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
      '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
      '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
      '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
      '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
      '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
      '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
      '38': 'Ladakh', '97': 'Other Territory', '99': 'Other Country',
      'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam',
      'BR': 'Bihar', 'CG': 'Chhattisgarh', 'GA': 'Goa', 'GJ': 'Gujarat',
      'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JH': 'Jharkhand',
      'KA': 'Karnataka', 'KL': 'Kerala', 'MP': 'Madhya Pradesh',
      'MH': 'Maharashtra', 'MN': 'Manipur', 'ML': 'Meghalaya',
      'MZ': 'Mizoram', 'NL': 'Nagaland', 'OD': 'Odisha', 'PB': 'Punjab',
      'RJ': 'Rajasthan', 'SK': 'Sikkim', 'TN': 'Tamil Nadu',
      'TS': 'Telangana', 'TR': 'Tripura', 'UP': 'Uttar Pradesh',
      'UK': 'Uttarakhand', 'WB': 'West Bengal', 'DL': 'Delhi',
      'JK': 'Jammu and Kashmir', 'LA': 'Ladakh', 'PY': 'Puducherry',
      'CH': 'Chandigarh', 'DN': 'Dadra and Nagar Haveli',
      'DD': 'Daman and Diu', 'LD': 'Lakshadweep', 'AN': 'Andaman and Nicobar Islands'
    };
    return states[stateCode] || stateCode;
  };

  // Extended District Code to Name Mapping
  const getDistrictName = (districtCode: string): string => {
    const districts: Record<string, string> = {
      '1': 'Nicobar', '2': 'North and Middle Andaman', '3': 'South Andaman',
      '4': 'Anantapur', '5': 'Chittoor', '6': 'East Godavari',
      '7': 'Guntur', '8': 'Krishna', '9': 'Kurnool',
      '10': 'Nellore', '11': 'Prakasam', '12': 'Srikakulam',
      '13': 'Visakhapatnam', '14': 'Vizianagaram', '15': 'West Godavari',
      '16': 'YSR Kadapa', '17': 'Anjaw', '18': 'Changlang',
      '19': 'Dibang Valley', '20': 'East Kameng', '21': 'East Siang',
      '22': 'Kamle', '23': 'Kra Daadi', '24': 'Kurung Kumey',
      '25': 'Lepa Rada', '26': 'Lohit', '27': 'Longding',
      '28': 'Lower Dibang Valley', '29': 'Lower Siang', '30': 'Lower Subansiri',
      '31': 'Namsai', '32': 'Pakke Kessang', '33': 'Papum Pare',
      '34': 'Shi Yomi', '35': 'Siang', '36': 'Tawang',
      '37': 'Tirap', '38': 'Upper Siang', '39': 'Upper Subansiri',
      '40': 'West Kameng', '41': 'West Siang',
      '101': 'Mumbai', '102': 'Pune', '103': 'Nagpur', '104': 'Thane',
      '105': 'Bangalore Urban', '106': 'Mysore', '107': 'Belgaum',
      '108': 'Chennai', '109': 'Coimbatore', '110': 'Madurai',
      '111': 'Hyderabad', '112': 'Warangal', '113': 'Karimnagar',
      '114': 'Ahmedabad', '115': 'Surat', '116': 'Vadodara',
      '117': 'Rajkot', '118': 'Jaipur', '119': 'Jodhpur',
      '120': 'Udaipur', '121': 'Kota', '122': 'Lucknow',
      '123': 'Kanpur', '124': 'Varanasi', '125': 'Agra',
      '126': 'Patna', '127': 'Gaya', '128': 'Muzaffarpur',
      '129': 'Kolkata', '130': 'Howrah', '131': 'Darjeeling',
      '132': 'Bhopal', '133': 'Indore', '134': 'Gwalior',
      '135': 'Jabalpur', '136': 'Raipur', '137': 'Bilaspur',
      '138': 'Ranchi', '139': 'Dhanbad', '140': 'Jamshedpur',
      '141': 'Bhubaneswar', '142': 'Cuttack', '143': 'Rourkela',
      '144': 'Thiruvananthapuram', '145': 'Ernakulam', '146': 'Kozhikode',
      '147': 'Chandigarh', '148': 'Ludhiana', '149': 'Amritsar',
      '150': 'Jalandhar', '151': 'Patiala', '152': 'Dehradun',
      '153': 'Haridwar', '154': 'Nainital', '155': 'Gurgaon',
      '156': 'Faridabad', '157': 'Panipat', '158': 'Ambala',
      '159': 'Shimla', '160': 'Dharamshala', '161': 'Manali',
      '162': 'Srinagar', '163': 'Jammu', '164': 'Leh',
      '165': 'Kargil', '166': 'Gangtok', '167': 'Imphal',
      '168': 'Aizawl', '169': 'Agartala', '170': 'Shillong',
      '171': 'Kohima', '172': 'Itanagar', '173': 'Dispur',
      '174': 'Aurangabad', '175': 'Nashik', '176': 'Solapur',
      '177': 'Kolhapur', '178': 'Sangli', '179': 'Satara',
      '180': 'Raigad', '181': 'Dharwad', '182': 'Hubli',
      '183': 'Mangalore', '184': 'Bellary', '185': 'Bidar',
      '186': 'Gulbarga', '187': 'Davangere', '188': 'Shimoga',
      '189': 'Tumkur', '190': 'Hassan', '191': 'Mandya',
      '192': 'Kolar', '193': 'Chikmagalur', '194': 'Udupi',
      '195': 'Dakshina Kannada', '196': 'Uttara Kannada', '197': 'Haveri',
      '198': 'Gadag', '199': 'Koppal', '200': 'Raichur'
    };
    return districts[districtCode] || districtCode;
  };

  // Document Category Mapping
  const getDocumentCategory = (key: string): string => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('pan') && !lowerKey.includes('company') &&
      !lowerKey.includes('firm') && !lowerKey.includes('partner') &&
      !lowerKey.includes('director') && !lowerKey.includes('sign')) {
      return 'Identity Documents';
    }
    if (lowerKey.includes('aadhaar') && !lowerKey.includes('partner') &&
      !lowerKey.includes('director') && !lowerKey.includes('sign')) {
      return 'Identity Documents';
    }
    if (lowerKey.includes('photo') && !lowerKey.includes('partner') &&
      !lowerKey.includes('director') && !lowerKey.includes('sign')) {
      return 'Identity Documents';
    }
    if (lowerKey.includes('identityproof')) return 'Identity Documents';
    if (lowerKey.includes('dobproof')) return 'Identity Documents';
    if (lowerKey.includes('signature') && !lowerKey.includes('digital')) return 'Identity Documents';
    if (lowerKey.includes('bank') || lowerKey.includes('cheque') || lowerKey.includes('statement')) {
      return 'Bank Documents';
    }
    if (lowerKey.includes('address') || lowerKey.includes('rent') || lowerKey.includes('noc') ||
      lowerKey.includes('elec') || lowerKey.includes('utility') || lowerKey.includes('tax') ||
      lowerKey.includes('bill')) {
      return 'Address Proof';
    }
    if (lowerKey.includes('business') || lowerKey.includes('trade') || lowerKey.includes('license') ||
      lowerKey.includes('udyam') || lowerKey.includes('msme') || lowerKey.includes('shop') ||
      lowerKey.includes('coi') || lowerKey.includes('moa') || lowerKey.includes('aoa') ||
      lowerKey.includes('llp') || lowerKey.includes('partnership') || lowerKey.includes('deed') ||
      lowerKey.includes('incorporation') || lowerKey.includes('gst') || lowerKey.includes('turnover') ||
      lowerKey.includes('invoice') || lowerKey.includes('factory') || lowerKey.includes('machinery')) {
      return 'Business Documents';
    }
    if (lowerKey.includes('sign') && (lowerKey.includes('pan') || lowerKey.includes('aadhaar') ||
      lowerKey.includes('photo') || lowerKey.includes('auth'))) {
      return 'Signatory Documents';
    }
    if (lowerKey.includes('dsc') || lowerKey.includes('digitalsignature')) {
      return 'Digital Signature';
    }
    if (lowerKey.includes('director') || lowerKey.includes('partner')) {
      return 'Director/Partner Documents';
    }
    return 'Other Documents';
  };

  // Group Documents by Category
const groupedDocuments = Object.entries(files).reduce((acc, [key, url]) => {

  // ❌ Remove Digital Signature documents
  if (key === "digitalSignatureCertificate" || key === "digitalSignature" || key === "dsc") {
    return acc;
  }

  // ❌ Skip empty urls
  if (!url || url.trim() === "") {
    return acc;
  }

  const category = getDocumentCategory(key);

  if (!acc[category]) acc[category] = [];

  acc[category].push({ key, url });

  return acc;

}, {} as Record<string, Array<{ key: string; url: string }>>);

  // Format Document Name
  const formatDocumentName = (key: string): string => {
    const labels: Record<string, string> = {
      promoterPan: 'Promoter PAN', promoterAadhaarDoc: 'Promoter Aadhaar',
      promoterPhoto: 'Promoter Photo', shopActLicense: 'Shop Act License',
      udyamRegistration: 'Udyam Registration', tradeLicense: 'Trade License',
      msmeCertificate: 'MSME Certificate', partnershipDeed: 'Partnership Deed',
      firmPan: 'Firm PAN Card', companyPan: 'Company PAN',
      companyCoi: 'Certificate of Incorporation', companyMoa: 'Memorandum of Association (MOA)',
      companyAoa: 'Articles of Association (AOA)', llpAgreement: 'LLP Agreement',
      incorporationCert: 'Incorporation Certificate', cancelledCheque: 'Cancelled Cheque',
      bankStatement: 'Bank Statement', bankStatement3Months: 'Bank Statement (3 Months)',
      rentAgreement: 'Rent Agreement', noc: 'NOC from Owner', addressProof: 'Address Proof',
      elecBill: 'Electricity Bill', taxReceipt: 'Property Tax Receipt',
      utilityBill: 'Utility Bill', signPan: 'Signatory PAN', signAadhaar: 'Signatory Aadhaar',
      signPhoto: 'Signatory Photo', signAuthLetter: 'Authorization Letter',
      dsc: 'Digital Signature Certificate (DSC)', digitalSignature: 'Digital Signature Certificate (DSC)',
      panCard: 'PAN Card', aadhaarCard: 'Aadhaar Card', turnoverInvoice: 'Turnover Invoice',
      factoryPhotos: 'Factory/Workshop Photos', machineryList: 'Machinery/Equipment List',
      gstin: 'GSTIN Certificate', udyamCertificate: 'Udyam Registration Certificate',
      coi: 'Certificate of Incorporation (COI)', moa: 'Memorandum of Association (MOA)',
      aoa: 'Articles of Association (AOA)', directorAadhaar: 'Directors Aadhaar Cards',
      directorPan: 'Directors PAN Cards', partnersPan: 'Partners PAN Cards',
      partnersAadhaar: 'Partners Aadhaar Cards', identityProof: 'Identity Proof',
      dobProof: 'DOB Proof', photo: 'Passport Photo', signature: 'Signature'
    };
    return labels[key] || key
      .replace(/([A-Z])/g, ' $1')
      .replace(/pan/gi, 'PAN')
      .replace(/aadhaar/gi, 'Aadhaar')
      .replace(/dsc/gi, 'DSC')
      .replace(/noc/gi, 'NOC')
      .replace(/coi/gi, 'COI')
      .replace(/moa/gi, 'MOA')
      .replace(/aoa/gi, 'AOA')
      .replace(/llp/gi, 'LLP')
      .trim();
  };

  // Render Read-Only Field
  const renderField = (label: string, value: any, icon?: React.ReactNode) => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return (
      <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className="text-cyan-400">{icon}</span>}
          <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">{label}</label>
        </div>
        <p className="text-sm text-slate-200 font-medium break-words">{String(value)}</p>
      </div>
    );
  };

  // Section Wrapper
  const SectionWrapper: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, icon, children }) => (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/50 bg-slate-800/40">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
          {icon}
        </div>
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
      {/* Header Section */}
      <div className="sticky top-0 bg-background pb-4 border-b border-slate-700/50 z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              {application.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-lg border border-cyan-400/20 flex items-center gap-2">
                <Hash size={14} />
                {application.caseId || application.id}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 flex items-center gap-2">
                <Calendar size={14} className="text-slate-500" />
                {formatDate(typeof application.submittedAt === 'number'
                  ? new Date(application.submittedAt).toISOString().split('T')[0]
                  : application.submittedAt?.toDate?.().toISOString().split('T')[0] || '')}
              </span>
              {application.paymentId && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 flex items-center gap-2">
                    <CreditCard size={14} className="text-slate-500" />
                    {application.paymentId}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
            application.status === 'submitted' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
            application.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            application.status === 'rejected' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            'bg-slate-700/50 border-slate-600 text-slate-300'
          }`}>
            {application.status === 'submitted' && <AlertCircle size={16} />}
            {application.status === 'approved' && <CheckCircle2 size={16} />}
            <span className="text-sm font-semibold">{getStatusText(application.status)}</span>
          </div>
        </div>
      </div>

      {/* Customer Information (Admin/Support only) */}
      {(isAdmin || isSupport) && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-900/20 via-blue-900/20 to-purple-900/20 border border-cyan-500/20">
          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User size={16} /> Customer Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">Customer Name</p>
              <p className="text-sm font-semibold text-white">{getCustomerName()}</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">Login Email</p>
              <p className="text-sm text-white flex items-center gap-2">
                <Mail size={14} className="text-slate-500" />
                {getUserLoginEmail(application.userId)}
              </p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1">User ID</p>
              <p className="text-xs font-mono text-cyan-300 bg-slate-800/50 p-2 rounded border border-slate-700 truncate" title={application.userId}>
                {application.userId}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Business/Common Details */}
      {(commonData.businessName || commonData.panNumber || commonData.constitution) && (
        <SectionWrapper title="Business Information" icon={<Building size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {renderField('Legal Name', commonData.businessName, <Building size={14} />)}
            {renderField('Trade Name', commonData.tradeName, <Briefcase size={14} />)}
            {renderField('PAN Number', commonData.panNumber, <FileCheck size={14} />)}
            {renderField('Constitution', commonData.constitution, <Shield size={14} />)}
            {renderField('Date of Commencement', formatDate(commonData.dateOfCommencement), <Calendar size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Proprietor/Promoter Details */}
      {(formData.promoterName || formData.promoterFirstName || formData.fullName) && (
        <SectionWrapper
          title={`${commonData.constitution === 'Proprietorship' ? 'Proprietor' : commonData.constitution === 'Partnership' ? 'Authorized Partner' : 'Promoter'} Details`}
          icon={<User size={18} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {renderField('Full Name', formData.promoterName || `${formData.promoterFirstName || ''} ${formData.promoterMiddleName || ''} ${formData.promoterLastName || ''}`.trim(), <User size={14} />)}
            {renderField("Father's Name", formData.promoterFatherFirstName || formData.fatherName, <User size={14} />)}
            {renderField('Date of Birth', formatDate(formData.promoterDob || formData.dob), <Calendar size={14} />)}
            {renderField('Mobile', formData.promoterMobile || formData.mobile ? `+91 ${formData.promoterMobile || formData.mobile}` : null, <Phone size={14} />)}
            {renderField('Email', formData.promoterEmail || formData.email, <Mail size={14} />)}
            {renderField('Aadhaar', formData.promoterAadhaar || formData.aadhaar, <FileCheck size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Enterprise Details (MSME) */}
      {formData.enterpriseName && (
        <SectionWrapper title="Enterprise Details" icon={<Briefcase size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {renderField('Enterprise Name', formData.enterpriseName, <Building size={14} />)}
            {renderField('Organisation Type', formData.orgType, <Shield size={14} />)}
            {renderField('Social Category', formData.socialCategory, <User size={14} />)}
            {renderField('Gender', formData.gender, <User size={14} />)}
            {renderField('Specially Abled', formData.speciallyAbled === 'yes' ? 'Yes' : 'No', <CheckCircle2 size={14} />)}
            {renderField('Major Activity', formData.majorActivity, <Briefcase size={14} />)}
            {renderField('Investment (₹)', formData.investment ? `₹${parseInt(formData.investment).toLocaleString('en-IN')}` : null, <CreditCard size={14} />)}
            {renderField('Turnover (₹)', formData.turnover ? `₹${parseInt(formData.turnover).toLocaleString('en-IN')}` : null, <CreditCard size={14} />)}
            {renderField('Employees', formData.employees, <Users size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Address Details */}
      {(formData.flatNumber || formData.addressLine1) && (
        <SectionWrapper title="Business Address" icon={<MapPin size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderField('Address Line 1', formData.flatNumber || formData.addressLine1, <Home size={14} />)}
            {renderField('Address Line 2', formData.roadStreet || formData.premisesName, <Home size={14} />)}
            {renderField('Area/Locality', formData.areaLocality, <MapPin size={14} />)}
            {renderField('City/District', getDistrictName(formData.district || formData.city), <MapPin size={14} />)}
            {renderField('State', getStateName(formData.state), <Globe size={14} />)}
            {renderField('Pincode', formData.pincode, <Hash size={14} />)}
            {application.propertyType && renderField('Property Type', application.propertyType === 'owned' ? 'Owned' : 'Rented/Leased', <Home size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Business Details */}
      {formData.natureOfBusiness && (
        <SectionWrapper title="Business Details" icon={<Briefcase size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderField('Nature of Business', formData.natureOfBusiness, <Briefcase size={14} />)}
            {formData.gstin && renderField('GSTIN', formData.gstin, <FileCheck size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Directors */}
      {directors.length > 0 && (
        <SectionWrapper title={`Directors (${directors.length})`} icon={<Users size={18} />}>
          <div className="space-y-3">
            {directors.map((director: any, idx: number) => (
              <div key={director.id || idx} className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    director.isPrimary ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-700/50 text-slate-400'
                  }`}>
                    {director.isPrimary && '★ '}Director {idx + 1}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {renderField('Full Name', `${director.firstName || ''} ${director.middleName || ''} ${director.lastName || ''}`.trim(), <User size={14} />)}
                  {renderField("Father's Name", `${director.fatherName?.firstName || ''} ${director.fatherName?.middleName || ''} ${director.fatherName?.lastName || ''}`.trim(), <User size={14} />)}
                  {renderField('Designation', director.designation, <Briefcase size={14} />)}
                  {renderField('Mobile', director.mobile ? `+91 ${director.mobile}` : null, <Phone size={14} />)}
                  {renderField('Email', director.email, <Mail size={14} />)}
                  {director.sharePercentage && renderField('Share %', `${director.sharePercentage}%`, <CreditCard size={14} />)}
                </div>
                <div className="mt-3 flex gap-2">
                  {director.panFile && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAN Uploaded</span>}
                  {director.aadhaarFile && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aadhaar Uploaded</span>}
                  {director.photoFile && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Photo Uploaded</span>}
                </div>
              </div>
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* Partners */}
      {partners.length > 0 && (
        <SectionWrapper title={`Partners (${partners.length})`} icon={<Users size={18} />}>
          <div className="space-y-3">
            {partners.map((partner: any, idx: number) => (
              <div key={partner.id || idx} className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    Partner {idx + 1}
                  </span>
                  {partner.isPrimary && (
                    <span className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Primary</span>
                  )}
                  {partner.sharePercentage && (
                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{partner.sharePercentage}%</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {renderField('Full Name', `${partner.firstName || ''} ${partner.middleName || ''} ${partner.lastName || ''}`.trim(), <User size={14} />)}
                  {renderField("Father's Name", `${partner.fatherName?.firstName || ''} ${partner.fatherName?.middleName || ''} ${partner.fatherName?.lastName || ''}`.trim(), <User size={14} />)}
                  {renderField('Designation', partner.designation, <Briefcase size={14} />)}
                  {renderField('Mobile', partner.mobile ? `+91 ${partner.mobile}` : null, <Phone size={14} />)}
                  {renderField('Email', partner.email, <Mail size={14} />)}
                  {partner.panNumber && renderField('PAN', partner.panNumber, <FileCheck size={14} />)}
                  {partner.aadhaarNumber && renderField('Aadhaar', partner.aadhaarNumber, <FileCheck size={14} />)}
                  {partner.sharePercentage && renderField('Share %', `${partner.sharePercentage}%`, <CreditCard size={14} />)}
                </div>
                <div className="mt-3 flex gap-2">
                  {partner.panFile && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAN Uploaded</span>}
                  {partner.aadhaarFile && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aadhaar Uploaded</span>}
                  {partner.photoFile && <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Photo Uploaded</span>}
                </div>
              </div>
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* Signatory Details */}
      {signatoryDetails && (
        <SectionWrapper title="Authorized Signatory" icon={<FileSignature size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {renderField('Full Name', `${signatoryDetails.firstName || ''} ${signatoryDetails.middleName || ''} ${signatoryDetails.lastName || ''}`.trim(), <User size={14} />)}
            {renderField("Father's Name", `${signatoryDetails.fatherFirstName || ''} ${signatoryDetails.fatherMiddleName || ''} ${signatoryDetails.fatherLastName || ''}`.trim(), <User size={14} />)}
            {renderField('Mobile', signatoryDetails.mobile ? `+91 ${signatoryDetails.mobile}` : null, <Phone size={14} />)}
            {renderField('Email', signatoryDetails.email, <Mail size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Uploaded Documents */}
      {Object.keys(groupedDocuments).length > 0 && (
        <SectionWrapper title={`Uploaded Documents (${Object.keys(files).length})`} icon={<FileText size={18} />}>
          {Object.entries(groupedDocuments).map(([category, docs]) => (
            <div key={category} className="space-y-3 mb-6 last:mb-0">
              <h5 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <FileCheck size={14} />
                {category}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {docs.map(({ key, url }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 capitalize truncate" title={formatDocumentName(key)}>
                          {formatDocumentName(key)}
                        </p>
                        <p className="text-xs text-slate-500">Click to view or download</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onDownload(url as string, `${formatDocumentName(key)}_${application.caseId || application.id}`)}
                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        title="View"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </SectionWrapper>
      )}

      {/* Consent & Declaration */}
      {(formData.consent1 || formData.consent2) && (
        <SectionWrapper title="Declaration & Consent" icon={<CheckCircle2 size={18} />}>
          <div className="space-y-3">
            {formData.consent1 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-300">I authorize RegiBIZ to file my application on my behalf.</p>
              </div>
            )}
            {formData.consent2 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-300">I declare that all information provided is true and correct.</p>
              </div>
            )}
          </div>
        </SectionWrapper>
      )}
    </div>
  );
};

export default ApplicationDetailView;