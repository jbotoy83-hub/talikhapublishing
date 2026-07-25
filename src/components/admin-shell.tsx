import Link from "next/link";
import {
  Archive,
  Award,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  UsersRound
} from "lucide-react";
import { Brand } from "./brand";
import type { AdminUser } from "@/lib/auth";
import { logout } from "@/app/admin/actions";

const navigation = [
  {
    label: "Workspace",
    links: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }]
  },
  {
    label: "Editorial records",
    links: [
      { href: "/admin/submissions", label: "Submission review", icon: FileStack },
      { href: "/admin/production", label: "Publication production", icon: FolderKanban },
      { href: "/admin/certificates", label: "Certificates", icon: Award },
      { href: "/admin/schedule", label: "Publishing schedule", icon: CalendarDays }
    ]
  },
  {
    label: "Editorial library",
    links: [
      { href: "/admin/publications", label: "Studies", icon: BookOpenText },
      { href: "/admin/authors", label: "Authors", icon: UsersRound },
      { href: "/admin/journals", label: "Journals & issues", icon: Archive }
    ]
  }
];

export function AdminShell({ user, title, description, children }: { user: AdminUser; title: string; description: string; children: React.ReactNode }) {
  return (
    <main id="main-content" className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="admin-sidebar-scroll order-2 border-t border-slate-200 bg-white px-4 py-5 lg:order-1 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-t-0 lg:px-3">
          <div className="flex items-center justify-between px-2">
            <Brand />
            <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>

          <nav aria-label="Publisher administration" className="mt-8 space-y-7">
            {navigation.map((group) => (
              <section key={group.label}>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-400">{group.label}</p>
                <ul className="mt-2 space-y-1">
                  {group.links.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link href={href} className="group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100">
                        <Icon className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-violet-600" aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>

          <div className="mt-8 border-t border-slate-100 px-2 pt-5">
            <p className="text-sm font-semibold text-slate-800">{user.displayName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-600">{user.role}</p>
            <form action={logout} className="mt-4">
              <button className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8 lg:px-10">
            <div className="flex items-center justify-end">
              <Link href="/" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100">
                View public site
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </header>
          <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600">Editorial workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
