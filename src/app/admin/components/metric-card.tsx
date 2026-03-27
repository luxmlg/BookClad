interface MetricCardProps {
  label: string;
  value: string;
  highlight?: "green" | "red";
}

export function MetricCard({ label, value, highlight }: MetricCardProps) {
  const colorClass =
    highlight === "green"
      ? "text-green-600"
      : highlight === "red"
        ? "text-red-600"
        : "";
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
