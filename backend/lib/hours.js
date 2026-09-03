/* ============================================================
   Attendance / OT hour math — Rizvi Fashions weekly-72hr rules
   ------------------------------------------------------------
   - Working week: Saturday → Thursday (6 days). Friday = weekly holiday.
   - General duty: 08:00 → 17:00, minus 1 hour break = 8 hours/day.
   - Anything worked beyond 8 hours/day (up to the weekly cap) = OT.
   - Weekly hard cap: 72 hours total (general + OT) per employee.
       total <= 72   -> GREEN
       total == 72   -> YELLOW  (at the cap — no more OT should be assigned)
       total  > 72   -> RED     (over the legal/policy cap — needs review)
   ============================================================ */

const GENERAL_DUTY_HOURS = 8;
const WEEKLY_CAP_HOURS = 72;

// Parse "HH:MM" (or "HH:MM:SS") into total minutes since midnight. Returns null if invalid.
function toMinutes(hms) {
  if (!hms || typeof hms !== 'string') return null;
  const m = hms.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]), s = Number(m[3] || 0);
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 60 + min + s / 60;
}

// Given check_in / check_out ("HH:MM"), returns { workedHours, generalHours, otHours } for one day.
// Assumes same-day shift (out > in). 1 hour break is deducted from the raw span.
function computeDayHours(checkIn, checkOut) {
  const inM = toMinutes(checkIn);
  const outM = toMinutes(checkOut);
  if (inM === null || outM === null || outM <= inM) {
    return { workedHours: 0, generalHours: 0, otHours: 0 };
  }
  const rawHours = (outM - inM) / 60;
  const workedHours = Math.max(0, rawHours - 1); // minus 1 hour break
  const generalHours = Math.min(workedHours, GENERAL_DUTY_HOURS);
  const otHours = Math.max(0, workedHours - GENERAL_DUTY_HOURS);
  return {
    workedHours: round2(workedHours),
    generalHours: round2(generalHours),
    otHours: round2(otHours),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

// Given any JS Date (or ISO date string) inside the week, return the Saturday (week start) as YYYY-MM-DD.
function weekStartFor(dateLike) {
  const d = new Date(dateLike + 'T00:00:00');
  const day = d.getDay(); // Sun=0 ... Sat=6
  const diffToSat = (day - 6 + 7) % 7; // days since the most recent Saturday
  d.setDate(d.getDate() - diffToSat);
  return d.toISOString().slice(0, 10);
}

function weekEndFor(weekStartISO) {
  const d = new Date(weekStartISO + 'T00:00:00');
  d.setDate(d.getDate() + 5); // Sat + 5 = Thursday
  return d.toISOString().slice(0, 10);
}

function weeklySignal(totalHours) {
  if (totalHours > WEEKLY_CAP_HOURS) return 'red';
  if (totalHours >= WEEKLY_CAP_HOURS) return 'yellow';
  return 'green';
}

module.exports = {
  GENERAL_DUTY_HOURS, WEEKLY_CAP_HOURS,
  toMinutes, computeDayHours, weekStartFor, weekEndFor, weeklySignal, round2,
};
