// Fase 4 — Contenido del botón flotante de ayuda. Cada ruta lista 3-5
// acciones típicas con un enlace directo o instrucción corta. Pensado
// para que el papá de 60 años encuentre respuesta sin buscar en menús.
//
// v1.5.0 agrega:
//   - Tips dinámicos: resolvers que leen datos reales (p. ej. matriz de
//     urgencia) y producen un tip contextual que se prepende al arreglo
//     estático. Si no hay dato, no se muestra nada.
//   - FAQ: sección con preguntas frecuentes (paso a paso) accesibles via
//     toggle en el popover y via búsqueda global.

import type { MatrizUrgencia, Proveedor, StatsGenerales } from '@shared/types'

export type HelpTip = {
  title: string
  description: string
  to?: string
}

// Contexto que el HelpButton pasa a los resolvers de tips dinámicos.
// - matriz: pedidos atrasados, urgentes, sin abono (Fase 2 §B.1.2).
// - stats: conteos agregados para detectar empty-states.
// - proveedores: lista activa para resolver "hoy toca pedir a X" según el
//   día de la semana configurado en cada uno.
// - hoy: fecha actual inyectable para tests determinísticos; si se omite,
//   los resolvers usan `new Date()`.
export type HelpContext = {
  matriz?: MatrizUrgencia | null
  stats?: StatsGenerales | null
  proveedores?: Proveedor[] | null
  hoy?: Date
}

// Resuelve un tip con datos en vivo. Si la condición no aplica (p. ej. no
// hay pedidos atrasados), debe devolver `null` para omitirlo.
export type DynamicTipResolver = (ctx: HelpContext) => HelpTip | null

export type HelpRouteContent = {
  heading: string
  tips: HelpTip[]
  dynamicTips?: DynamicTipResolver[]
}

// Preguntas frecuentes: respuestas paso a paso, visibles en la pestaña FAQ
// del popover y también aparecen en la búsqueda global. Escritas con tono
// calmado y vocabulario cercano a papá (evita jerga técnica).
export type HelpFaq = {
  question: string
  steps: string[]
  tags?: string[] // ayuda a la búsqueda (sinónimos, keywords)
  relatedRoute?: string
}

// ---------------------------------------------------------------------------
// Resolvers dinámicos reutilizables
// ---------------------------------------------------------------------------

// "Tienes N pedidos atrasados" — aparece en /pedidos y dashboard cuando
// hay al menos 1 atrasado.
// Exportados (además de compuestos en HELP_ROUTES) para que los tests
// unitarios puedan ejercitar cada resolver aislado.
export const tipAtrasados: DynamicTipResolver = (ctx) => {
  const n = ctx.matriz?.atrasados ?? 0
  if (n <= 0) return null
  return {
    title: n === 1 ? 'Tienes 1 pedido atrasado' : `Tienes ${n} pedidos atrasados`,
    description:
      'Son pedidos cuya fecha de entrega ya pasó. Revísalos primero — cliente probablemente esperando.',
    to: '/pedidos'
  }
}

// "Hay N pedidos sin abono" — activo en dashboard, /pedidos, /clientes y
// /facturas cuando la matriz detecta pedidos activos sin ningún pago.
export const tipSinAbono: DynamicTipResolver = (ctx) => {
  const m = ctx.matriz
  if (!m) return null
  const sinAbono = m.urgenteSinAbono + m.normalSinAbono
  if (sinAbono <= 0) return null
  return {
    title: sinAbono === 1 ? 'Hay 1 pedido sin abono' : `Hay ${sinAbono} pedidos sin abono`,
    description:
      'Estos clientes confirmaron el pedido pero no han pagado nada. Ve al listado con el filtro "Sin abono".',
    to: '/pedidos?focus=sin_abono'
  }
}

