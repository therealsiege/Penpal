---
tags: [medhook, mllp, hl7v2, healthcare]
created: 2026-03-08
---

# MLLP Server

A standalone TCP server for receiving inbound HL7v2 messages. Runs as a separate Docker container in the [[Engine]] stack, ported from [[Retrohook]]'s MLLPServer.mjs and rewritten in TypeScript for Bun.

**Port:** 2575 (standard MLLP)
**Runtime:** Bun

## How It Works

```
1. Listen for TCP connections on port 2575
2. Buffer incoming data until complete MLLP frame received
3. Extract HL7v2 message from MLLP envelope (VT...FS+CR)
4. Parse MSH segment metadata + all segments
5. POST parsed message to Engine API (http://engine:3000)
6. Build ACK/NAK response based on engine reply
7. Send ACK back to sender wrapped in MLLP framing
```

## MLLP Protocol

MLLP (Minimum Lower Layer Protocol) wraps HL7v2 messages with control characters:

| Character | Hex | Purpose |
|-----------|-----|---------|
| VT (Vertical Tab) | `0x0B` | Start of message block |
| FS (File Separator) | `0x1C` | End of message block |
| CR (Carriage Return) | `0x0D` | Follows FS |

## Engine Payload

The MLLP server sends this to the engine:

```typescript
{
  rawMessage: string           // Original HL7v2 text
  messageType: string          // e.g., "ADT^A01"
  sendingApp: string           // MSH.3
  sendingFacility: string      // MSH.4
  messageControlId: string     // MSH.10
  parsed: Record<string, string[][]>  // All segments parsed
}
```

## ACK Response

The engine responds with `ack: 'AA' | 'AE' | 'AR'`:

- **AA** — Application Accept (message processed)
- **AE** — Application Error (message rejected)
- **AR** — Application Reject (message not processed)

## Complementary Adapter

For outbound MLLP (sending HL7v2 to external systems), use the MLLP adapter. See [[Adapters]].

## Key Files

```
engine/mllp-server/src/mllp-server.ts  — TCP server
engine/mllp-server/src/hl7-parser.ts   — HL7v2 segment parser
engine/mllp-server/Dockerfile          — Bun-based container
```

## Related

- [[Engine]]
- [[Adapters]]
- [[Retrohook]]
