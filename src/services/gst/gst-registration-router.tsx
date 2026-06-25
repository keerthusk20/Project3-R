// src/services/gst-registration-router.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { sendConfirmationEmail } from '../emailService';
import FormBackButton from '../../components/FormBackButton';

// Import constitution-specific forms
import { PrivateLimitedForm } from './gst-private-limited-form';
import { LLPForm } from './gst-llp-form';
import { ProprietorshipForm } from './gst-proprietorship-form';
import { PartnershipForm } from './gst-partnership-form';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export interface CommonFormData {
  businessName: string;
  tradeName: string;
  constitution: string;
  dateOfCommencement: string;
  panNumber: string;
}

interface GstRegistrationRouterProps {
  user: any;
  packageMode?: boolean;
  onComplete?: (data: any) => void;
}

type GstServicePanelType = 'pvt_ltd' | 'proprietorship' | 'shops' | 'llp' | 'partnership';

const GST_TYPE_TO_CONSTITUTION: Record<GstServicePanelType, string> = {
  pvt_ltd: 'Private Limited Company',
  proprietorship: 'Proprietorship',
  shops: 'Proprietorship',
  llp: 'LLP',
  partnership: 'Partnership',
};

const GST_TYPE_LABELS: Record<GstServicePanelType, string> = {
  pvt_ltd: 'Private Limited Company',
  proprietorship: 'Sole Proprietorship',
  shops: 'Shops & Retail Businesses',
  llp: 'LLP (Limited Liability Partnership)',
  partnership: 'Partnership Firm',
};

const isGstServicePanelType = (value: unknown): value is GstServicePanelType =>
  typeof value === 'string' && value in GST_TYPE_TO_CONSTITUTION;

// ============================================================================
// CONSTANTS & DATA
// ============================================================================
const INDIAN_STATES = [
  { value: '35', label: 'Andaman and Nicobar Islands' },
  { value: '37', label: 'Andhra Pradesh' },
  { value: '12', label: 'Arunachal Pradesh' },
  { value: '18', label: 'Assam' },
  { value: '10', label: 'Bihar' },
  { value: '04', label: 'Chandigarh' },
  { value: '22', label: 'Chhattisgarh' },
  { value: '26', label: 'Dadra and Nagar Haveli' },
  { value: '25', label: 'Daman and Diu' },
  { value: '07', label: 'Delhi' },
  { value: '30', label: 'Goa' },
  { value: '24', label: 'Gujarat' },
  { value: '06', label: 'Haryana' },
  { value: '02', label: 'Himachal Pradesh' },
  { value: '01', label: 'Jammu and Kashmir' },
  { value: '20', label: 'Jharkhand' },
  { value: '29', label: 'Karnataka' },
  { value: '32', label: 'Kerala' },
  { value: '31', label: 'Lakshadweep' },
  { value: '38', label: 'Ladakh' },
  { value: '23', label: 'Madhya Pradesh' },
  { value: '27', label: 'Maharashtra' },
  { value: '14', label: 'Manipur' },
  { value: '17', label: 'Meghalaya' },
  { value: '15', label: 'Mizoram' },
  { value: '13', label: 'Nagaland' },
  { value: '21', label: 'Odisha' },
  { value: '34', label: 'Puducherry' },
  { value: '03', label: 'Punjab' },
  { value: '08', label: 'Rajasthan' },
  { value: '11', label: 'Sikkim' },
  { value: '33', label: 'Tamil Nadu' },
  { value: '36', label: 'Telangana' },
  { value: '16', label: 'Tripura' },
  { value: '09', label: 'Uttar Pradesh' },
  { value: '05', label: 'Uttarakhand' },
  { value: '19', label: 'West Bengal' },
].sort((a, b) => a.label.localeCompare(b.label));

