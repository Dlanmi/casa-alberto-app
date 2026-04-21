# CasaAlberto — Fase 3: Definición de Funcionalidades

**MARQUETERÍA CASAALBERTO**
Arte - Diseño - Decoración

**FASE 3 — DEFINICIÓN DE FUNCIONALIDADES**
Módulos, pantallas, funcionalidades y experiencia de usuario

Bogotá, Colombia — Barrio Verbenal
Abril 2026

---

## Filosofía de Diseño UX

La app está diseñada para un usuario específico: un emprendedor de 36 años de experiencia que ha manejado todo en papel y está dispuesto a usar tecnología. Cada decisión de diseño se basa en estos principios:

| Principio | Aplicación |
|-----------|-----------|
| Tarjetas visuales | Selección por tarjetas grandes con ícono y descripción en vez de dropdowns pequeños. El usuario ve todas las opciones de un vistazo. |
| Pasos guiados | Los procesos complejos (cotizar, crear pedido) se dividen en pasos con indicador de progreso. Un paso a la vez, sin abrumar. |
| Feedback en vivo | Los precios y totales se actualizan en tiempo real mientras el usuario selecciona opciones. Sin botón 'calcular'. |
| Colores que hablan | Verde = todo bien. Amarillo = atención. Rojo = urgente. Azul = listo para entregar. Sin necesidad de leer texto. |
| Mínimos clics | Cada acción frecuente debe estar a máximo 2 clics desde la pantalla principal. |
| Botones grandes | Elementos de interacción grandes y claros. Texto legible. Sin íconos ambiguos. |
| Alertas proactivas | La app avisa antes de que haya un problema, no después. Recordatorios de entrega, pagos pendientes, clases. |

---

## Navegación Principal

La app usa una barra lateral izquierda fija con íconos y texto para cada módulo. El Dashboard es la pantalla de inicio. La navegación es siempre visible y muestra badges con contadores de alertas pendientes.

| Ícono | Módulo | Descripción en la barra |
|-------|--------|------------------------|
| 🏠 | Dashboard | Inicio — Vista del día |
| 🧮 | Cotizador | Nueva cotización |
| 📋 | Pedidos | Trabajos activos |
| 🧾 | Facturas | Facturación |
| 👥 | Clientes | Base de clientes |
| 🎨 | Clases | Dibujo y pintura |
| 💰 | Finanzas | Ingresos y gastos |
| 🚚 | Proveedores | Directorio |
| 📄 | Contratos | Cotizaciones formales |
| ⚙ | Config | Ajustes (para el desarrollador) |

---

## 🏠 Dashboard — Pantalla Principal

Lo primero que tu papá ve al abrir la app cada día. Muestra un resumen inteligente del estado del negocio en tres zonas claras.

*Problemas que resuelve: P-003 (control de pedidos), P-004 (incumplimiento de entregas), P-006 (sin control de costos)*

### Zona 1: Timeline de Pedidos

Una línea de tiempo horizontal que muestra los pedidos ordenados por fecha de entrega. No es un calendario cuadrado sino una barra visual donde cada pedido es una tarjeta posicionada según cuándo vence.

- Tarjetas de color según urgencia: 🟢 verde (tiene tiempo), 🟡 amarillo (entrega en 2 días), 🔴 rojo (atrasado), 🔵 azul (listo para entregar)
- Cada tarjeta muestra: nombre del cliente, tipo de trabajo, días restantes
- Clic en la tarjeta abre el detalle del pedido
- Filtros rápidos: Todos, Urgentes, Atrasados, Listos

### Zona 2: Finanzas del Día

Un panel compacto que muestra el flujo de dinero en tiempo real:

- Ingresos del día: lo que entró (cobros, abonos)
- Gastos del día: lo que salió (materiales, proveedores)
- Balance: ingresos menos gastos
- Se actualiza automáticamente cada vez que se registra un cobro o gasto
- Botón para ver el resumen del mes

### Zona 3: Centro de Alertas

Notificaciones consolidadas de todos los módulos, ordenadas por prioridad:

- 🔴 Pedidos atrasados (pasaron la fecha de entrega y no están listos)
- 🟡 Entregas próximas (faltan 2 días y el trabajo no está terminado)
- 🟠 Pedidos sin abono ($0 abonado)
- 🟣 Cuadros sin reclamar (+15 días listos y no pasan por ellos)
- 🎨 Clase de dibujo hoy (recordatorio con horario)
- 🚚 Día de pedido a proveedor (hoy es lunes o miércoles)

