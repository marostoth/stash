import { useDraggable } from '@dnd-kit/react';
import { FolderPlus, Pin, Plus, Volume2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { LinkFavicon } from '@/components/LinkFavicon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import { closeTabs, switchToTab } from '@/lib/tabs/tab-actions';
import { type Collection, TAB_GROUP_COLOR_SWATCH } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';
import { useUiStore } from '@/store/ui-store';

export interface OpenTabRowProps {
  tab: OpenTabInfo;
  index: number;
  dimmed: boolean;
  sweeping: boolean;
  hoverPreviews: boolean;
  collections: readonly Collection[];
  onQuickStashTab: (tab: OpenTabInfo, collectionId: string) => Promise<void>;
}

export function OpenTabRow({
  tab,
  index,
  dimmed,
  sweeping,
  hoverPreviews,
  collections,
  onQuickStashTab,
}: OpenTabRowProps) {
  const openCreateCollection = useUiStore((s) => s.openCreateCollection);
  const schedulePreview = useUiStore((s) => s.schedulePreview);
  const dismissPreview = useUiStore((s) => s.dismissPreview);

  const { ref, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    type: 'open-tab',
    data: { kind: 'open-tab', tab },
  });

  const domain = extractDomain(tab.url);

  const handleCloseTab = (event: React.MouseEvent) => {
    event.stopPropagation();
    void closeTabs([tab.id]);
  };

  return (
    /* Outer wrapper strictly owns @dnd-kit/react ref & transforms — never apply Motion transforms here */
    <div ref={ref}>
      <motion.div
        animate={
          sweeping
            ? { x: -54, y: 14, scale: 0.88, opacity: 0.12 }
            : { x: 0, y: 0, scale: 1, opacity: 1 }
        }
        transition={{
          duration: 0.22,
          delay: sweeping ? Math.min(index, 10) * 0.022 : 0,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={cn(
          'group relative flex items-center gap-2 rounded-control border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-card cursor-grab active:cursor-grabbing',
          dimmed && 'opacity-65 hover:opacity-95',
          isDragging && 'opacity-35',
        )}
      >
        <button
          type="button"
          onClick={() => {
            dismissPreview();
            void switchToTab(tab.id);
          }}
          onPointerEnter={(event) => {
            if (!hoverPreviews || isDragging) return;
            const rect = event.currentTarget.getBoundingClientRect();
            schedulePreview({
              id: `tab:${tab.id}`,
              url: tab.url,
              title: tab.title,
              faviconUrl: tab.favIconUrl,
              anchor: {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              },
              preferredSide: 'left',
            });
          }}
          onPointerLeave={dismissPreview}
          title={`${tab.title}\n${tab.url}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded cursor-pointer"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-canvas">
            <LinkFavicon url={tab.url} faviconUrl={tab.favIconUrl} size="sm" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {tab.pinned && (
                <Pin
                  className="h-2.5 w-2.5 shrink-0 text-fg-muted"
                  aria-label="Pinned tab"
                />
              )}
              {tab.audible && (
                <Volume2
                  className="h-2.5 w-2.5 shrink-0 text-accent"
                  aria-label="Playing audio"
                />
              )}
              <span
                title={tab.title}
                className="truncate text-xs font-medium text-fg"
              >
                {tab.title}
              </span>
            </div>
            <div className="truncate font-mono text-[10px] text-fg-muted">
              {domain}
            </div>
          </div>
        </button>

        {/* Hover quick actions: 1-click stash + close */}
        <div
          data-dnd-no-drag="true"
          onPointerEnter={dismissPreview}
          className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        >
          {collections.length === 1 && collections[0] ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const target = collections[0];
                if (target) {
                  void onQuickStashTab(tab, target.id);
                }
              }}
              aria-label={`Stash to ${collections[0].name}`}
              title={`Stash to ${collections[0].name}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-panel hover:text-accent cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Stash tab to collection"
                  title="Stash to collection"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-panel hover:text-accent cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Stash to...</DropdownMenuLabel>
                {collections.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    onSelect={() => void onQuickStashTab(tab, col.id)}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: TAB_GROUP_COLOR_SWATCH[col.color],
                      }}
                    />
                    <span className="truncate">{col.name}</span>
                  </DropdownMenuItem>
                ))}
                {collections.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={openCreateCollection}>
                  <FolderPlus className="h-3.5 w-3.5 text-fg-muted" />
                  New collection...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            onClick={handleCloseTab}
            aria-label={`Close ${tab.title}`}
            title="Close tab"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-panel hover:text-danger cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
