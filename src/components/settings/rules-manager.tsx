import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ListFilter,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { stashRepo } from '@/lib/storage/repo';
import {
  type CategorizationRule,
  type Collection,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { parseTagsInput } from '@/lib/utils/url';

interface RulesManagerProps {
  rules: readonly CategorizationRule[];
  collections: readonly Collection[];
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RulesManager({ rules, collections }: RulesManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [domainsRaw, setDomainsRaw] = useState('');
  const [keywordsRaw, setKeywordsRaw] = useState('');
  const [urlPartsRaw, setUrlPartsRaw] = useState('');
  const [targetCollectionId, setTargetCollectionId] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const collectionMap = new Map(collections.map((c) => [c.id, c]));

  const openCreateForm = () => {
    setEditingRuleId(null);
    setName('');
    setDomainsRaw('');
    setKeywordsRaw('');
    setUrlPartsRaw('');
    setTargetCollectionId(collections[0]?.id ?? '');
    setTagsRaw('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id);
    setName(rule.name);
    setDomainsRaw(rule.match.domainContains?.join(', ') ?? '');
    setKeywordsRaw(rule.match.titleKeywords?.join(', ') ?? '');
    setUrlPartsRaw(rule.match.urlContains?.join(', ') ?? '');
    setTargetCollectionId(rule.action.targetCollectionId);
    setTagsRaw(rule.action.addTags?.join(', ') ?? '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    const domainContains = splitCommaList(domainsRaw);
    const titleKeywords = splitCommaList(keywordsRaw);
    const urlContains = splitCommaList(urlPartsRaw);

    if (
      domainContains.length === 0 &&
      titleKeywords.length === 0 &&
      urlContains.length === 0
    ) {
      setFormError(
        'Add at least one domain, title keyword, or URL match pattern.',
      );
      return;
    }
    if (!targetCollectionId) {
      setFormError('Select a target collection.');
      return;
    }

    const payload = {
      name:
        name.trim() ||
        domainContains[0] ||
        titleKeywords[0] ||
        urlContains[0] ||
        'Auto Rule',
      match: { domainContains, titleKeywords, urlContains },
      action: {
        targetCollectionId,
        addTags: parseTagsInput(tagsRaw),
      },
    };

    if (editingRuleId) {
      await stashRepo.updateRule(editingRuleId, payload);
      toast.success('Rule updated');
    } else {
      await stashRepo.createRule(payload);
      toast.success('Rule added');
    }

    setFormOpen(false);
    setEditingRuleId(null);
  };

  const handleToggleRule = (rule: CategorizationRule) => {
    void stashRepo.updateRule(rule.id, { enabled: !rule.enabled });
  };

  const handleDeleteRule = async (rule: CategorizationRule) => {
    await stashRepo.deleteRule(rule.id);
    toast.success(`Deleted rule "${rule.name}"`);
  };

  return (
    <SettingsSectionCard
      icon={<ListFilter className="h-4 w-4" />}
      title="Auto-Categorization Rules"
      subtitle="Tier 1 rules run instantly in priority order (top to bottom) before On-Device AI fallback."
      badge={
        rules.length > 0
          ? { label: `${rules.length} active`, tone: 'neutral' }
          : undefined
      }
      headerAction={
        !formOpen ? (
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateForm}
            disabled={collections.length === 0}
            className="h-7 shrink-0 px-2.5 text-[11px]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
        ) : undefined
      }
    >
      {collections.length === 0 && (
        <div className="rounded-card border border-dashed border-border bg-panel/40 px-4 py-5 text-center text-xs text-fg-muted">
          Create at least one collection first so rules have a destination.
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={(e) => void handleSaveRule(e)}
          className="space-y-3 rounded-card border border-accent/40 bg-panel/60 p-4"
        >
          <div className="text-xs font-semibold text-fg">
            {editingRuleId ? 'Edit Rule' : 'New Auto-Categorization Rule'}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="rule-name"
                className="block text-[11px] font-medium text-fg"
              >
                Rule Name
              </label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GitHub -> Dev"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="rule-collection"
                className="block text-[11px] font-medium text-fg"
              >
                Target Collection
              </label>
              <Select
                id="rule-collection"
                value={targetCollectionId}
                onChange={(e) => setTargetCollectionId(e.target.value)}
                className="h-8 text-xs"
                required
              >
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="rule-domains"
                className="block text-[11px] font-medium text-fg"
              >
                Domain contains{' '}
                <span className="font-normal text-fg-muted">
                  (comma-separated)
                </span>
              </label>
              <Input
                id="rule-domains"
                value={domainsRaw}
                onChange={(e) => {
                  setDomainsRaw(e.target.value);
                  setFormError(null);
                }}
                placeholder="github.com, printables.com"
                className="h-8 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="rule-keywords"
                className="block text-[11px] font-medium text-fg"
              >
                Title keywords{' '}
                <span className="font-normal text-fg-muted">
                  (comma-separated)
                </span>
              </label>
              <Input
                id="rule-keywords"
                value={keywordsRaw}
                onChange={(e) => {
                  setKeywordsRaw(e.target.value);
                  setFormError(null);
                }}
                placeholder="esp32, tutorial, recipe"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="rule-url"
                className="block text-[11px] font-medium text-fg"
              >
                URL contains{' '}
                <span className="font-normal text-fg-muted">(optional)</span>
              </label>
              <Input
                id="rule-url"
                value={urlPartsRaw}
                onChange={(e) => {
                  setUrlPartsRaw(e.target.value);
                  setFormError(null);
                }}
                placeholder="/docs/, /wiki/"
                className="h-8 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="rule-tags"
                className="block text-[11px] font-medium text-fg"
              >
                Default tags{' '}
                <span className="font-normal text-fg-muted">(optional)</span>
              </label>
              <Input
                id="rule-tags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="dev, reference"
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-danger">{formError}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFormOpen(false);
                setEditingRuleId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingRuleId ? 'Save Rule' : 'Create Rule'}
            </Button>
          </div>
        </form>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        !formOpen &&
        collections.length > 0 && (
          <div className="rounded-card border border-dashed border-border bg-canvas/60 px-4 py-6 text-center text-xs text-fg-muted">
            No rules yet. Add a rule like{' '}
            <span className="font-mono text-fg">github.com</span> to instantly
            suggest a collection in the Side Panel and Auto-Triage.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => {
            const target = collectionMap.get(rule.action.targetCollectionId);
            const criteria = [
              ...(rule.match.domainContains ?? []).map((d) => `domain:${d}`),
              ...(rule.match.titleKeywords ?? []).map((k) => `title:${k}`),
              ...(rule.match.urlContains ?? []).map((u) => `url:${u}`),
            ];

            return (
              <div
                key={rule.id}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-card border border-border bg-canvas px-3 py-2.5 transition-opacity',
                  !rule.enabled && 'opacity-55',
                )}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                      #{index + 1}
                    </span>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRule(rule)}
                      aria-label={`Enable rule ${rule.name}`}
                    />
                    <span className="text-xs font-medium text-fg">
                      {rule.name}
                    </span>
                    <ArrowRight className="h-3 w-3 text-fg-muted" />
                    <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-panel px-2 py-0.5 text-[11px] text-fg">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: target
                            ? TAB_GROUP_COLOR_SWATCH[target.color]
                            : '#94A3B8',
                        }}
                      />
                      {target?.name ?? 'Deleted collection'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {criteria.map((c) => (
                      <span
                        key={c}
                        className="rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                      >
                        {c}
                      </span>
                    ))}
                    {(rule.action.addTags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-pill border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() =>
                      void stashRepo.moveRulePriority(rule.id, 'up')
                    }
                    aria-label="Move rule up"
                    className="h-7 w-7"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === rules.length - 1}
                    onClick={() =>
                      void stashRepo.moveRulePriority(rule.id, 'down')
                    }
                    aria-label="Move rule down"
                    className="h-7 w-7"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditForm(rule)}
                    aria-label={`Edit ${rule.name}`}
                    className="h-7 w-7"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDeleteRule(rule)}
                    aria-label={`Delete ${rule.name}`}
                    className="h-7 w-7 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingsSectionCard>
  );
}