### Acciones Rápidas

Botones grandes en la parte superior del dashboard:

- **"+ Nueva Cotización"** → abre el Cotizador
- **"+ Nuevo Pedido"** → abre formulario de pedido
- **"+ Registrar Cobro"** → registro rápido de ingreso
- **"+ Registrar Gasto"** → registro rápido de egreso

---

## 🧮 Módulo 1 — Cotizador Digital

Automatiza todo el cálculo de precios. El cliente escoge materiales, el dueño mete medidas y la app calcula el precio al instante con desglose completo.

*Problemas que resuelve: P-008 (listas de precios en papel), base para P-001 y P-006*

### Pantalla Principal: Selección por Tarjetas

Al entrar al cotizador, el dueño ve tarjetas grandes con ícono para seleccionar el tipo de trabajo:

| Tarjeta | Descripción | Flujo |
|---------|-------------|-------|
| 🖼 Enmarcación Estándar | Marco + vidrio + respaldo | Wizard completo (6 pasos) |
| 🎨 Con Paspartú | Marco + paspartú + vidrio | Wizard completo + paso paspartú |
| 🛠 Acolchado | MDF + espuma + pegado | Fórmula acolchado + marco opcional |
| 🖼 Retablo | 4 listones + tapa MDF | Selección directa por medida |
| 🧱 Bastidor | Estructura para lienzo | Selección directa por medida |
| 🖼 Tapa Portarretrato | Tapa de reemplazo | Selección directa por medida |
| 🔧 Restauración | Reparación de piezas | Precio libre (criterio del dueño) |
| 🪟 Vidrio/Espejo | Cotización a domicilio | Precio por m² + instalación |

### Wizard de Enmarcación (flujo principal)

Al seleccionar enmarcación estándar o con paspartú, se abre un wizard paso a paso con el desglose de precio visible en un panel lateral que se actualiza en tiempo real:

1. **Medidas:** Campos de ancho y alto en cm. Validación: no puede ser 0 ni negativo.
2. **Marco:** Búsqueda por referencia con autocompletado. Al seleccionar, muestra la colilla y precio/metro. Calcula automáticamente.
3. **Paspartú (opcional):** Selección por tarjetas: Pintado (cartón) o Acrílico (MDF). Slider para el ancho (2cm a 10cm). La app recalcula dimensiones del marco y vidrio.
4. **Vidrio (opcional):** Tarjetas: Claro ($100.000/m²) o Antirreflectivo ($115.000/m²). La app redondea de 10 en 10 y muestra el cálculo.
5. **Materiales adicionales:** Slider del 5% al 10% con el monto calculado visible.
6. **Resumen:** Desglose completo con botones: Crear Pedido, Imprimir Cotización, Guardar.

### Sub-sección: Listas de Precios

Accesible desde el cotizador con un botón "Gestionar Precios". Pestañas para cada una de las 7 listas. Funcionalidades:

- Ver y editar precios en tabla con búsqueda instantánea
- Agregar nueva referencia, editar existente, eliminar
- Importar desde Excel (.xlsx) con validación de formato
- Exportar a Excel para respaldo
- Historial de cotizaciones recientes (por si el cliente vuelve)

---

## 📋 Módulo 2 — Gestión de Pedidos

El tablero de control de todos los trabajos activos. Reemplaza los cartones y libretas con un sistema visual de estados y alertas automáticas.

*Problemas que resuelve: P-003 (control en cartón), P-004 (incumplimiento de entregas)*

### Pantalla Principal: Tablero Kanban

Vista tipo tablero con columnas por estado. Cada pedido es una tarjeta que se puede arrastrar de una columna a otra:

| Columna | Descripción | Color de tarjeta |
|---------|-------------|------------------|
| Cotizado | Se hizo cotización pero el cliente no confirmó | ⚪ Gris |
| Confirmado | Cliente aceptó y se recibió la pieza | 🔵 Azul |
| En proceso | El trabajo está siendo elaborado | 🟢🟡🔴 Según urgencia |
| Listo | Terminado, esperando recogida | 🔵 Azul (pulsando) |
| Entregado | Cliente recogió y pagó saldo | ✅ Verde completado |
| Sin reclamar | +15 días listo sin recoger | 🟣 Morado (alerta) |

