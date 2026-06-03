import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRightOnBox } from "@medusajs/icons";
import { Button, Container, Heading, StatusBadge, Text, Textarea } from "@medusajs/ui";

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
    label: "工具",
    value: "待申请",
    title: "岗位可申请和可调用的工具资源",
  },
  {
    label: "确认点",
    value: "2",
    title: "发布、改价和结算前需要人工确认",
  },
];

const actionCards = [
  { label: "上传岗位", value: "生成资料", href: "/products/create", title: "整理岗位资料并进入上传确认" },
  { label: "岗位商品", value: "管理上架", href: "/products", title: "查看草稿、审核和上架状态" },
  { label: "销售记录", value: "看订单", href: "/orders", title: "查看岗位销售记录" },
  { label: "结算记录", value: "核对应收", href: "/payouts", title: "查看开发者应收和结算" },
  { label: "开发者资料", value: "账户资料", href: "/settings/profile", title: "维护开发者资料" },
  { label: "工具资源", value: "申请工具", href: "/tool-resources", title: "申请岗位可调用工具" },
];

const marketplaceHref = "/us";

const DeveloperAiPanel = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("待命");

  const runLowRiskAction = (path: string, message: string) => {
    setReply(message);
    navigate(path);
  };

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    if (text.includes("销售") || text.includes("订单")) {
      runLowRiskAction("/orders", "已进入销售记录。");
    } else if (text.includes("结算") || text.includes("分账")) {
      runLowRiskAction("/payouts", "已进入结算记录。");
    } else if (text.includes("上传") || text.includes("上架") || text.includes("岗位")) {
      runLowRiskAction("/products/create", "已进入上传岗位。发布前会停在确认点。");
    } else if (text.includes("工具")) {
      runLowRiskAction("/tool-resources", "已进入工具资源。");
    } else {
      setReply("已记录。低风险导航可以直接执行；发布、改价、结算确认会等待你确认。");
    }

    setDraft("");
  };

  return (
    <Container className="grid min-h-[560px] grid-rows-[auto_minmax(0,1fr)_auto] p-0">
      <div className="border-b px-6 py-4">
        <Heading level="h2">开发对话</Heading>
        <Text className="mt-2 text-ui-fg-subtle">讲业务逻辑，发布前停在确认点</Text>
      </div>
      <div className="grid content-start gap-y-4 p-6">
        <div className="max-w-[520px] rounded-md border bg-ui-bg-subtle px-4 py-3">
          <Text className="text-ui-fg-base">说一下你要开发的岗位。</Text>
        </div>
        <div className="max-w-[520px] rounded-md border border-ui-border-interactive bg-ui-bg-interactive px-4 py-3">
          <Text className="text-ui-fg-base">我要做一个商品图检查岗位</Text>
        </div>
        <div className="max-w-[560px] rounded-md border bg-ui-bg-subtle px-4 py-3">
          <Text className="text-ui-fg-base">{reply}</Text>
        </div>
      </div>
      <div className="flex gap-x-3 border-t p-4">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入业务逻辑"
          rows={1}
        />
        <Button size="small" type="button" onClick={handleSubmit} disabled={!draft.trim()}>
          发送
        </Button>
      </div>
    </Container>
  );
};

export const Home = () => {
  return (
    <div
      className="grid min-h-[calc(100vh-24px)] gap-4"
      style={{
        gridTemplateColumns: "minmax(0, 1fr) 330px",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
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

      <Container className="p-0">
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

      <Container className="col-span-2 p-0">
        <div className="grid grid-cols-3 gap-3 p-4">
          {actionCards.map((item) => (
            <Link key={item.label} to={item.href} className="rounded-md border p-4 hover:bg-ui-bg-subtle" title={item.title}>
              <Text className="txt-compact-small text-ui-fg-subtle">{item.label}</Text>
              <Text className="mt-2 txt-compact-large-plus text-ui-fg-base">{item.value}</Text>
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
};
