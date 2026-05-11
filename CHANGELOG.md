# Changelog — Casa Alberto

Historial de cambios visibles para el dueño de la marquetería.
Cada versión describe qué se notará en uso y qué se arregló sin tener
que mirar el código. El formato sigue [Keep a Changelog](https://keepachangelog.com/es/).

Versiones publicadas como release de Windows vía
[GitHub Releases](https://github.com/Dlanmi/casa-alberto-app/releases),
auto-actualizadas por electron-updater al abrir la app.

---

## [2.2.3] — Tiempos de entrega configurables + limpieza visual

Versión que extiende la pantalla de Configuración para que el dueño
pueda ajustar los días sugeridos de entrega según el tipo (urgente,
estándar, sin afán). Incluye limpieza visual interna: tokens unificados
de colores y un componente Toggle reutilizable. Sin cambios funcionales
en el cotizador ni en las cotizaciones.

### Nuevo

- **Días de entrega configurables.** En Configuración aparece un nuevo
  grupo "Tiempos de entrega" con cuatro campos editables: entrega
  urgente (default 3 días), entrega estándar (7), entrega sin afán
  (14) y tiempo de entrega general (8). Antes estos números vivían
  hardcoded en el código; ahora se pueden cambiar sin tocar nada y la
  app respeta el valor configurado al sugerir la fecha de entrega de
  un pedido directo. La sugerencia es solo un default — el dueño
  puede sobreescribir la fecha cuando quiera.

### Mejorado

- **Botón de eliminar trabajo más sobrio.** En el flujo de pedido con
  varios trabajos, el botón "papelera" para quitar un trabajo usaba
  un rojo demasiado brillante. Ahora usa el rojo institucional de la
  app (más oscuro, hover con fondo rosado suave), consistente con el
  resto de mensajes de error.

- **Color del descuento en cotizaciones.** El monto del descuento en
  el resumen de cotización ahora se muestra en rojo institucional en
  lugar del rojo genérico.

- **Animaciones del wizard unificadas.** El indicador de carga del
  pedido directo (el blur del fondo) y los toggles del cotizador
  (paspartú, vidrio, suplemento, descuento, urgente) ahora comparten
  los tokens de color y la duración base del proyecto. Mismo
  comportamiento visible, menos código duplicado.

### Para desarrolladores

- Nuevo componente `<Toggle>` en `components/ui/toggle.tsx` que
  reemplaza 6 instancias del mismo markup repetido. Soporta variante
  `tone="warning"` para el toggle de "marcar urgente".
- Validación de dominio para las claves `dias_entrega_*` y
  `tiempo_entrega_default`: deben ser enteros entre 0 y 365 días.
  Hardening preventivo del mismo género del Infinity guard de v2.2.1.
- Constante `DEFAULT_LIST_QUERY_LIMIT = 100` en `lib/constants.ts`
  reemplaza dos magic numbers en `quick-pay-modal` y
  `pedido-detail-panel`.

## [2.2.2] — Cotizador más cómodo con catálogos grandes

Patch enfocado en el paso de selección de marco cuando hay muchas
muestras configuradas (100+ referencias). Sin cambios funcionales en el
cálculo ni en los datos — solo comodidad de uso.

### Arreglado

- **El botón "Siguiente" del cotizador ya no se esconde detrás de la
  lista de marcos.** Antes, en el paso "Seleccionar marco", si el
  catálogo tenía 100+ muestras el grid de tarjetas crecía tanto que
  había que hacer un scroll largo hasta el final para encontrar el
  botón "Siguiente". Ahora la lista de marcos tiene su propio scroll
  interno (alrededor de la mitad de la pantalla), y los botones de
  navegación siempre quedan a la vista. La búsqueda y el contador
  ("X de Y marcos") también permanecen siempre visibles arriba. Aplica
  al cotizador clásico y al flujo de pedido con varios trabajos.

- **El catálogo del "Pedido directo" no cambia.** El modal grande del
  catálogo de marcos que se abre desde un item del pedido directo
  mantiene el comportamiento actual — el modal scrollea entero, sin
  doble scroll dentro de la lista.

## [2.2.1] — Hardening: cuatro caminos de fallo cerrados

Patch que cierra cuatro huecos defensivos identificados en revisión de
código del release 2.2.0. Ninguno alcanzable desde uso normal — todos
requieren almacenamiento local manipulado o un renderer comprometido —
pero el modelo de amenazas del proyecto trata ese límite como no
confiable, así que se cierran preventivamente.

### Arreglado

- **El picker de catálogo de marcos ya no congela el "Pedido directo"
  con varios items.** Antes, cada fila de marco montaba el modal aun
  cerrado y disparaba un IPC al catálogo en cada render — con 5+ items
  la pantalla quedaba lenta. Ahora el modal solo se monta cuando el
  usuario hace click en "Elegir marco del catálogo".

- **La base de datos rechaza totales no-finitos en pedidos
  multi-trabajo, contratos, cuentas de cobro y movimientos manuales de
  finanzas.** Antes un payload IPC con números extremos podía propagar
  Infinity al insert (los CHECK del schema no lo bloqueaban). Ahora
  todos los handlers IPC numéricos pasan por validación profunda antes
  de persistir.

- **El borrador del flujo "Pedido multi-trabajo" se descarta si está
  corrupto.** Antes, si el localStorage quedaba con un draft malformado
  (corte de luz a mitad de auto-save, mismatch entre versiones), la
  ruta `/cotizador/pedido` quedaba en pantalla blanca y solo se
  recuperaba limpiando manualmente la caché. Ahora la app valida el
  draft profundamente y, si algo no cuadra, lo descarta y arranca
  limpia.

- **El borrador del cotizador individual también se descarta si está
  corrupto.** Mismo patrón que el de multi-trabajo, aplicado al wizard
  de un solo trabajo.

### Para desarrolladores

- 57 tests nuevos cubriendo los caminos hostiles (Infinity/NaN,
  drafts vacíos, drafts con cliente o cotización malformados).
- 19 tests pre-existentes que estaban con setup desactualizado fueron
  re-alineados con el seed de configuración actual y la versión
  moderna de SQLite. Toda la suite (915 tests) pasa.
- TZ del runtime de tests fijada a `America/Bogota` para que los
  helpers que dependen de día calendario (agenda, próximas entregas)
  sean reproducibles.

## [2.2.0] — Pedido con varios trabajos en una sola visita

Cuando un cliente llega con varios cuadros distintos (uno con marco simple,
otro con paspartú, una restauración, etc.), antes había que crearle un
pedido por cada trabajo. Ahora se cotizan todos juntos en el mismo flujo
y queda una sola factura con la lista de trabajos agrupados.

### Nuevo: flujo de pedido multi-trabajo

- **Entrada desde el cotizador**: en la pantalla del cotizador aparece un
  banner destacado "¿Cliente con varios trabajos?". Click → nuevo flujo.
- **Cliente al inicio**: primero se elige el cliente (existente o nuevo),
  para que el historial quede visible mientras se cotiza.
- **Trabajos uno por uno**: botón "Agregar trabajo" abre un modal con el
  wizard completo de cotización (mismas medidas, marco, paspartú, vidrio,
  materiales que el flujo individual). Cada trabajo confirmado entra a
  una lista visible con su precio.
- **Tipos mezclados**: en un mismo pedido pueden coexistir trabajos de
  tipos distintos (enmarcación + restauración + retablo, por ejemplo).
- **Editar / eliminar**: cada trabajo en la lista tiene botones para
  re-abrir el modal y modificarlo, o quitarlo del pedido.
- **Total y pago**: descuento global opcional sobre el subtotal de todos
  los trabajos, abono opcional (efectivo/transferencia), urgencia, notas
  y fecha de entrega — todo a nivel pedido, no por trabajo.
- **Auto-save**: si el papá cierra la app sin terminar, al volver recupera
  el cliente y los trabajos cotizados sin perder el progreso.

### Búsqueda de marco enlazada en pedido directo

En "Nuevo pedido directo" (atajo del kanban), cuando un item es tipo "marco"
ahora se ofrece un botón "Elegir del catálogo". Al seleccionar una muestra,
se autopopulan descripción, referencia, precio/m y costo estimado. El modo
libre (escribir todo a mano) sigue disponible para muestras que aún no
están en el catálogo.

### Factura PDF agrupada por trabajo

Para pedidos con varios trabajos, la factura PDF ahora muestra cada
trabajo como un sub-header con su tipo y medidas, seguido de sus items
(marco, vidrio, paspartú, materiales). Los pedidos viejos (un solo
trabajo) siguen viéndose igual que antes.

### Para el dueño

Un cliente que antes generaba 3 pedidos separados ahora genera 1 solo
con 3 trabajos y 1 factura. Los reportes del kanban, finanzas y el
historial siguen funcionando igual: los pedidos viejos se muestran como
siempre, y los pedidos nuevos con tipos mezclados aparecen en una
categoría nueva "Pedido mixto" cuando el filtro lo amerita.

## [2.1.1] — Hardening: tres bugs de seguridad reportados por auditoría

Patch que cierra tres caminos de fallo identificados en revisión de código
del release 2.1.0. Los tres son de severidad media y solo alcanzables con
acceso al renderer (perfil local manipulado o renderer comprometido), pero
el modelo de amenazas del proyecto trata ese límite como no confiable, así
que se cierran de forma defensiva.

### Arreglado

- **CommandPalette no se rompe si el historial reciente queda corrupto.**
  Antes, un valor inesperado en el almacenamiento local del historial podía
  dejar la pantalla en blanco al abrir la búsqueda global (Ctrl+K). Ahora
  los valores no reconocidos se descartan silenciosamente y la búsqueda
  abre normalmente, incluso si el archivo de preferencias quedó dañado.
- **Los pedidos y facturas no aceptan totales imposibles.** Antes, un
  cálculo que se desbordara (por ejemplo cantidades muy grandes) podía
  guardar valores infinitos en la base de datos, ensuciando reportes,
  PDFs y balances. Ahora cada multiplicación y suma de plata se vuelve
  a validar antes de guardarse: si el resultado no es un número finito
  válido, la operación se rechaza con un mensaje claro y la transacción
  se aborta sin tocar la base de datos.
- **El heatmap mensual de finanzas no puede colgar la app.** Antes, una
  llamada con un mes inválido (por ejemplo "0000-01") podía hacer que la
  app intentara generar décadas de días en memoria y se cerrara. Ahora
  se valida que el año esté dentro de un rango razonable y se aborta
  inmediatamente con un error legible.

### Para el dueño

No hay cambios visibles en el uso normal. Los flujos de cotización,
pedidos, facturas, clases y finanzas funcionan exactamente igual. El
único caso donde se notará la diferencia es si el archivo de preferencias
estaba dañado: ahora la app abre sin mostrar pantalla en blanco.

## [2.0.1] — Arreglo: actualización desde versiones anteriores no rompe la app

Patch que cierra el error de instalación reportado al actualizar de 1.7.4
a 2.0.0: la base de datos antigua quedaba con un registro de migraciones
incompatible con la migración consolidada nueva, y al abrir la app
aparecía el error "No se pudo inicializar la base de datos".

### Arreglado

- **Guard automático** detecta cuando la base de datos viene de una versión
  anterior con migraciones incompatibles. Antes de fallar, hace un respaldo
  automático y muestra un diálogo claro explicando lo que va a pasar.
- El dueño ve un mensaje accesible: cuántos clientes/pedidos/facturas hay
  y dónde queda guardado el respaldo, con dos opciones: resetear (recomendado)
  o cerrar la app para revisar manualmente.
- Si acepta resetear, la app borra las tablas obsoletas y crea la nueva
  estructura desde cero. El respaldo queda en la misma carpeta de datos
  con sufijo `.pre-reset-{fecha}.bak` por si necesitas recuperarlo.

### Para los que tienen instalada 2.0.0 con DB rota

Esta versión también puede arreglar la instalación 2.0.0 sin tener que
borrar nada manualmente: al abrir la app, el guard detecta la DB legacy
y ofrece resetearla con un click.

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
