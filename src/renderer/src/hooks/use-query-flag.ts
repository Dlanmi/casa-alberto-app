import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Detecta un flag booleano en el query-string al montar y, opcionalmente,
// invoca un callback. Devuelve `true` una sola vez y limpia el flag de la
// URL para que no quede sticky.
//
// Uso recomendado (con callback — evita el patrón setState-en-effect):
//   useQueryFlag('nuevo', () => setShowCreate(true))
//
// Uso alternativo (devuelve bool):
//   const abrirNuevo = useQueryFlag('nuevo')
//
// Resistencia a StrictMode: en dev React monta-desmonta-monta cada componente
// para detectar bugs. Sin protección, el callback se ejecutaría dos veces y
// el flag se limpiaría dos veces (la segunda con la URL ya limpia, no-op).
// Usamos un ref `consumed` para garantizar single-fire idempotente.
export function useQueryFlag(flag: string, onActive?: () => void): boolean {
  const location = useLocation()
  const navigate = useNavigate()
  const [active] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get(flag) === '1'
  })
  const onActiveRef = useRef(onActive)
  onActiveRef.current = onActive
  // El ref persiste entre el doble-mount de StrictMode (no se reinicializa
  // en el segundo mount porque vive en el mismo fiber).
  const consumed = useRef(false)

  useEffect(() => {
    if (!active || consumed.current) return
    consumed.current = true
    // Limpia el flag SIN agregar una entrada en el history. La página queda
    // en su URL canónica y el back button no rebota al estado con flag.
    const cleanParams = new URLSearchParams(location.search)
    cleanParams.delete(flag)
    const search = cleanParams.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
    onActiveRef.current?.()
    // Solo se ejecuta una vez al montar — `consumed.current` garantiza
    // single-fire idempotente incluso bajo el doble-mount de StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return active
}
