"use client";

import { motion } from "framer-motion";
import {
  CRM_STATUS_COLORS,
  CRM_STATUS_LABELS,
  SITE_CLASS_COLORS,
  SITE_CLASS_LABELS,
  type CrmStatus,
  type SiteDisplayClass,
} from "@/lib/domain";
import { duration, ease } from "@/styles/design-tokens";

/** Point de couleur + libellé du classement du site. */
export function SiteBadge({ value }: { value: SiteDisplayClass }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs" style={{ color: SITE_CLASS_COLORS[value] }}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SITE_CLASS_COLORS[value] }} />
      {SITE_CLASS_LABELS[value]}
    </span>
  );
}

/** Pastille de statut CRM. La couleur change en fondu, avec un léger pulse (< 250 ms). */
export function CrmChip({ value }: { value: CrmStatus }) {
  const color = CRM_STATUS_COLORS[value];
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.92, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18, ease: ease.out }}
      className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        transitionDuration: `${duration.ui}s`,
      }}
    >
      {CRM_STATUS_LABELS[value]}
    </motion.span>
  );
}
