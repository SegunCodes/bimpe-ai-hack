export type Language = 'en' | 'pcm' | 'yo' | 'ha' | 'ig'

export type CustomerStatus = 'new' | 'called' | 'verified' | 'no_answer'

export type OrderStatus =
  | 'pending'
  | 'scheduled'
  | 'calling'
  | 'confirmed'
  | 'rescheduled'
  | 'address_updated'
  | 'no_answer'
  | 'failed'

export interface Customer {
  id: number
  business_id: number
  name: string
  phone: string
  language: Language | null
  best_time_to_call: string | null
  address: string | null
  landmark: string | null
  consent_to_calls: 0 | 1 | null
  status: CustomerStatus | string
  created_at: string
  updated_at: string
}

export interface Order {
  id: number
  business_id: number
  customer_id: number
  item: string
  seller: string
  address_on_file: string | null
  cleaned_address: string | null
  landmark: string | null
  delivery_window: string | null
  /** Start of the delivery slot, ISO 8601 UTC */
  delivery_at: string | null
  /** When the AI will (next) call, ISO 8601 UTC. null once no call is planned */
  call_at: string | null
  /** Which timing rule the owner picked, e.g. "2h_before" */
  call_plan: string | null
  status: OrderStatus | string
  reschedule_time: string | null
  outcome_notes: string | null
  attempts: number
  rider_id: number | null
  created_at: string
  updated_at: string
}

export interface Call {
  id: number
  business_id: number
  call_type: 'delivery' | 'onboarding' | 'rider'
  customer_id: number | null
  order_id: number | null
  /** Rider calls: who was called and about which order (order_id stays null). */
  rider_id?: number | null
  rider_order_id?: number | null
  rider_name?: string | null
  rider_phone?: string | null
  provider_call_id: string | null
  status: string
  outcome: string | null
  extracted_json: string | null
  transcript: string | null
  recording_url: string | null
  duration_seconds: number | null
  created_at: string
  updated_at: string
}

export type OrderRow = Order & { customer_name: string; customer_phone: string; rider_name: string | null; rider_phone: string | null }
/** rider_link is relative (/r/…); the page lives on this site. */
export type OrderDetail = OrderRow & { calls: Call[]; rider_calls: Call[]; rider_link: string | null }

export interface Rider {
  id: number
  name: string
  phone: string
  /** Orders still in play that name this rider */
  open_orders?: number
  created_at: string
}

export interface CallSettings {
  callNotes: string
  riderCalls: boolean
}

/** What /r/[order]/[signature] shows a rider. */
export interface RiderDelivery {
  business: { name: string; logoUrl: string | null }
  order: {
    id: number
    item: string
    status: string
    customerName: string
    customerPhone: string
    address: string
    landmark: string | null
    deliveryWindow: string
    deliveryAt: string | null
    rescheduleTime: string | null
  }
  riderName: string | null
}
export type CustomerDetail = Customer & { calls: Call[] }

export interface Health {
  ok: boolean
  mockMode: boolean
}

export interface NewCustomer {
  name: string
  phone: string
  language?: Language
  address?: string
  landmark?: string
}

export interface NewOrder {
  customer_id: number
  item: string
  /** Optional: the business's own name is used when empty */
  seller?: string
  address_on_file: string
  delivery_window: string
  delivery_at: string
  call_at: string
  call_plan: string
  rider_id?: number | null
}

export interface PlanStatus {
  plan: string | null
  planName: string | null
  active: boolean
  expiresAt: string | null
  callsUsed: number
  callsIncluded: number
  /** Call credits left. A credit is used only when a call is answered. */
  callsLeft: number
  /** Has a plan but no credits: scheduled calls wait until a top-up. */
  outOfCredits: boolean
}

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface Verification {
  status: VerificationStatus
  /** Why it was rejected, when it was */
  note: string | null
  updatedAt: string | null
  document: { filename: string; contentType: string; sizeBytes: number; uploadedAt: string } | null
}

export interface Business {
  id: number
  name: string
  email: string
  ownerName: string | null
  /** Address of the business's logo, or null if none uploaded */
  logoUrl: string | null
  created_at: string
  emailVerified: boolean
  verification: Verification
  plan: PlanStatus
}

export interface Plan {
  id: string
  name: string
  priceNaira: number
  calls: number
  days: number
}

export interface TopUp {
  id: string
  name: string
  priceNaira: number
  calls: number
}

export interface Billing {
  business: Business
  plans: Plan[]
  topUps: TopUp[]
  paymentsEnabled: boolean
}

export interface AdminBusiness {
  id: number
  name: string
  email: string | null
  is_house: boolean
  created_at: string
  customers: number
  orders: number
  calls: number
  plan: PlanStatus
  ownerName: string | null
  logoUrl: string | null
  emailVerified: boolean
  verification: Verification
  /** Set while the account is suspended (log-in and calls blocked) */
  suspended: { at: string; reason: string | null } | null
  usage: { minutesThisMonth: number; answeredThisMonth: number; costThisMonthNaira: number; revenueNaira: number }
}

export interface Capacity {
  month: string
  minutesUsed: number
  minutesOnLiveCalls: number
  minuteBudget: number
  budgetSetByAdmin: boolean
  minutesLeft: number
  paused: boolean
  onThePhone: number
  maxConcurrentCalls: number
  costPerMinuteNaira: number
  creditsOutstanding: number
  minutesNeededForCredits: number
}

export interface SystemStatus {
  ok: boolean
  database: string
  databaseSettingsFound: string[]
  mockMode: boolean
  settings: { cronSecret: boolean; callProviderKey: boolean; adminPassword: boolean; payments: boolean; email: boolean }
  agentScript: { status: string; lastSentAt?: string | null; problem?: string }
  lastBackgroundRun: { at: string; ok: boolean; errors?: string[]; scheduled?: number; dialled?: number; liveFinished?: number } | null
}

export interface AdminOverview {
  businesses: AdminBusiness[]
  calls: Call[]
  orders: OrderRow[]
  customers: Customer[]
  plans: { id: string; name: string; priceNaira: number; calls: number }[]
  revenue: { payments: number; totalNaira: number }
  capacity: Capacity
}
