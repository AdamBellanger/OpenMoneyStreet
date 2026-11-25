#!/usr/bin/env node
// Génère la ligne AUTH_PASSWORD_HASH_B64 du .env.
// Usage : npm run hash-password            (demande le mot de passe, sans l'afficher)
//         npm run hash-password -- "secret" (déconseillé : reste dans l'historique du shell)
//
// Le hash bcrypt est encodé en base64 parce qu'il contient des "$" que docker compose
// interprète comme des variables dans env_file.
import bcrypt from "bcryptjs";
import readline from "node:readline";

async function ask(question) {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return Buffer.concat(chunks).toString().replace(/\r?\n$/, "");
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => {
    if (s.includes(question)) process.stdout.write(s);
  };
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

const password = process.argv[2] ?? (await ask("Mot de passe : "));
if (!password || password.length < 12) {
  console.error("Mot de passe trop court (12 caractères minimum).");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
console.log(`AUTH_PASSWORD_HASH_B64=${Buffer.from(hash).toString("base64")}`);
