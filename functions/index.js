const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const APP_URL = "https://josh2188.github.io/bloodpressure/";

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
}, async () => {
  const db = getFirestore();
  const hour = taipeiParts().hour;
  const slot = hour < 15 ? "早" : "晚";
  const today = logicalDateString();
  const devices = await db.collectionGroup("devices").get();
  const messaging = getMessaging();

  for (const device of devices.docs) {
    if (device.get("enabled") === false) continue;
    const token = device.get("token");
    if (!token) continue;
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
      await messaging.send({
        token,
        notification: {
          title: "護心行動",
          body: reminderBody(slot, gap),
        },
        webpush: {
          fcmOptions: { link: APP_URL },
        },
      });
    } catch (err) {
      const code = err && (err.code || err.errorInfo?.code);
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        await device.ref.set({ enabled: false, updatedAt: Date.now() }, { merge: true });
      } else {
        console.error("[提醒] 送出失敗", device.id, code || err);
      }
    }
  }
});
