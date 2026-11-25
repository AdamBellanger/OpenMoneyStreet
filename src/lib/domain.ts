// Types et constantes partagés client / serveur (aucune dépendance serveur ici).
import { crm as crmTokens, status as statusTokens } from "../styles/design-tokens";

export const SITE_CLASSES = ["pas_de_site", "site_casse", "site_obsolete", "site_ok"] as const;
export type SiteClass = (typeof SITE_CLASSES)[number];
/** Classement affiché : un commerce avec un tag website pas encore vérifié est "non vérifié". */
export type SiteDisplayClass = SiteClass | "non_verifie";

export const SITE_CLASS_LABELS: Record<SiteDisplayClass, string> = {
  pas_de_site: "Pas de site",
  site_casse: "Site cassé",
  site_obsolete: "Site obsolète",
  site_ok: "Site OK",
  non_verifie: "Non vérifié",
};

/** Couleurs des marqueurs et pastilles : dérivées de la palette (voir design-tokens.ts). */
export const SITE_CLASS_COLORS: Record<SiteDisplayClass, string> = statusTokens;

export const CRM_STATUSES = ["a_contacter", "maquette_faite", "visite", "signe", "refus"] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  a_contacter: "À contacter",
  maquette_faite: "Maquette faite",
  visite: "Visité",
  signe: "Signé",
  refus: "Refus",
};

export const CRM_STATUS_COLORS: Record<CrmStatus, string> = crmTokens;

/** Statuts pour lesquels une relance n'a plus de sens. */
export const CLOSED_STATUSES: CrmStatus[] = ["signe", "refus"];

export interface SiteCheckDTO {
  classification: SiteClass;
  checkedAt: number;
  url: string | null;
  finalUrl: string | null;
  httpStatus: number | null;
  reachable: boolean;
  https: boolean | null;
  hasViewport: boolean | null;
  lastModified: string | null;
  copyrightYear: number | null;
  reasons: string | null;
  error: string | null;
}

export interface CrmDTO {
  status: CrmStatus;
  notes: string;
  followUp: string | null;
  updatedAt: number | null;
}

export interface PlaceDTO {
  id: string;
  name: string;
  categoryKey: string;
  categoryValue: string;
  category: string;
  lat: number;
  lon: number;
  address: string;
  quartier: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  openingHours: string | null;
  siteClass: SiteDisplayClass;
  site: SiteCheckDTO | null;
  crm: CrmDTO;
}

export interface SearchResponse {
  city: string;
  cityKey: string;
  fetchedAt: number;
  fromCache: boolean;
  areaCount: number;
  places: PlaceDTO[];
}