### Tarjeta de Pedido (lo que muestra cada tarjeta)

- Nombre del cliente
- Tipo de trabajo + descripción corta
- Fecha de entrega con indicador de días restantes
- Barra de progreso: abono vs total (cuánto ha pagado)
- Badge de alerta si aplica (sin abono, atrasado, sin reclamar)

### Vista Alternativa: Lista

Tabla ordenable y filtrable con todos los pedidos. Columnas: #, cliente, trabajo, fecha ingreso, fecha entrega, total, abono, saldo, estado. Búsqueda por nombre, número o fecha.

### Detalle del Pedido

Al hacer clic en una tarjeta, se abre el detalle completo:

- Datos del cliente (nombre, teléfono, dirección)
- Descripción completa del trabajo y especificaciones
- Desglose de cotización (materiales, precios, fórmulas usadas)
- Historial de pagos: fecha, monto, método
- Cambio de estado con un clic
- Botón **"Registrar Abono"** para pagos parciales
- Botón **"Generar Factura"** para crear la factura digital
- Botón **"Llamar cliente"** (abre teléfono)

### Sistema de Alertas del Módulo

- **Pedido sin abono:** notificación al registrar pedido con $0
- **Fecha próxima:** alerta cuando faltan 2 días y el trabajo no está en estado 'Listo'
- **Pedido atrasado:** alerta roja cuando pasó la fecha de entrega
- **Sin reclamar:** alerta morada cuando han pasado +15 días en estado 'Listo'

---

## 🧾 Módulo 3 — Facturación Digital

Reemplaza las factureras de papel. Genera facturas con consecutivo automático, permite búsqueda instantánea, impresión y envío por correo.

*Problemas que resuelve: P-001 (facturación en papel)*

### Generación de Factura

La factura se puede crear desde el módulo de Pedidos (botón "Generar Factura") o directamente desde este módulo. Los datos se precargan del pedido si viene de ahí.

**Campos de la factura:**

| Campo | Comportamiento |
|-------|---------------|
| Número consecutivo | Autogenerado, secuencial, no editable |
| Fecha | Fecha de creación (automática) |
| Cliente | Nombre, teléfono, cédula (autocompletado si ya existe) |
| Descripción | Tipo de trabajo y especificaciones |
| Desglose | Marco, vidrio, paspartú, materiales adicionales |
| Total | Precio final calculado |
| Abono | Lo que pagó el cliente |
| Saldo | Total - Abono (autocalculado) |
| Fecha de entrega | Cuándo puede recoger el trabajo |

### Acciones de la Factura

- **Imprimir:** genera PDF optimizado para impresión (original y copia)
- **Enviar por correo:** envía la factura al email del cliente
- **Registrar abono:** agrega un pago parcial o total al saldo
- **Devolución:** registra devolución vinculada al pedido con motivo

### Búsqueda de Facturas

Barra de búsqueda con filtros: por número, nombre del cliente, fecha, estado (pendiente, pagada, devuelta). Resultados instantáneos mientras se escribe.

---

## 👥 Módulo 4 — Clientes

Base de datos centralizada de todos los clientes. Reemplaza la información dispersa en facturas de papel con historial automático, frecuencia y total gastado.

*Problemas que resuelve: P-002 (sin historial de clientes)*

### Pantalla Principal: Directorio de Clientes

Lista de clientes con tarjetas compactas. Cada tarjeta muestra iniciales del nombre como avatar, nombre completo, teléfono, y estadísticas rápidas (total gastado, cantidad de pedidos, última visita).

- Búsqueda instantánea por nombre, teléfono o cédula
- Filtros: todos, frecuentes (3+ pedidos), con saldo pendiente, estudiantes de clase
- Botón "+ Nuevo Cliente" para registro rápido

### Ficha del Cliente

Al hacer clic en un cliente, se abre su ficha completa:

**Datos personales:**
- Nombre completo, teléfono, dirección, cédula, correo electrónico
- Para menores (clases): nombre y teléfono del acudiente

**Estadísticas automáticas:**
- Total gastado histórico (suma de todas las facturas pagadas)
- Cantidad de pedidos realizados
- Frecuencia de visita (cada cuántas semanas/meses)
- Última visita (fecha del último pedido)
- Saldo pendiente consolidado (si debe algo)

