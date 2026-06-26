import { describe, it, expect } from "vitest";
import { requireHttps, isBlockedIpv4, isBlockedIpv6, SsrfError } from "@/lib/media/ssrfGuard";

describe("ssrfGuard", () => {
  it("allows https, rejects other schemes", () => {
    expect(requireHttps("https://ex.com/a.png").hostname).toBe("ex.com");
    expect(() => requireHttps("http://ex.com")).toThrow(SsrfError);
    expect(() => requireHttps("file:///etc/passwd")).toThrow(SsrfError);
    expect(() => requireHttps("not a url")).toThrow(SsrfError);
  });

  it("blocks private / loopback / link-local / metadata IPv4", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.16.0.1", "0.0.0.0"]) {
      expect(isBlockedIpv4(ip)).toBe(true);
    }
    expect(isBlockedIpv4("93.184.216.34")).toBe(false);
  });

  it("blocks loopback / ULA / link-local IPv6", () => {
    for (const ip of ["::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedIpv6(ip)).toBe(true);
    }
    expect(isBlockedIpv6("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});
