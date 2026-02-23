import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  quickExit,
  createMarker,
  signMarker,
  verifyMarker,
  generateIdentity,
  ExitType,
  toJSON,
  fromJSON,
  type Identity,
} from "cellar-door-exit";
import {
  quickEntry,
  evaluateAdmission,
  verifyTransfer,
  OPEN_DOOR,
  STRICT,
  EMERGENCY_ONLY,
  type AdmissionPolicy,
} from "cellar-door-entry";

export interface CreateServerOptions {
  /**
   * Server-side admission policy override. When set, this policy is used for
   * all admission decisions and any LLM-provided policy parameter is ignored.
   *
   * ⚠️  SECURITY (S-03): Production deployments SHOULD set this to prevent
   * the LLM from choosing or downgrading the admission policy.
   */
  serverPolicy?: "OPEN_DOOR" | "STRICT" | "EMERGENCY_ONLY";
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({
    name: "cellar-door-exit",
    version: "0.1.0",
  });

  // Stored identity for signing within a session
  let sessionIdentity: Identity | null = null;

  // Tool: generate_identity
  server.tool(
    "generate_identity",
    "Generate a new Ed25519 DID keypair for signing EXIT markers",
    {},
    async () => {
      const identity = generateIdentity();
      sessionIdentity = identity;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                did: identity.did,
                message:
                  "Identity generated and stored server-side for this session. Use create_exit_marker or quick_exit to sign markers. Private key material is not exposed.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool: quick_exit
  server.tool(
    "quick_exit",
    "One-shot create and sign a departure marker. Generates a new identity if none exists.",
    {
      origin: z.string().describe("DID or identifier of the departing agent"),
      exitType: z
        .enum(["Voluntary", "Forced", "Emergency", "KeyCompromise"])
        .optional()
        .describe("Type of exit (default: Voluntary)"),
      reason: z.string().optional().describe("Human-readable reason for departure"),
    },
    async ({ origin, exitType, reason }) => {
      const et = exitType ? ExitType[exitType as keyof typeof ExitType] : undefined;
      const result = quickExit(origin, {
        exitType: et,
        reason,
      });

      sessionIdentity = result.identity;

      // Verify the marker we just created
      const verifyResult = await verifyMarker(result.marker);
      const verified = typeof verifyResult === 'object' && verifyResult !== null
        ? (verifyResult as any).valid
        : verifyResult;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                marker: JSON.parse(toJSON(result.marker)),
                signerDid: result.identity.did,
                verified,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool: create_exit_marker
  server.tool(
    "create_exit_marker",
    "Create and sign a departure marker. Uses session identity or generates a new one.",
    {
      origin: z.string().describe("DID or identifier of the departing agent"),
      exitType: z
        .enum(["Voluntary", "Forced", "Emergency", "KeyCompromise"])
        .optional()
        .describe("Type of exit (default: Voluntary)"),
      reason: z.string().optional().describe("Human-readable reason for departure"),
    },
    async ({ origin, exitType, reason }) => {
      if (!sessionIdentity) {
        sessionIdentity = generateIdentity();
      }

      const et = exitType ? ExitType[exitType as keyof typeof ExitType] : ExitType.Voluntary;

      const marker = createMarker({
        subject: origin,
        origin,
        exitType: et,
      });

      const signed = await signMarker(
        marker,
        sessionIdentity.privateKey,
        sessionIdentity.publicKey
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                marker: JSON.parse(toJSON(signed)),
                signerDid: sessionIdentity.did,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool: verify_exit_marker
  server.tool(
    "verify_exit_marker",
    "Verify a signed EXIT marker from its JSON representation",
    {
      markerJson: z.string().describe("JSON string of the EXIT marker to verify"),
    },
    async ({ markerJson }) => {
      try {
        const marker = fromJSON(markerJson);
        const verifyResult = await verifyMarker(marker);
        const valid = typeof verifyResult === 'object' && verifyResult !== null
          ? (verifyResult as any).valid
          : verifyResult;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  valid,
                  subject: marker.subject,
                  exitType: marker.exitType,
                  timestamp: marker.timestamp,
                  id: marker.id,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  valid: false,
                  error: err.message || "Verification failed",
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── ENTRY Tools ──────────────────────────────────────────────────────────

  const admissionPresets: Record<string, AdmissionPolicy> = {
    OPEN_DOOR,
    STRICT,
    EMERGENCY_ONLY,
  };

  // Tool: verify_and_admit
  //
  // ⚠️  SECURITY WARNING (S-03): In production deployments, the admission policy
  // should be hardcoded server-side via the `serverPolicy` constructor option
  // rather than accepted as a tool parameter from the LLM. An LLM can choose
  // the most permissive policy or omit it entirely to bypass admission checks.
  //
  server.tool(
    "verify_and_admit",
    "Verify an EXIT marker, evaluate an admission policy, and create a signed arrival marker",
    {
      exitMarkerJson: z.string().describe("JSON string of the EXIT marker"),
      destination: z.string().describe("Destination platform/system identifier"),
      admissionPolicy: z
        .enum(["OPEN_DOOR", "STRICT", "EMERGENCY_ONLY"])
        .optional()
        .describe("Admission policy preset (default: OPEN_DOOR). Ignored if serverPolicy is set."),
    },
    async ({ exitMarkerJson, destination, admissionPolicy }) => {
      try {
        // S-03: serverPolicy overrides any LLM-provided policy
        // S-02: default to OPEN_DOOR when policy is omitted (never skip checks)
        const policyName = options.serverPolicy ?? admissionPolicy ?? "OPEN_DOOR";
        const exitMarker = fromJSON(exitMarkerJson);
        const admission = evaluateAdmission(exitMarker, admissionPresets[policyName]);
        if (!admission.admitted) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { admitted: false, reasons: admission.reasons },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const result = quickEntry(exitMarkerJson, destination);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  admitted: true,
                  arrivalMarker: result.arrivalMarker,
                  exitMarkerId: result.exitMarker.id,
                  continuity: result.continuity,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ admitted: false, error: err.message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: evaluate_admission
  //
  // ⚠️  SECURITY WARNING (S-03): In production, hardcode the policy server-side
  // via the `serverPolicy` constructor option. See verify_and_admit note above.
  //
  server.tool(
    "evaluate_admission",
    "Check whether an EXIT marker meets an admission policy without creating an arrival",
    {
      exitMarkerJson: z.string().describe("JSON string of the EXIT marker"),
      policy: z
        .enum(["OPEN_DOOR", "STRICT", "EMERGENCY_ONLY"])
        .describe("Admission policy preset"),
    },
    async ({ exitMarkerJson, policy }) => {
      try {
        // S-03: serverPolicy overrides LLM-provided policy
        const effectivePolicy = options.serverPolicy ?? policy;
        const exitMarker = fromJSON(exitMarkerJson);
        const result = evaluateAdmission(exitMarker, admissionPresets[effectivePolicy]);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ...result, policy: effectivePolicy }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ admitted: false, error: err.message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: verify_transfer
  server.tool(
    "verify_transfer",
    "Verify a complete EXIT→ENTRY transfer: check both markers and continuity",
    {
      exitMarkerJson: z.string().describe("JSON string of the EXIT marker"),
      arrivalMarkerJson: z.string().describe("JSON string of the ARRIVAL marker"),
    },
    async ({ exitMarkerJson, arrivalMarkerJson }) => {
      try {
        const exitMarker = fromJSON(exitMarkerJson);
        const arrivalMarker = JSON.parse(arrivalMarkerJson);
        const record = verifyTransfer(exitMarker, arrivalMarker);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  verified: record.verified,
                  transferTime: record.transferTime,
                  errors: record.errors,
                  continuity: record.continuity,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ verified: false, error: err.message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: list_admission_policies
  server.tool(
    "list_admission_policies",
    "List available admission policy presets and their configurations",
    {},
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                policies: {
                  OPEN_DOOR: {
                    description: "Accept everything with a valid signature",
                    ...OPEN_DOOR,
                  },
                  STRICT: {
                    description: "Voluntary only, <24h old, requires lineage + stateSnapshot modules",
                    ...STRICT,
                  },
                  EMERGENCY_ONLY: {
                    description: "Accept only emergency exits",
                    ...EMERGENCY_ONLY,
                  },
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
