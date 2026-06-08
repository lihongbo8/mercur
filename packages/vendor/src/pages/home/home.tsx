import { ArrowUpRightOnBox } from "@medusajs/icons";
import { Button, Container, Heading, StatusBadge, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";

import { DeveloperAiPanel } from "../../components/dijie/developer-ai-assistant";
import { fetchQuery } from "../../lib/client/client";

type StatusItem = {
  label: string;
  value: string;
  title: string;
};

type DeveloperDashboardResponse = {
  ok: true;
  dashboard: {
    listings: {
      total: number;
      pendingReview: number;
      needsChanges: number;
      published: number;
      confirmationPoints: number;
    };
    receivables: {
      summary: {
        authorizationCount: number;
        totalDeveloperReceivableCents: number;
      };
    } | null;
  };
};

const marketplaceHref = "http://127.0.0.1:3026/us";

function formatCny(cents?: number | null) {
  return `¥${((cents ?? 0) / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const Home = () => {
  const dashboardQuery = useQuery({
    queryKey: ["aics", "developer-dashboard"],
    queryFn: () =>
      fetchQuery("/vendor/dijie/developer-dashboard", {
        method: "GET",
        sellerScoped: true,
      }) as Promise<DeveloperDashboardResponse>,
  });

  const dashboard = dashboardQuery.data?.dashboard;
  const statusItems: StatusItem[] = [
    {
      label: "岗位商品",
      value: String(dashboard?.listings.total ?? 0),
      title: "当前开发者店铺的 AICS 岗位商品",
    },
    {
      label: "审核",
      value: `${dashboard?.listings.pendingReview ?? 0} 待审 / ${
        dashboard?.listings.needsChanges ?? 0
      } 需补充`,
      title: "等待平台审核或需要补充的岗位",
    },
    {
      label: "已上架",
      value: String(dashboard?.listings.published ?? 0),
      title: "已审核通过并发布的岗位",
    },
    {
      label: "销售",
      value: `${dashboard?.receivables?.summary.authorizationCount ?? 0} 次授权`,
      title: "岗位授权销售记录",
    },
    {
      label: "结算",
      value: formatCny(dashboard?.receivables?.summary.totalDeveloperReceivableCents),
      title: "授权费和 role_usage 开发者应收",
    },
    {
      label: "确认点",
      value: String(dashboard?.listings.confirmationPoints ?? 0),
      title: "岗位包声明的人工确认点",
    },
  ];

  return (
    <div
      className="grid h-[calc(100vh-24px)] min-h-[640px] gap-4 overflow-hidden"
      style={{
        gridTemplateColumns: "minmax(0, 1fr) 330px",
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <div className="col-span-2 flex items-center justify-between border-b px-1 pb-4">
        <div className="txt-compact-small text-ui-fg-subtle">
          迭界AI <span className="mx-2">›</span> 开发者中心 <span className="mx-2">›</span>
          <span className="text-ui-fg-interactive">开发对话</span>
        </div>
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" asChild>
            <a href={marketplaceHref} title="打开买家侧岗位商城">
              <ArrowUpRightOnBox />
              查看岗位商城
            </a>
          </Button>
          <StatusBadge color="blue">开发者模式</StatusBadge>
          <StatusBadge color="grey">待审核 {dashboard?.listings.pendingReview ?? 0}</StatusBadge>
          <StatusBadge color="orange">确认点 {dashboard?.listings.confirmationPoints ?? 0}</StatusBadge>
        </div>
      </div>

      <DeveloperAiPanel />

      <Container className="min-h-0 overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <Heading level="h2">开发状态</Heading>
          {dashboardQuery.isError ? (
            <Text size="small" className="mt-1 text-ui-fg-error">
              {dashboardQuery.error.message}
            </Text>
          ) : (
            <Text size="small" className="mt-1 text-ui-fg-subtle">
              来自当前 seller 的 dashboard 读模型。
            </Text>
          )}
        </div>
        <div className="divide-y">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className="flex min-h-[74px] items-center justify-between px-6"
              title={item.title}
            >
              <Text className="txt-compact-medium-plus text-ui-fg-base">{item.label}</Text>
              <Text className="txt-compact-small-plus text-ui-fg-subtle">{item.value}</Text>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
};
