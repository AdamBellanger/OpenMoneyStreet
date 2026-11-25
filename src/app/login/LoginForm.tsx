"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCurtainNavigate } from "@/components/layout/PageTransition";
import { useMagnetic } from "@/components/ui/Magnetic";
import { SplitText } from "@/components/ui/SplitText";
import { duration, ease, shadow, transitions } from "@/styles/design-tokens";

/** N'accepte qu'un chemin interne (pas de redirection ouverte vers un autre site). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

const FIELD =
  "w-full rounded-full border border-foreground/15 bg-background/60 px-5 py-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors duration-150 focus:border-accent";

export function LoginForm() {
  const params = useSearchParams();
  const navigate = useCurtainNavigate();
  const magnetic = useMagnetic(0.4);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        navigate(safeNext(params.get("next")));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Connexion impossible.");
      setPassword("");
    } catch {
      setError("Serveur injoignable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.reveal, ease: ease.out, delay: 0.15 }}
      style={{ boxShadow: shadow.float }}
      className="w-full max-w-sm rounded-2xl border border-foreground/10 bg-anthracite/80 p-8 backdrop-blur"
    >
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Connexion</p>
      <div className="mt-3 border-t border-foreground/10" />
      <SplitText text="Bon retour, Adam." as="h1" className="mt-6 font-display text-4xl leading-tight" delay={0.35} />

      <div className="mt-8 flex flex-col gap-3">
        <label className="sr-only" htmlFor="username">
          Identifiant
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="Identifiant"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={FIELD}
        />
        <label className="sr-only" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
        />
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key={error}
              role="alert"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.ui}
              className="text-sm text-[var(--status-pas-de-site)]"
            >
              {error}
            </motion.p>
          ) : (
            <span className="text-xs text-muted">Accès réservé</span>
          )}
        </AnimatePresence>
        <motion.button
          type="submit"
          disabled={pending}
          aria-label="Se connecter"
          {...magnetic}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent font-display text-2xl text-background transition-opacity duration-150 disabled:opacity-60"
        >
          {pending ? <span className="h-3 w-3 animate-pulse rounded-full bg-background" /> : "→"}
        </motion.button>
      </div>
    </motion.form>
  );
}
