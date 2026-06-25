import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { PRICING_CONFIG, calculateTotalWithGST } from '../data/pricingConfig';
import { initiateRazorpayPayment, RazorpaySuccessResponse } from '../services/razorpayService';

interface RequirementDoc {
  name: string;
  description: string;
  details: string[];
  category: string;
  servicePath?: string;
  serviceLabel?: string;
  important?: boolean;
}

interface RequirementServiceConfig {
  slug: string;
  serviceId: string;
  title: string;
  portalLabel: string;
  feeKey: string;
  landingPath: string;
  formPath: string;
  startMode?: 'payment' | 'service-panel';
  typeLabels?: Record<string, string>;
  documents: Record<string, RequirementDoc[]>;
  linkedService?: {
    title: string;
    servicePath: string;
    serviceLabel: string;
    summary: string[];
  };
}

const linkedDsc = {
  title: 'Need DSC before this filing?',
  servicePath: '/services/dsc-registration',
  serviceLabel: 'DSC Registration',
  summary: [
    'Class 3 Individual Signing DSC for the authorised signer.',
    'Valid USB token or approved e-token with name matching PAN/Aadhaar records.',
    'Government portal association may be required before signing forms.',
    'Signing + Encryption DSC is useful for tenders and encrypted portal submissions.',
  ],
};

const commonKyc = (person = 'Applicant'): RequirementDoc[] => [
  {
    name: `${person} PAN Card`,
    description: 'Primary identity and tax proof.',
    details: ['PAN name should match the application details.', 'A clear self-attested copy may be requested.'],
    category: 'KYC',
  },
  {
    name: `${person} Aadhaar Card`,
    description: 'Address/KYC proof used for verification.',
    details: ['Mobile linked to Aadhaar should be accessible for OTP when required.', 'Use the same name format across supporting documents.'],
    category: 'KYC',
  },
  {
    name: 'Mobile Number and Email ID',
    description: 'Used for portal OTPs, acknowledgements, and communication.',
    details: ['Keep both active until filing and approval are complete.', 'Use an email ID you can access immediately.'],
    category: 'Contact',
  },
];

