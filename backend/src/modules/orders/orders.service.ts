import { Call, Order, OrderWithCustomer } from "../../types/models";
import { badRequest, notFound } from "../../utils/errors";
import { customersRepository } from "../customers/customers.repository";
import { callsRepository } from "../calls/calls.repository";
import { createCall } from "../calls/calls.service";
import { ordersRepository } from "./orders.repository";
import { CreateOrderInput } from "./orders.schema";

export const ordersService = {
  list: (businessId: number) => ordersRepository.findAll(businessId),

  async create(businessId: number, input: CreateOrderInput): Promise<Order> {
    // A business can only add orders for its own customers.
    if (!(await customersRepository.findOwned(input.customer_id, businessId))) throw badRequest("That customer isn't in your list");
    const id = await ordersRepository.insert(businessId, input);
    return (await ordersRepository.findById(id)) as Order;
  },

  async createBulk(businessId: number, inputs: CreateOrderInput[]): Promise<Order[]> {
    const created: Order[] = [];
    for (const input of inputs) created.push(await ordersService.create(businessId, input));
    return created;
  },

  async getWithCalls(businessId: number, id: number): Promise<OrderWithCustomer & { calls: Call[] }> {
    const order = await ordersRepository.findByIdWithCustomer(id, businessId);
    if (!order) throw notFound("Order");
    const calls = await callsRepository.findByOrder(order.id);
    return { ...order, calls };
  },

  async startDeliveryCall(businessId: number, id: number): Promise<Call> {
    const order = await ordersRepository.findOwned(id, businessId);
    if (!order) throw notFound("Order");
    return createCall("delivery", order.customer_id, order.id);
  },

  /** Creates a call for every pending order. The queue dials them one at a time. */
  async callAllPending(businessId: number): Promise<{ started: number }> {
    const pending = await ordersRepository.findPending(businessId);
    for (const order of pending) await createCall("delivery", order.customer_id, order.id);
    return { started: pending.length };
  }
};
