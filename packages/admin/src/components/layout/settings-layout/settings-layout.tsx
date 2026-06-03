import { useEffect, useMemo, useState } from "react";

import { ArrowUturnLeft, MinusMini } from "@medusajs/icons";
import { Divider, IconButton, Text, clx } from "@medusajs/ui";

import { Collapsible as RadixCollapsible } from "radix-ui";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { type INavItem, NavItem } from "@components/layout/nav-item";
import { Shell } from "@components/layout/shell";
import { UserMenu } from "@components/layout/user-menu";
import components from "virtual:mercur/components";

export const SettingsLayout = () => {
  const Sidebar = components.SettingsSidebar
    ? components.SettingsSidebar
    : SettingsSidebar;

  return (
    <Shell>
      <Sidebar />
    </Shell>
  );
};

const useSettingRoutes = (): INavItem[] => {
  return useMemo(
    () => [
      {
        label: "审核设置",
        to: "/settings/marketplace",
      },
    ],
    [],
  );
};

const useMyAccountRoutes = (): INavItem[] => {
  return useMemo(() => [], []);
};

/**
 * Ensure that the `from` prop is not another settings route, to avoid
 * the user getting stuck in a navigation loop.
 */
const getSafeFromValue = (from: string) => {
  if (from.startsWith("/settings")) {
    return "/products";
  }

  return from;
};

const SettingsSidebar = () => {
  const routes = useSettingRoutes();
  const myAccountRoutes = useMyAccountRoutes();

  const { t } = useTranslation();

  return (
    <aside className="relative flex flex-1 flex-col justify-between overflow-y-auto">
      <div className="sticky top-0 bg-ui-bg-subtle">
        <Header />
        <div className="flex items-center justify-center px-3">
          <Divider variant="dashed" />
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <RadixCollapsibleSection
            label={t("app.nav.settings.general")}
            items={routes}
          />
          <div className="flex items-center justify-center px-3">
            <Divider variant="dashed" />
          </div>
          {myAccountRoutes.length > 0 && (
            <RadixCollapsibleSection
              label={t("app.nav.settings.myAccount")}
              items={myAccountRoutes}
            />
          )}
        </div>
        <div className="sticky bottom-0 bg-ui-bg-subtle">
          <UserSection />
        </div>
      </div>
    </aside>
  );
};

const Header = () => {
  const [from, setFrom] = useState("/products");

  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.from) {
      setFrom(getSafeFromValue(location.state.from));
    }
  }, [location]);

  return (
    <div className="bg-ui-bg-subtle p-3">
      <Link
        to={from}
        replace
        className={clx(
          "flex items-center rounded-md bg-ui-bg-subtle outline-none transition-fg",
          "hover:bg-ui-bg-subtle-hover",
          "focus-visible:shadow-borders-focus",
        )}
      >
        <div className="flex items-center gap-x-2.5 px-2 py-1">
          <div className="flex items-center justify-center">
            <ArrowUturnLeft className="text-ui-fg-subtle" />
          </div>
          <Text leading="compact" weight="plus" size="small">
            {t("app.nav.settings.header")}
          </Text>
        </div>
      </Link>
    </div>
  );
};

const RadixCollapsibleSection = ({
  label,
  items,
}: {
  label: string;
  items: INavItem[];
}) => {
  return (
    <RadixCollapsible.Root defaultOpen className="py-3">
      <div className="px-3">
        <div className="flex h-7 items-center justify-between px-2 text-ui-fg-muted">
          <Text size="small" leading="compact">
            {label}
          </Text>
          <RadixCollapsible.Trigger asChild>
            <IconButton size="2xsmall" variant="transparent" className="static">
              <MinusMini className="text-ui-fg-muted" />
            </IconButton>
          </RadixCollapsible.Trigger>
        </div>
      </div>
      <RadixCollapsible.Content>
        <div className="pt-0.5">
          <nav className="flex flex-col gap-y-0.5">
            {items.map((setting) => (
              <NavItem key={setting.to} type="setting" {...setting} />
            ))}
          </nav>
        </div>
      </RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
};

const UserSection = () => {
  return (
    <div>
      <div className="px-3">
        <Divider variant="dashed" />
      </div>
      <UserMenu />
    </div>
  );
};
