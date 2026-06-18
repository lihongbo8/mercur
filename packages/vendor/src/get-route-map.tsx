import { t } from "i18next";
import { Outlet, RouteObject, UIMatch } from "react-router-dom";
import { ProtectedRoute } from "./components/authentication/protected-route";
import { MainLayout } from "./components/layout/main-layout";
import { PublicLayout } from "./components/layout/public-layout";
import { SettingsLayout } from "./components/layout/settings-layout";
import { ErrorBoundary } from "./components/utilities/error-boundary";

/**
 * Merges custom routes into base routes. Custom routes with a matching path
 * override the base route (preserving base children unless the custom route
 * provides its own). Non-matching custom routes are appended.
 */
function mergeRoutes(
  baseRoutes: RouteObject[],
  customRoutes: RouteObject[],
): RouteObject[] {
  const result = baseRoutes.map((route) => ({ ...route }));

  for (const customRoute of customRoutes) {
    const customPath = customRoute.path?.replace(/^\/+/, "");
    const existingIndex = result.findIndex(
      (r) => r.path != null && r.path.replace(/^\/+/, "") === customPath,
    );

    if (existingIndex !== -1) {
      const { children: customChildren, ...customRest } = customRoute;
      result[existingIndex] = {
        ...result[existingIndex],
        ...customRest,
        path: result[existingIndex].path,
        children: customChildren
          ? mergeRoutes(result[existingIndex].children ?? [], customChildren)
          : result[existingIndex].children,
      } as RouteObject;
    } else {
      result.push(customRoute);
    }
  }

  return result;
}

const disabledRoute = async () => {
  const { RouteDisabledPage } = await import("./pages/route-disabled");
  return { Component: RouteDisabledPage };
};

