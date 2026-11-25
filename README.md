# Prospecteur

Outil interne : trouver les commerces et artisans d'une ville sans site web (ou avec un site cassé ou obsolète), puis suivre la prospection.

- **Recherche** : OpenStreetMap via Overpass (`shop=*`, `craft=*`, `amenity=restaurant|cafe|bar|hairdresser|beauty`). Un seul appel Overpass à la fois, cache de 24 h dans SQLite. Le quartier vient des polygones OSM.
- **Vérification des sites** (timeout de 8 s, garde SSRF) avec 4 classements :
  - pas de site (y compris une simple page Facebook, PagesJaunes…) ;
  - site cassé ;
  - site obsolète (pas de HTTPS, pas responsive, Last-Modified ou © ancien) ;
  - site OK.
- **Carte et tableau synchronisés** (Leaflet, TanStack Table) : filtres par catégorie, site, statut et quartier, recherche texte, export CSV.
- **Mini-CRM** : statut, notes, date de relance, vue « Relances du jour ».
- **client.json** pour le générateur de sites vitrines, et photo de rue Panoramax.
- **Connexion** : un seul utilisateur, cookie signé, limite de tentatives.

Stack : Next.js 16 (App Router, sortie standalone), React 19, TypeScript, Tailwind v4, Framer Motion, TanStack Query/Table, react-leaflet, SQLite (better-sqlite3) et Drizzle ORM. La DA est reprise de Portfolio2026 : tokens dans [src/styles/design-tokens.ts](src/styles/design-tokens.ts) et [src/app/globals.css](src/app/globals.css).

## Développement local

```bash
npm install
cp .env.example .env.local      # puis remplir les 3 variables d'authentification
npm run hash-password           # copie la ligne AUTH_PASSWORD_HASH_B64=… dans .env.local
npm run dev                     # http://localhost:3000
```

La base est créée dans `data/prospecteur.db` et migrée au démarrage. Après une modification de [src/db/schema.ts](src/db/schema.ts), lancer `npm run db:generate` et commiter le dossier `drizzle/`.

Vérifier les contrastes des couleurs de statut : `npm run check-contrast`.

---

## Déploiement

Cible : serveur Hetzner (Ubuntu 24.04, Docker, Nginx Proxy Manager, réseau Docker externe `services_default`). Le schéma est le même que pour Portfolio2026 : `git pull && ./deploy.sh`.

Le container **ne publie aucun port** sur l'hôte. NPM le joint par son nom (`prospecteur:3000`) sur le réseau `services_default`.

### 1. Cloner

```bash
sudo mkdir -p /var/www/prospecteur && sudo chown "$USER": /var/www/prospecteur
git clone https://github.com/AdamBellanger/OpenMoneyStreet.git /var/www/prospecteur
cd /var/www/prospecteur
chmod +x deploy.sh backup.sh
```

### 2. Créer le `.env`

```bash
cp .env.example .env
chmod 600 .env
docker compose build            # l'image contient le générateur de hash
docker run --rm -it --entrypoint node prospecteur:latest scripts/hash-password.mjs
#  -> AUTH_PASSWORD_HASH_B64=…   (à coller dans .env)
openssl rand -base64 48          # -> valeur de SESSION_SECRET
nano .env                        # AUTH_USERNAME, AUTH_PASSWORD_HASH_B64, SESSION_SECRET
```

Le hash bcrypt est stocké **en base64** : sous sa forme brute, ses `$` seraient interprétés par docker compose comme des variables.

### 3. Premier lancement

```bash
docker network inspect services_default >/dev/null   # le réseau doit déjà exister (celui de NPM)
./deploy.sh
```

`deploy.sh` enchaîne `git pull --ff-only`, `docker compose up -d --build` et `docker image prune -f`, puis attend que le container soit `healthy` (60 s maximum, logs affichés sinon). Les **migrations Drizzle s'appliquent automatiquement** au démarrage du container ([src/instrumentation.ts](src/instrumentation.ts)).

Vérifications :

```bash
docker ps --filter name=prospecteur          # STATUS: Up … (healthy)
docker exec prospecteur wget -qO- http://127.0.0.1:3000/api/health   # {"ok":true,"db":"up"}
```

### 4. Nginx Proxy Manager

S'il n'y a pas d'enregistrement DNS wildcard, créer d'abord un enregistrement `A` : `prospecteur.adambellanger.pro` vers l'IP du serveur.

