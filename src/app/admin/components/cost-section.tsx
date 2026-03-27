import {
  getApiCostsByType,
  getApiCostsByModel,
  getRetryCost,
  getDailyCosts,
  getTotalCreditsConsumed,
} from "../lib/queries";
import { MetricCard } from "./metric-card";
import { SimpleBarChart, SimpleStackedBarChart } from "./charts";

interface CostSectionProps {
  startDate: Date;
  endDate: Date;
}

export async function CostSection({ startDate, endDate }: CostSectionProps) {
  const [costsByType, costsByModel, retryCost, dailyCosts, totalCredits] =
    await Promise.all([
      getApiCostsByType(startDate, endDate),
      getApiCostsByModel(startDate, endDate),
      getRetryCost(startDate, endDate),
      getDailyCosts(startDate, endDate),
      getTotalCreditsConsumed(startDate, endDate),
    ]);

  const totalApiCost = costsByType.reduce((sum, c) => sum + c.totalCostUsd, 0);
  const totalApiCalls = costsByType.reduce((sum, c) => sum + c.count, 0);
  const costPerCredit = totalCredits > 0 ? totalApiCost / totalCredits : 0;

  const costByTypeChartData = costsByType.map((c) => ({
    type: c.type,
    costUsd: parseFloat(c.totalCostUsd.toFixed(4)),
    calls: c.count,
  }));

  const modelTokenData = costsByModel.map((m) => ({
    model: m.model,
    totalTokens: m.totalTokens,
    costUsd: parseFloat(m.totalCostUsd.toFixed(4)),
  }));

  const stackedBars = [
    { key: "GENERATION", color: "#3b82f6", label: "Generation" },
    { key: "AI_FILL", color: "#10b981", label: "AI Fill" },
    { key: "AI_EDIT", color: "#f59e0b", label: "AI Edit" },
  ];

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">API Costs</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <MetricCard
          label="Total API Cost"
          value={`$${totalApiCost.toFixed(4)}`}
        />
        <MetricCard
          label="Cost per Credit"
          value={`$${costPerCredit.toFixed(4)}`}
        />
        <MetricCard
          label="Retry Cost"
          value={`$${retryCost.totalCostUsd.toFixed(4)}`}
        />
        <MetricCard
          label="Total API Calls"
          value={totalApiCalls.toString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-2">Cost Breakdown by Type</h3>
          <SimpleBarChart
            data={costByTypeChartData}
            bars={[{ key: "costUsd", color: "#3b82f6", label: "Cost (USD)" }]}
            xKey="type"
          />
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-2">Daily Costs by Type</h3>
          <SimpleStackedBarChart
            data={dailyCosts}
            bars={stackedBars}
            xKey="date"
          />
        </div>

        <div className="rounded-lg border p-4 lg:col-span-2">
          <h3 className="text-sm font-medium mb-2">Token Usage by Model</h3>
          <SimpleBarChart
            data={modelTokenData}
            bars={[{ key: "totalTokens", color: "#8b5cf6", label: "Total Tokens" }]}
            xKey="model"
          />
        </div>
      </div>
    </section>
  );
}
