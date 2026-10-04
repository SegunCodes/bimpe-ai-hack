import type {
  AdminOverview,
  Billing,
  Business,
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
import { clearToken, getToken, type SessionKind } from './session'

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '')

/** Admin routes use the owner's session; everything else uses the business's. */
const sessionFor = (path: string): SessionKind => (path.startsWith('/admin') ? 'admin' : 'business')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    const token = getToken(sessionFor(path))
    res = await fetch(API_URL + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    })
  } catch {
    throw new Error(`Can't reach the server at ${API_URL}. Is the backend running?`)
  }

  // The session expired or the password changed: go back to the sign-in screen.
  if (res.status === 401 && !path.startsWith('/auth/') && !path.startsWith('/admin-auth/')) clearToken(sessionFor(path))

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
  signup: (data: { business_name: string; email: string; password: string }) => post<{ token: string; business: Business }>('/auth/signup', data),
  login: (data: { email: string; password: string }) => post<{ token: string; business: Business }>('/auth/login', data),
  me: () => request<Business>('/auth/me'),

  billing: () => request<Billing>('/billing'),
  checkout: (plan: string) => post<{ url: string; reference: string }>('/billing/checkout', { plan }),
  verifyPayment: (reference: string) =>
    request<{ status: 'paid' | 'pending' | 'failed'; business: Business | null }>(`/billing/verify?reference=${encodeURIComponent(reference)}`),

  adminStatus: () => request<{ passwordSet: boolean }>('/admin-auth/status'),
  adminLogin: (password: string) => post<{ token: string }>('/admin-auth/login', { password }),
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  adminSetPlan: (businessId: number, plan: string | null) => post<{ id: number }>(`/admin/businesses/${businessId}/plan`, { plan }),
  adminSetCapacity: (minutes: number) => post<{ ok: true }>('/admin/capacity', { minutes }),

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
