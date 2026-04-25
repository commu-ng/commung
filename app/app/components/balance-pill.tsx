import { Coins } from "lucide-react";
import { Link } from "react-router";
import { useShopSummary } from "~/hooks/useShopSummary";

export function BalancePill() {
  const { data } = useShopSummary();
  if (!data || !data.has_currency) return null;

  const currency = data.default_currency ?? data.currencies[0];
  if (!currency) return null;

  const balance =
    data.balances.find((b) => b.currencyId === currency.id)?.amount ?? 0;

  return (
    <Link
      to="/shop"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-butter/40 text-butter-ink text-xs font-medium hover:bg-butter/60 transition-colors"
      title={`${balance.toLocaleString("ko-KR")} ${currency.name}`}
    >
      <Coins className="h-3.5 w-3.5" />
      <span className="tabular-nums">{balance.toLocaleString("ko-KR")}</span>
      <span className="text-butter-ink/80">{currency.name}</span>
    </Link>
  );
}
