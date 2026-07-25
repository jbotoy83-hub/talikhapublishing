"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createApa7JournalCitation } from "../../src/lib/apa-citation";
import { FloatingDock } from "./components/floating-dock";
import { CertificateWorkspace } from "./components/certificates/certificate-workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  Award,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Activity,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  ClipboardList,
  Layers,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  Headphones,
  Heart,
  ImageIcon,
  Inbox,
  Landmark,
  LayoutGrid,
  LockKeyhole,
  MapPin,
  MessageSquare,
  MoreVertical,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  Users,
  Video,
  MoreHorizontal,
  Upload,
  Info,
  Lightbulb,
  Globe,
  X,
} from "@/components/icons";
import "@fontsource-variable/newsreader";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./styles.css";

const A = "/assets/";
const portraits = [
  "author-profile-filipino-researcher.webp",
  "author-profile-eagle-researcher.webp",
  "author-profile-tarsier-researcher.webp",
  "author-profile-pawikan-researcher.webp",
  "author-profile-carabao-researcher.webp",
];
const sidebarSections = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", icon: LayoutGrid, index: 0 },
      { label: "Production", icon: FolderOpen, index: 12 },
      { label: "Publishing schedule", icon: CalendarDays, index: 2 },
      { label: "Certificates", icon: Award, index: 10 },
      { label: "Authors", icon: Users, index: 3 },
    ],
  },
  {
    label: "Editorial library",
    items: [
      { label: "Studies & papers", icon: FileText, index: 4 },
      { label: "Journals", icon: BookOpen, index: 11 },
      { label: "Featured", icon: Star, index: 6 },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Announcements", icon: Bell, index: 14 },
      { label: "Media", icon: ImageIcon, index: 13 },
      { label: "Bank & wallets", icon: CreditCard, index: 5 },
      { label: "Reports", icon: FileCheck2, index: 7 },
    ],
  },
];
type SubmissionStatus =
  | "New"
  | "In progress"
  | "Review"
  | "Revise"
  | "For approval"
  | "Rejected"
  | "Accepted"
  | "Scheduled for publishing"
  | "Published";
