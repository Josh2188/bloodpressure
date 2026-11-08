/* 關著網頁時收到的提醒。只負責把雲端送來的文字顯示出來。 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "護心行動";
  const options = {
    body: payload.body || "",
    icon: "./icon-192.png",
    data: { url: payload.url || "https://josh2188.github.io/bloodpressure/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "https://josh2188.github.io/bloodpressure/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const win of windows) {
      if (win.url.indexOf("/bloodpressure/") !== -1 && "focus" in win) return win.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
