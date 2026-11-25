import { GripVertical } from 'lucide-react';
import type { DragItemData } from '@/lib/dnd/types';
import { TAB_GROUP_COLOR_SWATCH } from '@/lib/types/stash';
import { extractDomain, getMonogram } from '@/lib/utils/url';

interface DragGhostProps {
  data: DragItemData;
}

export function DragGhost({ data }: DragGhostProps) {
  if (data.kind === 'collection') {
    const colorHex = TAB_GROUP_COLOR_SWATCH[data.collection.color];
    return (
      <div
        className="flex w-72 items-center gap-2 rounded-card border border-accent/70 bg-panel px-3.5 py-2.5 shadow-2xl will-change-transform"
        style={{ transform: 'translate3d(0, 0, 0) rotate(1.5deg)' }}
      >
        <GripVertical className="h-4 w-4 text-accent" />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorHex }}
        />
        <span className="truncate text-sm font-semibold text-fg">
          {data.collection.name}
        </span>
      </div>
    );
  }

  const title = data.kind === 'link' ? data.link.title : data.tab.title;
  const url = data.kind === 'link' ? data.link.url : data.tab.url;
  const faviconUrl =
    data.kind === 'link' ? data.link.faviconUrl : data.tab.favIconUrl;
  const domain = extractDomain(url);
  const monogram = getMonogram(title, url);

  return (
    <div
      className="flex w-64 items-start gap-2.5 rounded-card border border-accent/75 bg-card p-3 shadow-2xl will-change-transform"
      style={{ transform: 'translate3d(0, 0, 0) rotate(2.5deg)' }}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-panel font-mono text-xs font-semibold text-accent">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            width={16}
            height={16}
            draggable={false}
            className="h-4 w-4 object-contain"
          />
        ) : (
          <span>{monogram}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-xs font-medium text-fg">{title}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-fg-muted">
          {domain}
        </div>
      </div>
    </div>
  );
}
