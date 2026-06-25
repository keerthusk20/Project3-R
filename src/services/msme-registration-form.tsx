// src/services/msme-registration/form.tsx
// Pattern: MSME Registration Form — dark slate theme (matching DSC / GST-LLP forms),
// progress sidebar, multi-step, preview modal, OTP modal, processing overlay
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { doc, setDoc, getDoc, deleteDoc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateServiceId } from '../utils/helpers';
import { sendConfirmationEmail } from './emailService';
import FormBackButton from '../components/FormBackButton';


// ============================================================================
// TYPES & DATA
// ============================================================================
interface FormData {
  enterpriseName: string;
  orgType: string;
  majorActivity: string;
  socialCategory: string;
  speciallyAbled: string;
  pan: string;
  aadhaarNumber: string;
  gstin?: string;
  cin?: string;
  llpin?: string;
  investment: string;
  turnover: string;
  employees: string;
  dateOfIncorporation: string;
  dateOfCommencement: string;
  email: string;
  mobile: string;
  altMobile: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  propertyType: string;
  bankName: string;
  bankBranch: string;
  ifscCode: string;
  accountNumber: string;
  hasUdyam?: string;
  udyamNumber?: string;
  nicCode: string;
  financialYear: string;  
  consent1: boolean;
  consent2: boolean;
}

interface Director {
  id: number;
  isPrimary: boolean;
  position: string;
  firstName: string; middleName: string; lastName: string;
  fatherFirstName: string; fatherMiddleName: string; fatherLastName: string;
  mobile: string; email: string;
  aadhaar: File | null; pan: File | null; photo: File | null;
  aadhaarFileName?: string | null;
  panFileName?: string | null;
  photoFileName?: string | null;
}

interface Partner {
  id: number;
  firstName: string; middleName: string; lastName: string;
  mobile: string; email: string; aadhaarNumber: string;
  aadhaar: File | null; pan: File | null;
  aadhaarFileName?: string | null;
  panFileName?: string | null;
}

// Step Labels — matching GST-LLP structure
const STEP_LABELS = [
  'Identity & KYC',
  'Business & Financials',
  'Address Information',
  'Contact & Bank',
  'Documents & Declaration',
];

const fyOptions = (() => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const isAfterMarch = now.getMonth() >= 3; // April onwards
  const years = [];
  const startYear = isAfterMarch ? currentYear : currentYear - 1;
  
  for (let i = 0; i < 3; i++) {
    const y = startYear - i;
    const label = `FY ${y}-${String(y + 1).slice(-2)}`;
    const value = `${y}-${String(y + 1).slice(-2)}`;
    years.push({ value, label });
  }
  return years;
})();

const initialData: FormData = {
  enterpriseName: '', orgType: '', majorActivity: '', socialCategory: '',
  speciallyAbled: '', pan: '', aadhaarNumber: '', gstin: '', cin: '', llpin: '',
  investment: '', turnover: '', employees: '', 
  dateOfIncorporation: '', dateOfCommencement: '',
  email: '', mobile: '', altMobile: '',
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
  propertyType: '', bankName: '', bankBranch: '', ifscCode: '', accountNumber: '',
  hasUdyam: '', udyamNumber: '', nicCode: '', financialYear: fyOptions[0].value,
  consent1: false, consent2: false,
};

const orgTypeOptions = [
  { value: 'proprietorship', label: 'Proprietorship (Individual)' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'pvtltd', label: 'Private Limited Company' },
  { value: 'llp', label: 'Limited Liability Partnership' },
];

const majorActivityOptions = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'services', label: 'Services' },
];

const socialCategoryOptions = [
  { value: 'general', label: 'General' }, { value: 'obc', label: 'OBC' },
  { value: 'bc', label: 'BC' }, { value: 'sc', label: 'SC' },
  { value: 'st', label: 'ST' }, { value: 'ews', label: 'EWS' },
  { value: 'minority', label: 'Minority' },
];

