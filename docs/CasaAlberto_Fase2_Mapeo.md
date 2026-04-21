# CasaAlberto - Arte - Diseño - Decoración — Fase 2: Mapeo del Negocio

**MARQUETERÍA CASAALBERTO**
Arte - Diseño - Decoración

**FASE 2 — MAPEO COMPLETO DEL NEGOCIO**
Flujos de trabajo, fórmulas de cotización, reglas de negocio y relaciones entre entidades

Bogotá, Colombia — Barrio Verbenal
Abril 2026

---

## Bloque A — Sistema de Cotización Completo

Este bloque documenta todas las fórmulas, reglas y lógica de precios que maneja CasaAlberto. Es el corazón de la aplicación.

### A.1 Cotización de Marco

Cada muestra de marco tiene tres datos fijos: referencia, colilla (en cm) y precio por metro lineal. El cliente escoge la muestra y se toman las medidas interiores de la pieza a enmarcar.

```
Perímetro interior = (Lado₁ + Lado₂) × 2
Total centímetros = Perímetro + Colilla de la muestra
Precio del marco = Total centímetros × Precio por metro de la referencia
```

**Ejemplo:** Pieza de 50cm × 70cm, Ref. K473 (colilla: 48cm, precio: $48.000/m)
- Perímetro: (50 + 70) × 2 = 240 cm
- Total: 240 + 48 (colilla) = 288 cm = 2.88 metros
- Precio marco: 2.88 × $48.000 = $138.240

**Datos requeridos por muestra en la app:**
- Referencia (código único de la muestra)
- Colilla en centímetros (fija por referencia)
- Precio por metro lineal en pesos

### A.2 Cotización de Vidrio

El vidrio se cotiza por metro cuadrado. **Regla crítica:** las medidas siempre se redondean hacia arriba de 10 en 10 cm para contemplar desperdicio de corte. Esta regla aplica universalmente para todo tipo de vidrio en cualquier contexto (marcos, espejos, ventanas, etc.).

```
Medida redondeada = cada lado se redondea al múltiplo de 10 superior
Área = Lado₁ (redondeado) × Lado₂ (redondeado) en m²
Precio vidrio = Área en m² × Precio por m² según tipo
```

| Tipo de Vidrio | Precio por m² |
|----------------|---------------|
| Vidrio claro 2mm | $100.000 |
| Vidrio antirreflectivo | $115.000 |

**Ejemplo:** Vidrio para pieza de 46cm × 37cm antirreflectivo
- Redondeo: 46 → 50cm, 37 → 40cm
- Área: 0.50 × 0.40 = 0.20 m²
- Precio: 0.20 × $115.000 = $23.000

**Ejemplo:** Vidrio para marco de 50cm × 70cm antirreflectivo (ya múltiplos de 10)
- Área: 0.50 × 0.70 = 0.35 m²
- Precio: 0.35 × $115.000 = $40.250

### A.3 Cotización de Paspartú

El paspartú se coloca como decoración alrededor de la obra. El cliente escoge el color y el ancho deseado. Existen dos tipos de paspartú con precios diferentes:

| Tipo | Material | Precio |
|------|----------|--------|
| Paspartú pintado | Cartón prensado pintado a mano | Según lista (por medida exterior) |
| Paspartú acrílico | MDF pintado | Según lista (precio diferente, más alto) |

**Regla crítica:** el paspartú amplía las dimensiones del marco y del vidrio.

```
Nuevo ancho = Ancho obra + (ancho paspartú × 2)
Nuevo alto = Alto obra + (ancho paspartú × 2)
Marco y vidrio se recalculan con las nuevas medidas
Precio paspartú = según lista de precios por medida exterior
```

El precio del paspartú depende de la medida exterior final (no del ancho del paspartú). Se consulta en la lista de precios correspondiente según el tipo (cartón pintado o acrílico/MDF).

**Ejemplo:** Obra de 50cm × 70cm con paspartú pintado de 5cm de ancho
- Nuevo ancho: 50 + (5 × 2) = 60cm
- Nuevo alto: 70 + (5 × 2) = 80cm
- Marco se calcula sobre 60 × 80 (ref K473): $157.440
- Vidrio se calcula sobre 60 × 80 antirreflectivo: $55.200
- Paspartú pintado 60 × 80 según lista: $22.000
- **Subtotal: $234.640**

