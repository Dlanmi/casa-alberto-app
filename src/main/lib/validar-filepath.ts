// Validación de tipo + longitud de un payload `filePath` recibido por IPC
// desde el renderer. NO valida path traversal ni symlinks — esa garantía
// la da `validarPathSeguro` en el consumidor (PDF, backup). Esto es el
// guard sintáctico del boundary: rechaza tipos absurdos antes de tocar
// el filesystem.
//
// Retorna un Result en lugar de throw porque el handler IPC necesita
// devolver un IpcResult al renderer; lanzar y atrapar agregaría ruido.
export type FilePathValidationResult = { ok: true; value: string } | { ok: false; error: string }

const MAX_FILEPATH_LENGTH = 4096

export function validarFilePathInput(input: unknown): FilePathValidationResult {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Ruta inválida' }
  }
  if (input.length === 0) {
    return { ok: false, error: 'Ruta inválida' }
  }
  if (input.length > MAX_FILEPATH_LENGTH) {
    return { ok: false, error: 'Ruta inválida' }
  }
  return { ok: true, value: input }
}
