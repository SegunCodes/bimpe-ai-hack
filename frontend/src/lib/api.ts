import type {
  AdminOverview,
  SystemStatus,
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

/**
 * Live site: always this site's own /api, which next.config.ts forwards to the backend, so the
 * backend's address never appears in the browser. Local development can point straight at a
 * backend with NEXT_PUBLIC_API_URL.
 */
export const API_URL =
  process.env.NODE_ENV === 'production' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '')

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
    throw new Error("Can't reach Tellero AI right now. Check your connection and try again.")
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
  signup: (data: { business_name: string; owner_name: string; email: string; password: string }) => post<{ token: string; business: Business }>('/auth/signup', data),
  login: (data: { email: string; password: string }) => post<{ token: string; business: Business }>('/auth/login', data),
  me: () => request<Business>('/auth/me'),
  forgotPassword: (email: string) => post<{ ok: true }>('/auth/forgot-password', { email }),
  resetPassword: (data: { email: string; code: string; password: string }) => post<{ token: string; business: Business }>('/auth/reset-password', data),

  verifyEmail: (code: string) => post<{ ok: true }>('/onboarding/verify-email', { code }),
  resendCode: () => post<{ ok: true }>('/onboarding/resend-code'),
  uploadDocument: (file: File) => upload('/onboarding/document', file),
  uploadLogo: (file: File) => upload('/onboarding/logo', file) as Promise<{ logoUrl: string }>,
  removeLogo: () => request<{ ok: true }>('/onboarding/logo', { method: 'DELETE' }),
  myDocument: () => download('/onboarding/document'),

  billing: () => request<Billing>('/billing'),
  checkout: (plan: string) => post<{ url: string; reference: string }>('/billing/checkout', { plan }),
  verifyPayment: (reference: string) =>
    request<{ status: 'paid' | 'pending' | 'failed'; business: Business | null }>(`/billing/verify?reference=${encodeURIComponent(reference)}`),

  adminStatus: () => request<{ passwordSet: boolean }>('/admin-auth/status'),
  adminLogin: (password: string) => post<{ token: string }>('/admin-auth/login', { password }),
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  adminSystemStatus: () => request<SystemStatus>('/admin/status'),
  adminSetPlan: (businessId: number, plan: string | null) => post<{ id: number }>(`/admin/businesses/${businessId}/plan`, { plan }),
  adminDocument: (businessId: number) => download(`/admin/businesses/${businessId}/document`),
  adminSetVerification: (businessId: number, status: 'approved' | 'rejected', note?: string) =>
    post<{ ok: true }>(`/admin/businesses/${businessId}/verification`, { status, note }),
  adminSuspend: (businessId: number, reason?: string) => post<{ ok: true }>(`/admin/businesses/${businessId}/suspend`, { reason }),
  adminUnsuspend: (businessId: number) => post<{ ok: true }>(`/admin/businesses/${businessId}/unsuspend`),
  adminDeleteBusiness: (businessId: number, confirmName: string) =>
    request<{ ok: true }>(`/admin/businesses/${businessId}`, { method: 'DELETE', body: JSON.stringify({ confirmName }) }),
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

/** Sends a file as the raw request body (the CAC certificate). */
async function upload(path: string, file: File): Promise<unknown> {
  const token = getToken(sessionFor(path))
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    })
  } catch {
    throw new Error('Upload failed. Check your connection and try again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`)
  return body
}

/** Fetches a private file (needs the session header) and returns a link the browser can open. */
async function download(path: string): Promise<string> {
  const token = getToken(sessionFor(path))
  const res = await fetch(API_URL + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error(res.status === 404 ? 'No document uploaded yet.' : `Couldn't open the document (${res.status})`)
  return URL.createObjectURL(await res.blob())
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}
