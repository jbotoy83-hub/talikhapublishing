export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "unknown" | "received";

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface SubmissionEmailContext {
  submissionId: string;
  reference: string;
  title: string;
  journal: string;
  volume: string;
  issue: string;
  submittedAt: string;
  recipients: EmailRecipient[];
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}