export function getRouteMap({
  settingsRoutes: customSettingsRoutes,
  mainRoutes: customMainRoutes,
  publicRoutes: customPublicRoutes = [],
}: {
  settingsRoutes: RouteObject[];
  mainRoutes: RouteObject[];
  publicRoutes?: RouteObject[];
}) {
  return [
    // PROTECTED - MAIN LAYOUT
    {
      element: <ProtectedRoute />,
      errorElement: <ErrorBoundary />,
      children: [
        {
          element: <MainLayout />,
          children: mergeRoutes(
            [
              {
                path: "/",
                errorElement: <ErrorBoundary />,
                lazy: () => import("./pages/home"),
              },
              {
                path: "/products",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => t("products.domain") },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { ProductListPage } =
                        await import("./pages/products");
                      return {
                        Component: ProductListPage,
                      };
                    },
                    children: [
                      {
                        path: "create",
                        lazy: async () => {
                          const { ProductCreatePage } =
                            await import("./pages/products/create");
                          return {
                            Component: ProductCreatePage,
                          };
                        },
                      },
                      {
                        path: "bulk-edit",
                        lazy: disabledRoute,
                      },
                    ],
                  },
                  {
                    path: ":id",
                    lazy: async () => {
                      const { loader } = await import("./pages/products/[id]");
                      const { Breadcrumb } =
                        await import("./pages/products/[id]/breadcrumb");
                      return {
                        Component: Outlet,
                        loader,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { ProductDetailPage } =
                            await import("./pages/products/[id]");
                          return {
                            Component: ProductDetailPage,
                          };
                        },
                        children: [
                          {
                            path: "edit",
                            lazy: disabledRoute,
                          },
                          {
                            path: "sales-channels",
                            lazy: disabledRoute,
                          },
                          {
                            path: "organization",
                            lazy: disabledRoute,
                          },
                          {
                            path: "media",
                            lazy: disabledRoute,
                          },
                          {
                            path: "attributes",
                            lazy: disabledRoute,
                          },
                          {
                            path: "attributes/add",
                            lazy: disabledRoute,
                          },
                          {
                            path: "informational-attributes/:attribute_id/edit",
                            lazy: disabledRoute,
                          },
                          {
                            path: "metadata",
                            lazy: disabledRoute,
                          },
                          {
                            path: "shipping-profile",
                            lazy: disabledRoute,
                          },
                          {
                            path: "prices",
                            lazy: disabledRoute,
                          },
                          {
                            path: "options/create",
                            lazy: disabledRoute,
                          },
                          {
                            path: "options/:option_id/edit",
                            lazy: disabledRoute,
                          },
                          {
                            path: "variants/create",
                            lazy: disabledRoute,
                          },
                        ],
                      },
                      {
                        path: "stock",
                        lazy: disabledRoute,
                      },
                      {
                        path: "edit-stocks-and-prices",
                        lazy: disabledRoute,
                      },
                    ],
                  },
                ],
              },

              // ORDERS
              {
                path: "/orders",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => t("orders.domain") },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { OrderListPage } = await import("./pages/orders");
                      return { Component: OrderListPage };
                    },
                  },
                  {
                    path: ":id",
                    lazy: async () => {
                      const { loader } = await import("./pages/orders/[id]");
                      const { Breadcrumb } =
                        await import("./pages/orders/[id]/breadcrumb");
                      return {
                        Component: Outlet,
                        loader,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { OrderDetailPage } =
                            await import("./pages/orders/[id]");
                          return { Component: OrderDetailPage };
                        },
                        children: [
                          {
                            path: "fulfillment",
                            lazy: disabledRoute,
                          },
                          {
                            path: "allocate-items",
                            lazy: disabledRoute,
                          },
                          {
                            path: ":f_id/create-shipment",
                            lazy: disabledRoute,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              // PAYOUTS
              {
                path: "/payouts",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "结算记录" },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { PayoutListPage } =
                        await import("./pages/payouts");
                      return { Component: PayoutListPage };
                    },
                  },
                  {
                    path: ":id",
                    lazy: async () => {
                      const { Breadcrumb } =
                        await import("./pages/payouts/[id]/breadcrumb");
                      return {
                        Component: Outlet,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { PayoutDetailPage } =
                            await import("./pages/payouts/[id]");
                          return { Component: PayoutDetailPage };
                        },
                      },
                    ],
                  },
                ],
              },

              // CATEGORIES - disabled
              {
                path: "/categories",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // COLLECTIONS - disabled
              {
                path: "/collections",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // CUSTOMERS - disabled
              {
                path: "/customers",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // INVENTORY - disabled
              {
                path: "/inventory",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // PROMOTIONS - disabled
              {
                path: "/promotions",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // CAMPAIGNS - disabled
              {
                path: "/campaigns",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // PRICE LISTS - disabled
              {
                path: "/price-lists",
                errorElement: <ErrorBoundary />,
                handle: { breadcrumb: () => "暂不开放" },
                lazy: disabledRoute,
              },

              // RESERVATIONS - disabled
              // {
              //   path: "/reservations",
              //   ...
              // },

              // PRODUCT VARIANTS (standalone routes)
              {
                path: "/products/:product_id/variants/:variant_id",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
              },
            ],
            customMainRoutes,
          ),
        },
      ],
    },

    // PROTECTED - SETTINGS LAYOUT
    {
      element: <ProtectedRoute />,
      errorElement: <ErrorBoundary />,
      children: [
        {
          path: "/settings",
          element: <SettingsLayout />,
          children: mergeRoutes(
            [
              {
                index: true,
                errorElement: <ErrorBoundary />,
                lazy: () => import("./pages/settings"),
              },

              // PROFILE
              {
                path: "profile",
                errorElement: <ErrorBoundary />,
                handle: {
                  breadcrumb: () => t("profile.domain"),
                },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { ProfileDetailPage } =
                        await import("./pages/settings/profile");
                      return { Component: ProfileDetailPage };
                    },
                    children: [
                      {
                        path: "edit",
                        lazy: async () => {
                          const { ProfileEdit } =
                            await import("./pages/settings/profile");
                          return { Component: ProfileEdit };
                        },
                      },
                    ],
                  },
                ],
              },

              // STORE
              {
                path: "store",
                errorElement: <ErrorBoundary />,
                handle: {
                  breadcrumb: () => t("app.menus.store.label"),
                },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { StoreDetailPage } =
                        await import("./pages/settings/store");
                      return { Component: StoreDetailPage };
                    },
                    children: [
                      {
                        path: "edit",
                        lazy: () => import("./pages/settings/store/edit"),
                      },
                      {
                        path: "address",
                        lazy: () => import("./pages/settings/store/address"),
                      },
                      {
                        path: "payment-details",
                        lazy: () =>
                          import("./pages/settings/store/payment-details"),
                      },
                      {
                        path: "professional-details",
                        lazy: () =>
                          import("./pages/settings/store/professional-details"),
                      },
                      {
                        path: "store-closure",
                        lazy: () =>
                          import("./pages/settings/store/store-closure"),
                      },
                    ],
                  },
                ],
              },

              // LOCATIONS
              {
                path: "locations",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
                handle: { breadcrumb: () => t("locations.domain") },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { LocationListPage } =
                        await import("./pages/settings/locations");
                      return { Component: LocationListPage };
                    },
                    children: [
                      {
                        path: "create",
                        lazy: () => import("./pages/settings/locations/create"),
                      },
                    ],
                  },
                  {
                    path: "shipping-profiles",
                    element: <Outlet />,
                    handle: {
                      breadcrumb: () => t("shippingProfile.domain"),
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { ShippingProfileListPage } =
                            await import("./pages/settings/shipping-profiles");
                          return { Component: ShippingProfileListPage };
                        },
                        children: [
                          {
                            path: "create",
                            lazy: () =>
                              import("./pages/settings/shipping-profiles/create"),
                          },
                        ],
                      },
                      {
                        path: ":shipping_profile_id",
                        lazy: async () => {
                          const { shippingProfileLoader: loader } =
                            await import("./pages/settings/shipping-profiles/[id]");
                          const {
                            ShippingProfileDetailBreadcrumb: Breadcrumb,
                          } =
                            await import("./pages/settings/shipping-profiles/[id]/breadcrumb");
                          return {
                            Component: Outlet,
                            loader,
                            handle: {
                              breadcrumb: (match: UIMatch<any>) => (
                                <Breadcrumb {...match} />
                              ),
                            },
                          };
                        },
                        children: [
                          {
                            path: "",
                            lazy: async () => {
                              const { ShippingProfileDetailPage } =
                                await import("./pages/settings/shipping-profiles/[id]");
                              return {
                                Component: ShippingProfileDetailPage,
                              };
                            },
                            children: [
                              {
                                path: "metadata/edit",
                                lazy: () =>
                                  import("./pages/settings/shipping-profiles/[id]/metadata"),
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    path: ":location_id",
                    lazy: async () => {
                      const { loader } =
                        await import("./pages/settings/locations/[location_id]");
                      const { LocationDetailBreadcrumb: Breadcrumb } =
                        await import("./pages/settings/locations/[location_id]/breadcrumb");
                      return {
                        Component: Outlet,
                        loader,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { LocationDetailPage } =
                            await import("./pages/settings/locations/[location_id]");
                          return { Component: LocationDetailPage };
                        },
                        children: [
                          {
                            path: "edit",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/edit"),
                          },
                          {
                            path: "sales-channels",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/sales-channels"),
                          },
                          {
                            path: "fulfillment-providers",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-providers"),
                          },
                          {
                            path: "fulfillment-set/:fset_id/service-zones/create",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-set/[fset_id]/service-zones/create"),
                          },
                          {
                            path: "fulfillment-set/:fset_id/service-zone/:zone_id/edit",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-set/[fset_id]/service-zone/[zone_id]/edit"),
                          },
                          {
                            path: "fulfillment-set/:fset_id/service-zone/:zone_id/areas",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-set/[fset_id]/service-zone/[zone_id]/areas"),
                          },
                          {
                            path: "fulfillment-set/:fset_id/service-zone/:zone_id/shipping-option/create",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-set/[fset_id]/service-zone/[zone_id]/shipping-option/create"),
                          },
                          {
                            path: "fulfillment-set/:fset_id/service-zone/:zone_id/shipping-option/:so_id/edit",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-set/[fset_id]/service-zone/[zone_id]/shipping-option/[so_id]/edit"),
                          },
                          {
                            path: "fulfillment-set/:fset_id/service-zone/:zone_id/shipping-option/:so_id/pricing",
                            lazy: () =>
                              import("./pages/settings/locations/[location_id]/fulfillment-set/[fset_id]/service-zone/[zone_id]/shipping-option/[so_id]/pricing"),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              // TAX REGIONS
              {
                path: "tax-regions",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
                handle: { breadcrumb: () => t("taxRegions.domain") },
                children: [
                  {
                    path: "",
                    lazy: () => import("./pages/settings/tax-regions"),
                    children: [
                      {
                        path: "create",
                        lazy: () =>
                          import("./pages/settings/tax-regions/create"),
                      },
                    ],
                  },
                  {
                    path: ":id",
                    lazy: async () => {
                      const { Component, Breadcrumb, loader } =
                        await import("./pages/settings/tax-regions/[id]");
                      return {
                        Component,
                        loader,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "tax-rates/create",
                        lazy: () =>
                          import("./pages/settings/tax-regions/[id]/tax-rates/create"),
                      },
                      {
                        path: "tax-rates/:tax_rate_id/edit",
                        lazy: () =>
                          import("./pages/settings/tax-regions/[id]/tax-rates/[tax_rate_id]/edit"),
                      },
                      {
                        path: "tax-overrides/create",
                        lazy: () =>
                          import("./pages/settings/tax-regions/[id]/tax-overrides/create"),
                      },
                      {
                        path: "tax-overrides/:tax_rate_id/edit",
                        lazy: () =>
                          import("./pages/settings/tax-regions/[id]/tax-overrides/[tax_rate_id]/edit"),
                      },
                      {
                        path: "provinces/create",
                        lazy: () =>
                          import("./pages/settings/tax-regions/[id]/provinces/create"),
                      },
                      {
                        path: "provinces/:province_id",
                        lazy: async () => {
                          const { Component, Breadcrumb, loader } =
                            await import("./pages/settings/tax-regions/[id]/provinces/[province_id]");
                          return {
                            Component,
                            loader,
                            handle: {
                              breadcrumb: (match: UIMatch<any>) => (
                                <Breadcrumb {...match} />
                              ),
                            },
                          };
                        },
                        children: [
                          {
                            path: "tax-rates/create",
                            lazy: () =>
                              import("./pages/settings/tax-regions/[id]/tax-rates/create"),
                          },
                          {
                            path: "tax-rates/:tax_rate_id/edit",
                            lazy: () =>
                              import("./pages/settings/tax-regions/[id]/tax-rates/[tax_rate_id]/edit"),
                          },
                          {
                            path: "tax-overrides/create",
                            lazy: () =>
                              import("./pages/settings/tax-regions/[id]/tax-overrides/create"),
                          },
                          {
                            path: "tax-overrides/:tax_rate_id/edit",
                            lazy: () =>
                              import("./pages/settings/tax-regions/[id]/tax-overrides/[tax_rate_id]/edit"),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              // PRODUCT TAGS
              {
                path: "product-tags",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
                handle: { breadcrumb: () => t("productTags.domain") },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { ProductTagListPage } =
                        await import("./pages/settings/product-tags");
                      return { Component: ProductTagListPage };
                    },
                  },
                  {
                    path: ":id",
                    lazy: async () => {
                      const { loader } =
                        await import("./pages/settings/product-tags/[id]");
                      const { ProductTagDetailBreadcrumb: Breadcrumb } =
                        await import("./pages/settings/product-tags/[id]/breadcrumb");
                      return {
                        Component: Outlet,
                        loader,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { ProductTagDetailPage } =
                            await import("./pages/settings/product-tags/[id]");
                          return { Component: ProductTagDetailPage };
                        },
                        children: [
                          {
                            path: "edit",
                            lazy: () =>
                              import("./pages/settings/product-tags/[id]/edit"),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              // USERS
              {
                path: "users",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
                handle: { breadcrumb: () => t("users.domain") },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { TeamListPage } =
                        await import("./pages/settings/team");
                      return { Component: TeamListPage };
                    },
                    children: [
                      {
                        path: "invite",
                        lazy: async () => {
                          const { TeamInvite } =
                            await import("./pages/settings/team/invite");

                          return { Component: TeamInvite };
                        },
                      },
                    ],
                  },
                ],
              },

              // PRODUCT TYPES
              {
                path: "product-types",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
                handle: { breadcrumb: () => t("productTypes.domain") },
                children: [
                  {
                    path: "",
                    lazy: async () => {
                      const { ProductTypeListPage } =
                        await import("./pages/settings/product-types");
                      return { Component: ProductTypeListPage };
                    },
                    children: [
                      // TODO: Enable when request product type flow is implemented
                      // {
                      //   path: "create",
                      //   lazy: () =>
                      //     import("./pages/settings/product-types/create"),
                      // },
                    ],
                  },
                  {
                    path: ":id",
                    lazy: async () => {
                      const { productTypeLoader: loader } =
                        await import("./pages/settings/product-types/[id]");
                      const { ProductTypeDetailBreadcrumb: Breadcrumb } =
                        await import("./pages/settings/product-types/[id]/breadcrumb");
                      return {
                        Component: Outlet,
                        loader,
                        handle: {
                          breadcrumb: (match: UIMatch<any>) => (
                            <Breadcrumb {...match} />
                          ),
                        },
                      };
                    },
                    children: [
                      {
                        path: "",
                        lazy: async () => {
                          const { ProductTypeDetailPage } =
                            await import("./pages/settings/product-types/[id]");
                          return { Component: ProductTypeDetailPage };
                        },
                        children: [
                          {
                            path: "edit",
                            lazy: () =>
                              import("./pages/settings/product-types/[id]/edit"),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },

              // RETURN REASONS
              {
                path: "return-reasons",
                errorElement: <ErrorBoundary />,
                lazy: disabledRoute,
                handle: { breadcrumb: () => t("returnReasons.domain") },
                children: [
                  {
                    path: "",
                    lazy: () => import("./pages/settings/return-reasons"),
                    children: [
                      {
                        path: "create",
                        lazy: () =>
                          import("./pages/settings/return-reasons/create"),
                      },
                      {
                        path: ":id/edit",
                        lazy: () =>
                          import("./pages/settings/return-reasons/[id]/edit"),
                      },
                    ],
                  },
                ],
              },
            ],
            customSettingsRoutes?.[0]?.children || [],
          ),
        },
      ],
    },

    // PUBLIC LAYOUT
    {
      element: <PublicLayout />,
      children: [
        {
          errorElement: <ErrorBoundary />,
          children: [
            {
              path: "/login",
              lazy: async () => {
                const { LoginPage } = await import("./pages/login");
                return { Component: LoginPage };
              },
            },
            {
              path: "/reset-password",
              lazy: () => import("./pages/reset-password"),
            },
            {
              path: "/register",
              lazy: async () => {
                const { RegisterPage } = await import("./pages/register");
                return { Component: RegisterPage };
              },
            },
            {
              path: "/onboarding",
              lazy: () => import("./pages/onboarding"),
            },
            {
              path: "/invite",
              lazy: () => import("./pages/invite"),
            },
            {
              path: "/store-select",
              lazy: async () => {
                const { StoreSelectPage } =
                  await import("./pages/store-select");
                return { Component: StoreSelectPage };
              },
            },
            ...customPublicRoutes,
            {
              path: "*",
              lazy: () => import("./pages/no-match"),
            },
          ],
        },
      ],
    },
  ];
}
