import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hasDevicePushSubscription,
  requiresHomeScreenInstall,
  requestDeviceNotificationPermission,
  supportsDeviceNotifications
} from '../services/deviceNotifications';

export default function DeviceNotificationConsent() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [installRequired, setInstallRequired] = useState(false);

  useEffect(() => {
    if (!user || !supportsDeviceNotifications()) return undefined;

    let current = true;
    const dismissalKey = `easypark-device-alert-prompt-dismissed-${user.id}`;
    const checkDevice = async () => {
      try {
        if (requiresHomeScreenInstall()) {
          if (current) {
            setInstallRequired(true);
            setVisible(true);
          }
          return;
        }
        if (current) setInstallRequired(false);
        if (Notification.permission === 'denied' || localStorage.getItem(dismissalKey)) return;
        if (await hasDevicePushSubscription()) return;
        if (current) setVisible(true);
      } catch (error) {
        console.error('Check device notification subscription error:', error);
      }
    };

    const timer = window.setTimeout(checkDevice, 1200);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [user?.id]);

  const dismiss = () => {
    if (user?.id && !installRequired) {
      localStorage.setItem(`easypark-device-alert-prompt-dismissed-${user.id}`, 'true');
    }
    setVisible(false);
  };

  const enableNotifications = async () => {
    if (installRequired) {
      dismiss();
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const result = await requestDeviceNotificationPermission();
      if (result.subscribed) {
        dismiss();
      } else if (result.permission === 'denied') {
        setStatus('Notifications were blocked. Allow them in your browser or device settings, then try again from the bell menu.');
      } else {
        setStatus('Notifications were not enabled. You can allow them later from the bell menu.');
      }
    } catch (error) {
      console.error('Enable device notifications error:', error);
      setStatus(error.message || 'Could not enable device notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-6" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-notifications-title"
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close notification prompt"
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <BellRing className="h-7 w-7" />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">EasyPark alerts</p>
        <h2 id="device-notifications-title" className="pr-6 text-2xl font-extrabold text-slate-900">
          {installRequired ? 'Add EasyPark to your Home Screen' : 'Stay updated on this device'}
        </h2>
        {installRequired ? (
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <p>On iPhone or iPad, Safari only allows background notifications for a Home Screen app.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open this page in Safari and tap the Share button.</li>
              <li>Choose <strong>Add to Home Screen</strong>, then open EasyPark from its new icon.</li>
              <li>Sign in and tap <strong>Allow notifications</strong>.</li>
            </ol>
            <p className="text-xs text-slate-500">Requires iOS/iPadOS 16.4 or later.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Get booking, payment, and parking updates as device notifications, even when EasyPark is in the background.
          </p>
        )}
        {status && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">{status}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={enableNotifications}
            disabled={busy}
            className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Enabling…' : installRequired ? 'Got it' : 'Allow notifications'}
          </button>
        </div>
      </section>
    </div>
  );
}
