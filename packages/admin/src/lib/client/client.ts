import { createClient, InferClient } from "@mercurjs/client";
import { Routes } from "@mercurjs/core/_generated";
import config from "virtual:mercur/config";

const resolveBackendUrl = () => {
  const configured = config.backendUrl;
  const browserOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  if (!configured) {
    return browserOrigin ?? "http://localhost:9000";
  }

  if (!browserOrigin) {
    return configured;
  }

  try {
    const configuredUrl = new URL(configured);
    const originUrl = new URL(browserOrigin);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
    const bothLoopback =
      loopbackHosts.has(configuredUrl.hostname) &&
      loopbackHosts.has(originUrl.hostname);

    if (bothLoopback && configuredUrl.hostname !== originUrl.hostname) {
      configuredUrl.hostname = originUrl.hostname;
      return configuredUrl.origin;
    }

    return configured;
  } catch {
    return configured;
  }
};

export const backendUrl = resolveBackendUrl();

export const sdk: InferClient<Routes> = createClient({
  baseUrl: backendUrl,
  fetchOptions: {
    credentials: "include",
  },
});

export const fetchQuery = async (
  url: string,
  {
    method,
    body,
    query,
    headers,
  }: {
    method: "GET" | "POST" | "DELETE";
    body?: object;
    query?: Record<string, string | number | object>;
    headers?: { [key: string]: string };
  },
) => {
  const params = Object.entries(query || {}).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      if (Array.isArray(value)) {
        const arrayParams = value
          .map(
            (item) =>
              `${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`,
          )
          .join("&");
        if (acc) {
          acc += "&" + arrayParams;
        } else {
          acc = arrayParams;
        }
      } else {
        const separator = acc ? "&" : "";
        const serializedValue =
          typeof value === "object" ? JSON.stringify(value) : value;
        acc += `${separator}${encodeURIComponent(key)}=${encodeURIComponent(serializedValue)}`;
      }
    }
    return acc;
  }, "");

  const response = await fetch(
    `${backendUrl}${url}${params ? `?${params}` : ""}`,
    {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : null,
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 401) {
      const basePath = window.location.pathname.startsWith("/dashboard")
        ? "/dashboard"
        : "";
      window.location.href = `${basePath}/login?reason=Unauthorized`;
      return;
    }

    const error = new Error(
      errorData.error || errorData.message || "Server error",
    );
    (error as Error & { status: number }).status = response.status;
    throw error;
  }

  return response.json();
};

export const uploadFilesQuery = async (files: any[]) => {
  const formData = new FormData();

  for (const { file } of files) {
    formData.append("files", file);
  }

  return sdk.admin.uploads.mutate({
    fetchOptions: { body: formData },
  });
};
