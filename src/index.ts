#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, type CreateServerOptions } from "./server.js";

async function main() {
  const opts: CreateServerOptions = {};
  // Set serverPolicy from environment variable if provided
  const envPolicy = process.env.CELLAR_DOOR_SERVER_POLICY;
  if (envPolicy && ["OPEN_DOOR", "STRICT", "EMERGENCY_ONLY"].includes(envPolicy)) {
    opts.serverPolicy = envPolicy as CreateServerOptions["serverPolicy"];
  }
  const server = createServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
