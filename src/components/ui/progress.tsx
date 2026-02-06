import React from 'react'
import { cn } from '@/lib/utils'

const colorStyles = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-[#2563eb]',
} as const

export type ProgressColor = keyof typeof colorStyles

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value from 0 to 100 */
  value: number
  /** Bar color — green by default */
  color?: ProgressColor
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, color = 'green', ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value))

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn('h-2.5 w-full overflow-hidden rounded-full bg-gray-200', className)}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-in-out',
            colorStyles[color],
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    )
  },
)

Progress.displayName = 'Progress'

export { Progress }
