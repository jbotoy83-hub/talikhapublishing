export type ChannelKind = "gmail" | "messenger";

export type Presence = "online" | "recent" | "offline";

export type MessageDirection = "in" | "out";

export type ConversationStatus =
  | "open"
  | "scheduled"
  | "assigned"
  | "closed"
  | "archived";

export type PrimaryFilter =
  | "email"
  | "chats"
  | "scheduled"
  | "assigned"
  | "closed"
  | "starred"
  | "archived";

export type SortKey = "newest" | "oldest" | "unread";

export interface Channel {
  id: string;
  kind: ChannelKind;
  label: string;
  account: string;
  connected: boolean;
}

export interface MessageReaction {
  emoji: string;
  byMe?: boolean;
}

export interface InboxMessage {
  id: string;
  direction: MessageDirection;
  author: string;
  body: string;
  sentAt: string;
  reactions?: MessageReaction[];
  status?: "sending" | "sent" | "delivered" | "read";
}

export interface Participant {
  name: string;
  initials: string;
  accent: string;
  presence: Presence;
  handle?: string;
}

export interface Conversation {
  id: string;
  channelId: string;
  channelKind: ChannelKind;
  participant: Participant;
  preview: string;
  lastMessageAt: string;
  unread: number;
  starred: boolean;
  status: ConversationStatus;
  hasAttachment?: boolean;
  messengerWindowExpiresAt?: string;
  messages: InboxMessage[];
}

export interface DisconnectedChannel {
  id: string;
  kind: "telegram" | "whatsapp";
  label: string;
}

export const CHANNEL_META: Record<
  ChannelKind,
  { label: string; dot: string; chip: string }
> = {
  gmail: { label: "Gmail", dot: "#ea4335", chip: "#fdeceb" },
  messenger: { label: "Messenger", dot: "#0084ff", chip: "#e8f1ff" },
};