const serviceConfigs: Record<string, RequirementServiceConfig> = {
  'company-registration': {
    slug: 'company-registration',
    serviceId: 'company-registration',
    title: 'Company Registration',
    portalLabel: 'MCA portal filing',
    feeKey: 'company-registration',
    landingPath: '/services/company-registration',
    formPath: '/services/company-registration/form',
    typeLabels: { pvt_ltd: 'Private Limited Company Registration', llp: 'LLP Registration' },
    linkedService: {
      ...linkedDsc,
      title: 'Need DSC before company registration?',
      summary: [
        'Class 3 Individual DSC for each proposed director/designated partner.',
        'DSC must be valid and associated on MCA V3 before signing forms.',
        'Signer name should match PAN/Aadhaar records.',
        'Signing + Encryption DSC is optional, but useful for tender or encrypted portal work.',
      ],
    },
    documents: {
      pvt_ltd: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Class 3 Individual DSC is required to sign MCA incorporation forms.',
          details: [
            'Needed for every proposed director or authorized subscriber who signs SPICe+ / linked MCA forms.',
            'The DSC must be valid, active on a USB token or approved e-token, and associated with the signer on the MCA V3 portal.',
            'For company incorporation, an Individual Signing DSC is normally required. Signing + Encryption DSC is safer if the same user will later handle tenders or portals that require encryption.',
          ],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'PAN Card of Directors',
          description: 'Identity proof for each proposed director and shareholder.',
          details: ['Self-attested copy required for each Indian director and subscriber.', 'PAN details must match the name used in MCA forms.'],
          category: 'Director KYC',
        },
        {
          name: 'Aadhaar Card of Directors',
          description: 'KYC proof for Indian directors and subscribers.',
          details: ['Self-attested copy required for Indian applicants.', 'Mobile and email used for OTP/KYC should be accessible.'],
          category: 'Director KYC',
        },
        {
          name: 'Passport-size Photo',
          description: 'Clear recent photo for each director.',
          details: ['Recent color photograph with clear face.', 'White or plain background preferred.'],
          category: 'Director KYC',
        },
        {
          name: 'Registered Office Proof',
          description: 'Address proof for the company registered office.',
          details: [
            'Latest electricity, water, gas, telephone, or internet bill for the office address.',
            'Owner NOC is needed if the premises is owned by another person.',
            'Rent agreement or lease deed is needed for rented premises.',
            'Ownership proof may be requested when the office is owned.',
          ],
          category: 'Office',
        },
        {
          name: 'Business Activity and Capital Details',
          description: 'Details needed for SPICe+, MOA, AOA, PAN, TAN, and linked registrations.',
          details: [
            'Two or three proposed company names.',
            'Main object and business activity description.',
            'Authorized capital, paid-up capital, shareholding ratio, and nominal share value.',
            'Registered email ID and mobile number for the company.',
          ],
          category: 'Company Details',
        },
        {
          name: 'MOA and AOA Information',
          description: 'Information required to draft Memorandum and Articles of Association.',
          details: [
            'Object clause, subscriber details, share subscription, and governance preferences.',
            'Our team can draft the standard MOA/AOA from the details submitted in the form.',
          ],
          category: 'Incorporation Drafting',
        },
      ],
      llp: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Class 3 Individual DSC is required to sign MCA LLP forms.',
          details: [
            'Needed for every designated partner or authorized signer filing FiLLiP / linked MCA forms.',
            'The DSC must be valid, active on a USB token or approved e-token, and associated with the signer on the MCA V3 portal.',
            'For LLP incorporation, an Individual Signing DSC is normally required. Signing + Encryption DSC is safer if the same user will later handle tenders or portals that require encryption.',
          ],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'PAN Card of Partners',
          description: 'Identity proof for every partner.',
          details: ['Self-attested copy required for each Indian partner.', 'PAN details must match the name used in MCA forms.'],
          category: 'Partner KYC',
        },
        {
          name: 'Aadhaar Card of Partners',
          description: 'KYC proof for Indian designated partners.',
          details: ['Self-attested copy required for Indian applicants.', 'Mobile and email used for OTP/KYC should be accessible.'],
          category: 'Partner KYC',
        },
        {
          name: 'Passport-size Photo',
          description: 'Clear recent photo for every partner.',
          details: ['Recent color photograph with clear face.', 'White or plain background preferred.'],
          category: 'Partner KYC',
        },
        {
          name: 'Registered Office Proof',
          description: 'Address proof for the LLP registered office.',
          details: [
            'Latest electricity, water, gas, telephone, or internet bill for the office address.',
            'Owner NOC is needed if the premises is owned by another person.',
            'Rent agreement or lease deed is needed for rented premises.',
            'Ownership proof may be requested when the office is owned.',
          ],
          category: 'Office',
        },
        {
          name: 'LLP Business and Contribution Details',
          description: 'Business activity, capital contribution, profit sharing ratio, and LLP agreement details.',
          details: [
            'Two or three proposed LLP names.',
            'Business activity description.',
            'Partner contribution amount and profit sharing ratio.',
            'LLP agreement details. Agreement filing is required after incorporation within the applicable timeline.',
          ],
          category: 'LLP Details',
        },
      ],
    },
  },
  'gst-registration': {
    slug: 'gst-registration',
    serviceId: 'gst-registration',
    title: 'GST Registration',
    portalLabel: 'GST portal filing',
    feeKey: 'gst',
    landingPath: '/services/gst-registration',
    formPath: '/services/gst-registration/form',
    startMode: 'service-panel',
    typeLabels: {
      shops: 'GST Registration - Shops & Retail',
      proprietorship: 'GST Registration - Proprietorship',
      partnership: 'GST Registration - Partnership Firm',
      llp: 'GST Registration - LLP',
      pvt_ltd: 'GST Registration - Private Limited Company',
    },
    documents: {
      shops: [
        ...commonKyc('Proprietor / Authorised Person'),
        {
          name: 'Business Place Proof',
          description: 'Proof for the principal place of business.',
          details: ['Latest electricity bill, property tax receipt, or rent agreement.', 'Owner NOC if the property is rented or owned by another person.', 'Clear shop/office address with PIN code.'],
          category: 'Business Place',
        },
        {
          name: 'Trade Name and Business Activity',
          description: 'Basic details for GST registration.',
          details: ['Trade name to be used on GST certificate.', 'Goods/services supplied and HSN/SAC details if available.', 'Expected turnover and state of operation.'],
          category: 'Business Details',
        },
        {
          name: 'Bank Account Proof',
          description: 'Proof of business bank account when available.',
          details: ['Cancelled cheque, passbook, or bank statement.', 'Account holder name should match applicant or business.'],
          category: 'Bank',
        },
      ],
      proprietorship: [],
      partnership: [
        ...commonKyc('Partner / Authorised Signatory'),
        {
          name: 'Partnership Deed and Firm PAN',
          description: 'Entity proof for partnership GST filing.',
          details: ['Partnership deed copy.', 'Firm PAN card.', 'Authorisation letter for the GST signatory.'],
          category: 'Entity Proof',
        },
        {
          name: 'Business Place and Bank Proof',
          description: 'Address and bank documents for the firm.',
          details: ['Latest utility bill and rent agreement/NOC if applicable.', 'Cancelled cheque or bank statement in firm name.'],
          category: 'Business Proof',
        },
      ],
      llp: [
        ...commonKyc('Designated Partner / Signatory'),
        {
          name: 'LLP Incorporation Documents',
          description: 'Entity documents needed for GST registration.',
          details: ['Certificate of Incorporation.', 'LLP PAN card.', 'LLP Agreement and board/partner authorisation.'],
          category: 'Entity Proof',
        },
        {
          name: 'Business Place and Bank Proof',
          description: 'Address and bank documents for the LLP.',
          details: ['Latest utility bill and rent agreement/NOC if applicable.', 'Cancelled cheque or bank statement in LLP name.'],
          category: 'Business Proof',
        },
      ],
      pvt_ltd: [
        ...commonKyc('Director / Authorised Signatory'),
        {
          name: 'Company Incorporation Documents',
          description: 'Company documents needed for GST registration.',
          details: ['Certificate of Incorporation.', 'Company PAN card.', 'MOA/AOA and board resolution or authorisation letter.'],
          category: 'Entity Proof',
        },
        {
          name: 'Business Place and Bank Proof',
          description: 'Address and bank documents for the company.',
          details: ['Latest utility bill and rent agreement/NOC if applicable.', 'Cancelled cheque or bank statement in company name.'],
          category: 'Business Proof',
        },
      ],
    },
  },
  'msme-registration': {
    slug: 'msme-registration',
    serviceId: 'msme-registration',
    title: 'MSME / Udyam Registration',
    portalLabel: 'Udyam portal filing',
    feeKey: 'msme',
    landingPath: '/services/msme-registration',
    formPath: '/services/msme-registration/form',
    startMode: 'service-panel',
    typeLabels: { pvt_ltd: 'MSME - Private Limited Company', proprietorship: 'MSME - Proprietorship', llp: 'MSME - LLP', partnership: 'MSME - Partnership Firm' },
    documents: {
      proprietorship: [
        ...commonKyc('Proprietor'),
        {
          name: 'Business Details',
          description: 'Details required for Udyam classification.',
          details: ['Business name and address.', 'NIC code/business activity.', 'Investment in plant/machinery/equipment and annual turnover.'],
          category: 'Business Details',
        },
        {
          name: 'Bank Details',
          description: 'Bank information for the enterprise.',
          details: ['Account number and IFSC.', 'Cancelled cheque or bank statement if requested.'],
          category: 'Bank',
        },
      ],
      pvt_ltd: [
        ...commonKyc('Director / Authorised Signatory'),
        {
          name: 'Company PAN and Incorporation Certificate',
          description: 'Entity proof for Udyam registration.',
          details: ['Company PAN.', 'Certificate of Incorporation.', 'Authorised signatory details.'],
          category: 'Entity Proof',
        },
        {
          name: 'Business Classification Details',
          description: 'Details used to classify Micro, Small, or Medium enterprise.',
          details: ['NIC code/business activity.', 'Investment and annual turnover.', 'Business address and bank details.'],
          category: 'Business Details',
        },
      ],
      llp: [],
      partnership: [],
    },
  },
  'dsc-registration': {
    slug: 'dsc-registration',
    serviceId: 'dsc-registration',
    title: 'Digital Signature Certificate',
    portalLabel: 'DSC issuance and video KYC',
    feeKey: 'dsc',
    landingPath: '/services/dsc-registration',
    formPath: '/services/dsc-registration/form',
    typeLabels: { individual: 'Individual DSC', organization: 'Organisation DSC' },
    documents: {
      individual: [
        ...commonKyc('Applicant'),
        {
          name: 'Passport-size Photo',
          description: 'Recent photograph for DSC verification.',
          details: ['Clear face with plain background.', 'Photo should match the applicant identity documents.'],
          category: 'Photo',
        },
        {
          name: 'Video KYC Readiness',
          description: 'The applicant must complete verification personally.',
          details: ['Applicant should be available for video verification.', 'Original PAN/Aadhaar should be available during verification.'],
          category: 'Verification',
        },
      ],
      organization: [
        ...commonKyc('Authorised Signatory'),
        {
          name: 'Organisation Proof',
          description: 'Entity documents required for organisation DSC.',
          details: ['Certificate of Incorporation/registration proof.', 'Organisation PAN.', 'Authorisation letter or board resolution.'],
          category: 'Entity Proof',
        },
      ],
    },
  },
  'startup-india': {
    slug: 'startup-india',
    serviceId: 'startup-india',
    title: 'Startup India Registration',
    portalLabel: 'DPIIT recognition filing',
    feeKey: 'startup',
    landingPath: '/services/startup-india',
    formPath: '/services/startup-india/form',
    documents: {
      default: [
        {
          name: 'Entity Registration Proof',
          description: 'Proof that the business is eligible for DPIIT recognition.',
          details: ['Certificate of Incorporation for company/LLP.', 'Partnership deed for registered partnership firm.', 'Entity PAN card.'],
          category: 'Entity Proof',
        },
        ...commonKyc('Director / Partner'),
        {
          name: 'Startup Activity Details',
          description: 'Information used to prepare the DPIIT application.',
          details: ['Brief write-up about innovation/scalability.', 'Website or pitch deck if available.', 'Business model and product/service details.'],
          category: 'Startup Details',
        },
      ],
    },
  },
  'trademark-registration': {
    slug: 'trademark-registration',
    serviceId: 'trademark-registration',
    title: 'Trademark Registration',
    portalLabel: 'IP India trademark filing',
    feeKey: 'trademark',
    landingPath: '/services/trademark-registration',
    formPath: '/services/trademark-registration/form',
    documents: {
      default: [
        ...commonKyc('Applicant / Authorised Signatory'),
        {
          name: 'Brand Name or Logo',
          description: 'The mark that has to be searched and filed.',
          details: ['Wordmark, logo, or device mark in clear format.', 'Exact spelling and owner name.', 'Date of first use if already used.'],
          category: 'Trademark',
        },
        {
          name: 'Goods / Services Details',
          description: 'Details required to choose trademark class.',
          details: ['Description of goods/services.', 'Relevant class if already known.', 'User affidavit details if prior use is claimed.'],
          category: 'Class Details',
        },
        {
          name: 'Power of Attorney',
          description: 'TM-48 authorisation for filing.',
          details: ['Signed by applicant or authorised signatory.', 'Company/LLP seal if applicable.'],
          category: 'Authorisation',
        },
      ],
    },
  },
  'pan-registration': {
    slug: 'pan-registration',
    serviceId: 'pan-registration',
    title: 'PAN Registration',
    portalLabel: 'PAN application filing',
    feeKey: 'pan',
    landingPath: '/services/pan-registration',
    formPath: '/services/pan-registration/form',
    documents: {
      default: [
        {
          name: 'Identity Proof',
          description: 'Document proving applicant identity.',
          details: ['Aadhaar, passport, voter ID, or other accepted proof.', 'Name should match the application.'],
          category: 'KYC',
        },
        {
          name: 'Address Proof',
          description: 'Current residential or business address proof.',
          details: ['Aadhaar, bank statement, utility bill, or accepted address proof.', 'Address must include PIN code.'],
          category: 'KYC',
        },
        {
          name: 'Date of Birth / Incorporation Proof',
          description: 'DOB or entity registration proof.',
          details: ['Birth certificate, Aadhaar, passport, or incorporation certificate as applicable.'],
          category: 'Proof',
        },
        {
          name: 'Photo and Signature',
          description: 'Required for physical PAN processing.',
          details: ['Recent photo for individual applicants.', 'Signature should be clear and match application records.'],
          category: 'Applicant Details',
        },
      ],
    },
  },
  'fssai-license': {
    slug: 'fssai-license',
    serviceId: 'fssai-license',
    title: 'FSSAI License',
    portalLabel: 'FoSCoS / FSSAI filing',
    feeKey: 'fssai',
    landingPath: '/services/fssai-license',
    formPath: '/services/fssai-license/form',
    startMode: 'service-panel',
    documents: {
      default: [
        ...commonKyc('Food Business Operator'),
        {
          name: 'Food Business Details',
          description: 'Details required for the FSSAI application.',
          details: ['Food business type and product category.', 'Premises address and contact details.', 'Expected turnover and business scale.'],
          category: 'Business Details',
        },
        {
          name: 'Premises Proof',
          description: 'Address proof for food business premises.',
          details: ['Rent agreement/ownership proof or utility bill.', 'NOC if premises belongs to another person.'],
          category: 'Premises',
        },
      ],
    },
  },
  'roc-compliance': {
    slug: 'roc-compliance',
    serviceId: 'roc-compliance',
    title: 'ROC Compliance',
    portalLabel: 'MCA / linked government portal filing',
    feeKey: 'roc-package',
    landingPath: '/services/roc-compliance',
    formPath: '/services/roc-compliance/form',
    startMode: 'service-panel',
    linkedService: linkedDsc,
    typeLabels: {
      msme: 'MSME / Udyam Registration',
      dir3: 'DIR-3 KYC Filing',
      inc20a: 'INC-20A Commencement Filing',
      adt1: 'ADT-1 Auditor Appointment',
      gst: 'GST Registration',
      aoc4: 'AOC-4 Financial Statement Filing',
      mgt7a: 'MGT-7A Annual Return Filing',
    },
    documents: {
      msme: [
        ...commonKyc('Authorised Signatory'),
        {
          name: 'Company / Business Details',
          description: 'Details required for Udyam registration.',
          details: ['Business name, address, and activity.', 'NIC code if available.', 'Investment and turnover details for MSME classification.'],
          category: 'Business Details',
        },
        {
          name: 'Bank and Entity Details',
          description: 'Basic enterprise information.',
          details: ['Bank account number and IFSC.', 'Company PAN/CIN or firm proof where applicable.'],
          category: 'Entity Details',
        },
      ],
      dir3: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Required for MCA DIR-3 KYC filing.',
          details: ['Valid Class 3 DSC of the DIN holder.', 'DSC should be associated on MCA V3.'],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        ...commonKyc('DIN Holder'),
        {
          name: 'DIN and Contact Verification Details',
          description: 'Details needed for annual director KYC.',
          details: ['DIN number.', 'Mobile number and email for OTP verification.', 'Current residential address proof if changed.'],
          category: 'Director Details',
        },
      ],
      inc20a: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Required for MCA commencement filing.',
          details: ['Valid DSC of the authorised director.', 'DSC should be associated on MCA V3.'],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'Certificate of Incorporation and CIN',
          description: 'Company identification for INC-20A.',
          details: ['COI copy and CIN.', 'Company PAN if available.', 'Date of incorporation.'],
          category: 'Company Details',
        },
        {
          name: 'Share Capital Receipt Proof',
          description: 'Proof that subscribers paid share capital.',
          details: ['Bank statement showing subscription money received.', 'Subscriber payment details.', 'Board authorisation if applicable.'],
          category: 'Capital Proof',
        },
      ],
      adt1: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Required for MCA ADT-1 filing.',
          details: ['Valid DSC of the authorised director/signatory.', 'DSC should be associated on MCA V3.'],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'Auditor Consent and Eligibility',
          description: 'Documents from the appointed auditor.',
          details: ['Auditor consent letter.', 'Eligibility certificate.', 'Auditor PAN/membership or firm registration details.'],
          category: 'Auditor Details',
        },
        {
          name: 'Board Resolution',
          description: 'Company approval for auditor appointment.',
          details: ['Certified board resolution.', 'Appointment date and financial year details.', 'Company CIN and signatory details.'],
          category: 'Authorisation',
        },
      ],
      gst: [
        ...commonKyc('Director / Authorised Signatory'),
        {
          name: 'Company Incorporation Documents',
          description: 'Company documents needed for GST registration.',
          details: ['Certificate of Incorporation.', 'Company PAN card.', 'MOA/AOA and board resolution or authorisation letter.'],
          category: 'Entity Proof',
        },
        {
          name: 'Business Place and Bank Proof',
          description: 'Address and bank documents for the company.',
          details: ['Latest utility bill and rent agreement/NOC if applicable.', 'Cancelled cheque or bank statement in company name.'],
          category: 'Business Proof',
        },
      ],
      aoc4: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Required for MCA AOC-4 filing.',
          details: ['Valid DSC of authorised director/signatory.', 'DSC should be associated on MCA V3.'],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'Financial Statements',
          description: 'Audited financials for the relevant financial year.',
          details: ['Balance sheet and profit & loss statement.', 'Board report and auditor report.', 'AGM date and adoption details.'],
          category: 'Financials',
        },
        {
          name: 'Company and Auditor Details',
          description: 'Details needed to prepare the MCA filing.',
          details: ['CIN and company master details.', 'Auditor details.', 'SRN of ADT-1 if applicable.'],
          category: 'Company Details',
        },
      ],
      mgt7a: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Required for MCA annual return filing.',
          details: ['Valid DSC of authorised director/signatory.', 'DSC should be associated on MCA V3.'],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'Shareholding and Director Details',
          description: 'Annual return information for the company.',
          details: ['Shareholding pattern.', 'Director/KMP details.', 'Meeting and compliance details for the financial year.'],
          category: 'Annual Return',
        },
        {
          name: 'Company Master Details',
          description: 'Basic MCA company information.',
          details: ['CIN, registered office, and principal business activity.', 'Paid-up capital and turnover details.'],
          category: 'Company Details',
        },
      ],
    },
  },
  'trade-license': {
    slug: 'trade-license',
    serviceId: 'trade-license',
    title: 'Trade License',
    portalLabel: 'local municipal trade license filing',
    feeKey: 'trade-license',
    landingPath: '/services/trade-license',
    formPath: '/services/trade-license/form',
    documents: {
      default: [
        ...commonKyc('Business Owner / Authorised Signatory'),
        {
          name: 'Business Place Proof',
          description: 'Premises proof for the trade license application.',
          details: ['Rent agreement, ownership proof, or latest utility bill.', 'Owner NOC if the property is not owned by the applicant.'],
          category: 'Premises',
        },
        {
          name: 'Business Activity Details',
          description: 'Details required by the local authority.',
          details: ['Nature of trade/business.', 'Shop/establishment name and address.', 'Employee count and business start date if applicable.'],
          category: 'Business Details',
        },
      ],
    },
  },
  'shop-establishment-license': {
    slug: 'shop-establishment-license',
    serviceId: 'shop-establishment-license',
    title: 'Shop and Establishment License',
    portalLabel: 'Shop Act registration filing',
    feeKey: 'trade-license',
    landingPath: '/services/shop-establishment-license',
    formPath: '/services/shop-establishment-license/form',
    startMode: 'service-panel',
    typeLabels: { pvt_ltd: 'Shop Act - Private Limited Company', llp: 'Shop Act - LLP', partnership: 'Shop Act - Partnership', proprietorship: 'Shop Act - Proprietorship' },
    documents: {
      default: [
        ...commonKyc('Owner / Authorised Signatory'),
        {
          name: 'Shop or Office Address Proof',
          description: 'Premises proof for the establishment.',
          details: ['Rent agreement or ownership proof.', 'Latest electricity/property tax bill.', 'Owner NOC if applicable.'],
          category: 'Premises',
        },
        {
          name: 'Establishment Details',
          description: 'Information required for the registration certificate.',
          details: ['Business name and activity.', 'Opening date and employee count.', 'Working hours and weekly holiday details if required.'],
          category: 'Business Details',
        },
      ],
    },
  },
  'roc-package': {
    slug: 'roc-package',
    serviceId: 'roc-package',
    title: 'ROC Compliance Package',
    portalLabel: 'ROC annual compliance filing',
    feeKey: 'roc-package',
    landingPath: '/services/roc-package',
    formPath: '/services/roc-premium-package',
    startMode: 'service-panel',
    linkedService: linkedDsc,
    documents: {
      default: [
        {
          name: 'Digital Signature Certificate (DSC)',
          description: 'Required for MCA portal signing.',
          details: ['Valid Class 3 DSC of the authorised director/signatory.', 'DSC should be associated on MCA V3 where required.'],
          category: 'DSC',
          servicePath: '/services/dsc-registration',
          serviceLabel: 'DSC Registration',
          important: true,
        },
        {
          name: 'Company Master and CIN Details',
          description: 'Basic company identification details.',
          details: ['CIN, company PAN, registered office, and authorised signatory details.', 'Latest MCA master data should match records.'],
          category: 'Company Details',
        },
        {
          name: 'Financial Statements and Audit Details',
          description: 'Documents needed for annual ROC filings.',
          details: ['Audited financial statements.', 'Auditor details and reports.', 'Board/shareholder meeting details where applicable.'],
          category: 'Financials',
        },
        {
          name: 'Previous Filing Records',
          description: 'Helpful for preparing the annual package accurately.',
          details: ['Previous AOC-4/MGT-7 acknowledgements if available.', 'MSME/GST details if included in the selected package.'],
          category: 'Records',
        },
      ],
    },
  },
};

