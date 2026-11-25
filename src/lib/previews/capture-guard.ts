const SENSITIVE_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)(login|log-in|signin|sign-in|logout|signout)(\/|$)/i,
  /(^|\/)(auth|oauth|oauth2|sso|saml|oidc)(\/|$)/i,
  /(^|\/)(checkout|billing|payment|payments|pay|invoice|cart\/checkout)(\/|$)/i,
  /(^|\/)(password|reset-password|forgot-password|change-password|passwd)(\/|$)/i,
  /(^|\/)(2fa|mfa|totp|otp|verify-identity|security-checkup)(\/|$)/i,
];

const SENSITIVE_DOMAINS: readonly string[] = [
  '1password.com',
  'bitwarden.com',
  'lastpass.com',
  'dashlane.com',
  'keepersecurity.com',
  'nordpass.com',
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'account.proton.me',
  'checkout.stripe.com',
  'billing.stripe.com',
];

function isSensitiveHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return SENSITIVE_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`),
  );
}

/**
 * Pure guard deciding whether a URL is safe for screenshot capture or OG fetching.
 * Rejects non-http(s) schemes and sensitive auth, payment, and password-manager URLs.
 */
export function isPreviewableUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return false;
  }

  if (!parsed.hostname || isSensitiveHost(parsed.hostname)) {
    return false;
  }

  const pathname = parsed.pathname.toLowerCase();
  if (SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return false;
  }

  return true;
}

export interface CaptureTabCandidate {
  url?: string;
  incognito?: boolean;
}

export function shouldCaptureTab(tab: CaptureTabCandidate): boolean {
  if (tab.incognito === true) return false;
  return isPreviewableUrl(tab.url);
}
