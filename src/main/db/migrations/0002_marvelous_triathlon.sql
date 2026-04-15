CREATE TABLE `asistencias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`estudiante_id` integer NOT NULL,
	`clase_id` integer NOT NULL,
	`fecha` text NOT NULL,
	`presente` integer DEFAULT true NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`estudiante_id`) REFERENCES `estudiantes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`clase_id`) REFERENCES `clases`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_asistencias_estudiante_fecha` ON `asistencias` (`estudiante_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `idx_asistencias_clase_fecha` ON `asistencias` (`clase_id`,`fecha`);