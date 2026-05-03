import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { cn } from '@renderer/lib/cn'

type TooltipProps = {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': visible ? tooltipId : undefined
      })
    : children

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {child}
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2.5 py-1.5 text-xs font-medium text-white bg-text rounded-sm whitespace-normal max-w-50 text-center shadow-2',
            // La animación entra desde la dirección OPUESTA al lado donde
            // se renderiza el tooltip (un tooltip 'top' aparece arriba del
            // trigger y entra desde abajo). Mantenemos los translates de
            // centrado dentro del propio keyframe para evitar conflictos.
            position === 'top' &&
              'bottom-full left-1/2 -translate-x-1/2 mb-2 animate-tooltip-from-bottom',
            position === 'bottom' &&
              'top-full left-1/2 -translate-x-1/2 mt-2 animate-tooltip-from-top',
            position === 'left' &&
              'right-full top-1/2 -translate-y-1/2 mr-2 animate-tooltip-from-right',
            position === 'right' &&
              'left-full top-1/2 -translate-y-1/2 ml-2 animate-tooltip-from-left'
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
