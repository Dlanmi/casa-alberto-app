// Tests de `validarWizardData`. Antes existía como función pública con
// 0 tests — la auditoría del informe de seguridad sobre `65762f0` reveló
// que aunque la lógica era correcta (validación field-by-field), no había
// safety net contra regresiones. Si alguien cambiaba el shape de
// `WizardData` o agregaba un campo nuevo sin actualizar el validator,
// drafts malformados pasarían silenciosamente y crashearían el render.
//
// Estos tests cubren los caminos hostiles típicos: NaN/Infinity en
// números, strings en lugar de booleans, enums fuera de rango,
// `muestraMarco` malformado.
import { describe, expect, it } from 'vitest'
import { validarWizardData } from './wizard-data-validation'

// Draft válido base. Los tests sobreescriben campos puntuales para
// probar rechazos específicos.
function wizardBase(overrides: Record<string, unknown> = {}): unknown {
  return {
    anchoCm: 30,
    altoCm: 40,
    muestraMarcoId: null,
    muestraMarco: null,
    conPaspartu: false,
    tipoPaspartu: 'pintado',
    anchoPaspartuCm: 5,
    conSuplemento: false,
    conVidrio: true,
    tipoVidrio: 'claro_2mm',
    porcentajeMateriales: 10,
    precioManual: 0,
    costoManualEstimado: 0,
    descripcionManual: '',
    precioInstalacion: 0,
    costoInstalacionEstimado: 0,
    tipoVidrioEspejo: '',
    conDescuento: false,
    descuentoNum: 0,
    motivoDescuento: '',
    conAbono: false,
    abonoNum: 0,
    metodoPago: 'efectivo',
    notas: '',
    tipoEntrega: 'estandar',
    ...overrides
  }
}

describe('validarWizardData — happy path', () => {
  it('acepta un wizard válido base', () => {
    const wd = validarWizardData(wizardBase())
    expect(wd).toBeDefined()
    expect(wd?.anchoCm).toBe(30)
    expect(wd?.altoCm).toBe(40)
  })

  it('acepta muestraMarco poblada con id+referencia', () => {
    const wd = validarWizardData(
      wizardBase({
        muestraMarcoId: 5,
        muestraMarco: {
          id: 5,
          referencia: 'K200',
          colillaCm: 25,
          precioMetro: 28000
        }
      })
    )
    expect(wd).toBeDefined()
  })
})

describe('validarWizardData — números no finitos (regresión Infinity/NaN)', () => {
  it('rechaza anchoCm NaN', () => {
    expect(validarWizardData(wizardBase({ anchoCm: Number.NaN }))).toBeUndefined()
  })

  it('rechaza anchoCm Infinity', () => {
    expect(validarWizardData(wizardBase({ anchoCm: Number.POSITIVE_INFINITY }))).toBeUndefined()
  })

  it('rechaza altoCm string', () => {
    expect(validarWizardData(wizardBase({ altoCm: '40' }))).toBeUndefined()
  })

  it('rechaza descuentoNum -Infinity', () => {
    expect(
      validarWizardData(wizardBase({ descuentoNum: Number.NEGATIVE_INFINITY }))
    ).toBeUndefined()
  })

  it('rechaza porcentajeMateriales como string', () => {
    expect(validarWizardData(wizardBase({ porcentajeMateriales: '10' }))).toBeUndefined()
  })
})

describe('validarWizardData — booleanos malformados (no coerce)', () => {
  it('rechaza conPaspartu string "true"', () => {
    expect(validarWizardData(wizardBase({ conPaspartu: 'true' }))).toBeUndefined()
  })

  it('rechaza conVidrio number 1', () => {
    expect(validarWizardData(wizardBase({ conVidrio: 1 }))).toBeUndefined()
  })

  it('rechaza conDescuento null', () => {
    expect(validarWizardData(wizardBase({ conDescuento: null }))).toBeUndefined()
  })

  it('rechaza conAbono undefined (campo faltante)', () => {
    const draft = wizardBase()
    delete (draft as Record<string, unknown>).conAbono
    expect(validarWizardData(draft)).toBeUndefined()
  })
})

describe('validarWizardData — strings malformados', () => {
  it('rechaza tipoVidrio number', () => {
    expect(validarWizardData(wizardBase({ tipoVidrio: 42 }))).toBeUndefined()
  })

  it('rechaza descripcionManual null', () => {
    expect(validarWizardData(wizardBase({ descripcionManual: null }))).toBeUndefined()
  })

  it('rechaza notas undefined (campo faltante)', () => {
    const draft = wizardBase()
    delete (draft as Record<string, unknown>).notas
    expect(validarWizardData(draft)).toBeUndefined()
  })
})

describe('validarWizardData — enums acotados', () => {
  it('rechaza tipoPaspartu fuera del enum', () => {
    expect(validarWizardData(wizardBase({ tipoPaspartu: 'cartón' }))).toBeUndefined()
  })

  it('rechaza tipoPaspartu null', () => {
    expect(validarWizardData(wizardBase({ tipoPaspartu: null }))).toBeUndefined()
  })

  it('acepta los dos valores válidos de tipoPaspartu', () => {
    expect(validarWizardData(wizardBase({ tipoPaspartu: 'pintado' }))).toBeDefined()
    expect(validarWizardData(wizardBase({ tipoPaspartu: 'acrilico' }))).toBeDefined()
  })
})

describe('validarWizardData — muestraMarco anidada', () => {
  it('rechaza muestraMarco sin id', () => {
    expect(
      validarWizardData(
        wizardBase({
          muestraMarcoId: 5,
          muestraMarco: { referencia: 'K200' }
        })
      )
    ).toBeUndefined()
  })

  it('rechaza muestraMarco con id NaN', () => {
    expect(
      validarWizardData(
        wizardBase({
          muestraMarcoId: 5,
          muestraMarco: { id: Number.NaN, referencia: 'K200' }
        })
      )
    ).toBeUndefined()
  })

  it('rechaza muestraMarco con referencia null', () => {
    expect(
      validarWizardData(
        wizardBase({
          muestraMarcoId: 5,
          muestraMarco: { id: 5, referencia: null }
        })
      )
    ).toBeUndefined()
  })

  it('rechaza muestraMarcoId no-null no-finito', () => {
    expect(
      validarWizardData(wizardBase({ muestraMarcoId: Number.POSITIVE_INFINITY }))
    ).toBeUndefined()
  })

  it('acepta muestraMarco=null cuando muestraMarcoId=null', () => {
    expect(validarWizardData(wizardBase({ muestraMarcoId: null, muestraMarco: null }))).toBeDefined()
  })
})

describe('validarWizardData — top-level', () => {
  it('rechaza raw no-objeto', () => {
    expect(validarWizardData(null)).toBeUndefined()
    expect(validarWizardData([])).toBeUndefined()
    expect(validarWizardData('hola')).toBeUndefined()
    expect(validarWizardData(42)).toBeUndefined()
    expect(validarWizardData(undefined)).toBeUndefined()
  })

  it('rechaza objeto vacío (faltan todos los campos)', () => {
    expect(validarWizardData({})).toBeUndefined()
  })
})
