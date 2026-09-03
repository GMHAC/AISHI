/** RIZVI FOMS — safe SQLite backup using the native backup API. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

const outDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(outDir, `rizvi_foms_${stamp}.db`);

db.backup(dest)
  .then(() => {
    console.log(`Backup created: ${dest}`);
    db.close();
  })
  .catch((err) => {
    console.error('Backup failed:', err);
    process.exitCode = 1;
    db.close();
  });