const STATE_DISTRICTS: Record<string, { value: string; label: string }[]> = {
  '35': [{ value: 'NIC-01', label: 'Nicobar' }, { value: 'NIC-02', label: 'North and Middle Andaman' }, { value: 'NIC-03', label: 'South Andaman' }],
  '37': [{ value: 'AP-01', label: 'Anantapur' }, { value: 'AP-02', label: 'Chittoor' }, { value: 'AP-03', label: 'East Godavari' }, { value: 'AP-04', label: 'Guntur' }, { value: 'AP-05', label: 'Krishna' }, { value: 'AP-06', label: 'Kurnool' }, { value: 'AP-07', label: 'Nellore' }, { value: 'AP-08', label: 'Prakasam' }, { value: 'AP-09', label: 'Srikakulam' }, { value: 'AP-10', label: 'Visakhapatnam' }, { value: 'AP-11', label: 'Vizianagaram' }, { value: 'AP-12', label: 'West Godavari' }, { value: 'AP-13', label: 'YSR Kadapa' }],
  '28': [{ value: 'APO-01', label: 'Anantapur' }, { value: 'APO-02', label: 'Chittoor' }, { value: 'APO-03', label: 'East Godavari' }, { value: 'APO-04', label: 'Guntur' }, { value: 'APO-05', label: 'Krishna' }, { value: 'APO-06', label: 'Kurnool' }, { value: 'APO-07', label: 'Nellore' }, { value: 'APO-08', label: 'Prakasam' }, { value: 'APO-09', label: 'Srikakulam' }, { value: 'APO-10', label: 'Visakhapatnam' }, { value: 'APO-11', label: 'Vizianagaram' }, { value: 'APO-12', label: 'West Godavari' }],
  '12': [{ value: 'AR-01', label: 'Anjaw' }, { value: 'AR-02', label: 'Changlang' }, { value: 'AR-03', label: 'Dibang Valley' }, { value: 'AR-04', label: 'East Kameng' }, { value: 'AR-05', label: 'East Siang' }, { value: 'AR-06', label: 'Itanagar' }, { value: 'AR-07', label: 'Kurung Kumey' }, { value: 'AR-08', label: 'Lohit' }, { value: 'AR-09', label: 'Lower Dibang Valley' }, { value: 'AR-10', label: 'Lower Subansiri' }, { value: 'AR-11', label: 'Papum Pare' }, { value: 'AR-12', label: 'Tawang' }, { value: 'AR-13', label: 'Tirap' }, { value: 'AR-14', label: 'Upper Siang' }, { value: 'AR-15', label: 'Upper Subansiri' }, { value: 'AR-16', label: 'West Kameng' }, { value: 'AR-17', label: 'West Siang' }],
  '18': [{ value: 'AS-01', label: 'Baksa' }, { value: 'AS-02', label: 'Barpeta' }, { value: 'AS-03', label: 'Bongaigaon' }, { value: 'AS-04', label: 'Cachar' }, { value: 'AS-05', label: 'Chirang' }, { value: 'AS-06', label: 'Darrang' }, { value: 'AS-07', label: 'Dhemaji' }, { value: 'AS-08', label: 'Dhubri' }, { value: 'AS-09', label: 'Dibrugarh' }, { value: 'AS-10', label: 'Goalpara' }, { value: 'AS-11', label: 'Golaghat' }, { value: 'AS-12', label: 'Hailakandi' }, { value: 'AS-13', label: 'Jorhat' }, { value: 'AS-14', label: 'Kamrup' }, { value: 'AS-15', label: 'Kamrup Metropolitan' }, { value: 'AS-16', label: 'Karbi Anglong' }, { value: 'AS-17', label: 'Karimganj' }, { value: 'AS-18', label: 'Kokrajhar' }, { value: 'AS-19', label: 'Lakhimpur' }, { value: 'AS-20', label: 'Morigaon' }, { value: 'AS-21', label: 'Nagaon' }, { value: 'AS-22', label: 'Nalbari' }, { value: 'AS-23', label: 'Sivasagar' }, { value: 'AS-24', label: 'Sonitpur' }, { value: 'AS-25', label: 'Tinsukia' }, { value: 'AS-26', label: 'Udalguri' }, { value: 'AS-27', label: 'Dima Hasao' }],
  '10': [{ value: 'BR-01', label: 'Araria' }, { value: 'BR-02', label: 'Arwal' }, { value: 'BR-03', label: 'Aurangabad' }, { value: 'BR-04', label: 'Banka' }, { value: 'BR-05', label: 'Begusarai' }, { value: 'BR-06', label: 'Bhagalpur' }, { value: 'BR-07', label: 'Bhojpur' }, { value: 'BR-08', label: 'Buxar' }, { value: 'BR-09', label: 'Darbhanga' }, { value: 'BR-10', label: 'East Champaran' }, { value: 'BR-11', label: 'Gaya' }, { value: 'BR-12', label: 'Gopalganj' }, { value: 'BR-13', label: 'Jamui' }, { value: 'BR-14', label: 'Jehanabad' }, { value: 'BR-15', label: 'Khagaria' }, { value: 'BR-16', label: 'Kishanganj' }, { value: 'BR-17', label: 'Kaimur' }, { value: 'BR-18', label: 'Katihar' }, { value: 'BR-19', label: 'Lakhisarai' }, { value: 'BR-20', label: 'Madhepura' }, { value: 'BR-21', label: 'Madhubani' }, { value: 'BR-22', label: 'Muzaffarpur' }, { value: 'BR-23', label: 'Munger' }, { value: 'BR-24', label: 'Nalanda' }, { value: 'BR-25', label: 'Nawada' }, { value: 'BR-26', label: 'Patna' }, { value: 'BR-27', label: 'Purnia' }, { value: 'BR-28', label: 'Rohtas' }, { value: 'BR-29', label: 'Saharsa' }, { value: 'BR-30', label: 'Samastipur' }, { value: 'BR-31', label: 'Sheikhpura' }, { value: 'BR-32', label: 'Sheohar' }, { value: 'BR-33', label: 'Sitamarhi' }, { value: 'BR-34', label: 'Siwan' }, { value: 'BR-35', label: 'Supaul' }, { value: 'BR-36', label: 'Vaishali' }, { value: 'BR-37', label: 'West Champaran' }],
  '04': [{ value: 'CH-01', label: 'Chandigarh' }],
  '22': [{ value: 'CT-01', label: 'Balod' }, { value: 'CT-02', label: 'Baloda Bazar' }, { value: 'CT-03', label: 'Balrampur' }, { value: 'CT-04', label: 'Bastar' }, { value: 'CT-05', label: 'Bemetara' }, { value: 'CT-06', label: 'Bijapur' }, { value: 'CT-07', label: 'Bilaspur' }, { value: 'CT-08', label: 'Dantewada' }, { value: 'CT-09', label: 'Dhamtari' }, { value: 'CT-10', label: 'Durg' }, { value: 'CT-11', label: 'Gariyaband' }, { value: 'CT-12', label: 'Janjgir-Champa' }, { value: 'CT-13', label: 'Jashpur' }, { value: 'CT-14', label: 'Kabirdham' }, { value: 'CT-15', label: 'Kanker' }, { value: 'CT-16', label: 'Kondagaon' }, { value: 'CT-17', label: 'Korba' }, { value: 'CT-18', label: 'Koriya' }, { value: 'CT-19', label: 'Mahasamund' }, { value: 'CT-20', label: 'Mungeli' }, { value: 'CT-21', label: 'Narayanpur' }, { value: 'CT-22', label: 'Raigarh' }, { value: 'CT-23', label: 'Raipur' }, { value: 'CT-24', label: 'Rajnandgaon' }, { value: 'CT-25', label: 'Sukma' }, { value: 'CT-26', label: 'Surajpur' }, { value: 'CT-27', label: 'Surguja' }],
  '26': [{ value: 'DN-01', label: 'Dadra and Nagar Haveli' }],
  '25': [{ value: 'DD-01', label: 'Daman' }, { value: 'DD-02', label: 'Diu' }],
  '07': [{ value: 'DL-01', label: 'Central Delhi' }, { value: 'DL-02', label: 'East Delhi' }, { value: 'DL-03', label: 'New Delhi' }, { value: 'DL-04', label: 'North Delhi' }, { value: 'DL-05', label: 'North East Delhi' }, { value: 'DL-06', label: 'North West Delhi' }, { value: 'DL-07', label: 'Shahdara' }, { value: 'DL-08', label: 'South Delhi' }, { value: 'DL-09', label: 'South East Delhi' }, { value: 'DL-10', label: 'South West Delhi' }, { value: 'DL-11', label: 'West Delhi' }],
  '30': [{ value: 'GA-01', label: 'North Goa' }, { value: 'GA-02', label: 'South Goa' }],
  '24': [{ value: 'GJ-01', label: 'Ahmedabad' }, { value: 'GJ-02', label: 'Amreli' }, { value: 'GJ-03', label: 'Anand' }, { value: 'GJ-04', label: 'Aravalli' }, { value: 'GJ-05', label: 'Banaskantha' }, { value: 'GJ-06', label: 'Bharuch' }, { value: 'GJ-07', label: 'Bhavnagar' }, { value: 'GJ-08', label: 'Botad' }, { value: 'GJ-09', label: 'Chhota Udaipur' }, { value: 'GJ-10', label: 'Dahod' }, { value: 'GJ-11', label: 'Dang' }, { value: 'GJ-12', label: 'Devbhoomi Dwarka' }, { value: 'GJ-13', label: 'Gandhinagar' }, { value: 'GJ-14', label: 'Gir Somnath' }, { value: 'GJ-15', label: 'Jamnagar' }, { value: 'GJ-16', label: 'Junagadh' }, { value: 'GJ-17', label: 'Kheda' }, { value: 'GJ-18', label: 'Kutch' }, { value: 'GJ-19', label: 'Mahisagar' }, { value: 'GJ-20', label: 'Mehsana' }, { value: 'GJ-21', label: 'Morbi' }, { value: 'GJ-22', label: 'Narmada' }, { value: 'GJ-23', label: 'Navsari' }, { value: 'GJ-24', label: 'Panchmahal' }, { value: 'GJ-25', label: 'Patan' }, { value: 'GJ-26', label: 'Porbandar' }, { value: 'GJ-27', label: 'Rajkot' }, { value: 'GJ-28', label: 'Sabarkantha' }, { value: 'GJ-29', label: 'Surat' }, { value: 'GJ-30', label: 'Surendranagar' }, { value: 'GJ-31', label: 'Tapi' }, { value: 'GJ-32', label: 'Vadodara' }, { value: 'GJ-33', label: 'Valsad' }],
  '06': [{ value: 'HR-01', label: 'Ambala' }, { value: 'HR-02', label: 'Bhiwani' }, { value: 'HR-03', label: 'Charkhi Dadri' }, { value: 'HR-04', label: 'Faridabad' }, { value: 'HR-05', label: 'Fatehabad' }, { value: 'HR-06', label: 'Gurugram' }, { value: 'HR-07', label: 'Hisar' }, { value: 'HR-08', label: 'Jhajjar' }, { value: 'HR-09', label: 'Jind' }, { value: 'HR-10', label: 'Kaithal' }, { value: 'HR-11', label: 'Karnal' }, { value: 'HR-12', label: 'Kurukshetra' }, { value: 'HR-13', label: 'Mahendragarh' }, { value: 'HR-14', label: 'Nuh' }, { value: 'HR-15', label: 'Palwal' }, { value: 'HR-16', label: 'Panchkula' }, { value: 'HR-17', label: 'Panipat' }, { value: 'HR-18', label: 'Rewari' }, { value: 'HR-19', label: 'Rohtak' }, { value: 'HR-20', label: 'Sirsa' }, { value: 'HR-21', label: 'Sonipat' }, { value: 'HR-22', label: 'Yamunanagar' }],
  '02': [{ value: 'HP-01', label: 'Bilaspur' }, { value: 'HP-02', label: 'Chamba' }, { value: 'HP-03', label: 'Hamirpur' }, { value: 'HP-04', label: 'Kangra' }, { value: 'HP-05', label: 'Kinnaur' }, { value: 'HP-06', label: 'Kullu' }, { value: 'HP-07', label: 'Lahaul and Spiti' }, { value: 'HP-08', label: 'Mandi' }, { value: 'HP-09', label: 'Shimla' }, { value: 'HP-10', label: 'Sirmaur' }, { value: 'HP-11', label: 'Solan' }, { value: 'HP-12', label: 'Una' }],
  '01': [{ value: 'JK-01', label: 'Anantnag' }, { value: 'JK-02', label: 'Bandipora' }, { value: 'JK-03', label: 'Baramulla' }, { value: 'JK-04', label: 'Budgam' }, { value: 'JK-05', label: 'Doda' }, { value: 'JK-06', label: 'Ganderbal' }, { value: 'JK-07', label: 'Jammu' }, { value: 'JK-08', label: 'Kathua' }, { value: 'JK-09', label: 'Kishtwar' }, { value: 'JK-10', label: 'Kulgam' }, { value: 'JK-11', label: 'Kupwara' }, { value: 'JK-12', label: 'Poonch' }, { value: 'JK-13', label: 'Pulwama' }, { value: 'JK-14', label: 'Rajouri' }, { value: 'JK-15', label: 'Ramban' }, { value: 'JK-16', label: 'Reasi' }, { value: 'JK-17', label: 'Samba' }, { value: 'JK-18', label: 'Shopian' }, { value: 'JK-19', label: 'Srinagar' }, { value: 'JK-20', label: 'Udhampur' }],
  '20': [{ value: 'JH-01', label: 'Bokaro' }, { value: 'JH-02', label: 'Chatra' }, { value: 'JH-03', label: 'Deoghar' }, { value: 'JH-04', label: 'Dhanbad' }, { value: 'JH-05', label: 'Dumka' }, { value: 'JH-06', label: 'East Singhbhum' }, { value: 'JH-07', label: 'Garhwa' }, { value: 'JH-08', label: 'Giridih' }, { value: 'JH-09', label: 'Godda' }, { value: 'JH-10', label: 'Gumla' }, { value: 'JH-11', label: 'Hazaribagh' }, { value: 'JH-12', label: 'Jamtara' }, { value: 'JH-13', label: 'Khunti' }, { value: 'JH-14', label: 'Koderma' }, { value: 'JH-15', label: 'Latehar' }, { value: 'JH-16', label: 'Lohardaga' }, { value: 'JH-17', label: 'Pakur' }, { value: 'JH-18', label: 'Palamu' }, { value: 'JH-19', label: 'Ramgarh' }, { value: 'JH-20', label: 'Ranchi' }, { value: 'JH-21', label: 'Sahebganj' }, { value: 'JH-22', label: 'Seraikela-Kharsawan' }, { value: 'JH-23', label: 'Simdega' }, { value: 'JH-24', label: 'West Singhbhum' }],
  '29': [{ value: 'KA-01', label: 'Bagalkot' }, { value: 'KA-02', label: 'Ballari' }, { value: 'KA-03', label: 'Belagavi' }, { value: 'KA-04', label: 'Bengaluru Rural' }, { value: 'KA-05', label: 'Bengaluru Urban' }, { value: 'KA-06', label: 'Bidar' }, { value: 'KA-07', label: 'Chamarajanagar' }, { value: 'KA-08', label: 'Chikkaballapur' }, { value: 'KA-09', label: 'Chikkamagaluru' }, { value: 'KA-10', label: 'Chitradurga' }, { value: 'KA-11', label: 'Dakshina Kannada' }, { value: 'KA-12', label: 'Davanagere' }, { value: 'KA-13', label: 'Dharwad' }, { value: 'KA-14', label: 'Gadag' }, { value: 'KA-15', label: 'Hassan' }, { value: 'KA-16', label: 'Haveri' }, { value: 'KA-17', label: 'Kalaburagi' }, { value: 'KA-18', label: 'Kodagu' }, { value: 'KA-19', label: 'Kolar' }, { value: 'KA-20', label: 'Koppal' }, { value: 'KA-21', label: 'Mandya' }, { value: 'KA-22', label: 'Mysuru' }, { value: 'KA-23', label: 'Raichur' }, { value: 'KA-24', label: 'Ramanagara' }, { value: 'KA-25', label: 'Shivamogga' }, { value: 'KA-26', label: 'Tumakuru' }, { value: 'KA-27', label: 'Udupi' }, { value: 'KA-28', label: 'Uttara Kannada' }, { value: 'KA-29', label: 'Vijayapura' }, { value: 'KA-30', label: 'Yadgir' }],
  '32': [{ value: 'KL-01', label: 'Alappuzha' }, { value: 'KL-02', label: 'Ernakulam' }, { value: 'KL-03', label: 'Idukki' }, { value: 'KL-04', label: 'Kannur' }, { value: 'KL-05', label: 'Kasaragod' }, { value: 'KL-06', label: 'Kollam' }, { value: 'KL-07', label: 'Kottayam' }, { value: 'KL-08', label: 'Kozhikode' }, { value: 'KL-09', label: 'Malappuram' }, { value: 'KL-10', label: 'Palakkad' }, { value: 'KL-11', label: 'Pathanamthitta' }, { value: 'KL-12', label: 'Thiruvananthapuram' }, { value: 'KL-13', label: 'Thrissur' }, { value: 'KL-14', label: 'Wayanad' }],
  '31': [{ value: 'LD-01', label: 'Lakshadweep' }],
  '38': [{ value: 'LA-01', label: 'Kargil' }, { value: 'LA-02', label: 'Leh' }],
  '23': [{ value: 'MP-01', label: 'Agar Malwa' }, { value: 'MP-02', label: 'Alirajpur' }, { value: 'MP-03', label: 'Anuppur' }, { value: 'MP-04', label: 'Ashoknagar' }, { value: 'MP-05', label: 'Balaghat' }, { value: 'MP-06', label: 'Barwani' }, { value: 'MP-07', label: 'Betul' }, { value: 'MP-08', label: 'Bhind' }, { value: 'MP-09', label: 'Bhopal' }, { value: 'MP-10', label: 'Burhanpur' }, { value: 'MP-11', label: 'Chhatarpur' }, { value: 'MP-12', label: 'Chhindwara' }, { value: 'MP-13', label: 'Damoh' }, { value: 'MP-14', label: 'Datia' }, { value: 'MP-15', label: 'Dewas' }, { value: 'MP-16', label: 'Dhar' }, { value: 'MP-17', label: 'Dindori' }, { value: 'MP-18', label: 'Guna' }, { value: 'MP-19', label: 'Gwalior' }, { value: 'MP-20', label: 'Harda' }, { value: 'MP-21', label: 'Hoshangabad' }, { value: 'MP-22', label: 'Indore' }, { value: 'MP-23', label: 'Jabalpur' }, { value: 'MP-24', label: 'Jhabua' }, { value: 'MP-25', label: 'Katni' }, { value: 'MP-26', label: 'Khandwa' }, { value: 'MP-27', label: 'Khargone' }, { value: 'MP-28', label: 'Mandla' }, { value: 'MP-29', label: 'Mandsaur' }, { value: 'MP-30', label: 'Morena' }, { value: 'MP-31', label: 'Narsinghpur' }, { value: 'MP-32', label: 'Neemuch' }, { value: 'MP-33', label: 'Panna' }, { value: 'MP-34', label: 'Raisen' }, { value: 'MP-35', label: 'Rajgarh' }, { value: 'MP-36', label: 'Ratlam' }, { value: 'MP-37', label: 'Rewa' }, { value: 'MP-38', label: 'Sagar' }, { value: 'MP-39', label: 'Satna' }, { value: 'MP-40', label: 'Sehore' }, { value: 'MP-41', label: 'Seoni' }, { value: 'MP-42', label: 'Shahdol' }, { value: 'MP-43', label: 'Shajapur' }, { value: 'MP-44', label: 'Sheopur' }, { value: 'MP-45', label: 'Shivpuri' }, { value: 'MP-46', label: 'Sidhi' }, { value: 'MP-47', label: 'Singrauli' }, { value: 'MP-48', label: 'Tikamgarh' }, { value: 'MP-49', label: 'Ujjain' }, { value: 'MP-50', label: 'Umaria' }, { value: 'MP-51', label: 'Vidisha' }],
  '27': [{ value: 'MH-01', label: 'Ahmednagar' }, { value: 'MH-02', label: 'Akola' }, { value: 'MH-03', label: 'Amravati' }, { value: 'MH-04', label: 'Aurangabad' }, { value: 'MH-05', label: 'Beed' }, { value: 'MH-06', label: 'Bhandara' }, { value: 'MH-07', label: 'Buldhana' }, { value: 'MH-08', label: 'Chandrapur' }, { value: 'MH-09', label: 'Dhule' }, { value: 'MH-10', label: 'Gadchiroli' }, { value: 'MH-11', label: 'Gondia' }, { value: 'MH-12', label: 'Hingoli' }, { value: 'MH-13', label: 'Jalgaon' }, { value: 'MH-14', label: 'Jalna' }, { value: 'MH-15', label: 'Kolhapur' }, { value: 'MH-16', label: 'Latur' }, { value: 'MH-17', label: 'Mumbai City' }, { value: 'MH-18', label: 'Mumbai Suburban' }, { value: 'MH-19', label: 'Nagpur' }, { value: 'MH-20', label: 'Nanded' }, { value: 'MH-21', label: 'Nandurbar' }, { value: 'MH-22', label: 'Nashik' }, { value: 'MH-23', label: 'Osmanabad' }, { value: 'MH-24', label: 'Palghar' }, { value: 'MH-25', label: 'Parbhani' }, { value: 'MH-26', label: 'Pune' }, { value: 'MH-27', label: 'Raigad' }, { value: 'MH-28', label: 'Ratnagiri' }, { value: 'MH-29', label: 'Sangli' }, { value: 'MH-30', label: 'Satara' }, { value: 'MH-31', label: 'Sindhudurg' }, { value: 'MH-32', label: 'Solapur' }, { value: 'MH-33', label: 'Thane' }, { value: 'MH-34', label: 'Wardha' }, { value: 'MH-35', label: 'Washim' }, { value: 'MH-36', label: 'Yavatmal' }],
  '14': [{ value: 'MN-01', label: 'Bishnupur' }, { value: 'MN-02', label: 'Chandel' }, { value: 'MN-03', label: 'Churachandpur' }, { value: 'MN-04', label: 'Imphal East' }, { value: 'MN-05', label: 'Imphal West' }, { value: 'MN-06', label: 'Jiribam' }, { value: 'MN-07', label: 'Kakching' }, { value: 'MN-08', label: 'Kamjong' }, { value: 'MN-09', label: 'Kangpokpi' }, { value: 'MN-10', label: 'Noney' }, { value: 'MN-11', label: 'Pherzawl' }, { value: 'MN-12', label: 'Senapati' }, { value: 'MN-13', label: 'Tamenglong' }, { value: 'MN-14', label: 'Tengnoupal' }, { value: 'MN-15', label: 'Thoubal' }, { value: 'MN-16', label: 'Ukhrul' }],
  '17': [{ value: 'ML-01', label: 'East Garo Hills' }, { value: 'ML-02', label: 'East Jaintia Hills' }, { value: 'ML-03', label: 'East Khasi Hills' }, { value: 'ML-04', label: 'North Garo Hills' }, { value: 'ML-05', label: 'Ri Bhoi' }, { value: 'ML-06', label: 'South Garo Hills' }, { value: 'ML-07', label: 'South West Garo Hills' }, { value: 'ML-08', label: 'South West Khasi Hills' }, { value: 'ML-09', label: 'West Garo Hills' }, { value: 'ML-10', label: 'West Jaintia Hills' }, { value: 'ML-11', label: 'West Khasi Hills' }],
  '15': [{ value: 'MZ-01', label: 'Aizawl' }, { value: 'MZ-02', label: 'Champhai' }, { value: 'MZ-03', label: 'Kolasib' }, { value: 'MZ-04', label: 'Lawngtlai' }, { value: 'MZ-05', label: 'Lunglei' }, { value: 'MZ-06', label: 'Mamit' }, { value: 'MZ-07', label: 'Saiha' }, { value: 'MZ-08', label: 'Serchhip' }],
  '13': [{ value: 'NL-01', label: 'Dimapur' }, { value: 'NL-02', label: 'Kiphire' }, { value: 'NL-03', label: 'Kohima' }, { value: 'NL-04', label: 'Longleng' }, { value: 'NL-05', label: 'Mokokchung' }, { value: 'NL-06', label: 'Mon' }, { value: 'NL-07', label: 'Peren' }, { value: 'NL-08', label: 'Phek' }, { value: 'NL-09', label: 'Tuensang' }, { value: 'NL-10', label: 'Wokha' }, { value: 'NL-11', label: 'Zunheboto' }],
  '99': [{ value: 'OC-01', label: 'Other Country' }],
  '97': [{ value: 'OT-01', label: 'Other Territory' }],
  '21': [{ value: 'OR-01', label: 'Angul' }, { value: 'OR-02', label: 'Balangir' }, { value: 'OR-03', label: 'Balasore' }, { value: 'OR-04', label: 'Bargarh' }, { value: 'OR-05', label: 'Bhadrak' }, { value: 'OR-06', label: 'Boudh' }, { value: 'OR-07', label: 'Cuttack' }, { value: 'OR-08', label: 'Deogarh' }, { value: 'OR-09', label: 'Dhenkanal' }, { value: 'OR-10', label: 'Gajapati' }, { value: 'OR-11', label: 'Ganjam' }, { value: 'OR-12', label: 'Jagatsinghpur' }, { value: 'OR-13', label: 'Jajpur' }, { value: 'OR-14', label: 'Jharsuguda' }, { value: 'OR-15', label: 'Kalahandi' }, { value: 'OR-16', label: 'Kandhamal' }, { value: 'OR-17', label: 'Kendrapara' }, { value: 'OR-18', label: 'Kendujhar' }, { value: 'OR-19', label: 'Khordha' }, { value: 'OR-20', label: 'Koraput' }, { value: 'OR-21', label: 'Malkangiri' }, { value: 'OR-22', label: 'Mayurbhanj' }, { value: 'OR-23', label: 'Nabarangpur' }, { value: 'OR-24', label: 'Nayagarh' }, { value: 'OR-25', label: 'Nuapada' }, { value: 'OR-26', label: 'Puri' }, { value: 'OR-27', label: 'Rayagada' }, { value: 'OR-28', label: 'Sambalpur' }, { value: 'OR-29', label: 'Subarnapur' }, { value: 'OR-30', label: 'Sundargarh' }],
  '34': [{ value: 'PY-01', label: 'Karaikal' }, { value: 'PY-02', label: 'Mahe' }, { value: 'PY-03', label: 'Puducherry' }, { value: 'PY-04', label: 'Yanam' }],
  '03': [{ value: 'PB-01', label: 'Amritsar' }, { value: 'PB-02', label: 'Barnala' }, { value: 'PB-03', label: 'Bathinda' }, { value: 'PB-04', label: 'Faridkot' }, { value: 'PB-05', label: 'Fatehgarh Sahib' }, { value: 'PB-06', label: 'Fazilka' }, { value: 'PB-07', label: 'Ferozepur' }, { value: 'PB-08', label: 'Gurdaspur' }, { value: 'PB-09', label: 'Hoshiarpur' }, { value: 'PB-10', label: 'Jalandhar' }, { value: 'PB-11', label: 'Kapurthala' }, { value: 'PB-12', label: 'Ludhiana' }, { value: 'PB-13', label: 'Mansa' }, { value: 'PB-14', label: 'Moga' }, { value: 'PB-15', label: 'Muktsar' }, { value: 'PB-16', label: 'Pathankot' }, { value: 'PB-17', label: 'Patiala' }, { value: 'PB-18', label: 'Rupnagar' }, { value: 'PB-19', label: 'Sangrur' }, { value: 'PB-20', label: 'SAS Nagar' }, { value: 'PB-21', label: 'Shaheed Bhagat Singh Nagar' }, { value: 'PB-22', label: 'Tarn Taran' }],
  '08': [{ value: 'RJ-01', label: 'Ajmer' }, { value: 'RJ-02', label: 'Alwar' }, { value: 'RJ-03', label: 'Banswara' }, { value: 'RJ-04', label: 'Baran' }, { value: 'RJ-05', label: 'Barmer' }, { value: 'RJ-06', label: 'Bharatpur' }, { value: 'RJ-07', label: 'Bhilwara' }, { value: 'RJ-08', label: 'Bikaner' }, { value: 'RJ-09', label: 'Bundi' }, { value: 'RJ-10', label: 'Chittorgarh' }, { value: 'RJ-11', label: 'Churu' }, { value: 'RJ-12', label: 'Dausa' }, { value: 'RJ-13', label: 'Dholpur' }, { value: 'RJ-14', label: 'Dungarpur' }, { value: 'RJ-15', label: 'Hanumangarh' }, { value: 'RJ-16', label: 'Jaipur' }, { value: 'RJ-17', label: 'Jaisalmer' }, { value: 'RJ-18', label: 'Jalore' }, { value: 'RJ-19', label: 'Jhalawar' }, { value: 'RJ-20', label: 'Jhunjhunu' }, { value: 'RJ-21', label: 'Jodhpur' }, { value: 'RJ-22', label: 'Karauli' }, { value: 'RJ-23', label: 'Kota' }, { value: 'RJ-24', label: 'Nagaur' }, { value: 'RJ-25', label: 'Pali' }, { value: 'RJ-26', label: 'Pratapgarh' }, { value: 'RJ-27', label: 'Rajsamand' }, { value: 'RJ-28', label: 'Sawai Madhopur' }, { value: 'RJ-29', label: 'Sikar' }, { value: 'RJ-30', label: 'Sirohi' }, { value: 'RJ-31', label: 'Sri Ganganagar' }, { value: 'RJ-32', label: 'Tonk' }, { value: 'RJ-33', label: 'Udaipur' }],
  '11': [{ value: 'SK-01', label: 'East Sikkim' }, { value: 'SK-02', label: 'North Sikkim' }, { value: 'SK-03', label: 'South Sikkim' }, { value: 'SK-04', label: 'West Sikkim' }],
  '33': [{ value: 'TN-01', label: 'Ariyalur' }, { value: 'TN-02', label: 'Chengalpattu' }, { value: 'TN-03', label: 'Chennai' }, { value: 'TN-04', label: 'Coimbatore' }, { value: 'TN-05', label: 'Cuddalore' }, { value: 'TN-06', label: 'Dharmapuri' }, { value: 'TN-07', label: 'Dindigul' }, { value: 'TN-08', label: 'Erode' }, { value: 'TN-09', label: 'Kallakurichi' }, { value: 'TN-10', label: 'Kanchipuram' }, { value: 'TN-11', label: 'Kanyakumari' }, { value: 'TN-12', label: 'Karur' }, { value: 'TN-13', label: 'Krishnagiri' }, { value: 'TN-14', label: 'Madurai' }, { value: 'TN-15', label: 'Mayiladuthurai' }, { value: 'TN-16', label: 'Nagapattinam' }, { value: 'TN-17', label: 'Namakkal' }, { value: 'TN-18', label: 'Nilgiris' }, { value: 'TN-19', label: 'Perambalur' }, { value: 'TN-20', label: 'Pudukkottai' }, { value: 'TN-21', label: 'Ramanathapuram' }, { value: 'TN-22', label: 'Ranipet' }, { value: 'TN-23', label: 'Salem' }, { value: 'TN-24', label: 'Sivaganga' }, { value: 'TN-25', label: 'Tenkasi' }, { value: 'TN-26', label: 'Thanjavur' }, { value: 'TN-27', label: 'Theni' }, { value: 'TN-28', label: 'Thoothukudi' }, { value: 'TN-29', label: 'Tiruchirappalli' }, { value: 'TN-30', label: 'Tirunelveli' }, { value: 'TN-31', label: 'Tirupathur' }, { value: 'TN-32', label: 'Tiruppur' }, { value: 'TN-33', label: 'Tiruvallur' }, { value: 'TN-34', label: 'Tiruvannamalai' }, { value: 'TN-35', label: 'Tiruvarur' }, { value: 'TN-36', label: 'Vellore' }, { value: 'TN-37', label: 'Viluppuram' }, { value: 'TN-38', label: 'Virudhunagar' }],
  '36': [{ value: 'TG-01', label: 'Adilabad' }, { value: 'TG-02', label: 'Bhadradri Kothagudem' }, { value: 'TG-03', label: 'Hyderabad' }, { value: 'TG-04', label: 'Jagtial' }, { value: 'TG-05', label: 'Jangaon' }, { value: 'TG-06', label: 'Jayashankar Bhupalpally' }, { value: 'TG-07', label: 'Jogulamba Gadwal' }, { value: 'TG-08', label: 'Kamareddy' }, { value: 'TG-09', label: 'Karimnagar' }, { value: 'TG-10', label: 'Khammam' }, { value: 'TG-11', label: 'Komaram Bheem Asifabad' }, { value: 'TG-12', label: 'Mahabubabad' }, { value: 'TG-13', label: 'Mahabubnagar' }, { value: 'TG-14', label: 'Mancherial' }, { value: 'TG-15', label: 'Medak' }, { value: 'TG-16', label: 'Medchal-Malkajgiri' }, { value: 'TG-17', label: 'Mulugu' }, { value: 'TG-18', label: 'Nagarkurnool' }, { value: 'TG-19', label: 'Nalgonda' }, { value: 'TG-20', label: 'Narayanpet' }, { value: 'TG-21', label: 'Nirmal' }, { value: 'TG-22', label: 'Nizamabad' }, { value: 'TG-23', label: 'Peddapalli' }, { value: 'TG-24', label: 'Rajanna Sircilla' }, { value: 'TG-25', label: 'Rangareddy' }, { value: 'TG-26', label: 'Sangareddy' }, { value: 'TG-27', label: 'Siddipet' }, { value: 'TG-28', label: 'Suryapet' }, { value: 'TG-29', label: 'Vikarabad' }, { value: 'TG-30', label: 'Wanaparthy' }, { value: 'TG-31', label: 'Warangal Rural' }, { value: 'TG-32', label: 'Warangal Urban' }, { value: 'TG-33', label: 'Yadadri Bhuvanagiri' }],
  '16': [{ value: 'TR-01', label: 'Dhalai' }, { value: 'TR-02', label: 'Gomati' }, { value: 'TR-03', label: 'Khowai' }, { value: 'TR-04', label: 'North Tripura' }, { value: 'TR-05', label: 'Sepahijala' }, { value: 'TR-06', label: 'South Tripura' }, { value: 'TR-07', label: 'Unakoti' }, { value: 'TR-08', label: 'West Tripura' }],
  '09': [{ value: 'UP-01', label: 'Agra' }, { value: 'UP-02', label: 'Aligarh' }, { value: 'UP-03', label: 'Ambedkar Nagar' }, { value: 'UP-04', label: 'Amethi' }, { value: 'UP-05', label: 'Amroha' }, { value: 'UP-06', label: 'Auraiya' }, { value: 'UP-07', label: 'Ayodhya' }, { value: 'UP-08', label: 'Azamgarh' }, { value: 'UP-09', label: 'Baghpat' }, { value: 'UP-10', label: 'Bahraich' }, { value: 'UP-11', label: 'Ballia' }, { value: 'UP-12', label: 'Balrampur' }, { value: 'UP-13', label: 'Banda' }, { value: 'UP-14', label: 'Barabanki' }, { value: 'UP-15', label: 'Bareilly' }, { value: 'UP-16', label: 'Basti' }, { value: 'UP-17', label: 'Bhadohi' }, { value: 'UP-18', label: 'Bijnor' }, { value: 'UP-19', label: 'Budaun' }, { value: 'UP-20', label: 'Bulandshahr' }, { value: 'UP-21', label: 'Chandauli' }, { value: 'UP-22', label: 'Chitrakoot' }, { value: 'UP-23', label: 'Deoria' }, { value: 'UP-24', label: 'Etah' }, { value: 'UP-25', label: 'Etawah' }, { value: 'UP-26', label: 'Farrukhabad' }, { value: 'UP-27', label: 'Fatehpur' }, { value: 'UP-28', label: 'Firozabad' }, { value: 'UP-29', label: 'Gautam Buddha Nagar' }, { value: 'UP-30', label: 'Ghaziabad' }, { value: 'UP-31', label: 'Ghazipur' }, { value: 'UP-32', label: 'Gonda' }, { value: 'UP-33', label: 'Gorakhpur' }, { value: 'UP-34', label: 'Hamirpur' }, { value: 'UP-35', label: 'Hapur' }, { value: 'UP-36', label: 'Hardoi' }, { value: 'UP-37', label: 'Hathras' }, { value: 'UP-38', label: 'Jalaun' }, { value: 'UP-39', label: 'Jaunpur' }, { value: 'UP-40', label: 'Jhansi' }, { value: 'UP-41', label: 'Kannauj' }, { value: 'UP-42', label: 'Kanpur Dehat' }, { value: 'UP-43', label: 'Kanpur Nagar' }, { value: 'UP-44', label: 'Kasganj' }, { value: 'UP-45', label: 'Kaushambi' }, { value: 'UP-46', label: 'Kushinagar' }, { value: 'UP-47', label: 'Lakhimpur Kheri' }, { value: 'UP-48', label: 'Lalitpur' }, { value: 'UP-49', label: 'Lucknow' }, { value: 'UP-50', label: 'Maharajganj' }, { value: 'UP-51', label: 'Mahoba' }, { value: 'UP-52', label: 'Mainpuri' }, { value: 'UP-53', label: 'Mathura' }, { value: 'UP-54', label: 'Mau' }, { value: 'UP-55', label: 'Meerut' }, { value: 'UP-56', label: 'Mirzapur' }, { value: 'UP-57', label: 'Moradabad' }, { value: 'UP-58', label: 'Muzaffarnagar' }, { value: 'UP-59', label: 'Pilibhit' }, { value: 'UP-60', label: 'Pratapgarh' }, { value: 'UP-61', label: 'Prayagraj' }, { value: 'UP-62', label: 'Raebareli' }, { value: 'UP-63', label: 'Rampur' }, { value: 'UP-64', label: 'Saharanpur' }, { value: 'UP-65', label: 'Sambhal' }, { value: 'UP-66', label: 'Sant Kabir Nagar' }, { value: 'UP-67', label: 'Shahjahanpur' }, { value: 'UP-68', label: 'Shamli' }, { value: 'UP-69', label: 'Shravasti' }, { value: 'UP-70', label: 'Siddharthnagar' }, { value: 'UP-71', label: 'Sitapur' }, { value: 'UP-72', label: 'Sonbhadra' }, { value: 'UP-73', label: 'Sultanpur' }, { value: 'UP-74', label: 'Unnao' }, { value: 'UP-75', label: 'Varanasi' }],
  '05': [{ value: 'UK-01', label: 'Almora' }, { value: 'UK-02', label: 'Bageshwar' }, { value: 'UK-03', label: 'Chamoli' }, { value: 'UK-04', label: 'Champawat' }, { value: 'UK-05', label: 'Dehradun' }, { value: 'UK-06', label: 'Haridwar' }, { value: 'UK-07', label: 'Nainital' }, { value: 'UK-08', label: 'Pauri Garhwal' }, { value: 'UK-09', label: 'Pithoragarh' }, { value: 'UK-10', label: 'Rudraprayag' }, { value: 'UK-11', label: 'Tehri Garhwal' }, { value: 'UK-12', label: 'Udham Singh Nagar' }, { value: 'UK-13', label: 'Uttarkashi' }],
  '19': [{ value: 'WB-01', label: 'Alipurduar' }, { value: 'WB-02', label: 'Bankura' }, { value: 'WB-03', label: 'Birbhum' }, { value: 'WB-04', label: 'Cooch Behar' }, { value: 'WB-05', label: 'Dakshin Dinajpur' }, { value: 'WB-06', label: 'Darjeeling' }, { value: 'WB-07', label: 'Hooghly' }, { value: 'WB-08', label: 'Howrah' }, { value: 'WB-09', label: 'Jalpaiguri' }, { value: 'WB-10', label: 'Jhargram' }, { value: 'WB-11', label: 'Kalimpong' }, { value: 'WB-12', label: 'Kolkata' }, { value: 'WB-13', label: 'Malda' }, { value: 'WB-14', label: 'Murshidabad' }, { value: 'WB-15', label: 'Nadia' }, { value: 'WB-16', label: 'North 24 Parganas' }, { value: 'WB-17', label: 'Paschim Bardhaman' }, { value: 'WB-18', label: 'Paschim Medinipur' }, { value: 'WB-19', label: 'Purba Bardhaman' }, { value: 'WB-20', label: 'Purba Medinipur' }, { value: 'WB-21', label: 'Purulia' }, { value: 'WB-22', label: 'South 24 Parganas' }, { value: 'WB-23', label: 'Uttar Dinajpur' }],
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================
// ============================================================================
// UI COMPONENTS
// ============================================================================
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-white hover:text-white transition-colors focus:outline-none">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-slate-900 border text-white bg-slate-900 text-[11px] rounded-lg shadow-2xl z-[100] backdrop-blur-md text-center normal-case tracking-normal font-normal">
          {text}
          {/* Arrow */}
          <div className="absolute left-1/2 -top-1 -ml-1 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 transform rotate-45" />
        </div>
      )}
    </div>
  );
};

