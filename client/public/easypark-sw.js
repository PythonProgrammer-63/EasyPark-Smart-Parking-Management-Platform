self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch (error) {
    payload = { body: event.data?.text() || 'You have a new EasyPark update.' };
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClient = windows.find((client) => client.visibilityState === 'visible');
    const message = {
      type: 'EASYPARK_PUSH_NOTIFICATION',
      notification: {
        id: payload.notificationId,
        title: payload.title || 'EasyPark update',
        message: payload.body || 'You have a new EasyPark update.'
      }
    };

    if (visibleClient) {
      visibleClient.postMessage(message);
      return;
    }

    await self.registration.showNotification(message.notification.title, {
      body: message.notification.message,
      tag: payload.notificationId ? `easypark-${payload.notificationId}` : undefined,
      data: { url: payload.url || '/' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
