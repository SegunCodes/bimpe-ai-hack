import { Call, CallType } from "../../types/models";
import { badRequest, notFound } from "../../utils/errors";
import { refundCredit, reserveCall } from "../businesses/access";
import { customersRepository } from "../customers/customers.repository";
import { businessesRepository } from "../businesses/businesses.repository";
import { ordersRepository } from "../orders/orders.repository";
import { callsRepository } from "./calls.repository";
import { dispatchCall } from "./calls.dispatch";

/**
 * Creates a call record, marks the order as calling (delivery), and dials it straight away.
 * Refuses before anything is dialled unless the business has a plan and a credit (402) and
 * Tellero AI's shared minute budget has room (503). The call is dialled now if a line is free,
 * otherwise it waits in the queue and the next background tick dials it.
 */
export async function createCall(callType: CallType, customerId: number, orderId: number | null): Promise<Call> {
  const customer = await customersRepository.findById(customerId);
  if (!customer) throw notFound("Customer");
  const charged = await reserveCall(customer.business_id);
  let id: number;
  try {
    id = await callsRepository.insert(customer.business_id, callType, customerId, orderId, charged);
  } catch (error) {
    if (charged) await businessesRepository.addCredits(customer.business_id, 1);
    throw error;
  }
  const call = await callsRepository.findById(id);
  if (!call) throw new Error("Could not create call record");
  if (orderId !== null) await ordersRepository.markCalling(orderId);
  await dispatchCall(call.id);
  return (await callsRepository.findById(id)) ?? call;
}

/**
 * Calls the order's rider with the details the customer confirmed. Charged like any call
 * (credit back if the rider doesn't pick up). The order itself is never touched.
 */
export async function createRiderCall(orderId: number): Promise<Call> {
  const order = await ordersRepository.findById(orderId);
  if (!order) throw notFound("Order");
  if (order.rider_id === null) throw badRequest("Pick a rider for this order first.");
  const charged = await reserveCall(order.business_id);
  let id: number;
  try {
    id = await callsRepository.insert(order.business_id, "rider", order.customer_id, null, charged, { riderId: order.rider_id, orderId: order.id });
  } catch (error) {
    if (charged) await businessesRepository.addCredits(order.business_id, 1);
    throw error;
  }
  await dispatchCall(id);
  const call = await callsRepository.findById(id);
  if (!call) throw new Error("Could not create call record");
  return call;
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
