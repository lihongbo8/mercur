import { ArrowUpRightOnBox } from "@medusajs/icons";
import { Button, Container, Heading, StatusBadge, Text } from "@medusajs/ui";

import { DeveloperAiPanel } from "../../components/dijie/developer-ai-assistant";

type StatusItem = {
  label: string;
  value: string;
  title: string;
};

const statusItems: StatusItem[] = [
  {
    label: "上架状态",
    value: "待同步",
    title: "商品、草稿和审核状态",
  },
  {
    label: "审核",
    value: "0",
    title: "等待平台审核的岗位",
  },
  {
    label: "销售",
    value: "0",
    title: "岗位销售记录",
  },
  {
    label: "结算",
    value: "待同步",
    title: "开发者应收和结算状态",
  },
  {
    label: "能力",
    value: "开放使用",
    title: "岗位运行可按权限调用本地已开放能力资源",
  },
  {
    label: "确认点",
    value: "2",
    title: "发布、改价和结算前需要人工确认",
  },
];

const marketplaceHref = "http://127.0.0.1:3026/us";

export const Home = () => {
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
          <StatusBadge color="grey">待审核 0</StatusBadge>
          <StatusBadge color="orange">确认点 2</StatusBadge>
        </div>
      </div>

      <DeveloperAiPanel />

      <Container className="min-h-0 overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <Heading level="h2">开发状态</Heading>
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
