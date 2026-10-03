import { one } from "../../db/pool";

const SELECT_CONTEXT = `SELECT c.call_type, cu.name AS customer_name, cu.phone, o.item, o.seller,
    COALESCE(o.cleaned_address, o.address_on_file, cu.address) AS address_on_file,
    o.delivery_window, cu.language
  FROM calls c JOIN customers cu ON cu.id = c.customer_id
  LEFT JOIN orders o ON o.id = c.order_id`;
const ORDER_LIMIT = `ORDER BY (c.status = 'in_progress') DESC, c.created_at DESC, c.id DESC LIMIT 1`;

export const agentContextRepository = {
  findByCallId: (callId: string) => one(
    `${SELECT_CONTEXT} WHERE (c.provider_call_id = ? OR c.id = ?) AND c.status IN ('queued','in_progress') ${ORDER_LIMIT}`,
    [callId, /^\d+$/.test(callId) ? Number(callId) : -1]
  ),
  findByPhone: (phone: string) => one(
    `${SELECT_CONTEXT} WHERE cu.phone = ? AND c.status IN ('queued','in_progress') ${ORDER_LIMIT}`,
    [phone]
  )
};
