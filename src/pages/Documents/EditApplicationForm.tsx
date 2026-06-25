// src/components/Documents/EditApplicationForm.tsx
import React, { useState } from 'react';
import {
  FileText, Download, ExternalLink, Users, CheckCircle2, AlertCircle,
  Calendar, Mail, User, Hash, Building, MapPin, Phone, CreditCard,
  Briefcase, Home, FileCheck, FileSignature, Shield, Globe, Edit2, Save, X,
  Pen, Upload, Trash2
} from 'lucide-react';
import { Application } from '../../Types/Application';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email?: string;
  [key: string]: any;
}

export interface EditApplicationFormProps {
  application: Application;
  editedData: any;
  editedFiles: Record<string, File>;
  onFormDataChange: (field: string, value: any) => void;
  onFileChange: (fieldName: string, file: File) => void;
  onFileRemove: (fieldName: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isAdmin: boolean;
}

const EditApplicationForm: React.FC<EditApplicationFormProps> = ({
  application,
  editedData,
  editedFiles,
  onFormDataChange,
  onFileChange,
  onFileRemove,
  onSave,
  onCancel,
  isAdmin,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const formData = editedData?.formData || {};
  const commonData = editedData?.commonData || {};
  const directors = editedData?.directors || [];
  const partners = editedData?.partners || [];
  const signatoryDetails = editedData?.signatoryDetails || null;
  const existingFiles = application.uploadedFileUrls || {};

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
      // Andhra Pradesh
      '1': 'Nicobar', '2': 'North and Middle Andaman', '3': 'South Andaman',
      '4': 'Anantapur', '5': 'Chittoor', '6': 'East Godavari',
      '7': 'Guntur', '8': 'Krishna', '9': 'Kurnool',
      '10': 'Nellore', '11': 'Prakasam', '12': 'Srikakulam',
      '13': 'Visakhapatnam', '14': 'Vizianagaram', '15': 'West Godavari',
      '16': 'YSR Kadapa',
      // Arunachal Pradesh
      '17': 'Anjaw', '18': 'Changlang', '19': 'Dibang Valley',
      '20': 'East Kameng', '21': 'East Siang', '22': 'Kamle',
      '23': 'Kra Daadi', '24': 'Kurung Kumey', '25': 'Lepa Rada',
      '26': 'Lohit', '27': 'Longding', '28': 'Lower Dibang Valley',
      '29': 'Lower Siang', '30': 'Lower Subansiri', '31': 'Namsai',
      '32': 'Pakke Kessang', '33': 'Papum Pare', '34': 'Shi Yomi',
      '35': 'Siang', '36': 'Tawang', '37': 'Tirap',
      '38': 'Upper Siang', '39': 'Upper Subansiri', '40': 'West Kameng',
      '41': 'West Siang',
      // Additional Common Districts
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
    if (lowerKey.includes('director') || lowerKey.includes('partner')) {
      return 'Director/Partner Documents';
    }
    return 'Other Documents';
  };

  // Group Documents by Category
const groupedDocuments = Object.entries(existingFiles).reduce((acc, [key, url]) => {

  // ❌ Skip digital signature documents
  if (
    key === "dsc" ||
    key === "digitalSignature" ||
    key === "digitalSignatureCertificate"
  ) {
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
      promoterPan: 'Promoter PAN',
      promoterAadhaarDoc: 'Promoter Aadhaar',
      promoterPhoto: 'Promoter Photo',
      shopActLicense: 'Shop Act License',
      udyamRegistration: 'Udyam Registration',
      tradeLicense: 'Trade License',
      msmeCertificate: 'MSME Certificate',
      partnershipDeed: 'Partnership Deed',
      firmPan: 'Firm PAN Card',
      companyPan: 'Company PAN',
      companyCoi: 'Certificate of Incorporation',
      companyMoa: 'Memorandum of Association (MOA)',
      companyAoa: 'Articles of Association (AOA)',
      llpAgreement: 'LLP Agreement',
      incorporationCert: 'Incorporation Certificate',
      cancelledCheque: 'Cancelled Cheque',
      bankStatement: 'Bank Statement',
      bankStatement3Months: 'Bank Statement (3 Months)',
      rentAgreement: 'Rent Agreement',
      noc: 'NOC from Owner',
      addressProof: 'Address Proof',
      elecBill: 'Electricity Bill',
      taxReceipt: 'Property Tax Receipt',
      utilityBill: 'Utility Bill',
      signPan: 'Signatory PAN',
      signAadhaar: 'Signatory Aadhaar',
      signPhoto: 'Signatory Photo',
      signAuthLetter: 'Authorization Letter',
      dsc: 'Digital Signature Certificate (DSC)',
      digitalSignature: 'Digital Signature Certificate (DSC)',
      panCard: 'PAN Card',
      aadhaarCard: 'Aadhaar Card',
      turnoverInvoice: 'Turnover Invoice',
      factoryPhotos: 'Factory/Workshop Photos',
      machineryList: 'Machinery/Equipment List',
      gstin: 'GSTIN Certificate',
      udyamCertificate: 'Udyam Registration Certificate',
      coi: 'Certificate of Incorporation (COI)',
      moa: 'Memorandum of Association (MOA)',
      aoa: 'Articles of Association (AOA)',
      directorAadhaar: 'Directors Aadhaar Cards',
      directorPan: 'Directors PAN Cards',
      partnersPan: 'Partners PAN Cards',
      partnersAadhaar: 'Partners Aadhaar Cards',
      identityProof: 'Identity Proof',
      dobProof: 'DOB Proof',
      photo: 'Passport Photo',
      signature: 'Signature'
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

  // Format Date
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  // Render Editable Text Field
  const renderEditableField = (
    label: string,
    value: any,
    field: string,
    section: string,
    icon?: React.ReactNode,
    type: 'text' | 'date' | 'email' | 'tel' = 'text'
  ) => {
    if (value === undefined || value === null) return null;

    const fieldValue = String(value);
    if (fieldValue.trim() === '') return null;

    return (
      <div className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:border-cyan-500/30 transition-all group">
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-cyan-400">{icon}</span>}
          <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
            {label}
          </label>
        </div>
        <input
          type={type}
          value={fieldValue}
          onChange={(e) => onFormDataChange(field, e.target.value)}
          className="w-full bg-slate-700/50 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition-all"
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </div>
    );
  };

  // Render File Upload Field
  const renderFileUpload = (
    label: string,
    fieldName: string,
    existingUrl?: string
  ) => {
    const hasNewFile = editedFiles[fieldName];
    const hasExistingFile = existingUrl;

    return (
      <div className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:border-cyan-500/30 transition-all">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={14} className="text-cyan-400" />
          <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
            {label}
          </label>
        </div>

        <div className="space-y-3">
          {hasExistingFile && !hasNewFile && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <FileCheck size={16} className="text-emerald-400" />
                <span className="text-sm text-emerald-400">Current file uploaded</span>
              </div>
              <button
                onClick={() => onFileRemove(fieldName)}
                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                title="Remove file"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {hasNewFile && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <FileCheck size={16} className="text-cyan-400" />
                <span className="text-sm text-cyan-400">
                  New file: {hasNewFile.name}
                </span>
              </div>
              <button
                onClick={() => onFileRemove(fieldName)}
                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                title="Remove file"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-cyan-500/50 hover:bg-slate-700/30 transition-all">
            <div className="flex items-center gap-2 text-slate-400">
              <Upload size={16} />
              <span className="text-sm">
                {hasNewFile ? 'Change File' : hasExistingFile ? 'Replace File' : 'Upload File'}
              </span>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onFileChange(fieldName, e.target.files[0]);
                }
              }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
          </label>
        </div>
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
    <div className="space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
      {/* Business/Common Details */}
      {(commonData.businessName || commonData.panNumber || commonData.constitution) && (
        <SectionWrapper title="Business Information" icon={<Building size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderEditableField('Legal Name', commonData.businessName, 'businessName', 'business', <Building size={14} />)}
            {renderEditableField('Trade Name', commonData.tradeName, 'tradeName', 'business', <Briefcase size={14} />)}
            {renderEditableField('PAN Number', commonData.panNumber, 'panNumber', 'business', <FileCheck size={14} />)}
            {renderEditableField('Constitution', commonData.constitution, 'constitution', 'business', <Shield size={14} />)}
            {renderEditableField('Date of Commencement', formatDate(commonData.dateOfCommencement), 'dateOfCommencement', 'business', <Calendar size={14} />, 'date')}
          </div>
        </SectionWrapper>
      )}

      {/* Proprietor/Promoter Details */}
      {(formData.promoterName || formData.promoterFirstName || formData.fullName) && (
        <SectionWrapper
          title={`${commonData.constitution === 'Proprietorship' ? 'Proprietor' : commonData.constitution === 'Partnership' ? 'Authorized Partner' : 'Promoter'} Details`}
          icon={<User size={18} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderEditableField('Full Name', formData.promoterName || `${formData.promoterFirstName || ''} ${formData.promoterMiddleName || ''} ${formData.promoterLastName || ''}`.trim(), 'promoterName', 'promoter', <User size={14} />)}
            {renderEditableField("Father's Name", formData.promoterFatherFirstName || formData.fatherName, 'fatherName', 'promoter', <User size={14} />)}
            {renderEditableField('Date of Birth', formatDate(formData.promoterDob || formData.dob), 'dob', 'promoter', <Calendar size={14} />, 'date')}
            {renderEditableField('Mobile', formData.promoterMobile || formData.mobile, 'mobile', 'promoter', <Phone size={14} />, 'tel')}
            {renderEditableField('Email', formData.promoterEmail || formData.email, 'email', 'promoter', <Mail size={14} />, 'email')}
            {renderEditableField('Aadhaar', formData.promoterAadhaar || formData.aadhaar, 'aadhaar', 'promoter', <FileCheck size={14} />)}
            {renderFileUpload('PAN Document', 'promoterPan', existingFiles.promoterPan)}
            {renderFileUpload('Aadhaar Document', 'promoterAadhaar', existingFiles.promoterAadhaar)}
            {renderFileUpload('Photo', 'promoterPhoto', existingFiles.promoterPhoto)}
          </div>
        </SectionWrapper>
      )}

      {/* Enterprise Details (MSME) */}
      {formData.enterpriseName && (
        <SectionWrapper title="Enterprise Details" icon={<Briefcase size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderEditableField('Enterprise Name', formData.enterpriseName, 'enterpriseName', 'enterprise', <Building size={14} />)}
            {renderEditableField('Organisation Type', formData.orgType, 'orgType', 'enterprise', <Shield size={14} />)}
            {renderEditableField('Social Category', formData.socialCategory, 'socialCategory', 'enterprise', <User size={14} />)}
            {renderEditableField('Gender', formData.gender, 'gender', 'enterprise', <User size={14} />)}
            {renderEditableField('Specially Abled', formData.speciallyAbled === 'yes' ? 'Yes' : 'No', 'speciallyAbled', 'enterprise', <CheckCircle2 size={14} />)}
            {renderEditableField('Major Activity', formData.majorActivity, 'majorActivity', 'enterprise', <Briefcase size={14} />)}
            {renderEditableField('Investment (₹)', formData.investment, 'investment', 'enterprise', <CreditCard size={14} />)}
            {renderEditableField('Turnover (₹)', formData.turnover, 'turnover', 'enterprise', <CreditCard size={14} />)}
            {renderEditableField('Employees', formData.employees, 'employees', 'enterprise', <Users size={14} />)}
          </div>
        </SectionWrapper>
      )}

      {/* Address Details */}
      {(formData.flatNumber || formData.addressLine1) && (
        <SectionWrapper title="Business Address" icon={<MapPin size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderEditableField('Address Line 1', formData.flatNumber || formData.addressLine1, 'addressLine1', 'address', <Home size={14} />)}
            {renderEditableField('Address Line 2', formData.roadStreet || formData.premisesName, 'addressLine2', 'address', <Home size={14} />)}
            {renderEditableField('Area/Locality', formData.areaLocality, 'areaLocality', 'address', <MapPin size={14} />)}
            {renderEditableField('City/District', getDistrictName(formData.district || formData.city), 'district', 'address', <MapPin size={14} />)}
            {renderEditableField('State', getStateName(formData.state), 'state', 'address', <Globe size={14} />)}
            {renderEditableField('Pincode', formData.pincode, 'pincode', 'address', <Hash size={14} />)}
            {application.propertyType && renderEditableField('Property Type', application.propertyType === 'owned' ? 'Owned' : 'Rented/Leased', 'propertyType', 'address', <Home size={14} />)}
            {renderFileUpload('Address Proof', 'addressProof', existingFiles.addressProof)}
            {renderFileUpload('Electricity Bill', 'elecBill', existingFiles.elecBill)}
            {renderFileUpload('Rent Agreement', 'rentAgreement', existingFiles.rentAgreement)}
          </div>
        </SectionWrapper>
      )}

      {/* Business Details */}
      {formData.natureOfBusiness && (
        <SectionWrapper title="Business Details" icon={<Briefcase size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderEditableField('Nature of Business', formData.natureOfBusiness, 'natureOfBusiness', 'businessDetails', <Briefcase size={14} />)}
            {formData.gstin && renderEditableField('GSTIN', formData.gstin, 'gstin', 'businessDetails', <FileCheck size={14} />)}
            {renderFileUpload('GST Certificate', 'gstin', existingFiles.gstin)}
            {renderFileUpload('Trade License', 'tradeLicense', existingFiles.tradeLicense)}
            {renderFileUpload('MSME Certificate', 'msmeCertificate', existingFiles.msmeCertificate)}
          </div>
        </SectionWrapper>
      )}

      {/* Directors */}
      {directors.length > 0 && (
        <SectionWrapper title={`Directors (${directors.length})`} icon={<Users size={18} />}>
          <div className="space-y-4">
            {directors.map((director: any, idx: number) => (
              <div key={director.id || idx} className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${director.isPrimary ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-700/50 text-slate-400'}`}>
                    {director.isPrimary && '★ '}Director {idx + 1}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderEditableField('Full Name', `${director.firstName || ''} ${director.middleName || ''} ${director.lastName || ''}`.trim(), `director-${director.id}-name`, 'directors', <User size={14} />)}
                  {renderEditableField("Father's Name", `${director.fatherName?.firstName || ''} ${director.fatherName?.middleName || ''} ${director.fatherName?.lastName || ''}`.trim(), `director-${director.id}-father`, 'directors', <User size={14} />)}
                  {renderEditableField('Designation', director.designation, `director-${director.id}-designation`, 'directors', <Briefcase size={14} />)}
                  {renderEditableField('Mobile', director.mobile, `director-${director.id}-mobile`, 'directors', <Phone size={14} />, 'tel')}
                  {renderEditableField('Email', director.email, `director-${director.id}-email`, 'directors', <Mail size={14} />, 'email')}
                  {director.sharePercentage && renderEditableField('Share %', `${director.sharePercentage}%`, `director-${director.id}-share`, 'directors', <CreditCard size={14} />)}
                  {renderFileUpload('PAN Document', `director-${director.id}-pan`, director.panFile)}
                  {renderFileUpload('Aadhaar Document', `director-${director.id}-aadhaar`, director.aadhaarFile)}
                  {renderFileUpload('Photo', `director-${director.id}-photo`, director.photoFile)}
                </div>
              </div>
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* Partners */}
      {partners.length > 0 && (
        <SectionWrapper title={`Partners (${partners.length})`} icon={<Users size={18} />}>
          <div className="space-y-4">
            {partners.map((partner: any, idx: number) => (
              <div key={partner.id || idx} className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center gap-2 mb-4">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderEditableField('Full Name', `${partner.firstName || ''} ${partner.middleName || ''} ${partner.lastName || ''}`.trim(), `partner-${partner.id}-name`, 'partners', <User size={14} />)}
                  {renderEditableField("Father's Name", `${partner.fatherName?.firstName || ''} ${partner.fatherName?.middleName || ''} ${partner.fatherName?.lastName || ''}`.trim(), `partner-${partner.id}-father`, 'partners', <User size={14} />)}
                  {renderEditableField('Designation', partner.designation, `partner-${partner.id}-designation`, 'partners', <Briefcase size={14} />)}
                  {renderEditableField('Mobile', partner.mobile, `partner-${partner.id}-mobile`, 'partners', <Phone size={14} />, 'tel')}
                  {renderEditableField('Email', partner.email, `partner-${partner.id}-email`, 'partners', <Mail size={14} />, 'email')}
                  {partner.panNumber && renderEditableField('PAN', partner.panNumber, `partner-${partner.id}-pan`, 'partners', <FileCheck size={14} />)}
                  {partner.aadhaarNumber && renderEditableField('Aadhaar', partner.aadhaarNumber, `partner-${partner.id}-aadhaar`, 'partners', <FileCheck size={14} />)}
                  {partner.sharePercentage && renderEditableField('Share %', `${partner.sharePercentage}%`, `partner-${partner.id}-share`, 'partners', <CreditCard size={14} />)}
                  {renderFileUpload('PAN Document', `partner-${partner.id}-pan`, partner.panFile)}
                  {renderFileUpload('Aadhaar Document', `partner-${partner.id}-aadhaar`, partner.aadhaarFile)}
                  {renderFileUpload('Photo', `partner-${partner.id}-photo`, partner.photoFile)}
                </div>
              </div>
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* Signatory Details */}
      {signatoryDetails && (
        <SectionWrapper title="Authorized Signatory" icon={<FileSignature size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderEditableField('Full Name', `${signatoryDetails.firstName || ''} ${signatoryDetails.middleName || ''} ${signatoryDetails.lastName || ''}`.trim(), 'signatoryName', 'signatory', <User size={14} />)}
            {renderEditableField("Father's Name", `${signatoryDetails.fatherFirstName || ''} ${signatoryDetails.fatherMiddleName || ''} ${signatoryDetails.fatherLastName || ''}`.trim(), 'signatoryFather', 'signatory', <User size={14} />)}
            {renderEditableField('Mobile', signatoryDetails.mobile, 'signatoryMobile', 'signatory', <Phone size={14} />, 'tel')}
            {renderEditableField('Email', signatoryDetails.email, 'signatoryEmail', 'signatory', <Mail size={14} />, 'email')}
            {renderFileUpload('Signatory PAN', 'signPan', existingFiles.signPan)}
            {renderFileUpload('Signatory Aadhaar', 'signAadhaar', existingFiles.signAadhaar)}
            {renderFileUpload('Signatory Photo', 'signPhoto', existingFiles.signPhoto)}
            {renderFileUpload('Authorization Letter', 'signAuthLetter', existingFiles.signAuthLetter)}
          </div>
        </SectionWrapper>
      )}

      {/* Additional Documents */}
      {Object.keys(groupedDocuments).length > 0 && (
        <SectionWrapper title="Uploaded Documents" icon={<FileText size={18} />}>
          {Object.entries(groupedDocuments).map(([category, docs]) => (
            <div key={category} className="space-y-4 mb-6 last:mb-0">
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
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 capitalize truncate" title={formatDocumentName(key)}>
                          {formatDocumentName(key)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        title="View"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <label className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer">
                        <Upload size={16} />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              onFileChange(key, e.target.files[0]);
                            }
                          }}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        />
                      </label>
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

export default EditApplicationForm;