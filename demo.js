const notificationShow = document.getElementById("notificationShow");
const notificationClear = document.getElementById("notificationClear");

const swNotificationShow = document.getElementById("swNotificationShow");
const swNotificationClear = document.getElementById("swNotificationClear");

const swUseBadge = document.getElementById("swUseBadge");

// Check if the API is supported.
if ("Notification" in window) {
  isSupported();
}

// Update the UI to indicate whether the API is supported.
function isSupported() {
  const divNotSupported = document.getElementById("notSupported");
  divNotSupported.classList.toggle("hidden", true);
}

var notification;

function displayNotification() {
  if (!notification) {
    notification = new Notification("Text");
  }  
}

function postMessageToSw(message) {
  if (!("serviceWorker" in navigator)) return;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  } else {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage(message);
      }
    });
  }
}

function displaySwNotification() {
  postMessageToSw({type: "show_notification", useBadge: swUseBadge.checked});
}

// Click event handler for Show button.
notificationShow.addEventListener("click", () => {
  // Let's check whether notification permissions have already been granted
  if (Notification.permission === "granted") {
    // If it's okay let's create a notification
    displayNotification();
  }

  // Otherwise, we need to ask the user for permission
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(function(permission) {
      // If the user accepts, let's create a notification
      if (permission === "granted") {
        displayNotification();
      }
    });
  }
});

// Click event handler for Clear button.
notificationClear.addEventListener("click", () => {
  if (notification) {
    notification.close();
    notification = null;
  }
});

// Click event handler for SW Show button.
swNotificationShow.addEventListener("click", () => {
  // Let's check whether notification permissions have already been granted
  if (Notification.permission === "granted") {
    displaySwNotification();
  }
  // Otherwise, we need to ask the user for permission
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(function(permission) {
      // If the user accepts, let's create a notification
      if (permission === "granted") {
        displaySwNotification();        
      }
    });
  }    
});


// Click event handler for SW Clear button.
swNotificationClear.addEventListener("click", () => {
  postMessageToSw({type: "close_all"});
});

function renderSharedData({title, text, url, filesSummary, rawFiles}) {
  const statusEl = document.getElementById("shareTargetStatus");
  const detailsEl = document.getElementById("shareTargetDetails");
  const titleEl = document.getElementById("sharedTitle");
  const textEl = document.getElementById("sharedText");
  const urlEl = document.getElementById("sharedUrl");
  const filesEl = document.getElementById("sharedFiles");
  const previewEl = document.getElementById("sharedFilesPreview");

  if (statusEl) {
    statusEl.textContent = "Shared payload received via Service Worker POST share target!";
  }
  if (detailsEl) {
    detailsEl.classList.toggle("hidden", false);
  }
  if (titleEl) titleEl.textContent = title || "(none)";
  if (textEl) textEl.textContent = text || "(none)";
  if (urlEl) urlEl.textContent = url || "(none)";
  if (filesEl) filesEl.textContent = filesSummary || "(none)";

  if (previewEl && Array.isArray(rawFiles) && rawFiles.length > 0) {
    previewEl.innerHTML = "";
    rawFiles.forEach((file) => {
      if (file.type && file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.className = "shared-image-preview";
        previewEl.appendChild(img);
      } else if (file.type && file.type.startsWith("text/")) {
        file.text().then((content) => {
          const pre = document.createElement("pre");
          pre.className = "shared-text-preview";
          pre.textContent = content;
          previewEl.appendChild(pre);
        });
      }
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const isShared =
    params.get("shared") === "1" ||
    params.has("title") ||
    params.has("text") ||
    params.has("url") ||
    params.has("files");

  if (isShared) {
    renderSharedData({
      title: params.get("title") || "",
      text: params.get("text") || "",
      url: params.get("url") || "",
      filesSummary: params.get("files") || ""
    });

    if ("serviceWorker" in navigator) {
      postMessageToSw({type: "get_shared_data"});
    }
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "shared_data" && event.data.payload) {
      const payload = event.data.payload;
      const files = payload.files || [];
      const filesSummary = files
        .map((f) => `${f.name} (${f.type || "unknown"}, ${f.size} bytes)`)
        .join(", ");
      renderSharedData({
        title: payload.title,
        text: payload.text,
        url: payload.url,
        filesSummary,
        rawFiles: files
      });
    }
  });
}

