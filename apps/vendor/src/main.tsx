import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, useLocation } from "react-router-dom";
import { Button, Container, Heading, I18nProvider, Text, TooltipProvider } from "@medusajs/ui";
import "@mercurjs/vendor/index.css";
import App from "@mercurjs/vendor";
import { Home as VendorHome } from "@mercurjs/vendor/pages";

const previewItems = [
  { label: "开发者中心", href: "/" },
  {
    label: "岗位商城",
    href: import.meta.env.VITE_AICS_BUYER_STOREFRONT_URL ?? "http://127.0.0.1:3026/us",
    external: true,
  },
  { label: "岗位商品", href: "/products" },
  { label: "上传岗位", href: "/products/create" },
  { label: "销售记录", href: "/orders" },
  { label: "结算记录", href: "/payouts" },
  { label: "开发者资料", href: "/settings/profile" },
  { label: "能力资源", href: "/tool-resources" },
];

const UploadRolePreview = () => (
  <div className="grid gap-4">
    <Container className="p-6">
      <Heading>上传岗位包</Heading>
      <Text size="small" className="mt-2 text-ui-fg-subtle">
        上传 role_package 后先扫描结构、校验 manifest 和 requiredCapabilities，再创建岗位商品。
      </Text>
    </Container>
    <div className="grid grid-cols-3 gap-3">
      {[
        ["结构扫描", "manifest.json / skills / knowledge / templates / validation"],
        ["能力解析", "skill / tool / provider / AICS adapter"],
        ["安全边界", "不接受密钥、工具源码、本地路径和内部元数据"],
      ].map(([title, text]) => (
        <Container key={title} className="min-h-[132px] p-5">
          <Heading level="h2">{title}</Heading>
          <Text size="small" className="mt-3 text-ui-fg-subtle">{text}</Text>
        </Container>
      ))}
    </div>
    <Container className="p-0">
      <div className="border-b px-6 py-5">
        <Heading level="h2">上传前能力预检</Heading>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          当前预览验证开发者路径，真实保存仍由后端岗位包接口处理。
        </Text>
      </div>
      <div className="grid grid-cols-[1fr_1fr_2fr] gap-3 px-6 py-4 txt-compact-small text-ui-fg-subtle">
        <span>能力</span>
        <span>状态</span>
        <span>说明</span>
      </div>
      {[
        ["visual.main_image.inspect", "generated_candidate", "候选 skill，需要验收"],
        ["browser", "available", "OpenClaw browser tool 可复用"],
        ["image.inspect", "candidate_found", "需确认本地 provider 配置"],
        ["aics_product_assets.get_main_images", "adapter_needed", "需要 AICS 业务 adapter"],
      ].map(([name, status, note]) => (
        <div key={name} className="grid min-h-[54px] grid-cols-[1fr_1fr_2fr] items-center gap-3 border-t px-6">
          <Text className="txt-compact-small-plus text-ui-fg-base">{name}</Text>
          <Text className="txt-compact-small text-ui-fg-subtle">{status}</Text>
          <Text className="txt-compact-small text-ui-fg-subtle">{note}</Text>
        </div>
      ))}
    </Container>
    <div className="flex gap-x-2">
      <Button size="small" variant="secondary" asChild>
        <Link to="/tool-resources">查看能力资源</Link>
      </Button>
      <Button size="small" variant="secondary" asChild>
        <Link to="/products">进入岗位商品</Link>
      </Button>
    </div>
  </div>
);

