import { EventEmitter } from "node:events";

/**
 * Tiny event bus so modules do not import each other in circles.
 * "call.started" (callId: number) is emitted by the queue after BimpeAI accepts a call.
 */
export const appEvents = new EventEmitter();
