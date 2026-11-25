// Exécuté une fois au démarrage du serveur Next : applique les migrations Drizzle
// avant la première requête (getDb() migre à l'ouverture de la connexion).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("@/db");
  getDb();
  console.log("[db] migrations Drizzle appliquées");
}
