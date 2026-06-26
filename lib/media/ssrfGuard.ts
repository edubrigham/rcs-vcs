/**
 * SSRF hardening for server-side fetches of user-supplied URLs. Pure predicates
 * (scheme + resolved-IP checks) so they're unit-testable; the route composes
 * them with DNS resolution.
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

/** Parse + require https. Throws SsrfError on anything else. */
export function requireHttps(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL.");
  }
  if (u.protocol !== "https:") throw new SsrfError("Only https URLs are allowed.");
  return u;
}

const BLOCKED_V4 = [
  /^127\./, // loopback
  /^10\./, // private
  /^192\.168\./, // private
  /^169\.254\./, // link-local + cloud metadata (169.254.169.254)
  /^0\./, // "this" network
  /^172\.(1[6-9]|2\d|3[01])\./, // private 172.16/12
];

export function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_V4.some((r) => r.test(ip));
}

export function isBlockedIpv6(ip: string): boolean {
  const x = ip.toLowerCase();
  return (
    x === "::1" || // loopback
    x.startsWith("fc") || // ULA
    x.startsWith("fd") || // ULA
    x.startsWith("fe80") || // link-local
    x.startsWith("::ffff:") // IPv4-mapped
  );
}
