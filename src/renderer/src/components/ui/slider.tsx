import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  showValue?: boolean
  suffix?: string
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, showValue = true, suffix = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && <label className="text-sm font-medium text-text">{label}</label>}
            {showValue && (
              <span className="text-sm tabular-nums text-text-muted">
                {props.value}
                {suffix}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          className={cn(
            'w-full h-2 bg-border rounded-full appearance-none cursor-pointer',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
            '[&::-webkit-slider-thumb]:shadow-1 [&::-webkit-slider-thumb]:cursor-pointer',
            // Feedback al hover/active: scale leve + sombra ligeramente más
            // marcada. transition-transform para que el cambio se sienta
            // en la mano del usuario, no como un salto visual.
            '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100',
            'hover:[&::-webkit-slider-thumb]:scale-110',
            'active:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:shadow-2',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Slider.displayName = 'Slider'
