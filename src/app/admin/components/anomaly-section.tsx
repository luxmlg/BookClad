import {
  getMoneyLeaks,
  getUserOvercharged,
  getDuplicateRefunds,
  getCreditBalanceDesyncs,
  getOrphanedProcessing,
  getCancellationRaces,
} from "../lib/queries";

interface AnomalyRowProps {
  label: string;
  count: number;
  items: unknown[];
}

function AnomalyRow({ label, count, items }: AnomalyRowProps) {
  const badgeClass =
    count === 0
      ? "bg-green-100 text-green-800"
      : count <= 3
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
          {count}
        </span>
      </div>
      {count > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Show details
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(items, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export async function AnomalySection() {
  const [
    moneyLeaks,
    overcharged,
    duplicateRefunds,
    balanceDesyncs,
    orphanedProcessing,
    cancellationRaces,
  ] = await Promise.all([
    getMoneyLeaks(),
    getUserOvercharged(),
    getDuplicateRefunds(),
    getCreditBalanceDesyncs(),
    getOrphanedProcessing(),
    getCancellationRaces(),
  ]);

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Anomalies</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnomalyRow
          label="Money Leaks (refunded but API called)"
          count={moneyLeaks.length}
          items={moneyLeaks}
        />
        <AnomalyRow
          label="Users Overcharged (failed, no refund)"
          count={overcharged.length}
          items={overcharged}
        />
        <AnomalyRow
          label="Duplicate Refunds"
          count={duplicateRefunds.length}
          items={duplicateRefunds}
        />
        <AnomalyRow
          label="Credit Balance Desyncs"
          count={balanceDesyncs.length}
          items={balanceDesyncs}
        />
        <AnomalyRow
          label="Orphaned Processing Jobs"
          count={orphanedProcessing.length}
          items={orphanedProcessing}
        />
        <AnomalyRow
          label="Cancellation Races"
          count={cancellationRaces.length}
          items={cancellationRaces}
        />
      </div>
    </section>
  );
}
