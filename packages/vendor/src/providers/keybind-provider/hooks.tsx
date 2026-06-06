import { default as debounceFn } from "lodash.debounce";
import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useLogout } from "../../hooks/api/auth";
import { queryClient } from "../../lib/query-client";
import { KeybindContext } from "./keybind-context";
import { Shortcut } from "./types";
import { findShortcut } from "./utils";

export const useKeybind = () => {
  const context = useContext(KeybindContext);

  if (!context) {
    throw new Error("useKeybind must be used within a KeybindProvider");
  }

  return context;
};

export const useRegisterShortcut = () => {};

export const useShortcuts = ({
  shortcuts = [],
  debounce,
}: {
  shortcuts?: Shortcut[];
  debounce: number;
}) => {
  const [keys, setKeys] = useState<string[]>([]);
  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const removeKeys = useCallback(
    debounceFn(() => setKeys([]), debounce),
    [],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invokeShortcut = useCallback(
    debounceFn((shortcut: Shortcut | null) => {
      if (shortcut && shortcut.callback) {
        shortcut.callback();
        setKeys([]);

        return;
      }

      if (shortcut && shortcut.to) {
        navigate(shortcut.to);
        setKeys([]);

        return;
      }
    }, debounce / 2),
    [],
  );

  useEffect(() => {
    if (keys.length > 0 && shortcuts.length > 0) {
      const shortcut = findShortcut(shortcuts, keys);
      invokeShortcut(shortcut);
    }

    return () => invokeShortcut.cancel();
  }, [keys, shortcuts, invokeShortcut]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      /**
       * Ignore key events from input, textarea and contenteditable elements
       */
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        removeKeys();
        return;
      }

      setKeys((oldKeys) => [...oldKeys, event.key]);
      removeKeys();
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [removeKeys]);
};

export const useGlobalShortcuts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { mutateAsync } = useLogout();

  const handleLogout = async () => {
    await mutateAsync(undefined, {
      onSuccess: () => {
        queryClient.clear();
        navigate("/login");
      },
    });
  };

  const globalShortcuts: Shortcut[] = [
    // Pages
    {
      keys: {
        Mac: ["G", "P"],
      },
      label: "岗位商品",
      type: "pageShortcut",
      to: "/products",
    },
    {
      keys: {
        Mac: ["G", "U"],
      },
      label: "上传岗位",
      type: "pageShortcut",
      to: "/products/create",
    },
    {
      keys: {
        Mac: ["G", "O"],
      },
      label: "销售记录",
      type: "pageShortcut",
      to: "/orders",
    },
    {
      keys: {
        Mac: ["G", "B"],
      },
      label: "结算记录",
      type: "pageShortcut",
      to: "/payouts",
    },
    {
      keys: {
        Mac: ["G", ","],
      },
      label: "开发者资料",
      type: "pageShortcut",
      to: "/settings/profile",
    },
    {
      keys: {
        Mac: ["G", "T"],
      },
      label: "能力资源",
      type: "pageShortcut",
      to: "/tool-resources",
    },
    // Commands
    {
      keys: {
        Mac: ["B", "Y", "E"],
      },
      label: t("actions.logout"),
      type: "commandShortcut",
      callback: () => handleLogout(),
    },
  ];

  return globalShortcuts;
};