export function normalizeCityKey(city: string): string {
  return city.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

// Libellés français des valeurs OSM les plus courantes ; sinon on affiche la valeur brute.
const CATEGORY_LABELS: Record<string, string> = {
  "amenity=restaurant": "Restaurant",
  "amenity=cafe": "Café",
  "amenity=bar": "Bar",
  "amenity=hairdresser": "Coiffeur",
  "amenity=beauty": "Institut de beauté",
  "shop=bakery": "Boulangerie",
  "shop=pastry": "Pâtisserie",
  "shop=butcher": "Boucherie",
  "shop=cheese": "Fromagerie",
  "shop=deli": "Épicerie fine",
  "shop=convenience": "Supérette",
  "shop=supermarket": "Supermarché",
  "shop=greengrocer": "Primeur",
  "shop=seafood": "Poissonnerie",
  "shop=wine": "Caviste",
  "shop=alcohol": "Caviste",
  "shop=chocolate": "Chocolatier",
  "shop=confectionery": "Confiserie",
  "shop=coffee": "Torréfacteur / café",
  "shop=tea": "Thé",
  "shop=hairdresser": "Coiffeur",
  "shop=beauty": "Institut de beauté",
  "shop=cosmetics": "Cosmétiques",
  "shop=perfumery": "Parfumerie",
  "shop=massage": "Massage",
  "shop=tattoo": "Tatoueur",
  "shop=clothes": "Vêtements",
  "shop=shoes": "Chaussures",
  "shop=jewelry": "Bijouterie",
  "shop=optician": "Opticien",
  "shop=florist": "Fleuriste",
  "shop=garden_centre": "Jardinerie",
  "shop=books": "Librairie",
  "shop=newsagent": "Presse",
  "shop=tobacco": "Tabac",
  "shop=stationery": "Papeterie",
  "shop=gift": "Cadeaux",
  "shop=toys": "Jouets",
  "shop=sports": "Sport",
  "shop=bicycle": "Vélos",
  "shop=car_repair": "Garage",
  "shop=car": "Concession auto",
  "shop=car_parts": "Pièces auto",
  "shop=motorcycle": "Moto",
  "shop=hardware": "Quincaillerie",
  "shop=doityourself": "Bricolage",
  "shop=furniture": "Meubles",
  "shop=interior_decoration": "Décoration",
  "shop=kitchen": "Cuisines",
  "shop=bed": "Literie",
  "shop=electronics": "Électronique",
  "shop=mobile_phone": "Téléphonie",
  "shop=computer": "Informatique",
  "shop=copyshop": "Reprographie",
  "shop=photo": "Photo",
  "shop=dry_cleaning": "Pressing",
  "shop=laundry": "Laverie",
  "shop=pet": "Animalerie",
  "shop=pet_grooming": "Toilettage",
  "shop=travel_agency": "Agence de voyage",
  "shop=estate_agent": "Agence immobilière",
  "shop=funeral_directors": "Pompes funèbres",
  "shop=second_hand": "Dépôt-vente",
  "shop=antiques": "Antiquités",
  "shop=art": "Galerie / art",
  "shop=music": "Musique",
  "shop=musical_instrument": "Instruments de musique",
  "shop=frame": "Encadrement",
  "shop=locksmith": "Serrurier",
  "shop=tailor": "Retouches",
  "shop=fabric": "Tissus",
  "shop=bag": "Maroquinerie",
  "shop=e-cigarette": "Cigarette électronique",
  "shop=hearing_aids": "Audioprothésiste",
  "shop=medical_supply": "Matériel médical",
  "shop=variety_store": "Bazar",
  "shop=hifi": "Hi-fi",
  "shop=outdoor": "Plein air",
  "shop=games": "Jeux",
  "shop=video_games": "Jeux vidéo",
  "shop=lottery": "Loterie",
  "shop=farm": "Produits de la ferme",
  "shop=organic": "Bio",
  "shop=health_food": "Diététique",
  "shop=craft": "Loisirs créatifs",
  "craft=plumber": "Plombier",
  "craft=electrician": "Électricien",
  "craft=carpenter": "Menuisier",
  "craft=joiner": "Menuisier",
  "craft=painter": "Peintre",
  "craft=roofer": "Couvreur",
  "craft=locksmith": "Serrurier",
  "craft=hvac": "Chauffagiste",
  "craft=builder": "Maçon",
  "craft=stonemason": "Tailleur de pierre",
  "craft=tiler": "Carreleur",
  "craft=glaziery": "Vitrier",
  "craft=gardener": "Paysagiste",
  "craft=shoemaker": "Cordonnier",
  "craft=tailor": "Tailleur",
  "craft=dressmaker": "Couturière",
  "craft=upholsterer": "Tapissier",
  "craft=jeweller": "Bijoutier",
  "craft=watchmaker": "Horloger",
  "craft=photographer": "Photographe",
  "craft=printer": "Imprimeur",
  "craft=bakery": "Boulanger",
  "craft=confectionery": "Confiseur",
  "craft=caterer": "Traiteur",
  "craft=brewery": "Brasserie artisanale",
  "craft=winery": "Vigneron",
  "craft=key_cutter": "Reproduction de clés",
  "craft=sawmill": "Scierie",
  "craft=metal_construction": "Métallier",
  "craft=blacksmith": "Forgeron",
  "craft=window_construction": "Menuiserie fenêtres",
  "craft=floorer": "Poseur de sols",
  "craft=plasterer": "Plâtrier",
  "craft=scaffolder": "Échafaudeur",
  "craft=sculptor": "Sculpteur",
  "craft=pottery": "Potier",
  "craft=bookbinder": "Relieur",
  "craft=optician": "Opticien",
  "craft=hairdresser": "Coiffeur",
  "craft=beekeeper": "Apiculteur",
  "craft=cleaning": "Nettoyage",
  "craft=electronics_repair": "Réparation électronique",
  "craft=handicraft": "Artisanat",
};

export function categoryLabel(key: string, value: string): string {
  return CATEGORY_LABELS[`${key}=${value}`] ?? `${value.replace(/_/g, " ")} (${key})`;
}

/** "node/123" <-> "node-123" pour les segments d'URL (/api/places/[id]/…). */
export const placeSlug = (id: string) => id.replace("/", "-");
export const placeIdFromSlug = (slug: string) => slug.replace("-", "/");
export const isValidPlaceId = (id: string) => /^(node|way|relation)\/\d+$/.test(id);

/** Date du jour au format AAAA-MM-JJ, fuseau Europe/Paris. */
export function todayParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

export interface FollowUpDTO extends PlaceDTO {
  cityName: string;
}
