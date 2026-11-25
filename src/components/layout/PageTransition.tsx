"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { duration, ease } from "@/styles/design-tokens";

/** Nom affiché sur le rideau, par chemin. */
const LABELS: Record<string, string> = {
  "/": "Carte",
  "/relances": "Relances du jour",
  "/login": "Connexion",
};

const variants = {
  hidden: { y: "120%", visibility: "hidden" as const, transition: { duration: 0 } },
  cover: { y: "0%", visibility: "visible" as const, transition: { duration: duration.curtainCover, ease: ease.inOut } },
  reveal: {
    y: "-120%",
    visibility: "visible" as const,
    transition: { duration: duration.curtainReveal, ease: ease.inOut, delay: duration.curtainRevealDelay },
  },
};

type Navigate = (href: string) => void;
const NavigateContext = createContext<Navigate>(() => {});

/** Navigation avec rideau, utilisable hors d'un <a> (après connexion, déconnexion). */
export const useCurtainNavigate = () => useContext(NavigateContext);

/**
 * Rideau de Portfolio2026 : les clics sur liens internes sont interceptés, un panneau
 * anthracite à bords courbes monte avec le nom de la destination, la route change
 * dessous, puis le panneau s'en va. C'est un des deux seuls effets "longs" de l'outil.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [target, setTarget] = useState<{ href: string; path: string; label: string } | null>(null);
  const busy = useRef(false);

  const navigate = useCallback<Navigate>(
    (href) => {
      const url = new URL(href, window.location.href);
      if (reducedMotion) {
        router.push(url.pathname + url.search);
        return;
      }
      if (busy.current) return;
      busy.current = true;
      setTarget({ href: url.pathname + url.search + url.hash, path: url.pathname, label: LABELS[url.pathname] ?? "" });
    },
    [reducedMotion, router],
  );

  useEffect(() => {
    if (reducedMotion) return;
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element).closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (url.pathname.startsWith("/api/")) return;
      e.preventDefault();
      navigate(url.href);
    };
    // Phase de capture : passe avant le handler de next/link.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [reducedMotion, navigate]);

  const state = !target ? "hidden" : pathname === target.path ? "reveal" : "cover";

  return (
    <NavigateContext.Provider value={navigate}>
      {children}
      <motion.div
        aria-hidden="true"
        initial="hidden"
        animate={state}
        variants={variants}
        onAnimationComplete={(definition) => {
          if (definition === "cover" && target) router.push(target.href);
          if (definition === "reveal") {
            busy.current = false;
            setTarget(null);
          }
        }}
        className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-anthracite"
      >
        <span className="absolute -top-[9vh] left-[-10%] h-[18vh] w-[120%] rounded-[50%] bg-anthracite" />
        <span className="absolute -bottom-[9vh] left-[-10%] h-[18vh] w-[120%] rounded-[50%] bg-anthracite" />
        <motion.p
          animate={{ opacity: state === "hidden" ? 0 : 1 }}
          transition={{ duration: 0.3, delay: state === "cover" ? 0.2 : 0 }}
          className="relative flex items-center gap-4 font-display text-4xl sm:text-6xl"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          {target?.label}
        </motion.p>
      </motion.div>
    </NavigateContext.Provider>
  );
}
