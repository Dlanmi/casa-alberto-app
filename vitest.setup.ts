import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Casa Alberto opera 100% en Colombia (UTC-5). Forzamos la zona horaria del
// runtime de tests para que `Date#getFullYear/Month/Date` (usados por
// helpers como `toFechaISO`) interpreten "ahora" como hora de Bogotá.
// Sin esto, tests que crean `new Date('2026-04-24T23:30:00-05:00')` y
// esperan que el día local sea 24 fallan en CI/UTC porque ahí el día
// local es 25. En producción cada PC del taller corre en zona Colombia.
process.env.TZ = 'America/Bogota'

afterEach(() => {
  cleanup()
})

if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(): void {
      this.setAttribute('open', '')
    }
  }

  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(): void {
      this.removeAttribute('open')
    }
  }
}