serviceConfigs['gst-registration'].documents.proprietorship = serviceConfigs['gst-registration'].documents.shops;
serviceConfigs['pan-registration'].documents.edigital = serviceConfigs['pan-registration'].documents.default;
serviceConfigs['pan-registration'].documents.ephysical = serviceConfigs['pan-registration'].documents.default;
serviceConfigs['fssai-license'].documents.basic = serviceConfigs['fssai-license'].documents.default;
serviceConfigs['fssai-license'].documents.state = serviceConfigs['fssai-license'].documents.default;
serviceConfigs['fssai-license'].documents.central = serviceConfigs['fssai-license'].documents.default;
serviceConfigs['shop-establishment-license'].documents.pvt_ltd = serviceConfigs['shop-establishment-license'].documents.default;
serviceConfigs['shop-establishment-license'].documents.llp = serviceConfigs['shop-establishment-license'].documents.default;
serviceConfigs['shop-establishment-license'].documents.partnership = serviceConfigs['shop-establishment-license'].documents.default;
serviceConfigs['shop-establishment-license'].documents.proprietorship = serviceConfigs['shop-establishment-license'].documents.default;
serviceConfigs['roc-package'].documents.standard = serviceConfigs['roc-package'].documents.default;
serviceConfigs['roc-package'].documents.premium = serviceConfigs['roc-package'].documents.default;
serviceConfigs['msme-registration'].documents.llp = serviceConfigs['msme-registration'].documents.pvt_ltd;
serviceConfigs['msme-registration'].documents.partnership = [
  ...commonKyc('Partner'),
  {
    name: 'Partnership Deed and Firm PAN',
    description: 'Entity proof for Udyam registration.',
    details: ['Partnership deed.', 'Firm PAN card.', 'Authorised partner details.'],
    category: 'Entity Proof',
  },
  {
    name: 'Business Classification Details',
    description: 'Details used to classify Micro, Small, or Medium enterprise.',
    details: ['NIC code/business activity.', 'Investment and annual turnover.', 'Business address and bank details.'],
    category: 'Business Details',
  },
];

