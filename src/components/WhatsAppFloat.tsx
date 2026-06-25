import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, ArrowRight, Sparkles, ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import chatData from '../data/enhancedChatData.json';
import { scoreResponse, getImprovementSuggestions } from '../services/responseScoring';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';

const MODEL_ID = "openai/gpt-oss-120b:free";
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

interface Message {
    id: string;
    text: string;
    sender: 'bot' | 'user';
    timestamp: Date;
    score?: number;
    feedback?: { rating: number; comment?: string };
}

// ✅ Unique ID generator
const generateMessageId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// ✅ FIX: Strip ** markdown from responses
const stripMarkdown = (text: string): string => {
    return text.replace(/\*\*/g, '');
};

// ✅ NEW: Google Icon with 5 Stars
const GoogleIconWithStars = () => (
    <div className="flex flex-col items-center gap-1">
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-2 h-2 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    </div>
);

const WhatsAppFloat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [userContext, setUserContext] = useState<any>(null);
    const [isFetchingContext, setIsFetchingContext] = useState(false);
    const [waitingForFeedback, setWaitingForFeedback] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const phoneNumber = "916364562818";
    const defaultMessage = "Hello, I need assistance with my application on RegiBIZ.";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
    const googleReviewUrl = "https://www.google.com/search?sca_esv=c615aacbb620d3c2&sxsrf=ANbL-n49vuHIGEMPE0FrwhfAkAPUjXirNQ:1777898448603&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOWy5ey5FnoUyD0Aoa6_dtcDaVYe5QRrHme1atLb9aV_syE6yF9BRqYIMT8HAPwuzmsevpDIGTniGe5jIVBFGC-SuWgq6NRrX3ypPQUTwOFLQjHs5SvF0jRATlUVgkEDzu8JHLIw%3D&q=CloudMaSa+Innovation+Lab+Private+Limited+Reviews&sa=X&ved=2ahUKEwiV8ebr05-UAxV9R2wGHYPKIeUQ0bkNegQIOBAH&biw=1854&bih=961&dpr=1#lrd=0x3a53614383b45d25:0x6e51b3d397031e56,3,,,,";
    const showReviewButton = location.pathname === '/' || location.pathname === '/landing_page';

    const fetchUserContext = async (uid: string) => {
        setIsFetchingContext(true);
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            const userData = userDoc.exists() ? userDoc.data() : null;

            const collections = ['applications', 'pan-applications', 'company-applications'];
            let allApplications: any[] = [];

            for (const colName of collections) {
                try {
                    const q = query(collection(db, colName), where('userId', '==', uid), orderBy('submittedAt', 'desc'), limit(5));
                    const snap = await getDocs(q);
                    snap.forEach(d => {
                        const data = d.data();
                        const submittedAt = data.submittedAt?.seconds
                            ? new Date(data.submittedAt.seconds * 1000).toISOString()
                            : data.submittedAt || new Date().toISOString();

                        allApplications.push({
                            id: d.id,
                            status: data.status,
                            title: data.title || data.serviceName || (colName === 'pan-applications' ? 'PAN Card' : 'Application'),
                            type: data.type || (colName === 'pan-applications' ? 'pan' : 'unknown'),
                            submittedAt,
                            caseId: data.caseId || d.id
                        });
                    });
                } catch (colErr) {
                    console.warn(`Could not fetch from ${colName}:`, colErr);
                }
            }

            setUserContext({
                profile: userData,
                recentApplications: allApplications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 10)
            });
        } catch (error) {
            console.error("Error fetching user context for AI:", error);
        } finally {
            setIsFetchingContext(false);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchUserContext(user.uid);
            } else {
                setUserContext(null);
            }
        });

        if (isOpen && messages.length === 0) {
            addBotMessage("Hello! 👋 I am RegiBIZ Assistant. I can help you with your specific applications or generic queries.");
        }

        return () => unsubscribe();
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addBotMessage = (text: string, score?: number) => {
        setMessages((prev) => [
            ...prev,
            { id: generateMessageId(), text, sender: 'bot', timestamp: new Date(), score }
        ]);
    };

    const addUserMessage = (text: string) => {
        setMessages((prev) => [
            ...prev,
            { id: generateMessageId(), text, sender: 'user', timestamp: new Date() }
        ]);
    };

    const processUserMessage = async (text: string) => {
        const thinkingId = generateMessageId();
        setMessages((prev) => [
            ...prev,
            { id: thinkingId, text: "Thinking...", sender: 'bot', timestamp: new Date() }
        ]);

        const lowerText = text.toLowerCase().trim();
        const greetings = ['hi', 'hello', 'vanakkam', 'hey', 'starts', 'pricing', 'price'];

        if (greetings.includes(lowerText)) {
            let response = "Hello! User. I am RegiBIZ Assistant. How can I help you today?";
            if (lowerText === 'hi' || lowerText === 'hello' || lowerText === 'vanakkam') {
                response = `Hello ${userContext?.profile?.displayName || ''}! 👋 I'm RegiBIZ Assistant. How can I help you with your services today?`;
            } else if (lowerText === 'pricing' || lowerText === 'price') {
                response = "At RegiBIZ, Service Charges are Applicable for all services. You only pay for the official registration costs! Check our Pricing page for details.";
            }

            setMessages((prev) => prev.filter(msg => msg.id !== thinkingId));
            addBotMessage(response);
            return;
        }

        const isCheckingStatus = lowerText.includes('status') || lowerText.includes('id') || lowerText.includes('track') || lowerText.includes('my application');
        const isGST = lowerText.includes('gst');
        const isPAN = lowerText.includes('pan');
        const isMSME = lowerText.includes('msme');
        const isCompany = lowerText.includes('company') || lowerText.includes('llp') || lowerText.includes('pvt');

        let dynamicInfo = "No specific real-time application data requested or found.";

        if (isCheckingStatus && auth.currentUser) {
            const uid = auth.currentUser.uid;

            try {
                let results: any[] = [];
                const searchTasks: Promise<any>[] = [];

                if (isPAN) {
                    searchTasks.push(getDocs(query(collection(db, 'pan-applications'), where('userId', '==', uid), orderBy('submittedAt', 'desc'), limit(1))));
                }

                if (isCompany) {
                    searchTasks.push(getDocs(query(collection(db, 'company-applications'), where('userId', '==', uid), orderBy('submittedAt', 'desc'), limit(1))));
                }

                if (isGST || isMSME || (!isPAN && !isCompany)) {
                    let q = query(collection(db, 'applications'), where('userId', '==', uid), orderBy('submittedAt', 'desc'), limit(2));
                    searchTasks.push(getDocs(q));
                }

                const snaps = await Promise.all(searchTasks);
                snaps.forEach(snap => {
                    snap.forEach((doc: { data: () => any; id: any; }) => {
                        const data = doc.data();
                        results.push({ id: doc.id, ...data });
                    });
                });

                if (results.length > 0) {
                    results.sort((a, b) => (b.submittedAt?.seconds || b.submittedAt || 0) - (a.submittedAt?.seconds || a.submittedAt || 0));

                    const latest = results[0];
                    const dateStr = latest.submittedAt?.seconds
                        ? new Date(latest.submittedAt.seconds * 1000).toLocaleDateString()
                        : new Date(latest.submittedAt).toLocaleDateString();

                    dynamicInfo = `[REAL-TIME DATA]: Found ${results.length} application(s). Latest: ${latest.title || latest.type} (ID: ${latest.caseId || latest.id}) Status: ${latest.status}, Submitted: ${dateStr}.`;
                } else {
                    dynamicInfo = `[REAL-TIME DATA]: No applications found matching your request for user ${auth.currentUser.email}.`;
                }
            } catch (e) {
                console.error("Dynamic fetch error:", e);
                dynamicInfo = "[REAL-TIME DATA]: Error accessing database records.";
            }
        }

        try {
            const promptKnowledge = chatData.slice(0, 15).map((item: any) => {
                const response = item.response || item.responses?.[0] || "No response available";
                return {
                    q: item.keywords?.[0] || "unknown",
                    a: typeof response === 'string' && response.length > 100
                        ? response.substring(0, 100) + "..."
                        : response
                };
            });

            const payload = {
                model: MODEL_ID,
                messages: [
                    {
                        role: "system",
                        content: `You are RegiBIZ Assistant.
                                 REAL DATA: ${dynamicInfo}
                                 USER: ${userContext?.profile?.displayName || 'Client'}
                                 RULES: Use the REAL DATA to answer. Be short. Do NOT use markdown formatting like **asterisks**. Write plain text only.
                                 KB: ${JSON.stringify(promptKnowledge)}`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.1,
                max_tokens: 300
            };

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "RegiBIZ Chat",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            setMessages((prev) => prev.filter(msg => msg.id !== thinkingId));

            if (data.error) {
                console.error("OpenRouter API Error:", data.error);
                const errorDetail = data.error?.message || JSON.stringify(data.error);
                addBotMessage(`AI Connection Error: ${errorDetail}`);
                setTimeout(() => addBotMessage("__WHATSAPP_REDIRECT__"), 1000);
            } else {
                const aiResponse = data?.choices?.[0]?.message?.content;

                if (!aiResponse || typeof aiResponse !== 'string') {
                    addBotMessage("I received an incomplete response. Please try again.");
                    return;
                }

                const responseScore = scoreResponse(aiResponse, text, {
                    hasUserData: !!userContext,
                    userApplications: userContext?.recentApplications || []
                });

                addBotMessage(aiResponse, responseScore.overall);

                if (responseScore.overall < 0.7) {
                    setTimeout(() => {
                        setWaitingForFeedback(generateMessageId());
                    }, 1000);
                }

                if (aiResponse.includes("WHATSAPP_REDIRECT") || aiResponse.toLowerCase().includes("whatsapp")) {
                    setTimeout(() => addBotMessage("__WHATSAPP_REDIRECT__"), 500);
                }

                if (auth.currentUser) {
                    try {
                        await addDoc(collection(db, 'response_scores'), {
                            userId: auth.currentUser.uid,
                            query: text,
                            response: aiResponse,
                            score: responseScore,
                            timestamp: serverTimestamp()
                        });
                    } catch (e) {
                        console.error("Error storing response score:", e);
                    }
                }
            }

        } catch (error) {
            setMessages((prev) => prev.filter(msg => msg.id !== thinkingId));
            console.error("OpenRouter Network Error:", error);
            addBotMessage("Sorry, I'm having trouble connecting. Please check your internet or try again later.");
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim()) return;

        const userMsg = inputText.trim();
        addUserMessage(userMsg);
        setInputText('');

        processUserMessage(userMsg);
    };

    const handleFeedback = async (messageId: string, rating: number) => {
        setWaitingForFeedback(null);

        setMessages(prev => prev.map(msg =>
            msg.id === messageId
                ? { ...msg, feedback: { rating } }
                : msg
        ));

        if (auth.currentUser) {
            try {
                await addDoc(collection(db, 'chat_feedback'), {
                    userId: auth.currentUser.uid,
                    messageId,
                    rating,
                    timestamp: new Date()
                });

                if (rating === 0) {
                    const message = messages.find(m => m.id === messageId);
                    if (message?.text) {
                        const suggestions = getImprovementSuggestions({
                            relevance: 0.5,
                            helpfulness: 0.5,
                            completeness: 0.5,
                            accuracy: 0.5,
                            overall: 0.5
                        });

                        setTimeout(() => {
                            addBotMessage(`📝 Thanks for your feedback! Here's an improved response:\n\n${message.text}\n\n${suggestions.join('\n')}`);
                        }, 1000);
                    }
                }
            } catch (error) {
                console.error("Error storing feedback:", error);
            }
        }
    };

    const handleRedirectToWhatsApp = () => {
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[90] flex flex-col items-end gap-3 font-sans">
            {isOpen && (
                <div
                    className="fixed inset-0 bg-background/20 backdrop-blur-sm z-[-1] transition-all duration-500 animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className="flex flex-col items-end gap-3">
                {showReviewButton && (
                    <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={googleReviewUrl}
                        className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-orange-500/30 bg-white/[0.05] backdrop-blur-md shadow-2xl shadow-orange-500/20 transition-all duration-300 hover:border-orange-500/50 hover:bg-orange-500/[0.08] hover:scale-110 animate-in fade-in zoom-in duration-500"
                        aria-label="Leave a Google review"
                        title="Leave a Google review"
                    >
                        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/20 via-yellow-400/15 to-orange-500/20 opacity-60 blur-lg transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative z-10 flex flex-col items-center justify-center">
                            <GoogleIconWithStars />
                        </span>
                    </a>
                )}

                {isOpen && (
                    <div className="fixed left-3 right-3 bottom-24 sm:static sm:left-auto sm:right-auto sm:bottom-auto w-auto sm:w-[400px] max-w-[calc(100vw-1.5rem)] sm:max-w-none glass-panel shadow-glow-cyan border-glow-cyan rounded-2xl overflow-hidden flex flex-col h-[min(550px,calc(100svh-8rem))] sm:h-[550px] sm:max-h-[80vh] animate-in fade-in slide-in-from-bottom-5 duration-300">

                        <div className="p-4 border-b border-white/10 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-primary opacity-90"></div>

                            <div className="relative z-10 flex min-w-0 items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-lg shadow-black/20">
                                        <Bot size={20} className="text-white" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#06080a] rounded-full animate-pulse"></span>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="truncate text-white font-bold text-sm tracking-wide">RegiBIZ Assistant</h3>
                                    <p className="truncate text-white/70 text-[10px] font-medium uppercase tracking-[0.1em]">Online • Smart Support</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="relative z-10 text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/40 custom-scrollbar backdrop-blur-sm">
                            {messages.map((msg) => {
                                if (msg.text === "__WHATSAPP_REDIRECT__") {
                                    return (
                                        <div key={msg.id} className="flex justify-start animate-in fade-in zoom-in duration-300">
                                            <button
                                                onClick={handleRedirectToWhatsApp}
                                                className="group relative flex items-center gap-2 px-4 py-3 rounded-xl text-white font-semibold shadow-lg shadow-red-900/30 transition-all active:scale-95 overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 group-hover:from-red-500 group-hover:to-orange-500 transition-all"></div>
                                                <div className="relative z-10 flex items-center gap-2">
                                                    <MessageCircle size={18} />
                                                    <span>Chat with Support Team</span>
                                                </div>
                                            </button>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                                        <div className={`max-w-[85%] min-w-0 break-words p-3.5 rounded-2xl text-sm shadow-md ${msg.sender === 'user'
                                            ? 'bg-gradient-primary text-white rounded-br-none border border-cyan-500/30 shadow-cyan-900/20'
                                            : 'bg-secondary/80 text-foreground rounded-bl-none border border-white/5 backdrop-blur-sm'
                                            }`}>

                                            {msg.text === "Thinking..." ? (
                                                <div className="flex gap-1.5 py-1 px-2">
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></div>
                                                </div>
                                            ) : (
                                                // ✅ FIX: Strip ** from displayed text
                                                <div className="whitespace-pre-wrap leading-relaxed break-words">
                                                    {stripMarkdown(msg.text).split('\n').map((line, i) => {
                                                        if (line.startsWith('Understand as:')) {
                                                            return (
                                                                <div key={i} className="mb-2 pb-2 border-b border-white/10 italic text-[11px] text-cyan-300">
                                                                    {line}
                                                                </div>
                                                            );
                                                        }
                                                        const isHighlight = line.startsWith('•') || line.startsWith('1️⃣') || line.startsWith('2️⃣') || line.startsWith('3️⃣');
                                                        return (
                                                            <p key={i} className={`${isHighlight ? 'font-medium text-cyan-100' : ''}`}>
                                                                {line}
                                                            </p>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {msg.sender === 'bot' && msg.score !== undefined && msg.score < 0.7 &&
                                                waitingForFeedback !== null && (
                                                    <div className="mt-2 pt-2 border-t border-white/10">
                                                        <p className="text-xs text-gray-400 mb-2">Was this helpful?</p>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleFeedback(msg.id, 1)}
                                                                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors"
                                                            >
                                                                <ThumbsUp size={12} /> Helpful
                                                            </button>
                                                            <button
                                                                onClick={() => handleFeedback(msg.id, 0)}
                                                                className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
                                                            >
                                                                <ThumbsDown size={12} /> Not helpful
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] opacity-40 font-medium">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {msg.score !== undefined && (
                                                    <span className={`text-[10px] font-medium ${msg.score > 0.8 ? 'text-green-400' :
                                                        msg.score > 0.6 ? 'text-yellow-400' : 'text-red-400'
                                                        }`}>
                                                        Score: {(msg.score * 100).toFixed(0)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {isFetchingContext && (
                                <div className="flex justify-start opacity-60">
                                    <div className="bg-secondary/40 text-[10px] px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                                        <Sparkles size={10} className="animate-pulse text-primary" />
                                        Synchronizing business data...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-3 bg-secondary/30 border-t border-white/10 flex gap-2 relative backdrop-blur-md">
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Type a message..."
                                className="min-w-0 flex-1 bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-gray-500 shadow-inner"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim()}
                                className="p-2.5 rounded-xl text-white disabled:opacity-30 disabled:grayscale transition-all shadow-lg relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-gradient-primary group-hover:opacity-90 transition-all"></div>
                                <Send size={18} className="relative z-10" />
                            </button>
                        </form>
                    </div>
                )}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-500 group ${isOpen
                        ? 'bg-secondary rotate-90 scale-90'
                        : 'hover:scale-110'
                        }`}
                >
                    {!isOpen && (
                        <>
                            <div className="absolute inset-0 rounded-full bg-gradient-primary shadow-glow-cyan"></div>
                            <span className="absolute inset-0 rounded-full bg-primary opacity-20 blur-md animate-pulse"></span>
                        </>
                    )}

                    <div className="relative z-10">
                        {isOpen ? (
                            <X size={24} className="text-foreground" />
                        ) : (
                            <MessageCircle size={24} className="text-white" />
                        )}
                    </div>

                    {!isOpen && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background animate-bounce"></span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default WhatsAppFloat;