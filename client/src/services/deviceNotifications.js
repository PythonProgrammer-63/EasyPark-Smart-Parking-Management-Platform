import { api } from './api';

export function isAppleMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isInstalledDeviceApp() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function requiresHomeScreenInstall() {
  return isAppleMobileDevice() && !isInstalledDeviceApp();
}

export function supportsDeviceNotifications() {
  return typeof window !== 'undefined' && window.isSecureContext &&
    'Notification' in window && 'serviceWorker' in navigator &&
    ('PushManager' in window || requiresHomeScreenInstall());
}

export async function requestDeviceNotificationPermission() {
  if (!supportsDeviceNotifications()) return { permission: 'unsupported' };
  if (requiresHomeScreenInstall()) return { permission: 'install-required' };
  if (!('PushManager' in window)) return { permission: 'unsupported' };

  // Keep the permission request directly inside the user's click gesture.
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return { permission };

  const registration = await navigator.serviceWorker.register('/easypark-sw.js');
  await navigator.serviceWorker.ready;
  if (!registration.pushManager) throw new Error('This browser does not support web push. Update your browser and try again.');
  const { publicKey } = await api.getDevicePushPublicKey();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }
  await api.saveDevicePushSubscription(subscription.toJSON());
  return { permission, subscribed: true };
}

export async function disableDevicePushNotifications() {
  if (!supportsDeviceNotifications()) return { permission: 'unsupported', subscribed: false };
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api.removeDevicePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
  return { permission: Notification.permission, subscribed: false };
}

export async function hasDevicePushSubscription() {
  if (!supportsDeviceNotifications()) return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await registration?.pushManager.getSubscription());
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
