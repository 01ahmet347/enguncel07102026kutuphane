// SGM: Handle notification clicks before Firebase registers its own handler.
// This preserves the current same-origin behaviour without allowing a second
// notification-click handler to open another window as well.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const rawUrl = data.url || data.FCM_MSG?.data?.url || data.FCM_MSG?.fcmOptions?.link || '/';
  let target;
  try {
    target = new URL(rawUrl, self.location.origin);
  } catch (_) {
    return;
  }
  // Never follow a push-supplied link to another origin.
  if (target.origin !== self.location.origin) {
    event.stopImmediatePropagation?.();
    return;
  }
  // Firebase Messaging may also register notificationclick; only open once.
  event.stopImmediatePropagation?.();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin || typeof client.focus !== 'function') continue;
      try {
        if (typeof client.navigate === 'function') {
          const navigated = await client.navigate(target.href);
          if (navigated && typeof navigated.focus === 'function') return navigated.focus();
        } else if (new URL(client.url).href === target.href) {
          return client.focus();
        }
      } catch (_) {
        // A closed/stale tab may fail to navigate; try another tab or open one.
      }
    }
    return clients.openWindow?.(target.href);
  })());
});

// Keep the existing compat SDK and dynamic Firebase configuration as supplied.
// Version changes require a separate real-device compatibility test.
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js');
const params = new URL(self.location.href).searchParams;
const firebaseConfig = Object.fromEntries(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
  .map(key => [key, params.get(key) || '']));
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  // FCM already displays notification messages. Avoid showing a duplicate.
  if (payload.notification) return;
  const data = payload.data || {};
  return self.registration.showNotification(data.title || 'Sarıçam GM', {
    body: data.body || 'Yeni bildiriminiz var.',
    tag: data.tag || `sgm-${data.logId || 'notification'}`,
    requireInteraction: String(data.type || '').includes('İHBAR'),
    data: { url: data.url || '/' }
  });
});
