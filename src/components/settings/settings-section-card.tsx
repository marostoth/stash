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
        'space-y-3 rounded-card border border-border bg-canvas p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-accent" aria-hidden="true">
            {icon}
          </span>
          <h3 className="truncate text-xs font-semibold text-fg">{title}</h3>
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

      {subtitle ? (
        <p className="text-xs leading-relaxed text-fg-muted">{subtitle}</p>
      ) : null}

      {children}
    </section>
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
    <div className="flex items-center justify-between gap-3 py-1">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <div className="text-xs text-fg">{label}</div>
        {hint ? <div className="text-[11px] text-fg-muted">{hint}</div> : null}
      </label>
      <div className="flex shrink-0 items-center gap-2">
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
