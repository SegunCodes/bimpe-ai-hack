import type {
  Call,
  Customer,
  CustomerDetail,
  Health,
  NewCustomer,
  NewOrder,
  Order,
  OrderDetail,
  OrderRow,
} from './types'

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new Error(`Can't reach the server at ${API_URL}. Is the backend running?`)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {
      // response had no JSON body, keep the default message
    }
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/health'),

  listCustomers: () => request<Customer[]>('/customers'),
  createCustomer: (data: NewCustomer) => post<Customer>('/customers', data),
  getCustomer: (id: number) => request<CustomerDetail>(`/customers/${id}`),
  callCustomer: (id: number) => post<Call>(`/customers/${id}/call`),

  listOrders: () => request<OrderRow[]>('/orders'),
  createOrder: (data: NewOrder) => post<Order>('/orders', data),
  bulkCreateOrders: (orders: NewOrder[]) => post<Order[]>('/orders/bulk', { orders }),
  getOrder: (id: number) => request<OrderDetail>(`/orders/${id}`),
  callOrder: (id: number) => post<Call>(`/orders/${id}/call`),
  callAllPending: () => post<{ started: number }>('/orders/call-all-pending'),

  listCalls: () => request<Call[]>('/calls'),
  getCall: (id: number) => request<Call>(`/calls/${id}`),

  publicSignup: (data: { name?: string; phone: string }) => post<{ ok: true }>('/public/signup', data),
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}
