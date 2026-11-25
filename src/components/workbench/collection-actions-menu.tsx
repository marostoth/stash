import {
  ArrowRightLeft,
  ArrowUpRight,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Space } from '@/lib/types/stash';

interface CollectionActionsMenuProps {
  collectionName: string;
  hasLinks: boolean;
  otherSpaces: readonly Space[];
  onAddLink: () => void;
  onWakeUp: () => void;
  onOpenInNewWindow: () => void;
  onEditCollection: () => void;
  onMoveToSpace: (space: Space) => void;
  onDeleteCollection: () => void;
}

export function CollectionActionsMenu({
  collectionName,
  hasLinks,
  otherSpaces,
  onAddLink,
  onWakeUp,
  onOpenInNewWindow,
  onEditCollection,
  onMoveToSpace,
  onDeleteCollection,
}: CollectionActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Collection actions for ${collectionName}`}
          className="h-7 w-7"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onAddLink}>
          <Plus className="h-3.5 w-3.5 text-fg-muted" />
          Add link
        </DropdownMenuItem>
        {hasLinks && (
          <>
            <DropdownMenuItem onSelect={onWakeUp}>
              <ArrowUpRight className="h-3.5 w-3.5 text-fg-muted" />
              Wake Up (Tab Group)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenInNewWindow}>
              <ExternalLink className="h-3.5 w-3.5 text-fg-muted" />
              Open in New Window
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={onEditCollection}>
          <Pencil className="h-3.5 w-3.5 text-fg-muted" />
          Edit collection
        </DropdownMenuItem>
        {otherSpaces.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to Space</DropdownMenuLabel>
            {otherSpaces.map((targetSpace) => (
              <DropdownMenuItem
                key={targetSpace.id}
                onSelect={() => onMoveToSpace(targetSpace)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-fg-muted" />
                <span className="truncate">{targetSpace.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDeleteCollection}
          className="text-danger focus:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete collection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
