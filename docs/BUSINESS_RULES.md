# Business Rules y Specs — Casa Alberto

Este documento centraliza los identificadores `BR-NNN` (Business Rule) y
`SPEC-NNN` (Spec funcional/técnica) que aparecen en comentarios del código.
Antes vivían dispersos sin un lugar donde consultarlos. Si añades nuevos,
documenta primero acá y luego referencia en el código.

**Convención**:

- `BR-NNN` — Regla de negocio derivada de los documentos de Fase 2
  (`docs/CasaAlberto_Fase2_Mapeo.md`) o decisiones explícitas del dueño.
  Cambian solo si cambia el negocio.
- `SPEC-NNN` — Especificación funcional o técnica derivada de Fase 3 v2
  (`docs/CasaAlberto_Fase3_v2.md`). Detallan **cómo** se manifiesta una
  regla en la UI/IPC.

Para detalles narrativos completos, ir al PDF de Fase 2 o Fase 3 v2.
Esto es solo el índice.

---

## Reglas de negocio (`BR-NNN`)

### BR-001 — Matriz de urgencia 2×2

Los pedidos activos se cruzan por dos ejes: **urgencia** (entrega en ≤2
días) y **abono** (con/sin pago registrado). El cuadrante crítico es
`urgente ∩ sin_abono` — papá los ve primero. Calculado en el backend por
`obtenerMatrizUrgencia()` para evitar drift entre vistas.

**Aparece en**: `src/main/db/queries/pedidos.ts`, `urgency-matrix.tsx`,
`use-matriz-urgencia.ts`.

### BR-002 — Medidas válidas 1–500 cm

Ancho y alto de un trabajo se aceptan en el rango [1, 500] cm. El backend
valida pero la UI también, para feedback inmediato. Fuera de rango se
rechaza con mensaje claro.

**Origen**: Fase 2 §A.1.

### BR-003 — Vidrio redondeado al múltiplo de 10 cm

Las medidas del vidrio se redondean **hacia arriba** al múltiplo de 10 cm
más cercano antes de calcular precio. Si papá pide 47×63, el vidrio se
cobra como 50×70. El preview en vivo del wizard muestra el redondeo
para que el cliente entienda el salto de precio.

**Origen**: Fase 2 §A.2.1.

### BR-007 — Paspartú: ancho máximo razonable

Validación de sanidad: el ancho del paspartú no puede ser más grande que
las medidas del marco (sería absurdo). Rechaza valores absurdamente
grandes que el dueño tipea por accidente.

### BR-009 — Reclasificación automática listo → sin_reclamar

Un pedido en estado `listo` que no se entrega en **15+ días** se reclasifica
automáticamente a `sin_reclamar` para que no contamine la lista de "Listos
para entrega". Tarea programada al boot de la app
(`reclasificarPedidos()`).

**Aparece en**: `src/main/index.ts`, `src/main/db/queries/pedidos.ts`.

### BR-010 — Precios de vidrio dinámicos

Los precios por m² del vidrio se leen siempre desde la tabla
`precios_vidrios`, no se hardcodean. Permite que papá actualice las
tarifas desde la UI sin tocar código.

### BR-012 — Pagos mensuales de clases auto-generados

Al iniciar un mes nuevo, el sistema genera registros de pago "pendiente"
para todos los estudiantes activos del mes. Papá solo registra los
pagos cuando llegan, no tiene que crear el registro desde cero.

**Origen**: Fase 2 §D.2.
**Aparece en**: `src/main/db/queries/clases.ts`, `src/main/index.ts`.

---

## Specs funcionales (`SPEC-NNN`)

### SPEC-001 — Auto-guardado del wizard del cotizador

El wizard de cotización guarda un draft cada 30 segundos. Si papá cierra
la app a mitad o se reinicia, al reabrir vuelve al mismo paso con los
mismos datos. Indicador visual ("Guardado / Guardando…") en la UI.

**Origen**: Fase 3 v2 §7.2.
**Aparece en**: `wizard-shell.tsx`, `use-auto-save.ts`.

### SPEC-005 — Drag & drop entre columnas del kanban

Mover un pedido entre columnas del kanban actualiza su estado. El estado
del drag activo (ID + columna origen) se mantiene en el `KanbanBoard`
para resaltar visualmente las columnas a las que la transición es válida.

**Aparece en**: `kanban-board.tsx`, `kanban-column.tsx`.

### SPEC-006 — Quick-pay del panel de pedido

Botones rápidos para registrar abonos típicos ($50k, $100k, etc.) contra
la factura activa del pedido. Evita que papá tenga que ir a la sección
de facturas para un pago menor.

**Origen**: Fase 3 v2 §5.3.2.
**Aparece en**: `pedido-detail-panel.tsx`.

### SPEC-007 — Prevenir facturas duplicadas por pedido

Un pedido solo puede tener una factura activa simultánea. Anular una
factura permite crear otra; mientras esté `pendiente` o `pagada`, el
sistema rechaza crear una segunda. UNIQUE partial index en el schema.

**Aparece en**: `src/main/db/queries/facturas.ts`, `schema.ts`.

### SPEC-008 — Tres formatos de impresión

El PDF de factura se genera en uno de tres formatos:
- `carta` (LETTER 216×279 mm, default)
- `a4` (210×297 mm)
- `termico80` (tirilla 80 mm de alto flexible — para impresoras POS)

**Origen**: Fase 3 v2 §5.4.3.
**Aparece en**: `factura-pdf.ts`, `facturas/page.tsx`.

---

## Cómo añadir una regla nueva

1. Decidir si es `BR-NNN` (negocio) o `SPEC-NNN` (técnica/UI).
2. Elegir el siguiente número libre (BR llega a 012, SPEC a 008).
3. Añadir entrada acá con título, descripción de 1-3 párrafos y archivos
   donde aparece.
4. En el código, comentar el ID y un resumen de 1 línea, no copiar el
   texto completo.

Ejemplo de comentario en código bien formado:

```ts
// BR-012 — pagos mensuales de clases auto-generados al inicio del mes.
// Ver docs/BUSINESS_RULES.md.
```
