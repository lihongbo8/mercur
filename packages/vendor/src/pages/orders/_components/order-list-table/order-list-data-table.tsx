import { Text } from "@medusajs/ui";

import { useDijieReceivables } from "@hooks/api/dijie-receivables";

const formatCny = (cents?: number) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const OrderListDataTable = () => {
  const { receivables, isError, error, isLoading } = useDijieReceivables();

  if (isError) {
    throw error;
  }

  if (isLoading) {
    return <div className="p-6"><Text size="small">正在读取 AICS 岗位销售记录...</Text></div>;
  }

  const events = receivables?.authorizationEvents ?? [];

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-3 gap-3 border-b p-4">
        <SummaryCard label="授权次数" value={`${receivables?.summary.authorizationCount ?? 0} 次`} />
        <SummaryCard label="授权应收" value={formatCny(receivables?.summary.authorizationReceivableCents)} />
        <SummaryCard label="总开发者应收" value={formatCny(receivables?.summary.totalDeveloperReceivableCents)} />
      </div>
      <table className="w-full min-w-[760px] table-auto">
        <thead>
          <tr className="border-b text-left">
            <th className="px-6 py-3 txt-compact-small-plus">岗位</th>
            <th className="px-6 py-3 txt-compact-small-plus">授权来源</th>
            <th className="px-6 py-3 txt-compact-small-plus">授权费</th>
            <th className="px-6 py-3 txt-compact-small-plus">开发者应收</th>
            <th className="px-6 py-3 txt-compact-small-plus">授权时间</th>
          </tr>
        </thead>
        <tbody>
          {events.length > 0 ? (
            events.map((event, index) => (
              <tr key={`${event.roleListingId}-${event.authorizedAt ?? index}`} className="border-b">
                <td className="px-6 py-3 txt-compact-small">{event.title}</td>
                <td className="px-6 py-3 txt-compact-small text-ui-fg-subtle">
                  {event.source === "checkout" ? "结算订单" : "授权记录"}
                </td>
                <td className="px-6 py-3 txt-compact-small">{formatCny(event.authorizationFeeCents)}</td>
                <td className="px-6 py-3 txt-compact-small">{formatCny(event.developerReceivableCents)}</td>
                <td className="px-6 py-3 txt-compact-small text-ui-fg-subtle">{formatDate(event.authorizedAt)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center txt-compact-small text-ui-fg-subtle">
                暂无 AICS 岗位授权销售记录。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border p-3">
    <Text size="small" className="text-ui-fg-subtle">{label}</Text>
    <Text size="base" weight="plus">{value}</Text>
  </div>
);
