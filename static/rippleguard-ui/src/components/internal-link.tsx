import type { ComponentProps, MouseEvent } from 'react'
import { useRouter } from '@/lib/router-context'
import { cn } from '@/lib/utils'

type InternalLinkProps = Omit<ComponentProps<'a'>, 'href'> & { to: string }

/** Link to another RippleGuard view (client-side navigation). */
export function InternalLink({ to, className, onClick, ...props }: InternalLinkProps) {
  const { navigate } = useRouter()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    navigate(to)
  }
  return (
    <a
      href={to}
      onClick={handleClick}
      className={cn(
        'font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  )
}
