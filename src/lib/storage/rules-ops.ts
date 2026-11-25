import { sortRulesByPriority } from '@/lib/categorizer/rules-engine';
import { rulesStorage } from '@/lib/storage/items';
import type { CategorizationRule } from '@/lib/types/stash';
import { normalizeTags } from '@/lib/utils/url';

export interface CreateRuleInput {
  name: string;
  enabled?: boolean;
  priority?: number;
  match: {
    domainContains?: string[];
    titleKeywords?: string[];
    urlContains?: string[];
  };
  action: {
    targetCollectionId: string;
    addTags?: string[];
  };
}

export interface UpdateRuleInput {
  name?: string;
  enabled?: boolean;
  priority?: number;
  match?: {
    domainContains?: string[];
    titleKeywords?: string[];
    urlContains?: string[];
  };
  action?: {
    targetCollectionId: string;
    addTags?: string[];
  };
}

function cleanList(
  values: readonly string[] | undefined,
): string[] | undefined {
  if (!values) return undefined;
  const cleaned = values.map((v) => v.trim().toLowerCase()).filter(Boolean);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : undefined;
}

export async function getSortedRules(): Promise<CategorizationRule[]> {
  return sortRulesByPriority(await rulesStorage.getValue());
}

export function watchSortedRules(
  cb: (rules: CategorizationRule[]) => void,
): () => void {
  return rulesStorage.watch((next) => cb(sortRulesByPriority(next)));
}

export async function createRuleInStorage(
  input: CreateRuleInput,
): Promise<CategorizationRule> {
  const existing = sortRulesByPriority(await rulesStorage.getValue());
  const nextPriority =
    input.priority ??
    (existing.length > 0
      ? (existing[existing.length - 1]?.priority ?? 0) + 1
      : 1);

  const created: CategorizationRule = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Untitled Rule',
    enabled: input.enabled ?? true,
    priority: nextPriority,
    match: {
      domainContains: cleanList(input.match.domainContains),
      titleKeywords: cleanList(input.match.titleKeywords),
      urlContains: cleanList(input.match.urlContains),
    },
    action: {
      targetCollectionId: input.action.targetCollectionId,
      addTags: input.action.addTags
        ? normalizeTags(input.action.addTags)
        : undefined,
    },
  };

  await rulesStorage.setValue(sortRulesByPriority([...existing, created]));
  return created;
}

export async function updateRuleInStorage(
  id: string,
  patch: UpdateRuleInput,
): Promise<CategorizationRule | null> {
  const existing = await rulesStorage.getValue();
  let updated: CategorizationRule | null = null;

  const next = existing.map((rule) => {
    if (rule.id !== id) return rule;
    updated = {
      ...rule,
      ...(patch.name !== undefined
        ? { name: patch.name.trim() || rule.name }
        : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.match !== undefined
        ? {
            match: {
              domainContains: cleanList(patch.match.domainContains),
              titleKeywords: cleanList(patch.match.titleKeywords),
              urlContains: cleanList(patch.match.urlContains),
            },
          }
        : {}),
      ...(patch.action !== undefined
        ? {
            action: {
              targetCollectionId: patch.action.targetCollectionId,
              addTags: patch.action.addTags
                ? normalizeTags(patch.action.addTags)
                : undefined,
            },
          }
        : {}),
    };
    return updated;
  });

  if (!updated) return null;
  await rulesStorage.setValue(sortRulesByPriority(next));
  return updated;
}

export async function deleteRuleInStorage(id: string): Promise<boolean> {
  const existing = await rulesStorage.getValue();
  const remaining = existing.filter((rule) => rule.id !== id);
  if (remaining.length === existing.length) return false;
  const reindexed = sortRulesByPriority(remaining).map((rule, idx) => ({
    ...rule,
    priority: idx + 1,
  }));
  await rulesStorage.setValue(reindexed);
  return true;
}

export async function moveRulePriorityInStorage(
  id: string,
  direction: 'up' | 'down',
): Promise<CategorizationRule[]> {
  const sorted = sortRulesByPriority(await rulesStorage.getValue());
  const index = sorted.findIndex((rule) => rule.id === id);
  if (index === -1) return sorted;

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return sorted;

  const current = sorted[index];
  const neighbor = sorted[swapIndex];
  if (!current || !neighbor) return sorted;

  sorted[index] = neighbor;
  sorted[swapIndex] = current;

  const reindexed = sorted.map((rule, idx) => ({
    ...rule,
    priority: idx + 1,
  }));
  await rulesStorage.setValue(reindexed);
  return reindexed;
}
