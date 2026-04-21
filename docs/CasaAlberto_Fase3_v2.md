# CasaAlberto — Fase 3: Definicion de Funcionalidades (v2)

**MARQUETERIA CASAALBERTO**
Arte - Diseno - Decoracion

**FASE 3 — DEFINICION DE FUNCIONALIDADES**
Modulos, pantallas, funcionalidades y experiencia de usuario

Bogota, Colombia — Barrio Verbenal
Abril 2026

---

## 1. Filosofia de Diseno UX

La app esta disenada para un usuario especifico: un emprendedor de 36 anos de experiencia que ha manejado todo en papel y esta dispuesto a usar tecnologia. Cada decision de diseno se basa en estos principios:

| Principio | Aplicacion |
|-----------|-----------|
| Tarjetas visuales | Seleccion por tarjetas grandes con icono y descripcion en vez de dropdowns pequenos. El usuario ve todas las opciones de un vistazo. |
| Pasos guiados | Los procesos complejos (cotizar, crear pedido) se dividen en pasos con indicador de progreso. Un paso a la vez, sin abrumar. |
| Feedback en vivo | Los precios y totales se actualizan en tiempo real mientras el usuario selecciona opciones. Sin boton "calcular". |
| Colores + texto + icono | Cada estado usa color, texto descriptivo e icono. Verde = todo bien, Amarillo = atencion, Rojo = urgente, Azul = en progreso. Nunca se usa color solo. |
| Minimos clics | Cada accion frecuente debe estar a maximo 2 clics desde la pantalla principal. |
| Botones grandes | Elementos de interaccion de minimo 48x48px. Texto legible de 14px+. Sin iconos ambiguos. |
| Alertas proactivas | La app avisa antes de que haya un problema, no despues. Recordatorios de entrega, pagos pendientes, clases. |
| Confianza y seguridad | Confirmacion antes de acciones destructivas. Deshacer disponible por 10 segundos. Eliminacion suave (archivar, no borrar). Auto-guardado cada 30 segundos. |
| Onboarding progresivo | Guia paso a paso para usuario que migra de papel. Datos de ejemplo, tooltips, y tour guiado reutilizable. |

---

## 2. Estandares de Accesibilidad

El usuario principal tiene ~60 anos. Estos estandares son obligatorios en toda la app.

### Tipografia

| Elemento | Tamano minimo | Peso | Line-height |
|----------|--------------|------|-------------|
| Headings (h1) | 24px | Bold (700) | 1.3x |
| Headings (h2) | 20px | Semibold (600) | 1.3x |
| Body / Labels | 14-16px | Regular (400) | 1.5x |
| Botones | 14px | Medium (500) | 1.5x |
| Info secundaria | 12px (solo timestamps, metadata) | Regular (400) | 1.4x |

Fuente del sistema (Inter o similar sans-serif). Respetar la configuracion de zoom del sistema operativo.

### Contraste de Colores

Todas las combinaciones de texto/fondo deben cumplir WCAG AA:
- Ratio minimo **4.5:1** para texto normal
- Ratio minimo **3:1** para texto grande (18px+ bold o 24px+ regular)
- Probar con simulador de daltonismo (Coblis) antes de cada release

### Tamano de Elementos Interactivos

| Elemento | Tamano minimo | Espaciado minimo |
|----------|--------------|-----------------|
| Botones | 48 x 48px | 12px entre botones |
| Inputs de formulario | 48px de alto | 8px entre campos |
| Tarjetas seleccionables | 240 x 140px | 16px entre tarjetas |
| Checkboxes / Radios | 24 x 24px area clic | 12px entre opciones |
| Links en texto | Subrayado visible | N/A |

### Navegacion por Teclado

| Tecla | Accion |
|-------|--------|
| Tab | Avanzar al siguiente elemento interactivo |
| Shift+Tab | Retroceder al elemento anterior |
| Enter | Confirmar / Activar boton seleccionado |
| Escape | Cerrar modal, panel o menu. Cancelar accion en curso |
| Ctrl+Z | Deshacer ultima accion |
| Ctrl+K | Abrir busqueda global |
| Ctrl+N | Nueva cotizacion |
| Alt+1 a Alt+9 | Saltar al modulo 1-9 de la barra lateral |
| Flechas | Navegar entre tarjetas, filas de tabla, opciones |

Focus visible: todo elemento enfocado muestra borde azul de 2px (`outline: 2px solid #3b82f6`).

### Paleta de Colores del Sistema

```css
/* Colores de estado — siempre acompanados de texto + icono */
--status-success: #10b981;   /* Verde — Completado, Pagado, Entregado */
--status-warning: #f59e0b;   /* Amarillo — Proximo, Parcial, Atencion */
--status-error: #ef4444;     /* Rojo — Atrasado, Sin abono, Urgente */
--status-info: #3b82f6;      /* Azul — En progreso, Confirmado, Listo */
--status-neutral: #9ca3af;   /* Gris — Cotizado, Inactivo, Borrador */

/* Fondos para badges/tarjetas de estado */
--bg-success: #f0fdf4;       /* Verde claro */
--bg-warning: #fffbeb;       /* Amarillo claro */
--bg-error: #fef2f2;         /* Rojo claro */
--bg-info: #f0f9ff;          /* Azul claro */
--bg-neutral: #f9fafb;       /* Gris claro */

/* Texto */
--text-primary: #1f2937;     /* Texto principal oscuro */
--text-secondary: #6b7280;   /* Texto secundario gris */

/* Bordes */
--border-light: #e5e7eb;     /* Borde claro */

/* Acento (botones primarios, seleccion) */
--accent: #3b82f6;           /* Azul principal */
--accent-hover: #2563eb;     /* Azul hover */
```

**Regla fundamental**: NUNCA usar color solo para comunicar estado. Siempre combinar:
- Color de fondo o borde
- Texto descriptivo (ej: "ATRASADO", "Pagado", "En proceso")
- Icono (ej: reloj para urgente, check para completado, circulo para en progreso)

### Formato de Datos

| Tipo | Formato correcto | Formato incorrecto |
|------|------------------|--------------------|
| Fechas | "25 de Abril de 2026" | "2026-04-25" |
| Moneda | $1.234.567 | $1234567 |
| Telefonos | 301 234 5678 | 3012345678 |
| Atajos de fecha | "Hoy", "Manana", "Proximo lunes" | Solo calendario |

---

## 3. Sistema de Onboarding

### Wizard de Primera Ejecucion

Al abrir la app por primera vez, se muestra un wizard de 4 pantallas:

**Pantalla 1 — Bienvenida**
- Logo de CasaAlberto + mensaje: "Bienvenido a tu nueva herramienta de trabajo"
- Opcion: "Explorar con datos de ejemplo" o "Comenzar en limpio"
- Si elige datos de ejemplo: se cargan 4 clientes ficticios, 10 pedidos y 5 facturas

**Pantalla 2 — Datos del Negocio**
- Campos: Nombre del negocio, RUT, telefono, direccion, logo (opcional)
- Estos datos se usan en facturas, cotizaciones y contratos
- Boton: "Guardar y continuar"