// "Hay N entregas urgentes" — los urgentes con/sin abono (fecha próxima
// dentro del umbral de Fase 2 §B.1.2).
export const tipUrgentes: DynamicTipResolver = (ctx) => {
  const m = ctx.matriz
  if (!m) return null
  const urgentes = m.urgenteSinAbono + m.urgenteConAbono
  if (urgentes <= 0) return null
  return {
    title:
      urgentes === 1
        ? '1 pedido entrega hoy o mañana'
        : `${urgentes} pedidos entregan hoy o mañana`,
    description: 'Asegúrate de tenerlos listos a tiempo. Usa el chip "Próximos" en Pedidos.',
    to: '/pedidos?focus=urgentes'
  }
}

// "Hoy toca pedir a X" — cuando algún proveedor tiene hoy como día de
// pedido según `diasPedido` (CSV con nombres de días en minúscula, p. ej.
// 'lunes,miercoles').
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

export const tipDiaProveedorHoy: DynamicTipResolver = (ctx) => {
  const hoy = ctx.hoy ?? new Date()
  const diaHoy = DIAS_ES[hoy.getDay()]
  const activos = (ctx.proveedores ?? []).filter((p) => {
    if (!p.activo || !p.diasPedido) return false
    const dias = p.diasPedido
      .toLowerCase()
      .split(',')
      .map((d) => d.trim())
    return dias.includes(diaHoy)
  })
  if (activos.length === 0) return null
  const nombres = activos.map((p) => p.nombre).join(', ')
  return {
    title: activos.length === 1 ? `Hoy toca pedir a ${nombres}` : `Hoy toca pedir a: ${nombres}`,
    description:
      activos.length === 1
        ? 'Según el día configurado en su ficha. Llama antes de que cierre.'
        : 'Varios proveedores tienen hoy como día de pedido. Revisa qué necesitas de cada uno.',
    to: '/proveedores'
  }
}

// ---------------------------------------------------------------------------
// Resolvers de empty-state: primer tip cuando un módulo aún no tiene datos.
// Tono de "bienvenida": papá recién migró del papel, lo guiamos al primer uso.
// ---------------------------------------------------------------------------

function makeEmptyStateResolver(
  key: keyof StatsGenerales,
  label: string,
  description: string,
  to: string
): DynamicTipResolver {
  return (ctx) => {
    const n = ctx.stats?.[key]
    // Si stats aún no cargó (undefined/null), no asumir empty-state.
    if (n === undefined || n === null) return null
    if (n > 0) return null
    return { title: label, description, to }
  }
}

export const tipEmptyClientes = makeEmptyStateResolver(
  'clientes',
  'Aún no tienes clientes',
  'Empieza creando el primero. Solo necesitas nombre y teléfono.',
  '/clientes'
)

export const tipEmptyPedidos = makeEmptyStateResolver(
  'pedidos',
  'Aún no tienes pedidos',
  'Crea una cotización y al confirmar se convierte en pedido automáticamente.',
  '/cotizador'
)

export const tipEmptyProveedores = makeEmptyStateResolver(
  'proveedores',
  'Aún no tienes proveedores',
  'Agrega a los que más te venden (Alberto, Edimol, Homecenter) para tenerlos a la mano.',
  '/proveedores'
)

export const tipEmptyInventario = makeEmptyStateResolver(
  'inventario',
  'Aún no tienes materiales en el inventario',
  'Registra lo que guardas en el taller (vidrio, MDF, paspartú). Los marcos NO — esos se piden por trabajo.',
  '/inventario'
)

export const tipEmptyClases = makeEmptyStateResolver(
  'clases',
  'Aún no tienes clases abiertas',
  'Crea una clase con horario y precio, luego matricula a los estudiantes.',
  '/clases'
)

export const tipEmptyContratos = makeEmptyStateResolver(
  'contratos',
  'Aún no tienes contratos',
  'Úsalos para trabajos grandes: se generan con plantilla y permiten cuentas de cobro mensuales.',
  '/contratos'
)

