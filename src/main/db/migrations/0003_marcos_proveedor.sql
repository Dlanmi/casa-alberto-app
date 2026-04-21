ALTER TABLE `muestras_marcos` ADD `proveedor_id` integer REFERENCES proveedores(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `idx_marcos_proveedor` ON `muestras_marcos` (`proveedor_id`);--> statement-breakpoint
ALTER TABLE `proveedores` ADD `tipo` text DEFAULT 'otro' NOT NULL;