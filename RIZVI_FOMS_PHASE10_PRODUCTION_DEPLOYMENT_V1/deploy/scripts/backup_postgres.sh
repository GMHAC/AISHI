#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rizvi-foms}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump "$DATABASE_URL" -Fc > "$BACKUP_DIR/rizvi-foms-$STAMP.dump"
echo "Backup created: $BACKUP_DIR/rizvi-foms-$STAMP.dump"
