import { forwardRef } from 'react'
import { clsx } from 'clsx'

export const Input = forwardRef(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {label}
          </label>
        )}
        <input
          type={type}
          className={clsx(
            'glass-input flex h-11 w-full rounded-xl px-4 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all',
            error && 'border-red-400 focus-visible:ring-red-400',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
