import { z } from 'zod';

/** Bump whenever inbound DTOs change incompatibly — clients include optional hello payloads. */

export const PROTOCOL_VERSION = 1 as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type ClientHello = {
  readonly protocolVersion: ProtocolVersion;
};

export const ClientHelloSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
});
