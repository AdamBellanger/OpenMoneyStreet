"use client";

import { useMemo, useState } from "react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import type { PlaceDTO, SiteDisplayClass } from "@/lib/domain";

export const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { equals: filterFn_equals, includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

/** Ordre de tri du classement : les meilleurs prospects d'abord. */
const SITE_RANK: Record<SiteDisplayClass, number> = {
  pas_de_site: 0,
  site_casse: 1,
  site_obsolete: 2,
  non_verifie: 3,
  site_ok: 4,
};

const helper = createColumnHelper<typeof features, PlaceDTO>();

export const columns = helper.columns([
  helper.accessor("name", { id: "name", header: "Commerce", sortFn: "alphanumeric" }),
  helper.accessor("category", { id: "category", header: "Catégorie", filterFn: "equals", sortFn: "alphanumeric" }),
  helper.accessor((p) => p.quartier ?? "", { id: "quartier", header: "Quartier", filterFn: "equals", sortFn: "alphanumeric" }),
  helper.accessor("address", { id: "address", header: "Adresse", enableSorting: false }),
  helper.accessor("siteClass", {
    id: "siteClass",
    header: "Site",
    filterFn: "equals",
    enableGlobalFilter: false,
    sortFn: (a, b) => SITE_RANK[a.original.siteClass] - SITE_RANK[b.original.siteClass],
  }),
  helper.accessor((p) => p.crm.status, { id: "crm", header: "Statut", filterFn: "equals", enableGlobalFilter: false }),
  helper.accessor((p) => p.phone ?? "", { id: "phone", header: "Téléphone", enableSorting: false }),
  helper.accessor((p) => p.crm.followUp ?? "", {
    id: "followUp",
    header: "Relance",
    sortFn: "basic",
    enableGlobalFilter: false,
    sortUndefined: "last",
  }),
]);

export interface Filters {
  q: string;
  category: string;
  quartier: string;
  siteClass: string;
  crm: string;
}

export const EMPTY_FILTERS: Filters = { q: "", category: "", quartier: "", siteClass: "", crm: "" };

const EMPTY: PlaceDTO[] = [];

export function useProspectTable(places: PlaceDTO[] | undefined, filters: Filters) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "siteClass", desc: false }]);

  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      (["category", "quartier", "siteClass", "crm"] as const)
        .filter((k) => filters[k] !== "")
        .map((k) => ({ id: k, value: filters[k] })),
    [filters],
  );

  return useTable({
    features,
    columns,
    data: places ?? EMPTY,
    getRowId: (row) => row.id,
    state: { sorting, columnFilters, globalFilter: filters.q },
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
  });
}

export type ProspectTable = ReturnType<typeof useProspectTable>;
