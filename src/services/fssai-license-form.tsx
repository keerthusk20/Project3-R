// src/services/fssai-license-form.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FormBackButton from '../components/FormBackButton';

import { db, storage } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { triggerNotification } from '../services/NotificationService';
import {
  ArrowLeft, CheckCircle, ChevronRight, Loader2,
  Zap, Clock, FileText, Building2, MapPin,
  Phone, Mail, Shield, AlertCircle, RefreshCw,
  Upload, X, Eye, Utensils
} from 'lucide-react';
import { sendConfirmationEmail } from './emailService';
import CelebrationPopup from '../components/CelebrationPopup';
import { calculateGST, calculateTotalWithGST } from '../data/pricingConfig';
import { useRazorpay } from '../hooks/useRazorpay';
import { RazorpaySuccessResponse } from '../services/razorpayService';
import { UserProfile } from '../types';
import { buildInitialApplicationStatus } from './applicationStatus';


// ─── State + City Data (All 36 States/UTs) ───────────────────────────────────

const stateOptions = [
  { value: 'AP', label: 'Andhra Pradesh' }, { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' }, { value: 'BR', label: 'Bihar' }, { value: 'CT', label: 'Chhattisgarh' },
  { value: 'GA', label: 'Goa' }, { value: 'GJ', label: 'Gujarat' }, { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' }, { value: 'JH', label: 'Jharkhand' }, { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' }, { value: 'MP', label: 'Madhya Pradesh' }, { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' }, { value: 'ML', label: 'Meghalaya' }, { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' }, { value: 'OR', label: 'Odisha' }, { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' }, { value: 'SK', label: 'Sikkim' }, { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' }, { value: 'TR', label: 'Tripura' }, { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' }, { value: 'WB', label: 'West Bengal' },
  { value: 'AN', label: 'Andaman and Nicobar Islands' }, { value: 'CH', label: 'Chandigarh' },
  { value: 'DN', label: 'Dadra and Nagar Haveli and Daman & Diu' }, { value: 'DL', label: 'Delhi' },
  { value: 'JK', label: 'Jammu and Kashmir' }, { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' }, { value: 'PY', label: 'Puducherry' },
];

const cityData: Record<string, string[]> = {
  AP: ['Anakapalli', 'Anantapur', 'Bapatla', 'Chittoor', 'East Godavari', 'Eluru', 'Guntur', 'Kadapa', 'Kakinada', 'Konaseema', 'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari'],
  AR: ['Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Itanagar Capital Complex', 'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding', 'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai', 'Pakke-Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap', 'Upper Dibang Valley', 'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang'],
  AS: ['Bajali', 'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 'Tamulpur', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'],
  BR: ['Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali', 'West Champaran'],
  CT: ['Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja'],
  GA: ['North Goa', 'South Goa'],
  GJ: ['Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'],
  HR: ['Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  HP: ['Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu', 'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'],
  JH: ['Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela-Kharsawan', 'Simdega', 'West Singhbhum'],
  KA: ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'],
  KL: ['Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'],
  MP: ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Niwari', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'],
  MH: ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'],
  MN: ['Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'],
  ML: ['East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills', 'Eastern West Khasi Hills', 'North Garo Hills', 'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills', 'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'],
  MZ: ['Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip'],
  NL: ['Chumoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tuensang', 'Wokha', 'Zunheboto'],
  OR: ['Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh'],
  PB: ['Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Mohali', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar', 'Sangrur', 'Shahid Bhagat Singh Nagar', 'Tarn Taran'],
  RJ: ['Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  SK: ['East Sikkim', 'Gyalshing', 'Namchi', 'North Sikkim', 'Pakyong', 'Soreng'],
  TN: ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'],
  TG: ['Adilabad', 'Bhadradri Kothagudem', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak', 'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri'],
  TR: ['Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti', 'West Tripura'],
  UP: ['Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Rae Bareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'],
  UK: ['Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
  WB: ['Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'],
  AN: ['Nicobar', 'North and Middle Andaman', 'South Andaman'],
  CH: ['Chandigarh'],
  DN: ['Dadra and Nagar Haveli', 'Daman', 'Diu'],
  DL: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'],
  JK: ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'],
  LA: ['Kargil', 'Leh'],
  LD: ['Agatti', 'Amini', 'Androth', 'Bitra', 'Chetlat', 'Kadmat', 'Kalpeni', 'Kavaratti', 'Kiltan', 'Minicoy'],
  PY: ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
};

// ─── Form Options ─────────────────────────────────────────────────────────────

const constitutionOptions = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership Firm' },
  { value: 'pvtltd', label: 'Private Limited Company' },
  { value: 'publtd', label: 'Public Limited Company' },
  { value: 'llp', label: 'Limited Liability Partnership (LLP)' },
  { value: 'huf', label: 'Hindu Undivided Family (HUF)' },
  { value: 'trust', label: 'Trust / Society / NGO' },
  { value: 'cooperative', label: 'Co-operative Society' },
  { value: 'government', label: 'Government / PSU' },
];

const businessCategoryOptions = [
  { value: 'retailer', label: 'Retailer / Grocery Shop' },
  { value: 'manufacturer', label: 'Manufacturer / Food Processor' },
  { value: 'wholesaler', label: 'Wholesaler / Distributor' },
  { value: 'transporter', label: 'Transporter / Carrier' },
  { value: 'restaurant', label: 'Restaurant / Hotel / Dhaba' },
  { value: 'storage', label: 'Storage / Cold Storage / Warehouse' },
  { value: 'cloud_kitchen', label: 'Cloud Kitchen' },
  { value: 'catering', label: 'Catering Service' },
  { value: 'hawker', label: 'Petty Retailer / Hawker / Vendor' },
  { value: 'importer', label: 'Importer' },
  { value: 'exporter', label: 'Exporter' },
];

const premiseOptions = [
  { value: 'home', label: 'Home Based / Cottage Industry' },
  { value: 'retail', label: 'Retail Shop / Store' },
  { value: 'commercial', label: 'Commercial Premise / Office' },
  { value: 'manufacturing', label: 'Manufacturing / Processing Unit' },
  { value: 'cloud', label: 'Cloud Kitchen / Virtual Restaurant' },
  { value: 'mobile', label: 'Mobile Food Unit / Food Truck' },
  { value: 'temporary', label: 'Temporary / Event Stall' },
];

const foodCategoryOptions = [
  { value: 'milk_dairy', label: 'Milk and Milk Products' },
  { value: 'fats_oils', label: 'Fats, Oils and Fat Emulsions' },
  { value: 'fruits_veg', label: 'Fruits and Vegetable Products' },
  { value: 'cereals', label: 'Cereal and Cereal Products' },
  { value: 'meat_fish', label: 'Meat, Poultry and Fish Products' },
  { value: 'sweets', label: 'Sweets / Confectionery / Chocolate' },
  { value: 'beverages', label: 'Non-Alcoholic Beverages' },
  { value: 'bakery', label: 'Bakery and Bakery Products' },
  { value: 'spices', label: 'Spices, Condiments and Seasonings' },
  { value: 'snacks', label: 'Snacks / Namkeen / Savoury Products' },
  { value: 'packaged_water', label: 'Packaged Drinking / Mineral Water' },
  { value: 'health_food', label: 'Health Supplements / Nutraceuticals' },
  { value: 'other', label: 'Other Food Products' },
];

// ─── Validators ───────────────────────────────────────────────────────────────

const validate = {
  required: (v: string) => v.trim().length > 0,
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  mobile: (v: string) => /^[6-9]\d{9}$/.test(v),
  pan: (v: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v),
  zip: (v: string) => /^\d{6}$/.test(v),
  gstin: (v: string) => v === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getLicenseType = (turnoverStr: string): 'basic' | 'state' | 'central' => {
  const t = parseFloat(turnoverStr.replace(/[^0-9.]/g, '')) || 0;
  if (t <= 1200000) return 'basic';
  if (t <= 200000000) return 'state';
  return 'central';
};

const generateCaseId = (type: 'tatkal' | 'normal' | null) => {
  const prefix = type === 'tatkal' ? 'FSSAI-TATKAL-' : 'FSSAI-';
  return `${prefix}${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  businessName: string; fboName: string; fatherName: string;
  pan: string; constitution: string; turnover: string;
  premiseType: string; businessCategory: string; foodCategory: string;
  foscosKindOfBusiness: string; productCategoryCode: string; installedCapacity: string;
  licenseTenureYears: string; waterSource: string;
  nomineeName: string;
  // Step 2
  email: string; mobile: string; altMobile: string;
  address1: string; address2: string; city: string; state: string; zip: string; gstin: string;
}

const initialData: FormData = {
  businessName: '', fboName: '', fatherName: '', pan: '', constitution: '',
  turnover: '', premiseType: '', businessCategory: '', foodCategory: '', nomineeName: '',
  foscosKindOfBusiness: '', productCategoryCode: '', installedCapacity: '',
  licenseTenureYears: '1', waterSource: '',
  email: '', mobile: '', altMobile: '', address1: '', address2: '',
  city: '', state: '', zip: '', gstin: '',
};

// ─── Reusable Field Components (OUTSIDE main component — prevents focus loss) ─

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; error?: string; hint?: string; optional?: boolean;
}
const Field: React.FC<FieldProps> = ({ label, error, hint, optional, required, id, ...rest }) => {
  const fid = id || `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label htmlFor={fid} className="text-sm font-medium text-white">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {optional && <span className="text-xs text-gray-500">Optional</span>}
      </div>
      <input
        id={fid}
        className={`w-full bg-card/50 border rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${error
          ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
          : 'border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 hover:border-white/20'
          }`}
        required={required}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string; options: { value: string; label: string }[];
  error?: string; optional?: boolean;
}
const Select: React.FC<SelectProps> = ({ label, options, error, optional, required, id, value, ...rest }) => {
  const sid = id || `select-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label htmlFor={sid} className="text-sm font-medium text-white">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {optional && <span className="text-xs text-gray-500">Optional</span>}
      </div>
      <div className="relative">
        <select
          id={sid}
          value={value}
          className={`w-full bg-card/50 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer pr-10 ${!value ? 'text-gray-500' : 'text-white'
            } ${error
              ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
              : 'border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 hover:border-white/20'
            }`}
          required={required}
          {...rest}
        >
          <option value="" disabled>Select an option</option>
          {options.map(o => (
            <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>
          ))}
        </select>
        <ChevronRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-500 w-4 h-4" />
      </div>
      {error && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  );
};

interface FileFieldProps {
  label: string; name: string; required?: boolean;
  file: File | null; onChange: (f: File | null) => void; disabled?: boolean;
}
const FileField: React.FC<FileFieldProps> = ({ label, name, required, file, onChange, disabled }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const process = (f: File | null) => {
    if (!f) { onChange(null); return; }
    if (f.size > 2 * 1024 * 1024) { alert('File must be under 2MB'); return; }
    onChange(f);
  };
  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      <p className="text-sm font-medium text-white mb-1.5">
        {label}{required && !disabled && <span className="text-red-400 ml-1">*</span>}
        {disabled && <span className="text-xs text-gray-500 ml-2">(Not required)</span>}
      </p>
      <div
        onClick={() => !disabled && ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files?.[0] || null); }}
        className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${dragging ? 'border-orange-500/60 bg-orange-500/10'
          : file ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          }`}
      >
        <input ref={ref} type="file" name={name} accept=".pdf,.jpg,.jpeg,.png"
          className="hidden" onChange={e => process(e.target.files?.[0] || null)} />
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
            {file ? <CheckCircle size={18} /> : <Upload size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            {file ? (
              <p className="text-sm text-emerald-400 truncate font-medium">{file.name}</p>
            ) : (
              <p className="text-sm text-gray-400">Click or drag to upload <span className="text-gray-600 text-xs">(PDF/JPG/PNG, max 2MB)</span></p>
            )}
          </div>
          {file && (
            <button type="button" onClick={e => { e.stopPropagation(); onChange(null); if (ref.current) ref.current.value = ''; }}
              className="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FssaiLicenseForm({ user, packageMode = false, onComplete }: { user: UserProfile; packageMode?: boolean; onComplete?: (data: any) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedLicenseType = (location.state as any)?.licenseType;

  const { displayRazorpay } = useRazorpay();


  // ✅ FIXED: registrationType is chosen on a dedicated page BEFORE the form steps.
  // currentStep: 0 = choose Tatkal/Normal, 1 = business details, 2 = contact/address, 3 = documents
  const [registrationType, setRegistrationType] = useState<'tatkal' | 'normal' | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({
    photo: null, idProof: null, premiseProof: null, foodList: null,
    constitution: null, fsmsPlan: null, nocLocal: null, waterReport: null,
    formIX: null, layoutPlan: null, machinery: null,
  });
  const [captcha, setCaptcha] = useState({ a: 0, b: 0, ans: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCaseId, setSuccessCaseId] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<RazorpaySuccessResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Auto-submit after payment
  useEffect(() => {
    if (paymentInfo) {
      handleSubmit(new Event('submit') as any);
    }
  }, [paymentInfo]);

  const genCaptcha = useCallback(() => {
    setCaptcha({ a: Math.floor(Math.random() * 10) + 1, b: Math.floor(Math.random() * 10) + 1, ans: '' });
  }, []);
  useEffect(() => { genCaptcha(); }, [genCaptcha]);

  const licenseType = getLicenseType(formData.turnover);
  const isCompany = ['pvtltd', 'publtd', 'llp', 'cooperative', 'government'].includes(formData.constitution);
  const isTatkalOk = licenseType === 'basic' && formData.premiseType !== 'manufacturing';
  const isStateCentral = licenseType === 'state' || licenseType === 'central';

  const docRequired: Record<string, boolean> = {
    photo: true, idProof: true, premiseProof: true, foodList: true, constitution: true, fsmsPlan: true,
    nocLocal: isStateCentral, waterReport: isStateCentral,
    formIX: isStateCentral && isCompany, layoutPlan: isStateCentral, machinery: isStateCentral,
  };

  const getCities = (code: string) =>
    [...(cityData[code] || [])].sort().map(c => ({ value: c, label: c }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const k = name as keyof FormData;
    let v = value;
    if (k === 'pan') v = value.toUpperCase().slice(0, 10);
    if (k === 'mobile' || k === 'altMobile') v = value.replace(/\D/g, '').slice(0, 10);
    if (k === 'gstin') v = value.toUpperCase().slice(0, 15);
    if (k === 'zip') v = value.replace(/\D/g, '').slice(0, 6);
    if (k === 'state') {
      setFormData(p => ({ ...p, state: v, city: '' }));
      setErrors(p => ({ ...p, state: '', city: '' }));
    } else {
      setFormData(p => ({ ...p, [k]: v }));
      if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    const req = (k: keyof FormData, msg: string) => { if (!formData[k]?.trim()) newErrors[k] = msg; };

    if (step === 1) {
      req('businessName', 'Business name is required');
      req('fboName', 'FBO name is required');
      req('pan', '');
      if (!validate.pan(formData.pan)) newErrors.pan = 'Invalid PAN (e.g. ABCDE1234F)';
      req('constitution', 'Select business constitution');
      req('turnover', 'Turnover is required');
      req('premiseType', 'Select premise type');
      req('businessCategory', 'Select business category');
      req('foodCategory', 'Select food category');
      req('foscosKindOfBusiness', 'Select FoSCoS kind of business');
      req('productCategoryCode', 'Food product/category mapping is required');
      req('licenseTenureYears', 'Select license tenure');
      if (formData.premiseType === 'manufacturing') {
        req('installedCapacity', 'Installed capacity is required for manufacturing');
        req('waterSource', 'Water source is required for manufacturing');
      }
    }
    if (step === 2) {
      if (!validate.email(formData.email)) newErrors.email = 'Invalid email address';
      if (!validate.mobile(formData.mobile)) newErrors.mobile = 'Invalid mobile (10 digits, starts with 6-9)';
      req('address1', 'Address is required');
      req('state', 'Select state');
      req('city', 'Select district/city');
      if (!validate.zip(formData.zip)) newErrors.zip = 'Pincode must be 6 digits';
      if (formData.gstin && !validate.gstin(formData.gstin)) newErrors.gstin = 'Invalid GSTIN format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (currentStep === 0) {
      if (!registrationType) return;
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!validateStep(currentStep)) return;
    setCurrentStep(p => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ FIXED: Back button always has correct destination
  const goBack = () => {
    if (currentStep === 0) {
      navigate('/services/fssai-license');  // back to landing page
      return;
    }
    if (currentStep === 1) {
      setCurrentStep(0);   // back to Tatkal/Normal choice — this is correct and expected
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentStep(p => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadFile = async (file: File, docId: string, key: string) => {
    if (!user?.uid) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() || 'bin';
    const path = `fssai-applications/${user.uid}/${docId}/${key}_${Date.now()}.${ext}`;
    const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type });
    return await getDownloadURL(snap.ref);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert('Please login first.'); return; }
    if (registrationType === 'tatkal' && !isTatkalOk) {
      alert('Tatkal is only for Basic (≤ ₹12L) non-manufacturing businesses.'); return;
    }
    const missingDocs = Object.entries(docRequired).some(([k, r]) => r && !uploadedFiles[k]);
    if (missingDocs) { alert('Please upload all required documents.'); return; }
    if (parseInt(captcha.ans) !== captcha.a + captcha.b) { alert('Incorrect security answer. Please try again.'); return; }
    if (!validateStep(2)) return; // belt-and-suspenders

    const baseAmount = registrationType === 'tatkal' ? 1000 : 0;
    const amount = calculateTotalWithGST(baseAmount);

    if (amount > 0 && !paymentInfo) {
      setIsPaying(true);
      try {
        const started = await displayRazorpay(amount, (response) => {
          setPaymentInfo(response);
          setIsPaying(false);
        }, {
          description: `Service Fee: ₹${baseAmount} + GST (18%): ₹${calculateGST(baseAmount)} = Total: ₹${calculateTotalWithGST(baseAmount)}`,
          prefill: {
            name: formData.fboName,
            email: formData.email,
            contact: formData.mobile
          }
        });
        if (!started) {
          alert("Failed to initiate payment.");
          setIsPaying(false);
        }
        return;
      } catch (error) {
        console.error("Payment error:", error);
        setIsPaying(false);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const docId = `FSSAI-${Date.now()}`;
      const caseId = generateCaseId(registrationType);
      const fileUrls: Record<string, string> = {};

      for (const [key, file] of Object.entries(uploadedFiles)) {
        if (file && docRequired[key]) {
          fileUrls[key] = await uploadFile(file, docId, key);
        }
      }

      const payload = {
        id: docId, type: 'fssai', title: 'FSSAI License Registration',
        ...buildInitialApplicationStatus({ serviceType: 'fssai', serviceName: 'FSSAI License Registration', userId: user.uid }),
        submittedAt: Date.now(),
        registrationType, licenseType, formData, uploadedFileUrls: fileUrls,
        userId: user.uid, caseId, folderId: 'regibiz', taskStatus: 'unassigned',
        paymentId: paymentInfo?.razorpay_payment_id || null,
        orderId: paymentInfo?.razorpay_order_id || null,
        paymentStatus: paymentInfo ? 'paid' : (amount === 0 ? 'free' : 'pending')
      };

      // ✅ FIXED: save to correct fssai-applications collection
      await setDoc(doc(db, 'fssai-applications', docId), payload);
      await setDoc(doc(db, 'users', user.uid, 'documents', docId), {
        id: docId, type: 'fssai', title: 'FSSAI License Registration',
        ...buildInitialApplicationStatus({ serviceType: 'fssai', serviceName: 'FSSAI License Registration', userId: user.uid }),
        submittedAt: Date.now(),
        userId: user.uid, caseId, folderId: 'regibiz', taskStatus: 'unassigned',
        formData, registrationType, licenseType,
      });

      await triggerNotification('FORM_SUBMITTED', {
        customerId: user.uid,
        customerName: formData.businessName || 'New Customer',
        formTitle: 'FSSAI License',
        serviceId: docId,
        businessName: formData.businessName,
        registrationType,
      });
      await sendConfirmationEmail({
        name: formData.fboName,
        email: user.email,
        service: "FSSAI License Registration",
        caseId: caseId
      });

      setSuccessCaseId(caseId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CSS helpers matching app theme ──────────────────────────────────────────
  const headingGrad = 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent';
  const primaryGrad = 'bg-gradient-to-r from-orange-500 to-red-500';
  const primaryBtn = `${primaryGrad} text-white font-semibold px-8 py-3 rounded-xl transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`;
  const outlineBtn = 'border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 px-6 py-3 rounded-xl transition-all font-medium';

  const licBadge = (lt: string) => ({
    basic: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    state: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    central: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  }[lt] || '');

  // ── Auth loading ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center border border-white/10">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="text-orange-400" size={28} />
          </div>
          <h2 className={`text-xl font-bold ${headingGrad} mb-2`}>Login Required</h2>
          <p className="text-gray-400 text-sm mb-6">Please log in to apply for FSSAI registration.</p>
          <button onClick={() => navigate('/auth')} className={`${primaryBtn} w-full`}>Go to Login</button>
        </div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (successCaseId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <CelebrationPopup trigger={!!successCaseId} message="" />
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
            <CheckCircle className="text-emerald-400" size={36} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Application Submitted!</h2>
          <p className="text-gray-400 text-sm mb-1">Your FSSAI application is under review.</p>
          <p className="text-gray-500 text-xs mb-6">
            Case ID: <span className="text-orange-400 font-mono font-bold">{successCaseId}</span>
          </p>
          <div className="bg-white/5 rounded-xl p-4 mb-6 text-left border border-white/10 space-y-2">
            {[
              ['Business', formData.businessName],
              ['FBO Name', formData.fboName],
              ['License', licenseType.toUpperCase() + ' LICENSE'],
              ['Type', (registrationType || '').toUpperCase()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-gray-500">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <button onClick={() => navigate('/documents')} className={`${primaryBtn} w-full`}>View My Documents</button>
            <button onClick={() => window.location.reload()} className={`${outlineBtn} w-full border border-white/10`}>Start New Application</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step labels ───────────────────────────────────────────────────────────────
  const steps = ['Registration Type', 'Business Details', 'Contact & Address', 'Documents'];

  // ── MAIN RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto relative">
        <div className="absolute -top-2 -left-12 hidden md:block">
          <FormBackButton />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="md:hidden">
             <FormBackButton />
          </div>
          <div className="flex-1">

            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Utensils size={14} className="text-orange-400" />
              </div>
              <h1 className={`text-xl font-bold ${headingGrad}`}>FSSAI Registration</h1>
            </div>
            <p className="text-xs text-gray-500">Food Safety & Standards Authority of India</p>
          </div>
          {registrationType && (
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${registrationType === 'tatkal'
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              : 'bg-teal-500/20 text-teal-400 border-teal-500/30'
              }`}>
              {registrationType === 'tatkal' ? '⚡ Tatkal' : '📋 Normal'}
            </div>
          )}
        </div>

        {/* ── Progress Bar ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {steps.map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${i < currentStep
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : i === currentStep
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-white/5 border-white/10 text-gray-600'
                  }`}>
                  {i < currentStep ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-[10px] mt-1 text-center hidden sm:block ${i <= currentStep ? 'text-orange-400' : 'text-gray-600'
                  }`}>{label}</span>
              </div>
            ))}
          </div>
          {/* connector lines */}
          <div className="flex items-center -mt-5 mb-2 px-4">
            {[0, 1, 2].map(i => (
              <div key={i} className={`flex-1 h-0.5 mx-1 transition-all ${i < currentStep ? 'bg-orange-500' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden relative">
          <div className="absolute top-5 left-5 z-20">
            <FormBackButton />
          </div>


          {/* ── STEP 0: Choose Registration Type ── */}
          {currentStep === 0 && (
            <div className="p-6 md:p-8">
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold ${headingGrad} mb-2`}>Choose Registration Type</h2>
                <p className="text-gray-400 text-sm">
                  Select the registration mode that suits your business needs and urgency.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

                {/* ✅ FIXED: Tatkal — app theme orange/red gradient */}
                <button
                  type="button"
                  onClick={() => setRegistrationType('tatkal')}
                  className={`relative rounded-2xl p-6 text-left border-2 transition-all duration-200 hover:scale-[1.02] ${registrationType === 'tatkal'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-white/10 bg-white/5 hover:border-orange-500/40 hover:bg-orange-500/5'
                    }`}
                >
                  {registrationType === 'tatkal' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl ${primaryGrad} flex items-center justify-center mb-4`}>
                    <Zap size={22} className="text-white" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Tatkal</h3>
                  <p className="text-orange-400 text-sm font-semibold mb-3">⚡ 1–2 Hours Approval</p>
                  <ul className="space-y-1.5 text-sm text-gray-400 mb-4">
                    <li className="flex items-start gap-2"><CheckCircle size={13} className="text-orange-400 mt-0.5 flex-shrink-0" />For Basic Registration only (≤ ₹12L turnover)</li>
                    <li className="flex items-start gap-2"><CheckCircle size={13} className="text-orange-400 mt-0.5 flex-shrink-0" />Non-manufacturing premises only</li>
                    <li className="flex items-start gap-2"><CheckCircle size={13} className="text-orange-400 mt-0.5 flex-shrink-0" />Digital verification, no physical inspection</li>
                  </ul>
                  <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs line-through">₹1,499</span>
                      <span className="text-white font-bold text-lg ml-2">₹1,000</span>
                    </div>
                    <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full border border-orange-500/20">+ Service fee</span>
                  </div>
                </button>

                {/* ✅ FIXED: Normal — teal/cyan matches app's secondary palette */}
                <button
                  type="button"
                  onClick={() => setRegistrationType('normal')}
                  className={`relative rounded-2xl p-6 text-left border-2 transition-all duration-200 hover:scale-[1.02] ${registrationType === 'normal'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-white/10 bg-white/5 hover:border-teal-500/40 hover:bg-teal-500/5'
                    }`}
                >
                  {registrationType === 'normal' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center mb-4">
                    <Clock size={22} className="text-white" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Normal</h3>
                  <p className="text-teal-400 text-sm font-semibold mb-3">📋 30–60 Days Approval</p>
                  <ul className="space-y-1.5 text-sm text-gray-400 mb-4">
                    <li className="flex items-start gap-2"><CheckCircle size={13} className="text-teal-400 mt-0.5 flex-shrink-0" />For all business types and sizes</li>
                    <li className="flex items-start gap-2"><CheckCircle size={13} className="text-teal-400 mt-0.5 flex-shrink-0" />Basic, State and Central license</li>
                    <li className="flex items-start gap-2"><CheckCircle size={13} className="text-teal-400 mt-0.5 flex-shrink-0" />Physical inspection may apply</li>
                  </ul>
                  <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs line-through">₹499</span>
                      <span className="text-white font-bold text-lg ml-2">FREE</span>
                    </div>
                    <span className="text-xs text-teal-400 bg-teal-500/10 px-2 py-1 rounded-full border border-teal-500/20">Limited offer</span>
                  </div>
                </button>
              </div>

              {/* Tatkal warning */}
              {registrationType === 'tatkal' && formData.turnover && !isTatkalOk && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  Tatkal is not available for your current turnover/premise type. Please choose Normal.
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!registrationType}
                  className={`${primaryBtn} flex items-center gap-2`}
                >
                  Continue
                  <ChevronRight size={18} />
                </button>
              </div>

              <p className="text-center text-xs text-gray-600 mt-4">
                You can change this selection by pressing Back from the next screen.
              </p>
            </div>
          )}

          {/* ── STEP 1: Business Details ── */}
          {currentStep === 1 && (
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                  <Building2 size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold">Business Details</h2>
                  <p className="text-xs text-gray-500">Legal and operational information about your food business</p>
                </div>
              </div>

              {/* License recommendation */}
              {formData.turnover && (
                <div className={`mb-6 p-3 rounded-xl border flex items-center justify-between text-sm ${licBadge(licenseType)}`}>
                  <span>Recommended license based on turnover:</span>
                  <span className="font-bold">{licenseType.toUpperCase()} LICENSE</span>
                </div>
              )}

              {/* Tatkal eligibility warning */}
              {registrationType === 'tatkal' && formData.turnover && !isTatkalOk && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  Your business is not eligible for Tatkal. Please go back and switch to Normal.
                </div>
              )}

              <div className="space-y-5">
                <Field label="Legal Business / Trade Name" name="businessName" value={formData.businessName}
                  onChange={handleChange} error={errors.businessName} placeholder="e.g., Spicy Bites Kitchen Pvt. Ltd." required />

                <Field label="Name of Food Business Operator (FBO)" name="fboName" value={formData.fboName}
                  onChange={handleChange} error={errors.fboName}
                  placeholder="Full name of owner / proprietor / director"
                  hint="As per government ID. Required on FSSAI portal." required />

                <Field label="Father's / Spouse's Name" name="fatherName" value={formData.fatherName}
                  onChange={handleChange} placeholder="e.g., Ramesh Kumar"
                  hint="Required for individual applicants." optional />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="PAN (Business / Owner)" name="pan" value={formData.pan}
                    onChange={handleChange} error={errors.pan}
                    placeholder="ABCDE1234F" hint="Format: ABCDE1234F" maxLength={10} required />
                  <Select label="Business Constitution" name="constitution" value={formData.constitution}
                    onChange={handleChange} error={errors.constitution} options={constitutionOptions} required />
                </div>

                <Field type="number" label="Estimated Annual Turnover (₹)" name="turnover" value={formData.turnover}
                  onChange={handleChange} error={errors.turnover}
                  placeholder="e.g., 800000"
                  hint="Determines Basic / State / Central license type." required />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Select label="Type of Premises" name="premiseType" value={formData.premiseType}
                    onChange={handleChange} error={errors.premiseType} options={premiseOptions} required />
                  <Select label="Business / Activity Category" name="businessCategory" value={formData.businessCategory}
                    onChange={handleChange} error={errors.businessCategory} options={businessCategoryOptions} required />
                </div>

                <Select label="Food Product Category" name="foodCategory" value={formData.foodCategory}
                  onChange={handleChange} error={errors.foodCategory} options={foodCategoryOptions}
                  required />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Select label="FoSCoS Kind of Business" name="foscosKindOfBusiness" value={formData.foscosKindOfBusiness}
                    onChange={handleChange} error={errors.foscosKindOfBusiness} options={[
                      { value: 'manufacturer', label: 'Manufacturer / Processor' },
                      { value: 'retailer', label: 'Retailer' },
                      { value: 'restaurant', label: 'Restaurant / Food Service' },
                      { value: 'distributor', label: 'Distributor / Wholesaler' },
                      { value: 'transporter', label: 'Transporter' },
                      { value: 'storage', label: 'Storage / Warehouse' },
                      { value: 'importer_exporter', label: 'Importer / Exporter' },
                    ]} required />
                  <Select label="License Tenure" name="licenseTenureYears" value={formData.licenseTenureYears}
                    onChange={handleChange} error={errors.licenseTenureYears} options={[
                      { value: '1', label: '1 Year' },
                      { value: '2', label: '2 Years' },
                      { value: '3', label: '3 Years' },
                      { value: '4', label: '4 Years' },
                      { value: '5', label: '5 Years' },
                    ]} required />
                </div>

                <Field label="FoSCoS Product / Category Code" name="productCategoryCode" value={formData.productCategoryCode}
                  onChange={handleChange} error={errors.productCategoryCode}
                  placeholder="e.g., bakery products / meals / milk products" required />

                {formData.premiseType === 'manufacturing' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Installed / Production Capacity" name="installedCapacity" value={formData.installedCapacity}
                      onChange={handleChange} error={errors.installedCapacity}
                      placeholder="e.g., 100 kg/day or 500 litres/day" required />
                    <Field label="Water Source" name="waterSource" value={formData.waterSource}
                      onChange={handleChange} error={errors.waterSource}
                      placeholder="Municipal / borewell / packaged water" required />
                  </div>
                )}

                {isCompany && (
                  <Field label="Responsible Person / Nominated Authority" name="nomineeName" value={formData.nomineeName}
                    onChange={handleChange}
                    placeholder="Name of director / partner responsible for food safety"
                    hint="Required for companies / LLP — as per Form IX." optional />
                )}
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                <button type="button" onClick={goBack} className={outlineBtn}>← Back</button>
                <button type="button" onClick={goNext}
                  disabled={registrationType === 'tatkal' && !!formData.turnover && !isTatkalOk}
                  className={`${primaryBtn} flex items-center gap-2`}>
                  Next: Contact & Address <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Contact & Address ── */}
          {currentStep === 2 && (
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                  <MapPin size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold">Contact & Address</h2>
                  <p className="text-xs text-gray-500">Communication and registered premises details</p>
                </div>
              </div>

              <div className="space-y-5">
                <Field type="email" label="Email Address" name="email" value={formData.email}
                  onChange={handleChange} error={errors.email} placeholder="you@business.com" required />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field type="tel" label="Mobile Number" name="mobile" value={formData.mobile}
                    onChange={handleChange} error={errors.mobile} placeholder="9876543210" maxLength={10} required />
                  <Field type="tel" label="Alternate Mobile" name="altMobile" value={formData.altMobile}
                    onChange={handleChange} placeholder="Optional" maxLength={10} optional />
                </div>

                <Field label="Premises Address Line 1" name="address1" value={formData.address1}
                  onChange={handleChange} error={errors.address1}
                  placeholder="Shop No. / Building Name / Road Name" required />

                <Field label="Address Line 2 / Landmark" name="address2" value={formData.address2}
                  onChange={handleChange} placeholder="Area / Colony / Landmark" optional />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Select label="State / UT" name="state" value={formData.state}
                    onChange={handleChange} error={errors.state} options={stateOptions} required />
                  <Select label="District / City" name="city" value={formData.city}
                    onChange={handleChange} error={errors.city}
                    options={getCities(formData.state)}
                    disabled={!formData.state} required />
                </div>

                {/* Fallback if no districts */}
                {formData.state && getCities(formData.state).length === 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                    <p className="mb-2">No district data available — please type your district manually:</p>
                    <Field label="District / City (Manual)" name="city" value={formData.city}
                      onChange={handleChange} error={errors.city} placeholder="Enter district name" required />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Pincode" name="zip" value={formData.zip}
                    onChange={handleChange} error={errors.zip} placeholder="6-digit pincode" maxLength={6} required />
                  <Field label="GSTIN" name="gstin" value={formData.gstin}
                    onChange={handleChange} error={errors.gstin}
                    placeholder="22AAAAA0000A1Z5"
                    hint="Leave blank if not GST registered." optional maxLength={15} />
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
                <button type="button" onClick={goBack} className={outlineBtn}>← Back</button>
                <button type="button" onClick={goNext} className={`${primaryBtn} flex items-center gap-2`}>
                  Next: Documents <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Documents ── */}
          {currentStep === 3 && (
            <form onSubmit={handleSubmit}>
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className={`w-9 h-9 rounded-xl ${primaryGrad} flex items-center justify-center flex-shrink-0`}>
                    <FileText size={16} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold">Document Uploads</h2>
                    <p className="text-xs text-gray-500">PDF / JPG / PNG — max 2MB each</p>
                  </div>
                  <div className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${licBadge(licenseType)}`}>
                    {licenseType.toUpperCase()} LICENSE
                  </div>
                </div>

                {/* Summary of what user filled */}
                <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {[
                    ['Business', formData.businessName || '—'],
                    ['FBO', formData.fboName || '—'],
                    ['State', stateOptions.find(s => s.value === formData.state)?.label || '—'],
                    ['Registration', registrationType === 'tatkal' ? '⚡ Tatkal' : '📋 Normal'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-gray-500 mb-0.5">{k}</p>
                      <p className="text-white font-medium truncate">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 mb-8">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <Shield size={14} className="text-orange-400" /> Core Documents (All Applicants)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileField label="Passport-size Photo of FBO" name="photo" required file={uploadedFiles.photo} onChange={f => setUploadedFiles(p => ({ ...p, photo: f }))} />
                    <FileField label="Govt. Photo ID (Aadhaar / PAN / Voter ID)" name="idProof" required file={uploadedFiles.idProof} onChange={f => setUploadedFiles(p => ({ ...p, idProof: f }))} />
                    <FileField label="Proof of Possession of Premises" name="premiseProof" required file={uploadedFiles.premiseProof} onChange={f => setUploadedFiles(p => ({ ...p, premiseProof: f }))} />
                    <FileField label="List of Food Products / Category" name="foodList" required file={uploadedFiles.foodList} onChange={f => setUploadedFiles(p => ({ ...p, foodList: f }))} />
                    <FileField label="Business Constitution Certificate" name="constitution" required file={uploadedFiles.constitution} onChange={f => setUploadedFiles(p => ({ ...p, constitution: f }))} />
                    <FileField label="Food Safety Management System (FSMS) Plan" name="fsmsPlan" required file={uploadedFiles.fsmsPlan} onChange={f => setUploadedFiles(p => ({ ...p, fsmsPlan: f }))} />
                  </div>

                  {isStateCentral && (
                    <>
                      <p className="text-sm font-semibold text-white flex items-center gap-2 pt-2">
                        <Shield size={14} className="text-cyan-400" /> Additional Documents (State / Central)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FileField label="NOC from Local Authority (Municipality / Panchayat)" name="nocLocal" required={docRequired.nocLocal} file={uploadedFiles.nocLocal} onChange={f => setUploadedFiles(p => ({ ...p, nocLocal: f }))} />
                        <FileField label="Water Analysis Report (Approved Lab)" name="waterReport" required={docRequired.waterReport} file={uploadedFiles.waterReport} onChange={f => setUploadedFiles(p => ({ ...p, waterReport: f }))} />
                        {isCompany && <FileField label="Form IX — Nomination of Responsible Person" name="formIX" required={docRequired.formIX} file={uploadedFiles.formIX} onChange={f => setUploadedFiles(p => ({ ...p, formIX: f }))} />}
                        <FileField label="Layout Plan of Processing Unit (to scale)" name="layoutPlan" required={docRequired.layoutPlan} file={uploadedFiles.layoutPlan} onChange={f => setUploadedFiles(p => ({ ...p, layoutPlan: f }))} />
                        <FileField label="Machinery / Equipment List (HP, capacity, count)" name="machinery" required={docRequired.machinery} file={uploadedFiles.machinery} onChange={f => setUploadedFiles(p => ({ ...p, machinery: f }))} />
                      </div>
                    </>
                  )}
                </div>

                {/* Captcha */}
                <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Shield size={14} className="text-orange-400" /> Security Verification
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="bg-card border border-white/10 rounded-lg px-5 py-3 font-mono text-xl font-bold text-orange-400 tracking-wider">
                      {captcha.a} + {captcha.b} = ?
                    </div>
                    <input
                      type="number"
                      value={captcha.ans}
                      onChange={e => setCaptcha(p => ({ ...p, ans: e.target.value }))}
                      placeholder="?"
                      className="w-24 bg-card/50 border border-white/10 rounded-lg px-4 py-3 text-center text-white text-lg focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20"
                    />
                    <button type="button" onClick={genCaptcha} className="p-2 text-gray-500 hover:text-white transition-colors" title="New question">
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <p className="text-xs text-gray-500 mb-6">
                  By submitting, you confirm all information is accurate and agree to our{' '}
                  <a href="#" className="text-orange-400 hover:underline">Terms of Service</a> and{' '}
                  <a href="#" className="text-orange-400 hover:underline">Privacy Policy</a>.
                </p>

                <div className="flex justify-between items-center pt-6 border-t border-white/10">
                  <button type="button" onClick={goBack} className={outlineBtn}>← Back</button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`${primaryBtn} flex items-center gap-2`}
                  >
                    {isSubmitting ? (
                      <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                    ) : (
                      <><CheckCircle size={18} /> Submit Application</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8 pb-4">
          © 2026 RegiBIZ — FSSAI Registration Portal • Secured by 256-bit Encryption
        </p>
      </div>
    </div>
  );
}