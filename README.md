# @cellar-door/mcp-server

> **⚠️ Pre-release software — no formal security audit has been conducted.** This project is published for transparency, review, and community feedback. It should not be used in production systems where security guarantees are required. If you find a vulnerability, please report it to hawthornhollows@gmail.com.


MCP (Model Context Protocol) server that exposes [cellar-door-exit](https://www.npmjs.com/package/cellar-door-exit) and [cellar-door-entry](https://www.npmjs.com/package/cellar-door-entry) verifiable markers as AI-native tools. Any MCP-compatible client — Claude Desktop, Cursor, Windsurf, or custom agents — can create, sign, and verify EXIT and ENTRY markers.

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

## Quick Start

```bash
npm install @cellar-door/mcp-server
```

### Claude Desktop

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

## ⚠️ Security: Admission Policy

> **IMPORTANT:** By default, the server uses `STRICT` admission policy when no policy is specified by the LLM. This is intentional — an LLM can freely choose the most permissive policy (`OPEN_DOOR`) or omit the parameter entirely to bypass admission checks.
>
> **For production deployments**, always set a server-side policy override using one of:
>
> - **Environment variable:** `CELLAR_DOOR_SERVER_POLICY=STRICT` (or `EMERGENCY_ONLY`)
> - **Constructor option:** `createServer({ serverPolicy: "STRICT" })`
>
> When `serverPolicy` is set, any LLM-provided `admissionPolicy` parameter is **ignored**.
>
> Available policies: `OPEN_DOOR`, `STRICT`, `EMERGENCY_ONLY`.

### `CELLAR_DOOR_SERVER_POLICY`

| Value | Behavior |
|-------|----------|
| `OPEN_DOOR` | Accept any departure with a valid signature |
| `STRICT` | Voluntary only, <24h old, requires lineage + stateSnapshot modules |
| `EMERGENCY_ONLY` | Accept only emergency exits |

## Sample Conversation (Claude Desktop)

Below is an example of how the tools work in a conversation with Claude Desktop:

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

The marker has been cryptographically signed. You can share this JSON with
your destination platform to prove your voluntary departure.

User: Now verify this on Platform Y and create my arrival.

→ Calls: verify_and_admit({
    exitMarkerJson: "{...the exit marker JSON...}",
    destination: "did:web:platform-y.example.com",
    admissionPolicy: "STRICT"
  })

Claude: Admission result:
- ✅ Admitted
- Arrival marker created with ID: urn:entry:def456...
- Continuity verified between EXIT and ENTRY markers

User: Can you verify the complete transfer?

→ Calls: verify_transfer({
    exitMarkerJson: "{...exit marker...}",
    arrivalMarkerJson: "{...arrival marker...}"
  })

Claude: Transfer verification:
- ✅ Both signatures valid
- ✅ Subject continuity maintained
- ✅ Temporal ordering correct
- Transfer time: 2.3 seconds
```

## Programmatic Usage

```typescript
import { createServer } from "@cellar-door/mcp-server";

const server = createServer({
  // Lock admission policy server-side (recommended for production)
  serverPolicy: "STRICT",
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

Response:
```json
{
  "admitted": true,
  "arrivalMarker": { "..." },
  "exitMarkerId": "exit:...",
  "continuity": { "valid": true, "errors": [] }
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

Response:
```json
{
  "verified": true,
  "transferTime": 1234,
  "errors": [],
  "continuity": { "valid": true, "errors": [] }
}
```

### Evaluate Admission

```json
{
  "name": "evaluate_admission",
  "arguments": {
    "exitMarkerJson": "{...}",
    "policy": "STRICT"
  }
}
```

### List Admission Policies

```json
{ "name": "list_admission_policies", "arguments": {} }
```

Response:
```json
{
  "policies": {
    "OPEN_DOOR": { "description": "Accept everything with a valid signature", "requireVerifiedDeparture": true },
    "STRICT": { "description": "Voluntary only, <24h old, requires lineage + stateSnapshot", "..." },
    "EMERGENCY_ONLY": { "description": "Accept only emergency exits", "..." }
  }
}
```

## ⚠️ Disclaimer

> **WARNING:** Automated admission decisions should be reviewed by platform operators. This integration does not constitute legal advice. Platforms are responsible for their own admission policies and the consequences of admitting agents.

## License

Apache-2.0
