import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Connexion — Prospecteur" };

const NAME =
  "whitespace-nowrap font-display text-[19vw] font-medium leading-[0.95] tracking-tight sm:text-[15vw]";

/** Écran de connexion, dans l'esprit du hero de Portfolio2026 (nom géant en marquee). */
export default function LoginPage() {
  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-display text-sm tracking-wide">© Made by Adam Bellanger</span>
        <span className="font-mono text-xs uppercase tracking-widest text-muted">Outil interne</span>
      </header>

      <div className="absolute right-6 top-32 z-10 hidden flex-col items-end gap-4 text-right sm:right-10 sm:flex">
        <span aria-hidden className="font-display text-2xl text-accent">
          ↘
        </span>
        <p className="font-display text-xl leading-tight sm:text-2xl">
          Commerces sans site,
          <br />
          prospects à démarcher
        </p>
      </div>

      <div className="relative z-20 flex flex-1 items-center justify-center px-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background via-background/70 to-transparent" />
      <div className="relative z-10 w-full select-none overflow-hidden pb-6" aria-hidden="true">
        <div className="animate-marquee flex w-max items-center motion-reduce:animate-none">
          {[0, 1].map((i) => (
            <span key={i} className="flex items-center">
              <span className={`${NAME} text-foreground`}>Prospecteur</span>
              <span className={`${NAME} text-muted`}>&nbsp;—&nbsp;</span>
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
