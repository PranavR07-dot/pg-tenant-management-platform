import { forwardRef } from 'react'
import { cn } from '@/utils/helpers'

/**
 * Reusable form Input with optional label and error message.
 */
const Input = forwardRef(function Input(
  { label, error, id, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg border text-sm text-gray-900 placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'disabled:bg-gray-50 disabled:cursor-not-allowed',
          error
            ? 'border-red-400 focus:ring-red-400'
            : 'border-gray-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})

export default Input
