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
import { clearToken, currentToken } from './session'

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    const token = currentToken()
    res = await fetch(API_URL + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    })
  } catch {
    throw new Error(`Can't reach the server at ${API_URL}. Is the backend running?`)
  }

  // The session expired or the password changed: go back to the sign-in screen.
  if (res.status === 401 && !path.startsWith('/auth/')) clearToken()

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
  authStatus: () => request<{ passwordSet: boolean }>('/auth/status'),
  login: (password: string) => post<{ token: string; expiresAt: string }>('/auth/login', { password }),

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
