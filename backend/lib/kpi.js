/* ============================================================
   KPI / Performance Evaluation — period math
   ------------------------------------------------------------
   Daily      : YES/NO/PARTIAL checklist responses -> one score out of 100.
   Weekly     : Sat->Thu (6 days) x 100 = 600 marks, converted back to /100.
   Monthly    : average of that calendar month's daily scores.
   Quarterly  : average of that calendar quarter's daily scores.
   Half-Yearly: 6-month block anchored to the employee's JOIN DATE (not calendar).
   Annual     : 12-month block anchored to the employee's JOIN DATE.

   YES = full credit, PARTIAL = half credit, NO = zero credit.
   A weekly/monthly/etc. score is the average of the daily scores that fall
   inside the period (only days that actually have a submitted checklist
   count toward the average — "days_submitted" / "days_in_period" is also
   returned so the dashboard can show completion coverage, not just marks).
   ============================================================ */

const { weekStartFor, weekEndFor } = require('./hours');
const { toIsoDate } = require('./dates');

const PARTIAL_CREDIT = 0.5;

function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
function addMonths(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return isoDate(d); }
function round2(n) { return Math.round(n * 100) / 100; }

// ---------- Calendar-based periods ----------
function monthRange(iso) {
  const d = new Date(iso + 'T00:00:00');
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

function quarterRange(iso) {
  const d = new Date(iso + 'T00:00:00');
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3, 1);
  const end = new Date(d.getFullYear(), q * 3 + 3, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

// ---------- Join-date-anchored periods (half-yearly / annual) ----------
// Returns the {start, end} of the N-month block (starting at joinDate, repeating every N months)
// that contains anchorDate. e.g. joined 2023-03-15, N=12, anchor 2026-08-09 -> the 2026-03-15..2027-03-14 cycle.
function anchoredPeriod(joinDateRaw, anchorISO, months) {
  const joinDateISO = toIsoDate(joinDateRaw);
  if (!joinDateISO) return null;
  let start = joinDateISO;
  let cycle = 0;
  while (cycle < 200) { // safety cap (~100+ years at half-yearly step)
    const end = addMonths(start, months);
    if (anchorISO < end) return { start, end: addDays(end, -1), cycle_number: cycle + 1 };
    start = end;
    cycle++;
  }
  return null;
}

// ---------- Core: daily scores for an employee within [start,end] ----------
function dailyScoresInRange(db, employeeId, start, end) {
  const rows = db.prepare(`
    SELECT cr.date, cr.answer, COALESCE(ci.weight, 1) AS weight
    FROM checklist_responses cr JOIN checklist_items ci ON ci.id = cr.checklist_item_id
    WHERE cr.employee_id = ? AND cr.date BETWEEN ? AND ?
  `).all(employeeId, start, end);

  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { totalWeight: 0, earned: 0 };
    const credit = r.answer === 'yes' ? 1 : (r.answer === 'partial' ? PARTIAL_CREDIT : 0);
    byDate[r.date].totalWeight += r.weight;
    byDate[r.date].earned += r.weight * credit;
  }

  const dailyScores = Object.keys(byDate).sort().map((date) => ({
    date,
    score: byDate[date].totalWeight > 0 ? round2((byDate[date].earned / byDate[date].totalWeight) * 100) : null,
  })).filter((d) => d.score !== null);

  return dailyScores;
}

function periodDayCount(start, end) {
  const d1 = new Date(start + 'T00:00:00'), d2 = new Date(end + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000) + 1;
}

// ---------- Public: evaluate one period for one employee ----------
// periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'annual'
function evaluatePeriod(db, employee, periodType, anchorDate) {
  const anchor = anchorDate || new Date().toISOString().slice(0, 10);
  let start, end, label;

  if (periodType === 'daily') {
    start = end = anchor; label = `Daily — ${anchor}`;
  } else if (periodType === 'weekly') {
    start = weekStartFor(anchor); end = weekEndFor(start); label = `Weekly — ${start} → ${end}`;
  } else if (periodType === 'monthly') {
    ({ start, end } = monthRange(anchor)); label = `Monthly — ${start.slice(0, 7)}`;
  } else if (periodType === 'quarterly') {
    ({ start, end } = quarterRange(anchor)); label = `Quarterly — ${start} → ${end}`;
  } else if (periodType === 'half_yearly') {
    const p = anchoredPeriod(employee.join_date, anchor, 6);
    if (!p) return { error: 'join_date অনুপস্থিত/অবৈধ — ষান্মাসিক মূল্যায়ন গণনা করা যায়নি' };
    start = p.start; end = p.end; label = `Half-Yearly (cycle ${p.cycle_number}, join-date anchored) — ${start} → ${end}`;
  } else if (periodType === 'annual') {
    const p = anchoredPeriod(employee.join_date, anchor, 12);
    if (!p) return { error: 'join_date অনুপস্থিত/অবৈধ — বার্ষিক মূল্যায়ন গণনা করা যায়নি' };
    start = p.start; end = p.end; label = `Annual (year ${p.cycle_number}, join-date anchored) — ${start} → ${end}`;
  } else {
    return { error: `অজানা period_type: ${periodType}` };
  }

  const daily = dailyScoresInRange(db, employee.id, start, end);
  const daysInPeriod = periodDayCount(start, end);
  const averageScore = daily.length ? round2(daily.reduce((s, d) => s + d.score, 0) / daily.length) : null;

  return {
    period_type: periodType, label, period_start: start, period_end: end,
    days_in_period: daysInPeriod, days_submitted: daily.length,
    average_score: averageScore, daily_scores: daily,
  };
}

module.exports = { evaluatePeriod, dailyScoresInRange, monthRange, quarterRange, anchoredPeriod, PARTIAL_CREDIT };
