export type Language = 'en' | 'pcm' | 'yo' | 'ha' | 'ig'

export type CustomerStatus = 'new' | 'called' | 'verified' | 'no_answer'

export type OrderStatus =
  | 'pending'
  | 'calling'
  | 'confirmed'
  | 'rescheduled'
  | 'address_updated'
  | 'no_answer'
  | 'failed'

export interface Customer {
  id: number
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
  customer_id: number
  item: string
  seller: string
  address_on_file: string | null
  cleaned_address: string | null
  landmark: string | null
  delivery_window: string | null
  status: OrderStatus | string
  reschedule_time: string | null
  outcome_notes: string | null
  attempts: number
  created_at: string
  updated_at: string
}

export interface Call {
  id: number
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
}
