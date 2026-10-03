import { CallType } from "../types/models";

/**
 * Reads a finished call's transcript without any AI service. Used when the agent did not
 * report a result through our tool and no ANTHROPIC_API_KEY is set (or that call failed).
 * It is deliberately conservative: when it cannot tell, it returns no outcome and the call
 * is flagged for review instead of being guessed.
 */

interface Turn {
  role: "assistant" | "user";
  text: string;
}

const YES = /\b(yes|yeah|yep|yup|ok|okay|sure|alright|all right|correct|no problem|fine|i agree|go ahead|e ?go be|beeni|ee|eh)\b/i;
const NO = /\b(no|nope|don'?t|do not|not interested|stop calling|rara)\b/i;
const TIME_HINT = /\d|\b(am|pm|morning|afternoon|evening|night|noon|midday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|weekend|o'?clock)\b/i;
const WRAP_UP = /\b(you'?re all set|welcome aboard|all set|you'?re set|that'?s all|have a great day|thank you for your time)\b/i;

const LANGUAGES: [RegExp, string][] = [
  [/\bpidgin\b/i, "pcm"],
  [/\byoruba\b/i, "yo"],
  [/\bhausa\b/i, "ha"],
  [/\bigbo\b/i, "ig"],
  [/\benglish\b/i, "en"]
];

export function parseTranscript(transcript: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of transcript.split("\n")) {
    const match = line.match(/^\s*(assistant|agent|bot|ai|user|customer|human)\s*:\s*(.*)$/i);
    if (match) {
      const role = /^(user|customer|human)$/i.test(match[1]) ? "user" : "assistant";
      const text = match[2].trim();
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.text = `${last.text} ${text}`.trim();
      else turns.push({ role, text });
    } else if (turns.length && line.trim()) {
      turns[turns.length - 1].text += `\n${line.trim()}`;
    }
  }
  return turns.filter((turn) => turn.text !== "");
}

type Topic = "address" | "landmark" | "language" | "time" | "consent" | "available" | "other";

function topicOf(question: string): Topic {
  const q = question.toLowerCase();
  if (/okay if we call|ok if we call|agree to (receive|get)|consent|call you about|receive (delivery )?calls/.test(q)) return "consent";
  if (/language/.test(q)) return "language";
  if (/landmark/.test(q)) return "landmark";
  if (/address/.test(q)) return "address";
  if (/best time|what time|time of day|reach you|when (can|should|would)|another (day|time)|new time|call (you )?back/.test(q)) return "time";
  if (/available|be (at )?home|be around|receive (the|your) (item|order|package|delivery)/.test(q)) return "available";
  return "other";
}

/** Every customer answer, tagged with what the agent had just asked. */
function answers(turns: Turn[]): { topic: Topic; text: string }[] {
  const result: { topic: Topic; text: string }[] = [];
  let topic: Topic = "other";
  for (const turn of turns) {
    if (turn.role === "assistant") {
      // The last question in the agent's turn is the one being answered.
      const sentences = turn.text.split(/(?<=[?.!])\s+/);
      const question = [...sentences].reverse().find((s) => s.includes("?"));
      topic = question ? topicOf(question) : "other";
    } else {
      result.push({ topic, text: turn.text });
    }
  }
  return result;
}

function lastAnswer(list: { topic: Topic; text: string }[], topic: Topic, filter?: RegExp): string | null {
  const matches = list.filter((a) => a.topic === topic && (!filter || filter.test(a.text)));
  return matches.length ? matches[matches.length - 1].text : null;
}

function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/^[\s,:-]+|[\s,.;:-]+$/g, "").replace(/\s+/g, " ");
  return trimmed.length >= 2 ? trimmed : null;
}

/**
 * The agent usually reads the details back ("your delivery address is 5 Babble Road, Jabaligos,
 * and the landmark is Hadi Yibos Stop"). That read-back is cleaner than the raw speech-to-text,
 * so prefer the last one.
 */
function readBack(turns: Turn[]): { address: string | null; landmark: string | null } {
  for (const turn of [...turns].reverse()) {
    if (turn.role !== "assistant") continue;
    const match = turn.text.match(/address (?:is|to|as|will be)\s+(.+?)(?:\n|\.(?:\s|$)|\?|$)/i);
    if (!match) continue;
    const sentence = match[1];
    const split = sentence.match(/^(.+?),?\s+(?:and\s+)?(?:with\s+|near\s+)?(?:the\s+)?(?:landmark\s+(?:is\s+)?|near\s+)(.+)$/i)
      || sentence.match(/^(.+?),?\s+near\s+(?:the\s+)?(.+)$/i);
    const address = clean((split ? split[1] : sentence).replace(/,?\s+(?:right|correct|is that (?:right|correct))$/i, ""));
    const landmark = split ? clean(split[2].replace(/,?\s+(?:right|correct|is that (?:right|correct))$/i, "")) : null;
    if (address) return { address, landmark };
  }
  return { address: null, landmark: null };
}

function landmarkReadBack(turns: Turn[]): string | null {
  for (const turn of [...turns].reverse()) {
    if (turn.role !== "assistant") continue;
    const match = turn.text.match(/landmark is\s+(.+?)(?:[.\n?!]|,\s*(?:and|right|correct)|$)/i);
    if (match) return clean(match[1]);
  }
  return null;
}

