import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ChevronRight, Shield, Star, Clock, Info, Lock } from 'lucide-react';
import { UserProfile } from '../types';
import { mockDbService } from '../services/mockFirebase';
import { generateServiceId } from '../utils/helpers';
import { runTransaction, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

const generateTrackingId = async () => {
   const currentYear = new Date().getFullYear();
   const counterRef = doc(db, 'system_counters', `tracking_${currentYear}`);
   try {
      return await runTransaction(db, async (transaction) => {
         const counterDoc = await transaction.get(counterRef);
         let newSequence = 1;
         if (!counterDoc.exists()) {
            transaction.set(counterRef, { current: 1 });
         } else {
            newSequence = (counterDoc.data().current || 0) + 1;
            transaction.update(counterRef, { current: newSequence });
         }
         return `TRACK-${currentYear}-${newSequence.toString().padStart(2, '0')}`;
      });
   } catch (error) {
      console.error("Error generating tracking ID:", error);
      return `TRACK-${currentYear}-${Date.now().toString().slice(-6)}`;
   }
};

// --- LANDING PAGE COMPONENT ---
interface ServiceLandingProps {
   id: string;
   title: string;
   description: string;
   price: number;
   features: string[];
   benefits?: string[];
   documentsRequired?: string[];
}

export const ServiceLanding: React.FC<ServiceLandingProps> = ({
   id, title, description, price, features, benefits, documentsRequired
}) => {
   const navigate = useNavigate();

   return (
      <div className="p-6 md:p-8 animate-fade-in pb-20 max-w-5xl mx-auto">
         <button onClick={() => navigate('/services')} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} className="mr-2" /> Back to Hub
         </button>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
               <h1 className="text-3xl font-bold text-gradient-heading mb-4">{title}</h1>
               <p className="text-gray-300 text-lg mb-6 leading-relaxed">{description}</p>

               <div className="flex items-center gap-4 mb-8">
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                     <span className="text-xs text-gray-500 uppercase font-bold block">Service Fee + Charges</span>
                     <span className="text-2xl font-bold text-white font-mono">₹{price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                     <Clock size={18} />
                     <span className="text-sm font-bold">7-14 Days SLA</span>
                  </div>
               </div>

               <button
                  onClick={() => navigate(`/services/${id}/form`)}
                  className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1"
               >
                  Apply Now <ChevronRight size={18} />
               </button>

               {features && (
                  <div className="mt-10">
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">What's Included</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {features.map((feat, i) => (
                           <div key={i} className="flex items-center gap-3 text-gray-300">
                              <CheckCircle size={16} className="text-orange-500 shrink-0" />
                              <span className="text-sm">{feat}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>

            <div className="space-y-6">
               <div className="glass-panel p-6 rounded-xl border border-white/10">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Shield size={18} className="text-blue-400" /> Compliance Benefit</h3>
                  <ul className="space-y-3">
                     {(benefits || ['Legal Protection', 'Business Credibility', 'Banking Ease']).map((b, i) => (
                        <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                           <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0"></span>
                           {b}
                        </li>
                     ))}
                  </ul>
               </div>

               {documentsRequired && (
                  <div className="glass-panel p-6 rounded-xl border border-white/10">
                     <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Star size={18} className="text-amber-400" /> Required Documents</h3>
                     <ul className="space-y-2">
                        {documentsRequired.map((doc, i) => (
                           <li key={i} className="text-xs text-gray-400 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                              {doc}
                           </li>
                        ))}
                     </ul>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

// --- FORM COMPONENT ---
interface ServiceFormProps {
   id: string;
   title: string;
   user?: UserProfile; // Optional as per usage
}

export const ServiceForm: React.FC<ServiceFormProps> = ({ id, title, user }) => {
   const navigate = useNavigate();
   const [submitting, setSubmitting] = useState(false);
   const [formData, setFormData] = useState({
      businessName: user?.company || '',
      address: '',
      pan: '',
      email: user?.email || '',
      phone: user?.phoneNumber || ''
   });

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      // Safety check for user
      if (!user || !user.uid) {
         alert("Please login to submit an application.");
         return;
      }

      setSubmitting(true);

      try {
         const trackingId = await generateTrackingId();
         const docId = `DOC-${Date.now()}`;
         const serviceId = generateServiceId(id.toUpperCase());

         // Direct DB Submission (Bypassing Razorpay completely)
         await mockDbService.createDocument({
            id: docId,
            type: id as any,
            title: title,
            serviceId: serviceId,
            trackingId: trackingId,
            status: 'submitted', // Initial status
            submittedAt: Date.now(),
            formData: {
               ...formData,
               paymentStatus: 'Pending Offline Payment', // Mark as unpaid/offline
               customerName: user.displayName || 'Unknown',
               customerId: user.userId || user.uid // Ensure Customer ID is saved for Admin view
            },
            userId: user.uid,
            amount: 0, // Set to 0 or base fee, but collected offline
            folderId: 'regibiz' // Explicitly saving to regibiz folder
         } as any);

         // Visual Feedback
         alert("Application Submitted Successfully! You can track this in 'My Documents'. Our team will contact you for payment.");
         navigate('/documents');
      } catch (e) {
         console.error("Submission error:", e);
         alert("Submission failed. Please check your connection.");
      } finally {
         setSubmitting(false);
      }
   };

   return (
      <div className="p-6 md:p-8 animate-fade-in max-w-3xl mx-auto">
         <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} className="mr-2" /> Back
         </button>

         <div className="glass-panel rounded-2xl p-8 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4">Application for {title}</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                     <label className="block text-xs font-medium text-gray-400 mb-2">Business Name</label>
                     <input required type="text" className="w-full bg-card border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-gray-400 mb-2">PAN Number</label>
                     <input required type="text" className="w-full bg-card border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 uppercase"
                        value={formData.pan} onChange={e => setFormData({ ...formData, pan: e.target.value })} />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                     <label className="block text-xs font-medium text-gray-400 mb-2">Email</label>
                     <input required type="email" className="w-full bg-card border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-gray-400 mb-2">Phone</label>
                     <input required type="tel" className="w-full bg-card border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Registered Address</label>
                  <textarea required rows={3} className="w-full bg-card border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                     value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
               </div>

               {/* Offline Payment Notice */}
               <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                  <Info className="text-blue-400 mt-0.5 shrink-0" size={18} />
                  <div>
                     <p className="text-sm text-blue-300 font-medium">Payment Information</p>
                     <p className="text-xs text-blue-400/70 mt-1">
                        This application will be processed manually. No immediate online payment is required.
                        Our support team will verify your documents and contact you for the payment step.
                     </p>
                  </div>
               </div>

               <div className="pt-4 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                     <Lock size={12} />
                     <span>Secure Submission</span>
                  </div>
                  <button
                     type="submit"
                     disabled={submitting}
                     className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20 w-full md:w-auto"
                  >
                     {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
};