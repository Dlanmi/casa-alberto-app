// Validador runtime para `WizardData`. Compartido entre el wizard del
// cotizador (single-trabajo, draft via `useAutoSave`) y el wizard padre del
// pedido multi-trabajo (cada `TrabajoEnSesion.data` debe pasar este check
// antes de aceptar un draft de localStorage). Política: si CUALQUIER campo
// requerido está malformado se devuelve `undefined` y el caller descarta
// el draft entero.
import type { WizardData } from './wizard-shell'

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function esNumeroFinito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function esString(v: unknown): v is string {
  return typeof v === 'string'
}

function esBool(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

export function validarWizardData(v: unknown): WizardData | undefined {
  if (!esObjeto(v)) return undefined

  const numericos: Array<keyof WizardData> = [
    'anchoCm',
    'altoCm',
    'anchoPaspartuCm',
    'porcentajeMateriales',
    'precioManual',
    'costoManualEstimado',
    'precioInstalacion',
    'costoInstalacionEstimado',
    'descuentoNum',
    'abonoNum'
  ]
  for (const k of numericos) {
    if (!esNumeroFinito(v[k as string])) return undefined
  }

  const booleanos: Array<keyof WizardData> = [
    'conPaspartu',
    'conSuplemento',
    'conVidrio',
    'conDescuento',
    'conAbono'
  ]
  for (const k of booleanos) {
    if (!esBool(v[k as string])) return undefined
  }

  const strings: Array<keyof WizardData> = [
    'tipoVidrio',
    'descripcionManual',
    'tipoVidrioEspejo',
    'motivoDescuento',
    'notas'
  ]
  for (const k of strings) {
    if (!esString(v[k as string])) return undefined
  }

  // tipoPaspartu: enum estricto.
  if (v.tipoPaspartu !== 'pintado' && v.tipoPaspartu !== 'acrilico') return undefined

  // muestraMarcoId: number | null.
  if (v.muestraMarcoId !== null && !esNumeroFinito(v.muestraMarcoId)) return undefined

  // muestraMarco: null o { id, referencia } (resto del shape se acepta por spread).
  if (v.muestraMarco !== null) {
    if (!esObjeto(v.muestraMarco)) return undefined
    if (!esNumeroFinito(v.muestraMarco.id) || !esString(v.muestraMarco.referencia)) {
      return undefined
    }
  }

  // metodoPago / tipoEntrega: el wizard usa subsets propios; chequeamos
  // que sean string (los componentes downstream tratan strings desconocidos
  // con default UI).
  if (!esString(v.metodoPago)) return undefined
  if (!esString(v.tipoEntrega)) return undefined

  return v as unknown as WizardData
}
