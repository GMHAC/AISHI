/* ============================================================
   Flexible date parsing — the HR export stores dates as "06-Jun-14"
   (DD-Mon-YY), not ISO. This normalizes any of the formats seen in
   the Rizvi Fashions employee data to a strict 'YYYY-MM-DD' string.
   ============================================================ */

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

function toIsoDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Already ISO: 'YYYY-MM-DD' (or with a time suffix)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 'DD-Mon-YY' or 'DD-Mon-YYYY' e.g. "06-Jun-14", "06-Jun-2014"
  const dmy = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,})[-\/ ](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const mon = MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    if (!mon) return null;
    let year = dmy[3];
    if (year.length === 2) year = (Number(year) >= 50 ? '19' : '20') + year;
    return `${year}-${mon}-${day}`;
  }

  // 'DD-MM-YYYY' or 'DD/MM/YYYY'
  const dmyNum = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmyNum) return `${dmyNum[3]}-${dmyNum[2].padStart(2, '0')}-${dmyNum[1].padStart(2, '0')}`;

  return null;
}

module.exports = { toIsoDate };
