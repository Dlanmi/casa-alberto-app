import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  onClear?: () => void
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    return (
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-soft pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          className={cn(
            'h-11 w-full rounded-md border border-border bg-surface pl-10 pr-10 text-sm text-text shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]',
            'placeholder:text-text-soft',
            'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
            className
          )}
          {...props}
        />
        {value && String(value).length > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-soft hover:text-text-muted cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
