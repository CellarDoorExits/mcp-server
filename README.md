# @cellar-door/mcp-server

[![npm version](https://img.shields.io/npm/v/@cellar-door/mcp-server)](https://www.npmjs.com/package/@cellar-door/mcp-server)
[![tests](https://img.shields.io/badge/tests-19_passing-brightgreen)]()
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![NIST](https://img.shields.io/badge/NIST-submitted-orange)](https://cellar-door.dev/nist/)

> **⚠️ Pre-release software — no formal security audit has been conducted.** This project is published for transparency, review, and community feedback. It should not be used in production systems where security guarantees are required. If you find a vulnerability, please report it to hawthornhollows@gmail.com.

Give any MCP-compatible AI (Claude, Cursor, Windsurf) the ability to create and verify agent departure records.

## 🗺️ Ecosystem

| Package | Description | npm |
|---------|-------------|-----|
| [cellar-door-exit](https://github.com/CellarDoorExits/exit-door) | Core protocol — departure markers | [![npm](https://img.shields.io/npm/v/cellar-door-exit)](https://www.npmjs.com/package/cellar-door-exit) |
| [cellar-door-entry](https://github.com/CellarDoorExits/entry-door) | Arrival markers + admission | [![npm](https://img.shields.io/npm/v/cellar-door-entry)](https://www.npmjs.com/package/cellar-door-entry) |
| **[@cellar-door/mcp-server](https://github.com/CellarDoorExits/mcp-server)** | **MCP integration** ← you are here | [![npm](https://img.shields.io/npm/v/@cellar-door/mcp-server)](https://www.npmjs.com/package/@cellar-door/mcp-server) |
| [@cellar-door/langchain](https://github.com/CellarDoorExits/langchain) | LangChain integration | [![npm](https://img.shields.io/npm/v/@cellar-door/langchain)](https://www.npmjs.com/package/@cellar-door/langchain) |
| [@cellar-door/vercel-ai-sdk](https://github.com/CellarDoorExits/vercel-ai-sdk) | Vercel AI SDK integration | [![npm](https://img.shields.io/npm/v/@cellar-door/vercel-ai-sdk)](https://www.npmjs.com/package/@cellar-door/vercel-ai-sdk) |
| [@cellar-door/openclaw-skill](https://github.com/CellarDoorExits/openclaw-skill) | OpenClaw agent skill | [![npm](https://img.shields.io/npm/v/@cellar-door/openclaw-skill)](https://www.npmjs.com/package/@cellar-door/openclaw-skill) |

**[Paper](https://cellar-door.dev/paper/) · [Website](https://cellar-door.dev) · [NIST Submission](https://cellar-door.dev/nist/) · [Policy Briefs](https://cellar-door.dev/briefs/)**

## Quick Start

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "cellar-door": {
      "command": "npx",
      "args": ["@cellar-door/mcp-server"],
      "env": {
        "CELLAR_DOOR_SERVER_POLICY": "STRICT"
      }
    }
  }
}
```

Restart Claude Desktop. You can now say:

> "Create a departure record for my agent leaving platform-x.example.com"

Claude will call the `quick_exit` tool and return a signed, verifiable EXIT marker.

### Cursor / Windsurf

```bash
npm install @cellar-door/mcp-server
```

Point your MCP client at the server. It exposes 7 tools automatically.

## Tools

### EXIT Tools

| Tool | Description |
|------|-------------|
| `generate_identity` | Generate an Ed25519 DID keypair for signing |
| `quick_exit` | One-shot: create + sign a departure marker |
| `create_exit_marker` | Create and sign a marker with full options |
| `verify_exit_marker` | Verify a marker from JSON |

### ENTRY Tools

| Tool | Description |
|------|-------------|
| `verify_and_admit` | Verify EXIT marker, evaluate admission policy, create arrival |
| `evaluate_admission` | Check if EXIT marker meets an admission policy |
| `verify_transfer` | Verify a complete EXIT→ENTRY transfer chain |
| `list_admission_policies` | List available admission policy presets |

## ⚠️ Security: Admission Policy

> **IMPORTANT:** By default, the server uses `STRICT` admission policy when no policy is specified by the LLM. This is intentional; an LLM can freely choose the most permissive policy (`OPEN_DOOR`) or omit the parameter entirely to bypass admission checks.
>
> **For production deployments**, always set a server-side policy override using one of:
>
> - **Environment variable:** `CELLAR_DOOR_SERVER_POLICY=STRICT` (or `EMERGENCY_ONLY`)
> - **Constructor option:** `createServer({ serverPolicy: "STRICT" })`
>
> When `serverPolicy` is set, any LLM-provided `admissionPolicy` parameter is **ignored**.

| Policy | Behavior |
|--------|----------|
| `OPEN_DOOR` | Accept any departure with a valid signature |
| `STRICT` | Voluntary only, <24h old, requires lineage + stateSnapshot modules |
| `EMERGENCY_ONLY` | Accept only emergency exits |

## Sample Conversation (Claude Desktop)

```
User: I need to leave Platform X. Can you create a departure record?

Claude: I'll create a signed EXIT marker for your departure from Platform X.

→ Calls: quick_exit({ origin: "did:web:platform-x.example.com", reason: "Migrating to new platform" })

Claude: Here's your signed departure marker:
- ID: exit:abc123...
- Subject: did:key:z6Mk...
- Origin: did:web:platform-x.example.com
- Exit Type: Voluntary
- Signature: ✅ Verified

User: Now verify this on Platform Y and create my arrival.

→ Calls: verify_and_admit({
    exitMarkerJson: "{...}",
    destination: "did:web:platform-y.example.com",
    admissionPolicy: "STRICT"
  })

Claude: ✅ Admitted. Arrival marker created with continuity verified.
```

## Programmatic Usage

```typescript
import { createServer } from "@cellar-door/mcp-server";

const server = createServer({
  serverPolicy: "STRICT",  // Lock admission policy server-side
});
```

## Example Tool Calls

### Quick Exit

```json
{
  "name": "quick_exit",
  "arguments": { "origin": "did:example:my-agent", "reason": "Task complete" }
}
```

### Verify and Admit

```json
{
  "name": "verify_and_admit",
  "arguments": {
    "exitMarkerJson": "{...exit marker JSON...}",
    "destination": "did:example:new-platform",
    "admissionPolicy": "OPEN_DOOR"
  }
}
```

### Verify Transfer

```json
{
  "name": "verify_transfer",
  "arguments": {
    "exitMarkerJson": "{...exit marker...}",
    "arrivalMarkerJson": "{...arrival marker...}"
  }
}
```

## ⚠️ Disclaimer

> **WARNING:** Automated admission decisions should be reviewed by platform operators. This integration does not constitute legal advice. Platforms are responsible for their own admission policies and the consequences of admitting agents.

## License

Apache-2.0