### A.4 Cotización de Retablos

El retablo es un tipo de enmarcación que no lleva marco ni vidrio. Consiste en 4 listones y una tapa de MDF pegados que forman la base donde se adhiere o pega el póster u obra.

**Componentes obligatorios:**
- 4 listones (forman el borde)
- Tapa de MDF (base rígida)
- Pegado y acabado

El precio se determina por medidas según la lista de precios de retablos. No aplica fórmula de perímetro ni colilla.

### A.5 Cotización de Enmarcación Acolchada

La enmarcación acolchada usa una base rígida de MDF con espuma de 2cm de grueso pegada, sobre la cual se adhiere la tela o pintura. El precio base del acolchado se calcula por área, representando la mano de obra y materiales base.

```
En centímetros:  Ancho (cm) × Alto (cm) × 15
En metros:       Ancho (m) × Alto (m) × $150.000/m²
(Ambas fórmulas dan el mismo resultado)
```

Este precio cubre solo la lámina acolchada (MDF + espuma + pegado + mano de obra). Si el cliente desea marco, paspartú acrílico u otros elementos, se suman por separado.

**Combinaciones posibles:**
- Acolchado + marco (al tamaño)
- Acolchado + paspartú acrílico + marco

**Ejemplo:** Acolchado de 50cm × 70cm con marco ref K473
- Acolchado: 50 × 70 × 15 = $52.500
- Verificación en m²: 0.50 × 0.70 × $150.000 = $52.500 ✓
- Marco (50×70, ref K473): $138.240
- **Subtotal: $190.740**

### A.6 Bastidores y Tapas para Portarretratos

Los bastidores (estructura de madera para lienzos) y las tapas para portarretratos se cotizan por medidas según las listas de precios correspondientes. Pueden usar medida interior o exterior según el tipo de trabajo.

### A.7 Restauración de Piezas

La restauración de esculturas, piezas rotas y trabajos artesanales se cotiza de forma individual a criterio del dueño, sin fórmula fija. El precio depende de la complejidad, materiales necesarios y tiempo estimado.

### A.8 Cotización de Vidrios y Espejos a Domicilio

Las cotizaciones de vidrios y espejos para conjuntos residenciales u otras entidades se hacen a domicilio. Se miden en sitio y se cotiza con precio por m² (redondeado de 10 en 10) más instalación. Estos contratos se formalizan con un documento de cotización en Word y, si se aprueba, una cuenta de cobro.

### A.9 Materiales Adicionales (5% a 10%)

Todo trabajo de enmarcación incluye materiales adicionales de montaje: cartón de respaldo, puntillas, pegantes, cintas y piolas o cuerdas para colgar. Estos no se cotizan individualmente sino como un porcentaje sobre el subtotal.

```
Materiales adicionales = entre 5% y 10% sobre el subtotal del trabajo
Precio final = Subtotal + porcentaje de materiales
```

**Regla para determinar el porcentaje:**

| Valor del trabajo | Porcentaje | Razón |
|-------------------|-----------|-------|
| Bajo (cuadros económicos) | 10% | Los materiales pesan más en proporción |
| Medio a alto (cuadros grandes o costosos) | 5% a 10% | El dueño ajusta según su criterio |

> ⚠ En la app, el porcentaje de materiales adicionales será un campo editable (entre 5% y 10%) que el dueño puede ajustar en cada cotización según el tipo de trabajo.

**Ejemplo A:** Cuadro económico (subtotal $80.000, se aplica 10%)
- Materiales adicionales: $80.000 × 10% = $8.000
- **PRECIO FINAL: $88.000**

**Ejemplo B:** Cuadro de valor medio (subtotal $234.640, se aplica 7%)
- Materiales adicionales: $234.640 × 7% = $16.425
- **PRECIO FINAL: $251.065**

### A.10 Resumen: Estructura de una Cotización Completa

La siguiente tabla muestra todos los componentes posibles de una cotización y cómo se calcula cada uno:

