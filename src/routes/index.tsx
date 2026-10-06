import { createFileRoute } from "@tanstack/react-router";
import { LedPlanner } from "@/components/led/LedPlanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MANSSO PIXEL — LED Planner" },
      { name: "description", content: "Calculá, diseñá y documentá pantallas LED planas, curvas y cilindros. Planos en PNG/PDF y mapeo de slices para Resolume." },
      { property: "og:title", content: "MANSSO PIXEL — LED Planner" },
      { property: "og:description", content: "Planificador de pantallas LED de MANSSO TIP. Una herramienta de Start Solution." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LedPlanner,
});
