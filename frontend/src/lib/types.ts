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
  created_at: string
  updated_at: string
}

export interface Call {
  id: number
  business_id: number
  call_type: 'delivery' | 'onboarding'
  customer_id: number | null
  order_id: number | null
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

export type OrderRow = Order & { customer_name: string; customer_phone: string }
export type OrderDetail = OrderRow & { calls: Call[] }
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
  seller: string
  address_on_file: string
  delivery_window: string
  delivery_at: string
  call_at: string
  call_plan: string
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

export interface Business {
  id: number
  name: string
  email: string
  created_at: string
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

export interface AdminOverview {
  businesses: AdminBusiness[]
  calls: Call[]
  orders: OrderRow[]
  customers: Customer[]
  plans: { id: string; name: string; priceNaira: number; calls: number }[]
  revenue: { payments: number; totalNaira: number }
  capacity: Capacity
}
