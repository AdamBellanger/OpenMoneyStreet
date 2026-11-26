"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMagnetic } from "@/components/ui/Magnetic";
import { useCurtainNavigate } from "@/components/layout/PageTransition";
import { logout } from "@/lib/api-client";
import { ease } from "@/styles/design-tokens";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/prospection", label: "Prospection" },
  { href: "/clients", label: "Clients" },
  { href: "/relances", label: "Relances" },
];

/**
 * Header de l'outil : signature du portfolio à gauche, outils de la page au centre
 * (`children`), liens avec point actif et bouton rond magnétique qui ouvre le panneau
 * de navigation (port de SiteNav, durées raccourcies pour un usage répété).
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const navigate = useCurtainNavigate();
  const magnetic = useMagnetic(0.4);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !overlayRef.current) return;
      const f = overlayRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  async function onLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  return (
    <>
      <header className="relative z-30 flex items-center gap-3 border-b border-foreground/10 px-4 py-3 sm:gap-6 sm:px-10">
        <Link href="/" className="shrink-0 font-display text-sm tracking-wide">
          <span className="hidden md:inline">
            © Made by Adam Bellanger <span className="text-muted">/ </span>
          </span>
          <span className="md:text-muted">Prospecteur</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-4">{children}</div>

        <nav aria-label="Navigation principale" className="hidden shrink-0 items-center gap-7 xl:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="group relative text-sm transition-opacity duration-150 hover:opacity-60"
              >
                {link.label}
                <span
                  aria-hidden
                  className={`absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current transition-transform duration-200 ${
                    active ? "scale-100" : "scale-0 group-hover:scale-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <motion.button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="app-nav-overlay"
          {...magnetic}
          className={`relative z-50 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
            open ? "bg-accent text-background" : "border border-foreground/20 bg-anthracite/90 text-foreground"
          }`}
        >
          <span aria-hidden className="relative block h-2.5 w-5">
            <span className={`absolute left-0 h-px w-full bg-current transition-transform duration-200 ${open ? "top-1/2 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-px w-full bg-current transition-transform duration-200 ${open ? "top-1/2 -rotate-45" : "bottom-0"}`} />
          </span>
          <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
        </motion.button>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/40"
            />
            <motion.div
              id="app-nav-overlay"
              ref={overlayRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: "100%" }}
              animate={{ x: "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.24, ease: ease.inOut }}
              className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col justify-between border-l border-foreground/10 bg-anthracite px-8 py-24 sm:px-10"
            >
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Navigation</p>
                <div className="mt-3 border-t border-foreground/10" />
                <ul className="mt-8 flex flex-col gap-3">
                  {LINKS.map((link, i) => (
                    <li key={link.href} className="flex items-center gap-3">
                      {pathname === link.href && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      <Link
                        href={link.href}
                        ref={i === 0 ? firstLinkRef : undefined}
                        onClick={() => setOpen(false)}
                        className="font-display text-4xl transition-colors duration-150 hover:text-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Session</p>
                <div className="mt-3 border-t border-foreground/10" />
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-4 text-sm transition-colors duration-150 hover:text-accent"
                >
                  Se déconnecter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
