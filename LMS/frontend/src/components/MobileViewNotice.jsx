import React, { useEffect, useState, useRef } from 'react';
import { Monitor, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MOBILE_BREAKPOINT = 768; // Matches Tailwind's `md` breakpoint used for the mobile layout
const DISMISS_KEY = 'gl_mobile_notice_dismissed';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

const MobileViewNotice = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    const loggedIn = Boolean(user);
    const inMobileView = isMobile && loggedIn;
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = inMobileView;

    if (!inMobileView) {
      // Leaving an active mobile session resets the flag so a fresh entry can notify again
      if (wasActive) {
        sessionStorage.removeItem(DISMISS_KEY);
      }
      setVisible(false);
      return;
    }

    if (!sessionStorage.getItem(DISMISS_KEY)) {
      setVisible(true);
    }
  }, [isMobile, user]);

  const handleClose = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-6 bg-slate-900/60">
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center animate-slide-up">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/70 transition-all active:scale-95"
          aria-label="Close notice"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Monitor className="w-8 h-8 text-primary" />
        </div>

        <h3 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
          Better Experience on Desktop
        </h3>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-8">
          You are currently viewing Gracified in the mobile view. For the best experience, we recommend switching to desktop view.
        </p>

        <button
          onClick={handleClose}
          className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-xl shadow-none hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold text-sm tracking-wide"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
};

export default MobileViewNotice;