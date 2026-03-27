import {
  getApiCostsByType,
  getEstimatedMRR,
  getCreditPackRevenueTotal,
  getDailyCosts,
  getTotalCreditsConsumed,
} from "../lib/queries";
import { MetricCard } from "./metric-card";
import { SimpleLineChart } from "./charts";

interface ProfitabilitySectionProps {
  startDate: Date;
  endDate: Date;
}

export async function ProfitabilitySection({
  startDate,
  endDate,
}: ProfitabilitySectionProps) {
  const [costsByType, estimatedMRR, creditPackRevenue, dailyCosts, totalCredits] =
    await Promise.all([
      getApiCostsByType(startDate, endDate),
      getEstimatedMRR(),
      getCreditPackRevenueTotal(startDate, endDate),
      getDailyCosts(startDate, endDate),
      getTotalCreditsConsumed(startDate, endDate),
    ]);

  const totalApiCost = costsByType.reduce((sum, c) => sum + c.totalCostUsd, 0);
  const totalRevenue = estimatedMRR + creditPackRevenue;
  const grossProfit = totalRevenue - totalApiCost;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const costPerCredit = totalCredits > 0 ? totalApiCost / totalCredits : 0;

  const dailyCostLineData = dailyCosts.map((d) => {
    const entry = d as Record<string, unknown>;
    const gen = typeof entry["GENERATION"] === "number" ? entry["GENERATION"] : 0;
    const aiFill = typeof entry["AI_FILL"] === "number" ? entry["AI_FILL"] : 0;
    const aiEdit = typeof entry["AI_EDIT"] === "number" ? entry["AI_EDIT"] : 0;
    return {
      date: d.date,
      totalCost: parseFloat((gen + aiFill + aiEdit).toFixed(4)),
    };
  });

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Profitability</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-6">
        <MetricCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
        <MetricCard label="API Costs" value={`$${totalApiCost.toFixed(4)}`} />
        <MetricCard
          label="Gross Profit"
          value={`$${grossProfit.toFixed(2)}`}
          highlight={grossProfit >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Margin %"
          value={`${marginPct.toFixed(1)}%`}
          highlight={marginPct >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Cost per Credit"
          value={`$${costPerCredit.toFixed(4)}`}
        />
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-2">Daily API Costs</h3>
        <SimpleLineChart
          data={dailyCostLineData}
          lines={[{ key: "totalCost", color: "#ef4444", label: "Total Cost (USD)" }]}
          xKey="date"
        />
      </div>
    </section>
  );
}
