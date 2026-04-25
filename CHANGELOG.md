# Changelog — Casa Alberto

Historial de cambios visibles para el dueño de la marquetería.
Cada versión describe qué se notará en uso y qué se arregló sin tener
que mirar el código. El formato sigue [Keep a Changelog](https://keepachangelog.com/es/).

Versiones publicadas como release de Windows vía
[GitHub Releases](https://github.com/Dlanmi/casa-alberto-app/releases),
auto-actualizadas por electron-updater al abrir la app.

---

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
  + botón "Llamar"; CTA "Registrar acudiente" si no existe.

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
