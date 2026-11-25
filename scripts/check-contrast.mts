// Vérifie que les couleurs de statut atteignent le contraste WCAG AA (4,5:1)
// sur le fond et sur l'anthracite, et que globals.css reprend bien les tokens.
// Usage : npm run check-contrast   (Node ≥ 22.18 : exécution TypeScript native)
import { readFileSync } from "node:fs";
import { colors, crm, status } from "../src/styles/design-tokens.ts";

const AA = 4.5;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
let failed = false;

const groups = { status, crm } as Record<string, Record<string, string>>;
for (const [group, values] of Object.entries(groups)) {
  for (const [name, hex] of Object.entries(values)) {
    const onBg = ratio(hex, colors.background);
    const onPanel = ratio(hex, colors.anthracite);
    const ok = onBg >= AA && onPanel >= AA;
    const cssVar = `--${group}-${name.replace(/_/g, "-")}: ${hex}`;
    const inCss = css.toLowerCase().includes(cssVar.toLowerCase());
    if (!ok || !inCss) failed = true;
    console.log(
      `${ok && inCss ? "✓" : "✗"} ${`${group}.${name}`.padEnd(22)} ${hex}  fond ${onBg.toFixed(2)}  anthracite ${onPanel.toFixed(2)}${inCss ? "" : "  (absent de globals.css)"}`,
    );
  }
}

process.exit(failed ? 1 : 0);