// ---------------------------------------------------------------------------
// Contenido estático por ruta
// ---------------------------------------------------------------------------

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
            'Cuando pulsas "Crear pedido", la app te lleva directo al listado con la nueva tarjeta resaltada.',
          to: '/pedidos'
        },
        {
          title: '¿Y si el cliente es nuevo?',
          description:
            'Puedes agregarlo desde el paso 1 sin salir del cotizador. Solo nombre y teléfono es suficiente.',
          to: '/clientes'
        },
        {
          title: 'Revisar precios base antes de cotizar',
          description:
            'Usa "Gestionar precios" arriba para ajustar listas (paspartú, vidrio, retablos, etc.) antes de empezar.'
        },
        {
          title: 'Si tu cuadro no cabe en un tipo estándar',
          description:
            'El tipo "Restauración" permite precio manual — para trabajos especiales que no siguen las fórmulas.'
        }
      ]
    }
  },
  {
    prefix: '/pedidos',
    content: {
      heading: 'Gestionar pedidos',
      dynamicTips: [tipEmptyPedidos, tipAtrasados, tipSinAbono, tipUrgentes],
      tips: [
        {
          title: 'Arrastra para avanzar el estado',
          description:
            'En vista Kanban, arrastra la tarjeta de una columna a la siguiente (p. ej. de "En proceso" a "Listo").'
        },
        {
          title: 'Clic en la tarjeta para cobrar',
          description: 'Al abrir el detalle hay botones rápidos de abono y para generar factura.',
          to: '/facturas'
        },
        {
          title: 'Filtra por lo urgente',
          description:
            'Usa los chips "Atrasados", "Sin abono" o "Próximos" para ver solo lo que requiere acción hoy.'
        },
        {
          title: 'Cotizar un nuevo trabajo',
          description:
            'Si el cliente trae algo nuevo para enmarcar, ve al cotizador y al confirmar vuelves aquí con el pedido listo.',
          to: '/cotizador'
        },
        {
          title: 'Pedidos entregados hace más de 30 días',
          description:
            'Se archivan automáticamente del Kanban. Usa el toggle "Ver archivados" si necesitas buscar alguno antiguo.'
        }
      ]
    }
  },
  {
    prefix: '/facturas',
    content: {
      heading: 'Facturas y cobros',
      dynamicTips: [tipSinAbono],
      tips: [
        {
          title: 'Registrar un abono',
          description: 'Abre la factura pendiente y pulsa "Registrar pago". Elige método y monto.'
        },
        {
          title: 'Generar PDF',
          description:
            'Desde la factura puedes descargar el PDF para imprimir o enviar al cliente por WhatsApp.'
        },
        {
          title: '¿Cliente dice que ya pagó y no aparece?',
          description:
            'Revisa la fecha del pago: si quedó en el día anterior, filtra por ese día. Nunca borres la factura para "reiniciar" — mejor anúlala y crea una nueva.'
        },
        {
          title: 'Anular vs eliminar',
          description:
            'Si una factura se hizo mal, anúlala (queda con badge rojo pero no se pierde el historial). Eliminar no está permitido en facturas ya pagadas.'
        },
        {
          title: 'Cobrar un pedido sin factura',
          description:
            'Desde el detalle del pedido, pulsa "Generar factura" — la app crea la factura y la abre para que registres el abono.',
          to: '/pedidos'
        }
      ]
    }
  },
  {
    prefix: '/clientes',
    content: {
      heading: 'Directorio de clientes',
      dynamicTips: [tipEmptyClientes, tipSinAbono],
      tips: [
        {
          title: 'Badge rojo "Con deuda"',
          description:
            'Cuando aparece junto al nombre, significa que ese cliente tiene pedidos sin abono. Clic para ver cuáles.',
          to: '/facturas'
        },
        {
          title: 'Cotizar o llamar directo',
          description:
            'Desde la tarjeta del cliente puedes iniciar una cotización o llamarlo con un solo clic.',
          to: '/cotizador'
        },
        {
          title: 'Clientes menores de edad',
          description:
            'Si el cliente es menor, marca "Es menor" y registra al acudiente (nombre + teléfono). Obligatorio por Fase 2.'
        },
        {
          title: 'Buscar por teléfono',
          description:
            'El buscador acepta tanto nombre como teléfono. Si un cliente no aparece, prueba con su número.'
        }
      ]
    }
  },
  {
    prefix: '/inventario',
    content: {
      heading: 'Inventario de materiales',
      dynamicTips: [tipEmptyInventario],
      tips: [
        {
          title: '¿Qué va aquí?',
          description:
            'Solo materiales que almacenas en el taller (vidrio, paspartú, MDF). Los marcos se piden al proveedor por cada trabajo.',
          to: '/proveedores'
        },
        {
          title: 'Alertas de stock',
          description:
            'Cuando un material está bajo o crítico, aparece el botón "Pedir" que te lleva a proveedores.'
        },
        {
          title: 'Registrar entrada de material',
          description:
            'Cuando compras vidrio nuevo, usa "Registrar movimiento → Entrada" con cantidad y factura del proveedor.'
        },
        {
          title: 'Registrar salida (uso en un pedido)',
          description:
            'Cada vez que usas material para un cuadro, registra una salida. Así el stock queda siempre actualizado.'
        }
      ]
    }
  },
  {
    prefix: '/proveedores',
    content: {
      heading: 'Proveedores',
      dynamicTips: [tipEmptyProveedores, tipDiaProveedorHoy],
      tips: [
        {
          title: 'Días de pedido',
          description:
            'Si marcas "lunes" y "jueves" en un proveedor, el dashboard te recordará esos días.'
        },
        {
          title: '¿A quién le pido marcos?',
          description:
            'Los marcos se piden por cada trabajo — Alberto (Mosquera) y Edimol son los habituales. Revisa en sus tarjetas qué referencias maneja cada uno.'
        },
        {
          title: 'Ver pedidos pendientes de un proveedor',
          description:
            'Abre el detalle del proveedor para ver qué trabajos actuales necesitan marcos de él.',
          to: '/pedidos'
        },
        {
          title: 'Agregar un proveedor nuevo',
          description:
            'Usa "Nuevo proveedor" — solo necesitas nombre, ubicación y teléfono. Los días de pedido son opcionales.'
        }
      ]
    }
  },
  {
    prefix: '/clases',
    content: {
      heading: 'Clases de dibujo',
      dynamicTips: [tipEmptyClases],
      tips: [
        {
          title: 'Crear una clase',
          description:
            'Pulsa "Nueva clase" para abrir un curso con horario, duración y precio. Luego puedes matricular estudiantes.'
        },
        {
          title: 'Matricular estudiantes',
          description:
            'Dentro de cada clase, usa "Agregar estudiante" y selecciona un cliente existente. Si es menor de edad, marca esa opción para registrar al acudiente.',
          to: '/clientes'
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
        },
        {
          title: 'Vender un kit de dibujo',
          description:
            'Desde el detalle de un estudiante o desde la sección "Kits", registra la venta. Va directo a finanzas como ingreso.',
          to: '/finanzas'
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
            'Cada evento muestra el cliente y el pedido. Clic para abrir el detalle del pedido.',
          to: '/pedidos'
        },
        {
          title: 'Días de pedido a proveedores',
          description:
            'La agenda también muestra los días en que debes llamar a proveedores (según lo configurado).',
          to: '/proveedores'
        }
      ]
    }
  },
  {
    prefix: '/contratos',
    content: {
      heading: 'Contratos',
      dynamicTips: [tipEmptyContratos],
      tips: [
        {
          title: 'Plantillas de contrato',
          description:
            'Genera contratos para trabajos grandes. Se rellenan automáticamente con los datos del cliente y del pedido.'
        },
        {
          title: 'Descargar PDF',
          description: 'Una vez firmado, descarga el PDF para archivar o enviar al cliente.'
        },
        {
          title: 'Cuentas de cobro',
          description:
            'Cada contrato puede tener múltiples cuentas de cobro (mensuales o por hito). Usa "Nueva cuenta" dentro del contrato.'
        },
        {
          title: 'Marcar contrato como finalizado',
          description:
            'Al terminar el trabajo, cambia el estado a "Finalizado". Queda archivado pero accesible para consulta.'
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
        },
        {
          title: 'Margen por tipo de trabajo',
          description:
            'Revisa qué tipos (acolchado, enmarcación, clases) te dejan más ganancia para priorizar esfuerzo.'
        },
        {
          title: 'Exportar a Excel',
          description:
            'Para llevar el reporte a tu contador o ver en computador grande: "Exportar mes a Excel" arriba a la derecha.'
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
          title: 'Abrir carpeta de respaldos',
          description:
            'Usa "Abrir carpeta" para copiar los respaldos a un USB — por si tu computador falla.'
        },
        {
          title: 'Reiniciar tour',
          description:
            'Si quieres ver de nuevo las instrucciones iniciales, puedes reactivar el tour desde aquí.'
        },
        {
          title: 'Precios base de clases',
          description:
            'El precio mensual de una clase se configura aquí — evita tener que editarlo en cada pago.'
        }
      ]
    }
  },
  {
    prefix: '/',
    content: {
      heading: '¿Qué hacer hoy?',
      dynamicTips: [tipAtrasados, tipUrgentes, tipSinAbono, tipDiaProveedorHoy],
      tips: [
        {
          title: 'Empieza por las alertas',
          description:
            'Los chips de "Atrasados", "Urgentes" y "Sin abono" muestran lo que necesita acción. Clic y filtra directo.',
          to: '/pedidos'
        },
        {
          title: 'Cotiza un trabajo rápido',
          description: 'Atajo Ctrl+N (⌘+N en Mac) abre el cotizador desde cualquier pantalla.',
          to: '/cotizador'
        },
        {
          title: 'Ver quién me debe',
          description:
            'Las facturas sin abono están una pantalla allá. Cliente + monto + días de espera.',
          to: '/facturas'
        },
        {
          title: 'Balance del día',
          description:
            'Los KPIs del dashboard comparan hoy contra el promedio del mes. Verde = vas bien.'
        }
      ]
    }
  }
]

