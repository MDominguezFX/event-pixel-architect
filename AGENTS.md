<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Footer logos embed the original PNG bytes as data URLs in a browser-safe source module so Worker deployments include them without host-specific asset endpoints.
- All LED logic lives in src/lib/led/* as pure modules (catalog, model, engine, geometry, mix, plan, mapping, resolume, exporters, persistence); UI in src/components/led/* only consumes them — keeps calculations testable and shared across plan, PNG, PDF and exports.
- One Project model drives everything; plans are vector primitives (plan.ts) rendered by SVG, canvas and jsPDF — guarantees exports match the model.
- Fully client-side with localStorage; no backend — tool must work without login.
- Resolume XML prefers cloning a user-imported real preset; without one, generateArenaXml emits the known Arena 7 Advanced Output structure labelled unverified — user requested direct export, template path stays the trustworthy option.
- Subpath deploys use BASE_PATH env -> vite base + router basepath — supports subdomain or subroute hosting.
- The scene editor uses d3-zoom as the single viewport transform authority for wheel, background pan, touch pinch, fit and zoom buttons — prevents divergent transforms and keeps cursor anchoring consistent.
- Data cable planning optimizes serpentine routes over edge-adjacent whole cabinets and generates orthogonal paths through shared edges; wiring vector plans color cabinets per data port (portColor) — capacity and non-diagonal paths stay consistent in UI, PNG and PDF.
- PDF export is section-driven (PdfOpts.sections + screenIds) chosen in an export dialog — avoids dumping every page by default.
- Free-angle rotation is schematic: Cabinet.angleDeg and Slice.rotation (degrees, about the box center) never change native pixels; 90° cabinet turns still use the rotated flag so resolution swaps stay exact.
- The 3D view is derived by the pure scene3d module from the same Project (curves wrap the developed view on the radius from geometry.ts) and is lazy-loaded client-only — three.js never runs during SSR.
- The 2D scene projects scene3d boxes with whole-screen signed X tilt then Y yaw; Three renders the same nested transforms. Developed views use independent developedX/Y with side-by-side defaults — spatial rotations and placement never collapse the native unfolded layout.
- Spatial positioning uses Screen.x, Screen.z (mm) and mountHeightM (base height in metres) for every mount; legacy y supplies a default height only. Scene editing projects vertical or ground-plane drags through moveSceneScreen, with no shared floor renormalization — each screen moves independently, and scene2d applies the same Z/Y/X rotations as Three.js.
- The 3D camera translates with the scene centre and scales its existing offset with scene extent when placement changes — preserves orbit/zoom while keeping freely positioned screens visible.
- Screen.manualRuns (ids de gabinetes por puerto, en orden) hace que cableRuns respete el cableado dibujado por el usuario: valida 650.000 px como error y continuidad por arista como aviso.
