"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/styles/design-tokens";

type Tag = "h1" | "h2" | "p";

/** Révélation mot par mot (port de Portfolio2026). Réservée à l'écran de connexion. */
export function SplitText({
  text,
  as: Tag = "h1",
  className,
  delay = 0.3,
}: {
  text: string;
  as?: Tag;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <Tag className={className}>{text}</Tag>;

  return (
    <Tag className={className} aria-label={text}>
      {text.split(" ").map((word, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: duration.split, ease: ease.out, delay: delay + i * duration.splitStagger }}
          >
            {word}{" "}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
