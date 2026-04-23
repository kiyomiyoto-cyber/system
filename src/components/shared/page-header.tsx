import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/motion/fade-in'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
  className?: string
}

export function PageHeader({ title, description, action, breadcrumb, className }: PageHeaderProps) {
  return (
    <FadeIn
      as="header"
      className={cn(
        'flex flex-col gap-1 pb-6 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="select-none text-muted-foreground/50">/</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="rounded-sm px-0.5 transition-colors hover:text-foreground focus-ring"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className={i === breadcrumb.length - 1 ? 'text-foreground' : ''}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.625rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-3 shrink-0 sm:mt-0">{action}</div>}
    </FadeIn>
  )
}
