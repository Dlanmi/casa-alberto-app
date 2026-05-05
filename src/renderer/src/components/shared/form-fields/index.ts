// Componentes de form blindados — todos garantizan que el valor que llega
// al `onChange` está limpio (trimeado, sin control chars, normalizado al
// formato canónico). Reformatean visualmente al perder foco para que el
// dueño VEA cómo entendimos lo que escribió.
//
// Uso recomendado:
//   - `<MoneyField>` — montos en pesos colombianos ($)
//   - `<NumberField mode="decimal">` — medidas en cm
//   - `<NumberField mode="integer">` — cantidades enteras
//   - `<TextField>` — texto con trim/max/sanitize
//   - `<CedulaField>` — cédula (solo dígitos, limpia separadores)
//   - `<TelefonoField>` — teléfono (solo dígitos, limpia separadores)
//   - `<CorreoField>` — correo con validación de formato
export { MoneyField } from './money-field'
export { NumberField } from './number-field'
export { TextField } from './text-field'
export { CedulaField } from './cedula-field'
export { TelefonoField } from './telefono-field'
export { CorreoField } from './correo-field'
export { esCorreoValido } from './correo-utils'
