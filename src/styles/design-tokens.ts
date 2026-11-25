/**
 * Design tokens de Prospecteur, extraits de Portfolio2026
 * (app/globals.css, components/ui/*, components/layout/*).
 *
 * Source unique : globals.css reprend ces valeurs en variables CSS, et les composants
 * Framer Motion importent `ease`, `duration`, `spring` et `transitions` d'ici.
 * Toute modification doit être faite aux deux endroits (vérifié par scripts/check-contrast.mts).
 */

/** Palette sombre du portfolio (:root). */
export const colors = {
  background: "#121214",
  foreground: "#edede8",
  anthracite: "#232326",
  muted: "#8c8c90",
  accent: "#7c93b0",
} as const;

/** Variante `.theme-light` du portfolio (sections de contenu claires). */
export const themeLight = {
  background: "#edede8",
  foreground: "#161618",
  anthracite: "#e2e2dc",
  muted: "#6a6a70",
  accent: "#4d6788",
} as const;

/**
 * Couleurs de statut dérivées de la palette : même luminance OKLCH que l'accent (+0,06),
 * chroma 0,085, seule la teinte change. Toutes ≥ 4,5:1 sur background ET anthracite.
 */
export const status = {
  pas_de_site: "#d38e8f",
  site_casse: "#ca976b",
  site_obsolete: "#b4a364",
  site_ok: "#7cb387",
  non_verifie: colors.muted,
} as const;

export const crm = {
  a_contacter: colors.accent,
  maquette_faite: "#ab97d1",
  visite: "#5bb4b8",
  signe: "#7cb387",
  refus: colors.muted,
} as const;

/** Familles de polices (variables posées par next/font dans app/layout.tsx). */
export const fonts = {
  display: "var(--font-clash-display)", // Clash Display 400/500, local
  sans: "var(--font-inter)", // Inter, next/font/google
  mono: "var(--font-geist-mono)", // Geist Mono, next/font/google
} as const;

/** Échelle typographique réellement utilisée dans le portfolio (classes Tailwind). */
export const type = {
  hero: "font-display text-[15vw] font-medium leading-[0.95] tracking-tight",
  display: "font-display text-4xl sm:text-6xl",
  title: "font-display text-2xl",
  eyebrow: "font-mono text-xs uppercase tracking-widest text-muted",
  body: "text-sm",
  badge: "text-[11px]",
} as const;

export const radius = {
  pill: "9999px", // rounded-full : boutons, pastilles, curseur
  card: "1rem", // rounded-2xl : cartes
  panel: "1.5rem", // rounded-3xl
  sm: "0.75rem", // rounded-xl
} as const;

export const shadow = {
  /** La seule ombre du portfolio : cartes flottantes (aperçus projets). */
  float: "0 30px 60px -20px rgba(0,0,0,0.45)",
} as const;

export const spacing = {
  pageX: "px-6 sm:px-10",
  headerY: "py-5",
} as const;

/** Courbes d'easing (cubic-bezier) du portfolio. */
export const ease = {
  /** Signature : reveals, curseur, apparitions. */
  out: [0.16, 1, 0.3, 1],
  /** Rideaux de transition et menu overlay. */
  inOut: [0.76, 0, 0.24, 1],
  /** Sorties (bouton menu qui disparaît). */
  in: [0.4, 0, 1, 1],
} as const;

export const cssEase = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.76, 0, 0.24, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/** Durées en secondes. Portfolio : reveal 0.6, split 0.8, menu 0.5, rideau 0.6 + 0.8, hover 0.3. */
export const duration = {
  /** Outil de travail : actions répétées < 250 ms. */
  fast: 0.12,
  ui: 0.2,
  /** Valeurs du portfolio, réservées à la connexion et aux transitions de page. */
  hover: 0.3,
  menu: 0.5,
  reveal: 0.6,
  split: 0.8,
  splitStagger: 0.06,
  curtainCover: 0.6,
  curtainReveal: 0.8,
  curtainRevealDelay: 0.25,
} as const;

/** Ressorts Framer Motion du portfolio. */
export const spring = {
  cursor: { stiffness: 500, damping: 40, mass: 0.3 },
  magnetic: { stiffness: 150, damping: 15, mass: 0.1 },
  toggle: { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
} as const;

/** Transitions prêtes à l'emploi. */
export const transitions = {
  /** Hover de ligne, focus, petits changements d'état. */
  fast: { duration: duration.fast, ease: ease.out },
  /** Ouverture du panneau de détail, changement de statut. */
  ui: { duration: duration.ui, ease: ease.out },
  /** Apparition "waouh" (écran de connexion). */
  reveal: { duration: duration.reveal, ease: ease.out },
  menu: { duration: duration.menu, ease: ease.inOut },
} as const;
