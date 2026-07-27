import type {
  Channel,
  Conversation,
  ConversationStatus,
  DisconnectedChannel,
  InboxMessage,
  MessageDirection,
  Participant,
} from "./types";

const STORAGE_KEY = "talikha-inbox-v2";

const MIN = 60_000;
const HOUR = 60 * MIN;

function iso(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

function msg(
  id: string,
  direction: MessageDirection,
  author: string,
  body: string,
  offsetMs: number,
  extra?: Partial<InboxMessage>,
): InboxMessage {
  return { id, direction, author, body, sentAt: iso(offsetMs), ...extra };
}

const P = {
  matthew: { name: "Matthew Anderson", initials: "MA", accent: "#183d2c", presence: "recent" as const, handle: "@matthew.anderson" },
  ethan: { name: "Ethan Johnson", initials: "EJ", accent: "#a65335", presence: "online" as const, handle: "ethan.johnson@gmail.com" },
  benjamin: { name: "Benjamin Lee", initials: "BL", accent: "#2d6045", presence: "online" as const, handle: "@benjamin.lee" },
  esther: { name: "Esther Howard", initials: "EH", accent: "#7a5a8c", presence: "offline" as const, handle: "esther.howard@gmail.com" },
  sophia: { name: "Sophia Rodriguez", initials: "SR", accent: "#b07d2b", presence: "recent" as const, handle: "@sophia.r" },
  leslie: { name: "Leslie Alexander", initials: "LA", accent: "#356080", presence: "offline" as const, handle: "leslie.alexander@gmail.com" },
  chloe: { name: "Chloe Patel", initials: "CP", accent: "#9c4f4f", presence: "offline" as const, handle: "@chloe.patel" },
  elise: { name: "Elise Hunt", initials: "EH", accent: "#5a6b52", presence: "offline" as const, handle: "elise.hunt@gmail.com" },
} satisfies Record<string, Participant>;

function buildSeed(): Conversation[] {
  return [
    {
      id: "c-matthew",
      channelId: "messenger-main",
      channelKind: "messenger",
      participant: P.matthew,
      preview: "That sounds fascinating! So, does that mean I can invest…",
      lastMessageAt: iso(8 * MIN),
      unread: 1,
      starred: false,
      status: "open",
      messengerWindowExpiresAt: iso(-1.5 * HOUR),
      messages: [
        msg("m1", "in", P.matthew.name, "Hey there! 👋 I'm new here and I'm really interested in the concept of tokenized real estate. Can anyone explain how it works?", 62 * MIN),
        msg("m2", "out", "Nathan Scott", "Hey Matthew, welcome! Tokenized real estate is a way to represent ownership in real estate properties using blockchain technology. Each property is divided into tokens, and each token represents a certain fraction of ownership in that property.", 42 * MIN, { status: "read" }),
        msg("m3", "in", P.matthew.name, "That sounds fascinating! So, does that mean I can invest in real estate without actually buying a whole property? I found an option, what do you think? 🔥", 30 * MIN, { reactions: [{ emoji: "👍" }] }),
        msg("m4", "out", "Nathan Scott", "Exactly! By owning tokens, you can invest in different properties without the need to purchase an entire property. It provides more flexibility and accessibility to the real estate market.", 18 * MIN, { status: "read" }),
        msg("m5", "in", P.matthew.name, "That's a relief. Where do I start — is there a minimum?", 8 * MIN),
      ],
    },
    {
      id: "c-ethan",
      channelId: "gmail-1",
      channelKind: "gmail",
      participant: P.ethan,
      preview: "Hi, John! I hope this message finds you well. Attaching the…",
      lastMessageAt: iso(15 * MIN),
      unread: 1,
      starred: false,
      status: "open",
      hasAttachment: true,
      messages: [
        msg("e1", "in", P.ethan.name, "Hi, John! I hope this message finds you well. Attaching the signed contributor agreement for the Q3 issue. Let me know if you need anything else from my side.", 15 * MIN),
      ],
    },
    {
      id: "c-benjamin",
      channelId: "messenger-main",
      channelKind: "messenger",
      participant: P.benjamin,
      preview: "Hello! 👋 Thank you for the productive meeting today.",
      lastMessageAt: iso(1 * HOUR),
      unread: 0,
      starred: true,
      status: "open",
      messengerWindowExpiresAt: iso(-10 * HOUR),
      messages: [
        msg("b1", "out", "Nathan Scott", "Great speaking earlier — I'll send the deck over tonight.", 3 * HOUR, { status: "read" }),
        msg("b2", "in", P.benjamin.name, "Hello! 👋 Thank you for the productive meeting today. Looking forward to the deck.", 1 * HOUR),
      ],
    },
    {
      id: "c-esther",
      channelId: "gmail-1",
      channelKind: "gmail",
      participant: P.esther,
      preview: "Yes, I saw your message. I'm writing to provide the…",
      lastMessageAt: iso(3 * HOUR),
      unread: 1,
      starred: false,
      status: "assigned",
      messages: [
        msg("h1", "in", P.esther.name, "Yes, I saw your message. I'm writing to provide the revised proofs for chapter four. The tracked-changes file is in the shared drive.", 3 * HOUR),
      ],
    },
    {
      id: "c-sophia",
      channelId: "messenger-press",
      channelKind: "messenger",
      participant: P.sophia,
      preview: "Hey there! 👋 I'm currently working on Project Y…",
      lastMessageAt: iso(5 * HOUR),
      unread: 1,
      starred: false,
      status: "open",
      messengerWindowExpiresAt: iso(-3 * HOUR),
      messages: [
        msg("s1", "in", P.sophia.name, "Hey there! 👋 I'm currently working on Project Y and had a question about the cover timeline. Are we still on for the 12th?", 30 * HOUR),
        msg("s2", "out", "Nathan Scott", "Hi Sophia — yes, the 12th still holds. I'll loop in design tomorrow.", 28 * HOUR, { status: "delivered" }),
        msg("s3", "in", P.sophia.name, "Perfect, thanks! One more thing when you get a chance.", 5 * HOUR),
      ],
    },
    {
      id: "c-leslie",
      channelId: "gmail-1",
      channelKind: "gmail",
      participant: P.leslie,
      preview: "Hi! Please be informed that a new policy regarding…",
      lastMessageAt: iso(10 * HOUR),
      unread: 0,
      starred: false,
      status: "scheduled",
      messages: [
        msg("l1", "in", P.leslie.name, "Hi! Please be informed that a new policy regarding reprint permissions takes effect next month. Draft reply scheduled for your review.", 10 * HOUR),
      ],
    },
    {
      id: "c-chloe",
      channelId: "messenger-main",
      channelKind: "messenger",
      participant: P.chloe,
      preview: "Hey there! This is a friendly reminder that the deadline…",
      lastMessageAt: iso(15 * HOUR),
      unread: 0,
      starred: false,
      status: "closed",
      messengerWindowExpiresAt: iso(5 * HOUR),
      messages: [
        msg("p1", "in", P.chloe.name, "Hey there! This is a friendly reminder that the deadline for the anthology submissions has passed. Closing this thread — thank you!", 15 * HOUR),
      ],
    },
    {
      id: "c-elise",
      channelId: "gmail-1",
      channelKind: "gmail",
      participant: P.elise,
      preview: "Archived: invoice reconciliation for the May batch is complete.",
      lastMessageAt: iso(2 * 24 * HOUR),
      unread: 0,
      starred: false,
      status: "archived",
      messages: [
        msg("a1", "out", "Nathan Scott", "Invoice reconciliation for the May batch is complete. Archiving.", 2 * 24 * HOUR, { status: "read" }),
      ],
    },
  ];
}

export const SEED_CHANNELS: Channel[] = [
  { id: "gmail-1", kind: "gmail", label: "Gmail", account: "apricity@example.com", connected: true },
  { id: "messenger-main", kind: "messenger", label: "Messenger", account: "Talikha Publishing", connected: true },
  { id: "messenger-press", kind: "messenger", label: "Messenger", account: "Talikha Press", connected: true },
];

export const DISCONNECTED_CHANNELS: DisconnectedChannel[] = [
  { id: "telegram-1", kind: "telegram", label: "Telegram" },
  { id: "whatsapp-1", kind: "whatsapp", label: "WhatsApp" },
];

export function loadInbox(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore corrupt store */
  }
  const seed = buildSeed();
  saveInbox(seed);
  return seed;
}

export function saveInbox(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    /* storage may be unavailable */
  }
}

export function resetInbox(): Conversation[] {
  const seed = buildSeed();
  saveInbox(seed);
  return seed;
}

export type { ConversationStatus };
