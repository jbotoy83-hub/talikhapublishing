import type { ComponentType, HTMLAttributes } from "react";
import { BookOpenIcon } from "@/components/icons/book-open";
import { BookmarkIcon } from "@/components/icons/bookmark";
import { CheckIcon } from "@/components/icons/check";
import { ChevronDownIcon } from "@/components/icons/chevron-down";
import { ClipboardIcon } from "@/components/icons/clipboard";
import { CloudUploadIcon } from "@/components/icons/cloud-upload";
import { ContactRoundIcon } from "@/components/icons/contact-round";
import { CornerUpRightIcon } from "@/components/icons/corner-up-right";
import { CreditCardIcon } from "@/components/icons/credit-card";
import { EyeIcon } from "@/components/icons/eye";
import { FacebookIcon } from "@/components/icons/facebook";
import { GlobeIcon } from "@/components/icons/globe";
import { KeyIcon } from "@/components/icons/key";
import { LayersIcon } from "@/components/icons/layers";
import { LayoutListIcon } from "@/components/icons/layout-list";
import { LockIcon } from "@/components/icons/lock";
import { MailIcon } from "@/components/icons/mail";
import { MapPinIcon } from "@/components/icons/map-pin";
import { MenuIcon } from "@/components/icons/menu";
import { MinusIcon } from "@/components/icons/minus";
import { PaperclipIcon } from "@/components/icons/paperclip";
import { PlusIcon } from "@/components/icons/plus";
import { SearchIcon } from "@/components/icons/search";
import { SendIcon } from "@/components/icons/send";
import { ShieldCheckIcon } from "@/components/icons/shield-check";
import { SlidersHorizontalIcon } from "@/components/icons/sliders-horizontal";
import { SparklesIcon } from "@/components/icons/sparkles";
import { SquareArrowOutUpRightIcon } from "@/components/icons/square-arrow-out-up-right";
import { SunIcon } from "@/components/icons/sun";
import { UserIcon } from "@/components/icons/user";
import { UsersIcon } from "@/components/icons/users";

type IconName = "book" | "arrow" | "search" | "users" | "shield" | "sun" | "file" | "mail" | "menu" | "external" | "check" | "leaf" | "facebook" | "chevron" | "feather" | "location" | "edit" | "globe" | "layers" | "lock" | "unlock" | "eye" | "person" | "building" | "briefcase" | "tag" | "list" | "paperclip" | "image" | "cloud" | "plus" | "card";

const SIZE_CLASS = /(?:^|\s)(?:size|h|w)-(\d+(?:\.\d+)?)(?=\s|$)/;

function wrap(Comp: ComponentType<any>): ComponentType<HTMLAttributes<HTMLDivElement>> {
  return function AnimatedIcon({ className = "h-5 w-5", ...rest }: HTMLAttributes<HTMLDivElement>) {
    let size: number | undefined;
    if (typeof className === "string") {
      const match = className.match(SIZE_CLASS);
      if (match) size = Math.round(parseFloat(match[1]) * 4);
    }
    return <Comp className={className} size={size} strokeWidth={1.8} aria-hidden {...rest} />;
  };
}

const icons: Record<IconName, ComponentType<HTMLAttributes<HTMLDivElement>>> = {
  book: wrap(BookOpenIcon),
  arrow: wrap(CornerUpRightIcon),
  search: wrap(SearchIcon),
  users: wrap(UsersIcon),
  shield: wrap(ShieldCheckIcon),
  sun: wrap(SunIcon),
  file: wrap(ClipboardIcon),
  mail: wrap(MailIcon),
  menu: wrap(MenuIcon),
  external: wrap(SquareArrowOutUpRightIcon),
  check: wrap(CheckIcon),
  leaf: wrap(SparklesIcon),
  facebook: wrap(FacebookIcon),
  chevron: wrap(ChevronDownIcon),
  feather: wrap(SendIcon),
  location: wrap(MapPinIcon),
  edit: wrap(SlidersHorizontalIcon),
  globe: wrap(GlobeIcon),
  layers: wrap(LayersIcon),
  lock: wrap(LockIcon),
  unlock: wrap(KeyIcon),
  eye: wrap(EyeIcon),
  person: wrap(UserIcon),
  building: wrap(ContactRoundIcon),
  briefcase: wrap(ContactRoundIcon),
  tag: wrap(BookmarkIcon),
  list: wrap(LayoutListIcon),
  paperclip: wrap(PaperclipIcon),
  image: wrap(LayersIcon),
  cloud: wrap(CloudUploadIcon),
  plus: wrap(PlusIcon),
  card: wrap(CreditCardIcon),
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const Animated = icons[name];
  return <Animated className={className} />;
}
