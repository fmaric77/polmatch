import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: NotificationType;
  onClick?: () => void;
  timeoutMs?: number;
}

interface NotificationsContextValue {
  notify: (n: Omit<AppNotification, 'id'>) => void;
  playBeep: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

const getTypeClasses = (type: NotificationType | undefined): string => {
  switch (type) {
    case 'success':
      return 'border-green-400 text-green-300';
    case 'warning':
      return 'border-yellow-400 text-yellow-300';
    case 'error':
      return 'border-red-400 text-red-300';
    case 'info':
    default:
      return 'border-blue-400 text-blue-300';
  }
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Ask for permission once on mount (best-effort)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const playBeep = useCallback(() => {
    try {
      // Use a typed fallback for older browsers (webkitAudioContext) without using `any`
      const win = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext || win.webkitAudioContext;
      if (!Ctor) return; // AudioContext not supported
      const ctx = audioContext ?? new Ctor();
      if (!audioContext) setAudioContext(ctx);

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880; // A5
      g.gain.value = 0.001; // Start quiet to avoid pop
      o.connect(g);
      g.connect(ctx.destination);

      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
      o.start(now);
      // Short chirp
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.stop(now + 0.2);
  } catch {
      // ignore audio errors
    }
  }, [audioContext]);

  const notify = useCallback((n: Omit<AppNotification, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeoutMs = n.timeoutMs ?? 6000;
    const item: AppNotification = { id, ...n };
    setItems(prev => [...prev, item]);

    // Auto-remove after timeout
    if (timeoutMs > 0) {
      setTimeout(() => remove(id), timeoutMs);
    }

    // Try browser notification as an enhancement
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(n.title, { body: n.message });
        if (n.onClick) {
          notif.onclick = () => {
            if (n.onClick) {
              n.onClick();
            }
          };
        }
      } catch {
        // ignore
      }
    }
  }, [remove]);

  const value = useMemo(() => ({ notify, playBeep }), [notify, playBeep]);

  return (
  <NotificationsContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[1000] space-y-3">
        {items.map(i => (
          <button
            key={i.id}
            onClick={() => {
              if (i.onClick) {
                i.onClick();
              }
              remove(i.id);
            }}
            className={`text-left w-80 border-2 rounded-none shadow-2xl p-4 bg-black ${getTypeClasses(i.type)} hover:opacity-90 transition-opacity`}
          >
            <div className="font-mono uppercase tracking-wider text-sm mb-1">{i.title}</div>
            <div className="text-xs text-gray-300">{i.message}</div>
          </button>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
};

export default NotificationsProvider;
