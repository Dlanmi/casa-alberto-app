CREATE TABLE `acudientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text NOT NULL,
	`parentesco` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `acudientes_cliente_id_unique` ON `acudientes` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `clases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`dia_semana` text NOT NULL,
	`hora_inicio` text NOT NULL,
	`hora_fin` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text,
	`cedula` text,
	`correo` text,
	`direccion` text,
	`notas` text,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_cedula_unique` ON `clientes` (`cedula`);--> statement-breakpoint
CREATE INDEX `idx_clientes_nombre` ON `clientes` (`nombre`);--> statement-breakpoint
CREATE INDEX `idx_clientes_cedula` ON `clientes` (`cedula`);--> statement-breakpoint
CREATE INDEX `idx_clientes_telefono` ON `clientes` (`telefono`);--> statement-breakpoint
CREATE TABLE `configuracion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clave` text NOT NULL,
	`valor` text NOT NULL,
	`descripcion` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `configuracion_clave_unique` ON `configuracion` (`clave`);--> statement-breakpoint
CREATE TABLE `contrato_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contrato_id` integer NOT NULL,
	`descripcion` text NOT NULL,
	`cantidad` real DEFAULT 1 NOT NULL,
	`valor_unitario` real NOT NULL,
	`subtotal` real NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contrato_id`) REFERENCES `contratos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "contrato_items_subtotal_no_negativo" CHECK("contrato_items"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE TABLE `contratos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` text NOT NULL,
	`cliente_id` integer NOT NULL,
	`descripcion` text,
	`total` real NOT NULL,
	`retencion_porcentaje` real DEFAULT 0 NOT NULL,
	`retencion_monto` real DEFAULT 0 NOT NULL,
	`condiciones` text,
	`estado` text DEFAULT 'enviada' NOT NULL,
	`fecha` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "contratos_total_no_negativo" CHECK("contratos"."total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contratos_numero_unique` ON `contratos` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_contratos_numero` ON `contratos` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_contratos_cliente` ON `contratos` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `idx_contratos_estado_fecha` ON `contratos` (`estado`,`fecha`);--> statement-breakpoint
CREATE TABLE `cuentas_cobro` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` text NOT NULL,
	`contrato_id` integer NOT NULL,
	`total` real NOT NULL,
	`retencion` real DEFAULT 0 NOT NULL,
	`total_neto` real NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`fecha` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contrato_id`) REFERENCES `contratos`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cuentas_cobro_total_no_negativo" CHECK("cuentas_cobro"."total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cuentas_cobro_numero_unique` ON `cuentas_cobro` (`numero`);--> statement-breakpoint
CREATE TABLE `devoluciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factura_id` integer NOT NULL,
	`monto` real NOT NULL,
	`motivo` text NOT NULL,
	`fecha` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "devoluciones_monto_positivo" CHECK("devoluciones"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE `estudiantes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`clase_id` integer,
	`fecha_ingreso` text NOT NULL,
	`es_menor` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_estudiantes_cliente` ON `estudiantes` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `facturas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` text NOT NULL,
	`pedido_id` integer NOT NULL,
	`cliente_id` integer NOT NULL,
	`fecha` text NOT NULL,
	`total` real NOT NULL,
	`fecha_entrega` text,
	`notas` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "facturas_total_no_negativo" CHECK("facturas"."total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facturas_numero_unique` ON `facturas` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_facturas_numero` ON `facturas` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_facturas_cliente` ON `facturas` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `idx_facturas_pedido` ON `facturas` (`pedido_id`);--> statement-breakpoint
