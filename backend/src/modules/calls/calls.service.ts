import { Call, CallType } from "../../types/models";
import { notFound } from "../../utils/errors";
import { ordersRepository } from "../orders/orders.repository";
import { callsRepository } from "./calls.repository";
import { dispatchCall } from "./calls.dispatch";

/** Creates a call record, marks the order as calling (delivery), and dials it straight away. */
export async function createCall(callType: CallType, customerId: number, orderId: number | null): Promise<Call> {
  const id = await callsRepository.insert(callType, customerId, orderId);
  const call = await callsRepository.findById(id);
  if (!call) throw new Error("Could not create call record");
  if (orderId !== null) await ordersRepository.markCalling(orderId);
  await dispatchCall(call.id);
  return (await callsRepository.findById(id)) ?? call;
}

export async function getCall(id: number): Promise<Call> {
  const call = await callsRepository.findById(id);
  if (!call) throw notFound("Call");
  if (typeof call.extracted_json === "string") {
    try { call.extracted_json = JSON.parse(call.extracted_json); } catch { /* keep malformed stored data visible */ }
  }
  return call;
}

export const listCalls = (): Promise<Call[]> => callsRepository.findAll();
