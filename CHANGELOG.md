# Changelog — Casa Alberto

Historial de cambios visibles para el dueño de la marquetería.
Cada versión describe qué se notará en uso y qué se arregló sin tener
que mirar el código. El formato sigue [Keep a Changelog](https://keepachangelog.com/es/).

Versiones publicadas como release de Windows vía
[GitHub Releases](https://github.com/Dlanmi/casa-alberto-app/releases),
auto-actualizadas por electron-updater al abrir la app.

---

## [2.0.0] — Descuentos inteligentes, márgenes reales y carga masiva por Excel

Release mayor que reorganiza cómo Casa Alberto cobra, mide rentabilidad y
configura sus precios. Antes la app calculaba un precio sugerido y el dueño
lo cobraba sin contexto interno. Ahora cada pedido tiene visible el costo
estimado, el margen y el descuento aplicado, y la configuración inicial se
carga de una sola vez con una plantilla Excel.

### Cotizador y pedidos

- **Ajuste comercial integrado en el wizard**: al cerrar la cotización se
  puede aplicar descuento (monto manual o "dejar total cerrado en $X") y la
  app sugiere automáticamente cifras redondeadas al millar.
- **Margen estimado en vivo**: el panel lateral del wizard muestra costo
  estimado, margen y un estado de rentabilidad (saludable / ajustado /
  crítico / incompleto) que se actualiza al instante con cada cambio.
- **Editar descuento o costo después de creado**: si te equivocaste en el
  precio o quieres aplicar un descuento más tarde, el panel de detalle del
  pedido permite ajustar y, si ya cobraste algo, genera devolución
  automática del exceso.
- **Cancelación segura**: cancelar un pedido con pagos cobrados ahora crea
  la devolución correspondiente automáticamente — no quedan cobros
  fantasma en finanzas.
- **Regalo permitido**: un pedido con descuento del 100% queda con factura
  marcada como pagada inmediatamente, ideal para cortesías a clientes.
- **Pedido urgente**: nuevo toggle al crear el pedido y desde el panel de
  detalle. Aparece destacado en el tablero kanban con badge ⚡.
- **Badge "Con descuento"** en el kanban para identificar a simple vista
  los pedidos con ajuste comercial.
- **PDF desde el detalle del pedido**: nuevo botón "PDF factura" o "PDF
  cotización" según corresponda. El PDF muestra precio sugerido, descuento
  con motivo y total final cuando aplica.

### Listas de precios — Plantilla Excel unificada

- **Una sola plantilla** para cargar TODO de una vez: datos del negocio,
  proveedores, marcos, vidrios, paspartú pintado/acrílico, retablos,
  bastidores, tapas y configuración general.
- **Plantilla con estilos profesionales**: encabezados con color,
  pestañas identificadas por color, filas de ejemplo en fondo crema,
  zebra-stripes, frozen pane, auto-filtros, tooltips con ayuda en cada
  columna.
- **Vista previa antes de cargar**: la app muestra cuántos elementos detectó
  y reporta TODOS los errores encontrados (línea + columna específicas)
  antes de tocar la base de datos.
- **3 modos de carga**: actualizar y agregar (default), solo agregar
  nuevos, o reemplazar todo (con doble confirmación).
- **Costo estimado opcional** en cada lista (marcos, vidrios, paspartú,
  retablos, bastidores, tapas) — habilita el cálculo de margen real por
  pedido.
- **Botón "Exportar configuración actual"** para tener un backup de los
  precios o editarlos en Excel y volver a subir.
- **Tamaño máximo subido a 15 MB** (antes 10 MB) por si la plantilla pesa
  más de lo esperado.
- **Defensas en 4 capas**: validaciones del Excel, sanitización (anti
  prototype-pollution, control chars), validaciones de negocio
  (duplicados, rangos), y CHECK constraints en SQLite.

### Onboarding simplificado

- Step 0 con opción visible "Saltar el wizard y configurar después".
- Datos del negocio: cambio de "RUT" a "NIT / Cédula" (terminología
  colombiana) y mensaje claro de "puedes saltar si no tienes todo a mano".
- Step de precios completamente rediseñado: descarga la plantilla, llénala,
  súbela. Reemplaza el import individual de marcos.
- Paso final detecta si hay marcos cargados: si los hay sugiere ir al
  cotizador, si no sugiere cargar precios primero (evita entrar al
  cotizador y encontrar listas vacías).

### Dashboard

- Nueva mini-card **"Margen comercial del mes"** con el margen estimado
  sobre los pedidos completos del mes (separado del balance de caja real).
- Empty state inteligente: si no hay marcos cargados, sugiere cargar
  precios primero antes que crear cotización.
- Vista comercial en /finanzas: ventas brutas, descuentos del mes, ventas
  netas (incluyendo clases y kits), margen estimado solo sobre pedidos
  con costo completo (no infla con costos en cero).

### Vidrios — Modelo enriquecido

- Cada vidrio tiene nombre comercial visible, espesor en mm y costo por
  m² estimado opcional (antes era solo "tipo + precio").
- El cotizador encuentra vidrios incluso si el pedido viejo guardó un
  tipo legacy sin espesor.
- Bloqueo: no se puede cambiar nombre o espesor de un vidrio si hay
  pedidos referenciándolo (proteje historia).

### Bajo el capó

- Migraciones consolidadas en una sola (0000) para mantener historial
  limpio. La app borra y crea desde cero al actualizar a esta versión.
- Módulo `@shared/comercial.ts` con la lógica única de descuento y margen,
  usado tanto por el wizard como por el backend (antes había dos copias
  divergentes).
- 421 tests automatizados pasando (+33 nuevos: importador Excel, modelo
  de descuentos, edge cases de cancelación y regalo).
- Build de producción y boot de Electron validados.

### ⚠️ Migración desde 1.7.x

Esta versión rehace el esquema de la base de datos. Al actualizar:

- El historial de pedidos previos se conserva.
- Los precios viejos (sin costo estimado) seguirán funcionando — solo no
  calcularán margen estimado hasta que cargues los costos.
- Si el dueño tenía marcos importados desde Excel, siguen ahí. La nueva
  plantilla unificada permite re-cargarlos con costos estimados si se
  quiere medir margen.

## [1.7.4] — Agenda más clara y navegación rápida

Release de experiencia operativa para hacer más fácil revisar entregas y
moverse entre días sin depender del papel.

### Agenda

- La agenda abre en un estado limpio: el panel del día queda arriba y las
  entregas solo se muestran cuando el usuario activa un filtro.
- El chip `Todos` ahora vuelve a revelar la sección de entregas, incluso
  cuando la vista todavía no tenía selección visual.
- El botón `Limpiar` restaura la vista sin dejar un filtro marcado.
- La navegación por día anterior/siguiente y el acceso desde el onboarding
  quedaron sincronizados con el nuevo contexto semanal.

### Onboarding

- El paso final incluye el botón `Ver ahora` para ir directo a la agenda y
  revisar lo de esta semana.

### Ajustes técnicos

- Se unificó la consulta de agenda para traer solo pedidos activos con fecha
  de entrega.
- Se corrigió una advertencia de lint en la tarjeta de entregas.

## [1.7.3] — Correcciones críticas de pedidos y facturación

Release de **integridad operativa** para cerrar errores encontrados en la
auditoría de pedidos, facturas y cotizador.

### Pedidos y facturación

- Crear pedido desde el wizard ahora es atómico: pedido confirmado,
  factura y abono inicial se guardan en una sola operación.
- El backend recalcula y valida la cotización contra las listas de precios
  antes de persistir el pedido, evitando totales manipulados por IPC.
- Las facturas ahora deben coincidir con el cliente y total real del pedido.
- Los pagos rechazan valores no válidos antes de tocar SQLite.

### Cotizador

- Vidrio/espejo guarda el tipo de vidrio correcto al crear el pedido.
- El paso de vidrio/espejo muestra todos los vidrios activos configurados
  en la base de datos, no solo los tipos iniciales.

### Tests

- Regresiones nuevas para cotizaciones manipuladas, flujo atómico,
  factura con cliente/total incorrecto y pagos inválidos.

## [1.7.1] — Hardening de integridad y estabilidad

Release de **fixes críticos**. Sin features nuevas; varias correcciones
de datos que podían causar pérdidas silenciosas y cambios de UX que
mejoran feedback ante errores.

### Integridad de datos

- `parseMoneyInput` strippea separadores de miles colombianos.
  Antes "86.000" se interpretaba como 86, cobrando ~1000× menos sin aviso.
  Migrado a 13 inputs (cotizador, facturas, clases, contratos, finanzas).
- Saldo real visible cuando el cliente tiene crédito a su favor.
  Si una factura recibe devoluciones que exceden los pagos restantes,
  ahora se muestra como "Crédito del cliente" en vez de ocultar el saldo
  como "$0".
- `tipProximaEntrega` (HelpButton) usa fecha local. Antes calculaba
  con UTC y, después de las 7pm en Colombia, podía esconder la entrega
  de mañana.
- `getDay()` normalizado a inicio del día local en dashboard, topbar,
  vista de clases y resolvers del help-button.

### Estabilidad

- Toast cuando el rollback de cambio de estado de pedido falla.
  Antes se silenciaba el error y papá quedaba con un estado intermedio.
- Onboarding revierte el paso si la persistencia falla, evitando
  pérdida de progreso al cerrar la app a mitad.

### Defense in depth

- `parseMoneyInput` y `useMoneyInput` con reformato al perder el foco
  para que el monto visible coincida con el guardado.
- Whitelist runtime del formato de PDF (rechaza valores fuera de
  `carta` / `a4` / `termico80`) para prevenir path traversal.
- Helper `validarMonto` en handlers IPC numéricos rechaza
  `Infinity` / `NaN` / strings antes de tocar la DB.
- `pdf:abrir` con guard sintáctico en el boundary IPC.
- `backup:restaurar` por ID en lugar de path completo: el renderer
  ya no envía rutas del filesystem al main.
- CSP meta tag verificado en el renderer.

### Tests

44 tests nuevos cubriendo los fixes anteriores y casos límite
(timezone Bogotá, sobrepago, separadores de miles, guards numéricos,
path traversal). Total: **354 pass + 141 skipped**.

---

## [1.7.0] — Vista de agenda operativa

Mejoras grandes en `/agenda` para que sea herramienta de decisión y no
solo calendario.

### Agenda semanal

- Urgencia visual de entregas atrasadas (borde rojo + badge en mini-card,
  fila y popup).
- Pill naranja "Urgente" para `tipoEntrega: urgente` no atrasado.
- Día de hoy más evidente: borde acento sólido + pill "HOY".
- Filtros rápidos: Todos / Solo atrasadas / Solo hoy.
- Estado vacío contextual (día tranquilo, día de proveedor, día pasado…).
- Refetch automático al volver a la pestaña + polling cada 60 s.

### Popup de pedido

- Saldo total del cliente cuando debe en otros pedidos aparte del actual.
- Plantillas de WhatsApp dinámicas según estado (`listo`, `atrasada`,
  default).
- Botón "Recordar saldo pendiente" cuando aplica, con plantilla de cobro.
- Bloque "Entrega" tintado de warning cuando es urgente.

### Popup de clase

- Estado de pago del mes al lado de cada estudiante (Pagado / Parcial /
  Pendiente).
- Para estudiantes menores: línea con nombre y teléfono del acudiente
  - botón "Llamar"; CTA "Registrar acudiente" si no existe.

### HelpButton

- Tips contextuales para `/agenda`: entregas de hoy, próxima entrega,
  resumen de la semana.
- Reaperture del popover corregida.

### Cotizador

- Constantes `TIPO_ENTREGA_LABEL` / `TIPO_ENTREGA_COLOR` centralizadas.
- Plantilla WhatsApp `mensajeListoParaRecoger` para pedidos terminados.

### Pedidos

- Fix: el detalle no se reabría solo al cerrarse desde una URL con
  `:id`.

---

## [1.6.0] — HelpButton accionable

- Tip "Playbook del día": resumen ordenado de lo prioritario con botones
  para ir a cada filtro.
- Tip "Deudores accionables": top 5 clientes con saldo pendiente,
  botones "Llamar" y "WhatsApp" con mensaje pre-escrito.
- IPC `shell:openExternal` con validación de protocolo
  (`https:` / `tel:` / `mailto:`).

---

## [1.5.0] — HelpButton inteligente

- Endpoint `app:statsGenerales` para detectar empty-states.
- Tips contextuales por ruta (día de proveedor, etc.).

---

## [1.4.1] — HelpButton: búsqueda y navegación

- Búsqueda global de tips y FAQ.
- Botón para reiniciar tour de bienvenida.
- Cobertura amplia de tests (regresión del popover + features nuevas).

---

## [1.4.0] — Updater visual + Cotizador adherido

- Banner de actualización con progreso y botón "Reiniciar ahora".
- Tipo de trabajo "Adherido" (Fase 2 §A.6) y suplemento de paspartú.
- Fix: ESM runtime de `@e965/xlsx` requiere inyección de `fs`.

---

## [1.3.1] — Limpieza de ramas

Release de mantenimiento. Ramas de feature consolidadas en `main`.

---

## Versiones anteriores

Ver `git log --oneline` para versiones previas a 1.3.1. Antes del
hardening de v1.7.1, las notas de versión vivían dispersas en
comentarios del código y commits — este CHANGELOG arranca con el
estado actual y se mantiene de aquí en adelante.
