// Fase 4 — Contenido del botón flotante de ayuda. Cada ruta lista 3-5
// acciones típicas con un enlace directo o instrucción corta. Pensado
// para que el papá de 60 años encuentre respuesta sin buscar en menús.

export type HelpTip = {
  title: string
  description: string
  to?: string
}

export type HelpRouteContent = {
  heading: string
  tips: HelpTip[]
}

// Se busca por prefijo de ruta (startsWith) en orden; la primera coincidencia
// gana. Por eso las rutas más específicas deben ir antes.
export const HELP_ROUTES: Array<{ prefix: string; content: HelpRouteContent }> = [
  {
    prefix: '/cotizador',
    content: {
      heading: 'Cotizar un trabajo',
      tips: [
        {
          title: 'Pasos del cotizador',
          description:
            'Selecciona cliente, tipo de trabajo, medidas y materiales. En el resumen puedes ajustar el precio y confirmar.'
        },
        {
          title: 'Al confirmar se crea el pedido',
          description:
            'Cuando pulsas "Crear pedido", la app te lleva directo al listado con la nueva tarjeta resaltada.'
        },
        {
          title: '¿Y si el cliente es nuevo?',
          description:
            'Puedes agregarlo desde el paso 1 sin salir del cotizador. Solo nombre y teléfono es suficiente.'
        }
      ]
    }
  },
  {
    prefix: '/pedidos',
    content: {
      heading: 'Gestionar pedidos',
      tips: [
        {
          title: 'Arrastra para avanzar el estado',
          description:
            'En vista Kanban, arrastra la tarjeta de una columna a la siguiente (p. ej. de "En proceso" a "Listo").'
        },
        {
          title: 'Clic en la tarjeta para cobrar',
          description: 'Al abrir el detalle hay botones rápidos de abono y para generar factura.'
        },
        {
          title: 'Filtra por lo urgente',
          description:
            'Usa los chips "Atrasados", "Sin abono" o "Próximos" para ver solo lo que requiere acción hoy.'
        }
      ]
    }
  },
  {
    prefix: '/facturas',
    content: {
      heading: 'Facturas y cobros',
      tips: [
        {
          title: 'Registrar un abono',
          description: 'Abre la factura pendiente y pulsa "Registrar pago". Elige método y monto.'
        },
        {
          title: 'Generar PDF',
          description:
            'Desde la factura puedes descargar el PDF para imprimir o enviar al cliente por WhatsApp.'
        }
      ]
    }
  },
  {
    prefix: '/clientes',
    content: {
      heading: 'Directorio de clientes',
      tips: [
        {
          title: 'Badge rojo "Con deuda"',
          description:
            'Cuando aparece junto al nombre, significa que ese cliente tiene pedidos sin abono. Clic para ver cuáles.'
        },
        {
          title: 'Cotizar o llamar directo',
          description:
            'Desde la tarjeta del cliente puedes iniciar una cotización o llamarlo con un solo clic.'
        }
      ]
    }
  },
  {
    prefix: '/inventario',
    content: {
      heading: 'Inventario de materiales',
      tips: [
        {
          title: '¿Qué va aquí?',
          description:
            'Solo materiales que almacenas en el taller (vidrio, paspartú, MDF). Los marcos se piden al proveedor por cada trabajo.'
        },
        {
          title: 'Alertas de stock',
          description:
            'Cuando un material está bajo o crítico, aparece el botón "Pedir" que te lleva a proveedores.'
        }
      ]
    }
  },
  {
    prefix: '/proveedores',
    content: {
      heading: 'Proveedores',
      tips: [
        {
          title: 'Días de pedido',
          description:
            'Si marcas "lunes" y "jueves" en un proveedor, el dashboard te recordará esos días.'
        }
      ]
    }
  },
  {
    prefix: '/clases',
    content: {
      heading: 'Clases de dibujo',
      tips: [
        {
          title: 'Crear una clase',
          description:
            'Pulsa "Nueva clase" para abrir un curso con horario, duración y precio. Luego puedes matricular estudiantes.'
        },
        {
          title: 'Matricular estudiantes',
          description:
            'Dentro de cada clase, usa "Agregar estudiante" y selecciona un cliente existente. Si es menor de edad, marca esa opción para registrar al acudiente.'
        },
        {
          title: 'Registrar pagos mensuales',
          description:
            'Cada estudiante tiene su propio saldo. Usa "Registrar pago" para abonar la mensualidad — el sistema actualiza automáticamente el estado a "Al día" o "Pendiente".'
        },
        {
          title: 'Ver quién está al día',
          description:
            'El panel principal muestra estudiantes con pagos pendientes de un vistazo, para que sepas a quién cobrar esta semana.'
        }
      ]
    }
  },
  {
    prefix: '/agenda',
    content: {
      heading: 'Agenda de entregas',
      tips: [
        {
          title: 'Vista semanal o diaria',
          description: 'Cambia entre vistas para planear tu semana o enfocarte en lo del día.'
        },
        {
          title: 'Entregas pendientes',
          description:
            'Cada evento muestra el cliente y el pedido. Clic para abrir el detalle del pedido.'
        }
      ]
    }
  },
  {
    prefix: '/contratos',
    content: {
      heading: 'Contratos',
      tips: [
        {
          title: 'Plantillas de contrato',
          description:
            'Genera contratos para trabajos grandes. Se rellenan automáticamente con los datos del cliente y del pedido.'
        },
        {
          title: 'Descargar PDF',
          description: 'Una vez firmado, descarga el PDF para archivar o enviar al cliente.'
        }
      ]
    }
  },
  {
    prefix: '/finanzas',
    content: {
      heading: 'Finanzas del taller',
      tips: [
        {
          title: 'Registrar ingresos y gastos',
          description:
            'Agrega movimientos manuales. Los cobros de facturas ya se registran automáticamente.'
        },
        {
          title: 'Balance mensual',
          description: 'La gráfica compara ingresos contra gastos del mes para ver si vas positivo.'
        }
      ]
    }
  },
  {
    prefix: '/configuracion',
    content: {
      heading: 'Configuración',
      tips: [
        {
          title: 'Respaldos automáticos',
          description:
            'La app crea copias diarias de tu información. Aquí puedes ver cuándo fue el último.'
        },
        {
          title: 'Reiniciar tour',
          description:
            'Si quieres ver de nuevo las instrucciones iniciales, puedes reactivar el tour desde aquí.'
        }
      ]
    }
  },
  {
    prefix: '/',
    content: {
      heading: '¿Qué hacer hoy?',
      tips: [
        {
          title: 'Empieza por las alertas',
          description:
            'La bandeja naranja del tablero te muestra lo más urgente: atrasados, sin abono, entregas próximas.'
        },
        {
          title: 'Botones grandes del día',
          description:
            '"Nueva cotización", "Registrar cobro" y "Registrar gasto" cubren el 80% del trabajo diario.'
        }
      ]
    }
  }
]

export function getHelpForRoute(pathname: string): HelpRouteContent {
  for (const route of HELP_ROUTES) {
    if (pathname === route.prefix || pathname.startsWith(route.prefix + '/')) {
      return route.content
    }
  }
  return HELP_ROUTES[HELP_ROUTES.length - 1].content
}
