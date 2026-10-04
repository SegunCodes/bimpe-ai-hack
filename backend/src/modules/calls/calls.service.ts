import { Call, CallType } from "../../types/models";
import { notFound } from "../../utils/errors";
import { assertCanCall } from "../businesses/access";
import { customersRepository } from "../customers/customers.repository";
import { ordersRepository } from "../orders/orders.repository";
import { callsRepository } from "./calls.repository";
import { dispatchCall } from "./calls.dispatch";

/**
 * Creates a call record, marks the order as calling (delivery), and dials it straight away.
 * Refuses (HTTP 402) before anything is dialled unless the customer's business has an
 * active plan with calls left.
 */
export async function createCall(callType: CallType, customerId: number, orderId: number | null): Promise<Call> {
  const customer = await customersRepository.findById(customerId);
  if (!customer) throw notFound("Customer");
  await assertCanCall(customer.business_id);
  const id = await callsRepository.insert(customer.business_id, callType, customerId, orderId);
  const call = await callsRepository.findById(id);
  if (!call) throw new Error("Could not create call record");
  if (orderId !== null) await ordersRepository.markCalling(orderId);
  await dispatchCall(call.id);
  return (await callsRepository.findById(id)) ?? call;
}

export async function getCall(id: number, businessId?: number): Promise<Call> {
  const call = businessId === undefined ? await callsRepository.findById(id) : await callsRepository.findOwned(id, businessId);
  if (!call) throw notFound("Call");
  if (typeof call.extracted_json === "string") {
    try { call.extracted_json = JSON.parse(call.extracted_json); } catch { /* keep malformed stored data visible */ }
  }
  return call;
}

export const listCalls = (businessId: number): Promise<Call[]> => callsRepository.findAll(businessId);
