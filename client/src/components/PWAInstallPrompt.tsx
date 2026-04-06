import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-brand-600 text-white px-4 py-3 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:rounded-xl sm:max-w-sm">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">Install StrikersAcademy</p>
          <p className="text-xs text-brand-100">Add to home screen for quick access</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-white text-brand-600 px-3 py-1.5 text-xs font-semibold hover:bg-brand-50"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-brand-200 hover:text-white"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