const CapabilityResourcesPreview = () => (
  <div className="flex flex-col gap-y-3">
    <Container className="flex items-center justify-between p-6">
      <div>
        <Heading>能力资源</Heading>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          查看本地已开放能力和常用入口，岗位只声明能力需求，不绑定工具权限。
        </Text>
      </div>
      <Button size="small" asChild>
        <Link to="/products/create">上传岗位</Link>
      </Button>
    </Container>
    <Container className="p-0">
      <div className="border-b px-6 py-5">
        <Heading level="h2">岗位能力获取流程</Heading>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          岗位包只声明 requiredCapabilities，系统负责匹配已有 skill、工具、模型 provider 和业务 adapter。
        </Text>
      </div>
      {[
        ["OpenClaw skill-creator", "skill", "available", "缺失 skill 先生成候选，再验收"],
        ["browser", "tool", "available", "用于页面巡检和竞品分析"],
        ["image.inspect / image.generate", "provider", "candidate_found", "需确认本地模型 provider 配置"],
        ["aics_product_db / aics_product_assets", "data_adapter", "adapter_needed", "商品资料和图片资料需接入 AICS 业务 adapter"],
        ["aics_visual_issue / aics_design_standard", "data_adapter", "adapter_needed", "问题台账和设计标准写入需要人工确认边界"],
        ["unknown capability", "blocked", "missing", "未知能力必须阻断，不能降级通过"],
      ].map(([name, type, status, note]) => (
        <div key={name} className="grid min-h-[64px] grid-cols-[1.4fr_0.8fr_0.8fr_2fr] items-center gap-3 border-t px-6">
          <Text className="txt-compact-small-plus text-ui-fg-base">{name}</Text>
          <Text className="txt-compact-small text-ui-fg-subtle">{type}</Text>
          <Text className="txt-compact-small text-ui-fg-subtle">{status}</Text>
          <Text className="txt-compact-small text-ui-fg-subtle">{note}</Text>
        </div>
      ))}
    </Container>
  </div>
);

const SimplePreviewPage = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <Container className="p-6">
    <Heading>{title}</Heading>
    <Text size="small" className="mt-2 text-ui-fg-subtle">{description}</Text>
  </Container>
);

const PreviewMain = () => {
  const location = useLocation();

  if (location.pathname === "/products/create") {
    return <UploadRolePreview />;
  }
  if (location.pathname === "/tool-resources") {
    return <CapabilityResourcesPreview />;
  }
  if (location.pathname === "/products") {
    return <SimplePreviewPage title="岗位商品" description="查看草稿、审核状态、发布状态和能力边界。" />;
  }
  if (location.pathname === "/orders") {
    return <SimplePreviewPage title="销售记录" description="查看岗位授权订单和销售记录。" />;
  }
  if (location.pathname === "/payouts") {
    return <SimplePreviewPage title="结算记录" description="查看授权费、岗位 token 用量和开发者应收。" />;
  }
  if (location.pathname === "/settings/profile") {
    return <SimplePreviewPage title="开发者资料" description="维护开发者资料，不承载平台方审核权限。" />;
  }

  return <VendorHome />;
};

const VendorPreview = () => (
  <TooltipProvider>
    <I18nProvider>
      <BrowserRouter basename="/seller">
        <div
          className="grid min-h-screen bg-ui-bg-subtle text-ui-fg-base"
          style={{ gridTemplateColumns: "220px minmax(0, 1fr)" }}
        >
          <aside className="border-r bg-ui-bg-subtle p-3">
            <div className="mb-6 flex items-center gap-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ui-bg-base shadow-borders-base">
                迭
              </div>
              <div>
                <div className="txt-compact-medium-plus">迭界AI</div>
                <div className="txt-compact-small text-ui-fg-subtle">开发者中心</div>
              </div>
            </div>
            <nav className="flex flex-col gap-y-1">
              {previewItems.map((item) => (
                item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="rounded-md px-3 py-2 txt-compact-small-plus text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                    title="打开买家侧岗位商城"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="rounded-md px-3 py-2 txt-compact-small-plus text-ui-fg-subtle first:bg-ui-bg-base first:text-ui-fg-base hover:bg-ui-bg-base-hover"
                  >
                    {item.label}
                  </Link>
                )
              ))}
            </nav>
          </aside>
          <main className="p-3">
            <PreviewMain />
          </main>
        </div>
      </BrowserRouter>
    </I18nProvider>
  </TooltipProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname === "/seller/preview-home" ? (
      <VendorPreview />
    ) : (
      <App />
    )}
  </StrictMode>,
);
