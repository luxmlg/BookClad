import { Suspense } from "react";
import { RevenueSection } from "./components/revenue-section";
import { CostSection } from "./components/cost-section";
import { ProfitabilitySection } from "./components/profitability-section";
import { AnomalySection } from "./components/anomaly-section";

interface AdminPageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const startDate = params.start ? new Date(params.start) : defaultStart;
  const endDate = params.end ? new Date(params.end) : defaultEnd;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <DateRangeForm start={startDate} end={endDate} />
      </div>
      <div className="space-y-10">
        <Suspense fallback={<SectionSkeleton />}>
          <RevenueSection startDate={startDate} endDate={endDate} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <CostSection startDate={startDate} endDate={endDate} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <ProfitabilitySection startDate={startDate} endDate={endDate} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <AnomalySection />
        </Suspense>
      </div>
    </div>
  );
}

function DateRangeForm({ start, end }: { start: Date; end: Date }) {
  return (
    <form className="flex items-center gap-2" method="get">
      <input
        type="date"
        name="start"
        defaultValue={start.toISOString().slice(0, 10)}
        className="rounded border px-2 py-1 text-sm"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        name="end"
        defaultValue={end.toISOString().slice(0, 10)}
        className="rounded border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
      >
        Apply
      </button>
    </form>
  );
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
