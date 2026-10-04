import { Customer, Call } from "../../types/models";
import { normalizePhone } from "../../utils/phone";
import { notFound } from "../../utils/errors";
import { callsRepository } from "../calls/calls.repository";
import { createCall } from "../calls/calls.service";
import { customersRepository } from "./customers.repository";
import { CreateCustomerInput } from "./customers.schema";

export const customersService = {
  list: (businessId: number) => customersRepository.findAll(businessId),

  async create(businessId: number, input: CreateCustomerInput): Promise<Customer> {
    const id = await customersRepository.insert(businessId, { ...input, phone: normalizePhone(input.phone) });
    return (await customersRepository.findById(id)) as Customer;
  },

  async getWithCalls(businessId: number, id: number): Promise<Customer & { calls: Call[] }> {
    const customer = await customersRepository.findOwned(id, businessId);
    if (!customer) throw notFound("Customer");
    const calls = await callsRepository.findByCustomer(customer.id);
    return { ...customer, calls };
  },

  async startOnboardingCall(businessId: number, id: number): Promise<Call> {
    const customer = await customersRepository.findOwned(id, businessId);
    if (!customer) throw notFound("Customer");
    return createCall("onboarding", customer.id, null);
  }
};
