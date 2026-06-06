import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { I18nProvider, TooltipProvider } from "@medusajs/ui"
import App, { ReviewCenterWorkbench } from "@mercurjs/admin"
import "@mercurjs/admin/index.css"

const AdminPreview = () => (
  <TooltipProvider>
    <I18nProvider>
      <BrowserRouter basename="/dashboard">
        <ReviewCenterWorkbench />
      </BrowserRouter>
    </I18nProvider>
  </TooltipProvider>
)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname.endsWith("/preview-home") ? <AdminPreview /> : <App />}
  </StrictMode>,
)
