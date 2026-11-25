"use client";

import dynamic from "next/dynamic";
import type { ProspectMapProps } from "./ProspectMap";

// Leaflet touche à `window` : chargé uniquement côté client.
const ProspectMap = dynamic(() => import("./ProspectMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-muted">
      Chargement de la carte…
    </div>
  ),
});

export function MapPanel(props: ProspectMapProps) {
  return (
    // data-native-cursor : le curseur personnalisé s'efface au-dessus de la carte.
    <div data-native-cursor className="relative h-full w-full">
      <ProspectMap {...props} />
    </div>
  );
}
