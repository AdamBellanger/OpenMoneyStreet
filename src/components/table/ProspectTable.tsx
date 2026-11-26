"use client";

import { memo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { placeSlug, type PlaceDTO } from "@/lib/domain";
import { CrmChip, SiteBadge } from "@/components/ui/Status";
import type { ProspectTable as Table } from "./useProspectTable";

/** Hauteur fixe d une ligne : indispensable à la virtualisation (seules ~30 lignes sont dans le DOM). */
const ROW_HEIGHT = 57;

const Row = memo(function Row({
  place,
  selected,
  onSelect,
}: {
  place: PlaceDTO;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <tr
      id={`row-${placeSlug(place.id)}`}
      data-row
      aria-selected={selected}
      onClick={() => onSelect(place.id)}
      style={{ height: ROW_HEIGHT }}
      className={`group relative border-b border-foreground/5 transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selected ? "bg-accent/15" : "hover:bg-foreground/5"
      }`}
    >
      <td className="relative py-2.5 pl-4 pr-3 sm:pl-10">
        {/* Barre d'accent de la ligne sélectionnée */}
        <span
          aria-hidden
          className={`absolute inset-y-1 left-0 w-1 rounded-r-full bg-accent transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            selected ? "scale-y-100" : "scale-y-0"
          }`}
        />
        <div className="max-w-[7.5rem] truncate text-sm sm:max-w-[20rem]">{place.name}</div>
        <div className="max-w-[7.5rem] truncate text-xs text-muted sm:max-w-[20rem]">
          {place.category}
          {place.address ? ` · ${place.address}` : ""}
          <span className="2xl:hidden">{place.quartier ? ` · ${place.quartier}` : ""}</span>
        </div>
      </td>
      <td className="hidden max-w-[10rem] truncate px-3 py-2.5 text-xs text-muted 2xl:table-cell" title={place.quartier ?? undefined}>
        {place.quartier ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        <SiteBadge value={place.siteClass} />
      </td>
      <td className="px-3 py-2.5">
        <CrmChip value={place.crm.status} />
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 pr-6 font-mono text-xs text-muted sm:pr-10 md:table-cell">
        {place.crm.followUp ? new Date(place.crm.followUp).toLocaleDateString("fr-FR") : "—"}
      </td>
    </tr>
  );
});

const HEADER_CLASS: Record<string, string> = {
  name: "pl-4 sm:pl-10",
  // La catégorie s'affiche sous le nom : la colonne sert au filtre, pas à l'affichage.
  category: "hidden",
  quartier: "hidden 2xl:table-cell",
  // L'adresse s'affiche sous le nom (et reste dans la recherche texte).
  address: "hidden",
  // Téléphone : dans le panneau de détail, la recherche texte et le CSV.
  phone: "hidden",
  followUp: "hidden pr-6 sm:pr-10 md:table-cell",
};

export function ProspectTable({
  table,
  selectedId,
  onSelect,
}: {
  table: Table;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- le compilateur React n est pas activé
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollPaddingStart: 44,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length > 0 ? items[0].start : 0;
  const padBottom = items.length > 0 ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  // Sélection depuis la carte : on amène la ligne dans la zone visible (scroll natif).
  useEffect(() => {
    if (!selectedId) return;
    const index = table.getRowModel().rows.findIndex((r) => r.id === selectedId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={scrollRef} className="scroll-thin h-full overflow-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-background">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b border-foreground/10">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className={`px-3 py-3 font-mono text-[11px] font-normal uppercase tracking-widest text-muted ${HEADER_CLASS[header.column.id] ?? ""}`}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 uppercase transition-colors duration-150 hover:text-foreground"
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden className={`text-accent transition-opacity duration-150 ${sorted ? "opacity-100" : "opacity-0"}`}>
                          {sorted === "desc" ? "↓" : "↑"}
                        </span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden style={{ height: padTop }}>
              <td colSpan={8} />
            </tr>
          )}
          {items.map((v) => {
            const row = rows[v.index];
            return <Row key={row.id} place={row.original} selected={row.id === selectedId} onSelect={onSelect} />;
          })}
          {padBottom > 0 && (
            <tr aria-hidden style={{ height: padBottom }}>
              <td colSpan={8} />
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-6 py-16 text-center text-sm text-muted sm:px-10">Aucun commerce ne correspond aux filtres.</p>
      )}
    </div>
  );
}
