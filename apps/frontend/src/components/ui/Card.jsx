import { forwardRef } from 'react'
import { clsx } from 'clsx'

export const Card = forwardRef(
  ({ className, variant = 'glass', ...props }, ref) => {
    const variantStyles = {
      glass: 'glass-card',
      'glass-strong': 'glass-card-strong',
      default: 'bg-white/30 backdrop-blur-md border border-white/40'
    }
    
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl',
          variantStyles[variant] || variantStyles.default,
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export const CardHeader = forwardRef(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx('flex flex-col space-y-1.5 p-6', className)}
        {...props}
      />
    )
  }
)

CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={clsx('text-2xl font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    )
  }
)

CardTitle.displayName = 'CardTitle'

export const CardContent = forwardRef(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx('p-6 pt-0', className)} {...props} />
    )
  }
)

CardContent.displayName = 'CardContent'
