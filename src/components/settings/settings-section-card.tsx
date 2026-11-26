import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';

export interface SettingsBadgeSpec {
  label: string;
  tone?: 'accent' | 'neutral' | 'warning';
}

interface SettingsSectionCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: SettingsBadgeSpec;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

const BADGE_TONE_CLASS: Record<
  NonNullable<SettingsBadgeSpec['tone']>,
  string
> = {
  accent: 'border-accent/40 bg-accent/15 text-accent',
  neutral: 'border-border bg-panel text-fg-muted',
  warning: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
};

/**
 * Shared section card shell giving every Settings tab one clean visual hierarchy.
 */
export function SettingsSectionCard({
  icon,
  title,
  subtitle,
  badge,
  headerAction,
  children,
  className,
}: SettingsSectionCardProps) {
  return (
    <section
      className={cn(
        'space-y-4 rounded-card border border-border/80 bg-canvas/90 p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border/75 bg-panel/80 text-accent"
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-tight text-fg">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {badge ? (
            <span
              className={cn(
                'rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase',
                BADGE_TONE_CLASS[badge.tone ?? 'neutral'],
              )}
            >
              {badge.label}
            </span>
          ) : null}
          {headerAction}
        </div>
      </div>

      {children}
    </section>
  );
}

export function SettingsGroupHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-fg-muted/85',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SettingsToggleRowProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  extraControl?: ReactNode;
}

export function SettingsToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
  extraControl,
}: SettingsToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0.5 last:pb-0.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-xs leading-relaxed text-fg-muted">
            {hint}
          </div>
        ) : null}
      </label>
      <div className="flex shrink-0 items-center gap-2.5">
        {extraControl}
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

interface SettingsControlRowProps {
  htmlFor?: string;
  label: string;
  hint?: string;
  control: ReactNode;
}

export function SettingsControlRow({
  htmlFor,
  label,
  hint,
  control,
}: SettingsControlRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2.5 first:pt-0.5 last:pb-0.5">
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className="block text-[13px] font-medium text-fg select-none"
          >
            {label}
          </label>
        ) : (
          <div className="text-[13px] font-medium text-fg select-none">
            {label}
          </div>
        )}
        {hint ? (
          <div className="mt-0.5 text-xs leading-relaxed text-fg-muted">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
