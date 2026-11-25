import type * as React from 'react';
import { cn } from '@/lib/utils/cn';

const fieldBase =
  'w-full rounded-control border border-border bg-canvas px-3 py-2 text-sm text-fg placeholder:text-fg-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50';

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, 'h-9', className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, 'min-h-[72px] resize-y py-2', className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(fieldBase, 'h-9 cursor-pointer bg-canvas py-1', className)}
      {...props}
    />
  );
}
