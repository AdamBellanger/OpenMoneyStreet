"use client";

import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { SITE_CLASS_COLORS, type PlaceDTO } from "@/lib/domain";
import { colors } from "@/styles/design-tokens";

export interface ProspectMapProps {
  places: PlaceDTO[];
  selected: PlaceDTO | null;
  onSelect: (id: string) => void;
  /** Largeur (px) masquée à droite par le panneau de détail, pour recentrer le marqueur. */
  rightInset: number;
}

const ROUEN: [number, number] = [49.4431, 1.0993];

/**
 * Tous les commerces dans UNE couche canvas gérée à la main : un composant React par marqueur
 * (près de 2 000 pour Rouen) rendait chaque filtre et chaque déplacement très lents.
 * On garde les marqueurs entre deux rendus et on ne touche qu aux différences.
 */
function MarkerLayer({ places, onSelect }: { places: PlaceDTO[]; onSelect: (id: string) => void }) {
  const map = useMap();
  const group = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, { marker: L.CircleMarker; cls: string }>());
  const onSelectRef = useRef(onSelect);
  const tooltip = useRef<L.Tooltip | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const g = L.layerGroup().addTo(map);
    const known = markers.current;
    group.current = g;
    tooltip.current = L.tooltip({ direction: "top", offset: [0, -6] });
    return () => {
      g.remove();
      known.clear();
      group.current = null;
    };
  }, [map]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const known = markers.current;
    const wanted = new Set(places.map((p) => p.id));
    for (const [id, entry] of known) {
      if (!wanted.has(id)) {
        g.removeLayer(entry.marker);
        known.delete(id);
      }
    }
    // Pas de renderer dédié : avec preferCanvas, tous les marqueurs (et celui de la sélection) partagent
    // le canvas de la carte. Un 2e canvas passerait par-dessus et avalerait les clics.
    for (const p of places) {
      const entry = known.get(p.id);
      if (entry) {
        if (entry.cls !== p.siteClass) {
          entry.marker.setStyle({ fillColor: SITE_CLASS_COLORS[p.siteClass] });
          entry.cls = p.siteClass;
        }
        continue;
      }
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 5,
        color: colors.background,
        weight: 1,
        fillColor: SITE_CLASS_COLORS[p.siteClass],
        fillOpacity: 0.95,
      });
      marker.on("click", () => onSelectRef.current(p.id));
      marker.on("mouseover", () => {
        const t = tooltip.current;
        if (t) map.openTooltip(t.setContent(p.name).setLatLng(marker.getLatLng()));
      });
      marker.on("mouseout", () => tooltip.current && map.closeTooltip(tooltip.current));
      g.addLayer(marker);
      known.set(p.id, { marker, cls: p.siteClass });
    }
  }, [places, map]);

  return null;
}

/** Cadre la carte sur la ville quand la liste change de ville. */
function FitToPlaces({ places }: { places: PlaceDTO[] }) {
  const map = useMap();
  const key = places.length > 0 ? places[0].id + places.length : "";
  const fitted = useRef("");
  useEffect(() => {
    if (!key || fitted.current === key) return;
    fitted.current = key;
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [key, map, places]);
  return null;
}

/** Centre la carte sur la sélection, décalée pour ne pas tomber sous le panneau de détail. */
function FlyToSelected({ selected, rightInset }: { selected: PlaceDTO | null; rightInset: number }) {
  const map = useMap();
  const pending = useRef<PlaceDTO | null>(null);
  const flyTo = (p: PlaceDTO, animate: boolean) => {
    const zoom = Math.max(map.getZoom(), 17);
    const point = map.project([p.lat, p.lon], zoom).add([rightInset / 2, 0]);
    const target = map.unproject(point, zoom);
    if (animate) map.flyTo(target, zoom, { duration: 0.6 });
    else map.setView(target, zoom, { animate: false });
  };

  useEffect(() => {
    if (!selected) {
      pending.current = null;
      return;
    }
    // Carte masquée (vue « liste » sur mobile) : sa taille est nulle, on recentre à l'affichage.
    if (map.getSize().x === 0) pending.current = selected;
    else flyTo(selected, true);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (pending.current && map.getSize().x > 0) {
        const p = pending.current;
        pending.current = null;
        flyTo(p, false);
      }
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Recalcule la taille de la carte quand son conteneur change (redimensionnement de la grille). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function ProspectMap({ places, selected, onSelect, rightInset }: ProspectMapProps) {
  return (
    <MapContainer center={ROUEN} zoom={13} preferCanvas className="h-full w-full" zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">contributeurs OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <AutoResize />
      <FitToPlaces places={places} />
      <FlyToSelected selected={selected} rightInset={rightInset} />
      <MarkerLayer places={places} onSelect={onSelect} />
      {selected && (
        <CircleMarker
          key={`sel-${selected.id}-${selected.siteClass}`}
          center={[selected.lat, selected.lon]}
          radius={10}
          pathOptions={{
            color: colors.foreground,
            weight: 3,
            fillColor: SITE_CLASS_COLORS[selected.siteClass],
            fillOpacity: 1,
          }}
          eventHandlers={{ click: () => onSelect(selected.id) }}
        />
      )}
    </MapContainer>
  );
}
