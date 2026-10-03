import { badRequest } from "./errors";

export function normalizePhone(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, "");
  let normalized: string;

  if (/^0[789]\d{9}$/.test(compact)) {
    normalized = `+234${compact.slice(1)}`;
  } else if (/^234[789]\d{9}$/.test(compact)) {
    normalized = `+${compact}`;
  } else if (/^\+234[789]\d{9}$/.test(compact)) {
    normalized = compact;
  } else {
    throw badRequest("Phone must be a Nigerian number such as 08031234567 or +2348031234567");
  }

  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) throw badRequest("Phone number is not a valid E.164 number");
  return normalized;
}
