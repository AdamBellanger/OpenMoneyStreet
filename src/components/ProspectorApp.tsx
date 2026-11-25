"use client";

import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PlaceDetail } from "@/components/detail/PlaceDetail";
import { MapPanel } from "@/components/map/MapPanel";
import { ProspectTable } from "@/components/table/ProspectTable";
import { Toolbar } from "@/components/table/Toolbar";
import { EMPTY_FILTERS, useProspectTable, type Filters } from "@/components/table/useProspectTable";
import { checkSite, fetchSearch, searchKey } from "@/lib/api-client";
import { downloadText, placesToCsv } from "@/lib/csv";
import type { PlaceDTO, SearchResponse } from "@/lib/domain";

const LAST_CITY = "prospecteur:lastCity";
const BATCH_CONCURRENCY = 4;
const BTN =
  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-foreground/15 px-4 text-xs transition-colors duration-150 hover:border-foreground/40 hover:bg-foreground/5 disabled:opacity-50";

function ago(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
}

export function ProspectorApp() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const city = params.get("city") ?? "";
  const [input, setInput] = useState(city);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("place"));
  const [refreshing, setRefreshing] = useState(false);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const stopBatch = useRef(false);

  // Le champ suit la ville de l'URL (navigation, lien depuis les relances).
  const [prevCity, setPrevCity] = useState(city);
  if (city !== prevCity) {
    setPrevCity(city);
    setInput(city);
  }

  // Dernière ville utilisée si l'URL n'en donne pas.
  useEffect(() => {
    if (city) {
      localStorage.setItem(LAST_CITY, city);
      return;
    }
    const last = localStorage.getItem(LAST_CITY);
    if (last) router.replace(`${pathname}?city=${encodeURIComponent(last)}`);
  }, [city, pathname, router]);

  const search = useQuery({
    queryKey: searchKey(city),
    queryFn: () => fetchSearch(city),
    enabled: city.length > 0,
    staleTime: 5 * 60_000,
  });
  const places = search.data?.places;

  const table = useProspectTable(places, filters);
  const visible = table.getRowModel().rows.map((r) => r.original);
  const visibleKey = visible.map((p) => p.id).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mapPlaces = useMemo(() => visible, [visibleKey, places]);
  const selected = useMemo(() => places?.find((p) => p.id === selectedId) ?? null, [places, selectedId]);

  const onSelect = useCallback((id: string) => setSelectedId((cur) => (cur === id ? cur : id)), []);

  const updatePlace = useCallback(
    (p: PlaceDTO) => {
      queryClient.setQueryData<SearchResponse>(searchKey(city), (old) =>
        old ? { ...old, places: old.places.map((x) => (x.id === p.id ? p : x)) } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["relances"] });
    },
    [city, queryClient],
  );

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = input.trim();
    if (!next) return;
    setSelectedId(null);
    setFilters(EMPTY_FILTERS);
    router.replace(`${pathname}?city=${encodeURIComponent(next)}`);
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      queryClient.setQueryData(searchKey(city), await fetchSearch(city, true));
    } finally {
      setRefreshing(false);
    }
  }

  /** Vérifie tous les sites "non vérifiés" visibles, 4 à la fois. */
  async function runBatch() {
    const queue = visible.filter((p) => p.siteClass === "non_verifie").map((p) => p.id);
    if (queue.length === 0) return;
    stopBatch.current = false;
    let done = 0;
    setBatch({ done, total: queue.length });
    const worker = async () => {
      while (queue.length > 0 && !stopBatch.current) {
        const id = queue.shift()!;
        try {
          updatePlace(await checkSite(id));
        } catch {
          /* une erreur réseau n'arrête pas la file */
        }
        setBatch({ done: ++done, total: done + queue.length });
      }
    };
    await Promise.all(Array.from({ length: BATCH_CONCURRENCY }, worker));
    setBatch(null);
  }

  const unchecked = visible.filter((p) => p.siteClass === "non_verifie").length;

  return (
    <div className="flex h-screen flex-col">
      <AppHeader>
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ville (ex. Rouen)"
            aria-label="Ville"
            className="h-10 w-48 rounded-full border border-foreground/15 bg-background px-4 text-sm outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
          />
          <button type="submit" className="h-10 rounded-full bg-accent px-5 text-sm text-background transition-opacity duration-150 hover:opacity-90">
            Chercher
          </button>
        </form>
        {search.data && (
          <p className="hidden items-center gap-3 truncate font-mono text-[11px] uppercase tracking-widest text-muted md:flex">
            <span>{search.data.places.length} commerces</span>
            <span aria-hidden>·</span>
            <span>OSM {ago(search.data.fetchedAt)}</span>
            {search.data.areaCount > 1 && <span className="text-[var(--status-site-obsolete)]">{search.data.areaCount} communes homonymes</span>}
            <button type="button" onClick={onRefresh} disabled={refreshing} className="uppercase transition-colors duration-150 hover:text-foreground">
              {refreshing ? "Actualisation…" : "Actualiser"}
            </button>
          </p>
        )}
      </AppHeader>

      {!city ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Pour commencer</p>
          <p className="font-display text-4xl">Cherchez une ville.</p>
        </div>
      ) : search.isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
          <p className="font-display text-3xl">Interrogation d&apos;OpenStreetMap…</p>
          <p className="text-sm text-muted">Jusqu&apos;à une minute pour une grande ville, puis 24 h de cache.</p>
        </div>
      ) : search.isError ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="max-w-lg text-sm text-[var(--status-pas-de-site)]">{(search.error as Error).message}</p>
        </div>
      ) : (
        <main className="grid min-h-0 flex-1 grid-rows-[1fr_1fr] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-1">
          <section className="flex min-h-0 flex-col border-foreground/10 lg:border-r">
            <Toolbar
              places={places ?? []}
              filters={filters}
              onChange={setFilters}
              shown={visible.length}
              actions={
                <>
                  {batch ? (
                    <button type="button" className={BTN} onClick={() => (stopBatch.current = true)}>
                      Vérification {batch.done}/{batch.total} · Arrêter
                    </button>
                  ) : (
                    <button type="button" className={BTN} disabled={unchecked === 0} onClick={runBatch}>
                      Vérifier les sites ({unchecked})
                    </button>
                  )}
                  <button
                    type="button"
                    className={BTN}
                    disabled={visible.length === 0}
                    onClick={() => downloadText(placesToCsv(visible), `prospects-${city.toLowerCase().replace(/\s+/g, "-")}.csv`)}
                  >
                    Export CSV
                  </button>
                </>
              }
            />
            <div className="min-h-0 flex-1">
              <ProspectTable table={table} selectedId={selectedId} onSelect={onSelect} />
            </div>
          </section>
          <section className="relative min-h-0">
            <MapPanel places={mapPlaces} selected={selected} onSelect={onSelect} rightInset={selected ? 430 : 0} />
            <AnimatePresence>
              {selected && (
                <PlaceDetail key={selected.id} place={selected} onClose={() => setSelectedId(null)} onUpdated={updatePlace} />
              )}
            </AnimatePresence>
          </section>
        </main>
      )}
    </div>
  );
}