| Componente | Fórmula / Método | Fuente de Precio |
|------------|------------------|------------------|
| Marco | (L₁+L₂)×2 + colilla × precio/m | Muestras físicas (ref, colilla, precio) |
| Vidrio | L₁×L₂ en m² (redondeado 10 en 10) | $100.000/m² claro, $115.000/m² anti. |
| Paspartú pintado | Medida exterior según lista | Lista precios cartón pintado |
| Paspartú acrílico | Medida exterior según lista | Lista precios MDF (precio diferente) |
| Retablo | Medida según lista | Lista de precios retablos |
| Acolchado | L×L×15 (cm) o L×L×$150.000 (m²) | Fórmula fija (mano de obra) |
| Bastidores/Tapas | Medida según lista | Lista de precios |
| Restauración | Cotización individual | Criterio del dueño |
| Materiales adic. | 5% a 10% sobre subtotal | Porcentaje variable (editable) |

### A.11 Listas de Precios Importables desde Excel

La app permitirá importar y actualizar las listas de precios desde archivos Excel (.xlsx). Esto facilita la actualización masiva de precios sin tener que editar uno por uno en la app.

| # | Lista | Columnas Esperadas | Método |
|---|-------|-------------------|--------|
| 1 | Muestras de marcos | Referencia, colilla (cm), precio/metro | Por muestra |
| 2 | Paspartú pintado | Ítems, medidas, tipo cartón, precio | Por medida ext. |
| 3 | Paspartú acrílico (MDF) | Medidas, tipo MDF, precio | Por medida ext. |
| 4 | Retablos | Medidas, precio | Por medida |
| 5 | Vidrios y espejos | Tipo, precio m² | Por m² |
| 6 | Bastidores | Medidas, precio | Por medida |
| 7 | Tapas portarretratos | Medidas, precio | Por medida |

> ⚠ Las listas de precios se podrán exportar desde la app a Excel para respaldo, y también importar desde Excel para actualizaciones masivas. La app validará el formato al importar.

---

## Bloque B — Ciclo de Vida de un Pedido

Este bloque documenta el flujo completo desde que un cliente entra al local hasta que recoge su trabajo terminado.

### B.1 Flujo del Pedido Paso a Paso

1. El cliente llega al local con la pieza a enmarcar (diploma, foto, lienzo, obra, etc.).
2. Se realiza la cotización según el tipo de trabajo solicitado (ver Bloque A).
3. Se presenta el precio final al cliente.
4. El cliente decide si acepta la cotización.
5. Si acepta, se registran sus datos: nombre, teléfono, dirección, descripción del trabajo, total, abono y saldo.
6. El cliente puede abonar: la mitad, menos de la mitad, o nada.
7. Se genera la factura en papel: la original se entrega al cliente, la copia queda en el facturero del local.
8. La pieza original del cliente se guarda en el local.
9. Se informa la fecha de entrega (estándar 8 días).
10. El dueño realiza el trabajo (corte de paspartú, montaje, pide marcos al proveedor, etc.).
11. El cliente regresa con su factura, paga el saldo pendiente y recoge el cuadro terminado.

> ⚠ Alerta en la app: Si el cliente no abona nada al dejar el trabajo, la app generará una notificación visible indicando que el pedido no tiene ningún abono registrado.

### B.2 Tiempos de Entrega

| Tipo | Tiempo | Condición |
|------|--------|-----------|
| Estándar | 8 días hábiles | Flujo normal |
| Urgente | 2 a 5 días | Regalos, eventos especiales o solicitud del cliente |
| Sin afán | Hasta 2 semanas | Cliente sin prisa |

### B.3 Estados de un Pedido

Para la aplicación, cada pedido debería tener un estado claro:

| Estado | Descripción |
|--------|-------------|
| Cotizado | Se hizo la cotización pero el cliente aún no confirma |
| Confirmado | Cliente aceptó, se registraron datos y se recibió la pieza |
| En proceso | El trabajo está siendo elaborado |
| Listo | El cuadro está terminado, esperando que el cliente lo recoja |
| Entregado | Cliente recogió el cuadro y pagó el saldo |
| Sin reclamar | Han pasado más de 15 días y el cliente no ha recogido (se activan alertas) |