const filingRequirements = {
  linkedService: linkedDsc,
  documents: {
    default: [
      {
        name: 'Digital Signature Certificate (DSC)',
        description: 'Required for MCA portal signing.',
        details: ['Valid Class 3 DSC of the authorised director/signatory.', 'DSC should be associated on MCA V3 where required.'],
        category: 'DSC',
        servicePath: '/services/dsc-registration',
        serviceLabel: 'DSC Registration',
        important: true,
      },
      {
        name: 'Company Master and CIN Details',
        description: 'Basic company identification details.',
        details: ['CIN, company PAN, registered office, and authorised signatory details.', 'Latest MCA master data should match records.'],
        category: 'Company Details',
      },
      {
        name: 'Board / Filing Authorisation',
        description: 'Internal approval for the filing.',
        details: ['Board resolution or authorisation where applicable.', 'Director/signatory consent and contact details.'],
        category: 'Authorisation',
      },
    ],
  },
};

[
  ['adt-1-filing', 'adt-1', 'ADT-1 Auditor Appointment', '/services/adt-1-filing', '/services/adt-1-filing/form'],
  ['inc-20a-filing', 'inc-20a', 'INC-20A Commencement Filing', '/services/inc-20a-filing', '/services/inc-20a-filing/form'],
  ['inc-22a-filing', 'inc-22a', 'INC-22A Active Filing', '/services/inc-22a-filing', '/services/inc-22a-filing/form'],
  ['dir-3-kyc-filing', 'dir-3-kyc', 'DIR-3 KYC Filing', '/services/dir-3-kyc-filing', '/services/dir-3-kyc-filing/form'],
  ['mgt-7-filing', 'mgt7', 'MGT-7 Annual Return Filing', '/services/mgt-7-filing', '/services/mgt-7-filing/form'],
  ['a0c4-filing', 'aoc4', 'AOC-4 Financial Statement Filing', '/services/a0c4-filing', '/services/a0c4-filing/form'],
].forEach(([slug, feeKey, title, landingPath, formPath]) => {
  serviceConfigs[slug] = {
    slug,
    serviceId: slug,
    title,
    portalLabel: 'MCA portal filing',
    feeKey,
    landingPath,
    formPath,
    ...filingRequirements,
  };
});