CREATE INDEX `idx_facturas_estado` ON `facturas` (`estado`);--> statement-breakpoint
CREATE TABLE `historial_cambios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tabla` text NOT NULL,
	`registro_id` integer NOT NULL,
	`campo` text NOT NULL,
	`valor_anterior` text,
	`valor_nuevo` text,
	`fecha` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_historial_registro` ON `historial_cambios` (`tabla`,`registro_id`);--> statement-breakpoint
CREATE INDEX `idx_historial_fecha` ON `historial_cambios` (`fecha`);--> statement-breakpoint
CREATE TABLE `inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`referencia` text,
	`tipo` text NOT NULL,
	`unidad` text NOT NULL,
	`stock_actual` real DEFAULT 0 NOT NULL,
	`stock_minimo` real DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "inventario_stock_no_negativo" CHECK("inventario"."stock_actual" >= 0),
	CONSTRAINT "inventario_stock_minimo_no_negativo" CHECK("inventario"."stock_minimo" >= 0)
);
--> statement-breakpoint
CREATE TABLE `movimientos_financieros` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo` text NOT NULL,
	`categoria` text NOT NULL,
	`descripcion` text,
	`monto` real NOT NULL,
	`fecha` text NOT NULL,
	`referencia_tipo` text,
	`referencia_id` integer,
	`proveedor_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "movfin_monto_positivo" CHECK("movimientos_financieros"."monto" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_movfin_tipo` ON `movimientos_financieros` (`tipo`);--> statement-breakpoint
CREATE INDEX `idx_movfin_categoria` ON `movimientos_financieros` (`categoria`);--> statement-breakpoint
CREATE INDEX `idx_movfin_fecha` ON `movimientos_financieros` (`fecha`);--> statement-breakpoint
CREATE INDEX `idx_movfin_referencia` ON `movimientos_financieros` (`referencia_tipo`,`referencia_id`);--> statement-breakpoint
CREATE INDEX `idx_movfin_proveedor` ON `movimientos_financieros` (`proveedor_id`);--> statement-breakpoint
CREATE TABLE `movimientos_inventario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inventario_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` real NOT NULL,
	`motivo` text,
	`pedido_id` integer,
	`proveedor_id` integer,
	`fecha` text NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`inventario_id`) REFERENCES `inventario`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "movinv_cantidad_positiva" CHECK("movimientos_inventario"."cantidad" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_movinv_inventario` ON `movimientos_inventario` (`inventario_id`);--> statement-breakpoint
CREATE TABLE `muestras_marcos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`referencia` text NOT NULL,
	`colilla_cm` real NOT NULL,
	`precio_metro` real NOT NULL,
	`descripcion` text,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "muestras_marcos_precio_positivo" CHECK("muestras_marcos"."precio_metro" >= 0),
	CONSTRAINT "muestras_marcos_colilla_positiva" CHECK("muestras_marcos"."colilla_cm" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muestras_marcos_referencia_unique` ON `muestras_marcos` (`referencia`);--> statement-breakpoint
CREATE INDEX `idx_marcos_referencia` ON `muestras_marcos` (`referencia`);--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factura_id` integer NOT NULL,
	`monto` real NOT NULL,
	`metodo_pago` text NOT NULL,
	`fecha` text NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "pagos_monto_positivo" CHECK("pagos"."monto" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_pagos_factura` ON `pagos` (`factura_id`);--> statement-breakpoint
CREATE INDEX `idx_pagos_fecha` ON `pagos` (`fecha`);--> statement-breakpoint
CREATE TABLE `pagos_clases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`estudiante_id` integer NOT NULL,
	`mes` text NOT NULL,
	`valor_total` real NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`estudiante_id`) REFERENCES `estudiantes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "pagos_clases_valor_no_negativo" CHECK("pagos_clases"."valor_total" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_pagos_clases_estud_mes` ON `pagos_clases` (`estudiante_id`,`mes`);--> statement-breakpoint
CREATE TABLE `pagos_clases_detalle` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pago_clase_id` integer NOT NULL,
	`monto` real NOT NULL,
	`metodo_pago` text NOT NULL,
	`fecha` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`pago_clase_id`) REFERENCES `pagos_clases`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pagos_clases_detalle_monto_positivo" CHECK("pagos_clases_detalle"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE `pedido_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`tipo_item` text NOT NULL,
	`descripcion` text,
	`referencia` text,
	`cantidad` real DEFAULT 1 NOT NULL,
	`precio_unitario` real,
	`subtotal` real NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pedido_items_subtotal_no_negativo" CHECK("pedido_items"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_pedido_items_pedido` ON `pedido_items` (`pedido_id`);--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` text NOT NULL,
	`cliente_id` integer NOT NULL,
	`tipo_trabajo` text NOT NULL,
	`descripcion` text,
	`ancho_cm` real,
	`alto_cm` real,
	`ancho_paspartu_cm` real,
	`tipo_paspartu` text,
	`tipo_vidrio` text,
	`porcentaje_materiales` real DEFAULT 10 NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`total_materiales` real DEFAULT 0 NOT NULL,
	`precio_total` real NOT NULL,
	`estado` text DEFAULT 'cotizado' NOT NULL,
	`tipo_entrega` text DEFAULT 'estandar' NOT NULL,
	`fecha_ingreso` text NOT NULL,
	`fecha_entrega` text,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "pedidos_porcentaje_materiales_rango" CHECK("pedidos"."porcentaje_materiales" BETWEEN 5 AND 10),
	CONSTRAINT "pedidos_subtotal_no_negativo" CHECK("pedidos"."subtotal" >= 0),
	CONSTRAINT "pedidos_materiales_no_negativo" CHECK("pedidos"."total_materiales" >= 0),
	CONSTRAINT "pedidos_total_no_negativo" CHECK("pedidos"."precio_total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pedidos_numero_unique` ON `pedidos` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_pedidos_numero` ON `pedidos` (`numero`);--> statement-breakpoint
CREATE INDEX `idx_pedidos_cliente` ON `pedidos` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `idx_pedidos_estado` ON `pedidos` (`estado`);--> statement-breakpoint
CREATE INDEX `idx_pedidos_fecha_entrega` ON `pedidos` (`fecha_entrega`);--> statement-breakpoint
CREATE INDEX `idx_pedidos_cliente_estado` ON `pedidos` (`cliente_id`,`estado`);--> statement-breakpoint
CREATE TABLE `plantillas_cotizacion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`tipo_trabajo` text NOT NULL,
	`datos` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `precios_bastidores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ancho_cm` real NOT NULL,
	`alto_cm` real NOT NULL,
	`precio` real NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "precios_bastidores_precio_positivo" CHECK("precios_bastidores"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE `precios_paspartu_acrilico` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ancho_cm` real NOT NULL,
	`alto_cm` real NOT NULL,
	`precio` real NOT NULL,
	`descripcion` text,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "precios_paspartu_acrilico_precio_positivo" CHECK("precios_paspartu_acrilico"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE `precios_paspartu_pintado` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ancho_cm` real NOT NULL,
	`alto_cm` real NOT NULL,
	`precio` real NOT NULL,
	`descripcion` text,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "precios_paspartu_pintado_precio_positivo" CHECK("precios_paspartu_pintado"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE `precios_retablos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ancho_cm` real NOT NULL,
	`alto_cm` real NOT NULL,
	`precio` real NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "precios_retablos_precio_positivo" CHECK("precios_retablos"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE `precios_tapas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ancho_cm` real NOT NULL,
	`alto_cm` real NOT NULL,
	`precio` real NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "precios_tapas_precio_positivo" CHECK("precios_tapas"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE `precios_vidrios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo` text NOT NULL,
	`precio_m2` real NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "precios_vidrios_precio_positivo" CHECK("precios_vidrios"."precio_m2" >= 0)
);
--> statement-breakpoint
CREATE TABLE `proveedores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`producto` text,
	`telefono` text,
	`dias_pedido` text,
	`forma_pago` text,
	`forma_entrega` text,
	`notas` text,
	`activo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ventas_kits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`estudiante_id` integer,
	`cliente_id` integer,
	`precio` real NOT NULL,
	`fecha` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`estudiante_id`) REFERENCES `estudiantes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ventas_kits_precio_no_negativo" CHECK("ventas_kits"."precio" >= 0)
);
