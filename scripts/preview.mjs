#!/usr/bin/env node
// Lance la version de production (optimisée) en local, sur la base de dev (data/prospecteur.db).
// Usage : npm run preview   (après `next build`, fait automatiquement par le script npm)
//
// Le serveur de dev (`npm run dev`) compile chaque page à la volée et embarque les outils de
// debug de React : il est fait pour coder, pas pour travailler avec. Celui-ci est fluide.
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Build manquant : lancez `npm run preview` (il fait le build) ou `npm run build`.");
  process.exit(1);
}

// La sortie standalone ne contient ni les fichiers statiques ni les migrations (comme dans le Dockerfile).
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(root, "drizzle"), path.join(standalone, "drizzle"), { recursive: true });

// Mêmes identifiants qu'en dev.
for (const file of [".env.local", ".env"]) {
  if (existsSync(path.join(root, file))) {
    process.loadEnvFile(path.join(root, file));
    break;
  }
}

const port = process.env.PORT ?? "3000";
const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: "127.0.0.1",
    DATABASE_PATH: process.env.DATABASE_PATH ?? path.join(root, "data", "prospecteur.db"),
  },
});
console.log(`Prospecteur (version optimisée) : http://localhost:${port}`);
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
