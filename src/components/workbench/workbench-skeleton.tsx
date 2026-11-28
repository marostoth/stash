import { resolveCollectionGridClass } from '@/components/workbench/collection-header-badges';
import type { CardDensity } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface WorkbenchSkeletonProps {
  density: CardDensity;
  wideBoard: boolean;
}

const SKELETON_SECTIONS = [
  { id: 'sec-1', cards: ['c1', 'c2', 'c3', 'c4'] },
  { id: 'sec-2', cards: ['c5', 'c6', 'c7', 'c8'] },
] as const;

/**
 * Height-matched structural skeleton displayed on cold New Tab boot while
 * `chrome.storage.local` hydrates, eliminating layout jump and text flashes.
 */
export function WorkbenchSkeleton({
  density,
  wideBoard,
}: WorkbenchSkeletonProps) {
  const gridClass = resolveCollectionGridClass(density, 'compact', wideBoard);
  const cardHeightClass =
    density === 'micro'
      ? 'h-[54px]'
      : density === 'compact'
        ? 'h-[82px]'
        : 'h-[104px]';

  return (
    <output
      aria-busy="true"
      aria-label="Loading workspace"
      className="block space-y-10"
    >
      {SKELETON_SECTIONS.map((section) => (
        <section key={section.id} className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="stash-skeleton-row h-4 w-4 rounded-control bg-card" />
              <div className="stash-skeleton-row h-4 w-36 rounded bg-card" />
              <div className="stash-skeleton-row h-3.5 w-8 rounded-pill bg-card/70" />
            </div>
            <div className="flex items-center gap-2">
              <div className="stash-skeleton-row h-7 w-16 rounded-control bg-card/70" />
              <div className="stash-skeleton-row h-7 w-16 rounded-control bg-card/60" />
            </div>
          </div>

          <div className={gridClass}>
            {section.cards.map((cardId) => (
              <div
                key={cardId}
                className={cn(
                  'stash-skeleton-row flex flex-col justify-between rounded-card border border-hairline bg-card/70 p-3.5',
                  cardHeightClass,
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 shrink-0 rounded-control bg-panel" />
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    <div className="h-3.5 w-3/4 rounded bg-panel" />
                    <div className="h-2.5 w-1/2 rounded bg-panel/75" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </output>
  );
}
