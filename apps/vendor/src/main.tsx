import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link } from "react-router-dom";
import { I18nProvider, TooltipProvider } from "@medusajs/ui";
import "@mercurjs/vendor/index.css";
import App from "@mercurjs/vendor";
import { Home as VendorHome } from "@mercurjs/vendor/pages";

const previewItems = [
  { label: "开发者中心", href: "/" },
  { label: "岗位商城", href: "/us", external: true },
  { label: "岗位商品", href: "/products" },
  { label: "上传岗位", href: "/products/create" },
  { label: "销售记录", href: "/orders" },
  { label: "结算记录", href: "/payouts" },
  { label: "开发者资料", href: "/settings/profile" },
  { label: "工具资源", href: "/tool-resources" },
];

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
            <VendorHome />
          </main>
        </div>
      </BrowserRouter>
    </I18nProvider>
  </TooltipProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname.endsWith("/preview-home") ? (
      <VendorPreview />
    ) : (
      <App />
    )}
  </StrictMode>,
);