// ---------------------------------------------------------------------------
// Preguntas frecuentes — respuestas paso a paso
// ---------------------------------------------------------------------------

export const HELP_FAQ: HelpFaq[] = [
  {
    question: '¿Cómo cobro un abono de un pedido?',
    tags: ['abono', 'pago', 'cobrar', 'factura'],
    relatedRoute: '/pedidos',
    steps: [
      'Ve a "Pedidos" y abre la tarjeta del cliente que viene a pagar.',
      'Si ya tiene factura, pulsa "Registrar pago". Si no, pulsa "Generar factura" y luego "Registrar pago".',
      'Elige el método (efectivo, transferencia, tarjeta) y escribe el monto que está abonando.',
      'Confirma. La barra de pago del pedido se actualiza y queda en el historial del cliente.'
    ]
  },
  {
    question: '¿Cómo genero una factura en PDF para imprimir?',
    tags: ['pdf', 'imprimir', 'factura', 'whatsapp'],
    relatedRoute: '/facturas',
    steps: [
      'Ve a "Facturas" y abre la factura que quieres imprimir.',
      'Pulsa el botón "PDF" arriba a la derecha del detalle.',
      'Se abre el PDF en un visor del sistema — desde ahí puedes imprimir o guardar el archivo.',
      'Para enviar por WhatsApp: guarda el PDF, abre WhatsApp Web y arrástralo al chat.'
    ]
  },
  {
    question: '¿Cómo marco un pedido como entregado?',
    tags: ['entregar', 'listo', 'terminado'],
    relatedRoute: '/pedidos',
    steps: [
      'En el Kanban, arrastra la tarjeta del pedido a la columna "Entregado".',
      'Si la columna "Entregado" no está visible, también puedes abrir el detalle y cambiar el estado desde allí.',
      'Cuando marcas entregado, si la factura aún tiene saldo, la app te recuerda cobrar el resto.'
    ]
  },
  {
    question: '¿Cómo cobro la mensualidad de un estudiante?',
    tags: ['clases', 'mensualidad', 'estudiante', 'pago mensual'],
    relatedRoute: '/clases',
    steps: [
      'Ve a "Clases" y busca la clase del estudiante.',
      'Abre la ficha del estudiante (clic sobre su nombre).',
      'Pulsa "Registrar pago" y escribe el monto.',
      'El estado del mes se actualiza a "Al día" cuando el monto alcanza la mensualidad configurada.'
    ]
  },
  {
    question: '¿Cómo agrego un cliente nuevo?',
    tags: ['cliente nuevo', 'crear cliente', 'registrar cliente'],
    relatedRoute: '/clientes',
    steps: [
      'Ve a "Clientes" y pulsa "Nuevo cliente" arriba.',
      'Escribe al menos el nombre. Teléfono y cédula son opcionales pero recomendados.',
      'Si es menor de edad, marca la casilla y llena los datos del acudiente (nombre y teléfono).',
      'Guarda. El cliente queda disponible para cotizaciones, pedidos y clases.'
    ]
  },
  {
    question: '¿Cómo hago una cotización rápida?',
    tags: ['cotizar', 'cotización', 'precio'],
    relatedRoute: '/cotizador',
    steps: [
      'Atajo: Ctrl+N desde cualquier pantalla abre el cotizador.',
      'Paso 1: elige o crea el cliente.',
      'Paso 2: elige el tipo de trabajo (enmarcación, acolchado, adherido, retablo, etc.).',
      'Paso 3: captura las medidas del cuadro en centímetros.',
      'Paso 4: agrega materiales (marco, paspartú, vidrio) según corresponda.',
      'Paso 5 (resumen): revisa el precio, ajusta si quieres, y pulsa "Crear pedido".'
    ]
  },
  {
    question: '¿Dónde veo cuánta plata me deben?',
    tags: ['deuda', 'deben', 'sin abono', 'por cobrar'],
    relatedRoute: '/facturas',
    steps: [
      'En el Dashboard, el chip "Sin abono" muestra cuántos pedidos están pendientes.',
      'Clic en ese chip te lleva a Pedidos filtrados por los que no tienen abono.',
      'También puedes ir a "Facturas" y filtrar por estado "Pendiente".',
      'Cada factura muestra saldo pendiente + días de espera — ordena por más antiguo para priorizar llamadas.'
    ]
  },
  {
    question: '¿Cómo actualizo el precio de paspartú o vidrio?',
    tags: ['precios', 'lista', 'paspartu', 'vidrio', 'cambiar precio'],
    relatedRoute: '/cotizador',
    steps: [
      'Ve a "Cotizador" y pulsa "Gestionar precios" arriba a la derecha.',
      'Escoge la pestaña (Paspartú pintado, Paspartú acrílico, Vidrios, etc.).',
      'Toca el precio que quieres cambiar, escribe el nuevo valor y confirma.',
      'El cambio aplica a nuevas cotizaciones desde ese momento — los pedidos ya creados no se tocan.'
    ]
  }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getHelpForRoute(pathname: string): HelpRouteContent {
  for (const route of HELP_ROUTES) {
    // La ruta '/' solo empata exactamente (sino engañaría a todas las demás).
    if (route.prefix === '/') {
      if (pathname === '/') return route.content
      continue
    }
    if (pathname.startsWith(route.prefix)) return route.content
  }
  // Fallback al contenido del dashboard si nada más matchea.
  const fallback = HELP_ROUTES.find((r) => r.prefix === '/')
  return (
    fallback?.content ?? {
      heading: 'Ayuda',
      tips: []
    }
  )
}

// Resuelve los dynamic tips de una ruta contra el contexto actual, filtrando
// los null. Si la ruta no tiene dynamicTips, devuelve arreglo vacío.
export function resolveDynamicTips(content: HelpRouteContent, ctx: HelpContext): HelpTip[] {
  if (!content.dynamicTips) return []
  const resolved: HelpTip[] = []
  for (const fn of content.dynamicTips) {
    const tip = fn(ctx)
    if (tip) resolved.push(tip)
  }
  return resolved
}
