import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/cn'

const buttonVariants = cva(
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
        xs: 'h-8 px-2.5 text-xs gap-1',
        sm: 'h-9 px-3 text-sm gap-1.5',
        default: 'h-11 px-5 text-sm gap-2',
        lg: 'h-12 px-6 text-base gap-2',
        icon: 'h-11 w-11'
      }
    },
    defaultVariants: { variant: 'primary', size: 'default' }
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'
