import {
  getSubscribersByTier,
  getEstimatedMRR,
  getCreditPackRevenueTotal,
} from "../lib/queries";
import { MetricCard } from "./metric-card";
import { SimpleDonutChart } from "./charts";

interface RevenueSectionProps {
  startDate: Date;
  endDate: Date;
}

export async function RevenueSection({ startDate, endDate }: RevenueSectionProps) {
  const [subscribersByTier, estimatedMRR, creditPackRevenue] = await Promise.all([
    getSubscribersByTier(),
    getEstimatedMRR(),
    getCreditPackRevenueTotal(startDate, endDate),
  ]);

  const totalRevenue = estimatedMRR + creditPackRevenue;

  const donutData = subscribersByTier.map((s) => ({
    name: s.tier,
    value: s.count,
  }));

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Revenue</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <MetricCard
          label="Total Users"
          value={subscribersByTier.reduce((sum, s) => sum + s.count, 0).toString()}
        />
        <MetricCard
          label="Estimated MRR"
          value={`$${estimatedMRR.toFixed(2)}`}
        />
        <MetricCard
          label="Credit Pack Revenue"
          value={`$${creditPackRevenue.toFixed(2)}`}
        />
        <MetricCard
          label="Total Est. Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
        />
      </div>
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-2">Subscribers by Tier</h3>
        <SimpleDonutChart data={donutData} />
      </div>
    </section>
  );
}
