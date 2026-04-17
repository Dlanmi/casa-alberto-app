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
          description:
            'Al abrir el detalle hay botones rápidos de abono y para generar factura.'
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
