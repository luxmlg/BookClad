"use client";

import { useState } from "react";

export default function GrantCreditsPage() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/grant-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: Number(amount), description: description || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, message: data.error ?? "Failed to grant credits" });
        return;
      }

      setResult({
        success: true,
        message: `Granted ${data.amount} credits to ${data.user.name ?? data.user.email}. New balance: ${data.newBalance}`,
      });
      setEmail("");
      setAmount("");
      setDescription("");
    } catch {
      setResult({ success: false, message: "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold mb-6">Grant Credits</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">User Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">Credits</label>
          <input
            id="amount"
            type="number"
            required
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="15"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Description (optional)</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Feedback reward"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Granting..." : "Grant Credits"}
        </button>
      </form>

      {result && (
        <div className={`mt-4 rounded-md p-3 text-sm ${result.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
