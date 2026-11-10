function dateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.length > 64) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getLocalDateKey(date, timeZone) {
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getLocalDayStart(dateKey, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let timestamp = localMidnightAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    timestamp = localMidnightAsUtc - (representedAsUtc - timestamp);
  }

  return new Date(timestamp);
}

export function addCalendarDays(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getWeekStartKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addCalendarDays(dateKey, -((dayOfWeek + 6) % 7));
}

export function getDateKeysEndingToday(count, timeZone, now = new Date()) {
  const today = getLocalDateKey(now, timeZone);
  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(today, index - count + 1),
  );
}

function dateKeyEpoch(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function formatDate(value, options = {}) {
  if (!value) return "Not yet";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...options,
  }).format(new Date(value));
}

export function formatRelativeDate(value, timeZone, now = new Date()) {
  if (!value) return "No learning activity yet";

  const dayDifference =
    (dateKeyEpoch(getLocalDateKey(now, timeZone)) -
      dateKeyEpoch(getLocalDateKey(new Date(value), timeZone))) /
    86_400_000;

  if (dayDifference <= 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  if (dayDifference < 7) return `${dayDifference} days ago`;
  return formatDate(value);
}
