"use client";

import type { CrmStatus, FollowUpDTO, PlaceDTO, SearchResponse } from "./domain";
import { placeSlug } from "./domain";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    // Session expirée : rechargement complet vers la connexion (vide aussi le cache client).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new ApiError("Session expirée", 401);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Erreur ${res.status}`, res.status);
  return data as T;
}

export const searchKey = (city: string) => ["search", city.trim().toLowerCase()] as const;

export const fetchSearch = (city: string, refresh = false) =>
  api<SearchResponse>(`/api/search?city=${encodeURIComponent(city)}${refresh ? "&refresh=1" : ""}`);

export const checkSite = (id: string) => api<PlaceDTO>("/api/check-site", { method: "POST", body: JSON.stringify({ id }) });

export const updateCrm = (id: string, patch: { status?: CrmStatus; notes?: string; followUp?: string | null }) =>
  api<PlaceDTO>(`/api/places/${placeSlug(id)}/crm`, { method: "PATCH", body: JSON.stringify(patch) });

export const fetchFollowUps = () => api<{ date: string; places: FollowUpDTO[] }>("/api/relances");

export interface PanoramaxPhoto {
  id: string;
  thumb: string;
  hd: string | null;
  date: string | null;
  distance: number;
  viewerUrl: string;
}
export const fetchPanoramax = (lat: number, lon: number) =>
  api<{ photo: PanoramaxPhoto | null }>(`/api/panoramax?lat=${lat}&lon=${lon}`);

export const clientJsonUrl = (id: string) => `/api/places/${placeSlug(id)}/client-json`;

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
