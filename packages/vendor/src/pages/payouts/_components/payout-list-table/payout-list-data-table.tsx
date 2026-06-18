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

export const PayoutListDataTable = () => {
  const { receivables, isError, error, isLoading } = useDijieReceivables();

  if (isError) {
    throw error;
  }

  if (isLoading) {
    return <div className="p-6"><Text size="small">正在读取 AICS 岗位结算记录...</Text></div>;
  }

  const usageEvents = receivables?.usageEvents ?? [];

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-3 gap-3 border-b p-4">
        <SummaryCard label="执行次数" value={`${receivables?.summary.executionCount ?? 0} 次`} />
        <SummaryCard label="执行应收" value={formatCny(receivables?.summary.roleUsageReceivableCents)} />
        <SummaryCard label="总开发者应收" value={formatCny(receivables?.summary.totalDeveloperReceivableCents)} />
      </div>
      <table className="w-full min-w-[860px] table-auto">
        <thead>
          <tr className="border-b text-left">
            <th className="px-6 py-3 txt-compact-small-plus">岗位</th>
            <th className="px-6 py-3 txt-compact-small-plus">执行包</th>
            <th className="px-6 py-3 txt-compact-small-plus">输入</th>
            <th className="px-6 py-3 txt-compact-small-plus">输出</th>
            <th className="px-6 py-3 txt-compact-small-plus">开发者应收</th>
            <th className="px-6 py-3 txt-compact-small-plus">回读时间</th>
          </tr>
        </thead>
        <tbody>
          {usageEvents.length > 0 ? (
            usageEvents.map((event, index) => (
              <tr key={`${event.roleListingId}-${event.receivedAt ?? index}`} className="border-b">
                <td className="px-6 py-3 txt-compact-small">{event.title}</td>
                <td className="px-6 py-3 txt-compact-small text-ui-fg-subtle">
                  {event.packageId}@{event.packageVersion}
                </td>
                <td className="px-6 py-3 txt-compact-small">{event.inputTokens.toLocaleString("zh-CN")}</td>
                <td className="px-6 py-3 txt-compact-small">{event.outputTokens.toLocaleString("zh-CN")}</td>
                <td className="px-6 py-3 txt-compact-small">{formatCny(event.developerReceivableCents)}</td>
                <td className="px-6 py-3 txt-compact-small text-ui-fg-subtle">{formatDate(event.receivedAt)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center txt-compact-small text-ui-fg-subtle">
                暂无 AICS 岗位执行应收记录。
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
