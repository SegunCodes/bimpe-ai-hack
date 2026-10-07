import { one } from "../../db/pool";

export interface AgentContextRow {
  call_type: "delivery" | "onboarding" | "rider";
  customer_name: string;
  phone: string;
  customer_phone: string;
  item: string | null;
  seller: string | null;
  address_on_file: string | null;
  landmark: string | null;
  delivery_window: string | null;
  reschedule_time: string | null;
  order_status: string | null;
  language: string;
  business_name: string;
  is_house: boolean;
  call_notes: string | null;
  rider_name: string | null;
}

// For a rider call, `phone` is the rider's (the number dialled) and the order comes from rider_order_id.
const SELECT_CONTEXT = `SELECT c.call_type, cu.name AS customer_name,
    CASE WHEN c.call_type = 'rider' THEN r.phone ELSE cu.phone END AS phone, cu.phone AS customer_phone,
    o.item, o.seller, COALESCE(o.cleaned_address, o.address_on_file, cu.address) AS address_on_file,
    COALESCE(o.landmark, cu.landmark) AS landmark, o.delivery_window, o.reschedule_time, o.status AS order_status,
    cu.language, b.name AS business_name, b.is_house, b.call_notes, r.name AS rider_name
  FROM calls c JOIN customers cu ON cu.id = c.customer_id
  JOIN businesses b ON b.id = c.business_id
  LEFT JOIN riders r ON r.id = c.rider_id
  LEFT JOIN orders o ON o.id = COALESCE(c.order_id, c.rider_order_id)`;
const ORDER_LIMIT = `ORDER BY (c.status = 'in_progress') DESC, c.created_at DESC, c.id DESC LIMIT 1`;

export const agentContextRepository = {
  findByCallId: (callId: string) => one<AgentContextRow>(
    `${SELECT_CONTEXT} WHERE (c.provider_call_id = ? OR c.id = ?) AND c.status IN ('queued','in_progress') ${ORDER_LIMIT}`,
    [callId, /^\d+$/.test(callId) ? Number(callId) : -1]
  ),
  findByPhone: (phone: string) => one<AgentContextRow>(
    `${SELECT_CONTEXT} WHERE (CASE WHEN c.call_type = 'rider' THEN r.phone ELSE cu.phone END) = ?
      AND c.status IN ('queued','in_progress') ${ORDER_LIMIT}`,
    [phone]
  )
};
