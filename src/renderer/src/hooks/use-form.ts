import { useState, useCallback } from 'react'

type ValidationRule<T> = {
  required?: string
  min?: { value: number; message: string }
  max?: { value: number; message: string }
  pattern?: { value: RegExp; message: string }
  custom?: (value: unknown, values: T) => string | null
}

type ValidationRules<T> = Partial<Record<keyof T, ValidationRule<T>>>

type FormErrors<T> = Partial<Record<keyof T, string>>

interface UseFormReturn<T extends Record<string, unknown>> {
  values: T
  errors: FormErrors<T>
  setValue: <K extends keyof T>(field: K, value: T[K]) => void
  setValues: (partial: Partial<T>) => void
  handleChange: (
    field: keyof T
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  validate: () => boolean
  reset: (newValues?: T) => void
}

export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  rules?: ValidationRules<T>
): UseFormReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors<T>>({})

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const setValues = useCallback((partial: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleChange = useCallback(
    (field: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = e.target
        const value =
          target.type === 'number'
            ? target.value === ''
              ? ''
              : Number(target.value)
            : target.type === 'checkbox'
              ? (target as HTMLInputElement).checked
              : target.value
        setValue(field, value as T[keyof T])
      },
    [setValue]
  )

  const validate = useCallback((): boolean => {
    if (!rules) return true
    const newErrors: FormErrors<T> = {}
    let valid = true

    for (const [field, rule] of Object.entries(rules) as [keyof T, ValidationRule<T>][]) {
      const value = values[field]

      if (rule.required && (value === '' || value === null || value === undefined)) {
        newErrors[field] = rule.required
        valid = false
        continue
      }

      if (rule.min && typeof value === 'number' && value < rule.min.value) {
        newErrors[field] = rule.min.message
        valid = false
        continue
      }

      if (rule.max && typeof value === 'number' && value > rule.max.value) {
        newErrors[field] = rule.max.message
        valid = false
        continue
      }

      if (rule.pattern && typeof value === 'string' && !rule.pattern.value.test(value)) {
        newErrors[field] = rule.pattern.message
        valid = false
        continue
      }

      if (rule.custom) {
        const msg = rule.custom(value, values)
        if (msg) {
          newErrors[field] = msg
          valid = false
        }
      }
    }

    setErrors(newErrors)
    return valid
  }, [rules, values])

  const reset = useCallback(
    (newValues?: T) => {
      setValuesState(newValues ?? initialValues)
      setErrors({})
    },
    [initialValues]
  )

  return { values, errors, setValue, setValues, handleChange, validate, reset }
}