**Historial de pedidos:**
- Lista cronológica de todos los pedidos del cliente con estado y monto
- Clic en cualquier pedido abre el detalle completo

---

## 🎨 Módulo 5 — Clases de Dibujo y Pintura

Gestiona las clases, los estudiantes, los pagos mensuales y el horario. Evita conflictos entre clases y salidas del dueño.

*Problemas que resuelve: P-005 (conflicto clases vs salidas)*

### Pantalla Principal: Calendario de Clases

Vista semanal que muestra los bloques de clase programados. Los días con clase se resaltan visualmente. Si hoy hay clase, se muestra una alerta prominente en el Dashboard.

- Crear/editar bloques de clase: día, hora inicio, hora fin
- Vista mensual para ver el patrón de clases
- Alerta de conflicto: si el dueño agenda una salida en horario de clase

### Gestión de Estudiantes

Lista de estudiantes activos con tarjeta por cada uno:

- Nombre, teléfono, fecha de ingreso
- Datos del acudiente (para menores de edad)
- Estado del pago mensual: pagado, pendiente, parcial
- Historial de pagos (meses anteriores)

### Control de Pagos Mensuales

Al inicio de cada mes, la app genera automáticamente los registros de pago para cada estudiante activo ($110.000). El dueño marca como pagado cuando el estudiante paga. Badge de alerta si un estudiante lleva más de 5 días del mes sin pagar.

### Venta de Kits

Registro rápido de venta de kit de dibujo ($15.000) vinculado al estudiante. Se registra como ingreso en Finanzas.

---

## 💰 Módulo 6 — Finanzas

Visibilidad completa de la salud financiera del negocio. Reemplaza el libro de entradas y salidas con registro digital, gráficas y reportes.

*Problemas que resuelve: P-006 (sin control de costos)*

### Pantalla Principal: Resumen Financiero

Vista del mes actual con métricas clave en tarjetas de resumen:

- Ingresos del mes (total cobrado)
- Gastos del mes (total de egresos)
- Ganancia estimada (ingresos - gastos)
- Saldos por cobrar (total de lo que deben los clientes)
- Gráfica de ingresos vs gastos por día (línea o barras)

### Registro de Ingresos

Se registran automáticamente desde Facturación (abonos, pagos de saldo) y desde Clases (pagos mensuales, venta de kits). También se pueden registrar manualmente.

### Registro de Gastos

Formulario rápido: descripción, monto, categoría (materiales, servicios, transporte, otro), proveedor (opcional), fecha. Categorías con íconos para fácil selección.

### Reportes

- **Reporte mensual:** ingresos, gastos, ganancia, desglose por tipo de servicio
- **Reporte por tipo de trabajo:** cuánto genera cada tipo (enmarcación, retablos, clases, contratos)
- **Reporte de saldos pendientes:** lista de clientes que deben dinero
- **Comparación mes a mes:** gráfica de tendencia
- **Exportar reportes** a Excel o PDF

### Devoluciones

Las devoluciones se registran como movimiento negativo vinculado al pedido original. Incluyen motivo y fecha. Se reflejan en los reportes financieros.

---

## 🚚 Módulo 7 — Proveedores

Directorio organizado de proveedores con días de pedido, productos que suministran y forma de pago. Reemplaza los contactos sueltos en el teléfono.

*Problemas que resuelve: P-007 (proveedores sin directorio)*

### Pantalla Principal: Directorio

Tarjetas de proveedor con información clave visible de un vistazo:

- Nombre/empresa, producto que suministra
- Teléfono (clic para llamar)
- Días de pedido (badges: Lun, Mié)
- Forma de pago y forma de entrega
- Notas adicionales

### Alerta de Día de Pedido

Si hoy es un día de pedido de algún proveedor (ej: lunes o miércoles para marcos), se muestra una alerta en el Dashboard recordando que hay que hacer pedidos.

### Importar/Exportar

- Importar lista completa desde Excel (.xlsx)
- Exportar directorio a Excel para respaldo
- Agregar, editar o eliminar proveedores individualmente

---

## 📄 Módulo 8 — Documentos de Contratos

Genera automáticamente cotizaciones formales y cuentas de cobro para contratos con conjuntos residenciales y entidades, usando la plantilla del negocio.

