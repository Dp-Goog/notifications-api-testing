let lastSharedPayload = null;

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
  if (e.request.method === "POST") {
    e.respondWith(
      (async () => {
        const formData = await e.request.formData();
        const title = formData.get("title") || "";
        const text = formData.get("text") || "";
        const sharedUrl = formData.get("url") || "";
        const files = [
          ...formData.getAll("files"),
          ...formData.getAll("SharedFiles")
        ];

        lastSharedPayload = {
          title,
          text,
          url: sharedUrl,
          files,
          timestamp: new Date().toISOString()
        };

        const redirectUrl = new URL("./index.html", self.location.href);
        redirectUrl.searchParams.set("shared", "1");
        if (title) redirectUrl.searchParams.set("title", title);
        if (text) redirectUrl.searchParams.set("text", text);
        if (sharedUrl) redirectUrl.searchParams.set("url", sharedUrl);
        if (files.length > 0) {
          const fileSummaries = files.map(
            (f) => `${f.name} (${f.type || "unknown"}, ${f.size} bytes)`
          );
          redirectUrl.searchParams.set("files", fileSummaries.join(", "));
        }

        return Response.redirect(redirectUrl.toString(), 303);
      })()
    );
    return;
  }

  e.respondWith(fetch(e.request));
});

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

self.addEventListener("message", event => {
  if (!event.data) return;

  if (event.data.type === "show_notification") {
    displaySwNotification(event.data.useBadge);
  }

  if (event.data.type === "close_all") {
    // close all notifications
    self.registration.getNotifications().then(function(notifications) {
      notifications.forEach(function(notification) {
        notification.close();
      });
    });
  }

  if (event.data.type === "get_shared_data" && event.source) {
    if (lastSharedPayload) {
      event.source.postMessage({
        type: "shared_data",
        payload: lastSharedPayload
      });
    }
  }
});

self.addEventListener("notificationclick", function(e) {
  var notification = e.notification;
  var primaryKey = notification.data.primaryKey;
  var action = e.action;

  if (action === "close") {
    notification.close();
  } else {
    console.log("[ServiceWorker] Clicked notification: " + primaryKey);
    notification.close();
  }
});

self.addEventListener("notificationclose", function(e) {
  var notification = e.notification;
  var primaryKey = notification.data.primaryKey;

  console.log("[ServiceWorker] Closed notification: " + primaryKey);
});
