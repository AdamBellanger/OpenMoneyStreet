#!/usr/bin/env sh
# Sauvegarde à chaud de la base SQLite de Prospecteur.
# - `sqlite3 .backup` (API de sauvegarde en ligne : cohérent même en écriture, WAL compris),
#   exécuté DANS le container (l'image embarque le CLI sqlite3) ;
# - vérification `PRAGMA integrity_check` de la copie ;
# - copie gzip dans /var/backups/prospecteur (taille contrôlée), rotation à 14 jours.
#
# Crontab (root), tous les jours à 3 h 15 :
#   15 3 * * * /var/www/prospecteur/backup.sh >> /var/log/prospecteur-backup.log 2>&1
set -eu

CONTAINER="${CONTAINER:-prospecteur}"
DB="/app/data/prospecteur.db"
DEST="${BACKUP_DIR:-/var/backups/prospecteur}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)
# Copie temporaire DANS le volume : /tmp est un tmpfs (conteneur en lecture seule).
TMP="/app/data/.backup-$STAMP.db"
OUT="$DEST/prospecteur-$STAMP.db.gz"

mkdir -p "$DEST"
chmod 700 "$DEST"

cleanup() { docker exec "$CONTAINER" rm -f "$TMP" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "[$(date -Is)] sauvegarde de $CONTAINER:$DB"
docker exec "$CONTAINER" sqlite3 "$DB" ".backup '$TMP'"

check=$(docker exec "$CONTAINER" sqlite3 "$TMP" "PRAGMA integrity_check;")
if [ "$check" != "ok" ]; then
  echo "ERREUR : integrity_check a échoué : $check" >&2
  exit 1
fi

# Lecture en flux via docker exec (docker cp ne voit pas les tmpfs et dépend du driver).
docker exec "$CONTAINER" cat "$TMP" | gzip -9 > "$OUT.part"

# Garde-fou : une archive vide ou corrompue ne doit jamais passer pour une sauvegarde.
size=$(gunzip -c "$OUT.part" | wc -c | tr -d " ")
expected=$(docker exec "$CONTAINER" stat -c %s "$TMP")
if [ "$size" -lt 4096 ] || [ "$size" != "$expected" ]; then
  rm -f "$OUT.part"
  echo "ERREUR : archive invalide ($size octets, attendu $expected)" >&2
  exit 1
fi
mv "$OUT.part" "$OUT"
chmod 600 "$OUT"
echo "[$(date -Is)] OK : $OUT ($(du -h "$OUT" | cut -f1))"

# Rotation : on supprime les sauvegardes de plus de KEEP_DAYS jours.
find "$DEST" -name 'prospecteur-*.db.gz' -type f -mtime +"$((KEEP_DAYS - 1))" -print -delete
