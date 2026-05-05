// CorreoField — correo electrónico. Trim al blur, valida formato vía
// regex robusta, marca error inline si malformado. No bloquea el submit
// — el padre decide; aquí solo da feedback visual.
import { type FocusEvent, useState } from 'react'
import { TextField } from './text-field'
import { esCorreoValido } from './correo-utils'

type CorreoFieldProps = {
  label?: string
  value: string
  onChange: (s: string) => void
  onBlur?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  /** Error externo del padre (ej. "ya existe"). Se prioriza sobre el error interno. */
  error?: string
  helpText?: string
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
}

export function CorreoField({
  label = 'Correo',
  value,
  onChange,
  onBlur,
  placeholder = 'ejemplo@correo.com',
  error,
  helpText,
  id,
  className,
  disabled,
  required,
  autoFocus
}: CorreoFieldProps): React.JSX.Element {
  // Marca si el dueño ya tocó el campo. El error interno solo se muestra
  // tras el primer blur, no en cada keystroke.
  const [touched, setTouched] = useState(false)
  const formatoMalo = touched && value.trim().length > 0 && !esCorreoValido(value)
  const errorMostrar =
    error ??
    (formatoMalo ? 'El correo no se ve bien — debe tener formato usuario@dominio.com' : undefined)

  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      onBlur={(e) => {
        setTouched(true)
        onBlur?.(e)
      }}
      placeholder={placeholder}
      error={errorMostrar}
      helpText={helpText}
      id={id}
      className={className}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      type="email"
      maxLength={120}
    />
  )
}