function getSelectedType(slug: string, locationState: any, search: string, config: RequirementServiceConfig) {
  const params = new URLSearchParams(search);
  const fromState = locationState?.preSelectedType || locationState?.serviceType || locationState?.dscType || locationState?.entityType;
  const fromQuery = params.get('type');
  const fallback = slug === 'company-registration' ? 'pvt_ltd' : Object.keys(config.documents)[0] || 'default';
  const selected = String(fromState || fromQuery || fallback);
  return config.documents[selected] ? selected : fallback;
}

export default function ServiceRequirementConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { serviceSlug } = useParams();
  const [confirmed, setConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const slug = serviceSlug || 'company-registration';
  const config = serviceConfigs[slug] || serviceConfigs['company-registration'];
  const selectedType = getSelectedType(slug, location.state, location.search, config);
  const documents = useMemo(() => config.documents[selectedType] || config.documents.default || [], [config, selectedType]);
  const selectedTypeLabel = config.typeLabels?.[selectedType] || config.title;
  const fee = PRICING_CONFIG[config.feeKey]?.fee ?? 0;
  const feeText = fee === 0 ? 'Free + govt charges if applicable' : `Rs. ${fee.toLocaleString()} + GST`;

  const openLinkedService = (path = config.linkedService?.servicePath) => {
    if (!path) return;
    navigate({
      pathname: path,
      search: `?returnTo=service-requirements&serviceId=${config.slug}&type=${selectedType}`,
    }, {
      state: {
        returnTo: `${config.landingPath}/requirements`,
        returnState: { preSelectedType: selectedType },
      },
    });
  };

  const continueToServicePanel = () => {
    const landingTarget = config.slug === 'roc-package'
      ? `${config.landingPath}?package=${selectedType}`
      : config.landingPath;
    navigate(landingTarget, {
      state: {
        requirementsConfirmed: true,
        autoOpenStartChoice: true,
        preSelectedType: selectedType,
        serviceType: selectedType,
      },
    });
  };

  const continueToForm = (response?: RazorpaySuccessResponse) => {
    navigate(config.formPath, {
      state: {
        paymentId: response?.razorpay_payment_id,
        orderId: response?.razorpay_order_id,
        signature: response?.razorpay_signature,
        verified: Boolean(response) || fee === 0,
        requirementsConfirmed: true,
        preSelectedType: selectedType,
        serviceType: selectedType,
        dscType: selectedType,
        entityType: selectedType,
        panType: selectedType,
        licenseType: selectedType,
        source: 'requirement-confirmed',
      },
    });
  };

  const handleContinue = async () => {
    if (!confirmed || isProcessing) return;

    if (config.startMode === 'service-panel') {
      continueToServicePanel();
      return;
    }

    if (fee <= 0) {
      continueToForm();
      return;
    }

    setIsProcessing(true);
    try {
      const started = await initiateRazorpayPayment({
        amount: calculateTotalWithGST(fee) * 100,
        currency: 'INR',
        name: `RegiBIZ - ${selectedTypeLabel}`,
        description: `${selectedTypeLabel} Service Fee Payment (Incl. 18% GST)`,
        prefill: {
          name: localStorage.getItem('userName') || '',
          email: localStorage.getItem('userEmail') || '',
          contact: localStorage.getItem('userPhone') || '',
        },
        notes: {
          serviceId: config.serviceId,
          type: selectedType,
          source: 'requirement-confirmation',
          timestamp: new Date().toISOString(),
        },
        handler: continueToForm,
        onClosed: () => setIsProcessing(false),
      });

      if (!started) setIsProcessing(false);
    } catch (error) {
      console.error('Payment initiation failed:', error);
      alert('Failed to initiate payment. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-12">
        <button
          type="button"
          onClick={() => navigate(config.landingPath, { state: { preSelectedType: selectedType } })}
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to service
        </button>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="min-w-0">
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <ShieldCheck size={14} />
              <span className="truncate">Requirement confirmation</span>
            </div>
            <h1 className="mb-4 text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-5xl">
              Check {config.title} requirements before payment
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              These are the specific documents and details needed for {selectedTypeLabel}. Review them before starting the form so the filing can move smoothly.
            </p>

            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <h2 className="text-sm font-bold text-foreground">Government portal requirement</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The form can be started only after you confirm that you have these documents, or that you will obtain any missing service-linked documents before filing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Building2 size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected service</p>
                <h2 className="mt-1 break-words text-base font-black text-foreground sm:text-lg">{selectedTypeLabel}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Service fee: {feeText}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{config.portalLabel}</p>
              </div>
            </div>
          </aside>
        </section>

        {config.linkedService && (
          <section className="mt-8 overflow-hidden rounded-xl border border-primary/35 bg-card shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <button
                type="button"
                onClick={() => openLinkedService()}
                className="group flex h-full min-w-0 flex-col items-start justify-between gap-5 bg-gradient-to-br from-primary/20 via-primary/10 to-accent p-5 text-left transition hover:from-primary/25 hover:via-primary/15 hover:to-accent md:p-6"
              >
                <div className="min-w-0">
                  <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/30 bg-card/80 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary shadow-sm">
                    <KeyRound size={14} />
                    <span className="truncate">Available in RegiBIZ</span>
                  </div>
                  <h2 className="break-words text-xl font-black text-foreground sm:text-2xl">{config.linkedService.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {config.linkedService.serviceLabel} is available as a separate RegiBIZ service. Open it first if you do not already have the required certificate.
                  </p>
                </div>
                <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-center text-sm font-black text-primary-foreground shadow-glow-cyan transition group-hover:translate-x-1 sm:w-auto">
                  <span className="min-w-0 break-words">Open {config.linkedService.serviceLabel}</span>
                  <ExternalLink size={16} />
                </span>
              </button>

              <div className="p-5 md:p-6">
                <h3 className="text-lg font-black text-foreground">{config.linkedService.serviceLabel} notes</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {config.linkedService.summary.map((item) => (
                    <div key={item} className="rounded-lg border border-border bg-secondary/70 p-3">
                      <div className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <p className="text-sm leading-5 text-muted-foreground">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <FileCheck2 className="h-5 w-5 text-primary" />
              <h2 className="text-base font-black text-foreground sm:text-lg">Mandatory documents and details</h2>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required for {config.portalLabel}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((doc) => (
              <div
                key={`${doc.category}-${doc.name}`}
                className={`rounded-lg border p-4 ${doc.important ? 'border-primary/45 bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-secondary/60'}`}
              >
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{doc.category}</p>
                    {doc.servicePath ? (
                      <button
                        type="button"
                        onClick={() => openLinkedService(doc.servicePath)}
                        className="inline-flex max-w-full items-center gap-2 text-left text-sm font-black text-primary hover:text-foreground hover:underline sm:text-base"
                      >
                        <span className="min-w-0 break-words">{doc.name}</span>
                        <ExternalLink className="flex-shrink-0" size={14} />
                      </button>
                    ) : (
                      <h3 className="text-sm font-bold text-foreground">{doc.name}</h3>
                    )}
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{doc.description}</p>
                    {doc.serviceLabel && (
                      <button
                        type="button"
                        onClick={() => openLinkedService(doc.servicePath)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-primary transition hover:bg-primary/20 sm:w-auto"
                      >
                        <span className="min-w-0 break-words">Available in RegiBIZ: {doc.serviceLabel}</span>
                        <ExternalLink className="flex-shrink-0" size={13} />
                      </button>
                    )}
                    <ul className="mt-3 space-y-2">
                      {doc.details.map((detail) => (
                        <li key={detail} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          <span className="min-w-0 break-words">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border bg-background text-primary"
            />
            <span className="text-sm leading-6 text-muted-foreground">
              I confirm that I have reviewed the required documents for {selectedTypeLabel}. If any required service-linked document is missing, I will obtain it before filing.
            </span>
          </label>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!confirmed || isProcessing}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-primary px-5 py-3 text-center text-sm font-bold text-primary-foreground shadow-glow-cyan transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening payment
                </>
              ) : (
                <>
                  {config.startMode === 'service-panel' ? 'Continue to service' : fee === 0 ? 'Continue to form' : 'Continue to payment'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            {config.linkedService && (
              <button
                type="button"
                onClick={() => openLinkedService()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3 text-center text-sm font-bold text-primary transition hover:bg-primary/15 sm:min-h-0"
            >
              <CheckCircle2 size={16} />
                <span className="min-w-0 break-words">Apply for {config.linkedService.serviceLabel} first</span>
            </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}