**Access Lists → Add Access List** (protection en plus de la connexion de l'app) :
- Nom : `prospecteur` ;
- onglet *Authorization* : un utilisateur et un mot de passe, **différents** de ceux de l'app ;
- onglet *Access* (optionnel) : `allow` sur le sous-réseau WireGuard (par ex. `10.8.0.0/24`), puis `deny all` ;
- *Satisfy Any* : l'IP WireGuard **ou** le mot de passe suffit. *Satisfy All* exige les deux.

**Hosts → Proxy Hosts → Add Proxy Host** :

| Onglet | Réglage |
|---|---|
| Details | Domain Names : `prospecteur.adambellanger.pro` |
| | Scheme : `http` · Forward Hostname/IP : `prospecteur` · Forward Port : `3000` |
| | Cache Assets : off · **Block Common Exploits : on** · Websockets Support : off |
| | Access List : `prospecteur` |
| SSL | SSL Certificate : *Request a new SSL Certificate* (Let's Encrypt) |
| | **Force SSL : on** · **HTTP/2 Support : on** · HSTS Enabled : on |
| | Email Let's Encrypt, accepter les conditions, puis *Save* |

Onglet **Advanced** (*Custom Nginx Configuration*), **indispensable** : la première recherche d'une ville interroge Overpass, ce qui prend de 30 s à 3 min quand le serveur public est chargé (l'app retente sur un miroir). Or NPM coupe par défaut au bout de 60 s, avec une 504 :

```nginx
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

NPM transmet `X-Real-IP` et `X-Forwarded-For`, que l'app utilise pour limiter les tentatives de connexion par IP. Le cookie de session étant `Secure`, la connexion ne fonctionne qu'en HTTPS, d'où le *Force SSL*.

### 5. Sauvegardes

[backup.sh](backup.sh) fait une copie à chaud avec `sqlite3 .backup`, dans le container, puis vérifie la copie (`PRAGMA integrity_check`). Il la compresse ensuite dans `/var/backups/prospecteur/prospecteur-AAAAMMJJ-HHMMSS.db.gz` et garde 14 jours.

```bash
sudo /var/www/prospecteur/backup.sh          # test manuel
sudo crontab -e
```

Ligne à ajouter (tous les jours à 3 h 15) :

```cron
15 3 * * * /var/www/prospecteur/backup.sh >> /var/log/prospecteur-backup.log 2>&1
```

### 6. Restaurer une sauvegarde

```bash
cd /var/www/prospecteur
docker compose stop prospecteur
docker run --rm -v prospecteur_prospecteur-data:/data -v /var/backups/prospecteur:/b:ro alpine sh -c \
  'gunzip -c /b/prospecteur-AAAAMMJJ-HHMMSS.db.gz > /data/prospecteur.db \
   && rm -f /data/prospecteur.db-wal /data/prospecteur.db-shm \
   && chown 1001:1001 /data/prospecteur.db'
docker compose start prospecteur
```

Le volume s'appelle `<dossier>_prospecteur-data`, soit `prospecteur_prospecteur-data` pour un clone dans `/var/www/prospecteur`. Pour le vérifier : `docker volume ls`.

### Mises à jour

```bash
cd /var/www/prospecteur && git pull && ./deploy.sh
```

(`deploy.sh` refait lui-même un `git pull --ff-only`.)

### Sécurité, en résumé

- **Authentification de l'app** :
  - toutes les pages et toutes les routes `/api` sont protégées par [src/proxy.ts](src/proxy.ts), sauf `/login`, `/api/auth/login` et `/api/health` ;
  - cookie `httpOnly`, `secure` et `sameSite=strict`, signé en HMAC-SHA256, valable 7 jours ;
  - limite de 5 échecs par IP sur 15 min et 30 au total, stockée en SQLite ;
  - temps de réponse constant en cas d'échec.
- **En plus** : Access List NPM, CSP à nonce, en-têtes de sécurité, requêtes de modification refusées si l'origine diffère, `noindex`.
- **Container** : utilisateur non-root (uid 1001), `cap_drop: ALL`, `no-new-privileges`, 512 Mo de mémoire, aucun port publié.
- **Vérification des sites** : les adresses privées, loopback et link-local sont refusées à chaque redirection (garde SSRF).
