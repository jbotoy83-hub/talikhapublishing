import type { ComponentType, HTMLAttributes } from "react";
import { ActivityIcon } from "./activity";
import { BellIcon } from "./bell";
import { BookOpenIcon } from "./book-open";
import { BookOpenCheckIcon } from "./book-open-check";
import { BookOpenTextIcon } from "./book-open-text";
import { BookmarkIcon } from "./bookmark";
import { ChartColumnIcon } from "./chart-column";
import { CheckIcon } from "./check";
import { ChevronDownIcon } from "./chevron-down";
import { ChevronLeftIcon } from "./chevron-left";
import { ChevronRightIcon } from "./chevron-right";
import { ChevronUpIcon } from "./chevron-up";
import { ChevronsLeftRightIcon } from "./chevrons-left-right";
import { ChevronsRightIcon } from "./chevrons-right";
import { CircleCheckIcon } from "./circle-check";
import { CircleChevronLeftIcon } from "./circle-chevron-left";
import { ClipboardIcon } from "./clipboard";
import { CornerDownLeftIcon } from "./corner-down-left";
import { CornerUpRightIcon } from "./corner-up-right";
import { CreditCardIcon } from "./credit-card";
import { DownloadIcon } from "./download";
import { EllipsisIcon } from "./ellipsis";
import { EllipsisVerticalIcon } from "./ellipsis-vertical";
import { EyeIcon } from "./eye";
import { FolderOpenIcon } from "./folder-open";
import { GlobeIcon } from "./globe";
import { HandCoinsIcon } from "./hand-coins";
import { HeadphonesIcon } from "./headphones";
import { HeartIcon } from "./heart";
import { InfoIcon } from "./info";
import { LayersIcon } from "./layers";
import { LayoutGridIcon } from "./layout-grid";
import { LayoutListIcon } from "./layout-list";
import { LoaderCircleIcon } from "./loader-circle";
import { LockIcon } from "./lock";
import { MailsIcon } from "./mails";
import { MapPinIcon } from "./map-pin";
import { MessageCircleIcon } from "./message-circle";
import { PlayIcon } from "./play";
import { PlusIcon } from "./plus";
import { SearchIcon } from "./search";
import { SendIcon } from "./send";
import { SettingsIcon } from "./settings";
import { ShieldCheckIcon } from "./shield-check";
import { SlidersHorizontalIcon } from "./sliders-horizontal";
import { SparklesIcon } from "./sparkles";
import { StarIcon } from "./star";
import { Trash2Icon } from "./trash-2";
import { TriangleAlertIcon } from "./triangle-alert";
import { UploadIcon } from "./upload";
import { UsersIcon } from "./users";
import { WifiSyncIcon } from "./wifi-sync";
import { XIcon } from "./x";

export type IconProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
  strokeWidth?: number | string;
  duration?: number;
  isAnimated?: boolean;
  color?: string;
};

const SIZE_CLASS = /(?:^|\s)(?:size|h|w)-(\d+(?:\.\d+)?)(?=\s|$)/;

function wrap(Comp: ComponentType<any>): ComponentType<IconProps> {
  return function AnimatedIcon({ className, size, ...rest }: IconProps) {
    let resolved = size;
    if (resolved == null && typeof className === "string") {
      const match = className.match(SIZE_CLASS);
      if (match) resolved = Math.round(parseFloat(match[1]) * 4);
    }
    return (
      <Comp
        className={className ? `ai-icon ${className}` : "ai-icon"}
        size={resolved}
        {...rest}
      />
    );
  };
}

export const Activity = wrap(ActivityIcon);
export const AlertTriangle = wrap(TriangleAlertIcon);
export const ArrowLeft = wrap(CircleChevronLeftIcon);
export const ArrowDownLeft = wrap(CornerDownLeftIcon);
export const ArrowUpRight = wrap(CornerUpRightIcon);
export const Award = wrap(StarIcon);
export const BarChart3 = wrap(ChartColumnIcon);
export const Bell = wrap(BellIcon);
export const BookOpen = wrap(BookOpenIcon);
export const BookOpenCheck = wrap(BookOpenCheckIcon);
export const CalendarDays = wrap(LayoutListIcon);
export const Check = wrap(CheckIcon);
export const CheckCircle2 = wrap(CircleCheckIcon);
export const ChevronDown = wrap(ChevronDownIcon);
export const ChevronLeft = wrap(ChevronLeftIcon);
export const ChevronRight = wrap(ChevronRightIcon);
export const CircleX = wrap(XIcon);
export const ClipboardCheck = wrap(CircleCheckIcon);
export const ClipboardList = wrap(ClipboardIcon);
export const Clock3 = wrap(LoaderCircleIcon);
export const CreditCard = wrap(CreditCardIcon);
export const Download = wrap(DownloadIcon);
export const Eye = wrap(EyeIcon);
export const FileCheck2 = wrap(BookOpenCheckIcon);
export const FileText = wrap(BookOpenTextIcon);
export const FolderOpen = wrap(FolderOpenIcon);
export const Globe = wrap(GlobeIcon);
export const Headphones = wrap(HeadphonesIcon);
export const Heart = wrap(HeartIcon);
export const ImageIcon = wrap(LayersIcon);
export const Inbox = wrap(MailsIcon);
export const Info = wrap(InfoIcon);
export const Landmark = wrap(HandCoinsIcon);
export const Layers = wrap(LayersIcon);
export const LayoutGrid = wrap(LayoutGridIcon);
export const Lightbulb = wrap(SparklesIcon);
export const LockKeyhole = wrap(LockIcon);
export const MapPin = wrap(MapPinIcon);
export const MessageSquare = wrap(MessageCircleIcon);
export const MoreHorizontal = wrap(EllipsisIcon);
export const MoreVertical = wrap(EllipsisVerticalIcon);
export const Plus = wrap(PlusIcon);
export const RefreshCw = wrap(WifiSyncIcon);
export const Save = wrap(BookmarkIcon);
export const Search = wrap(SearchIcon);
export const Send = wrap(SendIcon);
export const Settings = wrap(SettingsIcon);
export const ShieldCheck = wrap(ShieldCheckIcon);
export const SlidersHorizontal = wrap(SlidersHorizontalIcon);
export const Star = wrap(StarIcon);
export const Trash2 = wrap(Trash2Icon);
export const Upload = wrap(UploadIcon);
export const Users = wrap(UsersIcon);
export const Video = wrap(PlayIcon);
export const X = wrap(XIcon);

export const WrappedCheckIcon = wrap(CheckIcon);
export const WrappedChevronDownIcon = wrap(ChevronDownIcon);
export const WrappedChevronRightIcon = wrap(ChevronRightIcon);
export const WrappedChevronUpIcon = wrap(ChevronUpIcon);
export const WrappedXIcon = wrap(XIcon);
export const WrappedTrash2Icon = wrap(Trash2Icon);
export const PanelLeftIcon = wrap(ChevronsLeftRightIcon);
export {
  WrappedCheckIcon as CheckIcon,
  WrappedChevronDownIcon as ChevronDownIcon,
  WrappedChevronRightIcon as ChevronRightIcon,
  WrappedChevronUpIcon as ChevronUpIcon,
  WrappedXIcon as XIcon,
  WrappedTrash2Icon as Trash2Icon,
};
