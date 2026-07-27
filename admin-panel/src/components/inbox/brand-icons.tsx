import type { SVGProps } from "react";

type MarkProps = SVGProps<SVGSVGElement> & { size?: number };

export function GmailMark({ size = 18, ...props }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="2.5" y="5.25" width="19" height="13.5" rx="2.25" fill="#ffffff" stroke="#e4e7ec" strokeWidth="1" />
      <path d="M3.6 6.6 12 12.7l8.4-6.1" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3.6 6.6v10.6M20.4 6.6v10.6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" />
      <path d="M3.6 17.2V9.4M20.4 17.2V9.4" stroke="#C5221F" strokeWidth="0" />
    </svg>
  );
}

export function MessengerMark({ size = 18, ...props }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="ibx-messenger-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0099FF" />
          <stop offset="1" stopColor="#5F5BFF" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#ibx-messenger-grad)" />
      <path d="M12.95 7 7.9 12.95h3.05L10.3 17l5.8-5.95h-3.05z" fill="#ffffff" />
    </svg>
  );
}

export function TelegramMark({ size = 18, ...props }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" fill="#29A9EA" />
      <path d="M16.6 8.1 14.9 16c-.1.6-.5.7-1 .4l-2.4-1.8-1.2 1.1c-.1.1-.2.2-.5.2l.2-2.5 4.6-4.1c.2-.2 0-.3-.3-.1L8.4 13l-2.5-.8c-.5-.2-.5-.5.1-.8l9.8-3.8c.5-.1.9.1.8.5Z" fill="#ffffff" />
    </svg>
  );
}

export function WhatsappMark({ size = 18, ...props }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" fill="#25D366" />
      <path d="M12 7.2a4.7 4.7 0 0 0-4 7.2l-.6 2.2 2.3-.6A4.7 4.7 0 1 0 12 7.2Zm2.6 6.4c-.1.3-.6.6-.9.6-.2 0-.5.1-1.6-.4-1.3-.6-2.1-1.9-2.2-2-.1-.1-.5-.7-.5-1.3 0-.6.3-.9.4-1 .1-.1.3-.2.4-.2h.3c.1 0 .2 0 .4.3l.5 1.2c.1.1.1.2 0 .3l-.2.3c-.1.1-.2.2-.1.4.1.2.5.8 1 1.2.6.6 1.1.7 1.3.8.2.1.3.1.4-.1l.4-.5c.1-.1.2-.1.4 0l1.1.5c.2.1.3.1.3.2.1.1.1.4 0 .7Z" fill="#ffffff" />
    </svg>
  );
}

export const BRAND_MARKS = {
  gmail: GmailMark,
  messenger: MessengerMark,
  telegram: TelegramMark,
  whatsapp: WhatsappMark,
} as const;