const FreeCornerRibbon = () => (
  <div
    aria-label="Free service"
    className="absolute top-5 -right-11 z-20 w-40 rotate-45 border border-white/35 bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-700 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(22,163,74,0.38)] pointer-events-none"
  >
    FREE
  </div>
);

// UPDATED: Removed all orange/red gradients and shadows. Now clean white/slate theme.
const StatusBanner: React.FC = () => (
  <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm mb-8 relative overflow-hidden backdrop-blur-sm">
    <div className="z-10 mb-2 sm:mb-0">
      <div className="flex items-baseline space-x-3">
        <span className="text-white font-medium line-through text-lg">₹999</span>
        <span className="text-white font-extrabold text-2xl tracking-tight drop-shadow-sm">FREE</span>
        <span className="bg-slate-700 text-slate-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-slate-600">
          Govt charges applicable
        </span>
      </div>
      <p className="text-white text-sm mt-1 font-medium">Includes Digital Signature & Filing</p>
    </div>
  </div>
);

// ============================================================================
// MAIN ROUTER COMPONENT
// ============================================================================
export default function GstRegistrationRouter({ user, packageMode = false, onComplete }: GstRegistrationRouterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const routeState = location.state as {
    preSelectedType?: unknown;
    startAtCommonStep?: boolean;
    startNewApplication?: boolean;
    source?: string;
  } | null;
  const sessionPreSelectedType = typeof window !== 'undefined' ? sessionStorage.getItem('gst_pre_selected_type') : null;
  const urlPreSelectedType = searchParams.get('type');
  const urlMode = searchParams.get('mode');
  const shouldShowStartChoice = searchParams.get('startChoice') === '1' || urlMode === 'choice';
  const preSelectedType = routeState?.preSelectedType ?? urlPreSelectedType ?? sessionPreSelectedType;
  const [shouldStartAtCommonStep] = useState(() => {
    if (urlMode === 'new' || routeState?.startAtCommonStep === true) return true;
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('gst_start_at_common_step') === 'true';
  });
  const [shouldStartNewApplication] = useState(() => {
    if (urlMode === 'new' || routeState?.startNewApplication === true) return true;
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('gst_start_new_application') === 'true';
  });
  const [forceCleanStart, setForceCleanStart] = useState(shouldStartNewApplication);
  const servicePanelType = isGstServicePanelType(preSelectedType) ? preSelectedType : null;
  const lockedConstitution = servicePanelType ? GST_TYPE_TO_CONSTITUTION[servicePanelType] : '';
  const lockedTypeLabel = servicePanelType ? GST_TYPE_LABELS[servicePanelType] : '';
  const [step, setStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState<CommonFormData>({
    businessName: '',
    tradeName: '',
    constitution: lockedConstitution,
    dateOfCommencement: '',
    panNumber: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CommonFormData, string>>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [derivedServicePanelType, setDerivedServicePanelType] = useState<GstServicePanelType | null>(servicePanelType);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const deleteAllGstDrafts = async () => {
    if (!user?.uid) return;
    const draftIds = [
      `gst_${user.uid}`,
      `gst_llp_${user.uid}`,
      `gst_partnership_${user.uid}`,
      `gst_pvtltd_${user.uid}`,
      `gst_prop_${user.uid}`,
    ];
    await Promise.allSettled(draftIds.map((draftId) => deleteDoc(doc(db, 'drafts', draftId))));
  };

  // 🔥 Draft Restoration Logic (Same as MSME)
  useEffect(() => {
    const loadDraft = async () => {
      if (!user?.uid) {
        setIsInitialLoading(false);
        return;
      }
      if (shouldShowStartChoice) {
        setIsInitialLoading(false);
        return;
      }
      if (forceCleanStart) {
        setIsInitialLoading(false);
        return;
      }
      if (typeof window !== 'undefined' && sessionStorage.getItem('gst_ignore_draft_after_submit') === 'true') {
        setIsInitialLoading(false);
        setStep(1);
        return;
      }
      try {
        // Determine which draft key(s) to check based on panel type
        const draftKeysToTry: string[] = [];
        if (servicePanelType === 'llp') draftKeysToTry.push(`gst_llp_${user.uid}`);
        else if (servicePanelType === 'partnership') draftKeysToTry.push(`gst_partnership_${user.uid}`);
        else if (servicePanelType === 'pvt_ltd') draftKeysToTry.push(`gst_pvtltd_${user.uid}`);
        else if (servicePanelType === 'proprietorship' || servicePanelType === 'shops') draftKeysToTry.push(`gst_prop_${user.uid}`);
        
        // Always also try the shared key as a fallback
        draftKeysToTry.push(`gst_${user.uid}`);

        let draftData: any = null;
        for (const key of draftKeysToTry) {
          try {
            const snap = await getDoc(doc(db, 'drafts', key));
            if (snap.exists()) {
              draftData = snap.data();
              break;
            }
          } catch (e) {
            // Ignore
          }
        }

          if (draftData) {
          // Restore common data if available
          if (draftData.commonData) {
            setFormData(prev => ({ ...prev, ...draftData.commonData }));
          }
          setLastDraftSavedAt(draftData.updatedAt?.toDate?.() || draftData.lastUpdated?.toDate?.() || new Date());

          // Restore service panel type if it was saved in the draft
          if (draftData.servicePanelType && !derivedServicePanelType) {
            setDerivedServicePanelType(draftData.servicePanelType);
          } else if (!derivedServicePanelType && draftData.commonData?.constitution) {
            // Fallback: Infer from constitution
            const entry = Object.entries(GST_TYPE_TO_CONSTITUTION).find(([, v]) => v === draftData.commonData.constitution);
            if (entry) setDerivedServicePanelType(entry[0] as GstServicePanelType);
          }

          // If the draft indicates we were already in a sub-form (step 2), auto-advance
          if (!shouldStartAtCommonStep && (draftData.currentStep !== undefined || draftData.formData)) {
            setStep(2);
          } else {
            setStep(1);
          }
        }
      } catch (err) {
        console.error("Failed to load GST router draft:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadDraft();
  }, [user?.uid, servicePanelType, derivedServicePanelType, shouldStartAtCommonStep, forceCleanStart, shouldShowStartChoice]);

  useEffect(() => {
    if (!shouldStartAtCommonStep) return;
    setStep(1);
    sessionStorage.removeItem('gst_start_at_common_step');
    sessionStorage.removeItem('gst_pre_selected_type');
    sessionStorage.removeItem('gst_start_new_application');
  }, [shouldStartAtCommonStep]);

  useEffect(() => {
    if (!forceCleanStart || !user?.uid) return;
    deleteAllGstDrafts().catch((err) => console.error('Failed to clear GST drafts for new start:', err));
  }, [forceCleanStart, user?.uid]);

  const saveCommonDraft = async () => {
    if (packageMode || !user?.uid) return;
    setIsDraftSaving(true);
    try {
      const draftPayload = {
        userId: user.uid,
        userEmail: user.email || '',
        serviceType: 'gst',
        title: 'GST Registration',
        constitution: formData.constitution,
        commonData: formData,
        servicePanelType: derivedServicePanelType,
        routeState: { preSelectedType: derivedServicePanelType },
        currentStep: 1,
        updatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        status: 'draft',
      };
      await setDoc(doc(db, 'drafts', `gst_${user.uid}`), draftPayload, { merge: !forceCleanStart });
      setLastDraftSavedAt(new Date());
    } catch (err) {
      console.error("GST common draft save failed:", err);
      throw err;
    } finally {
      setIsDraftSaving(false);
    }
  };

  const handleStartNewChoice = async () => {
    if (typeof window !== 'undefined') {
      const prefixes = ['gstCommon', 'gstProprietor', 'gstPrivate', 'gstLLP', 'gstPartnership', 'gst_part'];
      Object.keys(localStorage).forEach((key) => {
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      });
    }
    setFormData({
      businessName: '',
      tradeName: '',
      constitution: derivedServicePanelType ? GST_TYPE_TO_CONSTITUTION[derivedServicePanelType] : lockedConstitution,
      dateOfCommencement: '',
      panNumber: '',
    });
    setErrors({});
    setLastDraftSavedAt(null);
    setStep(1);
    setForceCleanStart(true);
    await deleteAllGstDrafts();
    sessionStorage.setItem('gst_start_new_application', 'true');
    sessionStorage.setItem('gst_start_at_common_step', 'true');
    navigate('/services/gst-registration/form', {
      replace: true,
      state: {
        verified: true,
        source: 'start-new',
        preSelectedType: derivedServicePanelType || servicePanelType,
        startAtCommonStep: true,
        startNewApplication: true,
      },
    });
  };

  const handleExistingDraftChoice = () => {
    sessionStorage.removeItem('gst_start_new_application');
    sessionStorage.removeItem('gst_start_at_common_step');
    navigate('/services/gst-registration/form', {
      replace: true,
      state: {
        verified: true,
        source: 'existing-draft',
        preSelectedType: derivedServicePanelType || servicePanelType,
        resumeDraft: true,
      },
    });
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExiting || packageMode) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = () => {
      if (isExiting || packageMode) return;
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
  }, [isExiting, packageMode]);

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave) {
      try {
        await saveCommonDraft();
        setShowExitConfirm(false);
        setShowDraftSuccessModal(true);
        setTimeout(() => {
          setShowDraftSuccessModal(false);
          setIsExiting(true);
          navigate('/services/gst-registration');
        }, 1500);
      } catch (err) {
        console.error("GST exit save failed:", err);
        setShowExitConfirm(false);
      }
      return;
    }

    setIsExiting(true);
    navigate('/services/gst-registration');
  };

  // ============================================================================
  // FORM RESET LOGIC
  // ============================================================================
  const clearFormData = () => {
    localStorage.removeItem('gstCommonFormData');
    setFormData({
      businessName: '',
      tradeName: '',
      constitution: derivedServicePanelType ? GST_TYPE_TO_CONSTITUTION[derivedServicePanelType] : '',
      dateOfCommencement: '',
      panNumber: '',
    });
    setErrors({});
    setStep(1);
  };

  // Validators
  const validateField = (name: keyof CommonFormData, value: string): string => {
    switch (name) {
      case 'businessName':
        return /^[A-Za-z0-9\s&().,-]{3,100}$/.test(value) ? '' : 'Enter a valid business name (3-100 chars)';
      case 'constitution':
        return value ? '' : 'Please select a constitution type';
      case 'panNumber':
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value) ? '' : 'Invalid PAN format (ABCDE1234F)';
      case 'dateOfCommencement':
        return value ? '' : 'Date is required';
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const key = name as keyof CommonFormData;
    if (key === 'constitution') return;
    let formattedValue = value;
    if (key === 'panNumber') {
      formattedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    }
    setFormData(prev => ({ ...prev, [key]: formattedValue }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: validateField(key, formattedValue) }));
    }
  };

  const handleCommonSubmit = async () => {
    const newErrors: Partial<Record<keyof CommonFormData, string>> = {};
    (['businessName', 'constitution', 'panNumber', 'dateOfCommencement'] as const).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 🔥 SAVE PARTIAL DRAFT: Save Business Details before moving to Step 2
    await saveCommonDraft();

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowExitConfirm(true);
    }
  };

  // Progress steps configuration
  const progressSteps = [
    { id: 1, label: 'Business Details', completed: false },
    { id: 2, label: 'Promoter Details', completed: false },
    { id: 3, label: 'Place of Business', completed: false },
    { id: 4, label: 'Nature of Business', completed: false },
    { id: 5, label: 'Documents', completed: false },
    { id: 6, label: 'Consent', completed: false },
  ];

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-white text-sm font-medium animate-pulse">Loading Application Details...</p>
      </div>
    );
  }

  if (shouldShowStartChoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" />
        <div className="relative z-10 w-full max-w-md rounded-[28px] border border-slate-700 bg-slate-900 p-7 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
          <div className="relative text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mb-2 text-2xl font-black uppercase tracking-tight text-white">GST Application</h3>
            <p className="mb-7 text-sm font-medium leading-6 text-slate-400">
              Do you want to start a fresh GST form or continue your saved draft?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStartNewChoice}
                className="w-full rounded-xl bg-orange-600 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500"
              >
                Start New Form
              </button>
              <button
                type="button"
                onClick={handleExistingDraftChoice}
                className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-cyan-100 transition-all hover:bg-cyan-400/15"
              >
                Existing Draft Form
              </button>
              <button
                type="button"
                onClick={() => navigate('/services/gst-registration')}
                className="w-full rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-all hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const finalServicePanelType = derivedServicePanelType;
  const finalTypeLabel = finalServicePanelType ? GST_TYPE_LABELS[finalServicePanelType] : '';

  if (!finalServicePanelType) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="max-w-lg w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl p-6 sm:p-8 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
          <h1 className="text-2xl font-extrabold text-white mb-3">Choose GST Business Type</h1>
          <p className="text-slate-300 text-sm leading-6 mb-6">
            Please select your business type from the GST service panel first. The selected type is locked here so the correct form and checklist stay consistent.
          </p>
          <button
            type="button"
            onClick={() => navigate('/services/gst-registration')}
            className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-bold py-3 px-5 rounded-xl transition-all duration-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Render Progress Sidebar - UPDATED: Removed orange highlights, using white/slate
  const renderProgressSidebar = () => (
    <aside className="lg:col-span-5 xl:col-span-4 sticky top-8 hidden lg:block">
      <div className="space-y-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-[0_8px_30px_0_rgba(0,0,0,0.5)]">
          <h3 className="text-white text-sm font-semibold mb-4">Progress Status</h3>
          <div className="relative border-l-2 border-slate-700/60 ml-2 space-y-6 my-2">
            {progressSteps.map((stepItem, index) => {
              const isActive = step === 1 && index === 0;
              const isCompleted = step === 2 && index > 0;
              const isCurrentStep2 = step === 2 && index === 0;
              return (
                <div key={stepItem.id} className="ml-5 relative">
                  <span
                    className={`absolute -left-[27px] w-3 h-3 rounded-full border-2 border-slate-800 transition-all duration-300 ${isCompleted || (step === 2 && index < 4)
                      ? 'bg-cyan-500 shadow-[0_0_10px_rgba(8,145,178,0.6)]'
                      : isActive || isCurrentStep2
                        ? 'bg-white ring-4 ring-white/20 shadow-[0_0_12px_rgba(255,255,255,0.7)] scale-110'
                        : 'bg-slate-700'
                      }`}
                  ></span>
                  <h4
                    className={`text-xs font-medium transition-colors duration-200 ${isCompleted || (step === 2 && index < 4)
                      ? 'text-cyan-400 font-bold'
                      : isActive || isCurrentStep2
                        ? 'text-white font-bold'
                        : 'text-white'
                      }`}
                  >
                    {stepItem.label}
                  </h4>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pt-2 flex justify-center">
          <button
            disabled
            className="w-full py-4 rounded-xl bg-slate-900/40 border border-slate-700/50 text-white font-bold tracking-wide cursor-not-allowed"
          >
            Preview Application
          </button>
        </div>
      </div>
    </aside>
  );

  // Render Common Step (Step 1)
  const renderCommonStep = () => (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      {showDraftSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_20px_50px_rgba(16,185,129,0.1)] animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Draft Saved!</h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
              Your GST registration progress has been securely saved as a draft.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/5 py-2.5 px-5 rounded-full border border-emerald-400/10 w-fit mx-auto">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Redirecting to Service Panel...
            </div>
          </div>
        </div>
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
                  className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                  className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/20 transition-all disabled:opacity-50"
                >
                  No, Just Exit
                </button>
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isDraftSaving}
                  className="w-full py-4 rounded-xl text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-[1600px] mx-auto">
        <div className="lg:hidden mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-white drop-shadow-lg">GST Registration</h1>
          <p className="text-teal-300/80 text-sm font-medium mt-1">Step 1 of 6</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden relative min-h-[600px] flex flex-col border border-slate-700/50">
            <FreeCornerRibbon />
            <div className="absolute top-5 left-5 z-20">
              <div className="flex items-center gap-4">
                <FormBackButton onBack={handleBack} />
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(true)}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Exit Session
                </button>
              </div>
            </div>
            <div className="p-6 md:p-10 flex-grow pt-14 bg-slate-900/40">
              <div className="mb-8 hidden lg:block text-center">
                <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md pb-1">GST Registration</h1>
                <p className="text-slate-300 text-base max-w-lg leading-relaxed mt-2 mx-auto">
                  Enter your business legal details and PAN to get started
                </p>
              </div>
              <StatusBanner />
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleCommonSubmit(); }} noValidate>
                <div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-white mb-2">
                      Name of Business (as per PAN) <span className="text-red-500">*</span>
                    </label>
                    <InfoTooltip text="Enter the exact legal name as mentioned on your PAN card to avoid rejection." />
                  </div>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    onBlur={() => setErrors(prev => ({ ...prev, businessName: validateField('businessName', formData.businessName) }))}
                    className={`w-full bg-slate-800/80 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:outline-none transition-all ${errors.businessName
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-500'
                      }`}
                    placeholder="e.g., Kumar Enterprises"
                    required
                    autoFocus
                  />
                  {errors.businessName && <p className="mt-1.5 text-xs text-red-400 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.businessName}
                  </p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center">
                      <label className="block text-sm font-medium text-white mb-2">
                        Constitution of Business <span className="text-red-500">*</span>
                      </label>
                      <InfoTooltip text="Select the legal structure of your business. This determines the required documents." />
                    </div>
                    <div
                      className={`w-full bg-slate-800/80 border text-white text-sm rounded-lg p-3 transition-all ${errors.constitution
                        ? 'border-red-500'
                        : 'border-slate-700'
                        }`}
                    >
                      <div className="font-semibold">{finalTypeLabel}</div>
                      <div className="text-xs text-white mt-1">
                        Selected from the GST service panel. Go back to change it.
                      </div>
                    </div>
                    {errors.constitution && <p className="mt-1.5 text-xs text-red-400">{errors.constitution}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Date of Commencement <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="dateOfCommencement"
                      value={formData.dateOfCommencement}
                      onChange={handleChange}
                      onBlur={() => setErrors(prev => ({ ...prev, dateOfCommencement: validateField('dateOfCommencement', formData.dateOfCommencement) }))}
                      className={`w-full bg-slate-800/80 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:outline-none appearance-none transition-all ${errors.dateOfCommencement
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-500'
                        }`}
                      max={new Date().toISOString().split('T')[0]}
                      required
                      style={{ colorScheme: 'dark' }}
                    />
                    {errors.dateOfCommencement && <p className="mt-1.5 text-xs text-red-400">{errors.dateOfCommencement}</p>}
                  </div>
                </div>
                <div>
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-white mb-2">
                      Firm PAN Number <span className="text-red-500">*</span>
                    </label>
                    <InfoTooltip text="Enter your 10-digit Permanent Account Number. For companies/firms, enter the entity's PAN." />
                  </div>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleChange}
                    onBlur={() => setErrors(prev => ({ ...prev, panNumber: validateField('panNumber', formData.panNumber) }))}
                    className={`w-full bg-slate-800/80 border text-white text-sm rounded-lg p-3 focus:ring-2 focus:outline-none uppercase font-mono transition-all ${errors.panNumber
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20 hover:border-slate-500'
                      }`}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    required
                  />
                  {errors.panNumber && <p className="mt-1.5 text-xs text-red-400 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.panNumber}
                  </p>}
                  <p className="mt-1.5 text-xs text-white font-mono">Permanent Account Number of the Business</p>
                </div>
                <div className="pt-8">
                  <button
                    type="submit"
                    disabled={isDraftSaving}
                    className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(8,145,178,0.4)] hover:shadow-[0_0_25px_rgba(8,145,178,0.6)] hover:-translate-y-0.5 border border-cyan-500/30 disabled:opacity-50"
                  >
                    {isDraftSaving ? 'Saving...' : 'Continue to Application'}
                    {!isDraftSaving && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>}
                  </button>
                  {lastDraftSavedAt && (
                    <p className="mt-4 text-center text-xs text-emerald-300">
                      Draft saved at {lastDraftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </form>
            </div>
          </main>
          {renderProgressSidebar()}
        </div>
        <div className="mt-12 text-center text-white text-sm pb-8 font-medium tracking-wide">&copy; 2026 RegiBIZ. All rights reserved.</div>
      </div>
    </div>
  );

  // Render Constitution-Specific Form (Step 2)
  const renderConstitutionForm = () => {
    const props = {
      user,
      commonData: formData,
      packageMode,
      onBack: handleBack,
      onSubmit: async (submissionData: any, uploadedFiles: Record<string, File>) => {
        try {
          if (packageMode && onComplete) {
            onComplete(submissionData);
            return;
          }
          console.log('Parent submission handler received:', {
            caseId: submissionData.caseId,
            status: submissionData.status,
            filesCount: Object.keys(uploadedFiles).length,
          });

          // 🔥 FALLBACK EMAIL CONFIRMATION (if child form didn't send it)
          if (user?.email && submissionData?.caseId) {
            await sendConfirmationEmail({
              name: submissionData.formData?.promoterName ||
                submissionData.formData?.firmName ||
                submissionData.commonData?.businessName ||
                'Applicant',
              email: user.email,
              service: `GST Registration - ${submissionData.constitution || 'Business'}`,
              caseId: submissionData.caseId,
            });
          }

          // Clear common form data on success
          localStorage.removeItem('gstCommonFormData');
          sessionStorage.setItem('gst_ignore_draft_after_submit', 'true');
          sessionStorage.removeItem('gst_start_new_application');
          sessionStorage.removeItem('gst_start_at_common_step');
          await deleteAllGstDrafts();
          console.log(`✅ Application successfully submitted with Case ID: ${submissionData.caseId || submissionData.id}`);
        } catch (error: any) {
          console.error('⚠️ Parent handler error (non-critical):', error.message);
        }
      },
      INDIAN_STATES,
      STATE_DISTRICTS,
    };

    switch (formData.constitution) {
      case 'Private Limited Company':
        return <PrivateLimitedForm {...props} />;
      case 'LLP':
        return <LLPForm {...props} />;
      case 'Proprietorship':
        return (
          <ProprietorshipForm
            {...props}
            gstServiceType={servicePanelType === 'shops' ? 'shops' : 'proprietorship'}
            serviceTypeLabel={lockedTypeLabel}
          />
        );
      case 'Partnership':
        return <PartnershipForm {...props} />;
      default:
        return renderCommonStep();
    }
  };

  return step === 1 ? renderCommonStep() : renderConstitutionForm();
}
