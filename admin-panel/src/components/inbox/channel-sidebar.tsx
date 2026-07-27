import type { ComponentType } from "react";
import {
  Inbox,
  MessageSquare,
  Clock3,
  CheckCircle2,
  CircleX,
  Star,
  FolderOpen,
  MoreVertical,
  Plus,
} from "@/components/icons";
import { BRAND_MARKS } from "./brand-icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Channel, DisconnectedChannel, PrimaryFilter } from "./types";

type IconType = ComponentType<{ size?: number; strokeWidth?: number | string }>;

const FILTERS: { key: PrimaryFilter; label: string; Icon: IconType }[] = [
  { key: "email", label: "Email", Icon: Inbox },
  { key: "chats", label: "Chats", Icon: MessageSquare },
  { key: "scheduled", label: "Scheduled", Icon: Clock3 },
  { key: "assigned", label: "Assigned", Icon: CheckCircle2 },
  { key: "closed", label: "Closed", Icon: CircleX },
  { key: "starred", label: "Starred", Icon: Star },
  { key: "archived", label: "Archived", Icon: FolderOpen },
];

interface RailProps {
  account: string;
  counts: Record<PrimaryFilter, number>;
  channelCounts: Record<string, number>;
  activeFilter: PrimaryFilter | null;
  activeChannelId: string | null;
  onFilter: (filter: PrimaryFilter | null) => void;
  onChannel: (id: string | null) => void;
  channels: Channel[];
  disconnected: DisconnectedChannel[];
}

export function ChannelSidebar({
  account,
  counts,
  channelCounts,
  activeFilter,
  activeChannelId,
  onFilter,
  onChannel,
  channels,
  disconnected,
}: RailProps) {
  return (
    <aside className="ibx-rail">
      <div className="ibx-rail__head">
        <div className="ibx-rail__account">
          <span className="ibx-rail__account-mark">{account.charAt(0).toUpperCase()}</span>
          <span className="ibx-rail__account-id" title={account}>{account}</span>
        </div>
        <button type="button" className="ibx-iconbtn" aria-label="Account options">
          <MoreVertical size={17} />
        </button>
      </div>

      <ScrollArea className="ibx-scroll">
      <nav className="ibx-nav">
        {FILTERS.map(({ key, label, Icon }) => {
          const active = activeFilter === key && activeChannelId === null;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              className="ibx-nav__item"
              data-active={active}
              onClick={() => onFilter(active ? null : key)}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span className="ibx-nav__label">{label}</span>
              {count > 0 && <span className="ibx-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="ibx-rail__group">
        <span className="ibx-rail__group-label">Channels</span>
      </div>

      <div className="ibx-channels">
        {channels.map((channel) => {
          const Mark = BRAND_MARKS[channel.kind];
          const active = activeChannelId === channel.id;
          const count = channelCounts[channel.id] ?? 0;
          return (
            <button
              key={channel.id}
              type="button"
              className="ibx-channel"
              data-active={active}
              onClick={() => onChannel(active ? null : channel.id)}
            >
              <span className="ibx-channel__mark">
                <Mark size={16} />
                <span className="ibx-presence" data-presence="online" />
              </span>
              <span className="ibx-channel__label">
                <span>{channel.label}</span>
                <span className="ibx-channel__sub">{channel.account}</span>
              </span>
              {count > 0 && <span className="ibx-count">{count}</span>}
            </button>
          );
        })}

        {disconnected.map((d) => {
          const Mark = BRAND_MARKS[d.kind];
          return (
            <button key={d.id} type="button" className="ibx-channel" disabled title="Connect coming soon">
              <span className="ibx-channel__mark">
                <Mark size={16} />
              </span>
              <span className="ibx-channel__label">
                <span>{d.label}</span>
              </span>
              <span className="ibx-channel__soon">Soon</span>
            </button>
          );
        })}
      </div>
      </ScrollArea>

      <button type="button" className="ibx-rail__connect" title="Connect coming soon">
        <Plus size={15} strokeWidth={2.2} />
        Connect channel
      </button>
    </aside>
  );
}
