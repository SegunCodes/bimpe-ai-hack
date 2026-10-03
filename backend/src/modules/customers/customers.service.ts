import { Customer, Call } from "../../types/models";
import { normalizePhone } from "../../utils/phone";
import { notFound } from "../../utils/errors";
import { callsRepository } from "../calls/calls.repository";
import { createCall } from "../calls/calls.service";
import { customersRepository } from "./customers.repository";
import { CreateCustomerInput } from "./customers.schema";

export const customersService = {
  list: () => customersRepository.findAll(),

  async create(input: CreateCustomerInput): Promise<Customer> {
    const id = await customersRepository.insert({ ...input, phone: normalizePhone(input.phone) });
    return (await customersRepository.findById(id)) as Customer;
  },

  async getWithCalls(id: number): Promise<Customer & { calls: Call[] }> {
    const customer = await customersRepository.findById(id);
    if (!customer) throw notFound("Customer");
    const calls = await callsRepository.findByCustomer(customer.id);
    return { ...customer, calls };
  },

  async startOnboardingCall(id: number): Promise<Call> {
    const customer = await customersRepository.findById(id);
    if (!customer) throw notFound("Customer");
    return createCall("onboarding", customer.id, null);
  }
};
