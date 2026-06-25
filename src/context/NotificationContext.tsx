import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions {
  title?: string;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<{
    message: string;
    type: NotificationType;
    title?: string;
    id: number;
  } | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType = 'info', options: NotificationOptions = {}) => {
    const id = Date.now();
    setNotification({ message, type, title: options.title, id });

    if (options.duration !== 0) {
      setTimeout(() => {
        setNotification(prev => prev?.id === id ? null : prev);
      }, options.duration || 5000);
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <div className="fixed top-6 right-6 z-[9999] animate-in slide-in-from-right-full duration-300">
          <div className={`
            flex items-start gap-4 p-4 rounded-2xl shadow-2xl border min-w-[320px] max-w-md backdrop-blur-xl
            ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
            ${notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : ''}
            ${notification.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : ''}
            ${notification.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : ''}
          `}>
            <div className="mt-0.5">
              {notification.type === 'success' && <CheckCircle size={20} />}
              {notification.type === 'error' && <AlertCircle size={20} />}
              {notification.type === 'info' && <Info size={20} />}
              {notification.type === 'warning' && <AlertCircle size={20} />}
            </div>
            <div className="flex-1">
              {notification.title && <p className="font-bold text-sm mb-1 uppercase tracking-wider">{notification.title}</p>}
              <p className="text-sm font-medium leading-relaxed">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="hover:opacity-70 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
