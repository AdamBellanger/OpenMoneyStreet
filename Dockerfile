# syntax=docker/dockerfile:1
# Même structure que Portfolio2026 : deps -> build -> run (node:22-alpine).

# ---- deps : node_modules depuis le lockfile + better-sqlite3 compilé pour musl ----
FROM node:22-alpine AS deps
WORKDIR /app
# Chaîne de compilation pour le module natif better-sqlite3 (node-gyp).
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
# Compilation depuis les sources pour cette image exacte (musl, Node 22). Le chargeur de
# better-sqlite3 préfère build/Release aux prebuilds, que l'on supprime ensuite.
RUN cd node_modules/better-sqlite3 \
 && npm run build-release \
 && rm -rf prebuilds deps src build/deps build/Release/obj build/Release/obj.target build/Release/.deps \
           build/Release/sqlite3.a build/Release/test_extension.node \
 && node -e "const D=require('better-sqlite3'); new D(':memory:').prepare('select 1').get(); console.log('better-sqlite3 OK')"

# ---- build : serveur Next.js autonome ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- run : image minimale, uniquement la sortie standalone ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/app/data/prospecteur.db

# sqlite : CLI utilisée par backup.sh (`sqlite3 .backup`) via docker exec.
RUN apk add --no-cache sqlite \
 && addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs \
 && mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations Drizzle, appliquées au démarrage par src/instrumentation.ts.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
# Générateur de hash du mot de passe. Turbopack embarque bcryptjs dans les chunks serveur :
# le script autonome a besoin de sa propre copie (pur JS, quelques Ko).
COPY --from=build --chown=nextjs:nodejs /app/scripts/hash-password.mjs ./scripts/hash-password.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
# Module natif compilé dans l'étape deps (le traçage standalone ne suit pas toujours les .node).
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

USER nextjs
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
