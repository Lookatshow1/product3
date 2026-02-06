import React from 'react'
import { cn } from '@/lib/utils'

const variantStyles = {
  default: 'bg-blue-100 text-[#2563eb] border-blue-200',
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  destructive: 'bg-red-100 text-red-700 border-red-200',
  outline: 'bg-transparent text-gray-700 border-gray-300',
} as const

export type BadgeVariant = keyof typeof variantStyles

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
)

Badge.displayName = 'Badge'

export { Badge }
