import { lazy, Suspense, useEffect, useState } from "react";
import { Card } from "./ui";

const Scene3D = lazy(() => import("./Scene3D"));

export function View3DCard({ selected, dark }: { selected?: string; dark: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <Card title="Vista 3D">
      <div className="aspect-[16/9] w-full touch-none overscroll-contain overflow-hidden rounded-md border border-border bg-muted">
        {ready && <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted-foreground">Cargando vista 3D…</div>}><Scene3D selected={selected} dark={dark} /></Suspense>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Arrastrá para girar, rueda para acercar, clic derecho para desplazar. Esquema sin escala estructural: curvas y cilindros se dibujan con el radio calculado; compatibilidad mecánica pendiente de confirmar.</p>
    </Card>
  );
}
