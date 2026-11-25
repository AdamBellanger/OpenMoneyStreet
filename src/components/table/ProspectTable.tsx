"use client";

import { memo, useEffect } from "react";
import { placeSlug, type PlaceDTO } from "@/lib/domain";
import { CrmChip, SiteBadge } from "@/components/ui/Status";
import type { ProspectTable as Table } from "./useProspectTable";

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
      className={`group relative border-b border-foreground/5 transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selected ? "bg-accent/15" : "hover:bg-foreground/5"
      }`}
    >
      <td className="relative py-2.5 pl-6 pr-3 sm:pl-10">
        {/* Barre d'accent de la ligne sélectionnée */}
        <span
          aria-hidden
          className={`absolute inset-y-1 left-0 w-1 rounded-r-full bg-accent transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            selected ? "scale-y-100" : "scale-y-0"
          }`}
        />
        <div className="max-w-[16rem] truncate text-sm">{place.name}</div>
        <div className="truncate text-xs text-muted">{place.category}</div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted">{place.quartier ?? "—"}</td>
      <td className="hidden max-w-[14rem] truncate px-3 py-2.5 text-xs text-muted xl:table-cell">{place.address || "—"}</td>
      <td className="px-3 py-2.5">
        <SiteBadge value={place.siteClass} />
      </td>
      <td className="px-3 py-2.5">
        <CrmChip value={place.crm.status} />
      </td>
      <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-xs 2xl:table-cell">{place.phone ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 pr-6 font-mono text-xs text-muted sm:pr-10">
        {place.crm.followUp ? new Date(place.crm.followUp).toLocaleDateString("fr-FR") : "—"}
      </td>
    </tr>
  );
});

const HEADER_CLASS: Record<string, string> = {
  name: "pl-6 sm:pl-10",
  address: "hidden xl:table-cell",
  phone: "hidden 2xl:table-cell",
  followUp: "pr-6 sm:pr-10",
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

  // Sélection depuis la carte : on amène la ligne dans la zone visible (scroll natif).
  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`row-${placeSlug(selectedId)}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="scroll-thin h-full overflow-auto">
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
          {rows.map((row) => (
            <Row key={row.id} place={row.original} selected={row.id === selectedId} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-6 py-16 text-center text-sm text-muted sm:px-10">Aucun commerce ne correspond aux filtres.</p>
      )}
    </div>
  );
}
