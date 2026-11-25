import { Suspense } from "react";
import { ProspectorApp } from "@/components/ProspectorApp";

export default function HomePage() {
  return (
    <Suspense>
      <ProspectorApp />
    </Suspense>
  );
}
