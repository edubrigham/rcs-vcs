import { describe, it, expect } from "vitest";
import { requireHttps, isBlockedAddress, SsrfError } from "@/lib/media/ssrfGuard";

describe("ssrfGuard", () => {
  it("allows https, rejects other schemes", () => {
    expect(requireHttps("https://ex.com/a.png").hostname).toBe("ex.com");
    expect(() => requireHttps("http://ex.com")).toThrow(SsrfError);
    expect(() => requireHttps("file:///etc/passwd")).toThrow(SsrfError);
    expect(() => requireHttps("not a url")).toThrow(SsrfError);
  });

  it("blocks private / loopback / link-local / metadata / CGNAT (IPv4)", () => {
    for (const ip of [
      "127.0.0.1", // loopback
      "10.0.0.5", // private
      "192.168.1.1", // private
      "169.254.169.254", // link-local + cloud metadata
      "172.16.0.1", // private 172.16/12
      "0.0.0.0", // "this" network
      "100.64.0.1", // carrier-grade NAT
      "224.0.0.1", // multicast
    ]) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
    expect(isBlockedAddress("93.184.216.34")).toBe(false); // public
  });

  it("blocks loopback / ULA / link-local + IPv4-mapped (IPv6)", () => {
    for (const ip of ["::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
    expect(isBlockedAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false); // public
  });

  it("blocks unparseable input", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});