**Pantalla 3 — Precios Iniciales**
- Opcion A: "Importar desde Excel" — sube archivo .xlsx con lista de marcos, vidrios, etc.
- Opcion B: "Ingresar manualmente despues" — salta al siguiente paso
- Mensaje: "Puedes agregar y editar precios en cualquier momento desde el Cotizador"

**Pantalla 4 — Tour Rapido**
- Tour interactivo de 8 pasos con tooltips que resaltan cada zona:
  1. Barra lateral: "Aqui estan todos los modulos de la app"
  2. Dashboard zonas: "Esto es lo primero que ves cada dia"
  3. Botones de accion rapida: "Desde aqui creas cotizaciones y pedidos"
  4. Centro de alertas: "La app te avisa cuando algo necesita atencion"
  5. Cotizador: "Aqui calculas precios automaticamente"
  6. Pedidos: "Aqui controlas todos tus trabajos"
  7. Facturas: "Genera e imprime facturas digitales"
  8. Busqueda: "Busca cualquier cliente, pedido o factura con Ctrl+K"
- Boton "Saltar tour" visible en cada paso
- Se puede repetir: Config → Ayuda → "Repetir tour"

### Datos de Ejemplo

Si el usuario elige "Explorar con datos de ejemplo":
- 4 clientes: "Carlos Perez", "Maria Garcia", "Juan Lopez", "Ana Rodriguez" con datos ficticios
- 10 pedidos en distintos estados (cotizado, confirmado, en proceso, listo, entregado)
- 5 facturas (2 pagadas, 2 parciales, 1 pendiente)
- 3 estudiantes de clase con pagos de ejemplo
- 2 proveedores ficticios

Banner permanente amarillo en la parte superior: "Estas usando datos de ejemplo. [Limpiar datos de ejemplo]"
Al limpiar: confirmacion "Se eliminaran todos los datos de ejemplo. Tus datos reales no se afectan. Continuar?"

### Ayuda Contextual

**Iconos "?" con tooltip** junto a terminos que pueden confundir:
- Paspartu: "Marco interior de carton o MDF que rodea la imagen. Da profundidad y protege." + imagen de ejemplo
- Vidrio Antirreflectivo: "Vidrio tratado que no produce brillo. Ideal para cuadros con iluminacion directa." + imagen comparativa
- Retencion en la fuente: "Cuando un cliente empresa paga, retiene 2-5% para el gobierno. Se descuenta del total."
- Consecutivo: "Numero que la app asigna automaticamente a cada factura. Nunca se repite."
- Kanban: "Tablero visual con columnas. Cada columna es un estado del trabajo."

**Seccion de Ayuda en Config**:
- Acceso: Config → Ayuda
- Contenido: Videos cortos (2-3 min) para cada modulo principal
- Temas: "Como crear una cotizacion", "Como registrar un pedido", "Como imprimir una factura", "Como registrar un cobro"
- Glosario de terminos tecnicos con definiciones simples

---

## 4. Navegacion Principal

La app usa una barra lateral izquierda fija con iconos y texto para cada modulo. El Dashboard es la pantalla de inicio.

### Barra Lateral

