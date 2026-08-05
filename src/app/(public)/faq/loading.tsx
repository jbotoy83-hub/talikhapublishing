import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="main-content" aria-busy="true" className="bg-parchment">
      <span className="sr-only" role="status">
        Loading frequently asked questions
      </span>
      <section className="border-b border-forest-900/10">
        <div className="section-shell grid items-end gap-10 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.62fr)] lg:gap-24 lg:py-20">
          <div className="grid content-start gap-4">
            <Skeleton className="h-3.5 w-32 rounded-full bg-forest-900/10" />
            <Skeleton className="h-16 w-full max-w-xl rounded-2xl bg-forest-900/10 sm:h-20" />
            <Skeleton className="h-4 w-full max-w-md rounded-full bg-forest-900/10" />
          </div>
          <Skeleton className="h-64 w-full max-w-sm rounded-2xl bg-forest-900/10 lg:justify-self-end" />
        </div>
      </section>
      <section className="section-shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(150px,0.26fr)_minmax(0,1fr)] lg:gap-16">
        <div className="hidden content-start gap-3 lg:grid">
          <Skeleton className="h-3 w-24 rounded-full bg-forest-900/10" />
          <Skeleton className="h-9 w-40 rounded-full bg-forest-900/10" />
          <Skeleton className="h-9 w-36 rounded-full bg-forest-900/10" />
          <Skeleton className="h-9 w-44 rounded-full bg-forest-900/10" />
        </div>
        <div className="grid content-start gap-3">
          <Skeleton className="h-8 w-56 rounded-full bg-forest-900/10" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl bg-forest-900/10" />
          ))}
        </div>
      </section>
    </main>
  );
}
