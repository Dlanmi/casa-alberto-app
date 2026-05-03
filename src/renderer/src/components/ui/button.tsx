import { forwardRef, type ButtonHTMLAttributes } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/cn'
import { buttonVariants } from './button-variants'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'