Ancho: 240px. Fondo: gris claro (#f8f9fa). Cada item mide 44px de alto.

| Icono | Modulo | Descripcion | Atajo |
|-------|--------|-------------|-------|
| Casa | Dashboard | Inicio — Vista del dia | Alt+1 |
| Calculadora | Cotizador | Nueva cotizacion | Alt+2 |
| Clipboard | Pedidos | Trabajos activos | Alt+3 |
| Recibo | Facturas | Facturacion | Alt+4 |
| Personas | Clientes | Base de clientes | Alt+5 |
| Paleta | Clases | Dibujo y pintura | Alt+6 |
| Moneda | Finanzas | Ingresos y gastos | Alt+7 |
| Camion | Proveedores | Directorio | Alt+8 |
| Documento | Contratos | Cotizaciones formales | Alt+9 |
| Caja | Inventario | Stock de materiales | — |
| Engranaje | Config | Ajustes | — |

**Comportamiento**:
- Item activo: texto bold + fondo azul claro (#eff6ff) + borde izquierdo azul 4px
- Badges de alerta: circulo rojo con numero junto al nombre del modulo. Solo para items que requieren accion (no conteos generales)
- Hover: fondo gris mas oscuro, cursor pointer
- **Colapso**: Boton "<<" para reducir a 60px (solo iconos). Texto aparece como tooltip al pasar el mouse
- **Logo** en la parte superior: clic regresa al Dashboard
- **Indicador de backup** en la parte inferior: "Backup: hace 2h" en texto pequeno verde. Rojo si lleva mas de 24h sin backup

### Busqueda Global

Barra de busqueda en la parte superior de la pantalla principal (fuera del sidebar).

- Atajo: **Ctrl+K** abre el cuadro de busqueda desde cualquier pantalla
- Placeholder: "Buscar cliente, pedido, factura, proveedor..."
- Resultados agrupados por modulo:
  - Clientes: "Carlos Perez — Tel: 301 234 5678 — 12 pedidos"
  - Pedidos: "#P-0045 — Carlos Perez — Marco 50x70 — En proceso"
  - Facturas: "#F-0123 — $850.000 — Pagada"
- Busqueda instantanea mientras se escribe (debounce 200ms)
- Enter en un resultado navega directamente al detalle
- Ultimas 5 busquedas recientes visibles al abrir

### Breadcrumbs

Cuando se navega dentro de un modulo, mostrar ruta de navegacion:
- Dashboard > Clientes > Carlos Perez
- Dashboard > Pedidos > #P-0045
- Cada elemento es clickeable para navegar hacia atras

---

## 5. Dashboard — Pantalla Principal

Lo primero que el dueno ve al abrir la app cada dia. Muestra un resumen inteligente del estado del negocio.

*Problemas que resuelve: P-003 (control de pedidos), P-004 (incumplimiento de entregas), P-006 (sin control de costos)*

### Acciones Rapidas

Botones grandes en la parte superior del dashboard (48px alto minimo):

- **"+ Nueva Cotizacion"** → abre el Cotizador (Ctrl+N)
- **"+ Nuevo Pedido"** → abre formulario de pedido
- **"+ Registrar Cobro"** → registro rapido de ingreso
- **"+ Registrar Gasto"** → registro rapido de egreso

### Zona 1: Matriz de Urgencia de Pedidos (Vista Principal)

Cuadricula 2x2 que muestra el estado de los pedidos activos de un vistazo:

|  | Urgente (0-2 dias) | Normal (3+ dias) |
|--|-------------------|-----------------|
| **Sin abono ($0)** | ROJO — Conteo + "Urgentes sin pago" | AMARILLO — Conteo + "Pendientes de pago" |
| **Con abono** | AMARILLO — Conteo + "Proximos a entregar" | VERDE — Conteo + "En buen estado" |

- Cada cuadrante muestra el numero de pedidos en esa categoria
- Clic en un cuadrante expande la lista de pedidos correspondientes
- Los cuadrantes con 0 items se muestran en gris claro
- Pedidos atrasados (pasaron la fecha): se muestran como fila adicional roja arriba de la matriz con icono de alerta

**Vista alternativa: Timeline Vertical**
Toggle para cambiar a vista de timeline vertical, agrupada por urgencia:
- **Hoy** — pedidos que vencen hoy
- **Manana - 2 dias** — urgencia media
- **3 - 8 dias** — en buen tiempo
- **8+ dias** — sin prisa

Cada tarjeta en el timeline muestra: nombre del cliente, tipo de trabajo, dias restantes, barra de pago (abono vs total), badge de estado con texto + icono.

### Zona 2: Finanzas del Dia

Panel compacto que muestra el flujo de dinero en tiempo real:

- **Ingresos del dia**: lo que entro (cobros, abonos) — texto verde
- **Gastos del dia**: lo que salio (materiales, proveedores) — texto rojo
- **Balance**: ingresos menos gastos — verde si positivo, rojo si negativo
- **Tendencia**: flecha y porcentaje vs mismo dia de la semana pasada
- Se actualiza automaticamente cada vez que se registra un cobro o gasto
- Boton "Ver resumen del mes" → navega a Finanzas

### Zona 3: Centro de Alertas

Notificaciones consolidadas de todos los modulos, ordenadas por prioridad. Cada alerta tiene icono + texto descriptivo + color de fondo:

| Prioridad | Alerta | Color | Icono |
|-----------|--------|-------|-------|
| 1 | Pedidos atrasados (pasaron fecha de entrega) | Rojo + "ATRASADO" | Reloj con exclamacion |
| 2 | Entregas proximas (faltan 2 dias, trabajo no terminado) | Amarillo + "PROXIMO" | Calendario |
| 3 | Pedidos sin abono ($0 abonado) | Amarillo + "SIN PAGO" | Moneda tachada |
| 4 | Cuadros sin reclamar (+15 dias listos) | Gris + "SIN RECLAMAR" | Caja |
| 5 | Clase de dibujo hoy | Azul + "CLASE HOY" | Paleta de arte |
| 6 | Dia de pedido a proveedor | Azul + "PEDIR HOY" | Camion |
| 7 | Backup desactualizado (>24h) | Rojo + "SIN BACKUP" | Disco |

Cada alerta es clickeable y navega al item correspondiente.

### KPIs de Negocio (barra inferior del dashboard)

Tarjetas pequenas con metricas clave del mes:

- **Top 3 clientes**: Clientes con mas pedidos este mes
- **Servicio mas vendido**: Tipo de trabajo con mas cotizaciones
- **Comparacion vs mes anterior**: "Ingresos: $2.5M vs $2.1M (↑19%)"

---

## 6. Modulo 1 — Cotizador Digital

Automatiza todo el calculo de precios. El cliente escoge materiales, el dueno mete medidas y la app calcula el precio al instante con desglose completo.

*Problemas que resuelve: P-008 (listas de precios en papel), base para P-001 y P-006*

### Pantalla Principal: Seleccion por Tarjetas

Al entrar al cotizador, el dueno ve tarjetas grandes (240x140px) en grid de 2x4 con icono para seleccionar el tipo de trabajo:

| Tarjeta | Descripcion | Flujo |
|---------|-------------|-------|
| Enmarcacion Estandar | Marco + vidrio + respaldo | Wizard completo (5 pasos) |
| Con Paspartu | Marco + paspartu + vidrio | Wizard completo + paspartu activo |
| Acolchado | MDF + espuma + pegado | Formula acolchado + marco opcional |
| Retablo | 4 listones + tapa MDF | Seleccion directa por medida |
| Bastidor | Estructura para lienzo | Seleccion directa por medida |
| Tapa Portarretrato | Tapa de reemplazo | Seleccion directa por medida |
| Restauracion | Reparacion de piezas | Precio libre (criterio del dueno) |
| Vidrio/Espejo | Cotizacion a domicilio | Precio por m2 + instalacion |

**Estado de tarjeta**:
- Sin seleccionar: fondo blanco, borde gris claro 1px
- Hover: fondo azul claro (#f0f7ff), borde azul (#2563eb)
- Seleccionada: fondo azul (#2563eb), texto blanco, checkmark arriba a la derecha

**Accesos rapidos debajo de las tarjetas**:
- "Ultimas 10 cotizaciones" — lista de cotizaciones recientes con boton "Duplicar"
- "Usar plantilla" — lista de plantillas guardadas por el usuario

### Wizard de Enmarcacion (flujo principal — 5 pasos)

Al seleccionar enmarcacion estandar o con paspartu, se abre un wizard paso a paso. El panel de precio se muestra fijo a la derecha (25% del ancho en desktop), actualizandose en tiempo real.

**Indicador de progreso**: Barra con 5 puntos conectados. Punto activo azul relleno, completados verdes con check, pendientes grises vacios. Texto del nombre de cada paso debajo.

**Paso 1 — Medidas**
- Campos: Ancho (cm) y Alto (cm)
- Validacion en tiempo real: no puede ser 0, negativo, ni mayor a 500
- Mensaje de error inline: "El ancho debe ser mayor a 0 cm" (borde rojo + texto rojo debajo del campo)
- Icono "?" junto al titulo: "Mide el ancho y alto de la pieza que vas a enmarcar, en centimetros"

**Paso 2 — Marco**
- Busqueda por referencia con autocompletado: escribir "Roble" muestra todas las opciones de roble
- Al seleccionar, muestra: nombre de referencia, colilla (imagen si disponible), precio por metro
- Calculo automatico del perimetro y costo del marco
- Si el marco seleccionado tiene stock registrado y no alcanza: aviso amarillo "Stock bajo: 2m disponibles"

**Paso 3 — Paspartu y Vidrio (opcional)**
- Seccion dividida en dos areas lado a lado (o tabs si pantalla pequena)
- **Paspartu** (izquierda):
  - Toggle: "Incluir paspartu" (apagado por defecto)
  - Si activo: tarjetas — Pintado (carton) o Acrilico (MDF)
  - Slider para ancho del paspartu: 2cm a 10cm
  - La app recalcula dimensiones del marco y vidrio automaticamente
  - Icono "?": "El paspartu es el borde interior que rodea la imagen" + imagen de ejemplo
- **Vidrio** (derecha):
  - Toggle: "Incluir vidrio" (encendido por defecto)
  - Si activo: tarjetas — Claro ($100.000/m2) o Antirreflectivo ($115.000/m2)
  - La app redondea de 10 en 10 y muestra el calculo
  - Icono "?": "El vidrio antirreflectivo no produce brillo. Ideal para cuadros con luz directa" + foto comparativa

**Paso 4 — Materiales Adicionales**
- Slider del 5% al 10% con el monto calculado visible
- Texto explicativo: "Cubre clavos, grapas, ganchos, papel kraft y otros materiales de armado"
- Valor por defecto: 10% (configurable en Config)

**Paso 5 — Resumen**
- Desglose completo:
  - Marco: referencia, metros, precio/metro, subtotal
  - Paspartu: tipo, medidas, subtotal (si aplica)
  - Vidrio: tipo, area, precio/m2, subtotal (si aplica)
  - Materiales adicionales: porcentaje, subtotal
  - **TOTAL** en texto grande y bold
- Botones de accion (48px alto):
  - **"Crear Pedido"** → abre formulario de pedido con datos precargados (boton primario azul)
  - **"Imprimir Cotizacion"** → vista previa + imprimir (boton secundario)
  - **"Guardar Cotizacion"** → guarda en historial
  - **"Guardar como Plantilla"** → guarda para reutilizar con nombre personalizado

**Panel de Precio en Tiempo Real (lateral derecho)**
- Fijo en el costado derecho, visible durante todos los pasos
- Muestra desglose parcial que se actualiza al cambiar cualquier valor
- Cuando un precio se actualiza: flash amarillo de 1 segundo en el monto que cambio
- En pantallas menores a 1200px: el panel se colapsa y aparece como barra fija en la parte inferior

**Navegacion del Wizard**:
- Boton "Siguiente" (azul, deshabilitado si hay campos requeridos vacios)
- Boton "Atras" (gris, deshabilitado en paso 1)
- Boton "Guardar borrador" (texto gris) — guarda la cotizacion incompleta para continuar despues
- Al cerrar sin guardar: confirmacion "Tienes una cotizacion sin guardar. Guardar borrador o descartar?"

### Duplicar y Plantillas

**Duplicar cotizacion**:
- En "Ultimas 10 cotizaciones", cada item tiene boton "Duplicar"
- Crea una copia editable con todos los datos de la cotizacion original
- El usuario modifica solo lo que cambia (ej: nuevas medidas) y el precio se recalcula

**Plantillas**:
- Desde el Resumen del wizard: "Guardar como plantilla" → dar nombre (ej: "Marco Roble 20x30")
- En la pantalla principal del cotizador: "Usar plantilla" → lista de plantillas guardadas
- Seleccionar plantilla precarga todos los datos → el usuario ajusta medidas → precio recalculado

### Sub-seccion: Listas de Precios

Accesible desde el cotizador con un boton "Gestionar Precios". Pestanas para cada lista.

Funcionalidades:
- Ver y editar precios en tabla con busqueda instantanea
- Agregar nueva referencia, editar existente, eliminar (con confirmacion)
- Importar desde Excel (.xlsx) con validacion de formato: "Se importaron 45 marcos. 3 filas tienen errores (ver detalle)"
- Exportar a Excel para respaldo
- Historial de cotizaciones recientes (por si el cliente vuelve)
- Campo opcional "Stock disponible" por referencia (vinculado al modulo de Inventario)

---

## 7. Modulo 2 — Gestion de Pedidos

El tablero de control de todos los trabajos activos. Reemplaza los cartones y libretas con un sistema visual de estados y alertas automaticas.

*Problemas que resuelve: P-003 (control en carton), P-004 (incumplimiento de entregas)*

### Pantalla Principal: Tablero Kanban

Vista tipo tablero con columnas por estado. Cada pedido es una tarjeta que se puede mover entre columnas.

| Columna | Descripcion | Color de tarjeta |
|---------|-------------|-----------------|
| Cotizado | Se hizo cotizacion pero el cliente no confirmo | Gris + "COTIZADO" |
| Confirmado | Cliente acepto y se recibio la pieza | Azul + "CONFIRMADO" |
| En proceso | El trabajo esta siendo elaborado | Verde/Amarillo/Rojo segun urgencia + dias restantes |
| Listo | Terminado, esperando recogida | Azul con pulso + "LISTO" |
| Entregado | Cliente recogio y pago saldo | Verde + icono check + "ENTREGADO" |
| Sin reclamar | +15 dias listo sin recoger | Rojo + "SIN RECLAMAR +15 DIAS" |

**Conteo por columna** en el header: "En proceso (12)" — en rojo si alguno esta atrasado.

**Interaccion con tarjetas**:
- **Drag-and-drop**: Arrastrar tarjeta de una columna a otra. Feedback visual: sombra, transparencia 70%
- **Alternativa clic derecho**: Menu contextual → "Mover a: Confirmado / En proceso / Listo / Entregado"
- **Confirmacion al mover**: Dialog "Cambiar estado de #P-0045 a 'Listo'?" con Cancelar / Aceptar
- **Deshacer**: Toast de 10 segundos "Movido a Listo. [Deshacer]" (Ctrl+Z tambien funciona)

**Manejo de columnas con muchos items**:
- Primeras 5 tarjetas visibles
- Si hay mas: boton "+N mas" que expande la columna con scroll
- Scroll virtual (react-window) para columnas con 50+ items

### Tarjeta de Pedido

Cada tarjeta muestra:
- **Nombre del cliente** (bold, 14px)
- **Tipo de trabajo** + descripcion corta (12px, gris)
- **Fecha de entrega** con indicador de dias restantes: "Entrega: 15 Abr (2 dias)" — color segun urgencia
- **Barra de progreso de pago**: abono vs total (ej: barra 60% llena = ha pagado 60%)
- **Badge de alerta** si aplica: "SIN ABONO" (rojo), "ATRASADO" (rojo), "SIN RECLAMAR" (gris)

### Vista Alternativa: Lista

Tabla ordenable y filtrable sincronizada con el Kanban. Cambios en una vista se reflejan en la otra en tiempo real.

| Columna | Tipo | Ordenable |
|---------|------|-----------|
| # | Numero de pedido | Si |
| Cliente | Nombre | Si |
| Trabajo | Tipo y descripcion | No |
| Fecha ingreso | Fecha | Si |
| Fecha entrega | Fecha | Si |
| Total | Monto | Si |
| Abono | Monto | Si |
| Saldo | Calculado | Si |
| Estado | Badge con texto+color | Si (filtrable) |

- Busqueda por nombre, numero o fecha
- Filtros como tags removibles: [En proceso x] [Atrasado x] [Este mes x]
- Paginacion: 25 filas, "Mostrando 25 de 87 resultados"
- Exportar tabla filtrada a Excel

**Vista dual recomendada**: Kanban (70% ancho) + Lista (30% ancho) lado a lado en pantallas >1400px.

### Detalle del Pedido

Al hacer clic en una tarjeta, se abre panel lateral derecho (no reemplaza la vista):

- **Datos del cliente**: nombre, telefono (clic para llamar), direccion
- **Descripcion completa** del trabajo y especificaciones
- **Desglose de cotizacion**: materiales, precios, formulas usadas
- **Historial de pagos**: tabla con fecha, monto, metodo (Efectivo/Transferencia/Tarjeta/Cheque)
- **Cambio de estado** con un clic (botones de estado, no dropdown)
- **Boton "Registrar Abono"** para pagos parciales → abre mini-formulario:
  - Monto (campo numerico grande + botones rapidos: $50.000, $100.000, $200.000)
  - Metodo de pago (4 botones grandes: Efectivo, Transferencia, Tarjeta, Cheque)
  - Confirmar
- **Boton "Generar Factura"** → crea factura con datos precargados
- **Boton "Llamar cliente"** → abre telefono del sistema
- **Historial de cambios**: registro de todos los cambios de estado con fecha y hora

### Sistema de Alertas del Modulo

Todas las alertas incluyen texto descriptivo + icono + color:

| Condicion | Alerta | Accion sugerida |
|-----------|--------|----------------|
| Pedido con $0 abonado | "SIN ABONO" badge rojo al registrar | Recordar al cliente |
| Faltan 2 dias, trabajo no en 'Listo' | "PROXIMO" badge amarillo | Priorizar trabajo |
| Paso la fecha de entrega | "ATRASADO" badge rojo | Contactar cliente |
| +15 dias en estado 'Listo' | "SIN RECLAMAR" badge gris | Llamar cliente |

---

## 8. Modulo 3 — Facturacion Digital

Reemplaza las factureras de papel. Genera facturas con consecutivo automatico, permite busqueda instantanea, impresion y envio por correo.

*Problemas que resuelve: P-001 (facturacion en papel)*

### Generacion de Factura

La factura se puede crear desde el modulo de Pedidos (boton "Generar Factura") o directamente desde este modulo. Los datos se precargan del pedido si viene de ahi.

**Deteccion de duplicados**: Si ya existe una factura para el pedido seleccionado, la app muestra: "Ya existe la factura #F-0123 para este pedido. [Ver factura existente] o [Crear nueva de todas formas]"

Campos de la factura:

| Campo | Comportamiento |
|-------|---------------|
| Numero consecutivo | Autogenerado, secuencial, no editable |
| Fecha | Fecha de creacion (automatica, formato: "12 de Abril de 2026") |
| Cliente | Nombre, telefono, cedula (autocompletado si ya existe) |
| Descripcion | Tipo de trabajo y especificaciones |
| Desglose | Marco, vidrio, paspartu, materiales adicionales |
| Total | Precio final calculado (formato: $1.234.567) |
| Abono | Lo que pago el cliente |
| Saldo | Total - Abono (autocalculado) |
| Metodo de pago | Efectivo / Transferencia / Tarjeta / Cheque |
| Fecha de entrega | Cuando puede recoger el trabajo |

### Acciones de la Factura

- **Vista previa**: Siempre se muestra antes de imprimir. Muestra exactamente como se vera en papel
- **Imprimir**: Genera PDF optimizado para impresion (original y copia). Opciones:
  - Tamano Carta/A4 (impresora laser)
  - Recibo termico 80mm (impresora POS)
  - Blanco y negro (para ahorrar tinta)
- **Enviar por correo**: Envia la factura como PDF adjunto al email del cliente
  - Asunto: "[FACTURA] #F-0123 - CasaAlberto"
  - Cuerpo: Saludo + numero de factura + total + fecha de entrega + datos de pago
- **Registrar abono**: Agrega un pago parcial o total al saldo (con metodo de pago)
- **Devolucion**: Registra devolucion vinculada al pedido con motivo obligatorio. Confirmacion: "Registrar devolucion por $X. Motivo: [campo]. Esta seguro?"

### Busqueda de Facturas

Barra de busqueda con filtros:
- Por numero, nombre del cliente, fecha, estado (pendiente, pagada, devuelta)
- Resultados instantaneos mientras se escribe
- Filtros como tags: [Pendiente x] [Abril 2026 x]
- Tabla con ordenamiento por columna
- Exportar resultados a Excel

### Layout de Impresion (Estandar Colombiano)

```
+--------------------------------------------------+
|  [LOGO]              CASAALBERTO                  |
|                      Arte - Diseno - Decoracion   |
|                      RUT: xxx.xxx.xxx-x           |
|                      Tel: 301 234 5678            |
|                      Cra XX #XX-XX, Verbenal      |
+--------------------------------------------------+
|  FACTURA DE VENTA  #F-0123                        |
|  Fecha: 12 de Abril de 2026                       |
+--------------------------------------------------+
|  CLIENTE:                                         |
|  Nombre: Carlos Perez                             |
|  Cedula: xx.xxx.xxx    Tel: 301 xxx xxxx          |
|  Direccion: Calle XX #XX-XX                       |
+--------------------------------------------------+
|  Descripcion         | Cant | V. Unit  | Total   |
|  --------------------|------|----------|---------|
|  Marco Roble 50x70   |  1   | $450.000 | $450.000|
|  Vidrio claro 50x70  |  1   | $280.000 | $280.000|
|  Mat. adicionales 10% |  1  | $73.000  | $73.000 |
+--------------------------------------------------+
|                           Subtotal:  $803.000     |
|                           TOTAL:     $803.000     |
|                                                   |
|                           Abonado:   $400.000     |
|                           SALDO:     $403.000     |
+--------------------------------------------------+
|  Fecha de entrega: 20 de Abril de 2026            |
|  Forma de pago: Efectivo                          |
+--------------------------------------------------+
|                                                   |
|  Firma del cliente: ________________________      |
|                                                   |
|  Gracias por su compra                            |
+--------------------------------------------------+
```

- Fuente en impresion: 12pt+ para legibilidad
- Alto contraste (negro sobre blanco)
- Margenes: 1cm en todos los lados
- Original + Copia en paginas separadas

---

## 9. Modulo 4 — Clientes

Base de datos centralizada de todos los clientes. Reemplaza la informacion dispersa en facturas de papel con historial automatico, frecuencia y total gastado.

*Problemas que resuelve: P-002 (sin historial de clientes)*

### Pantalla Principal: Directorio de Clientes

Lista de clientes con tarjetas compactas. Cada tarjeta muestra:
- Iniciales del nombre como avatar (circulo de color)
- Nombre completo (bold)
- Telefono (clic para llamar)
- Estadisticas rapidas: total gastado, cantidad de pedidos, ultima visita

Funcionalidades:
- **Busqueda instantanea** por nombre, telefono o cedula (Ctrl+K tambien funciona)
- **Filtros como tags**: Todos, Frecuentes (3+ pedidos), Con saldo pendiente, Estudiantes de clase
- **Boton "+ Nuevo Cliente"** para registro rapido (48px alto)
- **Ordenamiento**: Por nombre, total gastado, ultima visita, cantidad de pedidos

### Ficha del Cliente

Al hacer clic en un cliente, se abre su ficha completa:

**Datos personales**:
- Nombre completo, telefono, direccion, cedula, correo electronico
- Para menores (clases): nombre y telefono del acudiente
- Boton "Editar" para modificar datos. Boton "Archivar" para desactivar (nunca eliminar si tiene pedidos)

**Estadisticas automaticas** (calculadas por la app, no editables):
- Total gastado historico (suma de todas las facturas pagadas)
- Cantidad de pedidos realizados
- Ultima visita (fecha del ultimo pedido): "Hace 45 dias (27 de Febrero de 2026)"
- Saldo pendiente consolidado (si debe algo) — destacado en rojo si > $0

**Historial de pedidos**:
- Lista cronologica de todos los pedidos del cliente con estado y monto
- Clic en cualquier pedido abre el detalle completo
- Filtrable por estado y rango de fechas

**Proteccion**:
- Si se intenta archivar un cliente con pedidos activos: "No se puede archivar. Carlos Perez tiene 2 pedidos pendientes."
- Si se intenta archivar un cliente con saldo: "Carlos Perez tiene saldo pendiente de $403.000. Archivar de todas formas?" con confirmacion doble

---

## 10. Modulo 5 — Clases de Dibujo y Pintura

Gestiona las clases, los estudiantes, los pagos mensuales y el horario. Evita conflictos entre clases y salidas del dueno.

*Problemas que resuelve: P-005 (conflicto clases vs salidas)*

### Pantalla Principal: Calendario de Clases

Vista semanal que muestra los bloques de clase programados como barras horizontales en un grid de horarios.

```
          Lunes    Martes   Miercoles  Jueves   Viernes   Sabado
 9:00   |         |[DIBUJO |          |         |          |
10:00   |         | 9-11am]|          |         |          |
11:00   |         |  8 est.|          |         |          |
 2:00   |         |        |[PINTURA  |         |          |
 3:00   |         |        | 2-4pm]   |         |          |
 4:00   |         |        |  5 est.  |         |          |
```

- Bloques de clase muestran: nombre, horario, cantidad de estudiantes
- Hover sobre un bloque: muestra lista de estudiantes y estado de pago
- Clic en un bloque: abre detalle con asistencia y pagos
- **HOY** resaltado con borde azul grueso + banner en Dashboard

**Crear/editar bloques de clase**: dia, hora inicio, hora fin, nombre de la clase
**Vista mensual** para ver el patron de clases del mes completo

**Deteccion de conflictos**: Si el dueno registra una actividad o cita durante horario de clase, alerta naranja: "Tienes clase de Dibujo el martes de 9 a 11am. Crear evento de todas formas?"

### Gestion de Estudiantes

Lista de estudiantes activos con tarjeta por cada uno:
- Nombre, telefono, fecha de ingreso
- Datos del acudiente (para menores de edad)
- **Estado del pago mensual**: badge verde "PAGADO", amarillo "PARCIAL", rojo "PENDIENTE"
- **Grid de pagos recientes** (ultimos 3 meses):

| Estudiante | Abril | Marzo | Febrero |
|-----------|-------|-------|---------|
| Ana Lopez | PAGADO | PAGADO | PAGADO |
| Pedro Ruiz | PENDIENTE | PAGADO | PAGADO |
| Laura Garcia | PARCIAL | PAGADO | PAGADO |

- Ordenamiento por defecto: estudiantes con pago pendiente primero

### Control de Pagos Mensuales

Al inicio de cada mes, la app genera automaticamente los registros de pago para cada estudiante activo ($110.000).

- Toast de notificacion: "Pagos de Abril generados para 8 estudiantes"
- El dueno marca como pagado cuando el estudiante paga (boton grande "Registrar Pago")
- Metodo de pago: Efectivo / Transferencia
- Badge de alerta si un estudiante lleva mas de 5 dias del mes sin pagar
- Se registra automaticamente como ingreso en Finanzas

### Venta de Kits

Boton rapido: "Vender Kit de Dibujo — $15.000"
- Seleccionar estudiante de la lista
- Confirmar venta
- Se registra como ingreso en Finanzas vinculado al estudiante

---

## 11. Modulo 6 — Finanzas

Visibilidad completa de la salud financiera del negocio. Reemplaza el libro de entradas y salidas con registro digital, graficas y reportes.

*Problemas que resuelve: P-006 (sin control de costos)*

### Pantalla Principal: Resumen Financiero

Vista del mes actual con 4 tarjetas de metricas clave (cada una con monto, flecha de tendencia y comparacion vs mes anterior):

| Tarjeta | Color | Contenido |
|---------|-------|-----------|
| Ingresos del mes | Verde | $2.450.000 ↑12% vs marzo |
| Gastos del mes | Rojo | $1.200.000 ↓5% vs marzo |
| Ganancia neta | Azul | $1.250.000 ↑28% vs marzo |
| Saldos por cobrar | Amarillo | $803.000 (5 clientes deben) |

**Grafica principal: Area apilada de ingresos vs gastos por dia**
- Eje X: dias del mes (1-30)
- Area verde: ingresos diarios
- Area roja: gastos diarios
- El espacio entre ambas = ganancia visual
- Hover en cualquier dia: tooltip con valores exactos
- Texto explicativo debajo: "Este mes ganaste $150.000 mas que el anterior"

### Registro de Ingresos

Se registran automaticamente desde:
- Facturacion (abonos, pagos de saldo)
- Clases (pagos mensuales, venta de kits)

Tambien se pueden registrar manualmente:
- Descripcion, monto, categoria, fecha
- Categorias: Enmarcacion, Clases, Contratos, Restauracion, Otro

### Registro de Gastos

Formulario rapido:
- **Descripcion**: campo de texto libre
- **Monto**: campo numerico (formato: $0) + botones rapidos ($50.000, $100.000)
- **Categoria**: seleccion por tarjetas con icono
  - Materiales (icono: marco)
  - Servicios (icono: herramienta)
  - Transporte (icono: camion)
  - Arriendo (icono: casa)
  - Otro (icono: puntos)
- **Proveedor** (opcional): autocompletado desde modulo Proveedores
- **Fecha**: por defecto hoy, editable con selector de fecha

### Reportes

| Reporte | Contenido | Formato |
|---------|-----------|---------|
| Mensual | Ingresos, gastos, ganancia, desglose por categoria | Tabla + grafica |
| Por tipo de trabajo | Cuanto genera cada servicio (enmarcacion, retablos, clases, contratos) | Grafico de pastel |
| Saldos pendientes | Lista de clientes que deben dinero, ordenada por monto | Tabla |
| Comparacion mes a mes | Tendencia de ingresos/gastos/ganancia de los ultimos 12 meses | Grafico de lineas |

Cada reporte:
- Exportar a Excel o PDF
- Vista previa antes de imprimir
- Filtrable por rango de fechas

### Devoluciones

Las devoluciones se registran como movimiento negativo vinculado al pedido original.
- Campos: monto, motivo (obligatorio), fecha
- Confirmacion: "Registrar devolucion de $X por motivo: [texto]. Esta seguro?"
- Se reflejan en los reportes financieros como ingresos negativos
- Badge en la factura original: "DEVOLUCION" en rojo

---

## 12. Modulo 7 — Proveedores

Directorio organizado de proveedores con dias de pedido, productos que suministran y forma de pago. Reemplaza los contactos sueltos en el telefono.

*Problemas que resuelve: P-007 (proveedores sin directorio)*

### Pantalla Principal: Directorio

Tarjetas de proveedor con informacion clave visible de un vistazo:
- Nombre/empresa (bold), producto que suministra
- Telefono (clic para llamar)
- Dias de pedido (badges: "Lun", "Mie")
- Forma de pago y forma de entrega
- Notas adicionales

### Alerta de Dia de Pedido

Si hoy es un dia de pedido de algun proveedor (ej: lunes o miercoles para marcos), se muestra:
- Alerta en el Dashboard: "HOY es dia de pedido: [nombre proveedor] — [producto]" con boton "Llamar"
- Badge azul en el modulo Proveedores en la barra lateral

### Importar/Exportar

- Importar lista completa desde Excel (.xlsx) con validacion: "Se importaron 12 proveedores. 1 fila tiene errores (ver detalle)"
- Exportar directorio a Excel para respaldo
- Agregar, editar o eliminar proveedores individualmente (eliminar requiere confirmacion)

---

## 13. Modulo 8 — Documentos de Contratos

Genera automaticamente cotizaciones formales y cuentas de cobro para contratos con conjuntos residenciales y entidades, usando la plantilla del negocio.

*Problemas que resuelve: Del Bloque F.3 de la Fase 2*

### Generacion de Cotizacion Formal

Formulario paso a paso que genera un documento PDF con la plantilla del negocio:

1. **Datos del cliente/conjunto**: nombre, NIT/cedula, direccion, contacto
   - Autocompletado si el cliente ya existe en la base de datos
2. **Descripcion del trabajo**: tipo, medidas, especificaciones
   - Campo de texto enriquecido con formato basico (bold, listas)
3. **Precio**: desglose de materiales, mano de obra, instalacion
   - Tabla editable con filas: Descripcion | Cantidad | Valor unitario | Total
   - Subtotal y total autocalculados
4. **Condiciones**: tiempo de entrega, forma de pago, garantia
   - Valores por defecto configurables en Config (ej: "8 dias habiles", "50% anticipo")
   - Icono "?" junto a "Retencion en la fuente": "Si el cliente es empresa grande, retienen 2-5% para el gobierno"
5. **Vista previa**: documento generado con datos del negocio (nombre, RUT, telefono, logo)
   - Vista previa exacta del PDF final
6. **Exportar**: como PDF o Word para imprimir o enviar por correo

### Generacion de Cuenta de Cobro

Si la cotizacion es aprobada, se genera la cuenta de cobro con la misma plantilla.
- Incluye retencion en la fuente cuando aplica (toggle + campo de porcentaje)
- Se puede generar directamente desde la cotizacion aprobada (boton "Generar Cuenta de Cobro")
- Misma vista previa y opciones de exportacion

### Historial de Contratos

Lista de todas las cotizaciones y cuentas de cobro generadas:
- Estado: Enviada (azul), Aprobada (verde), Cobrada (verde oscuro), Rechazada (gris)
- Busqueda por cliente, fecha o monto
- Filtros como tags removibles
- Exportar lista a Excel

---

## 14. Modulo 9 — Inventario Basico (Nuevo)

Control opcional del stock de materiales principales. Permite saber si hay material disponible antes de cotizar y alerta cuando el stock esta bajo.

### Pantalla Principal: Stock de Materiales

Tabla con los materiales principales y su stock actual:

| Material | Referencia | Stock actual | Unidad | Minimo | Estado |
|----------|-----------|-------------|--------|--------|--------|
| Marco Roble Natural | MRN-001 | 12m | metros | 5m | BIEN (verde) |
| Vidrio Claro | VC-001 | 2m2 | m2 | 3m2 | BAJO (amarillo) |
| Vidrio Antirreflectivo | VA-001 | 0.5m2 | m2 | 2m2 | CRITICO (rojo) |
| Paspartu Carton | PC-001 | 8 laminas | unidades | 5 | BIEN (verde) |

- Busqueda instantanea por nombre o referencia
- Filtros: Todos, Stock bajo, Critico
- Ordenar por nombre, stock, estado

### Registro de Movimientos

**Entrada de material** (cuando llega pedido del proveedor):
- Seleccionar material, cantidad recibida, proveedor, fecha
- Se actualiza el stock automaticamente
- Se registra como gasto en Finanzas si se ingresa el costo

**Salida de material** (cuando se usa en un pedido):
- Opcion automatica: al crear pedido desde cotizacion, descontar materiales usados
- Opcion manual: registrar salida por material y cantidad

### Alertas de Inventario

- **Stock bajo** (amarillo): cuando el stock cae por debajo del minimo configurado
- **Stock critico** (rojo): cuando el stock llega a 0
- Alertas visibles en el Dashboard y en el Cotizador (al seleccionar material con poco stock)
- Integracion con Proveedores: "Vidrio antirreflectivo esta bajo. Proveedor: Vidrios Colombia (Tel: 301 xxx). Hoy es dia de pedido."

### Configuracion de Inventario

- Activar/desactivar modulo de inventario (opcional)
- Configurar stock minimo por material
- Configurar si se descuenta automaticamente al crear pedidos

---

## 15. Configuracion

Ajustes tecnicos de la app. Manejado por el desarrollador, no por el dueno. Acceso discreto con icono de engranaje.

### Datos del Negocio

- Nombre completo: CasaAlberto - Arte - Diseno - Decoracion
- RUT, telefono, direccion (para plantillas de documentos)
- Logo (opcional, para facturas y cotizaciones)
- Correo electronico del negocio (para envio de facturas)
- Datos bancarios (para incluir en facturas: banco, tipo cuenta, numero)

### Respaldo de Datos

**Backup automatico diario** (activado por defecto, no se puede desactivar completamente):
- Frecuencia: Diario (cada 24h) o cada vez que se cierra la app
- Ubicacion: Carpeta Documentos del usuario, o carpeta personalizada (Dropbox, OneDrive)
- Retencion: 7 backups diarios + 4 backups semanales
- Indicador en barra lateral: "Backup: hace 2h" (verde si reciente, rojo si >24h)

**Botones manuales**:
- "Crear backup ahora" → copia el archivo .db a la ubicacion configurada
- "Restaurar backup" → muestra lista de backups por fecha, seleccionar y confirmar

**Verificacion de integridad**:
- Al iniciar la app: ejecutar PRAGMA integrity_check en SQLite
- Si detecta corrupcion: mostrar mensaje "Se detecto un problema con los datos. Restaurando desde el backup de ayer..." → restaurar automaticamente

### Ajustes de la App

| Ajuste | Valor por defecto | Descripcion |
|--------|------------------|-------------|
| Consecutivo de facturas | 1 | Desde que numero arranca. Tooltip: "Si cambias a 500, la proxima factura sera #F-0500" |
| Materiales adicionales | 10% | Porcentaje para materiales de armado |
| Precio vidrio claro | $100.000/m2 | Editable |
| Precio vidrio antirreflectivo | $115.000/m2 | Editable |
| Tiempo de entrega por defecto | 8 dias | Se usa como sugerencia al crear pedidos |
| Precio clase mensual | $110.000 | Se usa para generar pagos mensuales |
| Precio kit dibujo | $15.000 | Se usa para registrar ventas de kit |

### Seccion Ayuda

- **Repetir tour**: Lanza el tour guiado de 8 pasos desde el principio
- **Videos de ayuda**: Lista de videos cortos por modulo
- **Glosario**: Lista de terminos con definiciones simples
- **Version de la app**: Numero de version + boton "Buscar actualizaciones"

---

## 16. Manejo de Errores y Seguridad de Datos

### Principios de Manejo de Errores

1. **Prevencion** > Recuperacion: Validar datos antes de permitir la accion
2. **Mensajes en espanol claro**: "El ancho debe ser mayor a 0 cm" (no "Invalid input: width must be > 0")
3. **Sin datos perdidos**: Auto-guardado + backup + eliminacion suave
4. **Confianza del usuario**: Toda accion destructiva pide confirmacion; toda accion reversible ofrece deshacer

### Matriz de Errores y Recuperacion

| Escenario | Prevencion | Recuperacion |
|-----------|-----------|--------------|
| Campo vacio requerido | Borde rojo + "Este campo es obligatorio" | No se puede avanzar sin completar |
| Valor invalido (ancho = -5) | Validacion: "El ancho debe ser entre 1 y 500 cm" | Campo se limpia, foco vuelve al campo |
| Cambio de estado accidental | Dialog: "Cambiar a Entregado?" + Cancelar/Aceptar | Toast "Deshacer" por 10 segundos |
| Drag-and-drop accidental | Confirmacion al soltar tarjeta | Ctrl+Z deshace el movimiento |
| Factura duplicada | "Ya existe factura para este pedido. Ver existente?" | Opcion de ver la existente o crear nueva |
| Eliminar cliente con pedidos | "No se puede eliminar. Tiene 2 pedidos pendientes" | Boton "Archivar" disponible |
| Eliminar cliente con saldo | "Tiene saldo de $403.000. Archivar?" + doble confirmacion | Archivado, recuperable desde Config |
| Crash de la app | Auto-guardado cada 30 segundos | Al reiniciar: "Hay datos sin guardar. Recuperar?" |
| Corrupcion de base de datos | PRAGMA integrity_check al iniciar | Restauracion automatica desde backup |
| Cierre sin guardar cotizacion | Dialog: "Guardar borrador o descartar?" | Borradores accesibles desde Cotizador |

### Auto-Guardado

- Frecuencia: cada 30 segundos si hay cambios sin guardar
- Indicador visual: icono de nube/disco en esquina superior derecha
  - "Guardado" (gris, sin cambios)
  - "Guardando..." (azul, animacion)
  - "Sin guardar" (amarillo, hay cambios pendientes)

### Eliminacion Suave

Nunca se borran datos permanentemente. Todas las "eliminaciones" son archivados:
- Clientes: se marcan como inactivos, no aparecen en busquedas normales
- Pedidos: se marcan como cancelados, permanecen en historial
- Facturas: se marcan como anuladas, mantienen consecutivo
- Config → "Elementos archivados": lista de todo lo archivado con opcion de restaurar

---

## 17. Estandares de Impresion y PDF

### Tecnologia

- Generacion de PDF: **pdfkit** en el proceso principal de Electron (no HTML-to-PDF)
- Plantillas almacenadas como archivos JSON en `/resources/templates/`
- Datos del negocio cargados automaticamente desde Config

### Templates de Documentos

Se generan 4 tipos de documentos:

| Documento | Uso | Tamano |
|-----------|-----|--------|
| Factura de venta | Cada pedido entregado | Carta/A4 + Termico 80mm |
| Cotizacion rapida | Cotizaciones del Cotizador | Carta/A4 |
| Cotizacion formal | Contratos con entidades | Carta/A4 |
| Cuenta de cobro | Cobro a entidades | Carta/A4 |

### Especificaciones de Impresion

- **Fuente**: 12pt minimo en documentos impresos
- **Margenes**: 1cm en todos los lados (estandar para fotocopiado)
- **Contraste**: Negro sobre blanco (sin fondos de color en impresion)
- **Numeros**: Formato colombiano $1.234.567 (punto como separador de miles)
- **Firma**: Linea de firma fisica de 8cm en la parte inferior
- **Copia**: "ORIGINAL" en primera pagina, "COPIA" en segunda pagina
- **Fuentes embebidas**: No depender de fuentes del sistema en el PDF

### Impresion por Lotes

- Seleccionar rango de facturas: "Imprimir facturas de Abril 2026" o "Facturas #F-0100 a #F-0120"
- Vista previa de lote antes de imprimir
- Cada factura en pagina separada con salto de pagina

---

## 18. Priorizacion de Desarrollo

Los modulos se desarrollan en orden de impacto en los problemas criticos del negocio. La prioridad combina urgencia del problema + dependencia entre modulos:

| # | Prioridad | Modulo | Razon | Problemas |
|---|-----------|--------|-------|-----------|
| 1 | CRITICA | Cotizador Digital | Base de todo. Sin esto no hay pedidos ni facturas. | P-008 |
| 2 | CRITICA | Gestion de Pedidos | Resuelve el dolor mas grande: trabajos atrasados. | P-003, P-004 |
| 3 | CRITICA | Facturacion Digital | Depende de Cotizador y Pedidos. | P-001 |
| 4 | ALTA | Clientes | Centraliza datos que usan todos los modulos. | P-002 |
| 5 | ALTA | Dashboard | Necesita datos de Pedidos y Finanzas. | Todos |
| 6 | MEDIA | Finanzas | Se alimenta de facturas y pedidos. | P-006 |
| 7 | MEDIA | Clases de Dibujo | Modulo independiente. | P-005 |
| 8 | NORMAL | Proveedores | Complementario, bajo impacto inmediato. | P-007 |
| 9 | NORMAL | Documentos Contratos | 4-5 veces al mes, no urgente. | F.3 |
| 10 | NORMAL | Inventario Basico | Complementario, se puede agregar despues. | Nuevo |

**Elementos transversales** (implementar desde el inicio, no como modulo aparte):
- Onboarding (wizard primera vez + datos ejemplo)
- Sistema de backup automatico
- Busqueda global (Ctrl+K)
- Estandares de accesibilidad (tipografia, contraste, teclado)
- Manejo de errores y auto-guardado
- Sistema de impresion/PDF

**Recomendacion MVP**: Desarrollar los modulos 1 al 5 + elementos transversales como Producto Minimo Viable. Con esos modulos funcionando, el dueno ya puede cotizar, registrar pedidos, facturar, buscar clientes y ver el resumen diario. El resto se agrega iterativamente.

---

## 19. Roadmap Futuro (Post-MVP)

Funcionalidades para considerar en versiones futuras, no necesarias para el lanzamiento:

| Funcionalidad | Descripcion | Prioridad estimada |
|--------------|-------------|-------------------|
| Inventario completo | Alertas de reorden, historial de movimientos, costo promedio | Media |
| Notificaciones al cliente | SMS/WhatsApp: "Tu marco esta listo para recoger" | Media |
| Firma digital | Firmar contratos y cotizaciones formales dentro de la app | Baja |
| Modo alto contraste | Opcion en Config para mejorar visibilidad | Baja |
| Multi-usuario | Roles (admin/empleado) si el negocio contrata personal | Baja |
| App movil companera | Consultar pedidos y finanzas desde el celular | Baja |
| Integracion bancaria | Importar extractos bancarios para conciliar pagos | Baja |
| Codigo QR en facturas | QR que enlaza al detalle del pedido | Baja |
| Reportes avanzados | Tendencias, pronosticos, estacionalidad | Baja |
| Entrada por voz | Dictar medidas en vez de escribirlas | Futura |

---

## 20. Siguientes Pasos

Con la Fase 3 v2 completada, el proyecto avanza a:

1. **Fase 4 — Diseno de base de datos**: Crear el modelo de datos con todas las entidades, relaciones y validaciones documentadas en las Fases 2 y 3.
2. **Fase 5 — Diseno de interfaz**: Crear prototipos visuales (mockups) de las pantallas principales de cada modulo, aplicando los estandares de accesibilidad definidos.
3. **Fase 6 — Desarrollo**: Construir la aplicacion de escritorio con Electron + React + SQLite, siguiendo la priorizacion de modulos.

---

*Documento generado como parte del levantamiento de requerimientos para CasaAlberto - Arte - Diseno - Decoracion. Fase 3 v2 — Definicion de Funcionalidades (Mejorada).*

*Stack tecnologico: Electron 39 + React 19 + TypeScript + Tailwind CSS 4 + SQLite (better-sqlite3 + Drizzle ORM) + Recharts + Lucide Icons + pdfkit*
