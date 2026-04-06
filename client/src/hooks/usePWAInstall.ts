import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let savedPrompt: BeforeInstallPromptEvent | null = null;

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(!!savedPrompt);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      savedPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) setCanInstall(false);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!savedPrompt) return false;
    await savedPrompt.prompt();
    const { outcome } = await savedPrompt.userChoice;
    if (outcome === 'accepted') {
      savedPrompt = null;
      setCanInstall(false);
      return true;
    }
    return false;
  };

  return { canInstall, install };
}
