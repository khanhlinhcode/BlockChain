import {
  calculateFileHash,
  cn,
  copyToClipboard,
  formatCertId,
  formatDate,
  formatDateRelative,
  formatAddress,
  getStatusColor,
  truncateHash,
  verifyFileHash,
} from "./utils";

describe("utils", () => {
  const createMockFile = (content: string) =>
    ({
      arrayBuffer: async () => new TextEncoder().encode(content).buffer,
    } as unknown as File);

  test("calculateFileHash returns 64-char hex string", async () => {
    const file = createMockFile("test content");
    const hash = await calculateFileHash(file);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("calculateFileHash is deterministic (same file = same hash)", async () => {
    const content = "deterministic test content";
    const file1 = createMockFile(content);
    const file2 = createMockFile(content);

    const hash1 = await calculateFileHash(file1);
    const hash2 = await calculateFileHash(file2);

    expect(hash1).toBe(hash2);
  });

  test("calculateFileHash changes when content changes", async () => {
    const hash1 = await calculateFileHash(createMockFile("content-a"));
    const hash2 = await calculateFileHash(createMockFile("content-b"));

    expect(hash1).not.toBe(hash2);
  });

  test("formatAddress truncates correctly", () => {
    expect(formatAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234...5678"
    );
  });

  test("formatAddress handles empty and short values", () => {
    expect(formatAddress("")).toBe("");
    expect(formatAddress("0x1234")).toBe("0x1234");
  });

  test("truncateHash handles 0x prefix", () => {
    const hash = `0x${"a".repeat(64)}`;
    expect(truncateHash(hash)).toBe("0xaaaaaaaa...aaaaaaaa");
  });

  test("verifyFileHash supports 0x/non-0x comparison", async () => {
    const file = createMockFile("matching content");
    const hash = await calculateFileHash(file);

    await expect(verifyFileHash(file, hash)).resolves.toBe(true);
    await expect(verifyFileHash(file, `0x${hash}`)).resolves.toBe(true);
    await expect(verifyFileHash(file, `0x${"b".repeat(64)}`)).resolves.toBe(false);
  });

  test("truncateHash without prefix works", () => {
    expect(truncateHash("a".repeat(64), 8)).toBe("aaaaaaaa...aaaaaaaa");
  });

  test("formatDate returns readable value for valid date", () => {
    expect(formatDate("2024-01-15T00:00:00.000Z")).toBe("January 15, 2024");
  });

  test("formatDate returns invalid marker for bad value", () => {
    expect(formatDate("not-a-date")).toBe("Invalid date");
  });

  test("formatDateRelative returns relative text", () => {
    jest.useFakeTimers().setSystemTime(new Date("2024-01-03T00:00:00.000Z"));
    const result = formatDateRelative("2024-01-01T00:00:00.000Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    jest.useRealTimers();
  });

  test("formatDateRelative covers week/month/year branches", () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    expect(formatDateRelative("2024-12-25T00:00:00.000Z")).toContain("week");
    expect(formatDateRelative("2024-11-01T00:00:00.000Z")).toContain("month");
    expect(formatDateRelative("2023-01-01T00:00:00.000Z")).toContain("year");
    jest.useRealTimers();
  });

  test("formatDateRelative returns invalid for malformed date", () => {
    expect(formatDateRelative("bad-date")).toBe("Invalid date");
  });

  test("formatCertId normalizes casing and spacing", () => {
    expect(formatCertId(" cert 2024 test ")).toBe("CERT-2024-TEST");
  });

  test("formatCertId handles empty string", () => {
    expect(formatCertId("")).toBe("");
  });

  test("getStatusColor returns correct tailwind classes", () => {
    expect(getStatusColor(true)).toMatch(/red/);
    expect(getStatusColor(false)).toMatch(/green/);
  });

  test("copyToClipboard calls navigator clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    await copyToClipboard("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  test("copyToClipboard fallback uses document.execCommand", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await copyToClipboard("fallback");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  test("copyToClipboard returns early on empty text", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    await copyToClipboard("");
    expect(writeText).not.toHaveBeenCalled();
  });

  test("calculateFileHash throws when Web Crypto is unavailable", async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });

    const file = createMockFile("test content");
    await expect(calculateFileHash(file)).rejects.toThrow(/Web Crypto API/i);

    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  });

  test("cn merges class names", () => {
    expect(cn("p-2", "p-4", "text-sm")).toBe("p-4 text-sm");
  });
});
