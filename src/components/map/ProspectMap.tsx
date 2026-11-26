"use client";

import { memo, useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
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

/** Les marqueurs ne changent qu'avec la liste : la sélection est dessinée à part. */
const Markers = memo(function Markers({ places, onSelect }: { places: PlaceDTO[]; onSelect: (id: string) => void }) {
  return (
    <>
      {places.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{
            color: colors.background,
            weight: 1,
            fillColor: SITE_CLASS_COLORS[p.siteClass],
            fillOpacity: 0.95,
          }}
          eventHandlers={{ click: () => onSelect(p.id) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {p.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
});

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
      <Markers places={places} onSelect={onSelect} />
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
