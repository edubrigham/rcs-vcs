/**
 * SSRF hardening for server-side fetches of user-supplied URLs. Pure predicates
 * (scheme + address classification) so they're unit-testable; the route composes
 * them with DNS resolution and connection pinning.
 */

import ipaddr from "ipaddr.js";

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

/**
 * True unless `ip` is a globally-routable public unicast address. Uses ipaddr.js
 * CIDR classification — covers loopback, private, link-local (incl. the cloud
 * metadata 169.254.169.254), carrier-grade NAT, reserved, multicast, broadcast,
 * unique-local (ULA), etc. — and unwraps IPv4-mapped IPv6 (::ffff:a.b.c.d) so it
 * is classified by its embedded v4 address. Unparseable input is blocked.
 */
export function isBlockedAddress(ip: string): boolean {
  let addr: ReturnType<typeof ipaddr.parse>;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return true;
  }
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) addr = v6.toIPv4Address();
  }
  // 'unicast' is the only globally-routable public category for both families.
  return addr.range() !== "unicast";
}
