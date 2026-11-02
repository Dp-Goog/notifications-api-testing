// Shared data is kept in Cache Storage, not in a global variable, because
// the browser can stop the service worker between the 303 redirect and the
// page load. The page reads the same cache (see demo.js).
const SHARE_CACHE = "share-target-v1";
// Must match the share_target "action" in manifest.json and in the TWA APK:
// https://dp-goog.github.io/notifications-api-testing/share-target
const SHARE_PATH = new URL("./share-target", self.location.href).pathname;
const SHARE_META_URL = new URL("./shared/meta.json", self.location.href).href;

self.addEventListener("install", function(e) {
  console.log("[ServiceWorker] Install");
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function(e) {
  console.log("[ServiceWorker] Activate");
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function(e) {
  console.log("[Service Worker] Fetch", e.request.method, e.request.url);
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname === SHARE_PATH) {
    e.respondWith(handleShare(e.request));
    return;
  }

  e.respondWith(fetch(e.request));
});

async function handleShare(request) {
  const formData = await request.formData();
  // "files" must match params.files[].name in manifest.json and in the APK
  // share_target JSON. "SharedFiles" is kept for older clients.
  const files = [
    ...formData.getAll("files"),
    ...formData.getAll("SharedFiles")
  ].filter((f) => f instanceof File);

  const cache = await caches.open(SHARE_CACHE);
  // Keep only the most recent share.
  for (const key of await cache.keys()) {
    await cache.delete(key);
  }

  const meta = {
    title: formData.get("title") || "",
    text: formData.get("text") || "",
    url: formData.get("url") || "",
    timestamp: new Date().toISOString(),
    files: []
  };
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const key = new URL(`./shared/${i}`, self.location.href).href;
    await cache.put(
      key,
      new Response(f, {
        headers: {"Content-Type": f.type || "application/octet-stream"}
      })
    );
    meta.files.push({key, name: f.name, type: f.type, size: f.size});
  }
  await cache.put(
    SHARE_META_URL,
    new Response(JSON.stringify(meta), {
      headers: {"Content-Type": "application/json"}
    })
  );

  // 303 makes the browser load the redirect target with GET.
  const redirectUrl = new URL("./index.html", self.location.href);
  redirectUrl.searchParams.set("shared", "1");
  return Response.redirect(redirectUrl.toString(), 303);
}

function displaySwNotification(useBadge) {
  var options = {
    body: "A notification body",
    icon:
      "house.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  if (useBadge) {
    options.badge =
      "fugu-128.png";
  }

  self.registration.showNotification("Text from service worker", options);
}

// Inline reply test: a "text" action makes the OS show a reply field.
// The typed text arrives as NotificationEvent.reply in notificationclick.
function showReplyNotification({usePlaceholder, addSecondButton}) {
  const actions = [{action: "reply", title: "Reply", type: "text"}];
  if (usePlaceholder) {
    actions[0].placeholder = "Type a reply";
  }
  if (addSecondButton) {
    actions.push({action: "other", title: "Other"});
  }
  return self.registration.showNotification("Inline reply test", {
    body: "Type a reply in this notification",
    icon: "house.png",
    tag: "inline-reply-test",
    requireInteraction: true,
    actions,
    data: {primaryKey: 2, kind: "reply-test"}
  });
}

self.addEventListener("message", event => {
  if (!event.data) return;

  if (event.data.type === "show_notification") {
    displaySwNotification(event.data.useBadge);
  }

  if (event.data.type === "show_reply_notification") {
    event.waitUntil(showReplyNotification(event.data));
  }

  if (event.data.type === "close_all") {
    // close all notifications
    self.registration.getNotifications().then(function(notifications) {
      notifications.forEach(function(notification) {
        notification.close();
      });
    });
  }
});

self.addEventListener("notificationclick", function(e) {
  const notification = e.notification;
  const data = notification.data || {};
  notification.close();
  console.log("[ServiceWorker] Clicked notification: " + data.primaryKey);
  if (data.kind !== "reply-test") return;

  const result = {
    type: "notification_click",
    time: new Date().toLocaleTimeString(),
    action: e.action,
    // undefined = the browser has no inline reply API, null = no text.
    reply: e.reply,
    replySupported: "reply" in e
  };
  e.waitUntil(reportReply(result));
});

async function reportReply(result) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });
  windows.forEach((client) => client.postMessage(result));
  // A second notification shows the result when no page is open
  // (Windows activation, Android, TWA).
  await self.registration.showNotification(
    `action="${result.action}" reply=${JSON.stringify(result.reply)}`,
    {
      body: `replySupported=${result.replySupported}`,
      tag: "inline-reply-result",
      data: {kind: "reply-result"}
    }
  );
}

self.addEventListener("notificationclose", function(e) {
  var notification = e.notification;
  var primaryKey = notification.data.primaryKey;

  console.log("[ServiceWorker] Closed notification: " + primaryKey);
});
