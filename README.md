# MANSSO PIXEL — LED Planner

Herramienta de MANSSO TIP para calcular, diseñar y documentar pantallas LED. Desarrollada por [Start Solution](https://startsolution.com.ar/).

## Funciones
- Catálogo genérico editable (`src/lib/led/catalog.ts`) + paneles personalizados (localStorage, importar/exportar JSON).
- Modo Simple y Pro sobre el mismo proyecto y motor de cálculo.
- Pantallas planas, cóncavas, convexas, arcos y cilindros (facetados o continuos).
- Mezcla 500×500 / 500×1000 con stock, objetivos y dividir/unir gabinetes.
- Editor 2D multi-pantalla (arrastrar, zoom, grilla, alinear, duplicar, deshacer/rehacer).
- Exportes locales: PNG, PDF (A4/A3), JSON de proyecto, CSV/JSON de slices, XML de Resolume basado en plantilla.

## Módulos
| Módulo | Archivo |
|---|---|
| Catálogo | `src/lib/led/catalog.ts` |
| Modelo del proyecto | `src/lib/led/model.ts` |
| Motor de cálculo | `src/lib/led/engine.ts` |
| Geometría plana/curva | `src/lib/led/geometry.ts` |
| Algoritmo de mezcla | `src/lib/led/mix.ts` |
| Planos (primitivas vectoriales) | `src/lib/led/plan.ts` |
| Canvas / slices | `src/lib/led/mapping.ts` |
| Resolume XML | `src/lib/led/resolume.ts` |
| Exportadores | `src/lib/led/exporters.ts` |
| Persistencia | `src/lib/led/persistence.ts`, `store.ts` |
| Editor visual | `src/components/led/*` |

## Desarrollo
```sh
bun install
bun run dev
bunx vitest run   # pruebas del motor, mezcla, geometría y coordenadas
bun run build
```

## Despliegue
No requiere backend ni secretos. Ningún dominio se configura automáticamente.

- **Subdominio** (`herramientas.startsolution.com.ar`): compilar normal (`bun run build`) y apuntar el subdominio (CNAME/registros indicados por el hosting) al sitio publicado. En Lovable: Project Settings › Domains.
- **Subruta** (`startsolution.com.ar/herramientas/led-planner`): compilar con `BASE_PATH=/herramientas/led-planner/ bun run build`. El router usa `import.meta.env.BASE_URL` como basepath. El servidor principal debe redirigir (proxy inverso) esa ruta a la app.

## Resolume Arena
El XML **no se inventa**: se requiere importar un preset real de Advanced Output exportado por tu versión de Arena. La app clona el `<Slice>` de la plantilla y actualiza nombre e `InputRect`/`OutputRect` cuando su estructura (4 vértices `<v x y>`) es reconocible. Estado: validación automática de estructura; **no verificado abriéndolo en Arena**. Sin plantilla, usar CSV/JSON.

## Pendientes / limitaciones
- Prueba real de apertura del XML en Arena (requiere preset de la versión objetivo).
- Modelos de marca: cargar sólo con datos de fichas oficiales.
- Vista 3D esquemática no implementada (hay vistas desarrollada y superior).
- Interfaz sólo en español (estructura lista para sumar inglés).
