import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChannelSidebar } from "./channel-sidebar";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import {
  DISCONNECTED_CHANNELS,
  SEED_CHANNELS,
  loadInbox,
  saveInbox,
} from "./mock-data";
import type { Conversation, PrimaryFilter, SortKey } from "./types";
import "./inbox.css";

const FILTER_LABEL: Record<PrimaryFilter, string> = {
  email: "Email",
  chats: "Chats",
  scheduled: "Scheduled",
  assigned: "Assigned",
  closed: "Closed",
  starred: "Starred",
  archived: "Archived",
};

function matchesFilter(c: Conversation, filter: PrimaryFilter): boolean {
  switch (filter) {
    case "email":
      return c.channelKind === "gmail";
    case "chats":
      return c.channelKind === "messenger";
    case "scheduled":
      return c.status === "scheduled";
    case "assigned":
      return c.status === "assigned";
    case "closed":
      return c.status === "closed";
    case "starred":
      return c.starred;
    case "archived":
      return c.status === "archived";
  }
}

function sortConversations(list: Conversation[], sort: SortKey): Conversation[] {
  const copy = [...list];
  if (sort === "unread") {
    copy.sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0) || +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  } else if (sort === "oldest") {
    copy.sort((a, b) => +new Date(a.lastMessageAt) - +new Date(b.lastMessageAt));
  } else {
    copy.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
  }
  return copy;
}

export function InboxWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadInbox());
  const [activeFilter, setActiveFilter] = useState<PrimaryFilter | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("c-matthew");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    saveInbox(conversations);
  }, [conversations]);

  const counts = useMemo(() => {
    const result = {} as Record<PrimaryFilter, number>;
    (Object.keys(FILTER_LABEL) as PrimaryFilter[]).forEach((key) => {
      result[key] = conversations.filter((c) => matchesFilter(c, key)).length;
    });
    return result;
  }, [conversations]);

  const channelCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const c of conversations) result[c.channelId] = (result[c.channelId] ?? 0) + 1;
    return result;
  }, [conversations]);

  const visible = useMemo(() => {
    let list = conversations;
    if (activeChannelId) list = list.filter((c) => c.channelId === activeChannelId);
    else if (activeFilter) list = list.filter((c) => matchesFilter(c, activeFilter));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.participant.name, c.preview, c.participant.handle ?? ""].join(" ").toLowerCase().includes(q),
      );
    }
    return sortConversations(list, sort);
  }, [conversations, activeChannelId, activeFilter, search, sort]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const title = activeFilter
    ? FILTER_LABEL[activeFilter]
    : activeChannelId
      ? SEED_CHANNELS.find((c) => c.id === activeChannelId)?.label ?? "Messages"
      : "Messages";

  function handleFilter(filter: PrimaryFilter | null) {
    setActiveFilter(filter);
    setActiveChannelId(null);
  }

  function handleChannel(id: string | null) {
    setActiveChannelId(id);
    setActiveFilter(null);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function handleToggleStar(id: string) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c)));
  }

  function handleSend(text: string) {
    if (!selectedId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== selectedId) return c;
        const message = {
          id: `m-${Date.now()}`,
          direction: "out" as const,
          author: "Nathan Scott",
          body: text,
          sentAt: new Date().toISOString(),
          status: "sent" as const,
        };
        return {
          ...c,
          messages: [...c.messages, message],
          preview: text,
          lastMessageAt: message.sentAt,
          unread: 0,
        };
      }),
    );
  }

  const rail = (
    <ChannelSidebar
      account={SEED_CHANNELS[0].account}
      counts={counts}
      channelCounts={channelCounts}
      activeFilter={activeFilter}
      activeChannelId={activeChannelId}
      onFilter={handleFilter}
      onChannel={handleChannel}
      channels={SEED_CHANNELS}
      disconnected={DISCONNECTED_CHANNELS}
    />
  );

  return (
    <div className="ibx" data-view={selectedId ? "thread" : "list"}>
      {rail}

      <ConversationList
        title={title}
        conversations={visible}
        selectedId={selectedId}
        search={search}
        sort={sort}
        onSelect={handleSelect}
        onSearch={setSearch}
        onSort={setSort}
        onToggleStar={handleToggleStar}
        onOpenChannels={() => setRailOpen(true)}
      />

      <ConversationThread conversation={selected} onBack={() => setSelectedId(null)} onSend={handleSend} />

      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Channels and filters</SheetTitle>
          </SheetHeader>
          {rail}
        </SheetContent>
      </Sheet>
    </div>
  );
}
