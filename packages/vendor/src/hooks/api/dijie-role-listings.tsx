import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { fetchQuery } from "../../lib/client";
import { queryClient } from "../../lib/query-client";
import { queryKeysFactory } from "../../lib/query-key-factory";

const DIJIE_ROLE_LISTINGS_QUERY_KEY = "dijie_role_listings" as const;

export const dijieRoleListingsQueryKeys = queryKeysFactory(
  DIJIE_ROLE_LISTINGS_QUERY_KEY,
);

export type DijieRoleListing = {
  id: string;
  roleListingId: string;
  packageId: string;
  packageVersion: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  usageInstructions?: string | null;
  category?: string | null;
  listingStatus: "draft" | "proposed" | "published" | "delisted" | "archived";
  reviewState:
    | "draft"
    | "submitted"
    | "needs_changes"
    | "approved"
    | "rejected";
  capabilities: string[];
  pricing?: {
    authorizationFeeCents?: number;
    currency?: string;
  };
  roleTokenPricing?: {
    inputTokenCentsPerMillion?: number;
    outputTokenCentsPerMillion?: number;
    currency?: string;
  };
  confirmationPoints: number;
  submittedAt?: string | null;
  publishedAt?: string | null;
  packageDownload?: {
    available: boolean;
    url: string;
  };
};

export type DijieRoleListingListResponse = {
  ok: boolean;
  listings: DijieRoleListing[];
};

export type CreateDijieRoleListingPayload = {
  packageId: string;
  packageVersion: string;
  title: string;
  subtitle?: string;
  description?: string;
  usageInstructions: string;
  category?: string;
  pricing?: {
    kind: "one_time_authorization";
    authorizationFeeCents: number;
    currency: "CNY";
    platformFeeBps: 0;
    developerReceivableCents: number;
  };
  roleTokenPricing?: {
    inputTokenCentsPerMillion: number;
    outputTokenCentsPerMillion: number;
    currency: "CNY";
    developerReceivableBps: 10000;
    platformFeeBps: 0;
  };
  confirmationPoints?: number;
};

export type DijieRoleListingMutationResponse = {
  ok: boolean;
  roleListingId: string;
  listing: unknown;
};

export const fetchDijieRoleListingsQuery = async () => {
  return fetchQuery("/vendor/dijie/role-listings", {
    method: "GET",
    sellerScoped: true,
  }) as Promise<DijieRoleListingListResponse>;
};

export const createDijieRoleListingQuery = async (
  payload: CreateDijieRoleListingPayload,
) => {
  return fetchQuery("/vendor/dijie/role-listings", {
    method: "POST",
    body: payload,
    sellerScoped: true,
  }) as Promise<DijieRoleListingMutationResponse>;
};

export const submitDijieRoleListingReviewQuery = async (
  roleListingId: string,
) => {
  return fetchQuery(
    `/vendor/dijie/role-listings/${encodeURIComponent(roleListingId)}/submit-review`,
    {
      method: "POST",
      sellerScoped: true,
    },
  ) as Promise<DijieRoleListingMutationResponse>;
};

export const useDijieRoleListings = (
  options?: UseQueryOptions<DijieRoleListingListResponse>,
) => {
  const { data, ...rest } = useQuery({
    queryFn: fetchDijieRoleListingsQuery,
    queryKey: dijieRoleListingsQueryKeys.lists(),
    ...options,
  });

  return {
    listings: data?.listings ?? [],
    count: data?.listings?.length ?? 0,
    ...rest,
  };
};

export const useCreateDijieRoleListing = (
  options?: UseMutationOptions<
    DijieRoleListingMutationResponse,
    Error,
    CreateDijieRoleListingPayload
  >,
) => {
  return useMutation({
    mutationFn: createDijieRoleListingQuery,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: dijieRoleListingsQueryKeys.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useSubmitDijieRoleListingReview = (
  options?: UseMutationOptions<DijieRoleListingMutationResponse, Error, string>,
) => {
  return useMutation({
    mutationFn: submitDijieRoleListingReviewQuery,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: dijieRoleListingsQueryKeys.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
