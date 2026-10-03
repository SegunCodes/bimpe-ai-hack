import { Call, Order, OrderWithCustomer } from "../../types/models";
import { notFound } from "../../utils/errors";
import { callsRepository } from "../calls/calls.repository";
import { createCall } from "../calls/calls.service";
import { ordersRepository } from "./orders.repository";
import { CreateOrderInput } from "./orders.schema";

export const ordersService = {
  list: () => ordersRepository.findAll(),

  async create(input: CreateOrderInput): Promise<Order> {
    const id = await ordersRepository.insert(input);
    return (await ordersRepository.findById(id)) as Order;
  },

  async createBulk(inputs: CreateOrderInput[]): Promise<Order[]> {
    const created: Order[] = [];
    for (const input of inputs) created.push(await ordersService.create(input));
    return created;
  },

  async getWithCalls(id: number): Promise<OrderWithCustomer & { calls: Call[] }> {
    const order = await ordersRepository.findByIdWithCustomer(id);
    if (!order) throw notFound("Order");
    const calls = await callsRepository.findByOrder(order.id);
    return { ...order, calls };
  },

  async startDeliveryCall(id: number): Promise<Call> {
    const order = await ordersRepository.findById(id);
    if (!order) throw notFound("Order");
    return createCall("delivery", order.customer_id, order.id);
  },

  /** Creates a call for every pending order. The queue dials them one at a time. */
  async callAllPending(): Promise<{ started: number }> {
    const pending = await ordersRepository.findPending();
    for (const order of pending) await createCall("delivery", order.customer_id, order.id);
    return { started: pending.length };
  }
};
