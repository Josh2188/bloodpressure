const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const webpush = require("web-push");

initializeApp();

const APP_URL = "https://josh2188.github.io/bloodpressure/";
const VAPID_PUBLIC_KEY = "BIO-kgwbYY9nAWOxJ6SuIPeOk4mhbxgBLogES2OPK4yL1eaB8MPPmBYJeeAWjR1ORFUkVKcNCsho63qvsO0wM7U";
const vapidPrivateKey = defineSecret("VAPID_PRIVATE_KEY");

function taipeiParts(date = new Date()) {
  const bag = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
  };
}

function logicalDateString(date = new Date()) {
  let { year, month, day, hour } = taipeiParts(date);
  if (hour < 4) {
    const utc = new Date(Date.UTC(year, month - 1, day));
    utc.setUTCDate(utc.getUTCDate() - 1);
    year = utc.getUTCFullYear();
    month = utc.getUTCMonth() + 1;
    day = utc.getUTCDate();
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysBetween(older, newer) {
  const a = new Date(`${older}T12:00:00+08:00`);
  const b = new Date(`${newer}T12:00:00+08:00`);
  return Math.max(0, Math.round((b - a) / 86400000));
}

function reminderBody(slot, gap) {
  if (gap !== null && gap >= 2) return `欸，你已經 ${gap} 天沒量了，該量了吧？`;
  if (slot === "早") return "早上還沒量。坐一下，量完再開始今天。";
  return "晚上還沒量。睡前再記一筆，今天就齊。";
}

exports.bpReminder = onSchedule({
  schedule: "20 7,21 * * *",
  timeZone: "Asia/Taipei",
  region: "asia-east1",
  secrets: [vapidPrivateKey],
}, async () => {
  webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, vapidPrivateKey.value());
  const db = getFirestore();
  const hour = taipeiParts().hour;
  const slot = hour < 15 ? "早" : "晚";
  const today = logicalDateString();
  const devices = await db.collectionGroup("devices").get();

  for (const device of devices.docs) {
    if (device.get("enabled") === false) continue;
    const subscription = device.get("subscription");
    if (!subscription || !subscription.endpoint || !subscription.keys) continue;
    const userRef = device.ref.parent.parent;
    if (!userRef) continue;

    const snap = await userRef.collection("records").orderBy("timestamp", "desc").limit(80).get();
    let hasSlot = false;
    let latestDate = null;
    snap.forEach((doc) => {
      const record = doc.data() || {};
      if (record.deleted) return;
      if (record.date && (!latestDate || record.date > latestDate)) latestDate = record.date;
      if (record.date === today && record.timeSlot === slot) hasSlot = true;
    });
    if (hasSlot) continue;

    const gap = latestDate ? daysBetween(latestDate, today) : null;
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: "護心行動",
        body: reminderBody(slot, gap),
        url: APP_URL,
      }));
    } catch (err) {
      const status = err && err.statusCode;
      if (status === 404 || status === 410) {
        await device.ref.set({ enabled: false, updatedAt: Date.now() }, { merge: true });
      } else {
        console.error("[提醒] 送出失敗", device.id, status || err);
      }
    }
  }
});
