export type SubmissionStatus =
  | "New"
  | "In progress"
  | "Review"
  | "Revise"
  | "For approval"
  | "Rejected"
  | "Accepted"
  | "Scheduled for publishing"
  | "Published";

export type ReviewAuthor = {
  id: string;
  name: string;
  firstName?: string;
  middleInitial?: string;
  surname?: string;
  email: string;
  affiliation: string;
  academicTitle?: string;
  occupation: string;
  orcid?: string;
  photo?: string | null;
  photoFileId?: string;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
};

export type PublicationAuthorMetadata = {
  id?: string;
  position: number;
  firstName: string;
  middleInitial: string;
  surname: string;
  academicTitle: string;
  occupation: string;
  affiliation: string;
  orcid: string;
  corresponding: boolean;
  photoFileId?: string;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
};

export type ReceiptSettings = {
  feeLabel: string;
  fee: number;
  tax: number;
  discount: number;
};

export type EditorialSubmission = {
  id: string;
  reference?: string;
  title: string;
  author: string;
  email: string;
  affiliation: string;
  journal: string;
  status: SubmissionStatus;
  workflowStage?: string;
  submittedAt: string;
  displayDate: string;
  image: string;
  abstract: string;
  fileName: string;
  paymentProof: boolean;
  paymentConfirmed?: boolean;
  paymentId?: string;
  history: string[];
  authors?: ReviewAuthor[];
  receipt?: ReceiptSettings;
  targetIssueId?: string;
  issueHistory?: string[];
  paymentPlan?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentAmount?: number;
  paymentStatus?: string;
  proofFileName?: string;
  proofFilePath?: string;
  proofBucket?: string;
  manuscriptFileName?: string;
  manuscriptFilePath?: string;
  manuscriptBucket?: string;
  preferredJournalId?: string;
  assignedIssueId?: string;
  files?: { id: string; file_kind: string; storage_path: string; storage_bucket?: string; original_name: string; mime_type: string; size_bytes: number; sha256?: string; version_number?: number; supersedes_file_id?: string | null; validation_status?: string }[];
  authorDetails?: { firstName?: string; surname?: string; middleInitial?: string; email?: string; institution?: string; affiliation?: string; academicTitle?: string; position?: string; orcid?: string; location?: string }[];
  proofFileId?: string;
  manuscriptFileId?: string;
  priority?: "normal" | "high" | "urgent";
};

export type PublicationRecord = {
  id: string;
  submissionId: string;
  journal: string;
  journalId?: string;
  issueId?: string;
  publicationId?: string;
  volume: string;
  issue: string;
  doi: string;
  pageStart: string;
  pageEnd: string;
  readCount?: number;
  downloadCount?: number;
  scheduledFor?: string;
  publicTitle?: string;
  publicAbstract?: string;
  keywords?: string[];
  licenseName?: string;
  copyrightHolder?: string;
  citationData?: Record<string, unknown>;
  authorMetadata?: PublicationAuthorMetadata[];
  finalPdfFileId?: string;
  certificateFileId?: string;
  socialMediaFileId?: string;
  publicArticleUrl?: string;
  doiRegistrationStatus?: "assigned" | "reserved" | "registered";
  latestPreflightRunId?: string;
  submittedPreflightRunId?: string;
  status: "Draft" | "For approval" | "Ready to publish" | "Scheduled" | "Published";
};

export type JournalIssueDefault = { volume: string; issue: string };

export type IssueStatus = "Draft" | "Open" | "Editorial" | "Production" | "Scheduled" | "Published" | "Archived";

export type IssueRecord = {
  id: string;
  databaseId?: string;
  journalId: string;
  volume: number;
  issue: number;
  title: string;
  description: string;
  status: IssueStatus;
  isCurrent: boolean;
  isSubmissionTarget: boolean;
  isSpecial: boolean;
  specialLabel: string;
  publicationDate: string;
  submissionDeadline: string;
  editorialStart: string;
  editorialEnd: string;
  openAt: string;
  closeAt: string;
  publishAt: string;
  cover: string;
  articleOrder: string[];
  doi: string;
  keywords: string[];
  seoTitle: string;
  seoDescription: string;
  socialImage: string;
  changelog: string[];
  deleted: boolean;
  createdAt: string;
};

export type JournalMeta = {
  id: string;
  slug?: string;
  title: string;
  abbreviation: string;
  issnOnline: string;
  issnPrint: string;
  publisher: string;
  frequency: string;
  language: string;
  subject: string;
  copyright: string;
  license: string;
  doiPrefix: string;
  seoTitle: string;
  seoDescription: string;
  socialImage: string;
  currentIssueId?: string;
  submissionIssueId?: string;
  deleted: boolean;
};

export type JournalCatalog = { journals: JournalMeta[]; issues: IssueRecord[]; syncedAt: string };

export type SiteJournal = { id: string; slug: string; title: string; description: string; scope: string; issn: string; issnOnline: string; issnPrint: string; hero: string; accent: string; status: string; submissionIssueId?: string; metadata: Record<string, unknown> };

export type SiteIssue = { id: string; journalId: string; volume: string; issue: string; title: string; description: string; status: string; isCurrent: boolean; isSubmissionTarget: boolean; publicationDate: string; cover: string; deleted: boolean; metadata: Record<string, unknown> };

export type SiteStore = { version: number; journals: SiteJournal[]; issues: SiteIssue[] };

export type SubmissionView = "New" | "Needs action" | "Published" | "Closed";

export type PublicationMaterialKind = "final_pdf" | "peer_review" | "publication_certificate";

export type ScheduleTask = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  notes: string;
};

export type UnifiedAuthor = {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  academicTitle?: string;
  orcid?: string;
  source: "staff" | "submission";
  submissionIds: string[];
};

export type AnnouncementSettings = {
  barEnabled: boolean;
  barText: string;
  barLink: string;
  barTone: string;
  popupEnabled: boolean;
  popupTitle: string;
  popupBody: string;
  popupCta: string;
  popupCtaLink: string;
  popupImage: string;
  popupDelay: number;
  popupFrequency: string;
  popupTone: string;
};

export type AuditEventRow = {
  id: string;
  event_type: string;
  actor_email: string;
  created_at: string;
  metadata: Record<string, unknown>;
};
