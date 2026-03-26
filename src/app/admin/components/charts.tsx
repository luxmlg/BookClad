"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface ChartProps {
  data: Array<Record<string, unknown>>;
  className?: string;
}

interface LineChartProps extends ChartProps {
  lines: { key: string; color: string; label: string }[];
  xKey: string;
}

export function SimpleLineChart({ data, lines, xKey, className }: LineChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-popover)",
              border: "1px solid var(--color-border)",
            }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              name={line.label}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarChartProps extends ChartProps {
  bars: { key: string; color: string; label: string }[];
  xKey: string;
}

export function SimpleBarChart({ data, bars, xKey, className }: BarChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-popover)",
              border: "1px solid var(--color-border)",
            }}
          />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.label} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StackedBarChartProps extends ChartProps {
  bars: { key: string; color: string; label: string }[];
  xKey: string;
}

export function SimpleStackedBarChart({ data, bars, xKey, className }: StackedBarChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-popover)",
              border: "1px solid var(--color-border)",
            }}
          />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.label} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DonutChartProps {
  data: { name: string; value: number }[];
  className?: string;
}

export function SimpleDonutChart({ data, className }: DonutChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            label={({ name, value }: { name?: string; value?: number }) =>
              `${name ?? ""}: ${value ?? ""}`
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
