# @cellar-door/mcp-server

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
      "args": ["@cellar-door/mcp-server"]
    }
  }
}
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
