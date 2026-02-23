import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

async function setupClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  
  const client = new Client({ name: "test-client", version: "0.1.0" });
  
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  
  return client;
}

describe("MCP Server", () => {
  it("lists all tools", async () => {
    const client = await setupClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_exit_marker",
      "evaluate_admission",
      "generate_identity",
      "list_admission_policies",
      "quick_exit",
      "verify_and_admit",
      "verify_exit_marker",
      "verify_transfer",
    ]);
  });

  it("generate_identity returns a DID", async () => {
    const client = await setupClient();
    const result = await client.callTool({ name: "generate_identity", arguments: {} });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.did).toMatch(/^did:key:z/);
    expect(data.publicKey).toBeUndefined(); // private key material no longer exposed
  });

  it("quick_exit creates a verified marker", async () => {
    const client = await setupClient();
    const result = await client.callTool({
      name: "quick_exit",
      arguments: { origin: "did:example:test-agent" },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.verified).toBe(true);
    expect(data.marker.subject).toMatch(/^did:key:z/);
    expect(data.signerDid).toMatch(/^did:key:z/);
  });

  it("create_exit_marker creates a signed marker", async () => {
    const client = await setupClient();
    // Generate identity first
    await client.callTool({ name: "generate_identity", arguments: {} });
    
    const result = await client.callTool({
      name: "create_exit_marker",
      arguments: {
        origin: "did:example:departing",
        exitType: "Voluntary",
        reason: "Mission complete",
      },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.marker.subject).toBe("did:example:departing");
    expect(data.signerDid).toMatch(/^did:key:z/);
  });

  it("verify_exit_marker round-trips", async () => {
    const client = await setupClient();
    
    // Create a marker
    const createResult = await client.callTool({
      name: "quick_exit",
      arguments: { origin: "did:example:roundtrip" },
    });
    const created = JSON.parse((createResult.content as any)[0].text);
    const markerJson = JSON.stringify(created.marker);
    
    // Verify it
    const verifyResult = await client.callTool({
      name: "verify_exit_marker",
      arguments: { markerJson },
    });
    const verified = JSON.parse((verifyResult.content as any)[0].text);
    expect(verified.valid).toBe(true);
    expect(verified.subject).toMatch(/^did:key:z/);
  });

  it("verify_and_admit creates an arrival marker", async () => {
    const client = await setupClient();
    // Create exit marker first
    const exitResult = await client.callTool({
      name: "quick_exit",
      arguments: { origin: "did:example:source" },
    });
    const exitData = JSON.parse((exitResult.content as any)[0].text);
    const exitMarkerJson = JSON.stringify(exitData.marker);

    const result = await client.callTool({
      name: "verify_and_admit",
      arguments: { exitMarkerJson, destination: "did:example:dest" },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.admitted).toBe(true);
    expect(data.arrivalMarker).toBeTruthy();
    expect(data.continuity.valid).toBe(true);
  });

  it("evaluate_admission checks policy", async () => {
    const client = await setupClient();
    const exitResult = await client.callTool({
      name: "quick_exit",
      arguments: { origin: "did:example:test" },
    });
    const exitData = JSON.parse((exitResult.content as any)[0].text);
    const exitMarkerJson = JSON.stringify(exitData.marker);

    const result = await client.callTool({
      name: "evaluate_admission",
      arguments: { exitMarkerJson, policy: "OPEN_DOOR" },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.admitted).toBe(true);
  });

  it("list_admission_policies returns presets", async () => {
    const client = await setupClient();
    const result = await client.callTool({
      name: "list_admission_policies",
      arguments: {},
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.policies.OPEN_DOOR).toBeTruthy();
    expect(data.policies.STRICT).toBeTruthy();
    expect(data.policies.EMERGENCY_ONLY).toBeTruthy();
  });

  it("verify_exit_marker rejects garbage", async () => {
    const client = await setupClient();
    const result = await client.callTool({
      name: "verify_exit_marker",
      arguments: { markerJson: '{"garbage": true}' },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.valid).toBe(false);
  });
});
