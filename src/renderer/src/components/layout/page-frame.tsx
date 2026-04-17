import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { cn } from '@renderer/lib/cn'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost'

export type PageAction = {
  label: string
  onClick: () => void
  icon?: LucideIcon
  variant?: ActionVariant
  disabled?: boolean
  buttonType?: ButtonHTMLAttributes<HTMLButtonElement>['type']
}

type GuidanceContent =
  | ReactNode
  | {
      tone?: 'info' | 'warning' | 'success' | 'accent'
      title: string
      message: string
      actionLabel?: string
      onAction?: () => void
    }

type PageFrameProps = {
  eyebrow?: string
  title: string
  subtitle: string
  guidance?: GuidanceContent
  primaryAction?: PageAction
  secondaryActions?: PageAction[]
  filters?: ReactNode
  children?: ReactNode
  className?: string
}

type ScreenProps = PageFrameProps & {
  contentClassName?: string
}

type WorkflowScreenProps = PageFrameProps & {
  main: ReactNode
  aside?: ReactNode
  mainClassName?: string
  asideClassName?: string
}

function renderAction(action: PageAction, index: number): React.JSX.Element {
  const Icon = action.icon

  return (
    <Button
      key={`${action.label}-${index}`}
      type={action.buttonType ?? 'button'}
      variant={action.variant ?? 'outline'}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {Icon && <Icon size={16} />}
      {action.label}
    </Button>
  )
}

function renderGuidance(guidance: GuidanceContent | undefined): ReactNode {
  if (!guidance) return null

  if (typeof guidance === 'object' && 'title' in guidance && 'message' in guidance) {
    return (
      <GuidanceHint
        tone={guidance.tone}
        title={guidance.title}
        message={guidance.message}
        actionLabel={guidance.actionLabel}
        onAction={guidance.onAction}
      />
    )
  }

  return guidance
}

function Header({
  eyebrow,
  title,
  subtitle,
  guidance,
  primaryAction,
  secondaryActions,
  filters
}: Omit<PageFrameProps, 'children' | 'className'>): React.JSX.Element {
  return (
    <div className="pb-6 border-b border-border">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
              {eyebrow}
            </p>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-text">{title}</h1>
            <p className="max-w-2xl text-base leading-relaxed text-text-muted">{subtitle}</p>
          </div>
        </div>

        {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions?.map(renderAction)}
            {primaryAction &&
              renderAction({ ...primaryAction, variant: primaryAction.variant ?? 'primary' }, 999)}
          </div>
        )}
      </div>

      {(guidance || filters) && (
        <div className="mt-6 space-y-4">
          {renderGuidance(guidance)}
          {filters}
        </div>
      )}
    </div>
  )
}

export function PageSection({
  title,
  description,
  action,
  children,
  className
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-soft">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
  icon: Icon
}: {
  label: string
  value: ReactNode
  detail?: string
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info'
  icon?: LucideIcon
}): React.JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'bg-success/8 text-success-strong'
      : tone === 'warning'
        ? 'bg-warning/8 text-warning-strong'
        : tone === 'error'
          ? 'bg-error/8 text-error-strong'
          : tone === 'info'
            ? 'bg-info/8 text-info-strong'
            : 'bg-surface-muted text-text-muted'

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', toneClass)}>
          {Icon && <Icon size={18} />}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
            {label}
          </p>
          {detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}
        </div>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-text">{value}</div>
    </Card>
  )
}

export function PageFrame({
  children,
  className,
  ...headerProps
}: PageFrameProps): React.JSX.Element {
  return (
    <div className={cn('space-y-6', className)}>
      <Header {...headerProps} />
      {children}
    </div>
  )
}

export function OperationalBoard({
  children,
  contentClassName,
  ...headerProps
}: ScreenProps): React.JSX.Element {
  return (
    <PageFrame {...headerProps}>
      <div className={cn('space-y-6', contentClassName)}>{children}</div>
    </PageFrame>
  )
}

export function DirectoryScreen({
  children,
  contentClassName,
  ...headerProps
}: ScreenProps): React.JSX.Element {
  return (
    <PageFrame {...headerProps}>
      <div className={cn('space-y-5', contentClassName)}>{children}</div>
    </PageFrame>
  )
}

export function WorkflowScreen({
  main,
  aside,
  mainClassName,
  asideClassName,
  ...headerProps
}: WorkflowScreenProps): React.JSX.Element {
  return (
    <PageFrame {...headerProps}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className={cn('min-w-0 space-y-6', mainClassName)}>{main}</div>
        {aside ? <div className={cn('space-y-6', asideClassName)}>{aside}</div> : null}
      </div>
    </PageFrame>
  )
}
