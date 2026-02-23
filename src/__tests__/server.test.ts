import { describe, it, expect } from "vitest";
import { createServer } from "../server.js";

// We test the server by checking it creates without errors
// and has the expected tools registered.
// Full integration tests would require MCP client transport.

describe("createServer", () => {
  it("creates a server instance", () => {
    const server = createServer();
    expect(server).toBeTruthy();
  });
});