function languageFrom(list: { topic: Topic; text: string }[]): string | null {
  const said = list.filter((a) => a.topic === "language");
  for (const answer of [...said].reverse()) {
    for (const [pattern, code] of LANGUAGES) if (pattern.test(answer.text)) return code;
  }
  return null;
}

function consentFrom(list: { topic: Topic; text: string }[]): boolean | null {
  for (const answer of [...list].reverse()) {
    if (answer.topic !== "consent") continue;
    if (YES.test(answer.text)) return true;
    if (NO.test(answer.text)) return false;
  }
  return null;
}

/**
 * The agent sometimes ends with a labelled list ("- **Address:** Syabate, 10256"). When it does,
 * that list is the most reliable summary of the call.
 */
function labelledRecap(turns: Turn[]): Record<string, string> {
  for (const turn of [...turns].reverse()) {
    if (turn.role !== "assistant") continue;
    const found: Record<string, string> = {};
    for (const line of turn.text.split("\n")) {
      const match = line.match(/^[\s*•-]*([A-Za-z][A-Za-z ]{2,30}?)\s*\**\s*:\s*\**\s*(.+)$/);
      if (!match) continue;
      const label = match[1].toLowerCase();
      const value = clean(match[2].replace(/\*+/g, ""));
      if (!value) continue;
      if (/landmark/.test(label)) found.landmark = value;
      else if (/address/.test(label)) found.address = value;
      else if (/language/.test(label)) found.language = value;
      else if (/time/.test(label)) found.time = value;
      else if (/consent|calls/.test(label)) found.consent = value;
    }
    if (found.address) return found;
  }
  return {};
}

function onboarding(turns: Turn[]): Record<string, unknown> {
  const list = answers(turns);
  const recap = labelledRecap(turns);
  const back = readBack(turns);
  const address = recap.address ?? back.address ?? clean(lastAnswer(list, "address"));
  const landmark = recap.landmark ?? back.landmark ?? landmarkReadBack(turns) ?? clean(lastAnswer(list, "landmark"));
  const language = languageFrom(recap.language ? [{ topic: "language", text: recap.language }] : list);
  const bestTime = recap.time ?? clean(lastAnswer(list, "time", TIME_HINT) ?? lastAnswer(list, "time"));
  const consent = recap.consent ? YES.test(recap.consent) || !NO.test(recap.consent) : consentFrom(list);
  const wrappedUp = turns.some((t) => t.role === "assistant" && WRAP_UP.test(t.text));

  const data: Record<string, unknown> = {
    address,
    landmark,
    language,
    best_time_to_call: bestTime,
    consent_to_calls: consent === true,
    read_by: "transcript rules"
  };
  if (address && (consent !== null || wrappedUp)) {
    return { ...data, outcome: "verified", notes: consent === false ? "Customer gave details but declined delivery calls." : "Details collected on the call." };
  }
  if (consent === false) return { ...data, outcome: "failed", notes: "Customer declined delivery calls." };
  return {
    ...data,
    outcome: "failed",
    notes: address ? "Call ended before onboarding finished. Some details were saved." : "Call ended before the customer gave their details."
  };
}

function delivery(turns: Turn[]): Record<string, unknown> {
  const list = answers(turns);
  const agentText = turns.filter((t) => t.role === "assistant").map((t) => t.text).join("\n");

  if (/wrong (number|person)/i.test(agentText)) return { outcome: "failed", notes: "Wrong number.", read_by: "transcript rules" };

  const back = readBack(turns);
  const landmark = back.landmark ?? landmarkReadBack(turns) ?? clean(lastAnswer(list, "landmark"));
  const newTime = clean(lastAnswer(list, "time", TIME_HINT));
  const availability = lastAnswer(list, "available");
  const notAvailable = availability !== null && NO.test(availability) && !YES.test(availability);
  const rescheduled = /\b(reschedul\w*|new (delivery )?time|another (day|time)|moved? (the|your) delivery|call (you )?back)\b/i.test(agentText);
  const addressChanged = /\b(updated|new|changed|correct(ed)?) (delivery )?address\b|address (has been |is now )?(updated|changed)/i.test(agentText)
    || list.some((a) => a.topic === "address" && NO.test(a.text) && !YES.test(a.text));

  const base = { cleaned_address: back.address, landmark, read_by: "transcript rules" };
  if ((notAvailable || rescheduled) && newTime) {
    return { ...base, outcome: "rescheduled", available: false, reschedule_time: newTime, notes: `Customer asked for ${newTime}.` };
  }
  if (addressChanged && back.address) {
    return { ...base, outcome: "address_updated", available: true, notes: "Customer gave a corrected address." };
  }
  const confirmed = /\b(confirmed|see you|rider will|is all set|you'?re all set|we'?ll deliver|delivery is set)\b/i.test(agentText)
    || (availability !== null && YES.test(availability));
  if (confirmed && !notAvailable) {
    return { ...base, outcome: "confirmed", available: true, notes: "Customer confirmed the delivery." };
  }
  return { ...base, outcome: null };
}

export function extractWithRules(callType: CallType, transcript: string): Record<string, unknown> {
  const turns = parseTranscript(transcript);
  if (!turns.some((t) => t.role === "user")) {
    return { outcome: "no_answer", notes: "Nobody spoke on the call.", read_by: "transcript rules" };
  }
  return callType === "onboarding" ? onboarding(turns) : delivery(turns);
}
