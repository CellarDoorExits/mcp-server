if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  const { webcrypto } = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