type ReviewAuthor = {
  id: string;
  name: string;
  firstName?: string;
  middleInitial?: string;
  surname?: string;
  email: string;
  affiliation: string;
  academicTitle?: string;
  occupation: string;
  photo?: string | null;
};
type ReceiptSettings = {
  feeLabel: string;
  fee: number;
  tax: number;
  discount: number;
};
type EditorialSubmission = {
  id: string;
  title: string;
  author: string;
  email: string;
  affiliation: string;
  journal: string;
  status: SubmissionStatus;
  submittedAt: string;
  displayDate: string;
  image: string;
  abstract: string;
  fileName: string;
  paymentProof: boolean;
  paymentConfirmed?: boolean;
  history: string[];
  authors?: ReviewAuthor[];
  receipt?: ReceiptSettings;
  targetIssueId?: string;
  issueHistory?: string[];
};
type PublicationRecord = {
  id: string;
  submissionId: string;
  journal: string;
  volume: string;
  issue: string;
  doi: string;
  pageStart: string;
  pageEnd: string;
  readCount?: number;
  downloadCount?: number;
  scheduledFor?: string;
  status: "Draft" | "For approval" | "Ready to publish" | "Scheduled" | "Published";
};
type JournalIssueDefault = { volume: string; issue: string };
const journalIssueDefaults: Record<string, JournalIssueDefault> = {
  InQuira: { volume: "1", issue: "1" },
  Lumera: { volume: "1", issue: "1" },
};
const normalizeJournal = (journal: string) => journal === "Lumera" ? "Lumera" : "InQuira";
const initialPublicationRecords: PublicationRecord[] = [
  {
    id: "PUB-2026-0001",
    submissionId: "LS-2026-0138",
    journal: "InQuira",
    volume: "1",
    issue: "1",
    doi: "10.0000/talikha.inquira.v1i1.0001",
    pageStart: "1",
    pageEnd: "5",
    readCount: 126,
    downloadCount: 38,
    status: "Published",
  },
  {
    id: "PUB-2026-0002",
    submissionId: "LS-2026-0141",
    journal: "InQuira",
    volume: "1",
    issue: "1",
    doi: "10.0000/talikha.inquira.v1i1.0002",
    pageStart: "6",
    pageEnd: "10",
    readCount: 84,
    downloadCount: 21,
    status: "Published",
  },
  {
    id: "PUB-2026-0003",
    submissionId: "LS-2026-0142",
    journal: "Lumera",
    volume: "1",
    issue: "2",
    doi: "10.0000/talikha.lumera.v1i2.0001",
    pageStart: "1",
    pageEnd: "8",
    scheduledFor: "2026-07-24T09:00",
    status: "Scheduled",
  },
];
const feeOptions = [
  { label: "Literature processing fee", value: 500 },
  { label: "Research processing fee", value: 2500 },
  { label: "Extended research fee", value: 3000 },
  { label: "Publication processing fee", value: 5000 },
];
const defaultReceiptSettings: ReceiptSettings = {
  feeLabel: "Research processing fee",
  fee: 2500,
  tax: 0,
  discount: 0,
};
function authorsFor(submission: EditorialSubmission): ReviewAuthor[] {
  return submission.authors?.length
    ? submission.authors
    : [
        {
          id: `${submission.id}-author-1`,
          name: submission.author,
          email: submission.email,
          affiliation: submission.affiliation,
          academicTitle: "",
          occupation: "Submitting author",
          photo: null,
        },
      ];
}
const initialEditorialSubmissions: EditorialSubmission[] = [
  {
    id: "LS-2026-0142",
    title: "Community Memory and Coastal Resilience in Eastern Samar",
    author: "Elena Marasigan",
    email: "elena.marasigan@example.test",
    affiliation: "Environmental Sciences",
    journal: "InQuira",
    status: "Scheduled for publishing",
    submittedAt: "2026-07-16",
    displayDate: "Jul 16, 2026",
    image: portraits[0],
    abstract:
      "Community-held knowledge, collective memory, and locally led climate adaptation across coastal municipalities.",
    fileName: "coastal-resilience-manuscript.pdf",
    paymentProof: true,
    history: ["Submitted Jul 16, 2026"],
  },
  {
    id: "LS-2026-0141",
    title: "Paglalakbay ng Wika sa Digital na Silid-Aralan",
    author: "Marco Dela Cruz",
    email: "marco.delacruz@example.test",
    affiliation: "Language and Culture",
    journal: "InQuira",
    status: "Published",
    submittedAt: "2026-07-15",
    displayDate: "Jul 15, 2026",
    image: portraits[1],
    abstract:
      "Language movement and identity formation in digitally mediated Filipino classrooms.",
    fileName: "digital-classroom-language.pdf",
    paymentProof: true,
    history: ["Submitted Jul 15, 2026", "Moved to In progress"],
  },
  {
    id: "LS-2026-0138",
    title: "Smallholder Innovation Networks in Northern Luzon",
    author: "Nina Villareal",
    email: "nina.villareal@example.test",
    affiliation: "Agricultural Studies",
    journal: "InQuira",
    status: "Published",
    submittedAt: "2026-07-14",
    displayDate: "Jul 14, 2026",
    image: portraits[2],
    abstract:
      "Informal agricultural knowledge networks and their effects on farm-level innovation.",
    fileName: "smallholder-networks.pdf",
    paymentProof: false,
    history: [
      "Submitted Jul 14, 2026",
      "Moved to In progress",
      "Sent to Review",
    ],
  },
  {
    id: "LS-2026-0132",
    title: "Reframing Heritage Education Through Participatory Archives",
    author: "Alyssa Santos",
    email: "alyssa.santos@example.test",
    affiliation: "Education",
    journal: "Lumera",
    status: "Revise",
    submittedAt: "2026-07-11",
    displayDate: "Jul 11, 2026",
    image: portraits[3],
    abstract:
      "Participatory archives as tools for community-led heritage education and intergenerational learning.",
    fileName: "heritage-education.pdf",
    paymentProof: true,
    history: ["Submitted Jul 11, 2026", "Revision requested"],
  },
];
function Avatar({
  src,
  size = "md",
}: {
  src: string;
  size?: "sm" | "md" | "lg";
}) {
  return <img className={`avatar ${size}`} src={`${A}${src}`} alt="" />;
}
const bankTransactions = [
  {
    name: "Submission LS-2026-0142",
    detail: "Publication processing fee",
    date: "Jul 16 · 4:42 PM",
    amount: "+ ₱2,500.00",
    type: "in",
    status: "Verified",
  },
  {
    name: "Submission LS-2026-0141",
    detail: "Publication processing fee",
    date: "Jul 15 · 2:18 PM",
    amount: "+ ₱2,500.00",
    type: "in",
    status: "Verified",
  },
  {
    name: "Editorial services",
    detail: "Copyediting payout",
    date: "Jul 15 · 10:05 AM",
    amount: "− ₱1,200.00",
    type: "out",
    status: "Completed",
  },
  {
    name: "Submission LS-2026-0138",
    detail: "Payment awaiting match",
    date: "Jul 14 · 5:31 PM",
    amount: "+ ₱2,500.00",
    type: "in",
    status: "Pending",
  },
  {
    name: "Reviewer honorarium",
    detail: "InQuira",
    date: "Jul 12 · 11:20 AM",
    amount: "− ₱1,500.00",
    type: "out",
    status: "Completed",
  },
];
function BankView() {
  const [tab, setTab] = useState("All payments");
  const tx =
    tab === "Incoming"
      ? bankTransactions.filter((x) => x.type === "in")
      : tab === "Payouts"
        ? bankTransactions.filter((x) => x.type === "out")
        : bankTransactions;
  return (
    <section className="bank-page">
      <div className="bank-heading">
        <div>
          <span>Finance preview</span>
          <h1>Bank and wallets</h1>
          <p>
            Review the proposed payment workspace. Every balance and transaction
            shown here is sample data.
          </p>
        </div>
        <div className="bank-sync">
          <RefreshCw />
          <span>
            <strong>Prototype data</strong>Payment provider not connected
          </span>
        </div>
      </div>
      <div className="bank-layout">
        <aside className="wallet-column">
          <div className="wallet-title">
            <h2>Preview wallets</h2>
            <button disabled title="Requires a payment provider">
              <Plus />
              Add wallet
            </button>
          </div>
          <div className="wallet-stack">
            <button className="wallet-card primary selected">
              <header>
                <span>Talikha</span>
                <small>Sample settlement wallet</small>
              </header>
              <CreditCard />
              <strong>•••• 4821</strong>
              <footer>
                <span>Sample balance</span>
                <b>₱84,250.00</b>
              </footer>
            </button>
          </div>
          <div className="balance-card">
            <span>Settlement sample balance</span>
            <strong>₱84,250.00</strong>
            <div>
              <span>
                Currency<b>PHP</b>
              </span>
              <span>
                Integration<b>Not connected</b>
              </span>
            </div>
          </div>
          <div className="bank-actions">
            <button disabled title="Payment provider not connected">
              <ArrowDownLeft />
              Receive
            </button>
            <button disabled title="Payment provider not connected">
              <ArrowUpRight />
              Transfer
            </button>
            <button disabled title="Live statements are unavailable">
              <Download />
              Statement
            </button>
          </div>
          <section className="integration-card">
            <ShieldCheck />
            <div>
              <strong>Payment integration</strong>
              <p>
                Connect a provider later to receive payments and verify webhooks
                securely.
              </p>
            </div>
            <button disabled>Not connected</button>
          </section>
        </aside>
        <div className="bank-main">
          <div className="bank-metrics">
            <article>
              <span>Collected this month</span>
              <strong>₱32,500.00</strong>
              <small>
                <ArrowDownLeft />
                13 verified payments
              </small>
            </article>
            <article>
              <span>Pending reconciliation</span>
              <strong>₱5,000.00</strong>
              <small className="pending">
                <Clock3 />2 transactions
              </small>
            </article>
            <article>
              <span>Scheduled payouts</span>
              <strong>₱8,400.00</strong>
              <small>
                <CalendarDays />
                Next payout Jul 20
              </small>
            </article>
          </div>
          <section className="payments-panel">
            <header>
              <div>
                <h2>Payments and transactions</h2>
                <p>Submission fees and editorial payouts.</p>
              </div>
              <label>
                <Search />
                <input placeholder="Search transactions" />
              </label>
            </header>
            <nav>
              {["All payments", "Incoming", "Payouts"].map((x) => (
                <button
                  className={tab === x ? "active" : ""}
                  onClick={() => setTab(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </nav>
            <div className="transaction-list">
              {tx.map((item) => (
                <div
                  className="transaction-row"
                  key={`${item.name}-${item.date}`}
                >
                  <div className={`transaction-icon ${item.type}`}>
                    {item.type === "in" ? <ArrowDownLeft /> : <ArrowUpRight />}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <time>{item.date}</time>
                  <span
                    className={`transaction-state ${item.status.toLowerCase()}`}
                  >
                    {item.status}
                  </span>
                  <b className={item.type}>{item.amount}</b>
                  <button>
                    <MoreVertical />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <div className="bank-lower">
            <section className="notification-panel">
              <header>
                <h2>Transaction notifications</h2>
                <button>View all</button>
              </header>
              {[
                [
                  "Payment received",
                  "LS-2026-0142 was matched automatically.",
                  "success",
                ],
                [
                  "Reconciliation required",
                  "A payment needs a submission reference.",
                  "warning",
                ],
                [
                  "Payout completed",
                  "Copyediting payout was completed.",
                  "success",
                ],
              ].map(([title, copy, type]) => (
                <div className="bank-notice" key={title}>
                  <i className={type} />
                  <div>
                    <strong>{title}</strong>
                    <span>{copy}</span>
                  </div>
                  <small>Today</small>
                </div>
              ))}
            </section>
            <section className="account-panel">
              <header>
                <h2>Receiving account</h2>
                <Landmark />
              </header>
              <div>
                <span>Account name</span>
                <strong>Talikha Publishing</strong>
              </div>
              <div>
                <span>Bank</span>
                <strong>Connect during integration</strong>
              </div>
              <div>
                <span>Settlement</span>
                <strong>Manual preview</strong>
              </div>
              <button>
                <Settings />
                Manage payment settings
              </button>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
const studyRecords = [
  {
    title: "Community Memory and Coastal Resilience in Eastern Samar",
    author: "Dr. Elena Marasigan",
    journal: "InQuira",
    discipline: "Environmental Studies",
    status: "New",
    date: "2026-07-16",
    displayDate: "Jul 16, 2026",
    reference: "LS-2026-0142",
    file: "2.8 MB",
    summary:
      "Community-held knowledge, collective memory, and locally led climate adaptation across coastal municipalities.",
  },
  {
    title: "Paglalakbay ng Wika sa Digital na Silid-Aralan",
    author: "Marco Luis Dela Cruz",
    journal: "InQuira",
    discipline: "Language and Culture",
    status: "In review",
    date: "2026-07-15",
    displayDate: "Jul 15, 2026",
    reference: "LS-2026-0141",
    file: "1.9 MB",
    summary:
      "Language movement and identity formation in digitally mediated Filipino classrooms.",
  },
  {
    title: "Smallholder Innovation Networks in Northern Luzon",
    author: "Prof. Nina Villareal",
    journal: "InQuira",
    discipline: "Agricultural Studies",
    status: "In review",
    date: "2026-07-14",
    displayDate: "Jul 14, 2026",
    reference: "LS-2026-0138",
    file: "3.4 MB",
    summary:
      "Informal agricultural knowledge networks and their effects on farm-level innovation.",
  },
  {
    title: "Reframing Heritage Education Through Participatory Archives",
    author: "Alyssa Santos",
    journal: "Lumera",
    discipline: "Education",
    status: "Revision",
    date: "2026-07-11",
    displayDate: "Jul 11, 2026",
    reference: "LS-2026-0132",
    file: "2.2 MB",
    summary:
      "Participatory archives as tools for community-led heritage education and intergenerational learning.",
  },
  {
    title: "Public Health Narratives After the Pandemic",
    author: "Dr. Tomas Rivera",
    journal: "InQuira",
    discipline: "Health Sciences",
    status: "Published",
    date: "2026-07-08",
    displayDate: "Jul 8, 2026",
    reference: "LS-2026-0127",
    file: "2.6 MB",
    summary:
      "Public health communication and trust formation in post-pandemic communities.",
  },
  {
    title: "Regional Publishing and the Philippine Knowledge Commons",
    author: "Dr. Isabel Reyes",
    journal: "InQuira",
    discipline: "Social Sciences",
    status: "Revision",
    date: "2026-06-28",
    displayDate: "Jun 28, 2026",
    reference: "LS-2026-0119",
    file: "3.1 MB",
    summary:
      "The role of regional publishing networks in strengthening access to local research.",
  },
];
type IssueStatus = "Draft" | "Open" | "Editorial" | "Production" | "Scheduled" | "Published" | "Archived";
type IssueRecord = {
  id: string;
  journalId: string;
  volume: number;
  issue: number;
  title: string;
  description: string;
  status: IssueStatus;
  isCurrent: boolean;
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
type JournalMeta = {
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
  deleted: boolean;
};
type JournalCatalog = { journals: JournalMeta[]; issues: IssueRecord[]; syncedAt: string };
const JOURNAL_CATALOG_KEY = "talikha-journal-catalog-v2";
const ISSUE_STATUS_ORDER: IssueStatus[] = ["Draft", "Open", "Editorial", "Production", "Scheduled", "Published", "Archived"];
const ISSUE_STATUS_META: Record<IssueStatus, { label: string; tone: string; note: string }> = {
  Draft: { label: "Draft", tone: "tp-pill--neutral", note: "Not yet visible" },
  Open: { label: "Open for submissions", tone: "tp-pill--green", note: "Accepting manuscripts" },
  Editorial: { label: "In editorial", tone: "tp-pill--amber", note: "Under review" },
  Production: { label: "In production", tone: "tp-pill--amber", note: "Being prepared" },
  Scheduled: { label: "Scheduled", tone: "tp-pill--blue", note: "Queued to publish" },
  Published: { label: "Published", tone: "tp-pill--green", note: "Live on the site" },
  Archived: { label: "Archived", tone: "tp-pill--neutral", note: "Closed, read-only" },
};
const jwUid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const jwToday = () => new Date().toISOString().slice(0, 10);
const jwStamp = () => new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const jwFmtDate = (value: string) => (value ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.length <= 10 ? value + "T00:00:00" : value}`)) : "—");
const jwProductionPercent = (status: IssueStatus) => ({ Draft: 8, Open: 18, Editorial: 42, Production: 74, Scheduled: 92, Published: 100, Archived: 100 }[status]);
const jwEmptyIssue = (journalId: string, volume: number, issue: number): IssueRecord => ({
  id: jwUid("ISS"), journalId, volume, issue, title: "", description: "", status: "Draft", isCurrent: false,
  isSpecial: false, specialLabel: "", publicationDate: "", submissionDeadline: "", editorialStart: "", editorialEnd: "",
  openAt: "", closeAt: "", publishAt: "", cover: "", articleOrder: [], doi: "", keywords: [], seoTitle: "",
  seoDescription: "", socialImage: "", changelog: [`Created ${jwStamp()}`], deleted: false, createdAt: new Date().toISOString(),
});
const jwEmptyJournal = (): JournalMeta => ({
  id: jwUid("JRN"), title: "", abbreviation: "", issnOnline: "", issnPrint: "", publisher: "Talikha Publishing",
  frequency: "Quarterly", language: "English", subject: "", copyright: "© Talikha Publishing", license: "CC BY 4.0",
  doiPrefix: "", seoTitle: "", seoDescription: "", socialImage: "", deleted: false,
});
function jwSeedCatalog(): JournalCatalog {
  const journals: JournalMeta[] = [
    { id: "jrn-inquira", title: "InQuira", abbreviation: "Inq.", issnOnline: "3000-0001", issnPrint: "3000-0002", publisher: "Talikha Publishing", frequency: "Quarterly", language: "English", subject: "Inquiry & social science", copyright: "© Talikha Publishing", license: "CC BY 4.0", doiPrefix: "10.0000/talikha.inquira", seoTitle: "InQuira — Talikha Publishing", seoDescription: "A journal of inquiry and social research.", socialImage: "", deleted: false },
    { id: "jrn-lumera", title: "Lumera", abbreviation: "Lum.", issnOnline: "3000-0011", issnPrint: "3000-0012", publisher: "Talikha Publishing", frequency: "Biannual", language: "English", subject: "Creative & literary studies", copyright: "© Talikha Publishing", license: "CC BY 4.0", doiPrefix: "10.0000/talikha.lumera", seoTitle: "Lumera — Talikha Publishing", seoDescription: "A journal of creative and literary work.", socialImage: "", deleted: false },
  ];
  const seedArticles = (journalTitle: string) => initialPublicationRecords.filter((r) => r.journal === journalTitle).map((r) => r.submissionId);
  const issues: IssueRecord[] = [
    { ...jwEmptyIssue("jrn-inquira", 1, 1), title: "Inaugural issue", status: "Published", isCurrent: true, publicationDate: "2026-03-15", submissionDeadline: "2026-01-31", cover: "journal-academic-frontiers-hero.jpg", articleOrder: seedArticles("InQuira"), doi: "10.0000/talikha.inquira.v1i1", changelog: ["Seeded as published current issue"] },
    { ...jwEmptyIssue("jrn-inquira", 1, 2), title: "Spring cycle", status: "Editorial", publicationDate: "2026-09-30", submissionDeadline: "2026-07-15", changelog: ["Seeded in editorial"] },
    { ...jwEmptyIssue("jrn-lumera", 1, 1), title: "First light", status: "Published", isCurrent: true, publicationDate: "2026-04-20", submissionDeadline: "2026-02-28", cover: "journal-academic-frontiers-hero.jpg", articleOrder: seedArticles("Lumera"), doi: "10.0000/talikha.lumera.v1i1", changelog: ["Seeded as published current issue"] },
  ];
  return { journals, issues, syncedAt: new Date().toISOString() };
}
type SiteJournal = { id: string; slug: string; title: string; description: string; scope: string; issn: string; hero: string; accent: string; status: string };
type SiteIssue = { id: string; journalId: string; volume: string; issue: string; title: string; description: string; status: string; isCurrent: boolean; publicationDate: string; cover: string; deleted: boolean };
type SiteStore = { version: number; journals: SiteJournal[]; issues: SiteIssue[] };
const jwSluggify: (v: string) => string = (value) => { const out = (value || "journal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); return out || "journal"; };
function projectCatalogForSite(catalog: JournalCatalog): SiteStore {
  const journals: SiteJournal[] = [];
  const issues: SiteIssue[] = [];
for (const j of catalog.journals) {
  if (j.deleted) continue;
  const slug = j.slug || jwSluggify(j.title);
  const cur = catalog.issues.find((i) => i.journalId === j.id && !i.deleted && i.isCurrent) || catalog.issues.find((i) => i.journalId === j.id && !i.deleted);
  const rawCover = cur && cur.cover ? cur.cover : "";
  const isAbs = rawCover.charAt(0) === "/" || rawCover.indexOf("data:") === 0 || rawCover.indexOf("http:") === 0 || rawCover.indexOf("https:") === 0;
  const hero = rawCover ? (isAbs ? rawCover : "/assets/" + rawCover) : "/assets/journal-academic-frontiers-hero.jpg";
  journals.push({ id: j.id, slug: slug, title: j.title, description: j.seoDescription || "", scope: j.subject || "", issn: j.issnOnline || "", hero: hero, accent: "emerald", status: "published" });
}
for (const i of catalog.issues) {
  if (i.deleted) continue;
  issues.push({ id: i.id, journalId: i.journalId, volume: String(i.volume), issue: String(i.issue), title: i.title || "", description: i.description || "", status: String(i.status || "draft").toLowerCase(), isCurrent: !!i.isCurrent, publicationDate: i.publicationDate || "", cover: i.cover || "", deleted: false });
}
return { version: 1, journals: journals, issues: issues };
}
function publishCatalogToSite(catalog: JournalCatalog): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const body = projectCatalogForSite(catalog);
  return fetch("/api/journal-store", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => { if (!r.ok) { console.error("[journal-store] publish failed", r.status); return false; } return true; })
    .catch((e) => { console.error("[journal-store] publish error", e); return false; });
}
function jwLoadCatalog(): JournalCatalog {
  if (typeof window === "undefined") return jwSeedCatalog();
  try {
    const raw = window.localStorage.getItem(JOURNAL_CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as JournalCatalog;
      if (parsed && Array.isArray(parsed.journals) && Array.isArray(parsed.issues)) return parsed;
    }
  } catch { /* fall through to seed */ }
  return jwSeedCatalog();
}
let JOURNAL_CATALOG: JournalCatalog = jwLoadCatalog();
function getJournalCatalog(): JournalCatalog { return JOURNAL_CATALOG; }
function saveJournalCatalog(next: JournalCatalog): void {
  JOURNAL_CATALOG = next;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(JOURNAL_CATALOG_KEY, JSON.stringify(next)); } catch { /* quota — surfaced via sync banner */ }
    window.dispatchEvent(new CustomEvent("talikha:catalog"));
  }
}
function jwNextNumber(catalog: JournalCatalog, journalId: string): { volume: number; issue: number } {
  const live = catalog.issues.filter((i) => i.journalId === journalId && !i.deleted);
  if (!live.length) return { volume: 1, issue: 1 };
  const maxVol = Math.max(...live.map((i) => i.volume));
  const inVol = live.filter((i) => i.volume === maxVol);
  const maxIssue = Math.max(...inVol.map((i) => i.issue));
  return { volume: maxVol, issue: maxIssue + 1 };
}
function jwCloneIssue(catalog: JournalCatalog, source: IssueRecord): IssueRecord {
  const next = jwNextNumber(catalog, source.journalId);
  return { ...jwEmptyIssue(source.journalId, next.volume, next.issue), title: source.title ? `${source.title} (copy)` : "", description: source.description, isSpecial: source.isSpecial, specialLabel: source.specialLabel, keywords: [...source.keywords], seoTitle: source.seoTitle, seoDescription: source.seoDescription, changelog: [`Duplicated from Vol ${source.volume} Issue ${source.issue} on ${jwStamp()}`] };
}
function jwValidateIssue(catalog: JournalCatalog, issue: IssueRecord): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const journal = catalog.journals.find((j) => j.id === issue.journalId);
  if (!issue.title.trim()) blocking.push("Issue title is required.");
  if (!journal) blocking.push("The parent journal is missing.");
  const dup = catalog.issues.find((i) => i.id !== issue.id && i.journalId === issue.journalId && !i.deleted && i.volume === issue.volume && i.issue === issue.issue);
  if (dup) blocking.push(`Volume ${issue.volume}, Issue ${issue.issue} already exists for this journal.`);
  if (issue.publicationDate && issue.submissionDeadline && issue.submissionDeadline > issue.publicationDate) warnings.push("Submission deadline is after the publication date.");
  const maxIssue = Math.max(0, ...catalog.issues.filter((i) => i.journalId === issue.journalId && !i.deleted && i.volume === issue.volume && i.id !== issue.id).map((i) => i.issue));
  if (maxIssue && issue.issue > maxIssue + 1) warnings.push(`Issue number skips the sequence (expected ${maxIssue + 1}).`);
  const orderSet = new Set(issue.articleOrder);
  if (orderSet.size !== issue.articleOrder.length) blocking.push("An article is assigned twice within this issue.");
  for (const sid of issue.articleOrder) {
    const elsewhere = catalog.issues.find((i) => i.id !== issue.id && !i.deleted && i.status === "Published" && i.articleOrder.includes(sid));
    if (elsewhere) blocking.push(`An assigned article is also published in Vol ${elsewhere.volume} Issue ${elsewhere.issue}.`);
  }
  if (issue.status === "Published" || issue.status === "Scheduled") {
    if (!issue.cover) blocking.push("A cover image is required before publishing.");
    if (!issue.publicationDate) blocking.push("A publication date is required before publishing.");
    if (!journal?.issnOnline && !journal?.issnPrint) warnings.push("Add an ISSN to the journal metadata for citation quality.");
  }
  return { blocking, warnings };
}
function jwCoverSrc(cover: string): string {
  if (!cover) return "";
  return cover.startsWith("data:") ? cover : `${A}${cover}`;
}

function jwCurrentForTitle(title: string): { volume: string; issue: string } | null {
  const jid = JOURNAL_CATALOG.journals.find((j) => j.title === title && !j.deleted)?.id;
  if (!jid) return null;
  const i = JOURNAL_CATALOG.issues.find((x) => x.journalId === jid && !x.deleted && x.isCurrent) || JOURNAL_CATALOG.issues.find((x) => x.journalId === jid && !x.deleted);
  return i ? { volume: String(i.volume), issue: String(i.issue) } : null;
}
function JwField({ label, value, onChange, type = "text", placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string }) {
  return (
    <label className="jw-field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <em>{hint}</em>}
    </label>
  );
}
function JwArea({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <label className="jw-field">
      <span>{label}</span>
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function JwToggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" className={checked ? "jw-toggle is-on" : "jw-toggle"} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="jw-toggle__track"><i /></span>
      <span className="jw-toggle__text"><strong>{label}</strong>{hint && <em>{hint}</em>}</span>
    </button>
  );
}
function JournalsView({ submissions, publicationRecords, onOpenSubmission, onUpdate, onPublicationRecordsChange }: { submissions: EditorialSubmission[]; publicationRecords: PublicationRecord[]; onOpenSubmission: (id: string) => void; onUpdate: (s: EditorialSubmission) => void; onPublicationRecordsChange: (r: PublicationRecord[]) => void }) {
  const [catalog, setCatalog] = useState<JournalCatalog>(() => getJournalCatalog());
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(getJournalCatalog()));
  const [selJournal, setSelJournal] = useState<string>(() => getJournalCatalog().journals.find((j) => !j.deleted)?.id || "");
  const [selIssue, setSelIssue] = useState<string>("");
  const [tab, setTab] = useState<"details" | "metadata" | "cover" | "articles" | "preview" | "history">("details");
  const [journalDrawer, setJournalDrawer] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [confirm, setConfirm] = useState<{ title: string; msg: string; onYes: () => void } | null>(null);
  const [search, setSearch] = useState("");
  const [coverMsg, setCoverMsg] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [syncState, setSyncState] = useState<"idle" | "publishing" | "synced" | "failed">("idle");
  const [addIssueOpen, setAddIssueOpen] = useState(false);
  const [addIssueTarget, setAddIssueTarget] = useState<string>("");
  const [collapsedJournals, setCollapsedJournals] = useState<Set<string>>(new Set());
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const dirty = JSON.stringify(catalog) !== savedSnapshot;
  const journals = catalog.journals.filter((j) => !j.deleted);
  const journalById = (id: string) => catalog.journals.find((j) => j.id === id);
  const titleToId: Record<string, string> = {};
  catalog.journals.forEach((j) => { titleToId[j.title] = j.id; });
  const currentIssueByJournal: Record<string, string> = {};
  catalog.issues.forEach((i) => { if (!i.deleted && i.isCurrent) currentIssueByJournal[i.journalId] = i.id; });
  const effectiveTarget = (sub: EditorialSubmission): string | null => {
    const t = sub.targetIssueId;
    if (t === "UNASSIGNED") return "UNASSIGNED";
    if (t) return t;
    return currentIssueByJournal[titleToId[sub.journal]] || null;
  };
  const subById = (id: string) => submissions.find((s) => s.id === id);
  const commit = (next: JournalCatalog) => setCatalog(next);
  const save = () => {
    const next = { ...catalog, journals: catalog.journals.map((j) => (j.slug ? j : { ...j, slug: jwSluggify(j.title) })) };
    commit(next);
    saveJournalCatalog(next);
    setSavedSnapshot(JSON.stringify(next));
    setSyncState("publishing");
    publishCatalogToSite(next).then((ok) => {
      setSyncState(ok ? "synced" : "failed");
      if (ok) setTimeout(() => setSyncState("idle"), 4000);
    });
  };
  const patchJournal = (id: string, partial: Partial<JournalMeta>) => commit({ ...catalog, journals: catalog.journals.map((j) => (j.id === id ? { ...j, ...partial } : j)) });
  const patchIssue = (id: string, fn: (i: IssueRecord) => IssueRecord) => commit({ ...catalog, issues: catalog.issues.map((i) => (i.id === id ? fn(i) : i)) });
  const issue = catalog.issues.find((i) => i.id === selIssue) || null;
  const issueJournal = issue ? journalById(issue.journalId) : null;
  const validation = issue ? jwValidateIssue(catalog, issue) : { blocking: [], warnings: [] };
  const addJournal = () => { const j = jwEmptyJournal(); j.title = "New journal"; commit({ ...catalog, journals: [...catalog.journals, j] }); setSelJournal(j.id); setJournalDrawer(j.id); };
  const addIssue = (journalId: string, volume?: number) => {
    const next = volume ? { volume, issue: 1 } : jwNextNumber(catalog, journalId);
    const i = jwEmptyIssue(journalId, next.volume, next.issue);
    commit({ ...catalog, issues: [...catalog.issues, i] });
    setSelIssue(i.id); setSelJournal(journalId); setTab("details");
  };
  const duplicateIssue = (src: IssueRecord) => { const clone = jwCloneIssue(catalog, src); commit({ ...catalog, issues: [...catalog.issues, clone] }); setSelIssue(clone.id); };
  const softDeleteIssue = (i: IssueRecord) => {
    const hasRecords = publicationRecords.some((r) => r.journal === journalById(i.journalId)?.title && String(r.volume) === String(i.volume) && String(r.issue) === String(i.issue));
    if (hasRecords) { setConfirm({ title: "Cannot delete", msg: "This issue has published records attached. Archive it instead to keep citation history intact.", onYes: () => setConfirm(null) }); return; }
    setConfirm({ title: "Archive this issue?", msg: `Vol ${i.volume} · Issue ${i.issue} will be hidden from the default workspace. You can recover it from archived issues.`, onYes: () => { patchIssue(i.id, (x) => ({ ...x, deleted: true, changelog: [...x.changelog, `Archived (soft delete) ${jwStamp()}`] })); if (selIssue === i.id) setSelIssue(""); setConfirm(null); } });
  };
  const setAsCurrent = (i: IssueRecord) => commit({ ...catalog, issues: catalog.issues.map((x) => (x.journalId === i.journalId && !x.deleted ? { ...x, isCurrent: x.id === i.id, changelog: x.id === i.id ? [...x.changelog, `Set as current issue ${jwStamp()}`] : x.isCurrent ? [...x.changelog, `Current status removed ${jwStamp()}`] : x.changelog } : x)) });
  const setStatus = (i: IssueRecord, next: IssueStatus) => {
    if (next === i.status) return;
    if (next === "Published") {
      const v = jwValidateIssue(catalog, { ...i, status: "Published" });
      if (v.blocking.length) { setConfirm({ title: "Cannot publish yet", msg: v.blocking.join(" "), onYes: () => setConfirm(null) }); return; }
      setConfirm({ title: "Publish this issue?", msg: `Vol ${i.volume} · Issue ${i.issue} becomes the live issue and, if marked current, updates the public homepage, submission cycle and dashboards.${v.warnings.length ? ` Warnings: ${v.warnings.join(" ")}` : ""}`, onYes: () => { patchIssue(i.id, (x) => ({ ...x, status: "Published", changelog: [...x.changelog, `Published ${jwStamp()}`] })); setConfirm(null); } });
      return;
    }
    if (next === "Archived" && i.isCurrent) {
      const fallback = catalog.issues.find((x) => x.journalId === i.journalId && x.id !== i.id && !x.deleted && x.status === "Published");
      patchIssue(i.id, (x) => ({ ...x, status: "Archived", isCurrent: false, changelog: [...x.changelog, `Archived ${jwStamp()}`] }));
      if (fallback) patchIssue(fallback.id, (x) => ({ ...x, isCurrent: true, changelog: [...x.changelog, `Became current after previous issue archived ${jwStamp()}`] }));
      return;
    }
    patchIssue(i.id, (x) => ({ ...x, status: next, changelog: [...x.changelog, `Status → ${ISSUE_STATUS_META[next].label} ${jwStamp()}`] }));
  };
  const unpublish = (i: IssueRecord) => setConfirm({ title: "Unpublish this issue?", msg: "It returns to production and is removed as the current issue; previously published records are untouched.", onYes: () => { const fallback = catalog.issues.find((x) => x.journalId === i.journalId && x.id !== i.id && !x.deleted && x.status === "Published"); commit({ ...catalog, issues: catalog.issues.map((x) => (x.id === i.id ? { ...x, status: "Production" as IssueStatus, isCurrent: false, changelog: [...x.changelog, `Unpublished ${jwStamp()}`] } : x.id === fallback?.id ? { ...x, isCurrent: true, changelog: [...x.changelog, `Restored as current after unpublish ${jwStamp()}`] } : x)) }); setConfirm(null); } });
  const moveSubmission = (sub: EditorialSubmission, target: string, note: string) => onUpdate({ ...sub, targetIssueId: target, issueHistory: [...(sub.issueHistory || []), `${note} ${jwStamp()}`] });
  const acceptToIssue = (sub: EditorialSubmission, i: IssueRecord) => {
    const journalTitle = journalById(i.journalId)?.title || sub.journal;
    if (!publicationRecords.some((r) => r.submissionId === sub.id)) {
      onPublicationRecordsChange([...publicationRecords, { id: `PUB-${sub.id}`, submissionId: sub.id, journal: journalTitle, volume: String(i.volume), issue: String(i.issue), doi: "", pageStart: "", pageEnd: "", status: "Ready to publish" }]);
    }
    onUpdate({ ...sub, targetIssueId: i.id, issueHistory: [...(sub.issueHistory || []), `Accepted into Vol ${i.volume} Issue ${i.issue} ${jwStamp()}`] });
    patchIssue(i.id, (x) => (x.articleOrder.includes(sub.id) ? x : { ...x, articleOrder: [...x.articleOrder, sub.id], changelog: [...x.changelog, `Article assigned: ${sub.title} ${jwStamp()}`] }));
  };
  const reorder = (i: IssueRecord, from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= i.articleOrder.length) return;
    const order = [...i.articleOrder];
    [order[from], order[to]] = [order[to], order[from]];
    patchIssue(i.id, (x) => ({ ...x, articleOrder: order }));
  };
  const assignedFor = (i: IssueRecord) => {
    const title = journalById(i.journalId)?.title;
    const recs = publicationRecords.filter((r) => r.journal === title && String(r.volume) === String(i.volume) && String(r.issue) === String(i.issue));
    const bySub = new Map(recs.map((r) => [r.submissionId, r]));
    const ordered = i.articleOrder.filter((sid) => bySub.has(sid));
    const rest = recs.filter((r) => !i.articleOrder.includes(r.submissionId)).map((r) => r.submissionId);
    return [...ordered, ...rest].map((sid) => { const s = subById(sid); const rec = bySub.get(sid); return s && rec ? { sub: s, rec } : null; }).filter((x): x is { sub: EditorialSubmission; rec: PublicationRecord } => x !== null);
  };
  const targetedFor = (i: IssueRecord) => submissions.filter((s) => {
    if (effectiveTarget(s) !== i.id) return false;
    const title = journalById(i.journalId)?.title;
    return !publicationRecords.some((r) => r.submissionId === s.id && r.journal === title && String(r.volume) === String(i.volume) && String(r.issue) === String(i.issue));
  });
  const pool = submissions.filter((s) => effectiveTarget(s) === "UNASSIGNED");
  const handleCover = (file: File | undefined, i: IssueRecord) => {
    setCoverMsg("");
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { setCoverMsg("Use a PNG, JPG or WebP image."); return; }
    if (file.size > 2 * 1024 * 1024) { setCoverMsg("Cover must be under 2 MB to store safely in this workspace."); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const small = img.naturalWidth < 800 || img.naturalHeight < 1000;
      const reader = new FileReader();
      reader.onload = () => { patchIssue(i.id, (x) => ({ ...x, cover: String(reader.result || ""), changelog: [...x.changelog, `Cover ${file.name} uploaded ${jwStamp()}`] })); setCoverMsg(small ? `Saved. Recommended cover is at least 800×1000 (got ${img.naturalWidth}×${img.naturalHeight}).` : "Cover saved."); URL.revokeObjectURL(url); };
      reader.readAsDataURL(file);
    };
    img.onerror = () => { setCoverMsg("That image could not be read."); URL.revokeObjectURL(url); };
    img.src = url;
  };
  const download = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const exportIssueJson = (i: IssueRecord) => download(JSON.stringify({ issue: i, journal: journalById(i.journalId) }, null, 2), `${journalById(i.journalId)?.abbreviation || "issue"}-v${i.volume}i${i.issue}.json`, "application/json");
  const exportArticlesCsv = (i: IssueRecord) => {
    const rows = assignedFor(i).map(({ sub }) => [sub.title, sub.author, sub.email, sub.status].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    download(["title,author,email,status", ...rows].join("\n"), `${journalById(i.journalId)?.abbreviation || "issue"}-v${i.volume}i${i.issue}-articles.csv`, "text/csv");
  };
  const importCsv = (file: File | undefined) => {
    setImportMsg("");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || "").split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setImportMsg("The file has no data rows."); return; }
      const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const col = (name: string) => head.indexOf(name);
      const journalId = selJournal || journals[0]?.id;
      if (!journalId) { setImportMsg("Select a journal first."); return; }
      const added: IssueRecord[] = [];
      for (let r = 1; r < lines.length; r++) {
        const cells = lines[r].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const vol = Number(cells[col("volume")] || 1) || 1;
        const iss = Number(cells[col("issue")] || 1) || 1;
        const exists = catalog.issues.some((x) => x.journalId === journalId && !x.deleted && x.volume === vol && x.issue === iss);
        if (exists) continue;
        const ni = jwEmptyIssue(journalId, vol, iss);
        ni.title = cells[col("title")] || "";
        ni.publicationDate = cells[col("publicationdate")] || cells[col("date")] || "";
        ni.status = (ISSUE_STATUS_ORDER as string[]).includes((cells[col("status")] || "").toLowerCase()) ? (cells[col("status")].toLowerCase() as IssueStatus) : "Draft";
        ni.changelog = [...ni.changelog, `Imported from CSV ${jwStamp()}`];
        added.push(ni);
      }
      if (!added.length) { setImportMsg("No new issues to import (duplicates skipped)."); return; }
      commit({ ...catalog, issues: [...catalog.issues, ...added] });
      setImportMsg(`Imported ${added.length} issue${added.length === 1 ? "" : "s"}.`);
    };
    reader.readAsText(file);
  };
  const q = search.trim().toLowerCase();
  const railJournals = journals.filter((j) => !q || j.title.toLowerCase().includes(q) || j.abbreviation.toLowerCase().includes(q));
  const activeJournal = journalById(selJournal) || journals[0] || null;
  const treeIssues = (activeJournal ? catalog.issues.filter((i) => i.journalId === activeJournal.id && !i.deleted) : []).filter((i) => !q || `${i.volume} ${i.issue} ${i.title}`.toLowerCase().includes(q));
  const volumes = Array.from(new Set(treeIssues.map((i) => i.volume))).sort((a, b) => b - a);
  const drawerJournal = journalDrawer ? journalById(journalDrawer) : null;
  const previewIssue = previewOpen ? issue : null;
  const previewJournal = previewIssue ? journalById(previewIssue.journalId) : null;
  const toggleJournalCollapse = (id: string) => setCollapsedJournals((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleVolumeExpand = (key: string) => setExpandedVolumes((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const jVolumes = (jid: string) => {
    const jis = catalog.issues.filter((i) => i.journalId === jid && !i.deleted);
    const vols = Array.from(new Set(jis.map((i) => i.volume))).sort((a, b) => a - b);
    return vols.map((vol) => {
      const issues = jis.filter((i) => i.volume === vol).sort((a, b) => a.issue - b.issue);
      const activeIssue = issues.find((i) => i.isCurrent) || issues.find((i) => i.status === "Published") || issues[0] || null;
      const isLive = issues.some((i) => i.status === "Published");
      const lastDate = issues.map((i) => i.publicationDate || i.createdAt).filter(Boolean).sort().pop() || "";
      return { vol, issues, activeIssue, isLive, lastDate };
    });
  };
  const totalVolumes = journals.reduce((s, j) => s + new Set(catalog.issues.filter((i) => i.journalId === j.id && !i.deleted).map((i) => i.volume)).size, 0);
  const totalIssues = catalog.issues.filter((i) => !i.deleted).length;
  const effectiveAddTarget = addIssueTarget || journals[0]?.id || "";
  const issueCompletion = (i: IssueRecord) => {
    const details = !!(i.title.trim() && i.publicationDate);
    const metadata = !!(i.volume && i.issue);
    const cover = !!i.cover;
    const articles = i.articleOrder.length > 0;
    const preview = details && metadata && cover && articles && (i.status === "Published" || i.status === "Scheduled");
    return { details, metadata, cover, articles, preview };
  };
  return (
    <div className="jw">
      {!issue ? (
      <>
      <header className="jw-mast">
        <div>
          <p className="tp-overline">Editorial Library</p>
          <h1 className="jw-title">Journals, volumes &amp; issues</h1>
          <p className="jw-sub">Manage your journals, organize volumes and issues, and control what appears on the public website.</p>
        </div>
        <div className="jw-mast__right">
          <button type="button" className="tp-btn tp-btn--outline" onClick={() => importInputRef.current?.click()}><Upload size={15} strokeWidth={1.9} /> Import CSV</button>
          <div className="jw-splitbtn">
            <button type="button" className="tp-btn tp-btn--solid jw-splitbtn__main" onClick={() => { if (effectiveAddTarget) addIssue(effectiveAddTarget); }}><Plus size={15} strokeWidth={2.2} /> Add issue</button>
            <button type="button" className="tp-btn tp-btn--solid jw-splitbtn__chev" onClick={() => { setAddIssueTarget(effectiveAddTarget); setAddIssueOpen(!addIssueOpen); }} aria-label="Choose journal"><ChevronDown size={14} strokeWidth={2.2} /></button>
            {addIssueOpen && (
              <div className="jw-addpop">
                <p className="jw-addpop__head">Create issue for</p>
                {journals.map((j) => (
                  <button type="button" key={j.id} className={addIssueTarget === j.id ? "jw-addpop__item is-sel" : "jw-addpop__item"} onClick={() => setAddIssueTarget(j.id)}>
                    <span className="jw-addpop__avatar">{j.title.charAt(0).toUpperCase()}</span>
                    <span>{j.title}</span>
                    {addIssueTarget === j.id && <Check size={14} strokeWidth={2.4} />}
                  </button>
                ))}
                <button type="button" className="jw-addpop__create" onClick={() => { if (effectiveAddTarget) { addIssue(effectiveAddTarget); setAddIssueOpen(false); } }}><Plus size={14} strokeWidth={2.2} /> Create issue</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="jw-syncbar">
        <Info size={18} strokeWidth={1.8} className="jw-syncbar__icon" />
        <div className="jw-syncbar__text">
          <p><strong>Workspace source of truth</strong>  Changes saved here update the editorial dashboard and publication defaults immediately. Publishing pushes to the public site through Supabase — connect the backend to enable live public sync.</p>
        </div>
        <a href="#" className="jw-syncbar__link" onClick={(e) => e.preventDefault()}>Learn more <ArrowUpRight size={13} strokeWidth={2} /></a>
        {syncState !== "idle" && (
          <span className={`jw-sync-badge jw-sync-badge--${syncState}`}>
            {syncState === "publishing" && <span className="jw-sync-badge__spin" />}
            {syncState === "synced" && <Check size={12} strokeWidth={2.5} />}
            {syncState === "failed" && <AlertTriangle size={12} strokeWidth={2.5} />}
            {syncState === "publishing" ? "Publishing to site\u2026" : syncState === "synced" ? "Synced to site" : "Sync failed"}
          </span>
        )}
        {dirty && <button type="button" className="tp-btn tp-btn--soft" onClick={save}><Save size={14} strokeWidth={2} /> Save to workspace</button>}
      </div>

      <div className="jw-listbar">
        <label className="jw-search"><Search size={15} strokeWidth={1.9} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search journals, volumes, issues..." aria-label="Search catalog" /></label>
        <div className="jw-stats">
          <div className="jw-stat"><span className="jw-stat__icon jw-stat__icon--green"><BookOpen size={18} strokeWidth={1.8} /></span><div><strong>{journals.length}</strong><em>Journals</em></div></div>
          <div className="jw-stat"><span className="jw-stat__icon jw-stat__icon--purple"><Layers size={18} strokeWidth={1.8} /></span><div><strong>{totalVolumes}</strong><em>Volumes</em></div></div>
          <div className="jw-stat"><span className="jw-stat__icon jw-stat__icon--orange"><FileText size={18} strokeWidth={1.8} /></span><div><strong>{totalIssues}</strong><em>Issues</em></div></div>
          <div className="jw-stat"><span className="jw-stat__icon jw-stat__icon--blue"><Inbox size={18} strokeWidth={1.8} /></span><div><strong>{pool.length}</strong><em>Unassigned</em></div></div>
        </div>
      </div>

      <div className="jw-jlist">
        {railJournals.map((j) => {
          const vols = jVolumes(j.id);
          const isCollapsed = collapsedJournals.has(j.id);
          return (
            <div className="jw-jcard" key={j.id}>
              <div className="jw-jcard__head">
                <div className="jw-jcard__id">
                  <span className="jw-jcard__avatar">{j.title.charAt(0).toUpperCase()}</span>
                  <div>
                    <div className="jw-jcard__name">{j.title} <span className="tp-pill tp-pill--green">Active</span></div>
                    <p className="jw-jcard__subj">{j.subject || j.frequency || "Journal"}</p>
                  </div>
                </div>
                <div className="jw-jcard__acts">
                  <button type="button" className="jw-jcard__more" aria-label={`Edit ${j.title}`} onClick={() => setJournalDrawer(j.id)}><MoreHorizontal size={16} strokeWidth={1.8} /></button>
                  <button type="button" className="jw-jcard__toggle" aria-label={isCollapsed ? "Expand" : "Collapse"} onClick={() => toggleJournalCollapse(j.id)}><ChevronDown size={16} strokeWidth={2} style={isCollapsed ? { transform: "rotate(-90deg)" } : undefined} /></button>
                </div>
              </div>
              {!isCollapsed && (
                <>
                  <table className="jw-jcard__table">
                    <thead><tr><th>Volume</th><th>Issues</th><th>Active Issue</th><th>Public Status</th><th>Last Updated</th><th /></tr></thead>
                    <tbody>
                      {vols.map(({ vol, issues, activeIssue, isLive, lastDate }) => {
                        const vKey = `${j.id}-${vol}`;
                        const vExpanded = expandedVolumes.has(vKey);
                        return (
                          <Fragment key={vol}>
                            <tr className="jw-jcard__vrow">
                              <td><button type="button" className="jw-jcard__vexp" onClick={() => toggleVolumeExpand(vKey)}><ChevronRight size={13} strokeWidth={2} style={vExpanded ? { transform: "rotate(90deg)" } : undefined} /> Volume {vol}</button></td>
                              <td>{issues.length}</td>
                              <td>{activeIssue ? <button type="button" className="jw-jcard__link" onClick={() => { setSelIssue(activeIssue.id); setTab("details"); }}>Issue {activeIssue.issue}</button> : "â€”"}</td>
                              <td><span className={isLive ? "jw-jcard__live" : "jw-jcard__draft"}><i /> {isLive ? "Live" : "Draft"}</span></td>
                              <td>{lastDate ? jwFmtDate(lastDate) : "â€”"}</td>
                              <td><button type="button" className="jw-jcard__vmore" aria-label="Volume actions" onClick={() => addIssue(j.id, vol)}><MoreHorizontal size={14} strokeWidth={1.8} /></button></td>
                            </tr>
                            {vExpanded && issues.map((i) => {
                              const meta = ISSUE_STATUS_META[i.status];
                              return (
                                <tr key={i.id} className="jw-jcard__irow">
                                  <td colSpan={2}><button type="button" className="jw-jcard__ilink" onClick={() => { setSelIssue(i.id); setTab("details"); }}>Issue {i.issue} â€” {i.title || "Untitled"}</button></td>
                                  <td><span className={`tp-pill ${meta.tone}`}>{meta.label}</span></td>
                                  <td>{i.isCurrent ? <span className="jw-jcard__cur">Current</span> : ""}</td>
                                  <td>{jwFmtDate(i.publicationDate)}</td>
                                  <td>
                                    <span className="jw-jcard__iacts">
                                      <button type="button" aria-label="Duplicate" onClick={() => duplicateIssue(i)}><Layers size={12} strokeWidth={1.8} /></button>
                                      <button type="button" aria-label="Archive" onClick={() => softDeleteIssue(i)}><Trash2 size={12} strokeWidth={1.8} /></button>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  <button type="button" className="jw-jcard__addvol" onClick={() => { const maxV = vols.length ? Math.max(...vols.map((v) => v.vol)) : 0; addIssue(j.id, maxV + 1); }}><Plus size={14} strokeWidth={2.2} /> Add volume</button>
                </>
              )}
            </div>
          );
        })}
        {!railJournals.length && <div className="tp-empty-illu"><p>No journals match your search.</p></div>}
      </div>

      <div className="jw-howto">
        <div className="jw-howto__icon"><Lightbulb size={20} strokeWidth={1.8} /></div>
        <div className="jw-howto__body">
          <h3>How it works</h3>
          <div className="jw-howto__steps">
            <div><ClipboardList size={16} strokeWidth={1.8} /><div><strong>Create volumes and issues</strong><em>Organize your journal content.</em></div></div>
            <div><FileText size={16} strokeWidth={1.8} /><div><strong>Add details and content</strong><em>Manage metadata, articles, and cover.</em></div></div>
            <div><Globe size={16} strokeWidth={1.8} /><div><strong>Publish to website</strong><em>Make it live for your readers.</em></div></div>
          </div>
        </div>
      </div>
      </>
      ) : (
      <>
      <div className="jw-idd">
        <button type="button" className="jw-idd__back" onClick={() => setSelIssue("")}><ArrowLeft size={15} strokeWidth={2} /> Back to journals</button>
        {issue && issueJournal && (
          <>
            <div className="jw-idd__head">
              <div>
                <p className="jw-idd__label">Issue details</p>
                <p className="jw-idd__journal">{issueJournal.title}</p>
                <h2 className="jw-idd__title">Volume {issue.volume} &middot; Issue {issue.issue}{issue.isSpecial && issue.specialLabel ? ` â€” ${issue.specialLabel}` : ""} {issue.isCurrent && <span className="tp-pill tp-pill--green">Current issue</span>}</h2>
                <p className="jw-idd__saved"><CheckCircle2 size={14} strokeWidth={1.8} /> {dirty ? "Unsaved changes" : "Saved just now"}</p>
              </div>
              <div className="jw-idd__headacts">
                <button type="button" className="tp-btn tp-btn--outline" onClick={() => setPreviewOpen(true)}><Eye size={14} strokeWidth={1.8} /> Preview</button>
                <button type="button" className="tp-btn tp-btn--outline" onClick={save}><Save size={14} strokeWidth={2} /> Save draft</button>
                <div className="jw-splitbtn">
                  <button type="button" className="tp-btn tp-btn--solid jw-splitbtn__main" onClick={() => setStatus(issue, "Published")}><Globe size={14} strokeWidth={1.8} /> Publish to website</button>
                  <button type="button" className="tp-btn tp-btn--solid jw-splitbtn__chev" aria-label="More publish options"><ChevronDown size={14} strokeWidth={2.2} /></button>
                </div>
              </div>
            </div>

            <div className="jw-idd__status">
              <div className="jw-idd__scard">
                <strong>Workflow stage</strong>
                <em>Control the editorial workflow state for this issue.</em>
                <select className="jw-idd__select" value={issue.status} onChange={(e) => setStatus(issue, e.target.value as IssueStatus)}>
                  {ISSUE_STATUS_ORDER.map((s) => <option key={s} value={s}>{ISSUE_STATUS_META[s].label}</option>)}
                </select>
              </div>
              <div className="jw-idd__scard">
                <strong>Website status</strong>
                <em>Manage how this issue appears on your website.</em>
                <span className={issue.status === "Published" ? "jw-idd__wsbadge is-live" : "jw-idd__wsbadge"}><Globe size={13} strokeWidth={1.8} /> {issue.status === "Published" ? "Live on website" : "Not published"}</span>
              </div>
              <div className="jw-idd__scard">
                <strong>Current issue</strong>
                <em>Mark this as the current active issue.</em>
                <label className="jw-idd__toggle"><input type="checkbox" checked={issue.isCurrent} onChange={() => setAsCurrent(issue)} /><span className="jw-idd__ttrack"><i /></span><em>This is the current active issue</em></label>
              </div>
            </div>

            <div className="jw-syncbar jw-syncbar--compact">
              <Info size={16} strokeWidth={1.8} className="jw-syncbar__icon" />
              <p>Publishing this issue makes it visible on the website and updates the current issue across submissions and the public site.</p>
              <a href="#" className="jw-syncbar__link" onClick={(e) => e.preventDefault()}>Learn more <ArrowUpRight size={12} strokeWidth={2} /></a>
            </div>

            {(validation.blocking.length > 0 || validation.warnings.length > 0) && (
              <div className="jw-valid">
                {validation.blocking.map((m, i) => <p key={`b${i}`} className="jw-valid__err"><CircleX size={14} strokeWidth={1.9} /> {m}</p>)}
                {validation.warnings.map((m, i) => <p key={`w${i}`} className="jw-valid__warn"><AlertTriangle size={14} strokeWidth={1.9} /> {m}</p>)}
              </div>
            )}

            <div className="jw-idd__cols">
              <div className="jw-idd__main">
                <div className="jw-tabs" role="tablist">
                  {(["details", "metadata", "cover", "articles", "preview", "history"] as const).map((t) => (
                    <button type="button" key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>{t === "details" ? "Details" : t === "metadata" ? "Metadata" : t === "cover" ? "Cover" : t === "articles" ? "Articles" : t === "preview" ? "Preview" : "History"}</button>
                  ))}
                </div>

                {tab === "details" && (
                  <div className="jw-pane">
                    <div className="jw-row2">
                      <JwField label="Issue title *" value={issue.title} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, title: v }))} placeholder="e.g. Summer research issue" />
                      <JwArea label="Description" value={issue.description} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, description: v }))} placeholder="A short public summary of this issue." />
                    </div>
                    <div className="jw-row2">
                      <JwField label="Publication date *" type="date" value={issue.publicationDate} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, publicationDate: v }))} />
                      <JwField label="Submission deadline" type="date" value={issue.submissionDeadline} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, submissionDeadline: v }))} />
                    </div>
                    <div className="jw-idd__completion">
                      <div className="jw-idd__completion-head"><strong>Issue completion</strong><em>Keep going! Complete the remaining steps to publish.</em></div>
                      {(() => { const c = issueCompletion(issue); return (
                        <div className="jw-idd__steps">
                          <div className={c.details ? "is-done" : ""}><span>{c.details ? <Check size={12} strokeWidth={3} /> : "1"}</span><div><strong>Details</strong><em>{c.details ? "Completed" : "Pending"}</em></div></div>
                          <div className={c.metadata ? "is-done" : ""}><span>{c.metadata ? <Check size={12} strokeWidth={3} /> : "2"}</span><div><strong>Metadata</strong><em>{c.metadata ? "Completed" : "Pending"}</em></div></div>
                          <div className={c.cover ? "is-done" : ""}><span>{c.cover ? <Check size={12} strokeWidth={3} /> : "3"}</span><div><strong>Cover</strong><em>{c.cover ? "Completed" : "Pending"}</em></div></div>
                          <div className={c.articles ? "is-done" : ""}><span>{c.articles ? <Check size={12} strokeWidth={3} /> : "4"}</span><div><strong>Articles</strong><em>{c.articles ? "Completed" : "Pending"}</em></div></div>
                          <div className={c.preview ? "is-done" : ""}><span>{c.preview ? <Check size={12} strokeWidth={3} /> : <Clock3 size={12} strokeWidth={2} />}</span><div><strong>Website preview</strong><em>{c.preview ? "Completed" : "Pending"}</em></div></div>
                        </div>
                      ); })()}
                    </div>
                    <div className="jw-idd__stats">
                      <div><FileText size={16} strokeWidth={1.8} /><div><strong>{assignedFor(issue).length}</strong><em>Articles</em></div></div>
                      <div><Users size={16} strokeWidth={1.8} /><div><strong>{targetedFor(issue).length}</strong><em>Assigned submissions</em></div></div>
                      <div><CalendarDays size={16} strokeWidth={1.8} /><div><strong>{jwFmtDate(issue.publicationDate)}</strong><em>Publication date</em></div></div>
                      <div><Clock3 size={16} strokeWidth={1.8} /><div><strong>{jwFmtDate(issue.createdAt)}</strong><em>Last updated</em></div></div>
                    </div>
                  </div>
                )}

                {tab === "metadata" && (
                  <div className="jw-pane">
                    <div className="jw-row2">
                      <JwField label="Volume" type="number" value={String(issue.volume)} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, volume: Number(v) || 1 }))} />
                      <JwField label="Issue number" type="number" value={String(issue.issue)} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, issue: Number(v) || 1 }))} />
                    </div>
                    <JwField label="SEO title" value={issue.seoTitle} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, seoTitle: v }))} placeholder={issue.title || issueJournal.seoTitle} />
                    <JwArea label="SEO / meta description" value={issue.seoDescription} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, seoDescription: v }))} placeholder={issueJournal.seoDescription} />
                    <div className="jw-meta-reuse">
                      <strong>Reused journal metadata</strong>
                      <dl>
                        <div><dt>Publisher</dt><dd>{issueJournal.publisher || "â€”"}</dd></div>
                        <div><dt>ISSN Online</dt><dd>{issueJournal.issnOnline || "â€”"}</dd></div>
                        <div><dt>ISSN Print</dt><dd>{issueJournal.issnPrint || "â€”"}</dd></div>
                        <div><dt>Frequency</dt><dd>{issueJournal.frequency || "â€”"}</dd></div>
                        <div><dt>License</dt><dd>{issueJournal.license || "â€”"}</dd></div>
                        <div><dt>Language</dt><dd>{issueJournal.language || "â€”"}</dd></div>
                      </dl>
                      <button type="button" className="tp-link" onClick={() => setJournalDrawer(issueJournal.id)}>Edit journal metadata</button>
                    </div>
                  </div>
                )}

                {tab === "cover" && (
                  <div className="jw-pane">
                    <div className={issue.cover ? "jw-cover has" : "jw-cover"}>
                      {issue.cover ? (
                        <div className="jw-cover__preview"><img src={jwCoverSrc(issue.cover)} alt={`${issue.title || "Issue"} cover`} /></div>
                      ) : (
                        <div className="jw-cover__empty"><ImageIcon size={26} strokeWidth={1.6} /><p>No cover yet â€” a cover is required before publishing.</p></div>
                      )}
                      <div className="jw-cover__controls">
                        <p className="jw-cover__hint">PNG, JPG or WebP Â· under 2 MB Â· recommended 1200Ã—1600 (3:4).</p>
                        <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => handleCover(e.target.files?.[0], issue)} />
                        <div className="jw-cover__btns">
                          <button type="button" className="tp-btn tp-btn--outline" onClick={() => coverInputRef.current?.click()}>{issue.cover ? <RefreshCw size={14} strokeWidth={1.9} /> : <Plus size={14} strokeWidth={2.2} />}{issue.cover ? "Replace cover" : "Upload cover"}</button>
                          {issue.cover && <button type="button" className="tp-btn tp-btn--ghost" onClick={() => { patchIssue(issue.id, (x) => ({ ...x, cover: "", changelog: [...x.changelog, `Cover removed ${jwStamp()}`] })); setCoverMsg(""); }}><Trash2 size={14} strokeWidth={1.8} /> Remove</button>}
                        </div>
                        {coverMsg && <p className={coverMsg.startsWith("Saved") || coverMsg.startsWith("Cover saved") ? "jw-cover__ok" : "jw-cover__err"}>{coverMsg}</p>}
                      </div>
                    </div>
                    <JwField label="Social sharing image (URL or asset)" value={issue.socialImage} onChange={(v) => patchIssue(issue.id, (x) => ({ ...x, socialImage: v }))} placeholder="Optional â€” falls back to the cover" />
                  </div>
                )}

                {tab === "articles" && (
                  <div className="jw-pane">
                    <div className="jw-artsec">
                      <div className="jw-artsec__head"><h3>Assigned â€” final publication order</h3><span>{assignedFor(issue).length} article{assignedFor(issue).length === 1 ? "" : "s"}</span></div>
                      <p className="jw-artsec__note">Final assignment is locked to publication records. Reorder to build the table of contents.</p>
                      {assignedFor(issue).length ? (
                        <ul className="jw-artlist">
                          {assignedFor(issue).map(({ sub, rec }, idx) => (
                            <li key={sub.id}>
                              <span className="jw-artlist__order">{idx + 1}</span>
                              <span className="jw-artlist__text"><strong>{sub.title}</strong><em>{sub.author}</em></span>
                              <span className={`tp-pill ${statusToneClass(sub.status)}`}>{rec.status}</span>
                              <span className="jw-artlist__move">
                                <button type="button" disabled={idx === 0} aria-label="Move up" onClick={() => reorder(issue, idx, -1)}><ChevronDown size={13} strokeWidth={2} style={{ transform: "rotate(180deg)" }} /></button>
                                <button type="button" disabled={idx === assignedFor(issue).length - 1} aria-label="Move down" onClick={() => reorder(issue, idx, 1)}><ChevronDown size={13} strokeWidth={2} /></button>
                              </span>
                              <button type="button" className="jw-artlist__open" onClick={() => onOpenSubmission(sub.id)}>Open</button>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="tp-emptybox"><FileText size={16} strokeWidth={1.8} /> No articles assigned to this issue yet.</div>}
                    </div>
                    <div className="jw-artsec">
                      <div className="jw-artsec__head"><h3>Targeted â€” awaiting acceptance</h3><span>{targetedFor(issue).length}</span></div>
                      <p className="jw-artsec__note">New submissions default to the current issue as a target only. They become final once accepted.</p>
                      {targetedFor(issue).length ? (
                        <ul className="jw-artlist">
                          {targetedFor(issue).map((sub) => (
                            <li key={sub.id}>
                              <span className={`tp-jmark ${journalToneClass(sub.journal)}`} aria-hidden="true">{sub.journal.slice(0, 2)}</span>
                              <span className="jw-artlist__text"><strong>{sub.title}</strong><em>{sub.author} Â· {sub.status}</em></span>
                              <select className="jw-move" defaultValue="" aria-label={`Move ${sub.title}`} onChange={(e) => { const v = e.target.value; if (v === "UNASSIGNED") moveSubmission(sub, "UNASSIGNED", "Moved to the unassigned pool"); else if (v) moveSubmission(sub, v, `Transferred to Vol ${catalog.issues.find((x) => x.id === v)?.volume} Issue ${catalog.issues.find((x) => x.id === v)?.issue}`); e.target.value = ""; }}>
                                <option value="">Move toâ€¦</option>
                                <option value="UNASSIGNED">Unassigned pool</option>
                                {catalog.issues.filter((x) => x.id !== issue.id && !x.deleted).map((x) => <option key={x.id} value={x.id}>{journalById(x.journalId)?.title} Â· Vol {x.volume} Issue {x.issue}</option>)}
                              </select>
                              <button type="button" className="tp-btn tp-btn--soft" onClick={() => acceptToIssue(sub, issue)}><Check size={13} strokeWidth={2.4} /> Accept</button>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="tp-emptybox"><Inbox size={16} strokeWidth={1.8} /> No manuscripts targeted to this issue.</div>}
                    </div>
                    {pool.length > 0 && (
                      <div className="jw-artsec">
                        <div className="jw-artsec__head"><h3>Unassigned pool</h3><span>{pool.length}</span></div>
                        <ul className="jw-artlist">
                          {pool.slice(0, 6).map((sub) => (
                            <li key={sub.id}>
                              <span className={`tp-jmark ${journalToneClass(sub.journal)}`} aria-hidden="true">{sub.journal.slice(0, 2)}</span>
                              <span className="jw-artlist__text"><strong>{sub.title}</strong><em>{sub.author}</em></span>
                              <button type="button" className="tp-btn tp-btn--soft" onClick={() => moveSubmission(sub, issue.id, `Assigned target Vol ${issue.volume} Issue ${issue.issue}`)}>Target here</button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {tab === "preview" && (
                  <div className="jw-pane">
                    <div className="jw-inline-preview">
                      <div className="jw-inline-preview__bar"><span>Public issue page</span><em>{issueJournal.title}</em></div>
                      <div className="jw-inline-preview__body">
                        {issue.cover ? <img src={jwCoverSrc(issue.cover)} alt="" /> : <div className="jw-inline-preview__nocover"><ImageIcon size={20} strokeWidth={1.6} /></div>}
                        <div>
                          <p className="tp-overline">{issue.isSpecial && issue.specialLabel ? issue.specialLabel : "Current issue"}</p>
                          <h3>{issue.title || "Untitled issue"}</h3>
                          <p className="jw-inline-preview__vol">Volume {issue.volume} Â· Issue {issue.issue} Â· {jwFmtDate(issue.publicationDate)}</p>
                          <p className="jw-inline-preview__desc">{issue.description || "No description provided yet."}</p>
                        </div>
                      </div>
                      <h4>Table of contents</h4>
                      {assignedFor(issue).length ? <ol className="jw-toc">{assignedFor(issue).map(({ sub }, idx) => <li key={sub.id}><b>{idx + 1}</b><span><strong>{sub.title}</strong><em>{sub.author}</em></span></li>)}</ol> : <p className="jw-inline-preview__empty">No articles arranged yet.</p>}
                    </div>
                    <button type="button" className="tp-btn tp-btn--outline tp-w-full" onClick={() => setPreviewOpen(true)}><Eye size={14} strokeWidth={1.8} /> Open full preview</button>
                  </div>
                )}

                {tab === "history" && (
                  <div className="jw-pane">
                    <ul className="jw-history">
                      {[...issue.changelog].reverse().map((entry, i) => <li key={i}><i aria-hidden="true" /><span>{entry}</span></li>)}
                    </ul>
                    {!issue.changelog.length && <div className="tp-emptybox"><Clock3 size={16} strokeWidth={1.8} /> No changes recorded yet.</div>}
                  </div>
                )}
              </div>

              <aside className="jw-idd__side">
                <div className="jw-idd__overview">
                  <h3>Issue overview</h3>
                  <div className="jw-idd__orow"><FileText size={16} strokeWidth={1.8} /><div><strong>{assignedFor(issue).length}</strong><em>Articles</em></div></div>
                  <div className="jw-idd__orow"><Users size={16} strokeWidth={1.8} /><div><strong>{targetedFor(issue).length}</strong><em>Assigned submissions</em></div></div>
                  <div className="jw-idd__orow"><CalendarDays size={16} strokeWidth={1.8} /><div><strong>{jwFmtDate(issue.publicationDate || issue.createdAt)}</strong><em>Last updated</em></div></div>
                </div>
                <div className="jw-idd__covercard">
                  <h3>Issue cover</h3>
                  {issue.cover ? (
                    <div className="jw-idd__coverprev">
                      <img src={jwCoverSrc(issue.cover)} alt="Cover" />
                      <div>
                        <p className="jw-idd__covername">cover.jpg</p>
                        <p className="jw-idd__coversize">JPG</p>
                        <div className="jw-idd__coverbtns">
                          <button type="button" className="tp-btn tp-btn--outline" onClick={() => coverInputRef.current?.click()}><Upload size={13} strokeWidth={1.9} /> Change cover</button>
                          <button type="button" className="tp-btn tp-btn--ghost" onClick={() => { patchIssue(issue.id, (x) => ({ ...x, cover: "", changelog: [...x.changelog, `Cover removed ${jwStamp()}`] })); setCoverMsg(""); }}><Trash2 size={13} strokeWidth={1.8} /></button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="jw-idd__nocover">
                      <ImageIcon size={20} strokeWidth={1.6} />
                      <p>No cover uploaded</p>
                      <button type="button" className="tp-btn tp-btn--outline" onClick={() => coverInputRef.current?.click()}><Upload size={13} strokeWidth={1.9} /> Upload cover</button>
                    </div>
                  )}
                </div>
                <div className="jw-idd__syscard">
                  <h3>Systems &amp; visibility</h3>
                  <div className="jw-idd__sysrow"><Globe size={15} strokeWidth={1.8} /><div><strong>Website</strong> <span className={issue.status === "Published" ? "tp-pill tp-pill--green" : "tp-pill tp-pill--neutral"}>{issue.status === "Published" ? "Live" : "Draft"}</span><em>This issue is {issue.status === "Published" ? "visible" : "not visible"} on your website.</em></div><ChevronRight size={14} strokeWidth={2} /></div>
                  <div className="jw-idd__sysrow"><Users size={15} strokeWidth={1.8} /><div><strong>Submissions</strong> <span className="tp-pill tp-pill--green">Following</span><em>New submissions will follow this issue.</em></div><ChevronRight size={14} strokeWidth={2} /></div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
      </>
      )}

      {drawerJournal && (
        <>
          <button type="button" className="jw-scrim" aria-label="Close journal editor" onClick={() => setJournalDrawer(null)} />
          <aside className="jw-drawer" role="dialog" aria-label={`Edit ${drawerJournal.title}`}>
            <header className="jw-drawer__head">
              <div><p className="tp-overline">Journal metadata</p><h2>{drawerJournal.title || "New journal"}</h2></div>
              <button type="button" className="jw-drawer__close" aria-label="Close" onClick={() => setJournalDrawer(null)}><X size={16} strokeWidth={2} /></button>
            </header>
            <div className="jw-drawer__body">
              <JwField label="Journal title" value={drawerJournal.title} onChange={(v) => patchJournal(drawerJournal.id, { title: v })} />
              <div className="jw-row2">
                <JwField label="Abbreviation" value={drawerJournal.abbreviation} onChange={(v) => patchJournal(drawerJournal.id, { abbreviation: v })} />
                <JwField label="Publication frequency" value={drawerJournal.frequency} onChange={(v) => patchJournal(drawerJournal.id, { frequency: v })} placeholder="Quarterly" />
              </div>
              <div className="jw-row2">
                <JwField label="ISSN Online" value={drawerJournal.issnOnline} onChange={(v) => patchJournal(drawerJournal.id, { issnOnline: v })} />
                <JwField label="ISSN Print" value={drawerJournal.issnPrint} onChange={(v) => patchJournal(drawerJournal.id, { issnPrint: v })} />
              </div>
              <JwField label="Publisher" value={drawerJournal.publisher} onChange={(v) => patchJournal(drawerJournal.id, { publisher: v })} />
              <div className="jw-row2">
                <JwField label="Subject area" value={drawerJournal.subject} onChange={(v) => patchJournal(drawerJournal.id, { subject: v })} />
                <JwField label="Language" value={drawerJournal.language} onChange={(v) => patchJournal(drawerJournal.id, { language: v })} />
              </div>
              <JwField label="DOI prefix" value={drawerJournal.doiPrefix} onChange={(v) => patchJournal(drawerJournal.id, { doiPrefix: v })} placeholder="10.0000/talikha.example" />
              <JwField label="License" value={drawerJournal.license} onChange={(v) => patchJournal(drawerJournal.id, { license: v })} />
              <JwArea label="Copyright statement" value={drawerJournal.copyright} onChange={(v) => patchJournal(drawerJournal.id, { copyright: v })} rows={2} />
              <JwField label="SEO title" value={drawerJournal.seoTitle} onChange={(v) => patchJournal(drawerJournal.id, { seoTitle: v })} />
              <JwArea label="SEO description" value={drawerJournal.seoDescription} onChange={(v) => patchJournal(drawerJournal.id, { seoDescription: v })} rows={2} />
            </div>
            <footer className="jw-drawer__foot">
              <button type="button" className="tp-btn tp-btn--ghost" onClick={() => setConfirm({ title: "Archive this journal?", msg: `${drawerJournal.title} and its issues will be hidden. Published records remain intact.`, onYes: () => { patchJournal(drawerJournal.id, { deleted: true }); if (selJournal === drawerJournal.id) setSelJournal(journals.find((j) => j.id !== drawerJournal.id)?.id || ""); setJournalDrawer(null); setConfirm(null); } })}><Trash2 size={14} strokeWidth={1.8} /> Archive journal</button>
              <button type="button" className="tp-btn tp-btn--solid" onClick={() => { save(); setJournalDrawer(null); }}><Save size={14} strokeWidth={2} /> Save &amp; close</button>
            </footer>
          </aside>
        </>
      )}

      {previewIssue && previewJournal && (
        <>
          <button type="button" className="jw-scrim" aria-label="Close preview" onClick={() => setPreviewOpen(false)} />
          <div className="jw-preview" role="dialog" aria-label="Issue preview">
            <header className="jw-preview__head">
              <div><p className="tp-overline">Preview · public site</p><h2>{previewJournal.title} — Vol {previewIssue.volume} Issue {previewIssue.issue}</h2></div>
              <div className="jw-preview__modes">
                <button type="button" className={previewMode === "desktop" ? "is-on" : ""} onClick={() => setPreviewMode("desktop")}>Desktop</button>
                <button type="button" className={previewMode === "mobile" ? "is-on" : ""} onClick={() => setPreviewMode("mobile")}>Mobile</button>
                <button type="button" className="jw-drawer__close" aria-label="Close preview" onClick={() => setPreviewOpen(false)}><X size={16} strokeWidth={2} /></button>
              </div>
            </header>
            <div className="jw-preview__stage">
              <div className={previewMode === "mobile" ? "jw-preview__frame is-mobile" : "jw-preview__frame"}>
                <div className="jw-preview__nav"><span className="jw-preview__brand">{previewJournal.abbreviation || previewJournal.title}</span><span>Current issue</span><span>Archive</span><span>Submit</span></div>
                <div className="jw-preview__hero">
                  {previewIssue.cover ? <img src={jwCoverSrc(previewIssue.cover)} alt="" /> : <div className="jw-preview__nocover"><ImageIcon size={28} strokeWidth={1.5} /></div>}
                  <div>
                    <p className="tp-overline">{previewIssue.isSpecial && previewIssue.specialLabel ? previewIssue.specialLabel : previewIssue.isCurrent ? "Current issue" : ISSUE_STATUS_META[previewIssue.status].label}</p>
                    <h3>{previewIssue.title || "Untitled issue"}</h3>
                    <p className="jw-preview__vol">Volume {previewIssue.volume} · Issue {previewIssue.issue} · {jwFmtDate(previewIssue.publicationDate)}</p>
                    <p className="jw-preview__desc">{previewIssue.description || "No description provided yet."}</p>
                    <div className="jw-preview__cycle">{previewIssue.submissionDeadline ? `Submissions close ${jwFmtDate(previewIssue.submissionDeadline)}` : previewIssue.status === "Open" ? "Open for submissions" : "Submissions closed"}</div>
                  </div>
                </div>
                <h4>Articles</h4>
                {assignedFor(previewIssue).length ? <ol className="jw-toc">{assignedFor(previewIssue).map(({ sub }, idx) => <li key={sub.id}><b>{idx + 1}</b><span><strong>{sub.title}</strong><em>{sub.author} · {sub.affiliation}</em></span></li>)}</ol> : <p className="jw-preview__empty">No articles arranged yet.</p>}
                <div className="jw-preview__meta">
                  <span>ISSN {previewJournal.issnOnline || "—"}</span><span>{previewJournal.publisher}</span><span>{previewJournal.license}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {confirm && (
        <>
          <button type="button" className="jw-scrim" aria-label="Dismiss" onClick={() => setConfirm(null)} />
          <div className="jw-confirm" role="alertdialog" aria-label={confirm.title}>
            <h3>{confirm.title}</h3>
            <p>{confirm.msg}</p>
            <div className="jw-confirm__acts">
              <button type="button" className="tp-btn tp-btn--outline" onClick={() => setConfirm(null)}>Close</button>
              <button type="button" className="tp-btn tp-btn--solid" onClick={confirm.onYes}>Confirm</button>
            </div>
          </div>
        </>
      )}

      <input ref={importInputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ""; }} />
      {importMsg && <div className="jw-toast">{importMsg}<button type="button" aria-label="Dismiss" onClick={() => setImportMsg("")}><X size={13} strokeWidth={2} /></button></div>}
    </div>
  );
}

function ProductionWorkspace({ submissions, onOpenSubmission }: { submissions: EditorialSubmission[]; onOpenSubmission: (id: string) => void }) {
  const production = submissions.filter((submission) => ["Accepted", "Scheduled for publishing", "Published"].includes(submission.status));
  return <section className="studies-page"><div className="studies-hero"><div><span>Editorial workspace</span><h1>Publication production</h1><p>Follow accepted studies through preparation, scheduling, and publication from the shared editorial record.</p></div><div className="hero-shapes"><i /><i /><i /></div></div><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">{production.map((submission) => <button key={submission.id} onClick={() => onOpenSubmission(submission.id)} className="flex w-full items-center justify-between gap-5 border-b border-slate-100 px-5 py-4 text-left last:border-0 hover:bg-slate-50"><span><strong className="block text-sm text-slate-900">{submission.title}</strong><small className="mt-1 block text-xs text-slate-500">{submission.author} · {submission.id}</small></span><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{submission.status}</span></button>)}{!production.length && <p className="p-10 text-center text-sm text-slate-500">No shared production records are available.</p>}</div></section>;
}

function ProductionViewTabs({ view }: { view: "Needs action" | "Approval" | "Published" | "Closed" }) {
  const tabs = [
    { title: "Needs action", icon: Inbox },
    { title: "Approval", icon: ShieldCheck },
    { title: "Published", icon: CheckCircle2 },
    { title: "Closed", icon: CircleX },
  ] as const;
  const [selected, setSelected] = useState(() => tabs.findIndex((tab) => tab.title === view));
  const [trackedView, setTrackedView] = useState(view);
  if (trackedView !== view) {
    setTrackedView(view);
    setSelected(tabs.findIndex((tab) => tab.title === view));
  }

  return (
    <div className="production-view-tabs" role="tablist" aria-label="Production views">
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const active = selected === index;
        return (
          <button
            type="button"
            key={tab.title}
            role="tab"
            aria-selected={active}
            aria-label={tab.title}
            title={tab.title}
            className={`${active ? "active " : ""}${tab.title.toLowerCase().replaceAll(" ", "-")}`}
            onClick={() => {
              setSelected(index);
              window.dispatchEvent(new CustomEvent("talikha:production-view", { detail: tab.title }));
            }}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{tab.title}</span>
          </button>
        );
      })}
    </div>
  );
}

function ProductionWorkspaceV2({
  submissions,
  publicationRecords,
  view,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onPublicationRecordsChange,
  onOpenProductionList,
  accessRole,
}: {
  submissions: EditorialSubmission[];
  publicationRecords: PublicationRecord[];
  view: "Needs action" | "Approval" | "Published" | "Closed";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (submission: EditorialSubmission) => void;
  onDelete: (submissionId: string) => void;
  onPublicationRecordsChange: (records: PublicationRecord[]) => void;
  onOpenProductionList?: () => void;
  accessRole: "admin" | "editor" | "viewer";
}) {
  const selected = submissions.find((submission) => submission.id === selectedId);
  const visible = submissions.filter((submission) => view === "Needs action" ? ["In progress", "Review", "Revise", "Accepted"].includes(submission.status) : view === "Approval" ? ["For approval", "Scheduled for publishing"].includes(submission.status) : view === "Published" ? submission.status === "Published" : submission.status === "Rejected");
  const sortedVisible = [...visible].sort((a, b) => {
    if (view === "Approval") {
      const publishingOrder: Record<string, number> = { "For approval": 0, "Scheduled for publishing": 1, Published: 2 };
      const aOrder = publishingOrder[a.status] ?? 9;
      const bOrder = publishingOrder[b.status] ?? 9;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return acceptedTimestamp(b) - acceptedTimestamp(a);
    }
    if (view === "Published") return acceptedTimestamp(b) - acceptedTimestamp(a);
    return acceptedTimestamp(a) - acceptedTimestamp(b);
  });
  const openRecord = (id: string) => {
    if (!publicationRecords.some((record) => record.submissionId === id)) {
      const submission = submissions.find((item) => item.id === id);
      const defaults = submission ? (journalIssueDefaults[submission.journal] ?? { volume: "1", issue: "1" }) : { volume: "1", issue: "1" };
      onPublicationRecordsChange([...publicationRecords, { id: `PUB-${id}`, submissionId: id, journal: submission?.journal || "InQuira", volume: defaults.volume, issue: defaults.issue, doi: "", pageStart: "", pageEnd: "", readCount: 0, downloadCount: 0, status: "Draft" }]);
    }
    onSelect(id);
  };
  if (selected) return <LegacySubmissionReview submission={selected} onBack={() => onSelect(null)} onUpdate={onUpdate} onDelete={onDelete} publicationRecords={publicationRecords} onPublicationRecordsChange={onPublicationRecordsChange} publicationOnly initialTab="publication" accessRole={accessRole} />;
  return <section className="studies-page"><div className="studies-hero"><div><span>Editorial workspace</span><h1>Publication production</h1><p>Follow accepted studies through preparation, scheduling, and publication from the shared editorial record.</p></div><div className="hero-shapes"><i /><i /><i /></div></div><ProductionViewTabs view={view} /><div key={view} className="production-list-enter production-record-list mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">{sortedVisible.map((submission) => <div key={submission.id} className="production-record-row"><div className="production-record-copy"><strong>{submission.title}</strong><small>{submission.author} · {submission.id}</small></div><div className="production-record-meta"><span className={`production-journal ${submission.journal.toLowerCase().replaceAll(" ", "-")}`}><BookOpen size={14} aria-hidden="true" />{submission.journal}</span><span className="production-accepted-date"><CalendarDays size={14} aria-hidden="true" />{acceptedDateLabel(submission)}</span></div><span className={`production-status ${submission.status.toLowerCase().replaceAll(" ", "-")}`}>{submission.status}</span><button type="button" className="production-record-open" onClick={() => openRecord(submission.id)}><FileText size={16} aria-hidden="true" /><span>Open publication record</span></button></div>)}{!sortedVisible.length && <p className="p-10 text-center text-sm text-slate-500">No shared production records are available.</p>}</div></section>;
}

function MediaWorkspace({ assets }: { assets: Record<string, unknown>[] }) {
  return <section className="studies-page"><div className="studies-hero"><div><span>Editorial workspace</span><h1>Media</h1><p>Shared journal, issue, and contributor images from the editorial media library.</p></div><div className="hero-shapes"><i /><i /><i /></div></div><div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <article key={String(asset.id)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={String(asset.public_url || "")} alt={String(asset.alt_text || "Editorial asset")} className="aspect-square w-full object-cover"/><div className="p-4"><strong className="block truncate text-sm text-slate-900">{String(asset.original_name || "Editorial image")}</strong><small className="mt-1 block text-xs text-slate-500">{String(asset.credit || "No credit recorded")}</small></div></article>)}{!assets.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No shared editorial images are available.</p>}</div></section>;
}

function StudiesView({ submissions, publicationRecords, onOpenRecord }: { submissions: EditorialSubmission[]; publicationRecords: PublicationRecord[]; onOpenRecord: (submissionId: string) => void }) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState<"All" | "For Approval" | "Scheduled" | "Published">("All"),
    [date, setDate] = useState("Any date"),
    [journal, setJournal] = useState("All journals"),
    [volume, setVolume] = useState("All volumes"),
    [issue, setIssue] = useState("All issues");
  const cutoff =
    date === "Last 7 days"
      ? new Date("2026-07-10")
      : date === "Last 30 days"
        ? new Date("2026-06-17")
        : null;
  const publicationStudies = publicationRecords
    .filter((record) => record.status === "For approval" || record.status === "Scheduled" || record.status === "Published")
    .flatMap((record) => {
      const submission = submissions.find((item) => item.id === record.submissionId);
      return submission ? [{ ...submission, discipline: submission.affiliation, reference: submission.id, file: submission.fileName, date: submission.submittedAt, summary: submission.abstract, record, state: record.status === "For approval" ? "For Approval" as const : record.status === "Scheduled" ? "Scheduled" as const : "Published" as const }] : [];
    });
  const volumes = [...new Set(publicationStudies.map((study) => study.record.volume).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const issues = [...new Set(publicationStudies.filter((study) => volume === "All volumes" || study.record.volume === volume).map((study) => study.record.issue).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const results = publicationStudies
    .filter(
      (s) =>
        (status === "All" || s.state === status) &&
        (journal === "All journals" || s.journal === journal) &&
        (volume === "All volumes" || s.record.volume === volume) &&
        (issue === "All issues" || s.record.issue === issue) &&
        (!cutoff || new Date(s.submittedAt) >= cutoff) &&
        [s.title, s.author, s.id, s.affiliation]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      const stateOrder: Record<string, number> = { "For Approval": 0, Scheduled: 1, Published: 2 };
      if (a.state !== b.state) return (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9);
      if (a.state === "Scheduled") return (a.record.scheduledFor || "").localeCompare(b.record.scheduledFor || "");
      return Number(b.record.pageStart || 0) - Number(a.record.pageStart || 0) || b.submittedAt.localeCompare(a.submittedAt);
    });
  const reset = () => {
    setQuery("");
    setStatus("All");
    setDate("Any date");
    setJournal("All journals");
    setVolume("All volumes");
    setIssue("All issues");
  };
  return (
    <section className="studies-page">
      <div className="studies-hero">
        <div>
          <span>Editorial library</span>
          <h1>Studies and papers</h1>
          <p>
            Find every submitted manuscript and follow its progress through the
            editorial workflow.
          </p>
        </div>
        <div className="hero-shapes">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="studies-search">
        <label>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, author, reference, or discipline"
          />
        </label>
        <div>
          <BookOpen />
          <select value={journal} onChange={(e) => setJournal(e.target.value)}>
            <option>All journals</option>
            <option>InQuira</option>
            <option>Lumera</option>
          </select>
          <ChevronDown />
        </div>
        <button>Find studies</button>
      </div>
      <div className="studies-content">
        <aside className="studies-filter">
          <header>
            <strong>Filter</strong>
            <button onClick={reset}>Clear all</button>
          </header>
          <label>
            Date submitted
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              <option>Any date</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </label>
          <fieldset>
            <legend>Publication status</legend>
            {(["All", "For Approval", "Scheduled", "Published"] as const).map((x) => (
              <button
                className={status === x ? "active" : ""}
                onClick={() => setStatus(x)}
                key={x}
              >
                <i
                  className={`filter-dot ${x.toLowerCase()}`}
                />
                <span>{x}</span>
                <b>
                  {x === "All"
                    ? publicationStudies.length
                    : publicationStudies.filter((s) => s.state === x).length}
                </b>
              </button>
            ))}
          </fieldset>
          <label>
            Journal
            <select value={journal} onChange={(e) => { setJournal(e.target.value); setVolume("All volumes"); setIssue("All issues"); }}>
              <option>All journals</option><option>InQuira</option><option>Lumera</option>
            </select>
          </label>
          <label>
            Volume
            <select value={volume} onChange={(e) => { setVolume(e.target.value); setIssue("All issues"); }}>
              <option>All volumes</option>{volumes.map((item) => <option key={item} value={item}>Volume {item}</option>)}
            </select>
          </label>
          <label>
            Issue
            <select value={issue} onChange={(e) => setIssue(e.target.value)}>
              <option>All issues</option>{issues.map((item) => <option key={item} value={item}>Issue {item}</option>)}
            </select>
          </label>
          <div className="filter-note">
            <FileCheck2 />
            <p>
              <strong>Automatically sorted</strong>For approval appears first, followed by scheduled and published records.
            </p>
          </div>
        </aside>
        <div className="studies-results">
          <div className="results-heading">
            <div>
              <strong>
                {results.length} {results.length === 1 ? "study" : "studies"}
              </strong>
                <span>For approval first; scheduled and published records follow automatically.</span>
            </div>
            <button type="button" title="Records arrange automatically by schedule, then page range.">
              <SlidersHorizontal /> Sort
            </button>
          </div>
          {results.map((study, i) => (
            <article className={`study-card ${study.state === "Published" ? "is-published" : "is-publishing"}`} key={study.id} tabIndex={0} role="button" onClick={() => onOpenRecord(study.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenRecord(study.id); } }}>
              <div className={`study-file tone-${i % 3}`}>
                <FileText />
              </div>
              <div className="study-copy">
                <div className="study-title-row">
                  <div>
                    <h2><span className={`publication-mark ${study.state.toLowerCase().replaceAll(" ", "-")}`}>{study.state === "Published" ? <CheckCircle2 aria-label="Published" /> : <CircleX aria-label={study.state} />}</span>{study.title}</h2>
                    <p>
                      {study.author} · {study.discipline}
                    </p>
                  </div>
                  <div className="study-card-actions"><span className={`study-status ${study.state.toLowerCase().replaceAll(" ", "-")}`}>{study.state}</span><button type="button" className="edit-study" onClick={(event) => { event.stopPropagation(); onOpenRecord(study.id); }}>Edit</button></div>
                </div>
                <p className="study-summary">{study.abstract}</p>
                <div className="study-meta">
                  <span>
                    <BookOpen />
                    {study.journal}
                  </span>
                  <span>
                    <CalendarDays />
                    {study.state === "Scheduled" && study.record.scheduledFor ? `Scheduled ${new Date(study.record.scheduledFor).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}` : study.state === "For Approval" ? "For approval" : `Published ${study.displayDate}`}
                  </span>
                  <span>
                    <FileText />
                    Vol. {study.record.volume}, Issue {study.record.issue} · pp. {study.record.pageStart}–{study.record.pageEnd}
                  </span>
                  <span>
                    <FileText />
                    {study.reference} · PDF · {study.file}
                  </span>
                </div>
              </div>
              <button
                className="open-study"
                aria-label={`Open ${study.title}`}
                type="button"
                onClick={(event) => { event.stopPropagation(); onOpenRecord(study.id); }}
                title="Open publication record"
              >
                <ChevronRight />
              </button>
            </article>
          ))}
          {!results.length && (
            <div className="study-empty">
              <Search />
              <strong>No studies found</strong>
              <p>Try changing the search term or clearing the filters.</p>
              <button onClick={reset}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
const submissionStatusOrder: SubmissionStatus[] = [
  "New",
  "In progress",
  "Review",
  "Revise",
  "Accepted",
  "For approval",
  "Scheduled for publishing",
  "Published",
  "Rejected",
];

function statusActions(status: SubmissionStatus) {
  const actions: Record<
    SubmissionStatus,
    { label: string; status: SubmissionStatus; tone?: string }[]
  > = {
    New: [
      { label: "Start review", status: "In progress" },
      { label: "Reject", status: "Rejected", tone: "danger" },
    ],
    "In progress": [
      { label: "Send to review", status: "Review" },
      { label: "Request revision", status: "Revise" },
      { label: "Reject", status: "Rejected", tone: "danger" },
    ],
    Review: [
      { label: "Accept submission", status: "Accepted" },
      { label: "Request revision", status: "Revise" },
      { label: "Reject", status: "Rejected", tone: "danger" },
    ],
    Revise: [
      { label: "Return to review", status: "Review" },
      { label: "Reject", status: "Rejected", tone: "danger" },
    ],
    Accepted: [{ label: "Publish study", status: "Published" }],
    "For approval": [],
    "Scheduled for publishing": [],
    Published: [],
    Rejected: [],
  };
  return actions[status];
}

type SubmissionView = "New" | "Needs action" | "Published" | "Closed";

function submissionsForView(
  submissions: EditorialSubmission[],
  view: SubmissionView,
) {
  return submissions.filter((submission) => {
    if (view === "New") return submission.status === "New";
    if (view === "Needs action") {
      return ["In progress", "Review", "Revise", "Scheduled for publishing"].includes(submission.status);
    }
    if (view === "Published") {
      return ["Accepted", "Published"].includes(submission.status);
    }
    return submission.status === "Rejected";
  });
}

function SubmissionWorkspace({
  submissions,
  publicationRecords,
  view,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onPublicationRecordsChange,
  onReturnToSubmissions,
  accessRole,
}: {
  submissions: EditorialSubmission[];
  publicationRecords: PublicationRecord[];
  view: SubmissionView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (submission: EditorialSubmission) => void;
  onDelete: (submissionId: string) => void;
  onPublicationRecordsChange: (records: PublicationRecord[]) => void;
  onReturnToSubmissions?: () => void;
  accessRole: "admin" | "editor" | "viewer";
}) {
  const [query, setQuery] = useState("");
  const selected = submissions.find(
    (submission) => submission.id === selectedId,
  );
  const visible = submissionsForView(submissions, view).filter((submission) => {
    const haystack =
      `${submission.title} ${submission.author} ${submission.id} ${submission.journal}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  if (selected) {
    return (
      <LegacySubmissionReview
        key={selected.id}
        submission={selected}
        onBack={() => onSelect(null)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        publicationRecords={publicationRecords}
        onPublicationRecordsChange={onPublicationRecordsChange}
        onReturnToSubmissions={onReturnToSubmissions}
        accessRole={accessRole}
      />
    );
  }
  return (
    <section className="submission-workspace">
      <div className="submission-heading">
        <div>
          <span>Editorial records</span>
          <h1>{view === "New" ? "New submissions" : view}</h1>
          <p>
            Review the records selected from the Editorial library and open a
            complete record before making a decision.
          </p>
        </div>
        <div className="submission-summary">
          <strong>{visible.length}</strong>
          <span>{view === "New" ? "New records" : `${view} records`}</span>
        </div>
      </div>
      <div className="submission-toolbar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search studies, authors, or references"
          />
        </label>
      </div>
      <div className="submission-list" role="list">
        <div className="submission-list-labels" aria-hidden="true">
          <span>Study and author</span>
          <span>Journal</span>
          <span>Submitted</span>
          <span>Stage</span>
          <span />
        </div>
        {visible.map((submission) => (
          <button
            className="submission-list-row"
            type="button"
            role="listitem"
            key={submission.id}
            onClick={() => onSelect(submission.id)}
          >
            <span className="submission-person">
              <Avatar src={submission.image} />
              <span>
                <strong>{submission.title}</strong>
                <small>
                  {submission.author} · {submission.id}
                </small>
              </span>
            </span>
            <span>{submission.journal}</span>
            <span>{submission.displayDate}</span>
            <span
              className={`submission-status ${submission.status.toLowerCase().replaceAll(" ", "-")}`}
            >
              {submission.status === "Scheduled for publishing" ? "Publishing" : submission.status}
            </span>
            <ChevronRight />
          </button>
        ))}
        {!visible.length && (
          <div className="submission-empty">
            <FileText />
            <strong>No matching submissions</strong>
            <span>
              Clear or change the current filters to see editorial records.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function SubmissionReview({
  submission,
  onBack,
  onUpdate,
}: {
  submission: EditorialSubmission;
  onBack: () => void;
  onUpdate: (submission: EditorialSubmission) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(submission.title);
  const [abstract, setAbstract] = useState(submission.abstract);
  const moveTo = (status: SubmissionStatus) =>
    onUpdate({
      ...submission,
      status,
      history: [...submission.history, `Moved to ${status} · ${new Date().toLocaleString("en-PH")}`],
    });
  const saveDetails = () => {
    onUpdate({
      ...submission,
      title,
      abstract,
      history: [...submission.history, "Record details updated"],
    });
    setEditing(false);
  };
  return (
    <section className="submission-detail">
      <div className="detail-topline">
        <button onClick={onBack}>
          <ArrowLeft /> Back to submissions
        </button>
        <span>Editorial record · {submission.id}</span>
      </div>
      <div className="submission-heading detail-heading">
        <div>
          <span>{submission.journal}</span>
          <h1>{submission.title}</h1>
          <p>
            Submitted by {submission.author} on {submission.displayDate}.
          </p>
        </div>
        <span
          className={`submission-status ${submission.status.toLowerCase().replaceAll(" ", "-")}`}
        >
          {submission.status}
        </span>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-card">
            <header>
              <div>
                <h2>Submission record</h2>
                <p>Review the record before changing its editorial stage.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (editing ? saveDetails() : setEditing(true))}
              >
                {editing ? <Save /> : <FileText />}
                {editing ? "Save changes" : "Edit details"}
              </Button>
            </header>
            <div className="record-grid">
              <div>
                <span>Author</span>
                <strong>{submission.author}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{submission.email}</strong>
              </div>
              <div>
                <span>Affiliation</span>
                <strong>{submission.affiliation}</strong>
              </div>
              <div>
                <span>Journal</span>
                <strong>{submission.journal}</strong>
              </div>
              <div>
                <span>Reference</span>
                <strong>{submission.id}</strong>
              </div>
              <div>
                <span>Manuscript file</span>
                <strong>{submission.fileName}</strong>
              </div>
            </div>
            <label className="detail-field">
              Study title
              {editing ? (
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              ) : (
                <strong>{submission.title}</strong>
              )}
            </label>
            <label className="detail-field">
              Abstract
              {editing ? (
                <textarea
                  value={abstract}
                  onChange={(event) => setAbstract(event.target.value)}
                />
              ) : (
                <p>{submission.abstract}</p>
              )}
            </label>
          </section>
          <section className="detail-card">
            <header>
              <div>
                <h2>Payment record</h2>
                <p>Submitted receipt status for this manuscript.</p>
              </div>
            </header>
            <div className="payment-record">
              <CreditCard />
              <div>
                <strong>
                  {submission.paymentProof
                    ? "Payment proof received"
                    : "Payment proof pending"}
                </strong>
                <span>
                  {submission.paymentProof
                    ? "Receipt is attached to this local submission record."
                    : "No receipt has been attached to this local submission record."}
                </span>
              </div>
            </div>
          </section>
        </div>
        <aside className="detail-side">
          <section className="detail-card status-rail">
            <header>
              <div>
                <h2>Editorial stage</h2>
                <p>Record decisions as the submission progresses.</p>
              </div>
            </header>
            <ol>
              {submissionStatusOrder
                .filter((status) => status !== "Rejected")
                .map((status) => (
                  <li
                    key={status}
                    className={
                      submission.status === status
                        ? "current"
                        : submissionStatusOrder.indexOf(submission.status) >
                            submissionStatusOrder.indexOf(status)
                          ? "complete"
                          : ""
                    }
                  >
                    <i />
                    {status}
                  </li>
                ))}
            </ol>
            <div className="review-actions">
              {statusActions(submission.status).map((action) => (
                <button
                  key={action.label}
                  className={action.tone || ""}
                  onClick={() => moveTo(action.status)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>
          <section className="detail-card">
            <header>
              <div>
                <h2>Record history</h2>
                <p>Local editorial activity.</p>
              </div>
            </header>
            <ul className="record-history">
              {submission.history.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <i />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}

function acceptedTimestamp(submission: EditorialSubmission) {
  const entry = [...submission.history].reverse().find((item) => item.includes("Moved to Accepted"));
  const rawDate = entry?.split(/\s+(?:·|Â·)\s+/).at(-1)?.trim();
  const accepted = rawDate ? Date.parse(rawDate) : Number.NaN;
  const submitted = Date.parse(submission.submittedAt);
  return Number.isNaN(accepted) ? (Number.isNaN(submitted) ? Number.MAX_SAFE_INTEGER : submitted) : accepted;
}

function acceptedDateLabel(submission: EditorialSubmission) {
  const timestamp = acceptedTimestamp(submission);
  const acceptedLabel = timestamp === Number.MAX_SAFE_INTEGER
    ? "Acceptance date pending"
    : `Accepted ${new Date(timestamp).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
  return acceptedLabel;
}

function submittedDateTimeLabel(submission: EditorialSubmission) {
  const timestamp = Date.parse(submission.submittedAt);
  if (Number.isNaN(timestamp)) return `Submitted ${submission.displayDate}`;
  return `Submitted ${new Date(timestamp).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

function LegacySubmissionReview({
  submission,
  onBack,
  onUpdate,
  onDelete,
  publicationRecords,
  onPublicationRecordsChange,
  onReturnToSubmissions,
  accessRole,
  publicationOnly = false,
  initialTab,
}: {
  submission: EditorialSubmission;
  onBack: () => void;
  onUpdate: (submission: EditorialSubmission) => void;
  onDelete: (submissionId: string) => void;
  publicationRecords: PublicationRecord[];
  onPublicationRecordsChange: (records: PublicationRecord[]) => void;
  onReturnToSubmissions?: () => void;
  accessRole?: "admin" | "editor" | "viewer";
  publicationOnly?: boolean;
  initialTab?: "review" | "publication";
}) {
  const isAdmin = (accessRole || "admin") === "admin";
  const [saved, setSaved] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false),
    [paymentViewerOpen, setPaymentViewerOpen] = useState(false),
    [documentViewerOpen, setDocumentViewerOpen] = useState<
      "pdf" | "word" | null
    >(null),
    [authors, setAuthors] = useState(() => authorsFor(submission)),
    [activeAuthor, setActiveAuthor] = useState(0),
    [manuscriptTitle, setManuscriptTitle] = useState(submission.title),
    [receipt, setReceipt] = useState<ReceiptSettings>(
      submission.receipt ?? defaultReceiptSettings,
    ),
    [instructions, setInstructions] = useState({
      editorialGuidance: true,
      reviewerComments: true,
      revisionChecklist: false,
    }),
    [reviewTab, setReviewTab] = useState<"review" | "publication">(() => initialTab || "review"),
    [scheduleUnlocked, setScheduleUnlocked] = useState(false);
  const paymentConfirmed = submission.paymentConfirmed === true;
  const author = authors[activeAuthor] ?? authors[0];
  const nameParts = author.name.trim().split(/\s+/).filter(Boolean);
  const firstName = author.firstName?.trim() || nameParts[0] || "";
  const middleInitial = author.middleInitial?.trim() || nameParts.slice(1, -1).map((part) => part.replace(/[^a-z]/gi, "").charAt(0).toUpperCase()).filter(Boolean).map((initial) => `${initial}.`).join(" ");
  const middleName = middleInitial || "";
  const lastName = author.surname?.trim() || (nameParts.length > 1 ? nameParts.at(-1) || "" : "");
  const updateNamePart = (key: "firstName" | "middleInitial" | "surname", value: string) => {
    const next = { firstName, middleInitial: middleName === "—" ? "" : middleName, surname: lastName, [key]: value };
    setAuthors((current) => current.map((item, index) => index === activeAuthor ? { ...item, ...next, name: [next.firstName, next.middleInitial, next.surname].filter(Boolean).join(" ") } : item));
  };
  const updateAuthor = (key: keyof ReviewAuthor, value: string) => {
    setAuthors((current) =>
      current.map((item, index) =>
        index === activeAuthor
          ? key === "name"
            ? { ...item, name: value, firstName: undefined, middleInitial: undefined, surname: undefined }
            : { ...item, [key]: value }
          : item,
      ),
    );
  };
  const total = receipt.fee + receipt.tax - receipt.discount;
  const updateReceipt = (next: ReceiptSettings) => setReceipt(next);
  const saveReview = () => {
    const primaryAuthor = authors[0];
    setSaved(true);
    onUpdate({
      ...submission,
      author: primaryAuthor.name,
      email: primaryAuthor.email,
      affiliation: primaryAuthor.affiliation,
      title: manuscriptTitle,
      authors,
      receipt,
      history: [...submission.history, "Review record saved"],
    });
  };
  const moveTo = (status: SubmissionStatus) => {
    onUpdate({
      ...submission,
      status,
      history: [...submission.history, `Moved to ${status} · ${new Date().toLocaleString("en-PH")}`],
    });
    if (status === "In progress") onReturnToSubmissions?.();
  };
  const confirmPayment = () => {
    if (paymentConfirmed) return;
    onUpdate({
      ...submission,
      paymentConfirmed: true,
      history: [...submission.history, "Payment confirmed"],
    });
  };
  const publicationRecord = publicationRecords.find(
    (record) => record.submissionId === submission.id,
  );
  const openPublicationRecord = () => {
    if (!publicationRecord) {
      const defaults = journalIssueDefaults[submission.journal] ?? { volume: "1", issue: "1" };
      onPublicationRecordsChange([
        ...publicationRecords,
        {
          id: `PUB-${submission.id}`,
          submissionId: submission.id,
          journal: submission.journal,
          volume: defaults.volume,
          issue: defaults.issue,
          doi: "",
          pageStart: "",
          pageEnd: "",
          readCount: 0,
          downloadCount: 0,
          status: "Draft",
        },
      ]);
    }
    if (submission.status === "New") moveTo("In progress");
    setReviewTab("publication");
  };
  const updatePublicationRecord = (next: PublicationRecord) =>
    onPublicationRecordsChange(
      publicationRecords.map((record) => (record.id === next.id ? next : record)),
    );
  const markForApproval = () => onUpdate({
    ...submission,
    status: "For approval",
    history: [...submission.history, `Marked for approval · ${new Date().toLocaleString("en-PH")}`],
  });
  const revisePublication = () => {
    if (publicationRecord) updatePublicationRecord({ ...publicationRecord, status: "Draft" });
    onUpdate({
      ...submission,
      status: "Revise",
      history: [...submission.history, `Publication sent for revision · ${new Date().toLocaleString("en-PH")}`],
    });
    window.dispatchEvent(new CustomEvent("talikha:production-view", { detail: "Needs action" }));
    onBack();
  };
  const schedulePublication = (scheduledFor: string) => {
    if (!publicationRecord || !scheduledFor) return;
    updatePublicationRecord({ ...publicationRecord, scheduledFor, status: "Scheduled" });
    moveTo("Scheduled for publishing");
  };
  return (
    <section className="submission-review">
      <div className="review-heading">
        <div className="review-heading-copy">
          <nav className="review-breadcrumb" aria-label="Breadcrumb">
            <button onClick={onBack}>Editorial records</button>
            <ChevronRight aria-hidden="true" />
            <span aria-current="page">Review</span>
          </nav>
          <h1>{reviewTab === "review" ? "Submission review" : publicationRecord && (publicationRecord.status === "Ready to publish" || publicationRecord.status === "Scheduled" || (publicationRecord.status === "For approval" && scheduleUnlocked)) ? "Publishing schedule" : "Publication record"}</h1>
          <p>
            Confirm the author’s information, manuscript details, and payment
            receipt.
          </p>
          <span
            className={`submission-status ${submission.status.toLowerCase().replaceAll(" ", "-")}`}
          >
            {submission.status}
          </span>
        </div>
        <div className="review-heading-actions" aria-label="Review actions">
          <button type="button" className="review-save-action" onClick={saveReview}>
            <Save />
            {saved ? "Saved locally" : "Save review"}
          </button>
          <button type="button" className="review-delete-action" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Delete submission
          </button>
          {!publicationOnly && reviewTab === "review" && statusActions(submission.status).length > 0 && statusActions(submission.status)
            .filter((action) => action.status !== "Revise")
            .map((action) => (
              <button
                type="button"
                key={action.label}
                className={action.tone === "danger" ? "danger" : "approve"}
                onClick={() => moveTo(action.status)}
                disabled={action.status === "In progress" && !paymentConfirmed}
                title={action.status === "In progress" && !paymentConfirmed ? "Confirm the payment before starting review" : undefined}
              >
                <CheckCircle2 />
                {action.label}
              </button>
            ))}
        </div>
      </div>
      {reviewTab === "publication" && publicationRecord && (publicationRecord.status === "Ready to publish" || publicationRecord.status === "Scheduled" || (publicationRecord.status === "For approval" && scheduleUnlocked)) ? (
        <>
          <PublicationSchedulePanel record={publicationRecord} submission={submission} onSchedule={schedulePublication} canManagePublication={isAdmin} />
          <div className="publication-record-access">
            <div>
              <span>Publication record</span>
              <h2>Publication details</h2>
              <p>Review or update the publication metadata below. The scheduling controls remain at the top of this workspace.</p>
            </div>
          </div>
          <PublicationRecordEditor
            submission={submission}
            authors={authors}
            manuscriptTitle={manuscriptTitle}
            record={publicationRecord}
            publicationRecords={publicationRecords}
            onChange={updatePublicationRecord}
            onOpenPublish={() => { setScheduleUnlocked(true); setReviewTab("publication"); }}
            onMarkForApproval={markForApproval}
            onRevise={revisePublication}
            canManagePublication={isAdmin}
          />
        </>
      ) : reviewTab === "publication" ? (
        <PublicationRecordEditor
          submission={submission}
          authors={authors}
          manuscriptTitle={manuscriptTitle}
          record={publicationRecord ?? null}
          publicationRecords={publicationRecords}
          onChange={updatePublicationRecord}
          onOpenPublish={() => { setScheduleUnlocked(true); setReviewTab("publication"); }}
          onMarkForApproval={markForApproval}
          onRevise={revisePublication}
          canManagePublication={isAdmin}
        />
      ) : <div className="review-layout">
        <div className="review-form">
          <section>
            <header>
              <div>
                <h2>Author information</h2>
                <p>Review one author at a time without expanding the record.</p>
              </div>
              <div className="author-upload">
                <Avatar src={submission.image} size="lg" />
                <span>
                  <strong>2×2 profile picture</strong>
                  <small>
                    {author.name.toLowerCase().replaceAll(" ", "-")}.webp
                  </small>
                </span>
              </div>
            </header>
            <div
              className="author-switcher"
              role="tablist"
              aria-label="Authors"
            >
              {authors.map((item, index) => (
                <button
                  className={activeAuthor === index ? "active" : ""}
                  key={item.id}
                  onClick={() => setActiveAuthor(index)}
                  role="tab"
                  aria-selected={activeAuthor === index}
                >
                  <span className="asw-photo" aria-hidden="true">{item.photo ? <img src={item.photo} alt="" /> : (item.name || "New author").trim().charAt(0).toUpperCase() || "•"}</span>
                  {index + 1}. {item.name || "New author"}
                </button>
              ))}
              <button
                className="add-author"
                type="button"
                onClick={() => {
                  setAuthors((current) => [
                    ...current,
                    {
                      id: `${submission.id}-author-${current.length + 1}`,
                      name: "",
                      email: "",
                      affiliation: "",
                      academicTitle: "",
                      occupation: "Co-author",
                    },
                  ]);
                  setActiveAuthor(authors.length);
                }}
              >
                <Plus /> Add
              </button>
              {authors.length > 1 && (
                <button
                  className="remove-author"
                  type="button"
                  onClick={() => {
                    setAuthors((current) => current.filter((_, index) => index !== activeAuthor));
                    setActiveAuthor(Math.max(0, activeAuthor - 1));
                  }}
                  aria-label="Remove current author"
                  title="Remove current author"
                >
                  <X />
                </button>
              )}
            </div>
            <div className="author-photo-card">
              <span className="author-photo-circle">
                {author.photo
                  ? <img src={author.photo} alt={`${author.name || "Author"} profile photo`} />
                  : <span className="author-photo-empty"><ImageIcon size={22} strokeWidth={1.6} /></span>}
              </span>
              <div className="author-photo-meta">
                <strong>Profile photo</strong>
                <span>{author.photo ? "Uploaded by the author at submission · stored locally on this device" : "No photo was provided with this submission"}</span>
              </div>
              <div className="author-photo-actions">
                {author.photo ? (
                  <a
                    className="author-photo-dl"
                    href={author.photo}
                    download={`${(author.name || "author").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "author"}-photo.${(author.photo || "").indexOf("data:image/png") === 0 ? "png" : "jpg"}`}
                  >
                    <Download size={14} strokeWidth={1.9} /> Download photo
                  </a>
                ) : (
                  <span className="author-photo-none">Not provided</span>
                )}
              </div>
            </div>
            <div className="review-fields names">
              <ReviewField
                label="First name"
                value={firstName}
                onChange={(value) =>
                  updateAuthor(
                    "name",
                    [value, middleName === "—" ? "" : middleName, lastName]
                      .filter(Boolean)
                      .join(" "),
                  )
                }
              />
              <ReviewField
                label="Middle initial"
                value={middleName === "—" ? "" : middleName}
                onChange={(value) =>
                  updateAuthor(
                    "name",
                    [firstName, value, lastName].filter(Boolean).join(" "),
                  )
                }
              />
              <ReviewField
                label="Surname"
                value={lastName}
                onChange={(value) =>
                  updateAuthor(
                    "name",
                    [firstName, middleName === "—" ? "" : middleName, value]
                      .filter(Boolean)
                      .join(" "),
                  )
                }
              />
            </div>
            <div className="review-fields two">
              <ReviewField
                label="Academic title"
                value={author.academicTitle || ""}
                onChange={(value) => updateAuthor("academicTitle", value)}
              />
              <ReviewField
                label="Affiliation"
                value={author.affiliation}
                onChange={(value) => updateAuthor("affiliation", value)}
              />
              <ReviewField
                label="Gmail account"
                value={author.email}
                onChange={(value) => updateAuthor("email", value)}
              />
            </div>
          </section>
          <section>
            <header>
              <div>
                <h2>Submission details</h2>
                <p>Reference information attached to this review.</p>
              </div>
            </header>
            <label className="review-textarea review-manuscript-primary">
              Manuscript title
              <textarea
                value={manuscriptTitle}
                onChange={(event) => setManuscriptTitle(event.target.value)}
              />
            </label>
            <div className="manuscript-files review-manuscript-primary">
              <span>Manuscript files</span>
              <div>
                <button onClick={() => setDocumentViewerOpen("pdf")}>
                  <FileText />
                  <span><strong>{submission.fileName}</strong><small>PDF manuscript · scroll preview</small></span>
                  <Eye />
                </button>
                <button onClick={() => setDocumentViewerOpen("word")}>
                  <FileText />
                  <span><strong>{submission.fileName.replace(/\.pdf$/i, ".docx")}</strong><small>Word manuscript · scroll preview</small></span>
                  <Eye />
                </button>
              </div>
            </div>
            <div className="review-fields two review-reference-fields">
              <ReviewField
                label="Invoice number"
                value={`LS-INV-${submission.id.replace("LS-", "")}`}
              />
              <ReviewField label="Submitted date" value={submittedDateTimeLabel(submission).replace(/^Submitted\s+/, "")} />
              <ReviewField label="Journal" value={submission.journal} />
              <ReviewField label="Submission reference" value={submission.id} />
            </div>
            <label className="review-textarea review-manuscript-secondary">
              Manuscript title
              <textarea
                value={manuscriptTitle}
                onChange={(event) => setManuscriptTitle(event.target.value)}
              />
            </label>
            <div className="manuscript-files review-manuscript-secondary">
              <span>Manuscript files</span>
              <div>
                <button onClick={() => setDocumentViewerOpen("pdf")}>
                  <FileText />
                  <span>
                    <strong>{submission.fileName}</strong>
                    <small>PDF manuscript · scroll preview</small>
                  </span>
                  <Eye />
                </button>
                <button onClick={() => setDocumentViewerOpen("word")}>
                  <FileText />
                  <span>
                    <strong>
                      {submission.fileName.replace(/\.pdf$/i, ".docx")}
                    </strong>
                    <small>Word manuscript · scroll preview</small>
                  </span>
                  <Eye />
                </button>
              </div>
            </div>
          </section>
          <section className="review-instructions">
            <header>
              <div>
                <h2>Author instructions</h2>
                <p>
                  Record the author’s requested review and approval guidance.
                </p>
              </div>
            </header>
            {[
              ["editorialGuidance", "Receive editorial guidance"],
              ["reviewerComments", "Receive reviewer comments"],
              ["revisionChecklist", "Receive a revision checklist"],
            ].map(([key, label]) => (
              <div className="instruction-choice" key={key}>
                <span>{label}</span>
                <div>
                  <button
                    className={
                      instructions[key as keyof typeof instructions]
                        ? "yes active"
                        : "yes"
                    }
                    onClick={() =>
                      setInstructions((current) => ({
                        ...current,
                        [key]: true,
                      }))
                    }
                  >
                    Yes
                  </button>
                  <button
                    className={
                      !instructions[key as keyof typeof instructions]
                        ? "no active"
                        : "no"
                    }
                    onClick={() =>
                      setInstructions((current) => ({
                        ...current,
                        [key]: false,
                      }))
                    }
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </section>
          <section className="receipt-controls">
            <header>
              <div>
                <h2>Receipt settings</h2>
                <p>Amounts update in the official receipt immediately.</p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  downloadReceiptPdf(
                    submission,
                    authors[0],
                    manuscriptTitle,
                    receipt,
                  )
                }
              >
                <Download /> Download PDF
              </Button>
            </header>
            <div className="review-fields two">
              <label>
                Fee option
                <select
                  value={receipt.fee}
                  onChange={(event) => {
                    const item = feeOptions.find(
                      (option) => option.value === Number(event.target.value),
                    );
                    if (item)
                      updateReceipt({
                        ...receipt,
                        fee: item.value,
                        feeLabel: item.label,
                      });
                  }}
                >
                  {feeOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >{`${option.label} — ₱${option.value.toLocaleString()}`}</option>
                  ))}
                </select>
              </label>
              <label>
                Tax amount
                <input
                  type="number"
                  min="0"
                  value={receipt.tax}
                  onChange={(event) =>
                    updateReceipt({
                      ...receipt,
                      tax: Number(event.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                Promo discount
                <select
                  value={receipt.discount}
                  onChange={(event) =>
                    updateReceipt({
                      ...receipt,
                      discount: Number(event.target.value),
                    })
                  }
                >
                  <option value={0}>No promo discount</option>
                  <option value={150}>Promo discount −₱150</option>
                  <option value={350}>Promo discount −₱350</option>
                </select>
              </label>
              <ReviewField
                label="Total due"
                value={`₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              />
            </div>
          </section>
        </div>
        <aside className="review-receipt-column">
          <ReceiptPreview
            submission={submission}
            author={authors[0]}
            manuscriptTitle={manuscriptTitle}
            receipt={receipt}
          />
          <section className="payment-proof-card">
            <header>
              <div>
                <h2>Photo of payment</h2>
                <p>Uploaded proof associated with the invoice number.</p>
              </div>
              <span className="verified">
                <CheckCircle2 />
                {paymentConfirmed ? "Payment accepted" : submission.paymentProof ? "Payment awaiting confirmation" : "Payment pending"}
              </span>
            </header>
            <div className="payment-proof">
              <button
                className="payment-file"
                type="button"
                disabled={!submission.paymentProof}
                onClick={() => setPaymentViewerOpen(true)}
                aria-label={`View payment proof for ${submission.id}`}
              >
                <ImageIcon />
                <div>
                  <strong>{`payment-proof-${submission.id.toLowerCase()}.jpg`}</strong>
                  <span>{submission.paymentProof ? "JPG receipt · 428 KB" : "Awaiting author upload"}</span>
                </div>
                <span className="payment-file-action">View image</span>
              </button>
            </div>
            <button
              type="button"
              className="approve payment-confirm-action"
              onClick={() => setPaymentConfirmOpen(true)}
              disabled={paymentConfirmed}
            >
              <CheckCircle2 />
              {paymentConfirmed ? "Payment accepted" : "Accept payment"}
            </button>
          </section>
        </aside>
      </div>}
      <PaymentProofViewer
          submission={submission}
          open={paymentViewerOpen}
          onOpenChange={setPaymentViewerOpen}
        />
      <ManuscriptViewer
          submission={submission}
          kind={documentViewerOpen || "pdf"}
          open={!!documentViewerOpen}
          onOpenChange={(open) => { if (!open) setDocumentViewerOpen(null); }}
        />
      <Dialog open={paymentConfirmOpen} onOpenChange={setPaymentConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="submission-delete-icon payment-confirm-icon"><CheckCircle2 /></div>
            <DialogTitle>Accept this payment?</DialogTitle>
            <DialogDescription>Confirming the payment will unlock <strong>Start review</strong> for this submission.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setPaymentConfirmOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={() => { confirmPayment(); setPaymentConfirmOpen(false); }}><CheckCircle2 /> Accept payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="submission-delete-icon"><AlertTriangle /></div>
            <DialogTitle>Delete this submission?</DialogTitle>
            <DialogDescription>This will permanently remove <strong>{submission.id}</strong> from the local submission list and its tracking record. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(submission.id)}><Trash2 /> Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
function publicationCitation(
  submission: EditorialSubmission,
  authors: ReviewAuthor[],
  record: PublicationRecord,
) {
  const names = authors.map((author) => author.name).filter(Boolean);
  const citation = createApa7JournalCitation({ authors: names.length ? names : [submission.author], title: submission.title, year: new Date(submission.submittedAt).getFullYear() || new Date().getFullYear(), journalTitle: record.journal, volume: record.volume, issue: record.issue, pages: record.pageStart && record.pageEnd ? `${record.pageStart}–${record.pageEnd}` : "", doi: record.doi });
  const authorList = citation.author_text;
  return citation.formatted_citation;
  const pages = record.pageStart && record.pageEnd ? `, ${record.pageStart}–${record.pageEnd}` : "";
  const doi = record.doi ? ` https://doi.org/${record.doi}` : "";
  return `${authorList || submission.author} (2026). ${submission.title}. ${record.journal}, ${record.volume}(${record.issue})${pages}.${doi}`;
}

function ApaCitationPreview({ submission, authors, record }: { submission: EditorialSubmission; authors: ReviewAuthor[]; record: PublicationRecord }) {
  const names = authors.map((author) => author.name).filter(Boolean);
  const citation = createApa7JournalCitation({ authors: names.length ? names : [submission.author], title: submission.title, year: new Date(submission.submittedAt).getFullYear() || new Date().getFullYear(), journalTitle: record.journal, volume: record.volume, issue: record.issue, pages: record.pageStart && record.pageEnd ? `${record.pageStart}–${record.pageEnd}` : "", doi: record.doi });
  return <p><span>{citation.author_text} ({citation.year}). {submission.title}. </span>{citation.journal_title && <em>{citation.journal_title}</em>}{citation.volume && <>, <em>{citation.volume}</em></>}{citation.issue && `(${citation.issue})`}{citation.pages && `, ${citation.pages}`}.{citation.doi_url && <> <a href={citation.doi_url} target="_blank" rel="noreferrer">{citation.doi_url}</a></>}</p>;
}

function PublicationRecordEditor({
  submission,
  authors,
  manuscriptTitle,
  record,
  publicationRecords,
  onChange,
  onOpenPublish,
  onMarkForApproval,
  onRevise,
  canManagePublication = true,
}: {
  submission: EditorialSubmission;
  authors: ReviewAuthor[];
  manuscriptTitle: string;
  record: PublicationRecord | null;
  publicationRecords: PublicationRecord[];
  onChange: (record: PublicationRecord) => void;
  onOpenPublish: () => void;
  onMarkForApproval?: () => void;
  onRevise?: () => void;
  canManagePublication?: boolean;
}) {
  const isEditableRecord = (item: PublicationRecord | null) =>
    item
      ? item.status === "Draft" ||
        (!canManagePublication && item.status === "For approval")
      : false;
  const [activePublicationAuthor, setActivePublicationAuthor] = useState(0);
  const [editingRecord, setEditingRecord] = useState(() =>
    isEditableRecord(record),
  );
  const [trackedRecord, setTrackedRecord] = useState(record);
  if (trackedRecord !== record) {
    setTrackedRecord(record);
    setEditingRecord(isEditableRecord(record));
  }
  if (!record) return null;
  const selectedAuthor = authors[Math.min(activePublicationAuthor, Math.max(0, authors.length - 1))] ?? authors[0];
  const selectedNameParts = (selectedAuthor?.name || "").trim().split(/\s+/).filter(Boolean);
  const selectedFirstName = selectedAuthor?.firstName?.trim() || selectedNameParts[0] || "";
  const selectedSurname = selectedAuthor?.surname?.trim() || (selectedNameParts.length > 1 ? selectedNameParts[selectedNameParts.length - 1] : "");
  const selectedMiddleInitial = selectedAuthor?.middleInitial?.trim() || selectedNameParts.slice(1, -1).map((part) => `${part.replace(/[^a-z]/gi, "").charAt(0).toUpperCase()}.`).filter((part) => part !== ".").join(" ");
  const sameIssue = publicationRecords.filter(
    (item) => item.journal === record.journal && item.volume === record.volume && item.issue === record.issue && item.id !== record.id,
  );
  const previousEnd = sameIssue.reduce((highest, item) => Math.max(highest, Number(item.pageEnd) || 0), 0);
  const suggestedStart = previousEnd ? previousEnd + 1 : 1;
  const pageStart = Number(record.pageStart);
  const pageEnd = Number(record.pageEnd);
  const pageProblem = Boolean(record.pageStart && record.pageEnd && (pageEnd < pageStart || sameIssue.some((item) => pageStart <= Number(item.pageEnd) && pageEnd >= Number(item.pageStart))));
  const doiExists = Boolean(record.doi && publicationRecords.some((item) => item.id !== record.id && item.doi === record.doi));
  const generateDoi = () => {
    const journalPart = record.journal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const titlePart = manuscriptTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30) || "article";
    const base = `10.0000/talikha.${journalPart}.v${record.volume}i${record.issue}.${titlePart}`;
    let candidate = base;
    let suffix = 2;
    while (publicationRecords.some((item) => item.id !== record.id && item.doi === candidate)) candidate = `${base}-${suffix++}`;
    onChange({ ...record, doi: candidate });
  };
  type PubAction = { key: string; label: string; variant: "default" | "outline" | "destructive"; tone?: "danger"; disabled: boolean; onClick: () => void };
  const editAction: PubAction = { key: "edit", label: "Edit publication record", variant: "outline", disabled: false, onClick: () => setEditingRecord(true) };
  const saveAction: PubAction = { key: "save", label: "Save", variant: "default", disabled: false, onClick: () => { onChange({ ...record, status: record.status }); setEditingRecord(false); } };
  const markAction: PubAction = { key: "mark", label: "Mark for approval", variant: "default", disabled: doiExists || pageProblem || !record.doi || !record.pageStart || !record.pageEnd, onClick: () => { onChange({ ...record, status: "For approval" }); onMarkForApproval?.(); setEditingRecord(false); } };
  const approveAction: PubAction = { key: "approve", label: "Approve and schedule", variant: "default", disabled: false, onClick: onOpenPublish };
  const reviseAction: PubAction = { key: "revise", label: "Revise", variant: "destructive", tone: "danger", disabled: false, onClick: () => onRevise?.() };
  const doiAction: PubAction = { key: "doi", label: "Generate unique DOI", variant: "outline", disabled: false, onClick: generateDoi };
  let primaryAction: PubAction | null = null;
  const overflowActions: PubAction[] = [];
  if (record.status === "For approval" && canManagePublication) {
    primaryAction = approveAction;
    overflowActions.push(reviseAction);
    if (editingRecord) overflowActions.push(saveAction, doiAction);
    else overflowActions.push(editAction);
  } else if (!editingRecord && canManagePublication) {
    primaryAction = editAction;
  } else if (editingRecord && record.status === "Draft") {
    primaryAction = markAction;
    overflowActions.push(saveAction, doiAction);
  } else if (editingRecord) {
    primaryAction = saveAction;
    overflowActions.push(doiAction);
  }
  return (
    <div className="publication-record">
      <section className="publication-card publication-summary">
        <header><div><span>Publication destination</span><h2>{record.journal}</h2><p>This record was opened from the author’s selected journal and is linked to {submission.id}.</p></div><span className="publication-state">{record.status}</span></header>
        <div className="publication-copy-grid">
          <div><span>Authors</span><strong>{authors.map((author) => author.name || "New author").join(", ")}</strong></div>
          <div><span>Manuscript files</span><strong>{submission.fileName}</strong></div>
          <div><span>Title</span><strong>{manuscriptTitle}</strong></div>
          <div><span>Submission reference</span><strong>{submission.id}</strong></div>
        </div>
      </section>
      <section className="publication-card publication-author-card">
        <header>
          <div>
            <span>Author information</span>
            <h2>Author information</h2>
            <p>Review one author at a time without expanding the record.</p>
          </div>
          <div className="publication-author-photo">
            <Avatar src={submission.image} size="lg" />
            <span><strong>2×2 profile picture</strong><small>{(selectedAuthor?.name || "author").toLowerCase().replaceAll(" ", "-")}.webp</small></span>
          </div>
        </header>
        <div className="publication-author-switcher" role="tablist" aria-label="Publication authors">
          {authors.map((item, index) => <button type="button" key={item.id} className={index === activePublicationAuthor ? "active" : ""} onClick={() => setActivePublicationAuthor(index)} role="tab" aria-selected={index === activePublicationAuthor}>{index + 1}. {item.name || "New author"}</button>)}
          <span className="publication-author-count">{authors.length} {authors.length === 1 ? "author" : "authors"}</span>
        </div>
        {selectedAuthor && <div className="publication-author-fields">
          <label>First name<input value={selectedFirstName} readOnly /></label>
          <label>Middle initial<input value={selectedMiddleInitial} readOnly /></label>
          <label>Surname<input value={selectedSurname} readOnly /></label>
          <label>Academic title<input value={selectedAuthor.academicTitle || ""} readOnly /></label>
          <label>Affiliation<input value={selectedAuthor.affiliation || ""} readOnly /></label>
          <label>Gmail account<input value={selectedAuthor.email || ""} readOnly /></label>
        </div>}
      </section>
      <section className="publication-card">
        <header><div><span>Publishing details</span><h2>Issue, DOI, and pages</h2><p>The journal’s current volume and issue are applied automatically.</p></div></header>
        <div className="publication-fields">
          <label>Journal<select value={record.journal} disabled={!editingRecord} onChange={(event) => { const defaults = journalIssueDefaults[event.target.value] ?? { volume: "1", issue: "1" }; onChange({ ...record, journal: event.target.value, volume: defaults.volume, issue: defaults.issue, pageStart: "", pageEnd: "" }); }}>{Object.keys(journalIssueDefaults).map((journal) => <option key={journal}>{journal}</option>)}</select></label>
          <ReviewField label="Volume" value={record.volume} onChange={editingRecord ? (volume) => onChange({ ...record, volume }) : undefined} />
          <ReviewField label="Issue" value={record.issue} onChange={editingRecord ? (issue) => onChange({ ...record, issue }) : undefined} />
          <div className="page-guidance"><span>Last page in this issue</span><strong>{previousEnd || "None yet"}</strong><small>Suggested next start: {suggestedStart}</small></div>
          <ReviewField label="Start page" value={record.pageStart} onChange={editingRecord ? (pageStart) => onChange({ ...record, pageStart }) : undefined} />
          <ReviewField label="End page" value={record.pageEnd} onChange={editingRecord ? (pageEnd) => onChange({ ...record, pageEnd }) : undefined} />
          {pageProblem && <p className="publication-warning">This page range overlaps another record or ends before it starts.</p>}
        </div>
        <div className="doi-row tp-pub-doi"><ReviewField label="DOI" value={record.doi} onChange={editingRecord ? (doi) => onChange({ ...record, doi }) : undefined} /></div>
        {doiExists ? <p className="publication-warning">This DOI is already used by another local publication record.</p> : record.doi && <p className="publication-note">Unique in this local website record. It becomes an official DOI only after registration with your DOI provider.</p>}
        <div className="publication-subsection">
          <header><div><span>Publication engagement</span><h3>Reads and downloads</h3><p>Set the displayed totals for this publication record.</p></div></header>
          <div className="publication-fields publication-metrics"><ReviewField label="Number of reads" value={String(record.readCount ?? 0)} onChange={editingRecord ? (value) => onChange({ ...record, readCount: Math.max(0, Number(value) || 0) }) : undefined} /><ReviewField label="Number of downloads" value={String(record.downloadCount ?? 0)} onChange={editingRecord ? (value) => onChange({ ...record, downloadCount: Math.max(0, Number(value) || 0) }) : undefined} /></div>
        </div>
      </section>
      <section className="publication-card citation-card"><header><div><span>Recommended citation</span><h2>APA 7 citation preview</h2></div></header><ApaCitationPreview submission={submission} authors={authors} record={record} /></section>
      <div className="tp-pub-actions">
          {primaryAction && (
            <Button type="button" variant={primaryAction.variant} disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
              {(primaryAction.key === "mark" || primaryAction.key === "approve") && <CheckCircle2 />}
              {primaryAction.label}
            </Button>
          )}
          {overflowActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="More publication actions"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflowActions.map((a) => (
                  <DropdownMenuItem key={a.key} disabled={a.disabled} className={a.tone === "danger" ? "text-destructive focus:text-destructive" : ""} onSelect={() => { if (!a.disabled) a.onClick(); }}>
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
    </div>
  );
}

function PublicationSchedulePanel({
  record,
  submission,
  onSchedule,
  canManagePublication = true,
}: {
  record: PublicationRecord;
  submission: EditorialSubmission;
  onSchedule: (date: string) => void;
  canManagePublication?: boolean;
}) {
  const isScheduled = record.status === "Scheduled";
  const [scheduledFor, setScheduledFor] = useState(record.scheduledFor || "");
  const [editingSchedule, setEditingSchedule] = useState(!isScheduled);
  const [savedReview, setSavedReview] = useState(false);
  const certificateIssued = (() => {
    try { return (JSON.parse(localStorage.getItem("talikha-certificate-records-v1") || "[]") as LocalCertificateRecord[]).some((certificate) => certificate.submissionId === submission.id && certificate.status === "Issued"); }
    catch { return false; }
  })();
  return <section className="publication-record">
    <section className="publication-card publication-summary">
      <header><div><span>Publishing schedule</span><h2>{isScheduled ? "Scheduled for publishing" : "Choose a publication date"}</h2><p>{isScheduled ? certificateIssued ? `${submission.title} will move to Published automatically on its scheduled date.` : "Certificate required before publication. This scheduled study will remain on hold until its certificate is issued." : "Choose when this approved record should be published."}</p></div><span className="publication-state">{isScheduled ? certificateIssued ? "Scheduled" : "Certificate hold" : "Ready"}</span></header>
      <div className="publication-copy-grid"><div><span>Journal</span><strong>{record.journal}</strong></div><div><span>Volume and issue</span><strong>Volume {record.volume}, Issue {record.issue}</strong></div><div><span>Pages</span><strong>{record.pageStart}–{record.pageEnd}</strong></div><div><span>DOI</span><strong>{record.doi}</strong></div></div>
    </section>
    <section className="publication-card">
      <header><div><span>Publication date</span><h2>Schedule this record</h2><p>The status becomes Scheduled for publishing until the chosen date.</p></div></header>
      <div className="schedule-publication-control"><label>Publish on<input type="date" min={new Date().toISOString().slice(0, 10)} value={scheduledFor} disabled={!canManagePublication || !editingSchedule} onChange={(event) => { setScheduledFor(event.target.value); setSavedReview(false); }} /></label>{isScheduled ? <p className="publication-note">Scheduled for {new Date(`${scheduledFor || record.scheduledFor}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}. {certificateIssued ? "It will publish automatically when the date arrives." : "Issue the certificate to release the publication hold."}</p> : !canManagePublication ? <p className="publication-note">Admin approval is required before this record can be scheduled.</p> : null}{canManagePublication && isScheduled && !editingSchedule && <button type="button" onClick={() => { setEditingSchedule(true); setSavedReview(false); }}>Edit schedule</button>}{canManagePublication && editingSchedule && <button className="approve" disabled={!scheduledFor} onClick={() => { onSchedule(scheduledFor); setEditingSchedule(false); setSavedReview(true); }}><Save /> {isScheduled ? "Save review" : "Schedule publication"}</button>}{savedReview && <p className="publication-note">Schedule review saved. This is the publication date currently in use.</p>}</div>
    </section>
  </section>;
}

function ReviewField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={!onChange}
      />
    </label>
  );
}
function ManuscriptViewer({
  submission,
  kind,
  open,
  onOpenChange,
}: {
  submission: EditorialSubmission;
  kind: "pdf" | "word";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fileName =
    kind === "pdf"
      ? submission.fileName
      : submission.fileName.replace(/\.pdf$/i, ".docx");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fileName}</DialogTitle>
          <DialogDescription>
            {kind === "pdf" ? "PDF document" : "Word document"} · Local scroll
            preview
          </DialogDescription>
        </DialogHeader>
        <article className="manuscript-paper">
          <h1>{submission.title}</h1>
          <p className="manuscript-byline">
            {submission.author} · {submission.affiliation}
          </p>
          <h2>Abstract</h2>
          <p>{submission.abstract}</p>
          <h2>Introduction</h2>
          <p>
            This local preview represents the submitted manuscript. In
            production, the signed PDF or Word upload will be streamed into this
            viewer from secure file storage.
          </p>
          <h2>Method and discussion</h2>
          <p>
            The editorial team can scroll through the submitted text, compare it
            with the review record, and leave guidance before accepting or
            requesting changes.
          </p>
          <h2>Conclusion</h2>
          <p>
            Document preview is available for review only. The stored source
            file remains unchanged until a revised manuscript is submitted.
          </p>
        </article>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
async function downloadReceiptPdf(
  submission: EditorialSubmission,
  author: ReviewAuthor,
  manuscriptTitle: string,
  receipt: ReceiptSettings,
) {
  const { jsPDF } = await import("jspdf");
  const total = receipt.fee + receipt.tax - receipt.discount;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFontSize(20);
  pdf.text("Talikha Publishing", 48, 56);
  pdf.setFontSize(28);
  pdf.text("Official receipt", 48, 98);
  pdf.setFontSize(11);
  pdf.text(`Invoice: LS-INV-${submission.id.replace("LS-", "")}`, 48, 132);
  pdf.text(`Issued: ${submission.displayDate}`, 48, 150);
  pdf.text(`Received from: ${author.name}`, 48, 184);
  pdf.text(author.email, 48, 202);
  pdf.text(`For manuscript: ${manuscriptTitle}`, 48, 236, { maxWidth: 500 });
  pdf.line(48, 270, 548, 270);
  pdf.text(receipt.feeLabel, 48, 300);
  pdf.text(
    `PHP ${receipt.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    548,
    300,
    { align: "right" },
  );
  pdf.text("Tax", 48, 328);
  pdf.text(
    `PHP ${receipt.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    548,
    328,
    { align: "right" },
  );
  pdf.text("Promo discount", 48, 356);
  pdf.text(
    `- PHP ${receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    548,
    356,
    { align: "right" },
  );
  pdf.line(48, 374, 548, 374);
  pdf.setFontSize(14);
  pdf.text("Total due", 48, 405);
  pdf.text(
    `PHP ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    548,
    405,
    { align: "right" },
  );
  pdf.setFontSize(9);
  pdf.text(
    "Generated locally from the current submission review record.",
    48,
    760,
  );
  pdf.save(`receipt-${submission.id.toLowerCase()}.pdf`);
}
function PaymentProofViewer({
  submission,
  open,
  onOpenChange,
}: {
  submission: EditorialSubmission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment proof</DialogTitle>
          <DialogDescription>{`payment-proof-${submission.id.toLowerCase()}.jpg · JPG receipt · 428 KB`}</DialogDescription>
        </DialogHeader>
        <div className="attachment-image-wrap">
          <img
            src={paymentProofPreviewSrc(submission)}
            alt={`Payment proof submitted with ${submission.id}`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function paymentProofPreviewSrc(submission: EditorialSubmission) {
  const safe = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    <rect width="1200" height="1500" fill="#f7f8fb"/>
    <rect x="72" y="68" width="1056" height="1364" rx="30" fill="#ffffff" stroke="#d9dce5" stroke-width="4"/>
    <rect x="72" y="68" width="1056" height="220" rx="30" fill="#285fd5"/>
    <rect x="72" y="230" width="1056" height="58" fill="#285fd5"/>
    <text x="140" y="164" fill="#ffffff" font-family="Arial, sans-serif" font-size="62" font-weight="700">GCash</text>
    <text x="140" y="222" fill="#dbe7ff" font-family="Arial, sans-serif" font-size="30">Payment confirmation</text>
    <text x="140" y="394" fill="#6b7280" font-family="Arial, sans-serif" font-size="30">Amount paid</text>
    <text x="140" y="486" fill="#111827" font-family="Arial, sans-serif" font-size="82" font-weight="700">₱2,500.00</text>
    <line x1="140" y1="554" x2="1060" y2="554" stroke="#e2e5ec" stroke-width="3"/>
    <text x="140" y="642" fill="#6b7280" font-family="Arial, sans-serif" font-size="28">Reference number</text>
    <text x="140" y="694" fill="#111827" font-family="Arial, sans-serif" font-size="40" font-weight="700">${safe(submission.id)}</text>
    <text x="140" y="798" fill="#6b7280" font-family="Arial, sans-serif" font-size="28">Date</text>
    <text x="140" y="850" fill="#111827" font-family="Arial, sans-serif" font-size="40" font-weight="700">${safe(submission.displayDate)}</text>
    <text x="140" y="954" fill="#6b7280" font-family="Arial, sans-serif" font-size="28">Sender</text>
    <text x="140" y="1006" fill="#111827" font-family="Arial, sans-serif" font-size="40" font-weight="700">${safe(submission.author)}</text>
    <text x="140" y="1110" fill="#6b7280" font-family="Arial, sans-serif" font-size="28">Purpose</text>
    <text x="140" y="1162" fill="#111827" font-family="Arial, sans-serif" font-size="36" font-weight="700">Publication processing fee</text>
    <rect x="140" y="1246" width="920" height="100" rx="18" fill="#e8f7ef"/>
    <text x="184" y="1308" fill="#207445" font-family="Arial, sans-serif" font-size="36" font-weight="700">Payment completed</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function ReceiptPreview({
  submission,
  author,
  manuscriptTitle,
  receipt,
}: {
  submission: EditorialSubmission;
  author: ReviewAuthor;
  manuscriptTitle: string;
  receipt: ReceiptSettings;
}) {
  const total = receipt.fee + receipt.tax - receipt.discount;
  return (
    <aside className="receipt-preview">
      <div className="receipt-paper">
        <div className="receipt-fold" />
        <header>
          <div>
            <span>Talikha Publishing</span>
            <h2>Official receipt</h2>
          </div>
          <div className="receipt-mark">TP</div>
        </header>
        <div className="receipt-number">
          <span>Invoice number</span>
          <strong>{`LS-INV-${submission.id.replace("LS-", "")}`}</strong>
        </div>
        <div className="receipt-parties">
          <div>
            <span>Received from</span>
            <strong>{author.name}</strong>
            <p>
              {author.email}
              <br />
              {author.affiliation}
            </p>
          </div>
          <div>
            <span>Issued by</span>
            <strong>Talikha Publishing</strong>
            <p>
              Editorial and publication services
              <br />
              Manila, Philippines
            </p>
          </div>
        </div>
        <div className="receipt-dates">
          <div>
            <span>Issued date</span>
            <strong>{submission.displayDate}</strong>
          </div>
          <div>
            <span>Payment status</span>
            <strong className={submission.paymentProof ? "paid" : undefined}>
              <CheckCircle2 />
              {submission.paymentProof ? "Paid" : "Pending"}
            </strong>
          </div>
        </div>
        <div className="receipt-table">
          <div>
            <span>Description</span>
            <span>Qty</span>
            <span>Amount</span>
          </div>
          <div>
            <span>
              <strong>{receipt.feeLabel}</strong>
              <small>{`${submission.journal} · ${submission.id} · ${manuscriptTitle}`}</small>
            </span>
            <span>1</span>
            <span>{`₱${receipt.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</span>
          </div>
        </div>
        <div className="receipt-totals">
          <div>
            <span>Subtotal</span>
            <strong>{`₱${receipt.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>{`₱${receipt.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</strong>
          </div>
          <div>
            <span>Promo discount</span>
            <strong>{`−₱${receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</strong>
          </div>
          <div className="total-due">
            <span>{submission.paymentProof ? "Total paid" : "Amount due"}</span>
            <strong>{`₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</strong>
          </div>
        </div>
        <div className="receipt-note">
          <FileCheck2 />
          <div>
            <strong>
              {submission.paymentProof ? "Payment verified" : "Payment pending"}
            </strong>
            <p>
              This receipt is attached to submission {submission.id} for
              editorial review.
            </p>
          </div>
        </div>
        <footer>
          <span>Thank you for submitting to Talikha Publishing.</span>
          <small>
            Receipt generated for review · Not yet connected to production
            records
          </small>
        </footer>
      </div>
    </aside>
  );
}
function ScheduleView() {
  const [tab, setTab] = useState("All scheduled");
  const tabs = [
    { name: "All scheduled", count: "", icon: LayoutGrid },
    { name: "Meetings", count: "8", icon: MessageSquare },
    { name: "Events", count: "4", icon: CalendarDays },
    { name: "Conflicted", count: "2", icon: AlertTriangle },
    { name: "Canceled", count: "1", icon: CircleX },
  ];
  return (
    <section className="schedule-page">
      <div className="schedule-heading">
        <div className="schedule-date-icon">
          <CalendarDays />
        </div>
        <div>
          <h1>July 17, 2026</h1>
          <p>2 meetings and 1 event are scheduled today.</p>
        </div>
      </div>
      <div className="schedule-controls">
        <button className="active">Today</button>
        <button>
          Next 7 days <ChevronDown />
        </button>
        <button>
          <CalendarDays /> Jul 17 – Jul 23, 2026
        </button>
      </div>
      <div className="schedule-tabs">
        {tabs.map(({ name, count, icon: Icon }) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => setTab(name)}
          >
            <Icon />
            {name}
            {count && <span>({count})</span>}
          </button>
        ))}
      </div>
      <div className="schedule-summary">
        <article>
          <div>
            <h2>Editorial Team Meeting</h2>
            <p>9:00 AM – 10:00 AM</p>
          </div>
          <ChevronDown />
          <footer className="today">
            <Clock3 /> Today <button>Join meeting</button>
          </footer>
        </article>
        <article>
          <div>
            <h2>Issue Release Review</h2>
            <p>10:30 AM – 12:00 PM</p>
          </div>
          <ChevronDown />
          <footer className="conflict">
            <AlertTriangle /> 2 conflicts <button>See conflicts</button>
          </footer>
        </article>
        <article>
          <div>
            <h2>Author Orientation</h2>
            <p>2:00 PM – 3:00 PM</p>
          </div>
          <ChevronDown />
          <footer className="canceled">
            <CircleX /> Canceled
          </footer>
        </article>
      </div>
      <div className="calendar-shell">
        <div className="calendar-top">
          <div className="calendar-arrows">
            <button>
              <ChevronLeft />
            </button>
            <button>
              <ChevronRight />
            </button>
          </div>
          {["17 FRI", "18 SAT", "19 SUN", "20 MON"].map((x) => (
            <strong key={x}>{x}</strong>
          ))}
        </div>
        <div className="calendar-body">
          <div className="time-column">
            {["9 AM", "10 AM", "11 AM", "12 PM", "1 PM"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <div className="day-column">
            <Event
              kind="neutral"
              top={16}
              height={58}
              title="Editorial standup"
              time="9:00 – 9:30 AM"
            />
            <Event
              kind="neutral"
              top={84}
              height={58}
              title="Author file review"
              time="9:30 – 10:00 AM"
            />
            <Event
              kind="event"
              top={250}
              height={160}
              title="Workshop: Writing for publication"
              time="11:30 AM – 1:00 PM"
              footer="Conference room"
            />
          </div>
          <div className="day-column">
            <Event
              kind="meeting"
              top={16}
              height={67}
              title="Peer review meeting"
              time="9:00 – 9:30 AM"
            />
            <Event
              kind="meeting"
              top={102}
              height={142}
              title="Editorial board training"
              time="10:00 – 11:30 AM"
              footer="5 attendees · Online"
            />
            <Event
              kind="meeting"
              top={300}
              height={60}
              title="Issue planning review"
              time="12:00 – 12:30 PM"
            />
          </div>
          <div className="day-column">
            <Event
              kind="meeting"
              top={75}
              height={65}
              title="Journal strategy discussion"
              time="9:30 – 10:00 AM"
            />
            <Event
              kind="meeting"
              top={220}
              height={62}
              title="Production planning"
              time="11:00 – 11:30 AM"
            />
            <Event
              kind="meeting"
              top={292}
              height={120}
              title="Publication roadmap"
              time="11:30 AM – 1:00 PM"
              footer="4 attendees · Online"
            />
          </div>
          <div className="day-column">
            <Event
              kind="event"
              top={16}
              height={94}
              title="InQuira release"
              time="9:00 – 10:00 AM"
            />
            <Event
              kind="neutral"
              top={174}
              height={60}
              title="Metadata check"
              time="10:30 – 11:00 AM"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
function Event({
  kind,
  top,
  height,
  title,
  time,
  footer,
}: {
  kind: string;
  top: number;
  height: number;
  title: string;
  time: string;
  footer?: string;
}) {
  return (
    <article className={`calendar-event ${kind}`} style={{ top, height }}>
      <strong>{title}</strong>
      <span>{time}</span>
      {footer && (
        <small>
          {kind === "event" ? <MapPin /> : <Video />}
          {footer}
        </small>
      )}
    </article>
  );
}
type ScheduleTask = {
  id: string;
  title: string;
  day: number;
  start: string;
  end: string;
  type: "meeting" | "event" | "neutral";
  details: string;
  location: string;
  status: "scheduled" | "canceled";
};
const initialScheduleTasks: ScheduleTask[] = [
  {
    id: "task-1",
    title: "Editorial standup",
    day: 0,
    start: "09:00",
    end: "09:30",
    type: "neutral",
    details: "Daily editorial coordination",
    location: "Editorial room",
    status: "scheduled",
  },
  {
    id: "task-2",
    title: "Author file review",
    day: 0,
    start: "09:30",
    end: "10:00",
    type: "neutral",
    details: "Check submitted author files",
    location: "Admin workspace",
    status: "scheduled",
  },
  {
    id: "task-3",
    title: "Workshop: Writing for publication",
    day: 0,
    start: "11:30",
    end: "13:00",
    type: "event",
    details: "Author development workshop",
    location: "Conference room",
    status: "scheduled",
  },
  {
    id: "task-4",
    title: "Peer review meeting",
    day: 1,
    start: "09:00",
    end: "09:30",
    type: "meeting",
    details: "Discuss current peer reviews",
    location: "Online",
    status: "scheduled",
  },
  {
    id: "task-5",
    title: "Editorial board training",
    day: 1,
    start: "10:00",
    end: "11:30",
    type: "meeting",
    details: "Board workflow training",
    location: "Online",
    status: "scheduled",
  },
  {
    id: "task-6",
    title: "Issue planning review",
    day: 1,
    start: "12:00",
    end: "12:30",
    type: "meeting",
    details: "Review issue production plan",
    location: "Online",
    status: "scheduled",
  },
  {
    id: "task-7",
    title: "Journal strategy discussion",
    day: 2,
    start: "09:30",
    end: "10:00",
    type: "meeting",
    details: "Discuss journal development",
    location: "Editorial room",
    status: "scheduled",
  },
  {
    id: "task-8",
    title: "Production planning",
    day: 2,
    start: "11:00",
    end: "11:30",
    type: "meeting",
    details: "Coordinate publication production",
    location: "Online",
    status: "scheduled",
  },
  {
    id: "task-9",
    title: "Publication roadmap",
    day: 2,
    start: "11:30",
    end: "13:00",
    type: "meeting",
    details: "Plan upcoming publication milestones",
    location: "Online",
    status: "scheduled",
  },
  {
    id: "task-10",
    title: "InQuira release",
    day: 3,
    start: "09:00",
    end: "10:00",
    type: "event",
    details: "Release the new journal issue",
    location: "Publishing room",
    status: "scheduled",
  },
  {
    id: "task-11",
    title: "Metadata check",
    day: 3,
    start: "10:30",
    end: "11:00",
    type: "neutral",
    details: "Final metadata quality check",
    location: "Admin workspace",
    status: "scheduled",
  },
];
const emptyTask: ScheduleTask = {
  id: "",
  title: "",
  day: 0,
  start: "09:00",
  end: "09:30",
  type: "meeting",
  details: "",
  location: "",
  status: "scheduled",
};
function FunctionalScheduleView({ createRequested = false, onCreateOpened }: { createRequested?: boolean; onCreateOpened?: () => void }) {
  const [tasks, setTasks] = useState<ScheduleTask[]>(() => {
      try {
        return (
          JSON.parse(localStorage.getItem("lakbay-admin-schedule") || "") ||
          initialScheduleTasks
        );
      } catch {
        return initialScheduleTasks;
      }
    }),
    [tab, setTab] = useState("All scheduled"),
    [editing, setEditing] = useState<ScheduleTask | null>(null),
    [error, setError] = useState("");
  useEffect(
    () => localStorage.setItem("lakbay-admin-schedule", JSON.stringify(tasks)),
    [tasks],
  );
  useEffect(() => {
    const onSaved = (e: Event) => {
      const task = (e as CustomEvent<ScheduleTask>).detail;
      if (!task) return;
      setTasks((prev) => prev.some((t) => t.id === task.id) ? prev.map((t) => t.id === task.id ? task : t) : [...prev, task]);
    };
    const onRemoved = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      setTasks((prev) => prev.filter((t) => t.id !== id));
    };
    window.addEventListener("talikha:task-saved", onSaved);
    window.addEventListener("talikha:task-removed", onRemoved);
    return () => { window.removeEventListener("talikha:task-saved", onSaved); window.removeEventListener("talikha:task-removed", onRemoved); };
  }, []);
  const visible = tasks.filter(
    (t) =>
      tab === "All scheduled" ||
      (tab === "Meetings" && t.type === "meeting") ||
      (tab === "Events" && t.type === "event") ||
      (tab === "Canceled" && t.status === "canceled"),
  );
  const openNew = () => {
    setEditing({ ...emptyTask, id: `task-${Date.now()}` });
    setError("");
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- opens editor dialog in response to prop signal; not a state mirror
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openNew/onCreateOpened are stable callbacks recreated each render; effect intentionally fires only when createRequested flips
  useEffect(() => {
    if (!createRequested) return;
    openNew();
    onCreateOpened?.();
  }, [createRequested]);
  const save = () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.start || !editing.end) {
      setError("Add a title, start time, and end time.");
      return;
    }
    if (editing.end <= editing.start) {
      setError("End time must be later than start time.");
      return;
    }
    setTasks((current) =>
      current.some((t) => t.id === editing.id)
        ? current.map((t) => (t.id === editing.id ? editing : t))
        : [...current, editing],
    );
    setEditing(null);
    setError("");
  };
  const remove = () => {
    if (!editing) return;
    setTasks(tasks.filter((t) => t.id !== editing.id));
    setEditing(null);
  };
  const tabs = ["All scheduled", "Meetings", "Events", "Canceled"];
  return (
    <section className="schedule-page functional">
      <div className="schedule-heading functional-heading">
        <div className="schedule-date-icon">
          <CalendarDays />
        </div>
        <div>
          <h1>July 17, 2026</h1>
          <p>
            {
              tasks.filter((t) => t.day === 0 && t.status === "scheduled")
                .length
            }{" "}
            tasks scheduled today.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus />
          Create task
        </Button>
      </div>
      <div className="schedule-controls">
        <button className="active">Today</button>
        <button>
          Next 7 days <ChevronDown />
        </button>
        <button>
          <CalendarDays /> Jul 17 – Jul 20, 2026
        </button>
      </div>
      <div className="schedule-tabs">
        {tabs.map((name) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => setTab(name)}
          >
            {name === "All scheduled" ? (
              <LayoutGrid />
            ) : name === "Meetings" ? (
              <MessageSquare />
            ) : name === "Events" ? (
              <CalendarDays />
            ) : (
              <CircleX />
            )}
            {name}
            <span>
              (
              {name === "All scheduled"
                ? tasks.length
                : name === "Meetings"
                  ? tasks.filter((t) => t.type === "meeting").length
                  : name === "Events"
                    ? tasks.filter((t) => t.type === "event").length
                    : tasks.filter((t) => t.status === "canceled").length}
              )
            </span>
          </button>
        ))}
      </div>
      <div className="schedule-summary functional-summary">
        <article>
          <div>
            <h2>Today’s workload</h2>
            <p>
              {
                tasks.filter((t) => t.day === 0 && t.status === "scheduled")
                  .length
              }{" "}
              active tasks
            </p>
          </div>
          <Clock3 />
          <footer className="today">
            <CheckCircle2 />
            Schedule ready
          </footer>
        </article>
        <article>
          <div>
            <h2>Meetings</h2>
            <p>
              {
                tasks.filter(
                  (t) => t.type === "meeting" && t.status === "scheduled",
                ).length
              }{" "}
              scheduled
            </p>
          </div>
          <MessageSquare />
          <footer className="conflict">
            <Video />
            Online and in person
          </footer>
        </article>
        <article>
          <div>
            <h2>Canceled</h2>
            <p>{tasks.filter((t) => t.status === "canceled").length} tasks</p>
          </div>
          <CircleX />
          <footer className="canceled">
            <CircleX />
            Not shown in active views
          </footer>
        </article>
      </div>
      <div className="calendar-shell">
        <div className="calendar-top">
          <div className="calendar-arrows">
            <button>
              <ChevronLeft />
            </button>
            <button>
              <ChevronRight />
            </button>
          </div>
          {["17 FRI", "18 SAT", "19 SUN", "20 MON"].map((x) => (
            <strong key={x}>{x}</strong>
          ))}
        </div>
        <div className="calendar-body">
          <div className="time-column">
            {["9 AM", "10 AM", "11 AM", "12 PM", "1 PM"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          {[0, 1, 2, 3].map((day) => (
            <div className="day-column functional-day" key={day}>
              {visible
                .filter((t) => t.day === day)
                .map((task) => (
                  <button
                    key={task.id}
                    className={`calendar-event ${task.type} ${task.status} ${calendarEventDensity(task)}`}
                    style={taskPosition(task)}
                    onClick={() => {
                      setEditing({ ...task });
                      setError("");
                    }}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {formatTime(task.start)} – {formatTime(task.end)}
                    </span>
                    {task.location && (
                      <small>
                        {task.type === "event" ? <MapPin /> : <Video />}
                        {task.location}
                      </small>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
      <TaskEditor
          task={editing || { id: "", title: "", day: 0, start: "09:00", end: "10:00", type: "meeting", status: "scheduled", location: "", details: "" }}
          setTask={setEditing}
          save={save}
          remove={remove}
          close={() => setEditing(null)}
          error={error}
          isExisting={editing ? tasks.some((t) => t.id === editing.id) : false}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
        />
    </section>
  );
}
function taskPosition(task: ScheduleTask) {
  const [startH, startM] = task.start.split(":").map(Number),
    [endH, endM] = task.end.split(":").map(Number);
  const top = ((startH * 60 + startM - 540) / 60) * 92 + 10;
  const height = Math.max(
    50,
    ((endH * 60 + endM - (startH * 60 + startM)) / 60) * 92 - 8,
  );
  return { top, height };
}
function calendarEventDensity(task: ScheduleTask) {
  const [startH, startM] = task.start.split(":").map(Number);
  const [endH, endM] = task.end.split(":").map(Number);
  const minutes = endH * 60 + endM - (startH * 60 + startM);
  return minutes < 60 ? "compact" : minutes < 75 ? "short" : "spacious";
}
function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function OverviewTaskEditor({
  open,
  seed,
  onClose,
  onSave,
}: {
  open: boolean;
  seed: ScheduleTask;
  onClose: () => void;
  onSave: (task: ScheduleTask) => void;
}) {
  const [task, setTask] = useState<ScheduleTask>(seed);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setTask(seed);
      setError("");
    }
  }, [open, seed]);
  const save = () => {
    if (!task.title.trim() || !task.start || !task.end) {
      setError("Add a title, start time, and end time.");
      return;
    }
    if (task.end <= task.start) {
      setError("End time must be later than start time.");
      return;
    }
    onSave(task);
  };
  return (
    <TaskEditor
      task={task}
      setTask={setTask}
      save={save}
      remove={() => {}}
      close={onClose}
      error={error}
      isExisting={false}
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
    />
  );
}
function TaskEditor({
  task,
  setTask,
  save,
  remove,
  close,
  error,
  isExisting,
  open,
  onOpenChange,
}: {
  task: ScheduleTask;
  setTask: (task: ScheduleTask) => void;
  save: () => void;
  remove: () => void;
  close: () => void;
  error: string;
  isExisting: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="task-dialog sm:max-w-[34rem] max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="task-dialog__head">
          <span className="task-dialog__chip" aria-hidden="true">
            <CalendarDays size={19} strokeWidth={1.9} />
          </span>
          <div>
            <DialogTitle>{isExisting ? "Edit task" : "Create task"}</DialogTitle>
            <DialogDescription>
              {isExisting ? "Customize schedule" : "New schedule item"}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="task-editor-fields">
          <label className="full">
            Task title
            <input
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              placeholder="Enter task title"
            />
          </label>
          <label>
            Day
            <select
              value={task.day}
              onChange={(e) =>
                setTask({ ...task, day: Number(e.target.value) })
              }
            >
              <option value={0}>Friday, July 17</option>
              <option value={1}>Saturday, July 18</option>
              <option value={2}>Sunday, July 19</option>
              <option value={3}>Monday, July 20</option>
            </select>
          </label>
          <label>
            Task type
            <select
              value={task.type}
              onChange={(e) =>
                setTask({
                  ...task,
                  type: e.target.value as ScheduleTask["type"],
                })
              }
            >
              <option value="meeting">Meeting · Blue</option>
              <option value="event">Event · Peach</option>
              <option value="neutral">General · Gray</option>
            </select>
          </label>
          <label>
            Start time
            <input
              type="time"
              value={task.start}
              min="09:00"
              max="13:00"
              onChange={(e) => setTask({ ...task, start: e.target.value })}
            />
          </label>
          <label>
            End time
            <input
              type="time"
              value={task.end}
              min="09:00"
              max="13:30"
              onChange={(e) => setTask({ ...task, end: e.target.value })}
            />
          </label>
          <label className="full">
            Location or meeting link
            <input
              value={task.location}
              onChange={(e) => setTask({ ...task, location: e.target.value })}
              placeholder="Conference room or online"
            />
          </label>
          <label className="full">
            Details
            <textarea
              value={task.details}
              onChange={(e) => setTask({ ...task, details: e.target.value })}
              placeholder="Add notes or instructions"
            />
          </label>
          <label className="task-status full">
            Status
            <select
              value={task.status}
              onChange={(e) =>
                setTask({
                  ...task,
                  status: e.target.value as ScheduleTask["status"],
                })
              }
            >
              <option value="scheduled">Scheduled</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="task-error">
            <AlertTriangle />
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {isExisting ? (
            <Button variant="destructive" size="sm" className="task-btn task-btn--danger" onClick={remove}>
              <Trash2 />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="task-btn" onClick={close}>Cancel</Button>
            <Button size="sm" className="task-btn task-btn--primary" onClick={save}>
              <Save />
              Save task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
const authors = [
  { name: "Dr. Elena Marasigan", title: "PhD, Environmental Studies", email: "elena.marasigan@gmail.com", occupation: "Research Professor", division: "Environmental Sciences", image: portraits[0] },
  { name: "Prof. Nina Villareal", title: "MA, Development Studies", email: "nina.villareal@gmail.com", occupation: "Managing Editor", division: "Editorial Management", image: portraits[1] },
  { name: "Marco Luis Dela Cruz", title: "MA, Filipino Linguistics", email: "marco.delacruz@gmail.com", occupation: "Section Editor", division: "Language and Culture", image: portraits[2] },
  { name: "Alyssa Santos", title: "MFA, Creative Writing", email: "alyssa.santos@gmail.com", occupation: "Copy Editor", division: "Editorial Production", image: portraits[3] },
  { name: "Dr. Tomas Rivera", title: "PhD, Public Health", email: "tomas.rivera@gmail.com", occupation: "Peer Reviewer", division: "Health Sciences", image: portraits[4] },
  { name: "Dr. Isabel Reyes", title: "PhD, Anthropology", email: "isabel.reyes@gmail.com", occupation: "Associate Professor", division: "Social Sciences", image: portraits[0] },
  { name: "Prof. Gabriel Aquino", title: "MS, Agricultural Systems", email: "gabriel.aquino@gmail.com", occupation: "Research Fellow", division: "Agricultural Studies", image: portraits[1] },
  { name: "Dr. Carmela Flores", title: "EdD, Curriculum Studies", email: "carmela.flores@gmail.com", occupation: "Academic Adviser", division: "Education", image: portraits[2] },
  { name: "Miguel Bautista", title: "MA, Communication", email: "miguel.bautista@gmail.com", occupation: "Editorial Associate", division: "Editorial Production", image: portraits[3] },
  { name: "Dr. Teresa Lim", title: "PhD, Economics", email: "teresa.lim@gmail.com", occupation: "Peer Reviewer", division: "Business and Economics", image: portraits[4] },
];

type UnifiedAuthor = {
  name: string;
  title: string;
  email: string;
  occupation: string;
  division: string;
  image: string;
  type: "staff" | "author";
  journals: string[];
  submissionCount: number;
  publishedCount: number;
};

function buildUnifiedAuthors(submissions: EditorialSubmission[]): UnifiedAuthor[] {
  const staff: UnifiedAuthor[] = authors.map((a) => ({
    ...a,
    type: "staff" as const,
    journals: [],
    submissionCount: 0,
    publishedCount: 0,
  }));
  const byEmail = new Map<string, UnifiedAuthor>();
  for (const s of submissions) {
    const key = (s.email || s.author).toLowerCase().trim();
    if (!key) continue;
    const realPhoto = (s.authors ?? []).find((a) => (a.email || "").toLowerCase().trim() === key)?.photo || s.authors?.[0]?.photo || null;
    const existing = byEmail.get(key);
    if (existing) {
      existing.submissionCount++;
      if (s.status === "Published" || s.status === "Accepted") existing.publishedCount++;
      if (!existing.journals.includes(s.journal)) existing.journals.push(s.journal);
      if (realPhoto) existing.image = realPhoto;
    } else {
      const staffMatch = staff.find((st) => st.email.toLowerCase() === key);
      if (staffMatch) {
        staffMatch.type = "staff";
        staffMatch.submissionCount++;
        if (s.status === "Published" || s.status === "Accepted") staffMatch.publishedCount++;
        if (!staffMatch.journals.includes(s.journal)) staffMatch.journals.push(s.journal);
        byEmail.set(key, staffMatch);
      } else {
        byEmail.set(key, {
          name: s.author,
          title: "",
          email: s.email,
          occupation: "Submitting author",
          division: s.affiliation || "—",
          image: realPhoto || portraits[Math.abs(key.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % portraits.length],
          type: "author",
          journals: [s.journal],
          submissionCount: 1,
          publishedCount: s.status === "Published" || s.status === "Accepted" ? 1 : 0,
        });
      }
    }
  }
  const derived = [...byEmail.values()].filter((a) => a.type === "author");
  return [...staff, ...derived];
}

const authorsCsvHref = (list: UnifiedAuthor[]) => `data:text/csv;charset=utf-8,${encodeURIComponent([["Name", "Academic title", "Email", "Occupation", "Division", "Type", "Journals", "Submissions", "Published"], ...list.map((a) => [a.name, a.title, a.email, a.occupation, a.division, a.type, a.journals.join("; "), String(a.submissionCount), String(a.publishedCount)])].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"))}`;

function AuthorDetailPanel({
  author,
  submissions,
  open,
  onOpenChange,
}: {
  author: UnifiedAuthor;
  submissions: EditorialSubmission[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const authorKey = author.name
    .replace(/^(Dr\.|Prof\.)\s*/, "")
    .replace("Luis ", "")
    .toLowerCase();
  const records = submissions.filter(
    (submission) =>
      submission.email.toLowerCase() === author.email.toLowerCase() ||
      submission.author.toLowerCase() === authorKey,
  );
  const approved = records.filter(
    (submission) =>
      submission.status === "Accepted" || submission.status === "Published",
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{author.name}</SheetTitle>
        </SheetHeader>
        <div className="author-profile-intro">
          <Avatar src={author.image} size="lg" />
          <div>
            <p>{author.title || author.occupation}</p>
            <span>
              <span className={author.type === "staff" ? "tp-pill tp-pill--green" : "tp-pill tp-pill--blue"}>{author.type === "staff" ? "Staff" : "Author"}</span>
              {" "}{author.division}
            </span>
          </div>
        </div>
        <dl className="author-profile-details">
          <div><dt>Email</dt><dd>{author.email || "—"}</dd></div>
          <div><dt>Journals</dt><dd>{author.journals.length ? author.journals.join(", ") : "—"}</dd></div>
          <div><dt>Role</dt><dd>{author.occupation}</dd></div>
        </dl>
        <div className="author-profile-metrics">
          <div><strong>{author.submissionCount || records.length}</strong><span>Submissions</span></div>
          <div><strong>{author.publishedCount || approved.length}</strong><span>Published</span></div>
          <div><strong>{author.journals.length}</strong><span>Journals</span></div>
        </div>
        <section className="author-profile-studies">
          <header><h3>Submission record</h3><span>{records.length} linked</span></header>
          {records.length ? (
            records.map((submission) => (
              <article key={submission.id}>
                <div>
                  <strong>{submission.title}</strong>
                  <span>{submission.journal} · {submission.id}</span>
                </div>
                <span className={`submission-status ${submission.status.toLowerCase().replaceAll(" ", "-")}`}>{submission.status}</span>
              </article>
            ))
          ) : (
            <p>No submissions linked to this profile yet.</p>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}

function AuthorsView({
  submissions,
  onOpenSubmission,
}: {
  submissions: EditorialSubmission[];
  onOpenSubmission: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("All divisions");
  const [typeFilter, setTypeFilter] = useState<"all" | "staff" | "author">("all");
  const [page, setPage] = useState(1);
  const [selectedAuthor, setSelectedAuthor] = useState<UnifiedAuthor | null>(null);
  const unified = buildUnifiedAuthors(submissions);
  const divisions = ["All divisions", ...new Set(unified.map((a) => a.division).filter((d) => d && d !== "—"))];
  const filtered = unified.filter(
    (a) =>
      (division === "All divisions" || a.division === division) &&
      (typeFilter === "all" || a.type === typeFilter) &&
      [a.name, a.email, a.occupation, a.division, ...a.journals].join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const perPage = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const rows = filtered.slice((page - 1) * perPage, page * perPage);
  const changeQuery = (value: string) => { setQuery(value); setPage(1); };
  const csvHref = authorsCsvHref(unified);
  return (
    <section className="authors-page">
      <div className="authors-heading">
        <div>
          <h1>Authors</h1>
          <p>{unified.length} people · {unified.filter((a) => a.type === "author").length} submitters · {unified.filter((a) => a.type === "staff").length} staff</p>
        </div>
        <a className="authors-export" href={csvHref} download="talikha-authors.csv"><Download size={14} strokeWidth={1.9} /> Export CSV</a>
      </div>
      <div className="authors-controls">
        <label><Search size={14} strokeWidth={1.9} /><input value={query} onChange={(e) => changeQuery(e.target.value)} placeholder="Search by name, email, journal…" /></label>
        <div className="division-filter">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as "all" | "staff" | "author"); setPage(1); }}>
            <option value="all">All types</option>
            <option value="author">Submitters</option>
            <option value="staff">Staff</option>
          </select>
          <ChevronDown size={13} strokeWidth={2} />
        </div>
        <div className="division-filter">
          <select value={division} onChange={(e) => { setDivision(e.target.value); setPage(1); }}>
            {divisions.map((d) => <option key={d}>{d}</option>)}
          </select>
          <ChevronDown size={13} strokeWidth={2} />
        </div>
      </div>
      <div className="authors-table-wrap">
        <div className="authors-table">
          <div className="author-row author-labels">
            <span>Name</span>
            <span>Role</span>
            <span>Journals</span>
            <span>Subs</span>
            <span>Pub</span>
            <span />
          </div>
          {rows.map((a) => (
            <button className="author-row" type="button" key={a.email + a.name} onClick={() => setSelectedAuthor(a)}>
              <span className="author-identity">
                <Avatar src={a.image} />
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.email || a.division}</small>
                </span>
              </span>
              <span>{a.occupation}</span>
              <span className="author-journals">{a.journals.length ? a.journals.map((j) => <span key={j} className="tp-pill tp-pill--green">{j}</span>) : <span className="tp-pill tp-pill--neutral">—</span>}</span>
              <span className="author-count">{a.submissionCount}</span>
              <span className="author-count">{a.publishedCount}</span>
              <MoreVertical size={14} strokeWidth={1.9} />
            </button>
          ))}
          {!rows.length && (
            <div className="authors-empty"><Users size={20} strokeWidth={1.8} /><strong>No authors found</strong><span>Try changing the search or filters.</span></div>
          )}
        </div>
        <footer className="authors-footer">
          <span>Showing {rows.length ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, filtered.length)} of {filtered.length}</span>
          <div>
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} strokeWidth={2} /></button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((n) => (
              <button className={page === n ? "active" : ""} onClick={() => setPage(n)} key={n}>{n}</button>
            ))}
            <button disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={14} strokeWidth={2} /></button>
          </div>
        </footer>
      </div>
      {selectedAuthor && (
        <AuthorDetailPanel
          author={selectedAuthor}
          submissions={submissions}
          open={!!selectedAuthor}
          onOpenChange={(open) => { if (!open) setSelectedAuthor(null); }}
        />
      )}
    </section>
  );
}

function FeaturedView() {
  const [featured, setFeatured] = useState(
    () => new Set([studyRecords[0].reference, studyRecords[2].reference]),
  );
  const toggle = (id: string) =>
    setFeatured((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <section className="utility-page">
      <PageHeading
        icon={Star}
        title="Featured studies"
        copy="Choose the studies highlighted on public discovery pages. Changes in this prototype are kept for this session only."
      />
      <div className="utility-grid">
        {studyRecords.map((study) => (
          <article className="utility-card" key={study.reference}>
            <div className="utility-card-icon">
              <FileText />
            </div>
            <div>
              <span
                className={`status-pill ${study.status.toLowerCase().replaceAll(" ", "-")}`}
              >
                {study.status}
              </span>
              <h2>{study.title}</h2>
              <p>
                {study.author} · {study.journal}
              </p>
            </div>
            <button
              className={
                featured.has(study.reference) ? "toggle active" : "toggle"
              }
              onClick={() => toggle(study.reference)}
              aria-pressed={featured.has(study.reference)}
            >
              <span />
              {featured.has(study.reference) ? "Featured" : "Not featured"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportsView() {
  return (
    <section className="utility-page">
      <PageHeading
        icon={FileCheck2}
        title="Editorial reports"
        copy="A concise operational view of the sample records currently available in this design prototype."
      />
      <div className="report-metrics">
        <Metric label="Studies in prototype" value={studyRecords.length} />
        <Metric label="Authors in prototype" value={authors.length} />
        <Metric
          label="Published"
          value={studyRecords.filter((x) => x.status === "Published").length}
        />
        <Metric
          label="Needs action"
          value={studyRecords.filter((x) => x.status !== "Published").length}
        />
      </div>
      <div className="report-layout">
        <section className="report-panel">
          <header>
            <h2>Workflow distribution</h2>
            <span>Prototype records</span>
          </header>
          {["New", "In review", "Revision", "Published"].map((status) => {
            const count = studyRecords.filter(
              (x) => x.status === status,
            ).length;
            return (
              <div className="report-row" key={status}>
                <span>{status}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(8, (count / studyRecords.length) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </section>
        <section className="report-panel">
          <header>
            <h2>Data status</h2>
            <span>Integration readiness</span>
          </header>
          <div className="readiness-item">
            <CheckCircle2 />
            <div>
              <strong>Editorial prototype</strong>
              <p>Interactive views and local schedule storage are available.</p>
            </div>
          </div>
          <div className="readiness-item pending">
            <Clock3 />
            <div>
              <strong>Live reporting</strong>
              <p>
                Connect protected production records before using these figures
                operationally.
              </p>
            </div>
          </div>
          <button className="disabled-action" disabled>
            <Download />
            Export live report
          </button>
        </section>
      </div>
    </section>
  );
}

function SettingsView() {
  const [keyboard, setKeyboard] = useState(true),
    [compact, setCompact] = useState(false),
    [digest, setDigest] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <section className="utility-page">
      <PageHeading
        icon={Settings}
        title="Settings"
        copy="Personalize this local admin preview. Production account and security settings will be connected later."
      />
      <section className="settings-panel">
        <SettingRow
          title="Keyboard focus indicators"
          copy="Show a clear focus ring while navigating with the keyboard."
          checked={keyboard}
          setChecked={setKeyboard}
        />
        <SettingRow
          title="Compact tables"
          copy="Reduce row spacing on record-heavy screens."
          checked={compact}
          setChecked={setCompact}
        />
        <SettingRow
          title="Daily editorial digest"
          copy="Email delivery is not connected in this prototype."
          checked={digest}
          setChecked={setDigest}
          disabled
        />
        <footer>
          <span>
            {saved
              ? "Preferences saved in this session."
              : "These preferences affect this preview only."}
          </span>
          <button onClick={() => setSaved(true)}>
            <Save />
            Save preferences
          </button>
        </footer>
      </section>
    </section>
  );
}

function SupportView() {
  return (
    <section className="utility-page">
      <PageHeading
        icon={Headphones}
        title="Help and support"
        copy="Guidance for using the editorial workspace and understanding which services are not connected yet."
      />
      <div className="support-grid">
        <article>
          <BookOpen />
          <h2>Editorial workflow</h2>
          <p>
            Review submissions, maintain author records, prepare studies, and
            organize publication schedules.
          </p>
          <button
            onClick={() =>
              alert(
                "The full editorial guide will be connected with production documentation.",
              )
            }
          >
            Open guide
          </button>
        </article>
        <article>
          <ShieldCheck />
          <h2>Security and access</h2>
          <p>
            The production panel will use protected administrator access and
            server-backed permissions.
          </p>
          <button
            onClick={() =>
              alert(
                "Production access support is not connected in this preview.",
              )
            }
          >
            Access help
          </button>
        </article>
        <article>
          <MailStatus />
          <h2>Connected services</h2>
          <p>
            Automated email and payment services remain unavailable until their
            secure integrations are configured.
          </p>
          <button disabled>Contact support</button>
        </article>
      </div>
      <blockquote>
        <p>
          Use prototype records only for interface review. Do not treat preview
          payments, messages, or editorial counts as production activity.
        </p>
        <cite>Talikha admin preview</cite>
      </blockquote>
    </section>
  );
}

function MailStatus() {
  return <Send />;
}
function PageHeading({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Star;
  title: string;
  copy: string;
}) {
  return (
    <header className="utility-heading">
      <div className="utility-heading-icon">
        <Icon />
      </div>
      <div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
    </header>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function SettingRow({
  title,
  copy,
  checked,
  setChecked,
  disabled = false,
}: {
  title: string;
  copy: string;
  checked: boolean;
  setChecked: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "setting-row disabled" : "setting-row"}>
      <span>
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <i />
    </label>
  );
}

const destinations = [
  "Overview", "Submissions", "Publishing schedule", "Authors", "Studies and papers", "Bank and wallets", "Featured", "Reports", "Settings", "Support", "Certificates", "Journals", "Production", "Media", "Announcements",
];
const workspaceViews = ["overview", "submissions", "schedule", "authors", "studies", "bank", "featured", "reports", "settings", "support", "certificates", "journals", "production", "media", "announcements"] as const;
type WorkspaceView = typeof workspaceViews[number];
const viewIndex = (view: string | null) => {
  const index = workspaceViews.indexOf(view as WorkspaceView);
  return index >= 0 ? index : 0;
};
const viewFromLocation = () => typeof window === "undefined" ? 0 : viewIndex(new URLSearchParams(window.location.search).get("view"));
const stageToSubmissionStatus: Record<string, SubmissionStatus> = {
  review_new: "New", review_in_progress: "In progress", review_final: "Review", review_accepted: "Accepted",
  production_ready: "Accepted", production_preparation: "Accepted", production_proof: "Accepted", production_records: "Accepted", production_ready_to_publish: "For approval",
  production_scheduled: "Scheduled for publishing", published: "Published", closed: "Rejected",
};
const workspaceDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const workspaceDisplayDate = (value?: string | null) => value ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
function SearchPalette({
  close,
  navigate,
}: {
  close: () => void;
  navigate: (index: number) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const pages = destinations
    .map((label, index) => ({ label, index }))
    .filter((x) => !q || x.label.toLowerCase().includes(q));
  const records = studyRecords
    .filter(
      (x) =>
        q &&
        [x.title, x.author, x.reference].join(" ").toLowerCase().includes(q),
    )
    .slice(0, 5);
  return (
    <div
      className="command-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        className="command-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search admin"
      >
        <header>
          <Search />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, studies, authors, or references"
          />
          <button onClick={close} aria-label="Close search">
            <X />
          </button>
        </header>
        <div className="command-results">
          <p>Pages</p>
          {pages.map((page) => (
            <button
              key={page.label}
              onClick={() => {
                navigate(page.index);
                close();
              }}
            >
              <LayoutGrid />
              <span>
                <strong>{page.label}</strong>
                <small>Open workspace</small>
              </span>
              <ChevronRight />
            </button>
          ))}
          {records.length > 0 && (
            <>
              <p>Study records</p>
              {records.map((record) => (
                <button
                  key={record.reference}
                  onClick={() => {
                    navigate(4);
                    close();
                  }}
                >
                  <FileText />
                  <span>
                    <strong>{record.title}</strong>
                    <small>
                      {record.reference} · {record.author}
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </>
          )}
          {pages.length === 0 && records.length === 0 && (
            <div className="command-empty">
              <Search />
              <strong>No matches</strong>
              <span>Try a title, author, reference, or workspace name.</span>
            </div>
          )}
        </div>
        <footer>
          <span>Search uses prototype records.</span>
          <kbd>Esc</kbd>
          <span>to close</span>
        </footer>
      </section>
    </div>
  );
}
type LocalCertificateTemplate = { id: string; name: string; status: "Draft" | "Published"; pages: number; updatedAt: string; hasPdf?: boolean; pdfName?: string };
type LocalCertificateRecord = { id: string; submissionId: string; reference: string; template: string; publication: string; status: "Draft" | "Issued"; updatedAt: string };
type LocalCertificateCanvasBlock = { id: string; type: "text" | "image"; value: string; x: number; y: number; width: number; height: number; size: number; color: string; font: string; bold: boolean; page?: number };
const certificatePdfStore = "certificate-pdfs";
const certificatePdfDatabase = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("talikha-certificate-assets-v1", 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(certificatePdfStore)) request.result.createObjectStore(certificatePdfStore); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const saveCertificatePdf = async (templateId: string, file: File) => { const db = await certificatePdfDatabase(); await new Promise<void>((resolve, reject) => { const transaction = db.transaction(certificatePdfStore, "readwrite"); transaction.objectStore(certificatePdfStore).put(file, templateId); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close(); };
const readCertificatePdf = async (templateId: string) => { const db = await certificatePdfDatabase(); const file = await new Promise<File | undefined>((resolve, reject) => { const request = db.transaction(certificatePdfStore, "readonly").objectStore(certificatePdfStore).get(templateId); request.onsuccess = () => resolve(request.result as File | undefined); request.onerror = () => reject(request.error); }); db.close(); return file; };

function CertificatePdfSlide({ pdfUrl, pageNumber, blocks, selectedId, onSelect, onActivate }: { pdfUrl: string; pageNumber: number; blocks: LocalCertificateCanvasBlock[]; selectedId: string | null; onSelect: (id: string) => void; onActivate: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null); const [size, setSize] = useState({ width: 595, height: 842 });
  useEffect(() => { let disposed = false; void (async () => { try { const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; const document = await pdfjs.getDocument({ url: pdfUrl } as never).promise; const page = await document.getPage(pageNumber); const viewport = page.getViewport({ scale: 1 }); const canvas = canvasRef.current; if (!canvas || disposed) return; const nextSize = { width: Math.round(viewport.width), height: Math.round(viewport.height) }; setSize(nextSize); canvas.width = nextSize.width; canvas.height = nextSize.height; await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise; } catch { /* The editor keeps the page available even if one PDF page cannot be rendered. */ } })(); return () => { disposed = true; }; }, [pageNumber, pdfUrl]);
  return <article onClick={onActivate} style={{ position: "relative", width: size.width, height: size.height, maxWidth: "100%", margin: "0 auto", background: "#fff", boxShadow: "0 12px 30px rgba(18,45,33,.2)", flex: "0 0 auto" }}><canvas ref={canvasRef} aria-label={`Certificate PDF page ${pageNumber}`} style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />{blocks.filter((block) => (block.page || 1) === pageNumber).map((block) => <div key={block.id} onClick={(event) => { event.stopPropagation(); onSelect(block.id); }} style={{ position: "absolute", left: `${(block.x / size.width) * 100}%`, top: `${(block.y / size.height) * 100}%`, width: `${(block.width / size.width) * 100}%`, height: `${(block.height / size.height) * 100}%`, cursor: "pointer", outline: selectedId === block.id ? "2px solid #247350" : "1px solid transparent", color: block.color, fontFamily: block.font, fontSize: block.size, fontWeight: block.bold ? 700 : 400, overflow: "hidden" }}>{block.type === "image" ? <img src={block.value} alt="Certificate element" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : block.value}</div>)}</article>;
}

function LocalCertificateCanvas({ template, onBack }: { template: LocalCertificateTemplate; onBack: () => void }) {
  const key = `talikha-certificate-layout-${template.id}-v1`;
  const [blocks, setBlocks] = useState<LocalCertificateCanvasBlock[]>(() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(template.pages || 1);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const selected = blocks.find((block) => block.id === selectedId) || null;
  const visibleBlocks = blocks.filter((block) => (block.page || 1) === pageNumber);
  useEffect(() => { localStorage.setItem(key, JSON.stringify(blocks)); }, [blocks, key]);
  useEffect(() => { let url = ""; void readCertificatePdf(template.id).then((file) => { if (!file) return; url = URL.createObjectURL(file); setPdfUrl(url); }).catch(() => setPdfUrl(null)); return () => { if (url) URL.revokeObjectURL(url); }; }, [template.id]);
  useEffect(() => { if (!pdfUrl) return; void import("pdfjs-dist/legacy/build/pdf.mjs").then(async (pdfjs) => { pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; const document = await pdfjs.getDocument({ url: pdfUrl } as never).promise; setPageCount(document.numPages); }).catch(() => setPageCount(template.pages || 1)); }, [pdfUrl, template.pages]);
  const addText = () => { const block = { id: crypto.randomUUID(), type: "text" as const, value: "New certificate text", x: 120, y: 180, width: 360, height: 50, size: 24, color: "#173d2d", font: "Georgia", bold: false, page: pageNumber }; setBlocks((current) => [...current, block]); setSelectedId(block.id); };
  const update = (patch: Partial<LocalCertificateCanvasBlock>) => selected && setBlocks((current) => current.map((block) => block.id === selected.id ? { ...block, ...patch } : block));
  const addImage = (file?: File) => { if (!file || !file.type.startsWith("image/")) return; const block = { id: crypto.randomUUID(), type: "image" as const, value: URL.createObjectURL(file), x: 150, y: 220, width: 180, height: 120, size: 16, color: "#173d2d", font: "Arial", bold: false, page: pageNumber }; setBlocks((current) => [...current, block]); setSelectedId(block.id); };
  if (pdfUrl) return <section className="certificate-workspace">
    <header className="certificate-heading"><div><button onClick={onBack} className="back-link"><ArrowLeft />Back to certificates</button><span>Certificate canvas</span><h2>{template.name}</h2><p>{pageCount} PDF pages are projected below as one scrollable certificate document.</p></div><button className="approve" onClick={() => localStorage.setItem(key, JSON.stringify(blocks))}><Save />Save layout</button></header>
    <div style={{ display: "grid", gridTemplateColumns: "116px minmax(0,1fr) 280px", minHeight: "calc(100vh - 230px)", border: "1px solid #dfe6e1", borderRadius: 14, overflow: "hidden" }}>
      <nav aria-label="PDF pages" style={{ overflowY: "auto", padding: 10, background: "#f6f8f6", borderRight: "1px solid #dfe6e1" }}>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button key={page} onClick={() => { setPageNumber(page); setSelectedId(null); document.getElementById(`certificate-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={{ display: "block", width: "100%", marginBottom: 8, padding: "10px 6px", border: pageNumber === page ? "2px solid #247350" : "1px solid #cfd8d1", borderRadius: 8, background: "#fff", color: "#244b37", fontWeight: 700, fontSize: 12 }}>Page {page}</button>)}</nav>
      <main style={{ overflow: "auto", maxHeight: "calc(100vh - 230px)", padding: 0, background: "#e8ece9", display: "flex", flexDirection: "column", gap: 22 }}>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <div id={`certificate-page-${page}`} key={page}><CertificatePdfSlide pdfUrl={pdfUrl} pageNumber={page} blocks={blocks} selectedId={selectedId} onSelect={setSelectedId} onActivate={() => setPageNumber(page)} /></div>)}</main>
      <aside className="certificate-card" style={{ margin: 0, border: 0, borderRadius: 0, padding: 18, overflowY: "auto", maxHeight: "calc(100vh - 230px)" }}><div className="certificate-card-head"><div><h3>Canvas controls</h3><p>Add content to page {pageNumber}.</p></div><SlidersHorizontal /></div><div className="certificate-new"><button onClick={addText}><Plus />Text</button><label className="file-button"><ImageIcon />Image<input type="file" accept="image/png,image/jpeg" onChange={(event) => addImage(event.target.files?.[0])} /></label></div>{selected ? <div className="canvas-inspector"><strong>{selected.type === "image" ? "Image" : "Text"} element</strong>{selected.type === "text" && <label>Text<textarea value={selected.value} onChange={(event) => update({ value: event.target.value })} /></label>}<label>Font<select value={selected.font} onChange={(event) => update({ font: event.target.value })}><option>Georgia</option><option>Times New Roman</option><option>Arial</option><option>Helvetica</option></select></label><label>Font size<input type="number" min="6" max="160" value={selected.size} onChange={(event) => update({ size: Number(event.target.value) })} /></label><label>Color<input type="color" value={selected.color} onChange={(event) => update({ color: event.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={selected.bold} onChange={(event) => update({ bold: event.target.checked })} />Bold</label><div className="canvas-grid"><label>X<input type="number" value={selected.x} onChange={(event) => update({ x: Number(event.target.value) })} /></label><label>Y<input type="number" value={selected.y} onChange={(event) => update({ y: Number(event.target.value) })} /></label><label>Width<input type="number" min="10" value={selected.width} onChange={(event) => update({ width: Number(event.target.value) })} /></label><label>Height<input type="number" min="10" value={selected.height} onChange={(event) => update({ height: Number(event.target.value) })} /></label></div><button className="danger" onClick={() => { setBlocks((current) => current.filter((block) => block.id !== selected.id)); setSelectedId(null); }}><Trash2 />Delete element</button></div> : <p className="certificate-note">Select an element to change its content, style, or position.</p>}</aside>
    </div>
  </section>;
  return <section className="certificate-workspace"><header className="certificate-heading"><div><button onClick={onBack} className="back-link"><ArrowLeft />Back to certificates</button><span>Certificate canvas</span><h2>{template.name}</h2><p>{template.pdfName ? `Editing ${template.pdfName}. Every PDF page is an editable certificate slide.` : "A clean PDF background is required before this template can be edited."}</p><div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}><button className="ghost-button" disabled={pageNumber === 1} onClick={() => { setPageNumber((page) => page - 1); setSelectedId(null); }}>Previous page</button><strong style={{ fontSize: 13 }}>Page {pageNumber} of {pageCount}</strong><button className="ghost-button" disabled={pageNumber === pageCount} onClick={() => { setPageNumber((page) => page + 1); setSelectedId(null); }}>Next page</button></div></div><button className="approve" onClick={() => localStorage.setItem(key, JSON.stringify(blocks))}><Save />Save layout</button></header><div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 18, alignItems: "start" }}><div style={{ overflow: "auto", minHeight: 720, padding: 28, border: "1px solid #dfe6e1", borderRadius: 14, background: "#edf1ee" }}><div style={{ position: "relative", width: 595, height: 842, margin: "0 auto", background: "#fff", boxShadow: "0 18px 40px rgba(18,45,33,.2)" }}>{pdfUrl ? <canvas ref={pdfCanvasRef} aria-label={`Certificate PDF page ${pageNumber}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} /> : <p style={{ position: "absolute", top: 38, left: 54, right: 54, padding: 12, border: "1px dashed #8eb3a0", color: "#48745e", fontSize: 13, textAlign: "center" }}>Loading the certificate PDF…</p>}{visibleBlocks.map((block) => <div key={block.id} onClick={() => setSelectedId(block.id)} style={{ position: "absolute", left: block.x, top: block.y, width: block.width, height: block.height, cursor: "pointer", outline: selectedId === block.id ? "2px solid #247350" : "1px solid transparent", color: block.color, fontFamily: block.font, fontSize: block.size, fontWeight: block.bold ? 700 : 400, overflow: "hidden" }}>{block.type === "image" ? <img src={block.value} alt="Certificate element" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : block.value}</div>)}</div></div><aside className="certificate-card" style={{ padding: 18 }}><div className="certificate-card-head"><div><h3>Canvas controls</h3><p>Select an element to edit it.</p></div><SlidersHorizontal /></div><div className="certificate-new"><button onClick={addText} disabled={!template.hasPdf}><Plus />Text</button><label className="file-button"><ImageIcon />Image<input type="file" accept="image/png,image/jpeg" disabled={!template.hasPdf} onChange={(event) => addImage(event.target.files?.[0])} /></label></div>{selected ? <div className="canvas-inspector"><strong>{selected.type === "image" ? "Image" : "Text"} element</strong>{selected.type === "text" && <label>Text<textarea value={selected.value} onChange={(event) => update({ value: event.target.value })} /></label>}<label>Font<select value={selected.font} onChange={(event) => update({ font: event.target.value })}><option>Georgia</option><option>Times New Roman</option><option>Arial</option><option>Helvetica</option></select></label><label>Font size<input type="number" min="6" max="160" value={selected.size} onChange={(event) => update({ size: Number(event.target.value) })} /></label><label>Color<input type="color" value={selected.color} onChange={(event) => update({ color: event.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={selected.bold} onChange={(event) => update({ bold: event.target.checked })} />Bold</label><div className="canvas-grid"><label>X<input type="number" value={selected.x} onChange={(event) => update({ x: Number(event.target.value) })} /></label><label>Y<input type="number" value={selected.y} onChange={(event) => update({ y: Number(event.target.value) })} /></label><label>Width<input type="number" min="10" value={selected.width} onChange={(event) => update({ width: Number(event.target.value) })} /></label><label>Height<input type="number" min="10" value={selected.height} onChange={(event) => update({ height: Number(event.target.value) })} /></label></div><button className="danger" onClick={() => { setBlocks((current) => current.filter((block) => block.id !== selected.id)); setSelectedId(null); }}><Trash2 />Delete element</button></div> : <p className="certificate-note">Choose an element on the page to change its text, font, size, colour, and position.</p>}</aside></div></section>;
}

function CertificatesWorkspace({ submissions }: { submissions: EditorialSubmission[] }) {
  const [templates, setTemplates] = useState<LocalCertificateTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem("talikha-certificate-templates-v1") || "[]").map(({ pdfData: _discardedPdf, ...template }: LocalCertificateTemplate & { pdfData?: string }) => template); } catch { return []; }
  });
  const [records, setRecords] = useState<LocalCertificateRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("talikha-certificate-records-v1") || "[]"); } catch { return []; }
  });
  const [templateName, setTemplateName] = useState("");
  const [templatePdf, setTemplatePdf] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<LocalCertificateTemplate | null>(null);
  useEffect(() => { try { localStorage.setItem("talikha-certificate-templates-v1", JSON.stringify(templates)); } catch { /* PDFs are stored in IndexedDB, not localStorage. */ } }, [templates]);
  useEffect(() => { localStorage.setItem("talikha-certificate-records-v1", JSON.stringify(records)); }, [records]);
  const createTemplate = async () => {
    const name = templateName.trim(); if (!name || !templatePdf || templatePdf.type !== "application/pdf") return;
    const template = { id: crypto.randomUUID(), name, status: "Draft" as const, pages: 6, updatedAt: new Date().toLocaleDateString("en-PH"), hasPdf: true, pdfName: templatePdf.name };
    await saveCertificatePdf(template.id, templatePdf);
    setTemplates((current) => [template, ...current]); setTemplateName(""); setTemplatePdf(null); setSelectedTemplate(template.id); setEditingTemplate(template);
  };
  const createRecord = (submission: EditorialSubmission) => {
    const template = templates.find((item) => item.id === selectedTemplate) || templates[0]; if (!template) return;
    if (records.some((record) => record.submissionId === submission.id)) return;
    setRecords((current) => [{ id: `TP-CERT-${new Date().getFullYear()}-${String(current.length + 1).padStart(4, "0")}`, submissionId: submission.id, reference: submission.id, template: template.name, publication: submission.title, status: "Draft", updatedAt: new Date().toLocaleDateString("en-PH") }, ...current]);
  };
  if (editingTemplate) return <LocalCertificateCanvas template={editingTemplate} onBack={() => setEditingTemplate(null)} />;
  const scheduledSubmissions = submissions.filter((submission) => submission.status === "Scheduled for publishing");
  const certificateHolds = scheduledSubmissions.filter((submission) => !records.some((record) => record.submissionId === submission.id && record.status === "Issued")).length;
  return <section className="certificate-workspace">
    <header className="certificate-heading"><div><span>Editorial workspace</span><h1>Certificates</h1><p>Build one shared certificate for each scheduled publication, tied to its reference number and delivered privately.</p></div></header>
    <div className="certificate-grid"><article className="certificate-card certificate-templates"><div className="certificate-card-head"><div><h2>Certificate templates</h2><p>The active published template is used for scheduled studies.</p></div></div><div className="certificate-new"><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void createTemplate()} placeholder="Template name" aria-label="Certificate template name" /><label className="file-button"><FileText />{templatePdf ? templatePdf.name : "Select PDF"}<input type="file" accept="application/pdf" onChange={(event) => setTemplatePdf(event.target.files?.[0] || null)} /></label><button onClick={() => void createTemplate()} disabled={!templateName.trim() || !templatePdf}><Plus /> New template</button></div>{templates.length ? <div className="certificate-list">{templates.map((template) => <button key={template.id} className={selectedTemplate === template.id ? "certificate-row selected" : "certificate-row"} onClick={() => { setSelectedTemplate(template.id); setEditingTemplate(template); }}><span className="certificate-page-icon"><FileText /></span><span><strong>{template.name}</strong><small>{template.pages} pages · updated {template.updatedAt}{template.pdfName ? ` · ${template.pdfName}` : " · PDF required"}</small></span><b>{template.status}</b></button>)}</div> : <div className="certificate-empty"><FileText /><strong>Start with a clean certificate template</strong><p>Upload the six-page PDF, then design directly on each page in the canvas.</p></div>}</article>
      <article className="certificate-card certificate-delivery"><LockKeyhole /><h2>Reference-linked<br />private delivery</h2><p>Each publication has one shared certificate PDF. Its reference finds the record; a separate expiring link protects the download.</p><div>Choose a published default template before preparing certificate records.</div></article></div>
    <article className="certificate-card certificate-scheduled"><div className="certificate-card-head"><div><h2>Scheduled studies awaiting certificates</h2><p>Only scheduled studies appear here. A missing issued certificate holds automatic publication on its due date.</p></div><span className="certificate-hold-count"><Award />{certificateHolds} hold{certificateHolds === 1 ? "" : "s"}</span></div>{templates.length > 0 && <div className="certificate-source"><label>Template<select value={selectedTemplate || templates[0].id} onChange={(event) => setSelectedTemplate(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><span>Select a scheduled study to create its certificate.</span></div>}<div className="certificate-submissions">{scheduledSubmissions.map((submission) => <button key={submission.id} disabled={!templates.length || records.some((record) => record.submissionId === submission.id)} onClick={() => createRecord(submission)}><span><strong>{submission.id}</strong><small>{submission.title}</small></span><Plus /></button>)}{!scheduledSubmissions.length && <p>No scheduled studies are waiting for certificate preparation.</p>}</div></article>
    <article className="certificate-card certificate-records"><div className="certificate-card-head"><div><h2>Certificate records</h2><p>Draft and issued shared files remain tied to their publication reference.</p></div></div><div className="certificate-record-list">{records.map((record) => <div key={record.id}><span><strong>{record.reference || record.id}</strong><small>{record.publication}</small></span><small className="certificate-record-template">{record.template}</small><button className={record.status === "Issued" ? "issued" : ""} onClick={() => setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: item.status === "Issued" ? "Draft" : "Issued", updatedAt: new Date().toLocaleDateString("en-PH") } : item))}>{record.status === "Issued" ? "Issued" : "Issue PDF"}</button></div>)}{!records.length && <p className="certificate-no-records">No shared certificate records have been created.</p>}</div></article>
  </section>;
}
type AnnouncementSettings = {
  enabled: boolean; presentation: "banner" | "popup" | "both"; category: string; message: string; actionLabel: string; actionHref: string; target: "all" | "home" | "journals" | "submit"; trigger: "load" | "scroll"; delaySeconds: number; dismissible: boolean; frequency: "visit" | "session"; startsAt: string; endsAt: string;
};
const announcementStorageKey = "talikha-announcement-settings-v1";
const defaultAnnouncementSettings: AnnouncementSettings = { enabled: true, presentation: "banner", category: "Announcement", message: "Talikha Publishing is now accepting submissions for all journals.", actionLabel: "Submit your work", actionHref: "/submit", target: "all", trigger: "load", delaySeconds: 0, dismissible: true, frequency: "visit", startsAt: "", endsAt: "" };
function AnnouncementWorkspace() {
  const [settings, setSettings] = useState<AnnouncementSettings>(defaultAnnouncementSettings);
  const [saved, setSaved] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage on mount; cannot run during SSR render
  useEffect(() => { try { const stored = window.localStorage.getItem(announcementStorageKey); if (stored) setSettings({ ...defaultAnnouncementSettings, ...JSON.parse(stored) }); } catch {} }, []);
  const update = <K extends keyof AnnouncementSettings>(key: K, value: AnnouncementSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const save = () => { window.localStorage.setItem(announcementStorageKey, JSON.stringify(settings)); window.dispatchEvent(new window.Event("talikha:announcement-updated")); setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  return <section className="announcement-workspace"><PageHeading icon={Bell} title="Announcements" copy="Control the public announcement bar and optional popup without editing the site." /><div className="announcement-admin-layout"><section className="announcement-admin-card"><header><div><h2>Announcement content</h2><p>The bar is composed of a category, a message, and one linked action.</p></div><label className="announcement-switch"><input type="checkbox" checked={settings.enabled} onChange={(event) => update("enabled", event.target.checked)} /><span>{settings.enabled ? "Live" : "Hidden"}</span></label></header><div className="announcement-form-grid"><label>Category<select value={settings.category} onChange={(event) => update("category", event.target.value)}><option>Announcement</option><option>Notice</option><option>Update</option><option>Call for papers</option><option>Event</option></select></label><label>Display as<select value={settings.presentation} onChange={(event) => update("presentation", event.target.value as AnnouncementSettings["presentation"])}><option value="banner">Announcement bar</option><option value="popup">Popup only</option><option value="both">Bar and popup</option></select></label><label className="wide">Message<textarea value={settings.message} maxLength={240} rows={3} onChange={(event) => update("message", event.target.value)} /></label><label>Action label<input value={settings.actionLabel} maxLength={80} onChange={(event) => update("actionLabel", event.target.value)} /></label><label>Action link<input value={settings.actionHref} maxLength={500} placeholder="/submit or https://…" onChange={(event) => update("actionHref", event.target.value)} /></label></div></section><section className="announcement-admin-card"><header><div><h2>Visibility and trigger</h2><p>Choose where the announcement appears and how a popup opens.</p></div></header><div className="announcement-form-grid"><label>Show on<select value={settings.target} onChange={(event) => update("target", event.target.value as AnnouncementSettings["target"])}><option value="all">All public pages</option><option value="home">Home page only</option><option value="journals">Journal pages only</option><option value="submit">Submission page only</option></select></label><label>Popup trigger<select value={settings.trigger} onChange={(event) => update("trigger", event.target.value as AnnouncementSettings["trigger"])}><option value="load">After page load</option><option value="scroll">After scrolling</option></select></label><label>Delay (seconds)<input type="number" min="0" max="60" value={settings.delaySeconds} onChange={(event) => update("delaySeconds", Math.max(0, Math.min(60, Number(event.target.value) || 0)))} /></label><label>Frequency<select value={settings.frequency} onChange={(event) => update("frequency", event.target.value as AnnouncementSettings["frequency"])}><option value="visit">Every visit</option><option value="session">Once per session</option></select></label><label>Start date and time<input type="datetime-local" value={settings.startsAt} onChange={(event) => update("startsAt", event.target.value)} /></label><label>End date and time<input type="datetime-local" value={settings.endsAt} onChange={(event) => update("endsAt", event.target.value)} /></label><label className="announcement-check wide"><input type="checkbox" checked={settings.dismissible} onChange={(event) => update("dismissible", event.target.checked)} /> Allow visitors to dismiss the announcement</label></div></section><aside className="announcement-admin-preview"><span>Live preview</span><div><b>{settings.category || "Announcement"}</b><p>{settings.message || "Your announcement message appears here."}</p><strong>{settings.actionLabel || "Action"} →</strong></div><button onClick={save}><Save /> {saved ? "Saved to preview" : "Save announcement"}</button><small>Preview settings are stored in this browser until Supabase is connected.</small></aside></div></section>;
}

type SkeletonKind = "overview" | "list" | "split" | "grid";
const viewSkeletonKind: Record<number, SkeletonKind> = { 0: "overview", 1: "split", 2: "split", 3: "list", 4: "list", 5: "grid", 6: "grid", 7: "grid", 8: "grid", 9: "grid", 10: "split", 11: "list", 12: "split", 13: "grid", 14: "grid" };

function Sk({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`sk ${className}`} />;
}

function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <Sk className="sk-avatar" />
          <div className="skeleton-row-lines"><Sk /><Sk className="sk-short" /></div>
          <Sk className="sk-cell sk-hide-sm" />
          <Sk className="sk-pill sk-hide-sm" />
          <Sk className="sk-cell sk-shorter" />
        </div>
      ))}
    </div>
  );
}

function SkeletonCard({ cover = false }: { cover?: boolean }) {
  return (
    <div className="skeleton-card">
      <Sk className="sk-big" />
      {cover && <Sk className="sk-cover" />}
      <Sk />
      <Sk className="sk-short" />
    </div>
  );
}

function WorkspaceSkeleton({ kind }: { kind: SkeletonKind }) {
  return (
    <div className="skeleton-workspace" aria-busy="true">
      <span className="sr-only" role="status">Loading workspace</span>
      <div className="skeleton-page">
        <div className="skeleton-heading">
          <Sk className="sk-title" />
          <Sk className="sk-sub" />
        </div>
        {kind === "overview" ? (
          <div className="skeleton-overview" aria-hidden="true">
            <div className="skeleton-col">
              <SkeletonCard />
              <div className="skeleton-card">
                <Sk className="sk-big" />
                <div className="skeleton-bars">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
              </div>
            </div>
            <div className="skeleton-col">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="skeleton-col">
              <SkeletonCard cover />
              <SkeletonCard />
            </div>
          </div>
        ) : kind === "list" ? (
          <div aria-hidden="true">
            <div className="skeleton-metrics">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="skeleton-metric" key={index}><Sk className="sk-label" /><Sk className="sk-value" /></div>
              ))}
            </div>
            <div className="skeleton-panel">
              <div className="skeleton-filter"><Sk className="sk-round sk-a" /><Sk className="sk-round sk-b" /><Sk className="sk-round sk-c" /></div>
              <SkeletonRows count={7} />
            </div>
          </div>
        ) : kind === "split" ? (
          <div className="skeleton-split" aria-hidden="true">
            <div className="skeleton-panel"><SkeletonRows count={6} /></div>
            <div className="skeleton-col"><SkeletonCard /><SkeletonCard /></div>
          </div>
        ) : (
          <div className="skeleton-grid-cards" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton-grid-card" key={index}>
                <Sk className="sk-icon" />
                <div className="skeleton-grid-lines"><Sk /><Sk className="sk-short" /><Sk className="sk-shorter" /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type OverviewRealData = {
  stageCounts: Record<string, number>;
  totalSubmissions: number;
  totalJournals: number;
  totalAuthors: number;
  journals: { id: string; title: string; slug: string }[];
};
type OverviewDashboardProps = {
  submissions: EditorialSubmission[];
  publicationRecords: PublicationRecord[];
  isConnected: boolean;
  realData: OverviewRealData | null;
  awaitingScreening: number;
  newCount: number;
  inReviewCount: number;
  revisionCount: number;
  activeManuscriptCount: number;
  onOpenSubmission: (id: string | null) => void;
  onOpenIssue: () => void;
  onAddTask: () => void;
  onNavigate: (index: number) => void;
};
type DrillItem = {
  id: string;
  title: string;
  meta: string;
  status?: SubmissionStatus;
  journal?: string;
  kind: "submission" | "production";
};
type DrillState = { title: string; subtitle: string; items: DrillItem[]; headerCount?: number } | null;
type DrillPos = { left: number; top?: number; bottom?: number; maxHeight: number; width: number };
const overviewTaskTitles = [
  "Assign reviewers for coastal resilience study",
  "Check author declaration form",
  "Approve issue publication metadata",
];
const overviewComments = [
  { name: "Nina Villareal", role: "Managing editor", text: "Great review notes on the coastal study.", image: portraits[1] },
  { name: "Marco Dela Cruz", role: "Section editor", text: "The new issue metadata is complete.", image: portraits[2] },
  { name: "Alyssa Santos", role: "Copy editor", text: "Reviewer assignment confirmed.", image: portraits[3] },
];
const overviewRewards = [
  { name: "Reviewer honorarium", detail: "Coastal resilience study · Round 2", amount: "₱ 1,500", state: "Scheduled" },
  { name: "Copyediting payout", detail: "Volume 3 · Issue 2", amount: "₱ 2,200", state: "Paid" },
  { name: "Layout services", detail: "InQuira · Proofs", amount: "₱ 900", state: "Pending" },
];
const overviewTeam = [
  { group: "Available", people: [
    { name: "Nina Villareal", role: "Managing editor", image: portraits[1] },
    { name: "Marco Dela Cruz", role: "Section editor", image: portraits[2] },
  ]},
  { group: "Away", people: [
    { name: "Alyssa Santos", role: "Copy editor", image: portraits[3] },
    { name: "Tomas Rivera", role: "Reviewer", image: portraits[4] },
  ]},
];
const journalToneClass = (name: string) => {
  const tones = ["tp-tint--green", "tp-tint--blue", "tp-tint--amber", "tp-tint--clay"];
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[hash % tones.length];
};
const statusToneClass = (status: SubmissionStatus) => {
  if (status === "Revise") return "tp-pill--amber";
  if (status === "Rejected") return "tp-pill--red";
  if (status === "New" || status === "In progress" || status === "Review" || status === "For approval" || status === "Accepted" || status === "Scheduled for publishing" || status === "Published") return "tp-pill--green";
  return "tp-pill--neutral";
};
function BannerArt() {
  return (
    <svg viewBox="0 0 300 132" fill="none" role="img" aria-label="Stacked journals with eucalyptus leaves and a coffee mug">
      <ellipse cx="150" cy="122" rx="118" ry="9" fill="#065C36" opacity="0.06" />
      <g stroke="#17915A" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M62 100C52 74 54 46 74 24" />
        <path d="M62 100C70 80 84 70 96 66" />
      </g>
      <g fill="#2FA468">
        <ellipse cx="60" cy="74" rx="10" ry="4.5" transform="rotate(-38 60 74)" />
        <ellipse cx="58" cy="56" rx="9" ry="4" transform="rotate(-30 58 56)" />
        <ellipse cx="64" cy="40" rx="8" ry="3.6" transform="rotate(-22 64 40)" />
        <ellipse cx="74" cy="27" rx="7" ry="3.2" transform="rotate(-12 74 27)" />
      </g>
      <g fill="#17915A">
        <ellipse cx="74" cy="84" rx="9" ry="4" transform="rotate(28 74 84)" />
        <ellipse cx="86" cy="72" rx="8" ry="3.6" transform="rotate(20 86 72)" />
      </g>
      <g>
        <rect x="62" y="98" width="132" height="20" rx="4" fill="#065C36" />
        <rect x="66" y="102" width="124" height="12" rx="2" fill="#EFE7D2" />
        <rect x="72" y="80" width="120" height="18" rx="4" fill="#087A45" />
        <rect x="76" y="84" width="112" height="10" rx="2" fill="#F4EFE0" />
        <rect x="80" y="64" width="104" height="16" rx="4" fill="#17915A" />
        <rect x="84" y="68" width="96" height="8" rx="2" fill="#FBF7EC" />
      </g>
      <g>
        <path d="M236 80q15 1 15 12t-15 12" stroke="#C9D8CF" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <rect x="196" y="72" width="42" height="34" rx="7" fill="#FFFFFF" stroke="#D7E2DB" strokeWidth="1.5" />
        <ellipse cx="217" cy="74" rx="17" ry="3.5" fill="#E8F6EE" />
        <path d="M210 86q7-9 16-4-5 9-16 4Z" fill="#17915A" />
      </g>
      <g fill="#3FAE6E" opacity="0.9">
        <ellipse cx="248" cy="40" rx="8" ry="3.6" transform="rotate(34 248 40)" />
        <ellipse cx="262" cy="52" rx="7" ry="3.2" transform="rotate(40 262 52)" />
      </g>
    </svg>
  );
}
function OverviewDashboard({
  submissions,
  publicationRecords,
  isConnected,
  realData,
  awaitingScreening,
  newCount,
  inReviewCount,
  revisionCount,
  activeManuscriptCount,
  onOpenSubmission,
  onOpenIssue,
  onAddTask,
  onNavigate,
}: OverviewDashboardProps) {
  const [journal, setJournal] = useState("All journals");
  const [tab, setTab] = useState("Overview");
  const [months, setMonths] = useState(8);
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [drill, setDrill] = useState<DrillState>(null);
  const [drillPos, setDrillPos] = useState<DrillPos>({ left: 12, top: 12, maxHeight: 320, width: 340 });
  const [hmRange, setHmRange] = useState<26 | 52>(26);
  const closeDrill = () => setDrill(null);
  useEffect(() => {
    if (!drill) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrill(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drill]);
  const toggleTask = (id: string) =>
    setDoneTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleLike = (index: number) =>
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  const toItem = (submission: EditorialSubmission): DrillItem => ({
    id: submission.id,
    title: submission.title,
    meta: `${submission.author} · ${submission.displayDate}`,
    status: submission.status,
    journal: submission.journal,
    kind: "submission",
  });
  const openDrill = (event: React.SyntheticEvent, title: string, subtitle: string, items: DrillItem[], headerCount?: number) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(340, vw - 24);
    const left = Math.max(12, Math.min(rect.left, vw - width - 12));
    const spaceBelow = vh - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight: number;
    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
      maxHeight = Math.max(180, spaceBelow);
    } else {
      bottom = vh - rect.top + 6;
      maxHeight = Math.max(180, spaceAbove);
    }
    setDrillPos({ left, top, bottom, maxHeight, width });
    setDrill({ title, subtitle, items, headerCount });
  };
  const activate = (event: React.KeyboardEvent, title: string, subtitle: string, items: DrillItem[], headerCount?: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDrill(event, title, subtitle, items, headerCount);
    }
  };
  const fmtDay = (key: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${key}T00:00:00`));
  const dayItems = (key: string) => submissions.filter((submission) => submission.submittedAt.slice(0, 10) === key).map(toItem);
  const monthItems = (key: string) => submissions.filter((submission) => submission.submittedAt.startsWith(key)).map(toItem);
  const stageItems = (statuses: SubmissionStatus[]) => submissions.filter((submission) => statuses.includes(submission.status)).map(toItem);
  const recent = [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const journalOptions = realData?.journals.length
    ? realData.journals.map((entry) => entry.title)
    : [...new Set(submissions.map((submission) => submission.journal))];
  const queue = (journal === "All journals" ? recent : recent.filter((submission) => submission.journal === journal)).slice(0, 4);
  const tasks = recent.slice(0, 3).map((submission, index) => ({
    id: submission.id,
    title: overviewTaskTitles[index] || "Review manuscript",
    context: submission.title,
  }));
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, offset) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (months - 1 - offset), 1);
    return {
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-PH", { month: "short" }).format(monthDate),
      long: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(monthDate),
      count: 0,
    };
  });
  for (const submission of submissions) {
    const bucket = buckets.find((entry) => submission.submittedAt.startsWith(entry.key));
    if (bucket) bucket.count += 1;
  }
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const yMax = Math.max(3, peak);
  const yStep = yMax <= 4 ? 1 : Math.ceil(yMax / 4);
  const yTicks: number[] = [];
  for (let value = yMax; value >= 0; value -= yStep) yTicks.push(value);
  if (yTicks[yTicks.length - 1] !== 0) yTicks.push(0);
  const currentMonthCount = buckets[buckets.length - 1].count;
  const publishedCount = publicationRecords.filter((record) => record.status === "Published").length;
  const issueCount = new Set(publicationRecords.map((record) => `${record.journal}-${record.volume}-${record.issue}`)).size;
  const authorCount = realData?.totalAuthors ?? new Set(submissions.map((submission) => submission.author)).size;
  const stageDefs = [
    { label: "New", count: newCount, statuses: ["New"] as SubmissionStatus[] },
    { label: "In review", count: inReviewCount, statuses: ["In progress", "Review", "For approval"] as SubmissionStatus[] },
    { label: "Revision requested", count: revisionCount, statuses: ["Revise"] as SubmissionStatus[] },
  ];
  const hmDayCounts: Record<string, number> = {};
  for (const submission of submissions) {
    const day = submission.submittedAt.slice(0, 10);
    if (day) hmDayCounts[day] = (hmDayCounts[day] || 0) + 1;
  }
  const hmLevel = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
  const hmToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const hmEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hmRangeDays = hmRange === 26 ? 182 : 364;
  const hmGridEnd = new Date(hmEnd);
  hmGridEnd.setDate(hmGridEnd.getDate() + (6 - hmGridEnd.getDay()));
  const hmStart = new Date(hmEnd);
  hmStart.setDate(hmStart.getDate() - hmRangeDays + 1);
  hmStart.setDate(hmStart.getDate() - hmStart.getDay());
  const hmDiffDays = Math.round((hmGridEnd.getTime() - hmStart.getTime()) / 86400000);
  const hmWeeks = Math.round((hmDiffDays + 1) / 7);
  const hmCells: { key: string; level: number; count: number; col: number; row: number; today: boolean }[] = [];
  const hmMonthCols: Record<number, string> = {};
  let hmPrevMonth = -1;
  let hmWindowTotal = 0;
  let hmRun = 0;
  let hmLongestStreak = 0;
  for (let i = 0; i < hmWeeks * 7; i++) {
    const d = new Date(hmStart);
    d.setDate(hmStart.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const col = Math.floor(i / 7);
    const row = i % 7;
    const count = hmDayCounts[key] || 0;
    if (d <= hmEnd) {
      hmWindowTotal += count;
      hmRun = count > 0 ? hmRun + 1 : 0;
      if (count > 0) hmLongestStreak = Math.max(hmLongestStreak, hmRun);
    }
    hmCells.push({ key, level: hmLevel(count), count, col, row, today: key === hmToday });
    if (row === 0 && d.getMonth() !== hmPrevMonth) {
      hmMonthCols[col] = new Intl.DateTimeFormat("en-PH", { month: "short" }).format(d);
      hmPrevMonth = d.getMonth();
    }
  }
  const hmCurrentStreak = hmRun;
  const hmActiveDays = hmCells.filter((c) => c.count > 0).length;
  const hmDow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const kpis = [
    { label: "Awaiting screening", value: awaitingScreening, note: "New and in progress", icon: FileText, onClick: () => onOpenSubmission(null) },
    { label: "In review", value: inReviewCount, note: "With the editorial panel", icon: Eye, onClick: () => onOpenSubmission(null) },
    { label: "Revisions requested", value: revisionCount, note: "Returned to authors", icon: RefreshCw, onClick: () => onOpenSubmission(null) },
    { label: "Published records", value: publishedCount, note: `${issueCount} issue${issueCount === 1 ? "" : "s"} in the library`, icon: BookOpen, onClick: () => onNavigate(12) },
  ];
  const dashCatalog = getJournalCatalog();
  const dashJournal = dashCatalog.journals.find((j) => !j.deleted && j.title === "InQuira") || dashCatalog.journals.find((j) => !j.deleted && dashCatalog.issues.some((i) => i.journalId === j.id && i.isCurrent && !i.deleted)) || dashCatalog.journals.find((j) => !j.deleted);
  const dashIssue = dashJournal ? (dashCatalog.issues.find((i) => i.journalId === dashJournal.id && i.isCurrent && !i.deleted) || dashCatalog.issues.find((i) => i.journalId === dashJournal.id && !i.deleted)) : undefined;
  const dashCover = dashIssue && dashIssue.cover ? jwCoverSrc(dashIssue.cover) : `${A}journal-academic-frontiers-hero.jpg`;
  const dashPct = dashIssue ? jwProductionPercent(dashIssue.status) : 74;
  const dashStudies = dashIssue ? dashIssue.articleOrder.length : 8;
  return (
    <div className="tp-page">
      <header className="tp-welcome" style={{ "--i": 0 } as React.CSSProperties}>
        <div>
          <h1 className="tp-welcome__title">Welcome to <span>Talikha Publishing</span></h1>
          <p className="tp-welcome__sub">Here's what's happening across your publishing workspace today.</p>
        </div>
        <div className="tp-welcome__actions">
          <button type="button" className="tp-btn tp-btn--outline" onClick={onAddTask}>
            <CalendarDays size={16} strokeWidth={1.9} /> Plan issue
          </button>
          <button type="button" className="tp-btn tp-btn--solid" onClick={() => onOpenSubmission(null)}>
            Review queue <ArrowUpRight size={16} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      <section className="tp-banner" style={{ "--i": 1 } as React.CSSProperties}>
        <span className="tp-banner__icon" aria-hidden="true"><ClipboardCheck size={22} strokeWidth={1.9} /></span>
        <div className="tp-banner__copy">
          <strong>Advancing knowledge. Honoring expression.</strong>
          <p>Thank you for being part of our mission to elevate research and stories that make an impact.</p>
        </div>
        <div className="tp-banner__art" aria-hidden="true"><BannerArt /></div>
      </section>

      <section className={`tp-card hm${hmRange === 52 ? " hm--year" : ""}`} style={{ "--i": 2, "--hm-weeks": hmWeeks } as React.CSSProperties}>
        <header className="tp-card__head">
          <span className="tp-ph__icon" aria-hidden="true"><Activity size={18} strokeWidth={1.9} /></span>
          <div className="tp-ph__text">
            <h2>Submission activity</h2>
            <p>A daily heat map of manuscripts received · click any active day</p>
          </div>
          <div className="hm-range-toggle" role="radiogroup" aria-label="Heatmap time range">
            <button type="button" className={`hm-range-btn${hmRange === 26 ? " is-active" : ""}`} role="radio" aria-checked={hmRange === 26} onClick={() => setHmRange(26)}>6M</button>
            <button type="button" className={`hm-range-btn${hmRange === 52 ? " is-active" : ""}`} role="radio" aria-checked={hmRange === 52} onClick={() => setHmRange(52)}>12M</button>
          </div>
          <div className="hm-stats">
            <button type="button" className="hm-stat" onClick={() => onOpenSubmission(null)} aria-label="Open all submissions">
              <strong>{hmWindowTotal}</strong><span>Submissions</span>
            </button>
            <div className="hm-stat"><strong>{hmActiveDays}</strong><span>Active days</span></div>
            <div className="hm-stat"><strong>{hmCurrentStreak}</strong><span>Day streak</span></div>
          </div>
        </header>
        <div className="hm-scroll">
          <div className="hm-grid">
            <span className="hm-month" />
            {Array.from({ length: hmWeeks }, (_, c) => (
              <span className="hm-month" key={`hm-m-${c}`}>{hmMonthCols[c] || ""}</span>
            ))}
            {hmDow.map((label, row) => (
              <Fragment key={`hm-r-${row}`}>
                <span className="hm-dow">{label}</span>
                {hmCells.filter((cell) => cell.row === row).map((cell) => {
                  const interactive = cell.count > 0;
                  const dayTitle = fmtDay(cell.key);
                  const items = interactive ? dayItems(cell.key) : [];
                  return (
                    <span
                      key={cell.key}
                      className={`hm-cell${cell.today ? " is-today" : ""}${interactive ? " is-clickable" : ""}`}
                      data-i={cell.level}
                      style={{ "--c": cell.col } as React.CSSProperties}
                      title={`${cell.count} submission${cell.count === 1 ? "" : "s"} on ${dayTitle}${interactive ? " · click to view" : ""}`}
                      {...(interactive ? {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": `${cell.count} submission${cell.count === 1 ? "" : "s"} on ${dayTitle}`,
                        onClick: (e: React.MouseEvent) => openDrill(e, dayTitle, `${cell.count} submission${cell.count === 1 ? "" : "s"}`, items),
                        onKeyDown: (e: React.KeyboardEvent) => activate(e, dayTitle, `${cell.count} submission${cell.count === 1 ? "" : "s"}`, items),
                      } : {})}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <footer className="hm-foot">
          <span className="hm-foot__hint">Each square is one day · {hmLongestStreak > 0 ? `longest streak ${hmLongestStreak} day${hmLongestStreak === 1 ? "" : "s"}` : "no streaks yet"}</span>
          <span className="hm-legend__scale">Less <i data-i="0" /><i data-i="1" /><i data-i="2" /><i data-i="3" /><i data-i="4" /> More</span>
        </footer>
      </section>

      <section className="tp-metrics" style={{ "--i": 3 } as React.CSSProperties} aria-label="Key metrics">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button type="button" className="tp-metric" key={kpi.label} onClick={kpi.onClick}>
              <span className="tp-metric__icon" aria-hidden="true"><Icon size={20} strokeWidth={1.9} /></span>
              <span className="tp-metric__body">
                <span className="tp-metric__label">{kpi.label}</span>
                <span className="tp-metric__value">{kpi.value}</span>
                <span className="tp-metric__note"><i className="tp-dot tp-dot--green" aria-hidden="true" /> {kpi.note}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="tp-analytics">
        <div className="tp-card" style={{ "--i": 4 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><BarChart3 size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text"><h2>Submissions by month</h2></div>
            <label className="tp-period">
              <CalendarDays size={14} strokeWidth={1.9} aria-hidden="true" />
              <select value={months} onChange={(event) => setMonths(Number(event.target.value))} aria-label="Chart period">
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={8}>Last 8 months</option>
                <option value={12}>Last 12 months</option>
              </select>
              <ChevronDown size={13} strokeWidth={2} aria-hidden="true" />
            </label>
          </header>
          <p className="tp-sub">Last {months} months · {submissions.length} manuscripts on file · click a bar</p>
          <div className="tp-chart2" role="img" aria-label={`Bar chart of submissions per month over the last ${months} months, peak ${peak}`}>
            <div className="tp-chart2__y">{yTicks.map((tick) => <span key={tick}>{tick}</span>)}</div>
            <div className="tp-chart2__plot">
              <div className="tp-chart2__grid">{yTicks.map((tick) => <i key={tick} />)}</div>
              <div className="tp-chart2__bars">
                {buckets.map((bucket, index) => {
                  const isCurrent = index === buckets.length - 1;
                  const zero = bucket.count === 0;
                  const cls = `tp-bar${isCurrent ? " is-current" : ""}${zero ? " is-zero" : ""}`;
                  const items = monthItems(bucket.key);
                  return (
                    <div
                      className="tp-barcol"
                      key={bucket.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${bucket.count} submission${bucket.count === 1 ? "" : "s"} in ${bucket.long}`}
                      onClick={(e) => openDrill(e, bucket.long, `${bucket.count} submission${bucket.count === 1 ? "" : "s"}`, items)}
                      onKeyDown={(e) => activate(e, bucket.long, `${bucket.count} submission${bucket.count === 1 ? "" : "s"}`, items)}
                    >
                      <i className={cls} style={zero ? undefined : { height: `${(bucket.count / yMax) * 100}%`, animationDelay: `${120 + index * 45}ms` }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="tp-chart2__x">{buckets.map((bucket) => <em key={bucket.key}>{bucket.label}</em>)}</div>
          </div>
          <footer className="tp-chart2__foot">
            <span className="lg"><i className="tp-swatch" aria-hidden="true" /> Monthly submissions</span>
            <span>{issueCount} issues · {authorCount} authors</span>
          </footer>
        </div>

        <div className="tp-card" style={{ "--i": 5 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><Layers size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text"><h2>Pipeline</h2></div>
            <button type="button" className="tp-link" onClick={() => onOpenSubmission(null)}>Review queue</button>
          </header>
          <p className="tp-sub">Manuscripts by stage · click a stage</p>
          <p className="tp-bigstat"><strong>{activeManuscriptCount}</strong> active manuscripts</p>
          <div className="tp-stage2">
            {stageDefs.map((stage) => {
              const items = stageItems(stage.statuses);
              return (
                <div
                  className="tp-stage2__block"
                  key={stage.label}
                  role="button"
                  tabIndex={0}
                  aria-label={`${stage.label}: ${stage.count}, view submissions`}
                  onClick={(e) => openDrill(e, stage.label, `${stage.count} in this stage`, items, stage.count)}
                  onKeyDown={(e) => activate(e, stage.label, `${stage.count} in this stage`, items, stage.count)}
                >
                  <div className="tp-stage2__row">
                    <span>{stage.label}</span>
                    <span className="tp-stage2__val"><b>{stage.count}</b><ChevronRight className="tp-stage2__chev" size={14} strokeWidth={2} /></span>
                  </div>
                  <span className="tp-track"><i className="tp-fill--green" style={{ width: `${activeManuscriptCount ? Math.min(100, (stage.count / activeManuscriptCount) * 100) : 0}%` }} /></span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="tp-operations">
        <div className="tp-card" style={{ "--i": 6 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><Inbox size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text"><h2>Editorial queue</h2></div>
            <button type="button" className="tp-link" onClick={() => onOpenSubmission(null)}>View all</button>
          </header>
          <p className="tp-sub">Latest manuscripts in</p>
          <label className="tp-select">
            <BookOpen size={15} strokeWidth={1.8} aria-hidden="true" />
            <select value={journal} onChange={(event) => setJournal(event.target.value)} aria-label="Filter queue by journal">
              <option>All journals</option>
              {journalOptions.map((title) => <option key={title}>{title}</option>)}
            </select>
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </label>
          <div className="tp-queue-count">
            <span className="tp-qc__label">Awaiting screening</span>
            <div className="tp-qc__right">
              <strong>{awaitingScreening}</strong>
              <button type="button" className="tp-link" onClick={() => onOpenSubmission(null)}>Start review <ChevronRight size={13} strokeWidth={2} /></button>
            </div>
          </div>
          {queue.length ? (
            <ul className="tp-queue-list">
              {queue.map((submission) => (
                <li key={submission.id}>
                  <button type="button" className="tp-queue-item" onClick={() => onOpenSubmission(submission.id)}>
                    <span className={`tp-jmark ${journalToneClass(submission.journal)}`} aria-hidden="true">{submission.journal.slice(0, 2)}</span>
                    <span className="tp-queue-text">
                      <strong>{submission.title}</strong>
                      <em>{submission.author} · {submission.displayDate}</em>
                    </span>
                    <span className={`tp-pill ${statusToneClass(submission.status)}`}>{submission.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="tp-emptybox"><Inbox size={18} strokeWidth={1.8} aria-hidden="true" /> No submissions for this journal yet.</div>
          )}
        </div>

        <div className="tp-card" style={{ "--i": 7 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><ClipboardList size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text"><h2>Editorial tasks</h2></div>
            <button type="button" className="tp-link" onClick={onAddTask}><Plus size={13} strokeWidth={2.4} /> Add</button>
          </header>
          {tasks.length ? (
            <>
              <p className="tp-sub">{doneTasks.size} of {tasks.length} done · click a task to open it</p>
              <div className="tp-tasks">
                {tasks.map((task) => {
                  const done = doneTasks.has(task.id);
                  return (
                    <div className={done ? "tp-task is-done" : "tp-task"} key={task.id}>
                      <button type="button" className="tp-check" aria-pressed={done} aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`} onClick={() => toggleTask(task.id)}>
                        {done && <Check size={11} strokeWidth={3} />}
                      </button>
                      <button type="button" className="tp-task__body" onClick={() => onOpenSubmission(task.id)} aria-label={`Open ${task.title}`}>
                        <strong>{task.title}</strong>
                        <em>{task.context}</em>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="tp-empty-illu">
              <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
                <rect x="26" y="16" width="44" height="62" rx="8" fill="#E8F6EE" stroke="#BFE0CC" strokeWidth="2" />
                <rect x="38" y="10" width="20" height="12" rx="4" fill="#087A45" />
                <g stroke="#087A45" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M36 40h24M36 50h24M36 60h16" />
                </g>
                <circle cx="30" cy="40" r="2.4" fill="#087A45" />
                <circle cx="30" cy="50" r="2.4" fill="#087A45" />
                <circle cx="30" cy="60" r="2.4" fill="#087A45" />
              </svg>
              <p>Tasks appear as new submissions arrive.</p>
            </div>
          )}
        </div>

        <div className="tp-card" style={{ "--i": 8 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><Users size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text"><h2>Team</h2></div>
          </header>
          <p className="tp-sub">Editorial desk · live presence</p>
          {overviewTeam.map((group, gi) => (
            <div key={group.group}>
              <p className={gi ? "tp-team-label tp-team-label--away" : "tp-team-label"}>{group.group}</p>
              <div className="tp-team-row">
                {group.people.map((person) => (
                  <div className="tp-person" key={person.name} title={`${person.name} · ${person.role} · ${group.group}`}>
                    <Avatar src={person.image} />
                    <div className="tp-person__text">
                      <strong>{person.name}</strong>
                      <span>{person.role}</span>
                    </div>
                    <i className={group.group === "Away" ? "tp-presence tp-presence--away" : "tp-presence"} aria-label={group.group} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="tp-bottom">
        <div className="tp-card tp-card--accent" style={{ "--i": 9 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><FileText size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text">
              <h2>Editorial spotlight</h2>
              <p>Desk activity and notes</p>
            </div>
          </header>
          <div className="tp-tabs" role="tablist" aria-label="Spotlight sections">
            {["Overview", "Comments", "Rewards"].map((name) => (
              <button type="button" role="tab" aria-selected={tab === name} className={tab === name ? "is-active" : ""} key={name} onClick={() => setTab(name)}>{name}</button>
            ))}
          </div>
          {tab === "Overview" && (
            <div className="tp-spot-row">
              <span className="tp-ph__icon sm" aria-hidden="true"><FileText size={16} strokeWidth={1.9} /></span>
              <div>
                <p><strong>{activeManuscriptCount} manuscripts</strong> are moving through the pipeline. {awaitingScreening ? `${awaitingScreening} still need a first screening pass.` : "Screening is up to date."}</p>
                <p className="tp-muted-line">Latest submission{recent[0] ? ` — ${recent[0].title}, ${recent[0].displayDate}` : "s pending"}.</p>
              </div>
            </div>
          )}
          {tab === "Comments" && (
            <div className="tp-comments">
              {overviewComments.map((comment, index) => (
                <div className="tp-comment" key={comment.name}>
                  <Avatar src={comment.image} />
                  <div>
                    <span>{comment.name} <em>· {comment.role}</em></span>
                    <p>{comment.text}</p>
                  </div>
                  <button type="button" className={liked.has(index) ? "tp-like is-liked" : "tp-like"} aria-pressed={liked.has(index)} aria-label={liked.has(index) ? "Unlike comment" : "Like comment"} onClick={() => toggleLike(index)}>
                    <Heart size={13} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
              <button type="button" className="tp-btn tp-btn--ghost tp-w-full" onClick={() => onOpenSubmission(null)}>
                <MessageSquare size={15} strokeWidth={1.8} /> Open discussion
              </button>
            </div>
          )}
          {tab === "Rewards" && (
            <div className="tp-rewards">
              {overviewRewards.map((reward) => (
                <div className="tp-reward" key={reward.name}>
                  <div>
                    <strong>{reward.name}</strong>
                    <em>{reward.detail}</em>
                  </div>
                  <div className="tp-reward__end">
                    <b>{reward.amount}</b>
                    <span className={`tp-pill ${reward.state === "Paid" ? "tp-pill--green" : reward.state === "Scheduled" ? "tp-pill--amber" : "tp-pill--neutral"}`}>{reward.state}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tp-card tp-card--accent" style={{ "--i": 10 } as React.CSSProperties}>
          <header className="tp-card__head">
            <span className="tp-ph__icon" aria-hidden="true"><BarChart3 size={18} strokeWidth={1.9} /></span>
            <div className="tp-ph__text"><h2>Current issue</h2></div>
            <button type="button" className="tp-link" onClick={() => onNavigate(12)}>Production</button>
          </header>
          <div className="tp-issue2">
            <div className="tp-issue2__cover">
              <img src={dashCover} alt={dashJournal ? `${dashJournal.title} journal cover` : "Journal cover"} />
            </div>
            <div className="tp-issue2__right">
              <div className="tp-issue2__info">
                <span className="tp-issue2__feat">{dashIssue?.isSpecial && dashIssue.specialLabel ? dashIssue.specialLabel : dashIssue?.isCurrent ? "Current issue" : "Featured journal"}</span>
                <strong>{dashJournal?.title || "InQuira"}</strong>
                <em>{dashIssue ? `Volume ${dashIssue.volume} · Issue ${dashIssue.issue}` : "Volume 3 · Issue 2"}</em>
              </div>
              <dl className="tp-issue-meta">
                <div><dt>Publication date</dt><dd>{dashIssue?.publicationDate ? jwFmtDate(dashIssue.publicationDate) : "—"}</dd></div>
                <div><dt>Articles</dt><dd>{dashStudies} assigned</dd></div>
                <div>
                  <dt>Production</dt>
                  <dd>
                    <span className="tp-track tp-track--inline"><i className="tp-fill--green" style={{ width: `${dashPct}%` }} /></span>
                    <b className="tp-mono">{dashPct}%</b>
                  </dd>
                </div>
              </dl>
              <button type="button" className="tp-btn tp-btn--soft tp-w-full" onClick={onOpenIssue}>Open issue <ChevronRight size={15} strokeWidth={2} /></button>
            </div>
          </div>
        </div>
      </section>

      {drill && (
        <>
          <button type="button" className="tp-drill-scrim" aria-label="Close detail" onClick={closeDrill} />
          <div
            className="tp-drill"
            style={{ left: drillPos.left, top: drillPos.top, bottom: drillPos.bottom, maxHeight: drillPos.maxHeight, "--w": `${drillPos.width}px` } as React.CSSProperties}
            role="dialog"
            aria-label={drill.title}
          >
            <header className="tp-drill__head">
              <div>
                <h3>{drill.title}</h3>
                <p>{drill.subtitle}</p>
              </div>
              <button type="button" className="tp-drill__close" aria-label="Close" onClick={closeDrill}><X size={15} strokeWidth={2} /></button>
            </header>
            {drill.items.length ? (
              <div className="tp-drill__list">
                {drill.items.slice(0, 8).map((item, i) => (
                  <button
                    type="button"
                    className="tp-drill__row"
                    key={item.id}
                    style={{ animationDelay: `${i * 28}ms` }}
                    onClick={() => { if (item.kind === "submission") onOpenSubmission(item.id); else onNavigate(12); closeDrill(); }}
                  >
                    <span className={`tp-jmark ${journalToneClass(item.journal || "")}`} aria-hidden="true">{(item.journal || "TP").slice(0, 2)}</span>
                    <span className="tp-drill__text"><strong>{item.title}</strong><em>{item.meta}</em></span>
                    {item.status && <span className={`tp-pill ${statusToneClass(item.status)}`}>{item.status}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="tp-drill__empty">No submissions in this period yet.</div>
            )}
            {drill.headerCount != null && drill.items.length < drill.headerCount && (
              <div className="tp-drill__more">+ {drill.headerCount - drill.items.length} more tracked by stage in the live pipeline</div>
            )}
            {drill.items.length > 0 && (
              <footer className="tp-drill__foot">
                <button type="button" onClick={() => { onOpenSubmission(null); closeDrill(); }}>Open all in submissions <ChevronRight size={14} strokeWidth={2} /></button>
              </footer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
type AdminSidebarProps = {
  active: number;
  onNavigate: (index: number) => void;
  isAdmin: boolean;
  allowedViews: number[] | null;
  submissionsOpen: boolean;
  onToggleSubmissions: () => void;
  onOpenNewSubmissions: () => void;
  newSubmissionsCount: number;
};
function AdminSidebar({
  active,
  onNavigate,
  isAdmin,
  allowedViews,
  submissionsOpen,
  onToggleSubmissions,
  onOpenNewSubmissions,
  newSubmissionsCount,
}: AdminSidebarProps) {
  const { setOpenMobile } = useSidebar();
  const sections = sidebarSections
    .map((section) => ({
      ...section,
      items: isAdmin ? section.items : section.items.filter((item) => allowedViews?.includes(item.index)),
    }))
    .filter((section) => section.items.length > 0);
  const go = (index: number) => {
    onNavigate(index);
    setOpenMobile(false);
  };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="tp-brand">
              <span className="tp-mark" aria-hidden="true">TP</span>
              <span className="tp-brand__text">
                <strong>Talikha</strong>
                <em>Editorial desk</em>
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarMenu>
              {isAdmin && section.label === "Editorial library" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={active === 1}
                    tooltip="Submissions"
                    aria-expanded={submissionsOpen}
                    onClick={() => {
                      onToggleSubmissions();
                      setOpenMobile(false);
                    }}
                  >
                    <Inbox />
                    <span>Submissions</span>
                    <ChevronDown className={submissionsOpen ? "tp-subchev ml-auto size-3.5 opacity-60 transition-transform duration-200 rotate-180" : "tp-subchev ml-auto size-3.5 opacity-60 transition-transform duration-200"} />
                  </SidebarMenuButton>
                  {submissionsOpen && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={active === 1}
                          onClick={() => {
                            onOpenNewSubmissions();
                            setOpenMobile(false);
                          }}
                        >
                          <span>New submissions</span>
                          <b className="tp-count">{newSubmissionsCount}</b>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}
              {section.items.map(({ label, icon: Icon, index }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    isActive={active === index}
                    tooltip={label}
                    aria-current={active === index ? "page" : undefined}
                    onClick={() => go(index)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={active === 8} tooltip="Settings" onClick={() => go(8)}>
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={active === 9} tooltip="Support" onClick={() => go(9)}>
              <Headphones />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function App({ accessRole = "admin" }: { accessRole?: "admin" | "editor" | "viewer" }) {
  // Keep the server and first client render deterministic; restore the URL view after hydration.
  const [active, setActiveState] = useState(0),
    [notice, setNotice] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(true),
    [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false),
    [submissionView, setSubmissionView] = useState<SubmissionView>("New"),
    [productionView, setProductionView] = useState<"Needs action" | "Approval" | "Published" | "Closed">("Needs action"),
    [submissionsOpen, setSubmissionsOpen] = useState(false),
    [editorialSubmissions, setEditorialSubmissions] = useState<EditorialSubmission[]>(
      [],
    ),
    [publicationRecords, setPublicationRecords] = useState<PublicationRecord[]>(
      [],
    ),
    [submissionsReady, setSubmissionsReady] = useState(false),
    [scheduleCreateRequested, setScheduleCreateRequested] = useState(false),
    [overviewTaskOpen, setOverviewTaskOpen] = useState(false),
    [overviewTaskSeed, setOverviewTaskSeed] = useState<ScheduleTask>(() => ({ ...emptyTask, id: "task-seed" })),
    [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(
      null,
    ),
    [isConnected, setIsConnected] = useState(false),
    [workspaceData, setWorkspaceData] = useState<{ media: Record<string, unknown>[] } | null>(null),
    [realData, setRealData] = useState<{ stageCounts: Record<string, number>; totalSubmissions: number; totalJournals: number; totalAuthors: number; journals: { id: string; title: string; slug: string }[] } | null>(null);
  const [viewSwitching, setViewSwitching] = useState(false);
  const viewSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewRole, setPreviewRole] = useState<"admin" | "editor">(accessRole === "admin" ? "admin" : "editor");
  const effectiveRole = previewRole;
  const isAdmin = effectiveRole === "admin";
  const allowedViews = isAdmin ? null : [0, 2, 3, 4, 7, 10, 12, 13];
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restores URL view on role change; reads window.location
  // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedViews is derived from isAdmin (the dep); including it would cause infinite loop
  useEffect(() => {
    const locationView = viewFromLocation();
    if (!allowedViews || allowedViews.includes(locationView)) setActiveState(locationView);
  }, [isAdmin]);
  useEffect(() => {
    const handleProductionView = (event: Event) => {
      const value = (event as CustomEvent<"Needs action" | "Approval" | "Published" | "Closed">).detail;
      if (value) {
        setProductionView(value);
        const params = new URLSearchParams(window.location.search);
        params.set("view", "production");
        params.set("production", value.toLowerCase().replaceAll(" ", "-"));
        window.history.pushState(null, "", `/admin?${params.toString()}`);
      }
    };
    window.addEventListener("talikha:production-view", handleProductionView);
    return () => window.removeEventListener("talikha:production-view", handleProductionView);
  }, []);
  const setActive = (index: number, detail?: Record<string, string | null>) => {
    if (allowedViews && !allowedViews.includes(index)) return;
    if (index === 12 && !detail?.submission) setSelectedSubmissionId(null);
    const changed = index !== active;
    setActiveState(index);
    if (changed && submissionsReady && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setViewSwitching(true);
      if (viewSwitchTimer.current) clearTimeout(viewSwitchTimer.current);
      viewSwitchTimer.current = setTimeout(() => setViewSwitching(false), 420);
    }
    const params = new URLSearchParams();
    params.set("view", workspaceViews[index] || "overview");
    Object.entries(detail || {}).forEach(([key, value]) => { if (value) params.set(key, value); });
    window.history.pushState(null, "", `/admin?${params.toString()}`);
  };
  const openProductionRecord = (submissionId: string) => {
    const submission = editorialSubmissions.find((item) => item.id === submissionId);
    if (submission && !publicationRecords.some((record) => record.submissionId === submissionId)) {
      const catCur = jwCurrentForTitle(submission.journal);
      const defaults = catCur || (journalIssueDefaults[submission.journal] ?? { volume: "1", issue: "1" });
      setPublicationRecords((records) => [...records, { id: `PUB-${submissionId}`, submissionId, journal: submission.journal, volume: defaults.volume, issue: defaults.issue, doi: "", pageStart: "", pageEnd: "", readCount: 0, downloadCount: 0, status: "Draft" }]);
    }
    setSelectedSubmissionId(submissionId);
    setActive(12, { submission: submissionId });
  };
  useEffect(() => () => { if (viewSwitchTimer.current) clearTimeout(viewSwitchTimer.current); }, []);
  useEffect(() => {
    if (!submissionsReady) return;
    const params = new URLSearchParams();
    params.set("view", workspaceViews[active] || "overview");
    if ((active === 1 || active === 12) && selectedSubmissionId) params.set("submission", selectedSubmissionId);
    window.history.replaceState(null, "", `/admin?${params.toString()}`);
  }, [active, selectedSubmissionId, submissionsReady]);
  useLayoutEffect(() => {
    const localSampleKey = "talikha-editorial-submissions-v1";
    const readLocalSamples = (): EditorialSubmission[] => {
      if (process.env.NODE_ENV === "production") return [];
      try {
        const stored = JSON.parse(window.localStorage.getItem(localSampleKey) || "[]") as Array<Record<string, unknown>>;
        if (!Array.isArray(stored)) return [];
        return stored.filter((sample) => typeof sample.id === "string" && String(sample.id).startsWith("TP-")).map((sample) => {
          const localAuthors = Array.isArray(sample.authors) ? sample.authors.filter((author): author is Record<string, unknown> => Boolean(author && typeof author === "object")).map((author, index) => ({
            id: `${String(sample.id)}-author-${index + 1}`,
            name: [author.firstName, author.middleInitial, author.surname].filter((value) => typeof value === "string" && value.trim()).join(" "),
            firstName: String(author.firstName || ""),
            middleInitial: String(author.middleInitial || ""),
            surname: String(author.surname || ""),
            email: String(author.email || sample.email || "sample@example.test"),
            affiliation: String(author.institution || "Local sample"),
            academicTitle: String(author.academicTitle || ""),
            occupation: "Submitting author",
          })) : [];
          return ({
          id: String(sample.id),
          title: String(sample.title || "Sample manuscript"),
          author: String(sample.author || "Sample author"),
          email: String(sample.email || "sample@example.test"),
          affiliation: "Local sample",
          journal: normalizeJournal(String(sample.journal || "InQuira")),
          status: "New" as SubmissionStatus,
          submittedAt: typeof sample.submittedAt === "string" ? workspaceDate(sample.submittedAt) : workspaceDate(new Date().toISOString()),
          displayDate: typeof sample.displayDate === "string" ? sample.displayDate : workspaceDisplayDate(new Date().toISOString()),
          image: portraits[0],
          abstract: "Local-only sample submission. It is not stored in Supabase or published online.",
          fileName: "No files uploaded — local sample",
          paymentProof: false,
          authors: localAuthors.length ? localAuthors : undefined,
          history: Array.isArray(sample.history) ? sample.history.filter((entry): entry is string => typeof entry === "string") : [],
          });
        });
      } catch { return []; }
    };
    const mergeLocalSamples = (records: EditorialSubmission[]) => {
      const localSamples = readLocalSamples();
      return [...localSamples.filter((sample) => !records.some((record) => record.id === sample.id)), ...records];
    };
    const restoreLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const nextView = viewIndex(params.get("view"));
      setActiveState(!allowedViews || allowedViews.includes(nextView) ? nextView : 0);
      const productionParam = params.get("production");
      if (productionParam === "published") setProductionView("Published");
      else if (productionParam === "approval") setProductionView("Approval");
      else if (productionParam === "closed") setProductionView("Closed");
      else if (productionParam === "needs-action") setProductionView("Needs action");
      setSelectedSubmissionId(params.get("submission"));
    };
    restoreLocation();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- merges localStorage samples on mount; reads window.localStorage
    setEditorialSubmissions((records) => mergeLocalSamples(records));
    const syncLocalSamples = (event: StorageEvent) => {
      if (event.key === localSampleKey) setEditorialSubmissions((records) => mergeLocalSamples(records.filter((record) => !record.id.startsWith("TP-"))));
    };
    window.addEventListener("popstate", restoreLocation);
    window.addEventListener("storage", syncLocalSamples);
    fetch("/api/admin/workspace")
      .then((res) => res.json())
      .then((result) => {
        if (result.connected && result.data) {
          const serverSubmissions = result.data.submissions.map((submission: Record<string, unknown>) => {
            const preferred = Array.isArray(submission.preferred_journal) ? submission.preferred_journal[0] : submission.preferred_journal;
            return { id: String(submission.id), title: String(submission.title || "Untitled submission"), author: String(submission.author_name || "Author pending"), email: String(submission.author_email || ""), affiliation: String(submission.affiliation || ""), journal: String((preferred as { title?: string } | null)?.title || "InQuira"), status: stageToSubmissionStatus[String(submission.current_stage)] || "New", submittedAt: workspaceDate(String(submission.submitted_at || submission.created_at || "")), displayDate: workspaceDisplayDate(String(submission.submitted_at || submission.created_at || "")), image: portraits[0], abstract: String(submission.abstract || ""), fileName: "No manuscript selected", paymentProof: false, history: [] } satisfies EditorialSubmission;
          });
          const serverRecords = result.data.publicationRecords.map((record: Record<string, unknown>) => {
            const journal = Array.isArray(record.journals) ? record.journals[0] : record.journals;
            const issue = Array.isArray(record.issues) ? record.issues[0] : record.issues;
            return { id: String(record.id), submissionId: String(record.submission_id), journal: String((journal as { title?: string } | null)?.title || "InQuira"), volume: String((issue as { volume?: string | number } | null)?.volume || "—"), issue: String((issue as { issue_number?: string | number } | null)?.issue_number || "—"), doi: String(record.doi || ""), pageStart: "", pageEnd: "", scheduledFor: typeof record.scheduled_for === "string" ? record.scheduled_for : undefined, status: record.published_at ? "Published" : record.scheduled_for ? "Scheduled" : "Ready to publish" } satisfies PublicationRecord;
          });
          setEditorialSubmissions(mergeLocalSamples(serverSubmissions));
          setPublicationRecords(serverRecords);
          setWorkspaceData({ media: result.data.media || [] });
          setIsConnected(true);
          setPreviewRole(result.data.user?.role === "admin" ? "admin" : "editor");
          const stageCounts: Record<string, number> = {};
          result.data.submissions.forEach((submission: Record<string, unknown>) => { const stage = String(submission.current_stage || ""); stageCounts[stage] = (stageCounts[stage] || 0) + 1; });
          setRealData({ stageCounts, totalSubmissions: serverSubmissions.length, totalJournals: result.data.journals.length, totalAuthors: result.data.authors.length, journals: result.data.journals });
        }
      })
      .catch(() => undefined)
      .finally(() => setSubmissionsReady(true));

    return () => {
      window.removeEventListener("popstate", restoreLocation);
      window.removeEventListener("storage", syncLocalSamples);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only effect; setters are stable, mergeLocalSamples is local
  }, []);
  useEffect(() => {
    if (import.meta.env.PROD && submissionsReady && !isConnected) {
      window.location.replace("/admin/login");
    }
  }, [submissionsReady, isConnected]);
  const awaitingScreening = isConnected && realData
    ? (realData.stageCounts["review_new"] || 0) + (realData.stageCounts["review_in_progress"] || 0)
    : editorialSubmissions.filter(
        (submission) =>
          submission.status === "New" || submission.status === "In progress",
      ).length;
  const newCount = isConnected && realData
    ? realData.stageCounts["review_new"] || 0
    : editorialSubmissions.filter((submission) => submission.status === "New").length;
  const inReviewCount = isConnected && realData
    ? (realData.stageCounts["review_in_progress"] || 0) + (realData.stageCounts["review_final"] || 0)
    : editorialSubmissions.filter((submission) => submission.status === "In progress" || submission.status === "Review").length;
  const revisionCount = isConnected && realData
    ? realData.stageCounts["review_accepted"] || 0
    : editorialSubmissions.filter((submission) => submission.status === "Revise").length;
  const activeManuscriptCount = isConnected && realData
    ? realData.totalSubmissions
    : newCount + inReviewCount + revisionCount;
  const updateSubmission = (updated: EditorialSubmission) => {
    setEditorialSubmissions((records) =>
      records.map((record) => (record.id === updated.id ? updated : record)),
    );
    if (process.env.NODE_ENV !== "production") {
      try {
        const key = "talikha-editorial-submissions-v1";
        const stored = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<Record<string, unknown>>;
        const next = stored.some((record) => String(record.id || "") === updated.id)
          ? stored.map((record) => (String(record.id || "") === updated.id ? { ...record, ...updated } : record))
          : [...stored, updated];
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch { /* The in-memory admin list remains authoritative for this session. */ }
    }
  };
  const deleteSubmission = (submissionId: string) => {
    setEditorialSubmissions((records) => records.filter((record) => record.id !== submissionId));
    setPublicationRecords((records) => records.filter((record) => record.submissionId !== submissionId));
    if (process.env.NODE_ENV !== "production") {
      try {
        const key = "talikha-editorial-submissions-v1";
        const stored = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<Record<string, unknown>>;
        window.localStorage.setItem(key, JSON.stringify(stored.filter((record) => String(record.id || "") !== submissionId)));
      } catch { /* The in-memory admin list is still cleared. */ }
    }
    setSelectedSubmissionId(null);
    setSubmissionsOpen(false);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link resolver; reads URL params after data loads, cannot run during render
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable; effect re-runs when submissions arrive or ready flag flips
  useEffect(() => {
    if (!submissionsReady) return;
    const params = new URLSearchParams(window.location.search);
    const reference = (params.get("submission") || params.get("reference"))?.trim();
    if (!reference || !editorialSubmissions.some((submission) => submission.id === reference)) return;
    setSelectedSubmissionId(reference);
    if (params.get("view") === "production") {
      setActiveState(12);
    } else {
      setSubmissionView("New");
      setSubmissionsOpen(true);
      setActiveState(1);
    }
  }, [editorialSubmissions, submissionsReady]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotice(false);
        setProfileOpen(false);
        setWorkspaceMenuOpen(false);
        return;
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotice(false);
        setProfileOpen(false);
        setWorkspaceMenuOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <TooltipProvider>
    <SidebarProvider open={!sidebarCollapsed} onOpenChange={(open) => setSidebarCollapsed(!open)} style={{ "--sidebar-width": "252px", "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}>
      <AdminSidebar
        active={active}
        onNavigate={setActive}
        isAdmin={isAdmin}
        allowedViews={allowedViews}
        submissionsOpen={submissionsOpen}
        onToggleSubmissions={() => {
          if (active === 1) {
            setSubmissionsOpen((open) => !open);
          } else {
            setActive(1);
            setSubmissionView("New");
            setSubmissionsOpen(true);
          }
        }}
        onOpenNewSubmissions={() => {
          setActive(1);
          setSubmissionView("New");
          setSelectedSubmissionId(null);
        }}
        newSubmissionsCount={submissionsForView(editorialSubmissions, "New").length}
      />
      <SidebarInset className="tp-main">
        <header className="tp-top">
          <div className="tp-top__left">
            <SidebarTrigger className="tp-iconbtn" />
            <nav className="tp-crumb" aria-label="Breadcrumb">
              <span>Talikha</span>
              <ChevronRight size={12} strokeWidth={1.75} aria-hidden="true" />
              <strong>{destinations[active]}</strong>
            </nav>
          </div>
          <div className="tp-top__right">
            <button
              type="button"
              className="tp-search"
              onClick={() => {
                setSearchOpen(true);
                setNotice(false);
                setProfileOpen(false);
                setWorkspaceMenuOpen(false);
              }}
              aria-label="Search"
            >
              <Search size={14} strokeWidth={1.75} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              type="button"
              className="tp-iconbtn tp-bell"
              onClick={() => {
                setNotice(!notice);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              aria-expanded={notice}
            >
              <Bell size={16} strokeWidth={1.75} />
              {awaitingScreening > 0 && <i aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="tp-profile"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotice(false);
              }}
              aria-label="Open account menu"
              aria-expanded={profileOpen}
            >
              <Avatar src={portraits[0]} size="sm" />
              <ChevronDown size={13} strokeWidth={1.75} />
            </button>
            {notice && (
              <div className="tp-popover">
                <strong>Notifications</strong>
                <p>{awaitingScreening} submissions need editorial screening.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubmissionId(null);
                    setActive(1);
                    setSubmissionView("New");
                    setSubmissionsOpen(true);
                    setNotice(false);
                  }}
                >
                  Open submissions
                </button>
              </div>
            )}
            {profileOpen && (
              <div className="tp-popover">
                <strong>Local preview editor</strong>
                <span>Local preview account</span>
                <button
                  type="button"
                  onClick={() => {
                    setActive(8);
                    setProfileOpen(false);
                  }}
                >
                  <Settings size={14} strokeWidth={1.75} />
                  Settings
                </button>
                <button type="button" disabled>
                  <ShieldCheck size={14} strokeWidth={1.75} />
                  Account security
                </button>
              </div>
            )}
          </div>
        </header>
        {searchOpen && (
          <SearchPalette
            close={() => setSearchOpen(false)}
            navigate={setActive}
          />
        )}
        {!submissionsReady || viewSwitching ? (
          <WorkspaceSkeleton kind={viewSkeletonKind[active] ?? "overview"} />
        ) : active === 1 ? (
          <div className="review-workspace">
            <SubmissionWorkspace
              submissions={editorialSubmissions}
              publicationRecords={publicationRecords}
              view={submissionView}
              selectedId={selectedSubmissionId}
              onSelect={setSelectedSubmissionId}
              onUpdate={updateSubmission}
              onDelete={deleteSubmission}
              onPublicationRecordsChange={setPublicationRecords}
              onReturnToSubmissions={() => {
                setSelectedSubmissionId(null);
                setSubmissionView("New");
                setSubmissionsOpen(false);
                setActive(1);
              }}
              accessRole={effectiveRole}
            />
          </div>
        ) : active === 2 ? (
          <div className="schedule-workspace">
            <FunctionalScheduleView createRequested={scheduleCreateRequested} onCreateOpened={() => setScheduleCreateRequested(false)} />
          </div>
        ) : active === 3 ? (
          <div className="authors-workspace">
            <AuthorsView
              submissions={editorialSubmissions}
              onOpenSubmission={(id) => {
                setSelectedSubmissionId(id);
                setActive(1);
              }}
            />
          </div>
        ) : active === 4 ? (
          <div className="studies-workspace">
            <StudiesView submissions={editorialSubmissions} publicationRecords={publicationRecords} onOpenRecord={openProductionRecord} />
          </div>
        ) : active === 11 ? (
          <div className="studies-workspace">
            <JournalsView submissions={editorialSubmissions} publicationRecords={publicationRecords} onOpenSubmission={(submissionId) => { setSelectedSubmissionId(submissionId); setSubmissionsOpen(true); setActive(1); }} onUpdate={updateSubmission} onPublicationRecordsChange={setPublicationRecords} />
          </div>
        ) : active === 12 ? (
          <div className="studies-workspace">
            <ProductionWorkspaceV2 submissions={editorialSubmissions} publicationRecords={publicationRecords} view={productionView} selectedId={selectedSubmissionId} onSelect={setSelectedSubmissionId} onUpdate={updateSubmission} onDelete={deleteSubmission} onPublicationRecordsChange={setPublicationRecords} accessRole={effectiveRole} />
          </div>
        ) : active === 13 ? (
          <div className="studies-workspace">
            <MediaWorkspace assets={workspaceData?.media || []} />
          </div>
        ) : active === 14 ? (
          <div className="utility-workspace">
            <AnnouncementWorkspace />
          </div>
        ) : active === 5 ? (
          <div className="bank-workspace">
            <BankView />
          </div>
        ) : active === 6 ? (
          <div className="utility-workspace">
            <FeaturedView />
          </div>
        ) : active === 7 ? (
          <div className="utility-workspace">
            <ReportsView />
          </div>
        ) : active === 8 ? (
          <div className="utility-workspace">
            <SettingsView />
          </div>
        ) : active === 9 ? (
          <div className="utility-workspace">
            <SupportView />
          </div>
        ) : active === 10 ? (
          <CertificateWorkspace submissions={editorialSubmissions} />
        ) : (
          <OverviewDashboard
            submissions={editorialSubmissions}
            publicationRecords={publicationRecords}
            isConnected={isConnected}
            realData={realData}
            awaitingScreening={awaitingScreening}
            newCount={newCount}
            inReviewCount={inReviewCount}
            revisionCount={revisionCount}
            activeManuscriptCount={activeManuscriptCount}
            onOpenSubmission={(id) => { setSelectedSubmissionId(id); setSubmissionView("New"); setSubmissionsOpen(true); setActive(1); }}
            onOpenIssue={() => { setSelectedSubmissionId(null); setSubmissionView("Published"); setSubmissionsOpen(true); setActive(1); }}
            onAddTask={() => { setOverviewTaskSeed({ ...emptyTask, id: `task-${Date.now()}` }); setOverviewTaskOpen(true); }}
            onNavigate={(index) => setActive(index)}
          />
        )}

        <OverviewTaskEditor
          open={overviewTaskOpen}
          seed={overviewTaskSeed}
          onClose={() => setOverviewTaskOpen(false)}
          onSave={(task) => {
            try {
              const stored: ScheduleTask[] = JSON.parse(localStorage.getItem("lakbay-admin-schedule") || "[]");
              const idx = stored.findIndex((t) => t.id === task.id);
              if (idx >= 0) stored[idx] = task; else stored.push(task);
              localStorage.setItem("lakbay-admin-schedule", JSON.stringify(stored));
            } catch {}
            window.dispatchEvent(new CustomEvent("talikha:task-saved", { detail: task }));
            setOverviewTaskOpen(false);
          }}
        />

        {/* Dock — quick actions */}
        <FloatingDock
          label="Quick actions"
          active={active}
          items={[
            { index: 1, title: "Submissions", icon: FileText, onClick: () => { setActive(1); setSubmissionView("New"); setSubmissionsOpen(true); } },
            { index: 3, title: "Authors", icon: Users, onClick: () => setActive(3) },
            { index: 11, title: "Journals", icon: BookOpen, onClick: () => setActive(11) },
            { index: 12, title: "Production", icon: Send, onClick: () => setActive(12) },
            { index: 4, title: "Publications", icon: BookOpen, onClick: () => setActive(4) },
          ]}
        />
        {process.env.NODE_ENV !== "production" && <button
          type="button"
          className="tp-roletoggle"
          onClick={() => setPreviewRole((role) => role === "admin" ? "editor" : "admin")}
          title="Temporary local role preview"
        >
          <ShieldCheck size={13} strokeWidth={1.75} />
          <span>{effectiveRole === "admin" ? "Admin access" : "Team access"}</span>
          <small>Switch</small>
        </button>}
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
export { App as PrototypeAdminPanel };

const rootElement = typeof document === "undefined" ? null : document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
