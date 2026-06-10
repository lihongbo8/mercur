import { useQuery } from "@tanstack/react-query";

import { fetchQuery } from "../../lib/client";

export type DijieVendorReceivables = {
  summary: {
    currency: "CNY";
    authorizationReceivableCents: number;
    roleUsageReceivableCents: number;
    totalDeveloperReceivableCents: number;
    platformReceivableCents: 0;
    authorizationCount: number;
    executionCount: number;
    inputTokens: number;
    outputTokens: number;
  };
  authorizationEvents: Array<{
    roleListingId: string;
    title: string;
    source: "entitlement" | "checkout";
    authorizationFeeCents: number;
    developerReceivableCents: number;
    currency: "CNY";
    authorizedAt: string | null;
  }>;
  usageEvents: Array<{
    roleListingId: string;
    title: string;
    packageId: string;
    packageVersion: string;
    inputTokens: number;
    outputTokens: number;
    developerReceivableCents: number;
    currency: "CNY";
    receivedAt: string | null;
  }>;
};

type DijieReceivablesResponse = {
  ok: boolean;
  receivables: DijieVendorReceivables;
};

export const fetchDijieReceivablesQuery = async () => {
  return fetchQuery("/vendor/dijie/receivables", {
    method: "GET",
    sellerScoped: true,
  }) as Promise<DijieReceivablesResponse>;
};

export const useDijieReceivables = () => {
  const { data, ...rest } = useQuery({
    queryFn: fetchDijieReceivablesQuery,
    queryKey: ["aics", "vendor", "receivables"],
  });

  return {
    receivables: data?.receivables,
    ...rest,
  };
};
