export type CallType = "delivery" | "onboarding";

export interface Customer {
  id: number;
  name: string;
  phone: string;
  language: string;
  best_time_to_call: string | null;
  address: string | null;
  landmark: string | null;
  consent_to_calls: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: number;
  customer_id: number;
  item: string;
  seller: string;
  address_on_file: string;
  cleaned_address: string | null;
  landmark: string | null;
  delivery_window: string;
  /** Start of the delivery slot, ISO 8601 UTC */
  delivery_at: string | null;
  /** When the next automatic call is due, ISO 8601 UTC; null when none is planned */
  call_at: string | null;
  /** The timing rule the owner picked, e.g. "2h_before" (display only) */
  call_plan: string | null;
  status: string;
  reschedule_time: string | null;
  outcome_notes: string | null;
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

export type OrderWithCustomer = Order & { customer_name: string; customer_phone: string };

export interface Call {
  id: number;
  call_type: CallType;
  customer_id: number;
  order_id: number | null;
  provider_call_id: string | null;
  status: string;
  outcome: string | null;
  extracted_json: unknown;
  transcript: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  created_at: Date;
  updated_at: Date;
}

/** What the webhook / mock / poller hands to the call-result service. */
export interface CallResult {
  providerCallId: string;
  status: string;
  transcript?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  extracted?: Record<string, unknown>;
}
