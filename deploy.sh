#!/usr/bin/env sh
# Met à jour Prospecteur sur le serveur : pull, rebuild, redémarrage, nettoyage.
# Usage (sur le serveur, dans /var/www/prospecteur) :  ./deploy.sh
# Les migrations Drizzle s'appliquent automatiquement au démarrage du container
# (src/instrumentation.ts), avant la première requête.
set -eu

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERREUR : .env manquant. Copiez .env.example vers .env et remplissez-le (voir README)." >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only

echo "==> docker compose build + redémarrage"
docker compose up -d --build

echo "==> suppression des images orphelines des builds précédents"
docker image prune -f >/dev/null

echo "==> attente du healthcheck"
for _ in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' prospecteur 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then
    echo "OK : prospecteur est healthy ($(git log -1 --format='%h %s'))"
    exit 0
  fi
  sleep 2
done

echo "ATTENTION : container non healthy après 60 s. Logs :"
docker compose logs --tail 40 prospecteur
exit 1
