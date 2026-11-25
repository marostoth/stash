import type {
  CategorizationSuggestion,
  CategorizationTarget,
} from '@/lib/categorizer/types';
import type { CategorizationRule } from '@/lib/types/stash';
import { normalizeTags } from '@/lib/utils/url';

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function cleanPatterns(values: readonly string[] | undefined): string[] {
  if (!values) return [];
  return values.map((v) => v.trim().toLowerCase()).filter(Boolean);
}

export function matchRule(
  target: CategorizationTarget,
  rule: CategorizationRule,
): boolean {
  if (!rule.enabled) return false;

  const domains = cleanPatterns(rule.match.domainContains);
  const titleKeywords = cleanPatterns(rule.match.titleKeywords);
  const urlParts = cleanPatterns(rule.match.urlContains);

  if (
    domains.length === 0 &&
    titleKeywords.length === 0 &&
    urlParts.length === 0
  ) {
    return false;
  }

  const hostname = extractHostname(target.url);
  const fullUrl = target.url.toLowerCase();
  const title = target.title.toLowerCase();

  if (domains.some((pattern) => hostname.includes(pattern))) {
    return true;
  }
  if (titleKeywords.some((keyword) => title.includes(keyword))) {
    return true;
  }
  if (urlParts.some((fragment) => fullUrl.includes(fragment))) {
    return true;
  }

  return false;
}

export function sortRulesByPriority(
  rules: readonly CategorizationRule[],
): CategorizationRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => a.rule.priority - b.rule.priority || a.index - b.index)
    .map((entry) => entry.rule);
}

export function evaluateTier1Rules(
  target: CategorizationTarget,
  rules: readonly CategorizationRule[],
  validCollectionIds?: ReadonlySet<string>,
): CategorizationSuggestion | null {
  const ordered = sortRulesByPriority(rules);

  for (const rule of ordered) {
    if (!rule.enabled) continue;
    if (
      validCollectionIds &&
      !validCollectionIds.has(rule.action.targetCollectionId)
    ) {
      continue;
    }

    if (matchRule(target, rule)) {
      return {
        source: 'rule',
        collectionId: rule.action.targetCollectionId,
        tags: normalizeTags(rule.action.addTags ?? []),
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
      };
    }
  }

  return null;
}