*Problemas que resuelve: Del Bloque F.3 de la Fase 2*

### Generación de Cotización Formal

Formulario paso a paso que genera un documento Word/PDF con la plantilla del negocio:

1. Datos del cliente/conjunto: nombre, NIT/cédula, dirección, contacto
2. Descripción del trabajo: tipo, medidas, especificaciones
3. Precio: desglose de materiales, mano de obra, instalación
4. Condiciones: tiempo de entrega, forma de pago, garantía
5. Vista previa del documento generado con datos del negocio (nombre, RUT, teléfono)
6. Exportar como PDF o Word para imprimir o enviar

### Generación de Cuenta de Cobro

Si la cotización es aprobada, se genera la cuenta de cobro con la misma plantilla. Incluye retención en la fuente cuando aplica. Se puede generar directamente desde la cotización aprobada.

### Historial de Contratos

Lista de todas las cotizaciones y cuentas de cobro generadas, con estado (enviada, aprobada, cobrada, rechazada). Búsqueda por cliente, fecha o monto.

---

## ⚙ Configuración

Ajustes técnicos de la app. Manejado por el desarrollador, no por el dueño. Acceso discreto con ícono de engranaje.

*Problemas que resuelve: Soporte técnico general*

### Datos del Negocio

- Nombre completo: CasaAlberto - Arte - Diseño - Decoración
- RUT, teléfono, dirección (para plantillas de documentos)
- Logo (si lo tiene, para facturas y cotizaciones)

### Respaldo de Datos

- Botón "Crear backup" que copia el archivo .db a una ubicación elegida
- Botón "Restaurar backup" para recuperar datos desde un respaldo
- Opción de backup automático diario/semanal

### Ajustes de la App

- Consecutivo de facturas: definir desde qué número arranca
- Valores predeterminados: porcentaje de materiales adicionales (default 10%)
- Precios de vidrio: claro y antirreflectivo (editables)
- Tiempos de entrega por defecto (8 días estándar)

---

## Priorización de Desarrollo

Los módulos se desarrollan en orden de impacto en los problemas críticos del negocio. La prioridad combina urgencia del problema + dependencia entre módulos:

| # | Prioridad | Módulo | Razón | Problemas |
|---|-----------|--------|-------|-----------|
| 1 | 🔴 Crítica | Cotizador Digital | Base de todo. Sin esto no hay pedidos ni facturas. | P-008 |
| 2 | 🔴 Crítica | Gestión de Pedidos | Resuelve el dolor más grande: trabajos atrasados. | P-003, P-004 |
| 3 | 🔴 Crítica | Facturación Digital | Depende de Cotizador y Pedidos. | P-001 |
| 4 | 🟠 Alta | Clientes | Centraliza datos que usan todos los módulos. | P-002 |
| 5 | 🟠 Alta | Dashboard | Necesita datos de Pedidos y Finanzas. | Todos |
| 6 | 🟡 Media | Finanzas | Se alimenta de facturas y pedidos. | P-006 |
| 7 | 🟡 Media | Clases de Dibujo | Módulo independiente. | P-005 |
| 8 | 🟢 Normal | Proveedores | Complementario, bajo impacto inmediato. | P-007 |
| 9 | 🟢 Normal | Documentos Contratos | 4-5 veces al mes, no urgente. | F.3 |

> ⚠ **Recomendación:** desarrollar los módulos 1 al 4 primero como MVP (Producto Mínimo Viable). Con esos 4 módulos funcionando, el dueño ya puede cotizar, registrar pedidos, facturar y buscar clientes. El resto se agrega iterativamente.

---

## Siguientes Pasos

Con la Fase 3 completada, el proyecto avanza a:

1. **Fase 4 — Diseño de base de datos:** Crear el modelo de datos con todas las entidades, relaciones y validaciones documentadas en las Fases 2 y 3.
2. **Fase 5 — Diseño de interfaz:** Crear prototipos visuales (mockups) de las pantallas principales de cada módulo.
3. **Fase 6 — Desarrollo:** Construir la aplicación de escritorio con Electron + React + SQLite.

---

*Documento generado como parte del levantamiento de requerimientos para CasaAlberto - Arte - Diseño - Decoración. Fase 3 — Definición de Funcionalidades.*
