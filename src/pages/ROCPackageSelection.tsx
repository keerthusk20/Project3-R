import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Briefcase,
    Star,
    Users,
    Receipt,
    Info,
    CheckCircle,
    ChevronRight,
    ShieldCheck,
    Zap,
    Clock,
    Package,
    BadgeCheck
} from 'lucide-react';
import { PRICING_CONFIG } from '../data/pricingConfig';

const ROCPackageSelection = () => {
    const navigate = useNavigate();

    // --- STYLES (Matching ServiceHub.tsx) ---
    const HEADING_GRADIENT = "bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent";
    const PRIMARY_GRADIENT = "bg-gradient-primary";
    const CARD_HOVER = "hover:border-cyan-500/50 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)] transition-all duration-300";
    const GLASS_CARD = "bg-background/80 backdrop-blur-xl border border-white/10 rounded-2xl";

    const packages = [
        {
            id: 'roc-standard-package',
            name: 'ROC Standard Package',
            fee: PRICING_CONFIG["roc-package-standard"].fee,
            tag: 'Value' as const,
            govCharges: 'Service Fee | Govt charges applicable',
            applications: 1240,
            completionRate: 90,
            packageType: 'standard',
            color: 'green',
            features: [
                'ADT-1 Filing',
                'INC-20A Filing',
                'DIR-3 KYC',
                'MSME Registration',
                'Auditor Consent Letter',
                'Board Resolution – PDF'
            ]
        },
        {
            id: 'roc-premium-package',
            name: 'ROC Premium Package',
            fee: PRICING_CONFIG["roc-package-premium"].fee,
            tag: 'Recommended' as const,
            govCharges: 'Service Fee | Govt charges applicable',
            applications: 850,
            completionRate: 90,
            packageType: 'premium',
            color: 'mustard',
            features: [
                'MSME Reg.',
                'GST Reg.',
                'ADT-1',
                'INC-20A',
                'DIR-3 KYC',
                'AOC-4',
                'MGT-7A'
            ]
        },
    ];

    const getPackageTheme = (color: string) => {
        switch (color) {
            case 'emerald': return {
                gradient: 'bg-gradient-to-br from-emerald-600/80 to-teal-500/80',
                glow: 'shadow-emerald-900/20',
                border: 'hover:border-emerald-500/50',
                iconBg: 'bg-emerald-500/10 text-emerald-400',
                buttonGlow: 'shadow-emerald-900/30',
                accent: 'emerald'
            };
            case 'cyan': return {
                gradient: 'bg-gradient-to-br from-blue-600/80 to-indigo-500/80',
                glow: 'shadow-blue-900/20',
                border: 'hover:border-blue-500/50',
                iconBg: 'bg-blue-500/10 text-blue-400',
                buttonGlow: 'shadow-blue-900/30',
                accent: 'blue'
            };
            case 'violet': return {
                gradient: 'bg-gradient-to-br from-violet-600/80 to-purple-500/80',
                glow: 'shadow-violet-900/20',
                border: 'hover:border-violet-500/50',
                iconBg: 'bg-violet-500/10 text-violet-400',
                buttonGlow: 'shadow-violet-900/30',
                accent: 'violet'
            };
            default: return {
                gradient: PRIMARY_GRADIENT,
                glow: 'shadow-cyan-900/20',
                border: CARD_HOVER,
                iconBg: 'bg-cyan-500/10 text-cyan-400',
                buttonGlow: 'shadow-cyan-900/30',
                accent: 'cyan'
            };
        }
    };

    const getTagColor = (tag?: string) => {
        switch (tag) {
            case 'Free': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'Value': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'Popular': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            case 'Trending': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'New': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'Best Value': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            case 'Recommended': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    const handleAvailService = (pkgType: string) => {
        navigate(`/services/roc-package/requirements?type=${pkgType}`, {
            state: { preSelectedType: pkgType },
        });
    };

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 animate-fade-in pb-20 max-w-7xl mx-auto">
            <button
                onClick={() => navigate('/services')}
                className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors group font-medium"
            >
                <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Service Hub
            </button>

            <div className="text-center mb-12">
                <h2 className={`text-4xl md:text-5xl font-black ${HEADING_GRADIENT} mb-4 tracking-tight`}>
                    Select Your ROC Package
                </h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                    Choose the right compliance bundle for your company. Our experts handle everything from filing to confirmation.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
                {packages.map((pkg) => {
                    const theme = getPackageTheme(pkg.color);
                    const isRecommended = pkg.tag === 'Recommended';

                    return (
                        <div
                            key={pkg.id}
                            className={`${GLASS_CARD} relative group transition-all duration-500 ${theme.border} flex flex-col h-full overflow-hidden ${isRecommended ? 'md:scale-[1.03] md:z-10 border-amber-500/30' : ''}`}
                        >
                            {/* Radial Glow Background */}
                            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40 ${theme.accent === 'green' ? 'bg-emerald-500' :
                                theme.accent === 'yellow' ? 'bg-amber-500' :
                                    'bg-orange-500'
                                }`} />

                            {/* Top Gradient Line */}
                            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${theme.gradient}`} />

                            {/* Tag */}
                            <div className="p-6 pb-0 flex justify-end">
                                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap ${getTagColor(pkg.tag)}`}>
                                    {pkg.tag}
                                </span>
                            </div>

                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex items-start gap-4 mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white ${theme.gradient} shadow-lg ${theme.glow} shrink-0 transition-transform duration-500 group-hover:scale-110`}>
                                        <Package size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/70 transition-all">
                                            {pkg.name}
                                        </h3>
                                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 font-medium">
                                            <Users size={12} className="text-gray-600" />
                                            <span>{pkg.applications}+ Companies Registered</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Fee Breakdown Box */}
                                <div className="bg-white/[0.03] rounded-2xl p-4 mb-6 border border-white/5 transition-colors group-hover:bg-white/[0.05]">
                                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                                        <span className="text-sm text-gray-400 font-medium flex items-center gap-2">
                                            <Receipt size={14} className="text-gray-500" /> Service Fee
                                        </span>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-xl font-black ${pkg.fee === 0 ? 'text-emerald-400' : 'text-white'}`}>
                                                {pkg.fee === 0 ? 'FREE' : `₹${pkg.fee.toLocaleString()}`}
                                            </span>
                                            {pkg.fee > 0 && <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">+ GST</span>}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-start gap-4">
                                        <span className="text-sm text-gray-400 font-medium flex items-center gap-2 shrink-0">
                                            <Info size={14} className="text-gray-500" /> Coverage
                                        </span>
                                        <span className="text-xs text-gray-400 text-right leading-relaxed font-medium">
                                            {pkg.govCharges}
                                        </span>
                                    </div>
                                </div>

                                {/* Benefits */}
                                <div className="space-y-3.5 mb-8 flex-1">
                                    {pkg.features.map((benefit, idx) => (
                                        <div key={idx} className="flex items-center gap-3 text-sm text-gray-300 group/item">
                                            <div className={`${theme.iconBg} rounded-lg p-1 shrink-0 transition-colors group-hover/item:bg-opacity-30`}>
                                                <CheckCircle size={14} />
                                            </div>
                                            <span className="transition-colors group-hover:text-white">{benefit}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-6 border-t border-white/5 space-y-4">
                                    <div className="flex items-center justify-between text-[11px] font-bold tracking-tight">
                                        <span className="text-emerald-400/80 flex items-center gap-1.5 uppercase">
                                            <ShieldCheck size={13} /> {pkg.completionRate}% Verified
                                        </span>
                                        <span className="text-gray-500 flex items-center gap-1.5 uppercase">
                                            <Clock size={13} /> Standard Delivery
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleAvailService(pkg.packageType)}
                                        className={`w-full ${theme.gradient} text-white font-bold py-4 rounded-xl transition-all shadow-lg ${theme.buttonGlow} hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group/btn relative overflow-hidden`}
                                    >
                                        <span className="relative z-10 flex items-center gap-2">
                                            Avail Service
                                            <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                                        </span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { icon: ShieldCheck, text: "100% Secure", desc: "Encrypted Data" },
                    { icon: BadgeCheck, text: "Verified Experts", desc: "CA/CS Certified" },
                    { icon: Zap, text: "Fast Processing", desc: "Priority Filing" },
                    { icon: Package, text: "All-in-one", desc: "No Hidden Costs" }
                ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/[0.08] hover:border-cyan-500/20 transition-all duration-300 group">
                        <item.icon size={24} className="text-cyan-500 mb-1 group-hover:scale-110 transition-transform" />
                        <div className="text-center">
                            <span className="text-sm font-bold text-white block">{item.text}</span>
                            <span className="text-[10px] text-gray-500 font-medium">{item.desc}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ROCPackageSelection;