const stateOptions = [
  { value: 'AP', label: 'Andhra Pradesh' }, { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' }, { value: 'BR', label: 'Bihar' },
  { value: 'CT', label: 'Chhattisgarh' }, { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' }, { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' }, { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' }, { value: 'KL', label: 'Kerala' },
  { value: 'MP', label: 'Madhya Pradesh' }, { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' }, { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' }, { value: 'NL', label: 'Nagaland' },
  { value: 'OD', label: 'Odisha' }, { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' }, { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' }, { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' }, { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' }, { value: 'WB', label: 'West Bengal' },
  { value: 'DL', label: 'Delhi' }, { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'LA', label: 'Ladakh' }, { value: 'PY', label: 'Puducherry' },
  { value: 'CH', label: 'Chandigarh' }, { value: 'AN', label: 'Andaman & Nicobar' },
  { value: 'DN', label: 'Dadra and Nagar Haveli' }, { value: 'DD', label: 'Daman and Diu' },
  { value: 'LD', label: 'Lakshadweep' },
];

const stateDistrictData: Record<string, string[]> = {
  'TN': ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'MH': ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
  'KA': ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'],
  'GJ': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
  'UP': ['Agra', 'Aligarh', 'Allahabad', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kheri', 'Kushinagar', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjhanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
  'RJ': ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  'DL': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'WB': ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'],
  'KL': ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'],
  'TG': ['Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'],
  'AP': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  'PB': ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar', 'Sangrur', 'Shaheed Bhagat Singh Nagar', 'Tarn Taran'],
  'HR': ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  'MP': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Rewa', 'Satna', 'Ratlam', 'Dewas', 'Chhindwara', 'Betul', 'Hoshangabad', 'Morena', 'Bhind', 'Katni', 'Datia', 'Damoh', 'Balaghat', 'Shivpuri', 'Mandsaur', 'Vidisha', 'Narsinghpur', 'Sehore', 'Neemuch', 'Rajgarh', 'Dhar', 'Khandwa', 'Khargone', 'Barwani', 'Jhabua', 'Alirajpur', 'Anuppur', 'Umaria', 'Shahdol', 'Mandla', 'Dindori', 'Seoni', 'Panna', 'Chhatarpur', 'Tikamgarh', 'Ashoknagar', 'Guna', 'Sheopur', 'Sidhi', 'Singrauli'],
  'BR': ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
  'PY': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
  'AS': ['Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
  'CT': ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur', 'Surguja'],
  'OD': ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
  'JH': ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
  'HP': ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
  'UK': ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
  'JK': ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'],
  'LA': ['Kargil', 'Leh'],
  'GA': ['North Goa', 'South Goa'],
  'AR': ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai', 'Pakke Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'],
  'MN': ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
  'ML': ['East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'North Garo Hills', 'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'],
  'MZ': ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
  'NL': ['Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Noklak', 'Peren', 'Phek', 'Tuensang', 'Wokha', 'Zunheboto'],
  'SK': ['East Sikkim', 'North Sikkim', 'South Sikkim', 'West Sikkim'],
  'TR': ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'],
  'AN': ['Nicobar', 'North and Middle Andaman', 'South Andaman'],
  'CH': ['Chandigarh'],
  'DN': ['Dadra and Nagar Haveli'],
  'DD': ['Daman', 'Diu'],
  'LD': ['Lakshadweep'],
};

const bankOptions = [
  { value: 'State Bank of India', label: 'State Bank of India (SBI)' },
  { value: 'HDFC Bank', label: 'HDFC Bank' },
  { value: 'ICICI Bank', label: 'ICICI Bank' },
  { value: 'Axis Bank', label: 'Axis Bank' },
  { value: 'Punjab National Bank', label: 'Punjab National Bank (PNB)' },
  { value: 'Bank of Baroda', label: 'Bank of Baroda' },
  { value: 'Canara Bank', label: 'Canara Bank' },
  { value: 'Union Bank of India', label: 'Union Bank of India' },
  { value: 'Indian Bank', label: 'Indian Bank' },
  { value: 'IDFC Bank', label: 'IDFC Bank' },
  { value: 'Kotak Mahindra Bank', label: 'Kotak Mahindra Bank' },
];

const propertyTypeOptions = [
  { value: 'Owned Property', label: 'Owned Property' },
  { value: 'Rented Property', label: 'Rented Property' },
  { value: 'Leased Property', label: 'Leased Property' },
];


const getMsmeCategory = (investment: string, turnover: string) => {
  const inv = parseFloat(investment) || 0;
  const turn = parseFloat(turnover) || 0;

  if (inv === 0 && turn === 0) return null;

  const oneCr = 10000000;
  const fiveCr = 50000000;
  const tenCr = 100000000;
  const fiftyCr = 500000000;
  const twoFiftyCr = 2500000000;

  if (inv <= oneCr && turn <= fiveCr) return { label: 'Micro Enterprise', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (inv <= tenCr && turn <= fiftyCr) return { label: 'Small Enterprise', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
  if (inv <= fiftyCr && turn <= twoFiftyCr) return { label: 'Medium Enterprise', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  
  return { label: 'Beyond MSME Limits', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
};

// ============================================================================
// SEQUENTIAL ID GENERATOR
// ============================================================================
const generateSequentialFormId = async (prefix: string = 'MSME', year: number): Promise<string> => {
  const counterId = `${prefix.toLowerCase()}_ids_${year}`;
  const counterRef = doc(db, 'counters', counterId);

  try {
    const nextCount = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      let count = 1;
      if (snap.exists()) {
        const data = snap.data();
        const currentCount = Number(data.count || data.current || 0);
        count = currentCount + 1;
      }
      transaction.set(counterRef, {
        count,
        year: Number(year),
        prefix,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return count;
    });
    return `${prefix}-${year}-${String(nextCount).padStart(2, '0')}`;
  } catch (err) {
    console.warn("Counter transaction failed, using fallback:", err);
    const fallbackCount = Math.floor(Math.random() * 900) + 1;
    return `${prefix}-${year}-${String(fallbackCount).padStart(2, '0')}`;
  }
};
// ============================================================================
// COMPONENTS
// ============================================================================
const FreeCornerRibbon = () => (
  <div
    aria-label="Free service"
    className="absolute top-5 -right-11 z-20 w-40 rotate-45 border border-white/35 bg-gradient-to-r from-emerald-700 via-green-500 to-emerald-800 py-2 text-center text-[14px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(22,163,74,0.38)] pointer-events-none"
  >
    FREE
  </div>
);

// ============================================================================
// VALIDATORS
// ============================================================================
const validators = {
  required: (v: string, f = 'This field') => (v && v.trim().length > 0) || `${f} is required`,
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email address',
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v) || 'Invalid 10-digit mobile (starts 6–9)',
  aadhaar: (v: string) => /^\d{12}$/.test(v) || 'Aadhaar must be 12 digits',
  pan: (v: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) || 'Invalid PAN (e.g., ABCDE1234F)',
  pincode: (v: string) => /^\d{6}$/.test(v) || 'Pincode must be 6 digits',
  ifsc: (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) || 'Invalid IFSC code',
  accountNumber: (v: string) => /^\d{9,18}$/.test(v) || 'Account number must be 9–18 digits',
  number: (v: string) => /^\d+(\.\d{1,2})?$/.test(v) || 'Enter valid numeric value',
  cin: (v: string) => !v || /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(v) || 'Invalid CIN format',
  llpin: (v: string) => !v || /^[A-Z]{2}-[0-9]{6}$/.test(v) || 'Invalid LLPIN (e.g., AA-123456)',
  gstin: (v: string) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v) || 'Invalid GSTIN (e.g., 22AAAAA0000A1Z5)',
};

// ============================================================================
// UI COMPONENTS — defined outside main to prevent focus loss
// ============================================================================

// ── InfoTooltip ──────────────────────────────────────────────────────────────
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-white hover:text-orange-400 transition-colors focus:outline-none">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {show && (
        <div className="absolute left-full top-0 ml-2 w-72 p-3 bg-slate-900/40 border border-slate-700 text-white text-xs rounded-lg shadow-xl z-50">
          {text}
          <div className="absolute left-0 top-3 -ml-1 w-2 h-2 bg-slate-900/40 border-l border-b border-slate-700 transform rotate-45" />
        </div>
      )}
    </div>
  );
};

// ── FormInput ────────────────────────────────────────────────────────────────
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; error?: string; hint?: string; optional?: boolean; infoText?: string;
}
const FormInput: React.FC<FormInputProps> = ({ label, error, hint, optional, infoText, id, required, ...props }) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-white font-medium">Optional</span>}
      </div>
      <input id={inputId}
        className={`w-full bg-[#031f31] border text-white text-sm rounded-lg block p-3 placeholder-slate-400 shadow-sm transition-all focus:ring-2 focus:outline-none focus:bg-[#031f31] ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
        required={required} {...props} />
      {error
        ? <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>
        : hint ? <p className="mt-1.5 text-xs text-white font-mono">{hint}</p> : null}
    </div>
  );
};

// ── FormSelect ───────────────────────────────────────────────────────────────
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string; options: { value: string; label: string }[];
  error?: string; optional?: boolean; infoText?: string;
}
const FormSelect: React.FC<FormSelectProps> = ({ label, options, error, optional, infoText, id, required, value, ...props }) => {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={selectId} className="block text-sm font-medium text-white">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-white font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select id={selectId} value={value}
          className={`w-full bg-[#031f31] border text-white text-sm rounded-lg block p-3 pr-10 appearance-none shadow-sm transition-all focus:ring-2 focus:outline-none focus:bg-[#031f31] cursor-pointer ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'}`}
          required={required} {...props}>
          <option value="" disabled className="bg-slate-900 text-white">Select an option</option>
          {options.map(o => <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>}
    </div>
  );
};

// ── FileUploader ─────────────────────────────────────────────────────────────
const FileUploader: React.FC<{
  label: string; name: string; required?: boolean; optional?: boolean;
  uploadedFile: File | null; onChange: (f: File | null) => void;
  infoText?: string; accept?: string; hint?: string; error?: string;
  fileName?: string | null;
  existingUrl?: string; // New prop for persistence
}> = ({ label, name, required, optional, uploadedFile, onChange, infoText, accept = '.pdf,.jpg,.jpeg,.png', hint, error, fileName: externalFileName, existingUrl }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
  const displayName = uploadedFile?.name || externalFileName || (existingUrl ? existingUrl.split('/').pop()?.split('?')[0] : null);

  const process = (f: File | null) => {
    if (!f) { onChange(null); return; }
    if (f.size > 2 * 1024 * 1024) { 
      showNotification('File must be under 2MB', 'error');
      return; 
    }
    onChange(f);
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label className={`block text-sm font-medium ${optional && !required ? 'text-white' : 'text-white'}`}>
            {label}{required && <span className="text-red-500">*</span>}
            {optional && !required && <span className="text-xs text-slate-200 ml-2">(Optional)</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files?.[0] || null); }}
        className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragging ? 'border-cyan-500 bg-cyan-500/10' : displayName ? 'border-emerald-500/50 bg-emerald-500/5' : error ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}>
        <input ref={inputRef} type="file" name={name} accept={accept} className="hidden"
          onChange={e => process(e.target.files?.[0] || null)} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 ${displayName ? 'bg-emerald-500/20 text-emerald-400' : error ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-white'}`}>
            {displayName
              ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
          </div>
          <div className="flex-1 min-w-0">
            {displayName
              ? <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{displayName}</p>
                <p className="text-xs text-white mt-0.5">
                  {uploadedFile ? 'Ready for upload' : existingUrl ? <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline" onClick={e => e.stopPropagation()}>View existing document</a> : ''}
                </p>
              </div>
              : <div><p className="text-sm font-medium text-slate-300">Click or drag to upload</p><p className="text-xs text-white mt-0.5">{hint || 'PDF, JPG, PNG — Max 2MB'}</p></div>}
          </div>
          {displayName && (
            <button type="button" onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
              className="p-1.5 hover:bg-red-500/20 text-white hover:text-red-400 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</p>}
    </div>
  );
};

// ── Section Legend (matching DSC/GST-LLP style) ───────────────────────────────
const SectionLegend: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-lg font-semibold text-white uppercase tracking-wider border-b border-slate-700/50 pb-2 mb-6 w-full flex items-center">
    <span className="bg-gradient-to-r from-heading-from to-heading-to w-1 h-5 mr-3 rounded-full inline-block" />
    {title}
  </div>
);

// ── Status Banner (matching GST-LLP) ─────────────────────────────────────────
const StatusBanner: React.FC<{ formId: string }> = ({ formId }) => (
  <div className="bg-gradient-to-r from-orange-900/30 to-orange-800/10 border border-orange-500/20 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none" />
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-white font-medium line-through text-lg">₹499</span>
        <span className="text-white font-bold text-2xl tracking-tight drop-shadow-sm">FREE</span>
        <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">Limited Offer</span>
      </div>
      <p className="text-white text-sm mt-1">MSME / Udyam Registration | Service Charges Applicable</p>
      <p className="text-sky-400 text-xs mt-2 font-medium flex items-center">
        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        OTP/Aadhaar verification will be done by Support Team after submission.
      </p>
    </div>
    <div className="text-left sm:text-right z-10">
      <p className="text-xs font-semibold text-white uppercase tracking-wider">Case Reference</p>
      <p className="text-white font-mono font-bold text-lg md:text-xl tracking-wider">{formId || '—'}</p>
    </div>
  </div>
);

// ── Progress Sidebar (matching GST-LLP exactly) ───────────────────────────────
const ProgressSidebar: React.FC<{
  currentStep: number;
  docSubStep: number;
  uploadedCount: number;
  totalDocs: number;
  formData: FormData;
  onPreview: () => void;
  isDraftSaving: boolean;
  lastDraftSavedAt: Date | null;
}> = ({ currentStep, docSubStep, uploadedCount, totalDocs, formData, onPreview, isDraftSaving, lastDraftSavedAt }) => {
  const steps = STEP_LABELS.map((label, i) => ({ label, step: i }));
  return (
    <div className="space-y-6 hidden lg:block">
      {/* Progress */}
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
          <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </span>
          Progress Status
        </h3>
        {lastDraftSavedAt && (
          <div className="mb-4 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              {isDraftSaving ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving Draft...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Draft Saved
                </>
              )}
            </span>
            {!isDraftSaving && (
              <span className="text-[9px] text-white font-medium opacity-60">
                {lastDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
        <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
          {steps.map(({ label, step }) => {
            const status = step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending';
            return (
              <div key={step} className="ml-5 relative">
                <span className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : status === 'active' ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110' : 'bg-slate-700'}`} />
                <h4 className={`text-sm font-medium ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-white'}`}>{label}</h4>
                <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
                  {step === 4
                    ? `${uploadedCount}/${totalDocs} Docs • Step ${docSubStep === 3 && formData.orgType === 'proprietorship' ? 2 : docSubStep}/${formData.orgType === 'proprietorship' ? 2 : 3}`
                    : status === 'completed' ? 'Completed'
                      : status === 'active' ? 'In Progress' : 'Pending'}
                </p>
                {step === 4 && status === 'active' && (
                  <div className="mt-2 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min((uploadedCount / Math.max(totalDocs, 1)) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Entity info */}
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-amber-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </span>
          Entity Information
        </h3>
        <div className="space-y-2 text-xs">
          {formData.enterpriseName && <div><span className="text-white">Business Name:</span><p className="text-white font-medium mt-0.5 truncate">{formData.enterpriseName}</p></div>}
          {formData.orgType && <div><span className="text-white">Constitution:</span><p className="text-white mt-0.5">{orgTypeOptions.find(o => o.value === formData.orgType)?.label || formData.orgType}</p></div>}
          {formData.pan && <div><span className="text-white">PAN:</span><p className="text-white font-mono mt-0.5">{formData.pan}</p></div>}
        </div>
        <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">✓ MSME / Udyam Registration</div>
      </div>

      {/* Support */}
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-rose-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </span>
          Support Verification
        </h3>
        <p className="text-xs text-white leading-relaxed mb-3">Our team will contact you on the provided mobile for OTP/Aadhaar verification after submission.</p>
        <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5">
          <span className="text-white font-medium text-xs">contact Support</span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
            <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
          </div>
        </div>
      </div>

      {/* Preview button — single button in sidebar like GST-LLP */}
      <div className="pt-2">
        <button onClick={onPreview}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600/50 text-emerald-400 font-bold tracking-wide shadow-lg hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Preview Application
        </button>
      </div>
    </div>
  );
};

// ── Modals ───────────────────────────────────────────────────────────────────
const ConfirmModal: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
      </div>
      <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} className="px-6 py-2.5 bg-gradient-to-r from-teal-700 to-blue-900 hover:from-teal-600 hover:to-blue-800 text-white font-medium rounded-lg transition-colors">Confirm</button>
      </div>
    </div>
  </div>
);

// OTP Modal — matching GST-LLP exactly
const OTPModal: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-white">OTP Verification</h3>
      </div>
      <p className="text-slate-300 mb-6 leading-relaxed">
        During MSME registration, you will receive a <strong>6-digit OTP</strong> from the Udyam portal on your <strong>Aadhaar-linked mobile number</strong>. Our support team will contact you once the application is initiated. Please keep your phone handy.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} className="px-6 py-2.5 bg-gradient-to-r from-teal-700 to-blue-900 hover:from-teal-600 hover:to-blue-800 text-white font-medium rounded-lg transition-colors">I Understand, Proceed</button>
      </div>
    </div>
  </div>
);

// Processing Overlay — matching GST-LLP exactly
const ProcessingOverlay: React.FC = () => (
  <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
      <div className="w-16 h-16 mx-auto mb-6">
        <svg className="animate-spin w-full h-full text-cyan-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
      <p className="text-white text-sm">Please wait while we submit your application.</p>
      <p className="text-white text-xs mt-1">Do not close this window.</p>
    </div>
  </div>
);

const ErrorToast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-red-500/90 backdrop-blur-sm border border-red-400 rounded-xl p-4 shadow-2xl max-w-md flex items-start gap-3">
        <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-white text-sm flex-1">{message}</p>
        <button onClick={onClose} className="text-white/70 hover:text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
interface MsmeRegistrationFormProps {
  user: any;
  packageMode?: boolean;
  onComplete?: (data: any) => void;
  onBack?: () => void;
  initialData?: any;
  existingDocs?: any;
}

export default function MsmeRegistrationForm({ user, packageMode, onComplete, onBack, initialData, existingDocs }: MsmeRegistrationFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const routeState = location.state as { startNewApplication?: boolean; source?: string } | null;
  const shouldStartNewApplication =
    searchParams.get('mode') === 'new' ||
    routeState?.startNewApplication === true ||
    (typeof window !== 'undefined' && sessionStorage.getItem('msme_start_new_application') === 'true');
  const [formData, setFormData] = useState<FormData>({
    ...initialData,
    enterpriseName: initialData?.enterpriseName || '',
    orgType: initialData?.orgType || '',
    majorActivity: initialData?.majorActivity || '',
    socialCategory: initialData?.socialCategory || '',
    speciallyAbled: initialData?.speciallyAbled || '',
    pan: initialData?.pan || '',
    aadhaarNumber: initialData?.aadhaarNumber || '',
    gstin: initialData?.gstin || '',
    cin: initialData?.cin || '',
    llpin: initialData?.llpin || '',
    investment: initialData?.investment || '',
    turnover: initialData?.turnover || '',
    employees: initialData?.employees || '',
    dateOfIncorporation: initialData?.dateOfIncorporation || '',
    dateOfCommencement: initialData?.dateOfCommencement || '',
    email: initialData?.email || '',
    mobile: initialData?.mobile || '',
    altMobile: initialData?.altMobile || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    propertyType: initialData?.propertyType || '',
    bankName: initialData?.bankName || '',
    bankBranch: initialData?.bankBranch || '',
    ifscCode: initialData?.ifscCode || '',
    accountNumber: initialData?.accountNumber || '',
    hasUdyam: initialData?.hasUdyam || '',
    udyamNumber: initialData?.udyamNumber || '',
    nicCode: initialData?.nicCode || '',
    financialYear: initialData?.financialYear || fyOptions[0].value,
    consent1: initialData?.consent1 || false,
    consent2: initialData?.consent2 || false,
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});

  // Steps 0–4 matching GST-LLP pattern
  const [currentStep, setCurrentStep] = useState(0);
  const [docSubStep, setDocSubStep] = useState(1); // 1=Business Entity, 2=Directors/Partners, 3=Declaration+Signature

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formId, setFormId] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Files — all as normal FileUploader, no special DSC scanner
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    panCard: null, addressProof: null, bankProof: null, turnoverInvoice: null,
    bankStatement: null, gstin: null, incorporationCert: null, coi: null, moa: null,
    aoa: null, inc20a: null, boardResolution: null, llpDeed: null,
    partnershipDeed: null, udyamCertificate: null,
    signatureUpload: null, // ← renamed from digitalSignature / DSC scanner
  });

  const [uploadedFileNames, setUploadedFileNames] = useState<Record<string, string>>({});

  const [directors, setDirectors] = useState<Director[]>(initialData?.directors || [{
    id: Date.now(), isPrimary: true, position: '', firstName: '', middleName: '', lastName: '',
    fatherFirstName: '', fatherMiddleName: '', fatherLastName: '', mobile: '', email: '',
    aadhaar: null, pan: null, photo: null,
  }]);

  const [partners, setPartners] = useState<Partner[]>(initialData?.partners || [{
    id: Date.now(), firstName: '', middleName: '', lastName: '',
    mobile: '', email: '', aadhaarNumber: '', aadhaar: null, pan: null,
  }]);

  // ── On mount: generate Form ID ─────────────────────────────────────────────
  useEffect(() => {
    const generate = async () => {
      try {
        // First check for existing draft
        if (user?.uid) {
          if (shouldStartNewApplication) {
            await deleteDoc(doc(db, 'drafts', `msme_${user.uid}`)).catch(() => undefined);
            const id = await generateSequentialFormId('MSME', new Date().getFullYear());
            setFormId(id);
            return;
          }

          if (typeof window !== 'undefined' && sessionStorage.getItem('msme_ignore_draft_after_submit') === 'true') {
            const id = await generateSequentialFormId('MSME', new Date().getFullYear());
            setFormId(id);
            return;
          }

          const draftRef = doc(db, 'drafts', `msme_${user.uid}`);
          const draftSnap = await getDoc(draftRef);
          
          if (draftSnap.exists()) {
            const draftData = draftSnap.data();
            setFormData(p => ({ ...p, ...draftData.formData }));
            setCurrentStep(draftData.currentStep || 0);
            setDocSubStep(draftData.docSubStep || 1);
            setFormId(draftData.caseId || `MSME-${new Date().getFullYear()}-01`);
            
            if (draftData.directors) {
              setDirectors(draftData.directors.map((d: any) => ({
                ...d,
                aadhaar: null,
                pan: null,
                photo: null,
                aadhaarFileName: d.aadhaarFileName,
                panFileName: d.panFileName,
                photoFileName: d.photoFileName
              })));
            }
            if (draftData.partners) {
              setPartners(draftData.partners.map((p: any) => ({
                ...p,
                aadhaar: null,
                pan: null,
                aadhaarFileName: p.aadhaarFileName,
                panFileName: p.panFileName
              })));
            }
            if (draftData.uploadedFileNames) {
              setUploadedFileNames(draftData.uploadedFileNames);
            }
            
            setLastDraftSavedAt(draftData.updatedAt?.toDate() || new Date());
            return; // Skip ID generation if draft exists
          }
        }

        const id = await generateSequentialFormId('MSME', new Date().getFullYear());
        setFormId(id);
      } catch (err: any) {
        // Handle permission denied - this happens if the draft document doesn't exist 
        // or if Firestore Security Rules are not configured to allow the user to read 'drafts'
        if (err.code === 'permission-denied') {
          console.warn("MSME Draft access denied. Ensure Firestore Rules allow read on 'drafts/msme_{uid}' and 'counters/msme_ids_{year}'", err.message);
        } else {
          console.error("Error loading MSME draft/generating ID:", err);
        }
        setFormId(`MSME-${new Date().getFullYear()}-01`);
      } finally {
        setIsInitialLoading(false);
      }
    };
    generate();
  }, [user?.uid, shouldStartNewApplication]);

  useEffect(() => {
    if (formData.state) {
      setAvailableDistricts(stateDistrictData[formData.state] || []);
    } else {
      setAvailableDistricts([]);
    }
  }, [formData.state]);

  // ── Exit Confirmation Logic ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSuccess || isExiting) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isSuccess || isExiting) return;
      // Block navigation and show custom confirm
      window.history.pushState(null, '', window.location.href);
      setShowExitConfirm(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSuccess]);

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave) {
      setIsDraftSaving(true);
      try {
        await saveDraft();
        setShowDraftSuccessModal(true);
        setTimeout(() => {
          setShowDraftSuccessModal(false);
          setIsExiting(true);
          navigate('/services/msme-registration');
        }, 1500);
      } catch (err) {
        console.error("Exit save failed:", err);
        setShowExitConfirm(false);
      } finally {
        setIsDraftSaving(false);
      }
    } else {
      setIsExiting(true);
      navigate('/services/msme-registration');
    }
  };

  const isDSCRequired = formData.orgType === 'llp' || formData.orgType === 'pvtltd';

  // ── Doc count helpers ──────────────────────────────────────────────────────
  const getTotalDocs = () => {
    let n = 4; // panCard, addressProof, bankProof, signatureUpload
    if (formData.orgType === 'pvtltd') n += 4 + directors.length * 3; // coi+moa+aoa+inc20a + per director
    if (formData.orgType === 'llp') n += 2; // llpDeed + incorporationCert
    if (formData.orgType === 'partnership') n += 1 + partners.length * 2; // partnershipDeed + per partner
    if (formData.majorActivity === 'manufacturing') n += 1;
    if (formData.hasUdyam === 'yes') n += 1;
    return n;
  };

  const getUploadedCount = () => {
    let n = 0;
    Object.values(uploadedFiles).forEach(f => { if (f) n++; });
    directors.forEach(d => {
      if (d.aadhaar) n++;
      if (d.pan) n++;
      if (d.photo) n++;
    });
    partners.forEach(p => {
      if (p.aadhaar) n++;
      if (p.pan) n++;
    });
    return n;
  };

  // ── Field handlers ─────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let v: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    if (name === 'pan' || name === 'cin' || name === 'llpin' || name === 'ifscCode' || name === 'gstin') v = (v as string).toUpperCase();
    if (name === 'mobile' || name === 'altMobile' || name === 'aadhaarNumber') v = (v as string).replace(/\D/g, '').slice(0, name === 'aadhaarNumber' ? 12 : 10);
    if (name === 'pincode' || name === 'accountNumber') v = (v as string).replace(/\D/g, '').slice(0, name === 'pincode' ? 6 : 18);
    if (name === 'pan') v = (v as string).slice(0, 10);
    setFormData(p => ({ ...p, [name]: v }));
    if (touched[name]) setErrors(p => ({ ...p, [name]: validateField(name, v) }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setTouched(p => ({ ...p, [name]: true }));
    setErrors(p => ({ ...p, [name]: validateField(name, v) }));
  };

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'enterpriseName': case 'orgType': case 'majorActivity': case 'socialCategory':
      case 'bankName': case 'bankBranch': case 'propertyType': case 'addressLine1': case 'state':
        return validators.required(value) === true ? '' : validators.required(value) as string;
      case 'pan': return validators.pan(value) === true ? '' : validators.pan(value) as string;
      case 'aadhaarNumber': return validators.aadhaar(value) === true ? '' : validators.aadhaar(value) as string;
      case 'email': return validators.email(value) === true ? '' : validators.email(value) as string;
      case 'mobile': return validators.mobile(value) === true ? '' : validators.mobile(value) as string;
      case 'pincode': return validators.pincode(value) === true ? '' : validators.pincode(value) as string;
      case 'ifscCode': return validators.ifsc(value) === true ? '' : validators.ifsc(value) as string;
      case 'accountNumber': return !value ? 'Account number is required' : validators.accountNumber(value) === true ? '' : validators.accountNumber(value) as string;
      case 'investment': case 'turnover': case 'employees': return validators.number(value) === true ? '' : validators.number(value) as string;
      case 'cin': return validators.cin(value) === true ? '' : validators.cin(value) as string;
      case 'llpin': return validators.llpin(value) === true ? '' : validators.llpin(value) as string;
      case 'gstin': return validators.gstin(value) === true ? '' : validators.gstin(value) as string;
      case 'city': return formData.state && !value ? 'City/District is required' : '';
      case 'dateOfIncorporation': 
        if (formData.orgType === 'proprietorship') return '';
        return !value ? 'Date of incorporation is required' : '';
      case 'dateOfCommencement': return !value ? 'Date of commencement is required' : '';
      case 'nicCode': return validators.required(value) === true ? '' : 'NIC Code is required';
      case 'financialYear': return validators.required(value) === true ? '' : 'Financial Year is required';
      case 'speciallyAbled': return validators.required(value) === true ? '' : 'This field is required';
      case 'consent1': case 'consent2': return value ? '' : 'Declaration is required';
      default: return '';
    }
  };

  const validateStep = (step: number): boolean => {
    const fieldMap: Record<number, string[]> = {
      0: ['enterpriseName', 'orgType', 'pan', 'aadhaarNumber', 'socialCategory', 'speciallyAbled'],
      1: ['majorActivity', 'investment', 'turnover', 'employees', 'dateOfIncorporation', 'dateOfCommencement', 'nicCode', 'financialYear'],
      2: ['addressLine1', 'state', 'city', 'pincode', 'propertyType'],
      3: ['email', 'mobile', 'bankName', 'bankBranch', 'ifscCode', 'accountNumber'],
      4: ['consent1', 'consent2'],
    };
    const fields = fieldMap[step] || [];
    const newErrors: Record<string, string> = {};
    fields.forEach(k => { const e = validateField(k, (formData as any)[k]); if (e) newErrors[k] = e; });
    setErrors(p => ({ ...p, ...newErrors }));
    setTouched(p => { const t = { ...p }; fields.forEach(f => (t[f] = true)); return t; });
    return Object.keys(newErrors).length === 0;
  };

  const validateDocSubStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    let ok = true;

    if (docSubStep === 1) {
      if (!uploadedFiles.panCard && !existingDocs?.panCard) { newErrors['panCard'] = 'PAN Card is required'; ok = false; }
      if (!uploadedFiles.addressProof && !existingDocs?.addressProof) { newErrors['addressProof'] = 'Address Proof is required'; ok = false; }
      if (!uploadedFiles.bankProof && !existingDocs?.bankProof) { newErrors['bankProof'] = 'Bank Proof (Cancelled Cheque) is required'; ok = false; }
      if (formData.orgType === 'pvtltd') {
        if (!uploadedFiles.coi && !existingDocs?.coi) { newErrors['coi'] = 'COI is required'; ok = false; }
        if (!uploadedFiles.moa && !existingDocs?.moa) { newErrors['moa'] = 'MOA is required'; ok = false; }
        if (!uploadedFiles.aoa && !existingDocs?.aoa) { newErrors['aoa'] = 'AOA is required'; ok = false; }
        if (!uploadedFiles.inc20a && !existingDocs?.inc20a) { newErrors['inc20a'] = 'INC-20A is required'; ok = false; }
      }
      if (formData.orgType === 'llp') {
        if (!uploadedFiles.llpDeed && !existingDocs?.llpDeed) { newErrors['llpDeed'] = 'LLP Deed is required'; ok = false; }
        if (!uploadedFiles.incorporationCert && !existingDocs?.incorporationCert) { newErrors['incorporationCert'] = 'Incorporation Certificate is required'; ok = false; }
      }
      if (formData.orgType === 'partnership') {
        if (!uploadedFiles.partnershipDeed && !existingDocs?.partnershipDeed) { newErrors['partnershipDeed'] = 'Partnership Deed is required'; ok = false; }
      }
      if (formData.hasUdyam === 'yes' && !uploadedFiles.udyamCertificate && !existingDocs?.udyamCertificate) {
        newErrors['udyamCertificate'] = 'Existing Udyam Certificate is required'; ok = false;
      }
    }

    if (docSubStep === 2) {
      if (formData.orgType === 'pvtltd') {
        const hasPrimary = directors.some(d => d.isPrimary);
        if (!hasPrimary) { newErrors['primaryDirector'] = 'Please select a Primary Director'; ok = false; }
        directors.forEach((d, i) => {
          if (!d.firstName.trim()) { newErrors[`dir-${d.id}-firstName`] = 'First Name required'; ok = false; }
          if (!d.lastName.trim()) { newErrors[`dir-${d.id}-lastName`] = 'Last Name required'; ok = false; }
          if (!d.mobile || d.mobile.length !== 10) { newErrors[`dir-${d.id}-mobile`] = 'Valid mobile required'; ok = false; }
          if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { newErrors[`dir-${d.id}-email`] = 'Valid email required'; ok = false; }
          if (!d.aadhaar && !existingDocs?.[`director_${d.id}_aadhaar`]) { newErrors[`dir-${d.id}-aadhaar`] = 'Aadhaar required'; ok = false; }
          if (!d.pan && !existingDocs?.[`director_${d.id}_pan`]) { newErrors[`dir-${d.id}-pan`] = 'PAN required'; ok = false; }
          if (!d.photo && !existingDocs?.[`director_${d.id}_photo`]) { newErrors[`dir-${d.id}-photo`] = 'Photo required'; ok = false; }
        });
      }
      if (formData.orgType === 'partnership' || formData.orgType === 'llp') {
        const hasPrimary = partners.length > 0;
        if (!hasPrimary) { setErrorMsg('At least one partner is required.'); return false; }
        partners.forEach(p => {
          if (!p.firstName.trim()) { newErrors[`par-${p.id}-firstName`] = 'First Name required'; ok = false; }
          if (!p.lastName.trim()) { newErrors[`par-${p.id}-lastName`] = 'Last Name required'; ok = false; }
          if (!p.mobile || p.mobile.length !== 10) { newErrors[`par-${p.id}-mobile`] = 'Valid mobile required'; ok = false; }
          if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { newErrors[`par-${p.id}-email`] = 'Valid email required'; ok = false; }
          if (!p.aadhaar && !existingDocs?.[`partner_${p.id}_aadhaar`]) { newErrors[`par-${p.id}-aadhaar`] = 'Aadhaar required'; ok = false; }
          if (!p.pan && !existingDocs?.[`partner_${p.id}_pan`]) { newErrors[`par-${p.id}-pan`] = 'PAN required'; ok = false; }
        });
      }
    }

    if (docSubStep === 3) {
      if (!formData.consent1) { newErrors['consent1'] = 'Authorization consent is required'; ok = false; }
      if (!formData.consent2) { newErrors['consent2'] = 'Declaration consent is required'; ok = false; }
      if (isDSCRequired && !uploadedFiles.signatureUpload && !existingDocs?.signatureUpload) {
        newErrors['signatureUpload'] = `Signature Upload is mandatory for ${formData.orgType === 'llp' ? 'LLP' : 'Pvt Ltd'}`; ok = false;
      }
    }

    setErrors(p => ({ ...p, ...newErrors }));
    if (!ok) setErrorMsg('Please complete all required fields before proceeding.');
    return ok;
  };

  // ── Draft Saving ──────────────────────────────────────────────────────────
  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid) return;
    setIsDraftSaving(true);
    try {
      const draftData = {
        userId: user.uid,
        userEmail: user.email || '',
        userMobile: formData.mobile || '',
        serviceType: 'msme',
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        docSubStep,
        uploadedFileNames,
        directors: directors.map(d => ({ 
          ...d, 
          aadhaar: null, pan: null, photo: null,
          aadhaarFileName: d.aadhaarFileName || (d.aadhaar instanceof File ? d.aadhaar.name : null),
          panFileName: d.panFileName || (d.pan instanceof File ? d.pan.name : null),
          photoFileName: d.photoFileName || (d.photo instanceof File ? d.photo.name : null)
        })),
        partners: partners.map(p => ({ 
          ...p, 
          aadhaar: null, pan: null,
          aadhaarFileName: p.aadhaarFileName || (p.aadhaar instanceof File ? p.aadhaar.name : null),
          panFileName: p.panFileName || (p.pan instanceof File ? p.pan.name : null)
        })),
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: formId,
      };
      await setDoc(doc(db, 'drafts', `msme_${user.uid}`), draftData, { merge: true });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error("Draft save failed:", err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (currentStep === 4) {
      // Document step — handle sub-steps
      if (!validateDocSubStep()) return;
      if (docSubStep < 3) {
        const nextSub = (docSubStep === 1 && formData.orgType === 'proprietorship') ? 3 : docSubStep + 1;
        setDocSubStep(nextSub);
        await saveDraft();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // On last sub-step complete → show OTP modal → submit
      setShowOTPModal(true);
      return;
    }
    if (!validateStep(currentStep)) return;
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    await saveDraft(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (currentStep === 4 && docSubStep > 1) {
      const prevSub = (docSubStep === 3 && formData.orgType === 'proprietorship') ? 1 : docSubStep - 1;
      setDocSubStep(prevSub);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentStep === 0) {
      navigate(-1);
      return;
    }
    setCurrentStep(p => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // ── File handler ───────────────────────────────────────────────────────────
  const handleFileUpload = (key: string) => (file: File | null) => {
    setUploadedFiles(p => ({ ...p, [key]: file }));
    setUploadedFileNames(p => ({ ...p, [key]: file ? file.name : '' }));
    setErrors(p => ({ ...p, [key]: undefined }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const executeSubmission = async () => {
    if (!user?.uid) { setErrorMsg('You must be logged in to submit.'); return; }
    setIsSubmitting(true);
    try {
      const docRef = doc(collection(db, 'applications'));
      const fid = docRef.id;
      const fileUrls: Record<string, any> = { ...existingDocs };

      for (const [k, file] of Object.entries(uploadedFiles)) {
        if (file) {
          const path = `msme-applications/${user.uid}/${fid}/${k}_${Date.now()}.${file.name.split('.').pop()}`;
          const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
          const url = await getDownloadURL(snap.ref);
          fileUrls[k] = {
            url,
            name: file.name,
            type: file.type,
            uploadedAt: new Date()
          };
        }
      }
      // Director files
      for (const d of directors) {
        for (const [fk, file] of [['aadhaar', d.aadhaar], ['pan', d.pan], ['photo', d.photo]] as [string, File | null][]) {
          if (file) {
            const path = `msme-applications/${user.uid}/${fid}/director_${d.id}_${fk}_${Date.now()}.${file.name.split('.').pop()}`;
            const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
            const url = await getDownloadURL(snap.ref);
            fileUrls[`director_${d.id}_${fk}`] = {
              url,
              name: file.name,
              type: file.type,
              uploadedAt: new Date()
            };
          }
        }
      }
      // Partner files
      for (const p of partners) {
        for (const [fk, file] of [['aadhaar', p.aadhaar], ['pan', p.pan]] as [string, File | null][]) {
          if (file) {
            const path = `msme-applications/${user.uid}/${fid}/partner_${p.id}_${fk}_${Date.now()}.${file.name.split('.').pop()}`;
            const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
            const url = await getDownloadURL(snap.ref);
            fileUrls[`partner_${p.id}_${fk}`] = {
              url,
              name: file.name,
              type: file.type,
              uploadedAt: new Date()
            };
          }
        }
      }

      const submissionData = {
        id: fid, caseId: formId, type: 'msme', title: 'MSME Registration',
        serviceId: generateServiceId('MSME'), status: 'submitted',
        submittedAt: serverTimestamp(), createdAt: Date.now(),
        paymentId: 'FREE_SUBMISSION', formData,
        directors: formData.orgType === 'pvtltd' ? directors.map(d => ({ ...d, aadhaar: null, pan: null, photo: null })) : [],
        partners: (formData.orgType === 'partnership' || formData.orgType === 'llp') ? partners.map(p => ({ ...p, aadhaar: null, pan: null })) : [],
        uploadedFileUrls: fileUrls, userId: user.uid, folderId: 'regibiz',
      };

      if (packageMode && onComplete) {
        onComplete(submissionData);
        return;
      }

      await setDoc(doc(db, 'applications', fid), submissionData);
      
      // Clear draft on successful submission
      try {
        await deleteDoc(doc(db, 'drafts', `msme_${user.uid}`));
      } catch (err) {
        console.error("Failed to delete draft:", err);
      }
      sessionStorage.setItem('msme_ignore_draft_after_submit', 'true');
      sessionStorage.removeItem('msme_start_new_application');

      await sendConfirmationEmail({
        name: formData.enterpriseName,
        email: user.email || '',
        service: "MSME Registration",
        caseId: formId
      });

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // STEP RENDERS
  // ============================================================================

  const renderStep0 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Identity & KYC Details" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">All details must match exactly with your <strong>PAN</strong> and <strong>Aadhaar</strong> records for Udyam portal verification.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Legal Name of Business (as per PAN)" name="enterpriseName" value={formData.enterpriseName}
          onChange={handleChange} onBlur={handleBlur} error={errors.enterpriseName}
          placeholder="e.g., RegiBIZ Enterprises" required
          infoText="Must match exactly with PAN Card." />
        <FormSelect label="Type of Organization" name="orgType" value={formData.orgType}
          onChange={handleChange} onBlur={handleBlur} error={errors.orgType}
          options={orgTypeOptions} required
          infoText="Select your business structure. This determines required documents." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="PAN Number" name="pan" value={formData.pan}
          onChange={handleChange} onBlur={handleBlur} error={errors.pan}
          placeholder="ABCDE1234F" maxLength={10} required hint="Format: ABCDE1234F"
          infoText="For proprietorship, enter individual PAN. For others, enter business PAN." />
        <FormInput label="Aadhaar Number (Authorized Signatory)" name="aadhaarNumber" value={formData.aadhaarNumber}
          onChange={handleChange} onBlur={handleBlur} error={errors.aadhaarNumber}
          placeholder="12-digit Aadhaar" maxLength={12} required
          hint="Support team will verify via OTP"
          infoText="Aadhaar of Proprietor / Managing Partner / Director as applicable." />
      </div>
      {formData.orgType === 'pvtltd' && (
        <FormInput label="Corporate Identification Number (CIN)" name="cin" value={formData.cin || ''}
          onChange={handleChange} onBlur={handleBlur} error={errors.cin}
          placeholder="U12345MH2020PTC123456" maxLength={21} required
          infoText="21-character CIN issued by MCA." />
      )}
      {formData.orgType === 'llp' && (
        <FormInput label="LLP Identification Number (LLPIN)" name="llpin" value={formData.llpin || ''}
          onChange={handleChange} onBlur={handleBlur} error={errors.llpin}
          placeholder="AA-123456" maxLength={9} required
          infoText="LLPIN issued by MCA. Found on Incorporation Certificate." />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormSelect label="Social Category" name="socialCategory" value={formData.socialCategory}
          onChange={handleChange} onBlur={handleBlur} error={errors.socialCategory}
          options={socialCategoryOptions} required
          infoText="Select for government scheme eligibility." />
        <FormSelect label="Specially Abled (DIVYANG)" name="speciallyAbled" value={formData.speciallyAbled}
          onChange={handleChange} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} required
          infoText="Select Yes if you hold a valid disability certificate." />
      </div>
    </fieldset>
  );

  const renderStep1 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Business & Financial Information" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormSelect label="Major Activity" name="majorActivity" value={formData.majorActivity}
          onChange={handleChange} onBlur={handleBlur} error={errors.majorActivity}
          options={majorActivityOptions} required infoText="Select your primary business activity." />
        <FormInput label="NIC 2/4/5 Digit Code" name="nicCode" value={formData.nicCode}
          onChange={handleChange} onBlur={handleBlur} error={errors.nicCode}
          placeholder="e.g., 62011" required
          hint="e.g., 62 (IT Services), 1071 (Bakery)"
          infoText="National Industrial Classification code for your primary activity. Find your NIC code at msme.gov.in/NIC." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput type="date" label="Date of Incorporation / Registration" name="dateOfIncorporation" value={formData.dateOfIncorporation}
          onChange={handleChange} onBlur={handleBlur} error={errors.dateOfIncorporation} 
          required={formData.orgType !== 'proprietorship'}
          optional={formData.orgType === 'proprietorship'}
          infoText="Date of business birth (COI date or registration date)." />
        <FormInput type="date" label="Date of Commencement of Business" name="dateOfCommencement" value={formData.dateOfCommencement}
          onChange={handleChange} onBlur={handleBlur} error={errors.dateOfCommencement} required
          infoText="Date when business operations actually started." />
      </div>
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <h4 className="text-white font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            Financial Details
          </h4>
          <div className="w-full sm:w-48">
            <FormSelect label="Financial Year" name="financialYear" value={formData.financialYear}
              onChange={handleChange} onBlur={handleBlur} error={errors.financialYear}
              options={fyOptions} required />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
          <FormInput label="Total Investment (₹)" name="investment" value={formData.investment}
            onChange={handleChange} onBlur={handleBlur} error={errors.investment}
            placeholder="e.g., 500000" hint="WDV as per ITR" required
            infoText="Plant & Machinery or Equipment investment." />
          <FormInput label="Annual Turnover (₹)" name="turnover" value={formData.turnover}
            onChange={handleChange} onBlur={handleBlur} error={errors.turnover}
            placeholder="e.g., 1000000" hint="Total net turnover" required
            infoText="Annual turnover excluding export turnover if any." />
        </div>

        {getMsmeCategory(formData.investment, formData.turnover) && (
          <div className={`mt-2 p-3 rounded-lg border flex items-center justify-between ${getMsmeCategory(formData.investment, formData.turnover)?.bg} ${getMsmeCategory(formData.investment, formData.turnover)?.border}`}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-bold uppercase tracking-wider">Estimated Category:</span>
            </div>
            <span className={`text-sm font-black ${getMsmeCategory(formData.investment, formData.turnover)?.color}`}>
              {getMsmeCategory(formData.investment, formData.turnover)?.label}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Number of Employees" name="employees" value={formData.employees}
          onChange={handleChange} onBlur={handleBlur} error={errors.employees}
          placeholder="e.g., 10" required infoText="Full-time + part-time total." />
        <FormInput label="GSTIN (If Applicable)" name="gstin" value={formData.gstin || ''}
          onChange={handleChange} onBlur={handleBlur} error={errors.gstin}
          placeholder="22AAAAA0000A1Z5" maxLength={15} optional
          infoText="15-character GSTIN if registered." />
      </div>
      <FormSelect label="Have Existing Udyam Registration?" name="hasUdyam" value={formData.hasUdyam || ''}
        onChange={handleChange}
        options={[{ value: 'yes', label: 'Yes — I have an existing Udyam number' }, { value: 'no', label: 'No — First time registration' }]}
        infoText="Select if you're migrating from UAM/EM to Udyam." />
      {formData.hasUdyam === 'yes' && (
        <FormInput label="Existing Udyam / UAM Number" name="udyamNumber" value={formData.udyamNumber || ''}
          onChange={handleChange} placeholder="e.g., UDYAM-TN-01-0012345" optional />
      )}
    </fieldset>
  );

  const renderStep2 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Business Address Information" />
      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">Enter address <strong>exactly as it appears on your address proof document</strong>. This will be the registered office address on Udyam certificate.</p>
      </div>
      <FormInput label="Address Line 1" name="addressLine1" value={formData.addressLine1}
        onChange={handleChange} onBlur={handleBlur} error={errors.addressLine1}
        placeholder="Flat / Plot No., Building Name, Street" required
        infoText="Door/flat number, building name, street — as per address proof." />
      <FormInput label="Address Line 2 / Landmark" name="addressLine2" value={formData.addressLine2}
        onChange={handleChange} placeholder="Area / Colony / Locality (optional)" optional />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormSelect label="State / UT" name="state" value={formData.state}
          onChange={handleChange} onBlur={handleBlur} error={errors.state}
          options={stateOptions} required />
        <FormSelect label="City / District" name="city" value={formData.city}
          onChange={handleChange} onBlur={handleBlur} error={errors.city}
          options={availableDistricts.length ? availableDistricts.map(d => ({ value: d, label: d })) : [{ value: '', label: 'Select state first' }]}
          required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Pincode" name="pincode" value={formData.pincode}
          onChange={handleChange} onBlur={handleBlur} error={errors.pincode}
          placeholder="6-digit pincode" maxLength={6} required />
        <FormSelect label="Property Type (Address Proof)" name="propertyType" value={formData.propertyType}
          onChange={handleChange} onBlur={handleBlur} error={errors.propertyType}
          options={propertyTypeOptions} required infoText="Type of property for address proof upload." />
      </div>
    </fieldset>
  );

  const renderStep3 = () => (
    <fieldset className="space-y-4">
      <SectionLegend title="Contact & Bank Details" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput type="email" label="Email Address" name="email" value={formData.email}
          onChange={handleChange} onBlur={handleBlur} error={errors.email}
          placeholder="you@business.com" required infoText="Active email for communication." />
        <FormInput type="tel" label="Mobile Number (for OTP)" name="mobile" value={formData.mobile}
          onChange={handleChange} onBlur={handleBlur} error={errors.mobile}
          placeholder="9876543210" maxLength={10} required
          hint="OTP will be sent to this number by Udyam Portal"
          infoText="10-digit Aadhaar-linked mobile for OTP verification." />
      </div>
      <FormInput type="tel" label="Alternate Mobile" name="altMobile" value={formData.altMobile}
        onChange={handleChange} placeholder="Optional backup number" maxLength={10} optional />
      <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50 mt-4">
        <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          Bank Account Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormSelect label="Bank Name" name="bankName" value={formData.bankName}
            onChange={handleChange} onBlur={handleBlur} error={errors.bankName}
            options={bankOptions} required />
          <FormInput label="Bank Branch" name="bankBranch" value={formData.bankBranch}
            onChange={handleChange} onBlur={handleBlur} error={errors.bankBranch}
            placeholder="e.g., Connaught Place Branch" required />
          <FormInput label="Account Number" name="accountNumber" value={formData.accountNumber}
            onChange={handleChange} onBlur={handleBlur} error={errors.accountNumber}
            placeholder="Enter account number" maxLength={18} required hint="9–18 digits" />
          <FormInput label="IFSC Code" name="ifscCode" value={formData.ifscCode}
            onChange={handleChange} onBlur={handleBlur} error={errors.ifscCode}
            placeholder="e.g., SBIN0001234" maxLength={11} required
            infoText="11-character IFSC code from your cheque book." />
        </div>
      </div>
    </fieldset>
  );

  const renderStep4 = () => (
    <div>
      {/* Sub-step progress bar — matching GST-LLP */}
      <div className="mb-8">
        <SectionLegend title={
          docSubStep === 1 ? 'Business Entity Documents' :
            docSubStep === 2 ? (formData.orgType === 'pvtltd' ? 'Directors Details & Documents' : 'Partners Details & Documents') :
              'Declaration & Signature'
        } />
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map(s => {
            if (formData.orgType === 'proprietorship' && s === 2) return null;
            return (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${s < docSubStep ? 'bg-emerald-500' : s === docSubStep ? 'bg-gradient-to-r from-cyan-500 to-teal-500' : 'bg-slate-700'}`} />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-white mt-1">
          {['Business Entity', 'Directors/Partners', 'Declaration'].map((l, i) => {
            const s = i + 1;
            if (formData.orgType === 'proprietorship' && s === 2) return null;
            const label = s === 2 ? (formData.orgType === 'pvtltd' ? 'Directors' : 'Partners') : l;
            return (
              <span key={i} className={s === docSubStep ? 'text-cyan-400 font-medium' : ''}>{label}</span>
            );
          })}
        </div>
      </div>

      <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-sky-300">
          Documents for <strong>{orgTypeOptions.find(o => o.value === formData.orgType)?.label || 'MSME'}</strong>. Fields marked <span className="text-red-400">*</span> are mandatory. Max 2MB per file.
        </p>
      </div>

      {/* Sub-step 1: Business Entity Documents */}
      {docSubStep === 1 && (
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
              <span className="w-1 h-4 bg-cyan-400 rounded-full inline-block" />
              Common Documents (All Entity Types)
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FileUploader label="Business PAN Card" name="panCard" required
                uploadedFile={uploadedFiles.panCard} onChange={handleFileUpload('panCard')}
                hint="Entity PAN or Proprietor's PAN" error={errors.panCard}
                infoText="For proprietorship: individual PAN. For others: business entity PAN."
                fileName={uploadedFileNames.panCard}
                existingUrl={existingDocs?.panCard?.url} />
              <FileUploader label="Address Proof (Electricity Bill / Rent Agreement)" name="addressProof" required
                uploadedFile={uploadedFiles.addressProof} onChange={handleFileUpload('addressProof')}
                hint="Must match registered office address" error={errors.addressProof}
                fileName={uploadedFileNames.addressProof}
                existingUrl={existingDocs?.addressProof?.url} />
              <FileUploader label="Bank Proof (Cancelled Cheque / Bank Statement)" name="bankProof" required
                uploadedFile={uploadedFiles.bankProof} onChange={handleFileUpload('bankProof')}
                hint="Cancelled cheque or latest statement" error={errors.bankProof}
                fileName={uploadedFileNames.bankProof}
                existingUrl={existingDocs?.bankProof?.url} />
              <FileUploader label="Turnover Invoice" name="turnoverInvoice"
                uploadedFile={uploadedFiles.turnoverInvoice} onChange={handleFileUpload('turnoverInvoice')}
                hint="Recent invoice showing turnover" optional
                fileName={uploadedFileNames.turnoverInvoice}
                existingUrl={existingDocs?.turnoverInvoice?.url} />
            </div>
            {formData.hasUdyam === 'yes' && (
              <FileUploader label="Existing Udyam / UAM Registration Certificate" name="udyamCertificate" required
                uploadedFile={uploadedFiles.udyamCertificate} onChange={handleFileUpload('udyamCertificate')}
                error={errors.udyamCertificate} hint="Upload your existing Udyam certificate"
                fileName={uploadedFileNames.udyamCertificate}
                existingUrl={existingDocs?.udyamCertificate?.url} />
            )}
            {formData.gstin && (
              <FileUploader label="GST Registration Certificate" name="gstin"
                uploadedFile={uploadedFiles.gstin} onChange={handleFileUpload('gstin')}
                hint="GST certificate if registered" optional
                fileName={uploadedFileNames.gstin}
                existingUrl={existingDocs?.gstin?.url} />
            )}
          </fieldset>

          {/* Entity-specific docs */}
          {formData.orgType === 'pvtltd' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-400 rounded-full inline-block" />
                Company Documents
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="Certificate of Incorporation (COI)" name="coi" required
                  uploadedFile={uploadedFiles.coi} onChange={handleFileUpload('coi')}
                  hint="MCA issued COI" error={errors.coi}
                  fileName={uploadedFileNames.coi}
                  existingUrl={existingDocs?.coi?.url} />
                <FileUploader label="Memorandum of Association (MOA)" name="moa" required
                  uploadedFile={uploadedFiles.moa} onChange={handleFileUpload('moa')}
                  hint="Signed MOA" error={errors.moa}
                  fileName={uploadedFileNames.moa}
                  existingUrl={existingDocs?.moa?.url} />
                <FileUploader label="Articles of Association (AOA)" name="aoa" required
                  uploadedFile={uploadedFiles.aoa} onChange={handleFileUpload('aoa')}
                  hint="Signed AOA" error={errors.aoa}
                  fileName={uploadedFileNames.aoa}
                  existingUrl={existingDocs?.aoa?.url} />
                <FileUploader label="Certificate of Commencement (INC-20A)" name="inc20a" required
                  uploadedFile={uploadedFiles.inc20a} onChange={handleFileUpload('inc20a')}
                  hint="Mandatory for companies after Sept 2018" error={errors.inc20a}
                  fileName={uploadedFileNames.inc20a}
                  existingUrl={existingDocs?.inc20a?.url} />
              </div>
            </fieldset>
          )}

          {formData.orgType === 'llp' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-400 rounded-full inline-block" />
                LLP Documents
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="LLP Deed" name="llpDeed" required
                  uploadedFile={uploadedFiles.llpDeed} onChange={handleFileUpload('llpDeed')}
                  hint="Registered LLP Agreement" error={errors.llpDeed}
                  fileName={uploadedFileNames.llpDeed}
                  existingUrl={existingDocs?.llpDeed?.url} />
                <FileUploader label="Certificate of Incorporation (LLP)" name="incorporationCert" required
                  uploadedFile={uploadedFiles.incorporationCert} onChange={handleFileUpload('incorporationCert')}
                  hint="MCA issued LLP incorporation certificate" error={errors.incorporationCert}
                  fileName={uploadedFileNames.incorporationCert}
                  existingUrl={existingDocs?.incorporationCert?.url} />
              </div>
            </fieldset>
          )}

          {formData.orgType === 'partnership' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
                <span className="w-1 h-4 bg-cyan-400 rounded-full inline-block" />
                Partnership Documents
              </legend>
              <FileUploader label="Partnership Deed" name="partnershipDeed" required
                uploadedFile={uploadedFiles.partnershipDeed} onChange={handleFileUpload('partnershipDeed')}
                hint="Registered or Unregistered deed" error={errors.partnershipDeed}
                fileName={uploadedFileNames.partnershipDeed}
                existingUrl={existingDocs?.partnershipDeed?.url} />
            </fieldset>
          )}

          {formData.majorActivity === 'manufacturing' && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 w-full flex items-center gap-2">
                <span className="w-1 h-4 bg-amber-400 rounded-full inline-block" />
                Manufacturing Documents
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FileUploader label="Factory / Workshop Photos" name="factoryPhotos"
                  uploadedFile={uploadedFiles.factoryPhotos || null} onChange={handleFileUpload('factoryPhotos')}
                  hint="Photos of manufacturing facility" optional accept=".jpg,.jpeg,.png,.pdf"
                  fileName={uploadedFileNames.factoryPhotos}
                  existingUrl={existingDocs?.factoryPhotos?.url} />
                <FileUploader label="Machinery / Equipment List" name="machineryList"
                  uploadedFile={uploadedFiles.machineryList || null} onChange={handleFileUpload('machineryList')}
                  hint="List of all machinery with values" optional
                  fileName={uploadedFileNames.machineryList}
                  existingUrl={existingDocs?.machineryList?.url} />
              </div>
            </fieldset>
          )}
        </div>
      )}

      {/* Sub-step 2: Directors / Partners */}
      {docSubStep === 2 && (
        <div className="space-y-6">
          {errors['primaryDirector'] && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{errors['primaryDirector']}</div>
          )}

          {/* Proprietorship — no directors/partners needed here, just note */}
          {(formData.orgType === 'proprietorship') && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto mb-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <p className="text-white font-semibold">Sole Proprietorship</p>
              <p className="text-white text-sm mt-2">For proprietorship, no additional person details are required here. Proceed to Declaration.</p>
            </div>
          )}

          {/* Directors for Pvt Ltd */}
          {formData.orgType === 'pvtltd' && directors.map((director, index) => (
            <div key={director.id} className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/60">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold">{index + 1}</span>
                  Director {index + 1}
                  {director.isPrimary && <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">Primary</span>}
                </h4>
                {directors.length > 1 && (
                  <button type="button" onClick={() => setDirectors(p => p.filter(d => d.id !== director.id))}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors">Remove</button>
                )}
              </div>
              <div className="mb-5 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="primary-director" checked={director.isPrimary}
                    onChange={() => setDirectors(p => p.map(d => ({ ...d, isPrimary: d.id === director.id })))}
                    className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm text-slate-300">Mark as Primary Director</span>
                </label>
              </div>
              <FormSelect label="Position" value={director.position} name={`pos-${director.id}`}
                onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, position: e.target.value } : d))}
                options={[{ value: 'Director', label: 'Director' }, { value: 'Promoter', label: 'Promoter' }, { value: 'Managing Director', label: 'Managing Director' }]} required />
              <p className="text-xs text-white uppercase tracking-wider font-semibold mb-3">Director Name</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <FormInput label="First Name" value={director.firstName} name={`dfn-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, firstName: e.target.value } : d))}
                  error={errors[`dir-${director.id}-firstName`]} required placeholder="First name" />
                <FormInput label="Middle Name" value={director.middleName} name={`dmn-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, middleName: e.target.value } : d))} optional placeholder="Optional" />
                <FormInput label="Last Name" value={director.lastName} name={`dln-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, lastName: e.target.value } : d))}
                  error={errors[`dir-${director.id}-lastName`]} required placeholder="Last name" />
              </div>
              <p className="text-xs text-white uppercase tracking-wider font-semibold mb-3">Father's Name</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <FormInput label="First Name" value={director.fatherFirstName} name={`dffn-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, fatherFirstName: e.target.value } : d))} required placeholder="Father's first" />
                <FormInput label="Middle Name" value={director.fatherMiddleName} name={`dfmn-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, fatherMiddleName: e.target.value } : d))} optional placeholder="Optional" />
                <FormInput label="Last Name" value={director.fatherLastName} name={`dfln-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, fatherLastName: e.target.value } : d))} required placeholder="Father's last" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <FormInput label="Mobile (Aadhaar Linked)" type="tel" value={director.mobile} name={`dmob-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) } : d))}
                  error={errors[`dir-${director.id}-mobile`]} required placeholder="10-digit mobile" maxLength={10} />
                <FormInput label="Email ID" type="email" value={director.email} name={`demail-${director.id}`}
                  onChange={e => setDirectors(p => p.map(d => d.id === director.id ? { ...d, email: e.target.value } : d))}
                  error={errors[`dir-${director.id}-email`]} required placeholder="email@example.com" />
              </div>
              <p className="text-xs text-white uppercase tracking-wider font-semibold mb-3">Documents</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FileUploader label="PAN Card" name={`dPan-${director.id}`} required
                  uploadedFile={director.pan} 
                  onChange={f => setDirectors(p => p.map(d => d.id === director.id ? { ...d, pan: f, panFileName: f ? f.name : '' } : d))}
                  error={errors[`dir-${director.id}-pan`]} hint="Director's PAN"
                  fileName={director.panFileName}
                  existingUrl={existingDocs?.[`director_${director.id}_pan`]?.url} />
                <FileUploader label="Aadhaar Card" name={`dAadhaar-${director.id}`} required
                  uploadedFile={director.aadhaar} 
                  onChange={f => setDirectors(p => p.map(d => d.id === director.id ? { ...d, aadhaar: f, aadhaarFileName: f ? f.name : '' } : d))}
                  error={errors[`dir-${director.id}-aadhaar`]} hint="Both sides scanned"
                  fileName={director.aadhaarFileName}
                  existingUrl={existingDocs?.[`director_${director.id}_aadhaar`]?.url} />
                <FileUploader label="Passport Photo" name={`dPhoto-${director.id}`} required
                  uploadedFile={director.photo} 
                  onChange={f => setDirectors(p => p.map(d => d.id === director.id ? { ...d, photo: f, photoFileName: f ? f.name : '' } : d))}
                  error={errors[`dir-${director.id}-photo`]} accept=".jpg,.jpeg,.png" hint="White background"
                  fileName={director.photoFileName}
                  existingUrl={existingDocs?.[`director_${director.id}_photo`]?.url} />
              </div>
            </div>
          ))}
          {formData.orgType === 'pvtltd' && (
            <button type="button" onClick={() => setDirectors(p => [...p, { id: Date.now(), isPrimary: false, position: '', firstName: '', middleName: '', lastName: '', fatherFirstName: '', fatherMiddleName: '', fatherLastName: '', mobile: '', email: '', aadhaar: null, pan: null, photo: null }])}
              className="w-full py-4 border-2 border-dashed border-slate-600 rounded-xl text-white hover:text-cyan-400 hover:border-cyan-500 transition-all font-medium flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Add Another Director
            </button>
          )}

          {/* Partners for Partnership / LLP */}
          {(formData.orgType === 'partnership' || formData.orgType === 'llp') && partners.map((partner, index) => (
            <div key={partner.id} className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/60">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-700 to-blue-900 flex items-center justify-center text-sm font-bold">{index + 1}</span>
                  Partner {index + 1}
                </h4>
                {partners.length > 1 && (
                  <button type="button" onClick={() => setPartners(p => p.filter(x => x.id !== partner.id))}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <FormInput label="First Name" value={partner.firstName} name={`pfn-${partner.id}`}
                  onChange={e => setPartners(p => p.map(x => x.id === partner.id ? { ...x, firstName: e.target.value } : x))}
                  error={errors[`par-${partner.id}-firstName`]} required placeholder="First name" />
                <FormInput label="Middle Name" value={partner.middleName} name={`pmn-${partner.id}`}
                  onChange={e => setPartners(p => p.map(x => x.id === partner.id ? { ...x, middleName: e.target.value } : x))} optional placeholder="Optional" />
                <FormInput label="Last Name" value={partner.lastName} name={`pln-${partner.id}`}
                  onChange={e => setPartners(p => p.map(x => x.id === partner.id ? { ...x, lastName: e.target.value } : x))}
                  error={errors[`par-${partner.id}-lastName`]} required placeholder="Last name" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormInput label="Mobile (Aadhaar Linked)" type="tel" value={partner.mobile} name={`pmob-${partner.id}`}
                  onChange={e => setPartners(p => p.map(x => x.id === partner.id ? { ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) } : x))}
                  error={errors[`par-${partner.id}-mobile`]} required placeholder="10-digit mobile" maxLength={10} />
                <FormInput label="Email ID" type="email" value={partner.email} name={`pemail-${partner.id}`}
                  onChange={e => setPartners(p => p.map(x => x.id === partner.id ? { ...x, email: e.target.value } : x))}
                  error={errors[`par-${partner.id}-email`]} required placeholder="email@example.com" />
              </div>
              <FormInput label="Aadhaar Number" value={partner.aadhaarNumber} name={`paadh-${partner.id}`}
                onChange={e => setPartners(p => p.map(x => x.id === partner.id ? { ...x, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) } : x))}
                placeholder="12-digit Aadhaar" maxLength={12} optional hint="For OTP verification" />
              <p className="text-xs text-white uppercase tracking-wider font-semibold mb-3">Documents</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploader label="PAN Card" name={`pPan-${partner.id}`} required
                  uploadedFile={partner.pan} 
                  onChange={f => setPartners(p => p.map(x => x.id === partner.id ? { ...x, pan: f, panFileName: f ? f.name : '' } : x))}
                  error={errors[`par-${partner.id}-pan`]} hint="Partner's PAN card"
                  fileName={partner.panFileName}
                  existingUrl={existingDocs?.[`partner_${partner.id}_pan`]?.url} />
                <FileUploader label="Aadhaar Card" name={`pAadhaar-${partner.id}`} required
                  uploadedFile={partner.aadhaar} 
                  onChange={f => setPartners(p => p.map(x => x.id === partner.id ? { ...x, aadhaar: f, aadhaarFileName: f ? f.name : '' } : x))}
                  error={errors[`par-${partner.id}-aadhaar`]} hint="Both sides scanned"
                  fileName={partner.aadhaarFileName}
                  existingUrl={existingDocs?.[`partner_${partner.id}_aadhaar`]?.url} />
              </div>
            </div>
          ))}
          {(formData.orgType === 'partnership' || formData.orgType === 'llp') && (
            <button type="button" onClick={() => setPartners(p => [...p, { id: Date.now(), firstName: '', middleName: '', lastName: '', mobile: '', email: '', aadhaarNumber: '', aadhaar: null, pan: null }])}
              className="w-full py-4 border-2 border-dashed border-slate-600 rounded-xl text-white hover:text-cyan-400 hover:border-cyan-500 transition-all font-medium flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Add Another Partner
            </button>
          )}
        </div>
      )}

      {/* Sub-step 3: Declaration + Signature Upload */}
      {docSubStep === 3 && (
        <div className="space-y-6">
          <div className="space-y-4 mb-6">
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="consent1" checked={formData.consent1}
                  onChange={handleChange}
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
                <span className="text-sm text-slate-300">I authorize RegiBIZ to file my MSME registration application on my behalf and coordinate the Udyam portal filing process.</span>
              </label>
              {errors.consent1 && <p className="text-xs text-red-400 mt-2 ml-8">{errors.consent1}</p>}
            </div>
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="consent2" checked={formData.consent2}
                  onChange={handleChange}
                  className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500" />
                <span className="text-sm text-slate-300">I hereby declare that all information provided is true, complete, and correct to the best of my knowledge. I understand that providing false information may result in rejection or legal liability.</span>
              </label>
              {errors.consent2 && <p className="text-xs text-red-400 mt-2 ml-8">{errors.consent2}</p>}
            </div>
          </div>

          {/* ── Signature Upload — normal FileUploader, same as all other docs ── */}
          <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/60">
            <h4 className="text-white font-semibold mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Signature Upload {isDSCRequired && <span className="text-red-500">*</span>}
              {!isDSCRequired && <span className="text-xs text-white font-normal">(Optional for {orgTypeOptions.find(o => o.value === formData.orgType)?.label || 'this entity type'})</span>}
            </h4>
            <p className="text-xs text-white mb-4">
              {isDSCRequired
                ? `Signature upload is mandatory for ${formData.orgType === 'llp' ? 'LLP' : 'Private Limited Company'}. Upload a scanned copy of the authorized signatory's signature.`
                : 'Upload a scanned copy of the authorized signatory\'s signature (optional).'}
            </p>
            <FileUploader
              label="Signature Upload"
              name="signatureUpload"
              required={isDSCRequired}
              uploadedFile={uploadedFiles.signatureUpload}
              onChange={handleFileUpload('signatureUpload')}
              accept=".pdf,.jpg,.jpeg,.png"
              hint="Scanned signature on white paper — PDF / JPG / PNG — Max 2MB"
              error={errors.signatureUpload}
              infoText="Upload a clear scan of the authorized signatory's handwritten signature on plain white paper."
              existingUrl={existingDocs?.signatureUpload?.url}
            />
          </div>
        </div>
      )}
    </div>
  );

  // ── Preview Modal ──────────────────────────────────────────────────────────
  const PreviewModal = () => (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <h3 className="text-2xl font-bold text-white">Application Preview</h3>
          <button onClick={() => setShowPreview(false)} className="p-2 text-white hover:text-white rounded-lg hover:bg-slate-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <PSection title="Identity & Business">
            <PGrid items={[
              ['Business Name', formData.enterpriseName], ['Org Type', orgTypeOptions.find(o => o.value === formData.orgType)?.label || '—'],
              ['PAN', formData.pan], ['Aadhaar', formData.aadhaarNumber ? `XXXX-XXXX-${formData.aadhaarNumber.slice(-4)}` : '—'],
              ['Social Category', socialCategoryOptions.find(o => o.value === formData.socialCategory)?.label || '—'],
              ...(formData.cin ? [['CIN', formData.cin] as [string, string]] : []),
              ...(formData.llpin ? [['LLPIN', formData.llpin] as [string, string]] : []),
            ]} />
          </PSection>
          <PSection title="Business & Financials">
            <PGrid items={[
              ['Major Activity', formData.majorActivity], ['NIC Code', formData.nicCode], ['FY', formData.financialYear],
              ['Date of Commencement', formData.dateOfCommencement],
              ...(formData.orgType !== 'proprietorship' ? [['Date of Incorporation', formData.dateOfIncorporation] as [string, string]] : []),
              ['Investment (₹)', formData.investment ? `₹${parseInt(formData.investment).toLocaleString('en-IN')}` : '—'],
              ['Turnover (₹)', formData.turnover ? `₹${parseInt(formData.turnover).toLocaleString('en-IN')}` : '—'],
              ['Employees', formData.employees], ['GSTIN', formData.gstin || '—'],
            ]} />
          </PSection>
          <PSection title="Address">
            <div className="text-sm space-y-2">
              <div><span className="text-white">Address:</span> <span className="text-white">{formData.addressLine1}{formData.addressLine2 ? `, ${formData.addressLine2}` : ''}</span></div>
              <PGrid items={[['City', formData.city], ['State', stateOptions.find(s => s.value === formData.state)?.label || formData.state], ['Pincode', formData.pincode], ['Property Type', formData.propertyType]]} />
            </div>
          </PSection>
          <PSection title="Contact & Bank">
            <PGrid items={[
              ['Email', formData.email], ['Mobile', `+91 ${formData.mobile}`],
              ['Bank', formData.bankName], ['Branch', formData.bankBranch],
              ['Account No.', formData.accountNumber], ['IFSC', formData.ifscCode],
            ]} />
          </PSection>
          {formData.orgType === 'pvtltd' && directors.length > 0 && (
            <PSection title={`Directors (${directors.length})`}>
              {directors.map((d, i) => (
                <div key={d.id} className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-white mb-2">Director {i + 1}{d.isPrimary ? ' (Primary)' : ''}</p>
                  <PGrid items={[['Name', `${d.firstName} ${d.middleName} ${d.lastName}`.trim()], ['Mobile', d.mobile || '—'], ['Email', d.email || '—']]} />
                </div>
              ))}
            </PSection>
          )}
          {(formData.orgType === 'partnership' || formData.orgType === 'llp') && partners.length > 0 && (
            <PSection title={`Partners (${partners.length})`}>
              {partners.map((p, i) => (
                <div key={p.id} className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-white mb-2">Partner {i + 1}</p>
                  <PGrid items={[['Name', `${p.firstName} ${p.middleName} ${p.lastName}`.trim()], ['Mobile', p.mobile || '—'], ['Email', p.email || '—']]} />
                </div>
              ))}
            </PSection>
          )}
          <PSection title="Documents Uploaded">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(uploadedFiles).filter(([, v]) => v).map(([k]) => (
                <div key={k} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <span className="text-slate-300 text-sm capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
              ))}
            </div>
          </PSection>
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm text-amber-200 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Please verify all details before submitting. Once submitted, changes require support team assistance.
            </p>
          </div>
        </div>
        <div className="p-6 bg-slate-800/50 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0">
          <button onClick={() => setShowPreview(false)} className="px-6 py-2.5 text-slate-300 hover:text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all font-medium">Close & Edit</button>
          <button onClick={() => { setShowPreview(false); setShowOTPModal(true); }} disabled={isSubmitting}
            className="px-8 py-2.5 rounded-lg font-bold bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white disabled:opacity-50 flex items-center gap-2">
            Confirm & Submit
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );

  // ── Loading Screen ─────────────────────────────────────────────────────────
  if (isInitialLoading) return (
    <div className="min-h-screen bg-[#031f31] flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin mb-4" />
      <p className="text-cyan-500/60 text-xs font-black uppercase tracking-[0.2em] animate-pulse">Restoring your session...</p>
    </div>
  );

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (isSuccess) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-800">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">MSME Application Submitted!</h2>
        <p className="text-white mb-4 text-sm">Your application has been received. Our team will contact you for OTP/Aadhaar verification and processing.</p>
        <div className="mb-6"><p className="text-white text-xs mb-1">Your Case ID:</p><p className="text-orange-400 font-mono font-bold text-sm tracking-wide break-all">{formId}</p></div>
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700 space-y-2">
          {[['Name', formData.enterpriseName], ['Type', orgTypeOptions.find(o => o.value === formData.orgType)?.label || formData.orgType], ['Mobile', `+91 ${formData.mobile}`]].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs"><span className="text-white">{k}</span><span className="text-white font-medium">{v}</span></div>
          ))}
        </div>
        <div className="space-y-3">
          <button onClick={() => navigate('/documents')} className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all text-sm">
            View Submitted Application
          </button>
          <button onClick={() => navigate('/services')} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-lg border border-slate-700 text-sm">
            Back to Services
          </button>
        </div>
      </div>
    </div>
  );

  const stepTitle = STEP_LABELS[currentStep] || '';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {isSubmitting && <ProcessingOverlay />}
      
      {showExitConfirm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-20 h-20 bg-orange-500/20 rounded-3xl flex items-center justify-center text-orange-400 border border-orange-500/20 mb-6 mx-auto shadow-[0_0_40px_rgba(249,115,22,0.15)]">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">Save Draft & Exit?</h3>
              <p className="text-slate-400 mb-8 font-medium leading-relaxed">
                Do you want to <span className="text-orange-400 font-bold">Save your progress as a Draft</span> before leaving? You can resume later from the Documents section.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleConfirmExit(true)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isDraftSaving ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  )}
                  {isDraftSaving ? 'Saving...' : 'Yes, Save & Exit'}
                </button>

                <button
                  onClick={() => handleConfirmExit(false)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                >
                  No, Just Exit
                </button>

                <button
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirm?.show && (
        <ConfirmModal
          message={showConfirm.message}
          onConfirm={() => {
            setShowConfirm(null);
            showConfirm.onConfirm?.();
          }}
          onCancel={() => setShowConfirm(null)}
        />
      )}

      {showOTPModal && (
        <OTPModal
          onConfirm={() => { setShowOTPModal(false); executeSubmission(); }}
          onCancel={() => setShowOTPModal(false)} />
      )}
      {errorMsg && <ErrorToast message={errorMsg} onClose={() => setErrorMsg(null)} />}

      {/* Draft Success Modal */}
      {showDraftSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_20px_50px_rgba(16,185,129,0.1)] scale-in-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Draft Saved!</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
              Your MSME registration progress has been securely saved as a draft.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/5 py-2.5 px-5 rounded-full border border-emerald-400/10 w-fit mx-auto shadow-inner shadow-emerald-400/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Redirecting to Service Panel...
            </div>
          </div>
        </div>
      )}
      
      {showPreview && <PreviewModal />}

      <div className="max-w-[1600px] mx-auto">
        {/* Mobile header */}
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">MSME Registration</h1>
          <p className="text-sky-200/80 text-sm">Step {currentStep + 1} of 5 — {stepTitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-800/40 backdrop-blur-md">
            <div className="absolute top-5 left-5 z-20 flex items-center gap-4">
              <FormBackButton onBack={handlePrev} />
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Exit Session
              </button>
            </div>
            <FreeCornerRibbon />

            <div className="p-6 md:p-10 flex-grow">
              {/* Desktop header */}
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">MSME Registration</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">{stepTitle}</p>
              </div>

              <StatusBanner formId={formId} />

              <form noValidate>
                {currentStep === 0 && renderStep0()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}
              </form>

              {/* Navigation — matching GST-LLP exactly */}
              <div className="mt-12 pt-6 border-t border-slate-700/50">
                <div className="flex justify-end">
                  <div className="flex gap-3 w-full md:w-auto">
                    <button type="button" onClick={handleNext} disabled={isSubmitting || isDraftSaving}
                      className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg bg-gradient-primary text-white hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 relative group">
                      {isDraftSaving && (
                        <div className="absolute inset-0 flex items-center justify-center bg-cyan-900/40 rounded-xl">
                          <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      )}
                      <span className={isDraftSaving ? 'opacity-0' : ''}>
                        {currentStep === 4 && docSubStep === 3
                          ? 'Submit Application'
                          : currentStep === 4 && docSubStep < 3
                            ? `Save & Next Page (${docSubStep}/${formData.orgType === 'proprietorship' ? 2 : 3})`
                            : 'Save & Next Step'}
                      </span>
                      {!isDraftSaving && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>}
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-white">
                  Step {currentStep + 1} of 5 — By continuing, you agree to our{' '}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Terms</a> and{' '}
                  <a href="#" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>
                </p>
              </div>
            </div>
          </main>

          {/* Sidebar — single preview button, matching GST-LLP */}
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8">
            <ProgressSidebar
              currentStep={currentStep}
              docSubStep={docSubStep}
              uploadedCount={getUploadedCount()}
               totalDocs={getTotalDocs()}
              formData={formData}
              onPreview={() => setShowPreview(true)}
              isDraftSaving={isDraftSaving}
              lastDraftSavedAt={lastDraftSavedAt}
            />
          </aside>
        </div>
        <div className="mt-12 text-center text-white text-sm pb-8">© 2026 RegiBIZ. All rights reserved.</div>
      </div>
    </div>
  );
}

// ── Preview helpers ────────────────────────────────────────────────────────
const PSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700">
    <h4 className="font-bold text-white text-base mb-4">{title}</h4>
    {children}
  </div>
);
const PGrid: React.FC<{ items: [string, string][] }> = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
    {items.map(([k, v]) => (
      <div key={k}><span className="text-white font-medium block mb-0.5">{k}:</span><span className="text-white font-medium">{v || '—'}</span></div>
    ))}
  </div>
);