### B.4 Pedidos Sin Reclamar y Alertas

Existen casos donde clientes no regresan a recoger su cuadro. El dueño los llama por teléfono repetidamente. Algunos cuadros se quedan meses sin ser reclamados.

**Alertas que debe manejar la app:**
- **Pedido sin abono:** Notificación inmediata cuando se registra un pedido con $0 de abono.
- **Pedido listo sin recoger:** Alerta cuando han pasado más de 2 días desde que el cuadro está listo.
- **Pedido sin reclamar:** Alerta destacada cuando han pasado más de 15 días sin ser recogido.
- **Fecha de entrega próxima:** Recordatorio cuando faltan 2 días para la fecha de entrega y el trabajo aún no está listo.

---

## Bloque C — Clientes y Facturación

### C.1 Datos del Cliente

Datos que se registran actualmente y datos propuestos para la app:

| Campo | Actual | Propuesto App |
|-------|--------|---------------|
| Nombre | Sí | Sí (obligatorio) |
| Teléfono | Sí | Sí (obligatorio) |
| Dirección | Sí | Sí |
| Cédula | No | Sí (nuevo) |
| Correo electrónico | No | Sí (nuevo, para enviar facturas) |
| Historial de pedidos | No | Sí (automático) |
| Frecuencia de visita | No | Sí (automático) |
| Total gastado | No | Sí (automático) |

Para estudiantes menores de edad en las clases de dibujo, se registran los datos del acudiente (nombre y teléfono del adulto responsable).

### C.2 Facturación

**Campos de la factura:**

| Campo | Detalle |
|-------|---------|
| Número consecutivo | Secuencial, autogenerado |
| Fecha | Fecha de creación del pedido |
| Nombre del cliente | Nombre completo |
| Descripción del trabajo | Tipo de cuadro, qué toca hacer, especificaciones |
| Total | Precio final de la cotización |
| Abono | Lo que el cliente pagó al dejar el trabajo |
| Saldo | Total menos abono (lo que falta por pagar) |
| Fecha de entrega | Fecha estimada para recoger el trabajo |

**Sistema actual vs propuesto:**
- **Actual:** Factura en papel. La original se entrega al cliente, la copia queda en el facturero del local.
- **Propuesto:** Factura digital generada por la app. Se puede imprimir (original para el cliente, copia para el local) y/o enviar por correo electrónico al cliente. Búsqueda instantánea por número, nombre, fecha o estado.

### C.3 Devoluciones

Cuando se hace una devolución de dinero, actualmente se registra en el libro diario con un signo negativo. La app debe manejar devoluciones como un movimiento financiero vinculado al pedido original, con motivo y fecha.

### C.4 Clientes Frecuentes

Actualmente no se lleva registro de clientes frecuentes ni se ofrecen descuentos. Con la app, se podrá identificar automáticamente quién viene seguido, cuánto ha gastado en total, y eventualmente ofrecer descuentos o beneficios a clientes fieles.

---

## Bloque D — Clases de Dibujo y Pintura

| Campo | Detalle |
|-------|---------|
| Precio mensual | $110.000 por estudiante |
| Frecuencia | 2 clases por semana (8 clases al mes) |
| Duración | 2 horas por clase |
| Días disponibles | Lunes a viernes por la tarde, sábados por la mañana |
| Estudiantes | Aprox. 4 actualmente |
| Kit de dibujo | $15.000 (4 lápices, block base 28, borrador miga de pan) |
| Venta de materiales | Solo el kit, se revende cuando se acaba |
| Inscripción | Directa: llegan, pagan y arrancan |
| Menores de edad | Se piden datos del acudiente (nombre y teléfono) |

---

## Bloque E — Proveedores y Materiales

### E.1 Directorio de Proveedores

El directorio de proveedores se podrá gestionar en la app e importar/exportar desde Excel. Los datos mínimos por proveedor son:

