"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { spring } from "@/styles/design-tokens";

type Mode = "default" | "link" | "label" | "hidden";

const SIZE: Record<Exclude<Mode, "hidden">, string> = {
  default: "h-3 w-3 rounded-full",
  link: "h-12 w-12 rounded-full",
  label: "h-24 w-24 rounded-full",
};

/**
 * Port du curseur de Portfolio2026 (mix-blend-difference, grossit sur les liens,
 * label sur [data-cursor]). Adaptation outil : il s'efface et laisse le curseur natif
 * au-dessus de la carte ([data-native-cursor]) et des champs de saisie.
 * Pointeurs fins uniquement, désactivé en reduced motion.
 */
export function CursorFollower() {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("default");
  const [label, setLabel] = useState("");
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);
  const current = useRef({ mode: "default" as Mode, label: "" });

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, spring.cursor);
  const springY = useSpring(y, spring.cursor);

  useEffect(() => {
    if (reducedMotion) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    document.documentElement.classList.add("cursor-none");

    const update = (nextMode: Mode, nextLabel = "") => {
      if (current.current.mode === nextMode && current.current.label === nextLabel) return;
      current.current = { mode: nextMode, label: nextLabel };
      setMode(nextMode);
      setLabel(nextLabel);
    };

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);

      const target = e.target as Element;
      if (target.closest("[data-native-cursor], input:not([type=hidden]), textarea, select")) {
        return update("hidden");
      }
      const labelled = target.closest<HTMLElement>("[data-cursor]");
      if (labelled) return update("label", labelled.dataset.cursor ?? "");
      const anchor = target.closest("a");
      if (anchor?.target === "_blank") return update("label", "↗");
      if (target.closest("a, button, [role=button], tr[data-row], label")) return update("link");
      update("default");
    };
    const handleDown = () => setPressed(true);
    const handleUp = () => setPressed(false);
    const handleLeave = () => setVisible(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerdown", handleDown);
    window.addEventListener("pointerup", handleUp);
    document.documentElement.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      document.documentElement.removeEventListener("pointerleave", handleLeave);
      document.documentElement.classList.remove("cursor-none");
    };
  }, [reducedMotion, x, y]);

  if (reducedMotion) return null;

  const hidden = mode === "hidden";
  const isLabel = mode === "label";
  const isArrow = isLabel && label === "↗";

  return (
    <motion.div
      aria-hidden="true"
      style={{ x: springX, y: springY }}
      className={`pointer-events-none fixed left-0 top-0 z-[100] ${isLabel ? "" : "mix-blend-difference"}`}
    >
      <div
        className={`flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden transition-[width,height,opacity,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isArrow ? "h-16 w-16 rounded-full" : SIZE[hidden ? "default" : mode]
        } ${isLabel ? "bg-accent text-background" : "bg-foreground"} ${visible && !hidden ? "opacity-100" : "opacity-0"} ${
          pressed ? "scale-75" : hidden ? "scale-50" : "scale-100"
        }`}
      >
        <span
          className={`whitespace-nowrap font-medium transition-opacity duration-150 ${isArrow ? "text-2xl" : "text-sm"} ${
            isLabel ? "opacity-100" : "opacity-0"
          }`}
        >
          {label}
        </span>
      </div>
    </motion.div>
  );
}
