import { router } from '@forge/bridge'
import type { ComponentProps, MouseEvent } from 'react'
import { ExternalLinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function isWebUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

type ExternalLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  href: string | null | undefined
  /** Show the "opens in a new tab" icon. */
  showIcon?: boolean
}

/**
 * Opens a link in a new browser tab through the Forge host (Custom UI runs in
 * a sandboxed iframe). Non-web URLs render as plain text.
 */
export function ExternalLink({ href, showIcon = false, className, children, ...props }: ExternalLinkProps) {
  if (!isWebUrl(href)) {
    return <span className={className}>{children}</span>
  }
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    router.open(href).catch(() => {
      window.open(href, '_blank', 'noopener,noreferrer')
    })
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      {children}
      {showIcon ? (
        <>
          <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </>
      ) : null}
    </a>
  )
}
