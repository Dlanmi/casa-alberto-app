import { cva } from 'class-variance-authority'

/**
 * Variantes compartidas entre Button y SubmitButton (y futuras variantes).
 * En archivo aparte porque Vite/HMR (`react-refresh/only-export-components`)
 * exige que los archivos de componentes sólo exporten componentes.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover rounded-md',
        secondary: 'bg-surface-muted text-text hover:bg-border rounded-md',
        ghost: 'hover:bg-surface-muted text-text-muted rounded-md',
        danger: 'bg-error text-white hover:bg-error-strong rounded-md',
        outline: 'border border-border bg-surface text-text hover:bg-surface-muted rounded-md'
      },
      size: {
        xs: 'h-10 px-2.5 text-xs gap-1',
        sm: 'h-10 px-3 text-sm gap-1.5',
        default: 'h-11 px-5 text-sm gap-2',
        lg: 'h-12 px-6 text-base gap-2',
        icon: 'h-11 w-11'
      }
    },
    defaultVariants: { variant: 'primary', size: 'default' }
  }
)
