// services/dir-3-kycform.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import { useRazorpay } from '../hooks/useRazorpay';
import { PRICING_CONFIG, calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import FormBackButton from '../components/FormBackButton';
import { buildInitialApplicationStatus } from './applicationStatus';
import { saveFileToDraft, restoreFilesFromDraft, clearAllFilesFromDraft } from './formDraft';

// --- Info Tooltip Component ---
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-500 hover:text-orange-400 transition-colors focus:outline-none"
        aria-label="More information"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {show && (
        <div className="absolute left-full top-0 ml-2 w-72 p-3 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg shadow-xl z-50">
          {text}
          <div className="absolute left-0 top-3 -ml-1 w-2 h-2 bg-slate-800 border-l border-b border-slate-700 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

// --- Validators ---
const validators = {
  required: (value: string) => value.trim().length > 0 || "This field is required",
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Please enter a valid email address",
  mobile: (value: string) => /^[6-9]\d{9}$/.test(value) || "Enter a valid 10-digit mobile number (starts with 6-9)",
  pan: (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) || "Invalid PAN format (e.g., ABCDE1234F)",
  din: (value: string) => /^\d{8}$/.test(value) || "DIN must be exactly 8 digits",
  zip: (value: string) => /^\d{6}$/.test(value) || "Pincode must be 6 digits",
  date: (value: string) => value ? true : "Date is required",
};

// --- State & District Data (Reused from ADT-1) ---
const stateDistrictData: Record<string, string[]> = {
  'AP': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'],
  'TN': ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  'KA': ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'],
  'MH': ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
  'DL': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  'GJ': ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
  'RJ': ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  'UP': ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kheri', 'Kushinagar', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjhanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
  'WB': ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'],
  'HR': ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  'PB': ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar', 'Sangrur', 'Shaheed Bhagat Singh Nagar', 'Tarn Taran'],
  'MP': ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Niwari', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
  'BR': ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
  'OD': ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
  'JH': ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
  'AS': ['Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
  'KL': ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'],
  'TG': ['Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'],
  'CT': ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela Pendra Marwahi', 'Janjgir Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur', 'Surguja'],
  'UK': ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
  'HP': ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
  'GA': ['North Goa', 'South Goa'],
  'SK': ['East Sikkim', 'North Sikkim', 'South Sikkim', 'West Sikkim'],
  'TR': ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'],
  'MN': ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
  'ML': ['East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'North Garo Hills', 'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'],
  'MZ': ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
  'NL': ['Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Noklak', 'Peren', 'Phek', 'Tuensang', 'Wokha', 'Zunheboto'],
  'JK': ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'],
  'LA': ['Kargil', 'Leh'],
  'PY': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
  'CH': ['Chandigarh'],
  'DN': ['Dadra and Nagar Haveli'],
  'DD': ['Daman', 'Diu'],
  'LD': ['Lakshadweep'],
  'AN': ['Nicobar', 'North and Middle Andaman', 'South Andaman'],
  'AR': ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai', 'Pakke Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'],
};

const stateOptions = [
  { value: '', label: 'Select State' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CT', label: 'Chhattisgarh' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OD', label: 'Odisha' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
  { value: 'DL', label: 'Delhi' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'DN', label: 'Dadra and Nagar Haveli' },
  { value: 'DD', label: 'Daman and Diu' },
  { value: 'LD', label: 'Lakshadweep' },
];

// --- Form Input Component ---
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  infoText?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  hint,
  optional,
  infoText,
  className,
  id,
  required,
  ...props
}) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
            {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <input
          id={inputId}
          className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 placeholder-slate-500 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
            } ${className}`}
          aria-invalid={!!error}
          required={required}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500 font-mono">{hint}</p>
      ) : null}
    </div>
  );
};

// --- Form Select Component ---
interface Option { value: string; label: string; }
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
  optional?: boolean;
  infoText?: string;
}

const FormSelect: React.FC<FormSelectProps> = ({
  label,
  options,
  error,
  optional,
  infoText,
  id,
  required,
  value,
  ...props
}) => {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-5 group">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label htmlFor={selectId} className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
            {label} {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        {optional && <span className="text-xs text-slate-500 font-medium">Optional</span>}
      </div>
      <div className="relative">
        <select
          id={selectId}
          className={`w-full bg-slate-800/50 border text-white text-sm rounded-lg block p-3 pr-10 appearance-none placeholder-slate-400 shadow-sm transition-all duration-200 ease-in-out backdrop-blur-sm focus:ring-2 focus:outline-none cursor-pointer ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-600'
            } ${!value ? 'text-slate-500' : 'text-white'}`}
          required={required}
          value={value}
          {...props}
        >
          <option value="" disabled>Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-900 bg-slate-100">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

// --- File Uploader Component ---
const FileUploader: React.FC<{
  label: string;
  name: string;
  accept?: string;
  onChange: (file: File | null) => void;
  required?: boolean;
  infoText?: string;
  uploadedFile?: File | null;
  existingUrl?: string; // New prop for persistence
  hint?: string;
  error?: string;
}> = ({ label, name, accept = ".pdf", onChange, required, infoText, uploadedFile, existingUrl, hint, error }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadedFile) {
      setFileName(uploadedFile.name);
    } else if (existingUrl) {
      setFileName(existingUrl.split('/').pop()?.split('?')[0] || 'Previously uploaded file');
    } else {
      setFileName(null);
    }
  }, [uploadedFile, existingUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    processFile(file);
  };

  const processFile = (file: File | null) => {
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be under 2MB");
        return;
      }
      setFileName(file.name);
      onChange(file);
    } else {
      setFileName(null);
      onChange(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file);
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="flex items-center">
          <label className="block text-sm font-medium text-white transition-colors group-focus-within:from-teal-700 group-focus-within:via-cyan-800 group-focus-within:to-blue-900">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 ease-in-out cursor-pointer group ${isDragging
          ? 'border-cyan-500 bg-cyan-500/10'
          : fileName
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
          } ${error ? 'border-red-500/80 bg-red-500/5' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} name={name} accept={accept} className="hidden" onChange={handleFileChange} />
        <div className="flex items-center space-x-4">
          <div className={`p-2.5 rounded-lg shrink-0 transition-colors ${fileName ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-cyan-400'
            }`}>
            {fileName ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <div>
                <p className="text-sm font-medium text-emerald-400 truncate">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">File ready for upload</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-300 group-hover:text-white">
                  Click to upload
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{hint || 'PDF (Max 2MB)'}</p>
              </div>
            )}
          </div>
          {fileName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFileName(null);
                onChange(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center animate-pulse">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

const ProgressSidebar: React.FC<{ 
  currentStep: number; 
  formId: string; 
  uploadedCount: number; 
  packageMode?: boolean;
  isDraftSaving?: boolean;
  lastDraftSavedAt?: Date | null;
  onPreview: () => void;
}> = ({
  currentStep,
  formId,
  uploadedCount,
  packageMode,
  isDraftSaving,
  lastDraftSavedAt,
  onPreview,
}) => {
  const steps = [
    { label: 'Director Details', step: 1 },
    { label: 'Contact & Address', step: 2 },
    { label: 'Documents & Declaration', step: 3 },
  ];

  return (
    <div className="space-y-6 hidden lg:block">
      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center">
          <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          Filing Progress
        </h3>
        <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-5 my-2">
          {steps.map(({ label, step }) => {
            const status = step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending';
            return (
              <div key={step} className="ml-5 relative">
                <span className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 border-slate-800 transition-all duration-300 ${status === 'completed'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : status === 'active'
                    ? 'bg-gradient-to-br from-teal-700 to-blue-900 ring-4 ring-cyan-500/20 shadow-[0_0_8px_rgba(56,189,248,0.5)] scale-110'
                    : 'bg-slate-700'
                  }`} />
                <h4 className={`text-sm font-medium ${status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}>{label}</h4>
                <p className="text-emerald-300 font-mono font-semibold text-sm mt-0.5">
                  {status === 'completed' ? 'Completed' : status === 'active' ? 'In Progress' : 'Pending'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-amber-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          DIR-3 KYC Summary
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Case ID</span>
            <span className="text-cyan-400 font-mono">{formId || 'Generating...'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Documents</span>
            <span className="text-white font-medium">{uploadedCount}/2 ready</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
            <span className="text-slate-400">Draft</span>
            {isDraftSaving ? (
              <span className="text-amber-400 text-xs flex items-center gap-1">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Saving...
              </span>
            ) : lastDraftSavedAt ? (
              <span className="text-emerald-400 text-xs">✓ Saved {lastDraftSavedAt.toLocaleTimeString()}</span>
            ) : (
              <span className="text-slate-500 text-xs">Not saved yet</span>
            )}
          </div>
        </div>
      </div>

      {!packageMode && (
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
            <span className="bg-emerald-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Price Breakdown
          </h3>
          <div className="space-y-3 pt-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Service Fee</span>
              <span className="text-white font-medium">₹{PRICING_CONFIG['dir-3-kyc']?.fee?.toLocaleString() || '699'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">GST (18%)</span>
              <span className="text-white font-medium">₹{calculateGST(PRICING_CONFIG['dir-3-kyc']?.fee || 699).toLocaleString()}</span>
            </div>
            <div className="border-t border-slate-700/50 pt-2 flex justify-between text-base">
              <span className="text-white font-bold">Total Payable</span>
              <span className="text-cyan-400 font-bold">₹{calculateTotalWithGST(PRICING_CONFIG['dir-3-kyc']?.fee || 699).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
        <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
          <span className="bg-cyan-500/20 p-1.5 rounded mr-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          Important Note
        </h3>
        <p className="text-xs text-slate-400 leading-6">
          Ensure your PAN and Mobile are linked with Aadhaar. The address proof must not be older than 2 months.
        </p>
      </div>

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

// --- Types ---
interface FormData {
  din: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fatherName: string;
  dateOfBirth: string;
  gender: string;
  pan: string;
  mobile: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  declaration: boolean;
}

interface DIR3KYCFormProps {
  user: { uid: string; email?: string; displayName?: string; phoneNumber?: string };
  packageMode?: boolean;
  onComplete?: (data: any) => void;
  onBack?: () => void;
  initialData?: any;
  existingDocs?: any;
}

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
      <div key={k}><span className="text-slate-400 font-medium block mb-0.5">{k}:</span><span className="text-white font-medium">{v || '—'}</span></div>
    ))}
  </div>
);

const PreviewModal: React.FC<{ data: FormData; onConfirm: () => void; onClose: () => void }> = ({ data, onConfirm, onClose }) => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950">
        <h3 className="text-xl font-bold text-white">Application Preview</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>
      <div className="p-6 space-y-4">
        <PSection title="Personal Details">
          <PGrid items={[['DIN', data.din], ['Full Name', `${data.firstName} ${data.middleName} ${data.lastName}`.replace(/\s+/g, ' ')], ['Father Name', data.fatherName], ['DOB', data.dateOfBirth], ['Gender', data.gender]]} />
        </PSection>
        <PSection title="Contact Information">
          <PGrid items={[['Email', data.email], ['Mobile', data.mobile], ['PAN', data.pan]]} />
        </PSection>
        <PSection title="Address Details">
          <PGrid items={[['Address', `${data.addressLine1}, ${data.addressLine2}`], ['City', data.city], ['District', data.district], ['State', data.state], ['Pincode', data.pincode], ['Country', data.country]]} />
        </PSection>
      </div>
      <div className="p-6 border-t border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-slate-950">
        <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 rounded-lg text-white font-medium hover:bg-slate-700">Back to Edit</button>
        <button onClick={onConfirm} className="px-5 py-2.5 bg-cyan-600 rounded-lg text-white font-bold hover:bg-cyan-500">Confirm & Proceed</button>
      </div>
    </div>
  </div>
);

export default function DIR3KYCForm({ user, packageMode, onComplete, onBack, initialData, existingDocs }: DIR3KYCFormProps) {
  const navigate = useNavigate();
  const initialFormData: FormData = {
    din: initialData?.din || '',
    firstName: initialData?.firstName || '',
    middleName: initialData?.middleName || '',
    lastName: initialData?.lastName || '',
    fatherName: initialData?.fatherName || '',
    dateOfBirth: initialData?.dateOfBirth || '',
    gender: initialData?.gender || 'Male',
    pan: initialData?.pan || '',
    mobile: initialData?.mobile || '',
    email: initialData?.email || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    city: initialData?.city || '',
    district: initialData?.district || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    country: initialData?.country || 'India',
    declaration: initialData?.declaration || false,
  };
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [formId, setFormId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ show: boolean; message: string; onConfirm?: () => void } | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const { displayRazorpay } = useRazorpay();
  const servicePrice = PRICING_CONFIG['dir-3-kyc']?.fee ?? 0;
  // Draft state
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    identityProof: null,
    addressProof: null,
  });
  const uploadedCount = Object.values(uploadedFiles).filter(Boolean).length;

  const stepTitle = () => {
    if (currentStep === 1) return 'Director Personal Information';
    if (currentStep === 2) return 'Contact & Residential Address';
    return 'Documents & Declaration';
  };

  useEffect(() => {
    const id = `DIR3-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
    setFormId(prev => prev || id);
  }, []);

  // Firestore saveDraft
  const saveDraft = async (stepOverride?: number) => {
    if (!user?.uid || packageMode) return;
    setIsDraftSaving(true);
    try {
      await setDoc(doc(db, 'drafts', `dir3kyc_${user.uid}`), {
        userId: user.uid,
        formData,
        currentStep: stepOverride !== undefined ? stepOverride : currentStep,
        updatedAt: serverTimestamp(),
        status: 'draft',
        caseId: formId,
        serviceType: 'dir3kyc',
      }, { merge: true });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setIsDraftSaving(false);
    }
  };

  // Load draft from Firestore on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (packageMode || !user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'drafts', `dir3kyc_${user.uid}`));
        if (snap.exists()) {
          const data = snap.data();
          if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));
          if (data.currentStep) setCurrentStep(Math.min(Math.max(data.currentStep, 1), 3));
          if (data.caseId) setFormId(data.caseId);
        }
      } catch (err) {
        console.error('Draft load failed:', err);
      }
    };
    loadDraft();
  }, [packageMode, user?.uid]);

  // Restore uploaded files from draft on mount
  useEffect(() => {
    const restoreFiles = async () => {
      if (packageMode) return;
      const files = await restoreFilesFromDraft('dir3kyc_files', ['identityProof', 'addressProof']);
      setUploadedFiles(prev => ({ ...prev, ...files }));
    };
    restoreFiles();
  }, [packageMode]);

  // Save uploaded files whenever they change
  useEffect(() => {
    if (packageMode || isSuccess) return;
    const saveFiles = async () => {
      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file) {
          await saveFileToDraft('dir3kyc_files', key, file);
        }
      }
    };
    saveFiles();
  }, [uploadedFiles, packageMode, isSuccess]);

  // Auto-save draft on step/formData change
  useEffect(() => {
    if (packageMode || isSuccess) return;
    const timer = setTimeout(() => saveDraft(), 2000);
    return () => clearTimeout(timer);
  }, [currentStep, formData, packageMode, isSuccess]);

  // Exit confirmation and navigation blocking
  useEffect(() => {
    if (packageMode) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSuccess) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (_e: PopStateEvent) => {
      if (isSuccess || isExiting) return;
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
  }, [isSuccess, packageMode]);

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave) {
      setIsExiting(true);
      setIsDraftSaving(true);
      try {
        await saveDraft();
        setShowExitConfirm(false);
        navigate('/services/dir-3-kyc-filing');
      } catch (err) {
        console.error('Exit save failed:', err);
        setShowExitConfirm(false);
      } finally {
        setIsDraftSaving(false);
      }
    } else {
      setShowExitConfirm(false);
      navigate('/services/dir-3-kyc-filing');
    }
  };

  // Payment-Gated Auto-Submit Effect
  useEffect(() => {
    if (paymentInfo && !isSubmitting && !isSuccess) {
      handleFinalSubmission(paymentInfo);
    }
  }, [paymentInfo]);

  const handleFinalSubmission = async (payInfo?: RazorpaySuccessResponse) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const uploadedFileUrls: Record<string, any> = { ...existingDocs };

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file) {
          const filePath = `dir3kyc/${user.uid}/${formId}/${key}_${Date.now()}_${file.name}`;
          const storageRef = ref(storage, filePath);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);

          uploadedFileUrls[key] = {
            url,
            name: file.name,
            type: file.type,
            uploadedAt: new Date()
          };
        }
      }

      const submissionData = {
        id: formId,
        type: 'dir3kyc',
        title: 'DIR-3 KYC - Director Know Your Customer',
        ...buildInitialApplicationStatus({ serviceType: 'dir3kyc', serviceName: 'DIR-3 KYC - Director Know Your Customer', userId: user.uid }),
        submittedAt: serverTimestamp(),
        formData,
        uploadedFileUrls,
        userId: user.uid,
        folderId: 'regibiz',
        paymentStatus: payInfo ? 'paid' : (servicePrice > 0 && !packageMode ? 'pending' : 'free'),
        paymentId: payInfo?.razorpay_payment_id || '',
        orderId: payInfo?.razorpay_order_id || '',
        metaData: {
          submittedFrom: window.location.hostname,
          userAgent: navigator.userAgent,
        }
      };

      if (packageMode && onComplete) {
        await clearAllFilesFromDraft('dir3kyc_files', ['identityProof', 'addressProof']);
        onComplete(submissionData);
        return;
      }

      await setDoc(doc(db, "applications", formId), submissionData);
      // Clear Firestore draft on successful submission
      try { await setDoc(doc(db, 'drafts', `dir3kyc_${user.uid}`), { status: 'submitted' }, { merge: true }); } catch (_) { }
      try {
        await sendConfirmationEmail({
          name: `${formData.firstName} ${formData.lastName}`,
          email: user.email || formData.email || '',
          service: "DIR-3 KYC",
          caseId: formId
        });
      } catch (err) {
        console.error("Email failed", err);
      }
      await clearAllFilesFromDraft('dir3kyc_files', ['identityProof', 'addressProof']);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error("DIR-3 KYC Submission failed:", error);
      setSubmitError(error.message || "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDistrictOptions = () => {
    if (!formData.state || !stateDistrictData[formData.state]) {
      return [{ value: '', label: 'Select State First' }];
    }
    const districts = stateDistrictData[formData.state];
    return [{ value: '', label: 'Select District' }, ...districts.map(d => ({ value: d, label: d }))];
  };

  const getStepFields = (step: number): (keyof FormData)[] => {
    if (step === 1) {
      return ['din', 'firstName', 'lastName', 'fatherName', 'dateOfBirth', 'gender', 'pan'];
    }
    if (step === 2) {
      return ['mobile', 'email', 'addressLine1', 'city', 'district', 'state', 'pincode'];
    }
    if (step === 3) {
      return ['declaration'];
    }
    return [];
  };

  const focusField = (fieldName: keyof FormData) => {
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[name="${fieldName}"]`);
      if (!field) return;
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus();
    });
  };

  const validateField = (name: keyof FormData, value: string | boolean): string => {
    if (name === 'declaration' && typeof value === 'boolean') {
      return value ? '' : "You must accept the declaration to proceed";
    }

    const strValue = String(value);
    switch (name) {
      case 'din':
        return validators.din(strValue) === true ? '' : (validators.din(strValue) as string);
      case 'firstName':
      case 'lastName':
      case 'fatherName':
      case 'addressLine1':
      case 'city':
      case 'district':
      case 'state':
        return validators.required(strValue) === true ? '' : (validators.required(strValue) as string);
      case 'pan':
        return validators.pan(strValue) === true ? '' : (validators.pan(strValue) as string);
      case 'mobile':
        return validators.mobile(strValue) === true ? '' : (validators.mobile(strValue) as string);
      case 'email':
        return validators.email(strValue) === true ? '' : (validators.email(strValue) as string);
      case 'pincode':
        return validators.zip(strValue) === true ? '' : (validators.zip(strValue) as string);
      case 'dateOfBirth':
        return validators.date(strValue) === true ? '' : (validators.date(strValue) as string);
      default:
        return '';
    }
  };

  const isStepValid = (step: number): boolean => {
    const fields = getStepFields(step);
    return fields.every(field => {
      const error = validateField(field, formData[field]);
      return !error;
    });
  };



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const key = name as keyof FormData;
    let formattedValue: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    if (key === 'pan') {
      formattedValue = value.toUpperCase();
    }
    if (key === 'din') {
      formattedValue = value.replace(/\D/g, '').slice(0, 8);
    }
    if (key === 'mobile') {
      formattedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    if (key === 'pincode') {
      formattedValue = value.replace(/\D/g, '').slice(0, 6);
    }

    setFormData((prev) => ({ ...prev, [key]: formattedValue }));

    if (touched[key]) {
      setErrors((prev) => ({ ...prev, [key]: validateField(key, formattedValue) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const key = name as keyof FormData;
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validateField(key, value) }));
  };

  const handleFileUpload = (key: string) => (file: File | null) => {
    setUploadedFiles(prev => ({ ...prev, [key]: file }));
    if (fileErrors[key]) {
      setFileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const fields = getStepFields(step);
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    const touchedFields: Partial<Record<keyof FormData, boolean>> = {};
    let firstInvalidField: keyof FormData | null = null;
    let isValid = true;

    fields.forEach((field) => {
      touchedFields[field] = true;
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        if (!firstInvalidField) {
          firstInvalidField = field;
        }
        isValid = false;
      }
    });

    setTouched((prev) => ({ ...prev, ...touchedFields }));

    if (!isValid) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      if (firstInvalidField) {
        focusField(firstInvalidField);
      }
      return false;
    }

    setErrors((prev) => {
      const updatedErrors = { ...prev };
      fields.forEach((field) => {
        delete updatedErrors[field];
      });
      return updatedErrors;
    });

    return isValid;
  };

  const validateFiles = (): boolean => {
    const newFileErrors: Record<string, string> = {};
    const requiredDocs: Record<string, string> = {
      identityProof: 'Identity Proof (PAN/Aadhaar/Passport) is required',
      addressProof: 'Address Proof is required',
    };

    Object.entries(requiredDocs).forEach(([key, message]) => {
      if (!uploadedFiles[key] && !existingDocs?.[key]) {
        newFileErrors[key] = message;
      }
    });

    setFileErrors(newFileErrors);
    return Object.keys(newFileErrors).length === 0;
  };

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
        <p className="text-slate-400 text-sm">Submitting DIR-3 KYC form to MCA database.</p>
        <p className="text-slate-500 text-xs mt-1">Do not close this window.</p>
      </div>
    </div>
  );

  const handleNext = async () => {
    setSubmitError(null);
    if (validateStep(currentStep)) {
      if (!packageMode) {
        await saveDraft(currentStep + 1);
      }
      setCurrentStep(prev => Math.min(prev + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    setSubmitError(null);
    if (currentStep === 1) {
      if (packageMode && onBack) {
        onBack();
      } else {
        setShowConfirm({
          show: true,
          message: 'Go back to services? Your draft will be saved locally.',
          onConfirm: () => navigate('/services')
        });
      }
      return;
    }
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitError(null);

    const stepValid = validateStep(3);
    const filesValid = validateFiles();

    if (!stepValid || !filesValid) {
      setSubmitError("Please fill all required fields, accept declaration, and upload documents");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If in package mode, or fee is 0, skip direct payment
    if (packageMode || servicePrice === 0) {
      await handleFinalSubmission();
      return;
    }

    // Trigger payment
    setIsPaying(true);
    const started = await displayRazorpay(calculateTotalWithGST(servicePrice), (response) => {
      setPaymentInfo(response);
    }, {
      description: `Service Fee: ₹${servicePrice} + GST (18%): ₹${calculateGST(servicePrice)} = Total: ₹${calculateTotalWithGST(servicePrice)}`,
      prefill: {
        name: user?.displayName || `${formData.firstName} ${formData.lastName}`,
        email: user?.email || formData.email || '',
        contact: user?.phoneNumber || formData.mobile || ''
      }
    });

    if (!started) {
      setSubmitError("Failed to initiate payment. Please check your connection.");
      setIsPaying(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CelebrationPopup trigger={isSuccess} message="" />
        <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-800">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(249,115,22,0.4)]">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-2">
            DIR-3 KYC Submitted!
          </h2>
          <p className="text-slate-400 mb-4 text-sm">
            Your KYC details have been successfully submitted. The MCA will verify the documents and update the director's status.
          </p>
          <div className="mb-6">
            <p className="text-slate-500 text-xs mb-1">Your Case ID:</p>
            <p className="text-orange-400 font-mono font-bold text-sm tracking-wide break-all">{formId}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700 space-y-2">
            {[
              ['DIN', formData.din || '—'],
              ['Name', `${formData.firstName} ${formData.lastName}`],
              ['PAN', formData.pan || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-xs">
                <span className="text-slate-500">{k}</span>
                <span className="text-white font-medium text-right break-all">{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => { window.location.href = '/#/documents'; }}
              className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Submitted Application
            </button>
            <button
              onClick={() => navigate('/services')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-lg border border-slate-700 text-sm"
            >
              Back to Services
            </button>
          </div>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-xl">
          <h3 className="text-white text-sm font-semibold mb-3 flex items-center">
            <span className="bg-rose-500/20 p-1.5 rounded mr-2">
              <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </span>
            Need Help?
          </h3>
          <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-white/5">
            <span className="text-slate-400 font-medium text-xs">contact Support</span>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">0413-2262818</span>
              <span className="font-mono font-bold text-emerald-400 text-sm tracking-tight">63645 62818</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {isSubmitting && <ProcessingOverlay />}
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
      {showPreview && (
        <PreviewModal 
          data={formData} 
          onConfirm={() => { setShowPreview(false); handleSubmit(); }} 
          onClose={() => setShowPreview(false)} 
        />
      )}

      <div className="max-w-[1600px] mx-auto">


        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to">Form DIR-3 KYC</h1>
          <p className="text-sky-200/80 text-sm">Step {currentStep} of 3</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-800/50 bg-slate-900/40 backdrop-blur-md">
            <div className="absolute top-5 left-5 z-20 flex items-center gap-6">
              <FormBackButton onBack={handlePrevious} />
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Exit Session
              </button>
            </div>

            <div className="p-6 md:p-10 flex-grow">
              <div className="text-center mb-8 hidden lg:block">
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Form DIR-3 KYC</h1>
                <p className="text-slate-300 text-base max-w-lg mx-auto">{stepTitle()}</p>
                <p className="text-slate-500 text-sm mt-2">Case Reference: <span className="text-cyan-400 font-mono">{formId}</span></p>
              </div>

              <div className="flex items-center justify-center mb-8">
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep >= step
                      ? 'bg-gradient-primary text-white shadow-lg shadow-cyan-500/25'
                      : 'bg-slate-700 text-slate-400'
                      }`}>
                      {currentStep > step ? '✓' : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-16 md:w-20 h-1 mx-2 rounded-full transition-all ${currentStep > step ? 'bg-gradient-primary' : 'bg-slate-700'
                        }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {submitError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  ⚠️ {submitError}
                </div>
              )}

              {currentStep === 1 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">1</span>
                    Director Personal Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                      label="Director Identification Number (DIN)"
                      name="din"
                      value={formData.din}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.din}
                      required
                      placeholder="12345678"
                      maxLength={8}
                      infoText="8-digit DIN issued by MCA."
                    />
                    <FormInput
                      label="First Name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.firstName}
                      required
                      infoText="As per PAN card."
                    />
                    <FormInput
                      label="Middle Name"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleChange}
                      optional
                    />
                    <FormInput
                      label="Last Name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.lastName}
                      required
                      infoText="As per PAN card."
                    />
                    <FormInput
                      label="Father's Name"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.fatherName}
                      required
                      infoText="As per birth certificate or PAN."
                    />
                    <FormInput
                      label="Date of Birth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.dateOfBirth}
                      required
                      infoText="As per official records."
                    />
                    <FormSelect
                      label="Gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]}
                      required
                    />
                    <FormInput
                      label="Permanent Account Number (PAN)"
                      name="pan"
                      value={formData.pan}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.pan}
                      required
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      infoText="Mandatory for KYC verification."
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">2</span>
                    Contact & Residential Address
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput
                      label="Mobile Number"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.mobile}
                      required
                      placeholder="9876543210"
                      maxLength={10}
                      infoText="Must be linked with Aadhaar."
                    />
                    <FormInput
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.email}
                      required
                      placeholder="director@example.com"
                      infoText="Official email for communication."
                    />
                    <div className="md:col-span-2">
                      <FormInput
                        label="Address Line 1"
                        name="addressLine1"
                        value={formData.addressLine1}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.addressLine1}
                        required
                        placeholder="House No., Street Name"
                        infoText="Current residential address."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FormInput
                        label="Address Line 2"
                        name="addressLine2"
                        value={formData.addressLine2}
                        onChange={handleChange}
                        placeholder="Area, Locality (Optional)"
                        optional
                      />
                    </div>
                    <FormInput
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.city}
                      required
                    />
                    <FormSelect
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.state}
                      options={stateOptions}
                      required
                    />
                    <FormSelect
                      label="District"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.district}
                      options={getDistrictOptions()}
                      required={!!formData.state}
                      disabled={!formData.state}
                    />
                    <FormInput
                      label="Pincode"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.pincode}
                      required
                      placeholder="600001"
                      maxLength={6}
                    />
                    <FormSelect
                      label="Country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      options={[{ value: 'India', label: 'India' }]}
                      required
                      disabled
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="animate-fadeIn">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to mb-6 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">3</span>
                    Documents & Declaration
                  </h2>

                  <h3 className="text-lg font-semibold text-cyan-400 mb-4 mt-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">📄</span>
                    Required Documents
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                    <FileUploader
                      label="Identity Proof"
                      name="identityProof"
                      onChange={handleFileUpload('identityProof')}
                      required
                      accept=".pdf,.jpg,.png"
                      error={fileErrors.identityProof}
                      infoText="Upload PAN Card, Aadhaar, or Passport copy."
                      hint="PDF/Image, Max 2MB"
                      uploadedFile={uploadedFiles.identityProof}
                      existingUrl={existingDocs?.identityProof?.url}
                    />
                    <FileUploader
                      label="Address Proof"
                      name="addressProof"
                      onChange={handleFileUpload('addressProof')}
                      required
                      accept=".pdf,.jpg,.png"
                      error={fileErrors.addressProof}
                      infoText="Electricity bill, Bank statement, or Telephone bill (not older than 2 months)."
                      hint="PDF/Image, Max 2MB"
                      uploadedFile={uploadedFiles.addressProof}
                      existingUrl={existingDocs?.addressProof?.url}
                    />
                  </div>

                  <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center h-5">
                        <input
                          id="declaration"
                          name="declaration"
                          type="checkbox"
                          checked={formData.declaration}
                          onChange={handleChange}
                          className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                        />
                      </div>
                      <div className="text-sm">
                        <label htmlFor="declaration" className="font-medium text-slate-200">
                          I hereby declare that the information provided above is true and correct to the best of my knowledge.
                        </label>
                        <p className="text-slate-400 text-xs mt-1">
                          I understand that providing false information may lead to deactivation of my DIN.
                        </p>
                        {errors.declaration && (
                          <p className="mt-1 text-xs text-red-400">{errors.declaration}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-8 pt-6 border-t border-slate-700/50">
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting || !isStepValid(currentStep)}
                    className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                  >
                    {isDraftSaving ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : null}
                    Save & Next Step →
                  </button>

                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !isStepValid(currentStep) || (!uploadedFiles.identityProof && !existingDocs?.identityProof) || (!uploadedFiles.addressProof && !existingDocs?.addressProof)}
                    className="px-8 py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
                  >

                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>✓ Save & Submit KYC</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </main>

          <aside className="lg:col-span-5 xl:col-span-4 sticky top-8 self-start">
            <ProgressSidebar
              currentStep={currentStep}
              formId={formId}
              uploadedCount={uploadedCount}
              packageMode={packageMode}
              isDraftSaving={isDraftSaving}
              lastDraftSavedAt={lastDraftSavedAt}
              onPreview={() => setShowPreview(true)}
            />
          </aside>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm pb-8">© 2026 RegiBIZ. All rights reserved.</div>
      </div>
    </div>
  );
}