| Campo | Detalle |
|-------|---------|
| Nombre / Empresa | Nombre del proveedor o razón social |
| Producto / Servicio | Qué suministra (marcos, vidrio, MDF, etc.) |
| Teléfono | Número de contacto |
| Días de pedido | Qué días se pueden hacer pedidos (ej: lunes y miércoles) |
| Forma de pago | Contra entrega, de contado, crédito, etc. |
| Forma de entrega | En el local, compra directa, domicilio |
| Notas | Observaciones adicionales |

**Proveedores actuales conocidos:**

| Proveedor | Producto | Días Pedido | Pago | Entrega |
|-----------|----------|-------------|------|---------|
| Alberto | Marcos a medida | Lun. y Miér. | Contra entrega | En el local |
| Edimol | Marcos a medida | Lun. y Miér. | Contra entrega | En el local |
| (Por confirmar) | Láminas de vidrio | Cuando se agota | Contra entrega | En el local |
| Homecenter | MDF, cartón | Cuando se agota | De contado | Compra directa |

> ⚠ La app permitirá importar la lista completa de proveedores desde un archivo Excel (.xlsx) con sus datos y días de pedido. También se podrá exportar para respaldo.

### E.2 Flujo de Pedido de Materiales

**Marcos:**
Cuando entra un trabajo, se toma la medida y referencia. Se llama al proveedor (Alberto o Edimol) los lunes o miércoles. El proveedor trae el marco cortado a medida al local. Se paga contra entrega.

**Vidrio:**
Se compra en láminas grandes. El dueño corta según necesidad, optimizando los cortes para minimizar desperdicio. Cuando se acaba la lámina, se pide otra al proveedor.

**MDF y cartón para paspartú:**
Se compran en Homecenter cuando se agotan. El dueño fabrica los paspartús artesanalmente: corta el cartón y lo pinta a mano.

---

## Bloque F — Gestión Financiera

### F.1 Situación Tributaria

| Concepto | Estado |
|----------|--------|
| RUT | Sí, activo |
| Cámara de Comercio | Sí, activa |
| Cobra IVA | No cobra IVA en sus facturas |
| Declara renta | No (no supera el monto mínimo) |
| IVA en compras | Los materiales que compra incluyen IVA (es un costo) |
| Retención en la fuente | Le aplican en contratos con conjuntos/entidades |
| Contratos formales | 4-5 por mes con conjuntos residenciales |

### F.2 Registro Financiero Actual

- Se lleva un libro manual con entradas (ventas) y salidas (gastos).
- Solo se anota el precio de venta, no el costo de materiales por trabajo.
- No se calcula el margen de ganancia por trabajo ni por tipo de servicio.
- Las devoluciones se anotan con signo negativo.
- No hay gráficas, reportes ni tendencias.

### F.3 Documentos de Contratos

Para contratos con conjuntos residenciales y entidades, se generan dos documentos en Word:

- **Cotización:** Documento personalizado con datos del cliente/conjunto, tipo de trabajo, medidas y precio. Usa plantilla base con datos del negocio (nombre, RUT, teléfono).
- **Cuenta de cobro:** Se genera si la cotización es aprobada. Usa la misma plantilla base. Incluye retención en la fuente cuando aplica.

> ⚠ La app generará automáticamente estos documentos (cotización y cuenta de cobro) con la plantilla del negocio, llenando los datos del contrato. Se podrán exportar como PDF o Word para imprimir o enviar.

---

## Siguientes Pasos

Con la Fase 1 (Diagnóstico) y la Fase 2 (Mapeo del Negocio) completadas, el proyecto avanza a:

1. **Fase 3 — Definición de funcionalidades:** Definir exactamente qué módulos, pantallas y funciones tendrá la aplicación, priorizados por impacto en los problemas identificados.
2. **Fase 4 — Diseño de base de datos:** Crear el modelo de datos con todas las entidades (clientes, pedidos, muestras, precios, facturas, proveedores, estudiantes, finanzas).
3. **Fase 5 — Diseño de interfaz:** Crear prototipos de las pantallas de la app.
4. **Fase 6 — Desarrollo:** Construir la aplicación de escritorio con Electron.

---

*Documento generado como parte del levantamiento de requerimientos para el proyecto de aplicación de escritorio de CasaAlberto - Arte - Diseño - Decoración. Fase 2 — Mapeo Completo del Negocio.*
