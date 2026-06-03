import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider, TooltipProvider } from "@medusajs/ui";
import "@mercurjs/admin/index.css";
import App from "@mercurjs/admin";
import { Home as AdminHome } from "@mercurjs/admin/pages";

const previewItems = [
  "审核中心",
  "待审核岗位商品",
  "审核详情",
  "安全摘要",
  "价格检查",
  "驳回记录",
  "审核记录",
  "审核设置",
];

const AdminPreview = () => (
  <TooltipProvider>
    <I18nProvider>
      <BrowserRouter basename="/dashboard">
        <div className="grid min-h-screen grid-cols-[260px_1fr] bg-ui-bg-subtle text-ui-fg-base">
          <aside className="border-r bg-ui-bg-subtle p-4">
            <div className="mb-6 flex items-center gap-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ui-bg-base shadow-borders-base">
                审
              </div>
              <div>
                <div className="txt-compact-medium-plus">迭界AI</div>
                <div className="txt-compact-small text-ui-fg-subtle">审核中心</div>
              </div>
            </div>
            <nav className="flex flex-col gap-y-1">
              {previewItems.map((item) => (
                <div
                  key={item}
                  className="rounded-md px-3 py-2 txt-compact-small-plus text-ui-fg-subtle first:bg-ui-bg-base first:text-ui-fg-base"
                >
                  {item}
                </div>
              ))}
            </nav>
          </aside>
          <main className="p-4">
            <AdminHome />
          </main>
        </div>
      </BrowserRouter>
    </I18nProvider>
  </TooltipProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname.endsWith("/preview-home") ? (
      <AdminPreview />
    ) : (
      <App />
    )}
  </StrictMode>,
);
