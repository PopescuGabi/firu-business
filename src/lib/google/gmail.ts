import "server-only";
import { GMAIL_SCOPES, getGoogleAccount, googleFetch, hasScope } from "./oauth";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type MailSummary = {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string; // ISO
  unread: boolean;
  important: boolean;
};

export type Mail = MailSummary & { to: string; messageId: string; references: string; body: string };

/** Whether this person connected Gmail (both read and send). */
export async function gmailConnected(uid: number) {
  const acc = await getGoogleAccount(uid);
  return GMAIL_SCOPES.every((s) => hasScope(acc, s));
}

type Header = { name: string; value: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: Header[] };
type RawMessage = { id: string; threadId: string; snippet?: string; labelIds?: string[]; internalDate?: string; payload?: Part };

const header = (m: RawMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function summarize(m: RawMessage): MailSummary {
  const from = header(m, "From");
  const email = from.match(/<([^>]+)>/)?.[1] ?? from;
  return {
    id: m.id,
    threadId: m.threadId,
    from: from.replace(/\s*<[^>]+>\s*/, "").replace(/^"|"$/g, "") || email,
    fromEmail: email.trim(),
    subject: header(m, "Subject") || "(no subject)",
    snippet: decodeEntities(m.snippet ?? ""),
    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString(),
    unread: Boolean(m.labelIds?.includes("UNREAD")),
    important: Boolean(m.labelIds?.includes("IMPORTANT")),
  };
}

const b64 = (data: string) => Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

/** The message as plain text: the text/plain part, or the HTML part with every tag stripped. Never HTML. */
function plainText(p: Part | undefined): string {
  if (!p) return "";
  const find = (part: Part, type: string): string | null => {
    if (part.mimeType === type && part.body?.data) return b64(part.body.data);
    for (const c of part.parts ?? []) {
      const hit = find(c, type);
      if (hit) return hit;
    }
    return null;
  };
  const text = find(p, "text/plain");
  if (text) return text.trim();
  const html = find(p, "text/html") ?? (p.body?.data ? b64(p.body.data) : "");
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Recent inbox mail: unread first. `q` is a Gmail search (defaults to the primary inbox). */
export async function listInbox(uid: number, { max = 20, q = "in:inbox category:primary" } = {}) {
  const ids = (await (await googleFetch(uid, `${API}/messages?maxResults=${max}&q=${encodeURIComponent(q)}`)).json()) as {
    messages?: { id: string }[];
  };
  const messages = await Promise.all(
    (ids.messages ?? []).map(async ({ id }) => {
      const res = await googleFetch(uid, `${API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      return summarize((await res.json()) as RawMessage);
    }),
  );
  return messages;
}

export async function getMail(uid: number, id: string): Promise<Mail> {
  if (!/^[\w-]{6,64}$/.test(id)) throw new Error("Invalid message id");
  const m = (await (await googleFetch(uid, `${API}/messages/${id}?format=full`)).json()) as RawMessage;
  return {
    ...summarize(m),
    to: header(m, "To"),
    messageId: header(m, "Message-ID") || header(m, "Message-Id"),
    references: header(m, "References"),
    body: plainText(m.payload).slice(0, 50_000),
  };
}

const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** Sends a reply in the same thread (plain text). */
export async function sendReply(uid: number, original: Mail, text: string) {
  const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;
  const headers = [`To: ${clean(original.fromEmail)}`, `Subject: ${encodeHeader(clean(subject))}`];
  if (original.messageId) {
    headers.push(`In-Reply-To: ${clean(original.messageId)}`, `References: ${clean(`${original.references} ${original.messageId}`)}`);
  }
  headers.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64");
  const lines = [...headers, "", Buffer.from(text).toString("base64")];
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  await googleFetch(uid, `${API}/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: original.threadId }),
  });
}

export const gmailLink = (m: { threadId: string }) => `https://mail.google.com/mail/u/0/#all/${m.threadId}`;
