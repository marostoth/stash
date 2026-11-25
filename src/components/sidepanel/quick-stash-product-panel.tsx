import { Loader2, RefreshCw, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ProductFieldsSection,
  type ProductFormDraft,
} from '@/components/workbench/product-fields-section';

interface QuickStashProductPanelProps {
  isAlreadyStashed: boolean;
  extracting: boolean;
  notice: string | null;
  expanded: boolean;
  draft: ProductFormDraft;
  onExtract: () => void;
  onToggleExpanded: () => void;
  onChangeDraft: (next: ProductFormDraft) => void;
}

export function QuickStashProductPanel({
  isAlreadyStashed,
  extracting,
  notice,
  expanded,
  draft,
  onExtract,
  onToggleExpanded,
  onChangeDraft,
}: QuickStashProductPanelProps) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={extracting}
        onClick={onExtract}
        className="h-7 w-full gap-1.5 text-[11px]"
      >
        {extracting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        ) : isAlreadyStashed ? (
          <RefreshCw className="h-3.5 w-3.5 text-accent" />
        ) : (
          <ShoppingBag className="h-3.5 w-3.5 text-accent" />
        )}
        <span>
          {extracting
            ? 'Extracting product info...'
            : isAlreadyStashed
              ? 'Refresh from Tab'
              : 'Extract Price & Spec'}
        </span>
      </Button>

      {notice && (
        <p className="font-mono text-[10px] text-amber-400">{notice}</p>
      )}

      <ProductFieldsSection
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        draft={draft}
        onChange={onChangeDraft}
        compact
      />
    </div>
  );
}
