// The calendar behind the monthly rhythm. A mission month follows the real calendar: the
// month-end meeting is on the last day of the month you are in, and the countdown is honest
// (real days, no invented deadlines).
const DAY = 86400000;

export function monthInfo(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = end.getDate();
  const daysLeft = Math.max(0, Math.round((end - today) / DAY));
  return {
    name: today.toLocaleString("en-US", { month: "long" }),
    day: today.getDate(),
    daysInMonth,
    daysLeft,
    progress: today.getDate() / daysInMonth,
    meetingDate: end.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    meetingShort: end.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    // The meeting opens any time; it is suggested in the last few days.
    meetingDue: daysLeft <= 3,
  };
}

export function daysLeftText(n) {
  if (n === 0) return "Your month-end meeting is today";
  if (n === 1) return "1 day until your month-end meeting";
  return `${n} days until your month-end meeting`;
}
