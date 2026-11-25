"use client";

import type { PointerEvent } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { spring } from "@/styles/design-tokens";

/** Attire un élément vers la souris au survol (port de Portfolio2026, souris uniquement). */
export function useMagnetic(strength = 0.35) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, spring.magnetic);
  const springY = useSpring(y, spring.magnetic);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reducedMotion || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  };
  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return { style: { x: springX, y: springY }, onPointerMove, onPointerLeave };
}
