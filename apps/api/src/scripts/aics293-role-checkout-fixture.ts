import type { ExecArgs } from "@medusajs/framework/types";
import { Client } from "pg";

type RoleListingRow = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  usage_instructions: string | null;
  package_id: string;
  package_version: string;
  developer_ref: string;
  listing_owner_ref: string;
  billing_beneficiary_ref: string;
  capabilities: unknown;
  manifest_summary: unknown;
  pricing: {
    authorizationFeeCents?: number;
    currency?: string;
  };
  role_token_pricing: unknown;
  scopes: unknown;
};

type CheckoutFixtureContext = {
  defaultSellerId?: string;
  sellerIds: Set<string>;
  stockLocationId?: string;
  fulfillmentSetId?: string;
  serviceZoneId?: string;
  shippingProfileId?: string;
  shippingOptionIds: string[];
};

function rawAmount(value: number) {
  return { value: String(value), precision: 20 };
}

function roleCheckoutIds(roleListingId: string) {
  return {
    productId: `prod_checkout_${roleListingId}`,
    variantId: `variant_checkout_${roleListingId}`,
    priceSetId: `pset_checkout_${roleListingId}`,
    priceSetLinkId: `pvps_checkout_${roleListingId}`,
  };
}

function roleProductMetadata(role: RoleListingRow) {
  return {
    dijieRole: {
      kind: "role_product",
      protocolVersion: "2026-05",
      roleListingId: role.id,
      packageId: role.package_id,
      packageVersion: role.package_version,
      developerRef: role.developer_ref,
      listingOwnerRef: role.listing_owner_ref,
      billingBeneficiaryRef: role.billing_beneficiary_ref,
      listingStatus: "published",
      reviewState: "approved",
      title: role.title,
      subtitle: role.subtitle ?? undefined,
      description: role.description ?? undefined,
      usageInstructions: role.usage_instructions ?? undefined,
      capabilities: role.capabilities,
      manifestSummary: role.manifest_summary,
      pricing: role.pricing,
      roleTokenPricing: role.role_token_pricing,
      scopes: role.scopes,
    },
  };
}

function resolveSellerId(role: RoleListingRow, context: CheckoutFixtureContext) {
  const candidates = [role.listing_owner_ref, role.developer_ref, role.billing_beneficiary_ref];

  for (const candidate of candidates) {
    if (candidate?.startsWith("sel_") && context.sellerIds.has(candidate)) {
      return candidate;
    }
  }

  return context.defaultSellerId;
}

async function ensureSellerFulfillmentLinks(params: {
  client: Client;
  sellerId?: string;
  context: CheckoutFixtureContext;
}) {
  const { client, sellerId, context } = params;
  if (!sellerId) {
    return;
  }

  if (context.stockLocationId) {
    await client.query(
      `insert into stock_location_stock_location_seller_seller
         (id, stock_location_id, seller_id)
       values ($1, $2, $3)
       on conflict (stock_location_id, seller_id) do update set updated_at = now(), deleted_at = null`,
      [`slocseller_checkout_${sellerId}`, context.stockLocationId, sellerId],
    );
  }

  if (context.fulfillmentSetId) {
    await client.query(
      `insert into seller_seller_fulfillment_fulfillment_set
         (id, seller_id, fulfillment_set_id)
       values ($1, $2, $3)
       on conflict (seller_id, fulfillment_set_id) do update set updated_at = now(), deleted_at = null`,
      [`selfuset_checkout_${sellerId}`, sellerId, context.fulfillmentSetId],
    );
  }

  if (context.serviceZoneId) {
    await client.query(
      `insert into seller_seller_fulfillment_service_zone
         (id, seller_id, service_zone_id)
       values ($1, $2, $3)
       on conflict (seller_id, service_zone_id) do update set updated_at = now(), deleted_at = null`,
      [`selszone_checkout_${sellerId}`, sellerId, context.serviceZoneId],
    );
  }

  if (context.shippingProfileId) {
    await client.query(
      `insert into fulfillment_shipping_profile_seller_seller
         (id, shipping_profile_id, seller_id)
       values ($1, $2, $3)
       on conflict (shipping_profile_id, seller_id) do update set updated_at = now(), deleted_at = null`,
      [`shipprofseller_checkout_${sellerId}`, context.shippingProfileId, sellerId],
    );
  }

  for (const shippingOptionId of context.shippingOptionIds) {
    await client.query(
      `insert into fulfillment_shipping_option_seller_seller
         (id, shipping_option_id, seller_id)
       values ($1, $2, $3)
       on conflict (shipping_option_id, seller_id) do update set updated_at = now(), deleted_at = null`,
      [`shipoptseller_checkout_${shippingOptionId}_${sellerId}`, shippingOptionId, sellerId],
    );
  }
}

async function ensureCheckoutProduct(params: {
  client: Client;
  role: RoleListingRow;
  salesChannelId?: string;
  context: CheckoutFixtureContext;
  currencies: string[];
}) {
  const { client, role, salesChannelId, context, currencies } = params;
  const ids = roleCheckoutIds(role.id);
  const sellerId = resolveSellerId(role, context);
  const feeMajor = Number(role.pricing.authorizationFeeCents ?? 0) / 100;
  if (!Number.isFinite(feeMajor) || feeMajor <= 0) {
    return;
  }

  await client.query(
    `insert into product (id, title, handle, subtitle, description, status, discountable, metadata)
     values ($1, $2, $3, $4, $5, 'published', false, $6::jsonb)
     on conflict (id) do update set
       title = excluded.title,
       subtitle = excluded.subtitle,
       description = excluded.description,
       status = 'published',
       metadata = excluded.metadata,
       updated_at = now()`,
    [
      ids.productId,
      role.title,
      `checkout-${role.id}`.toLowerCase(),
      role.subtitle,
      role.description,
      JSON.stringify(roleProductMetadata(role)),
    ],
  );

  if (salesChannelId) {
    await client.query(
      `insert into product_sales_channel (id, product_id, sales_channel_id)
       values ($1, $2, $3)
       on conflict (product_id, sales_channel_id) do update set updated_at = now(), deleted_at = null`,
      [`prodsc_checkout_${role.id}`, ids.productId, salesChannelId],
    );
  }

  if (context.shippingProfileId) {
    await client.query(
      `insert into product_shipping_profile (id, product_id, shipping_profile_id)
       values ($1, $2, $3)
       on conflict (product_id, shipping_profile_id) do update set updated_at = now(), deleted_at = null`,
      [`prodship_checkout_${role.id}`, ids.productId, context.shippingProfileId],
    );
  }

  if (sellerId) {
    await client.query(
      `insert into product_product_seller_seller (id, product_id, seller_id)
       values ($1, $2, $3)
       on conflict (product_id, seller_id) do update set updated_at = now(), deleted_at = null`,
      [`prodseller_checkout_${role.id}_${sellerId}`, ids.productId, sellerId],
    );
    await ensureSellerFulfillmentLinks({ client, sellerId, context });
  }

  await client.query(
    `insert into product_variant
       (id, title, allow_backorder, manage_inventory, metadata, variant_rank, product_id)
     values ($1, '一次授权', true, false, $2::jsonb, 0, $3)
     on conflict (id) do update set
       title = excluded.title,
       allow_backorder = true,
       manage_inventory = false,
       metadata = excluded.metadata,
       product_id = excluded.product_id,
       updated_at = now(),
       deleted_at = null`,
    [
      ids.variantId,
      JSON.stringify({
        dijieRoleListingId: role.id,
        dijie_role_listing_id: role.id,
        dijieRoleCheckout: true,
      }),
      ids.productId,
    ],
  );

  await client.query(
    `insert into price_set (id)
     values ($1)
     on conflict (id) do update set updated_at = now(), deleted_at = null`,
    [ids.priceSetId],
  );
  await client.query(
    `insert into product_variant_price_set (id, variant_id, price_set_id)
     values ($1, $2, $3)
     on conflict (variant_id, price_set_id) do update set updated_at = now(), deleted_at = null`,
    [ids.priceSetLinkId, ids.variantId, ids.priceSetId],
  );

  for (const currency of currencies) {
    await client.query(
      `insert into price (id, title, price_set_id, currency_code, amount, raw_amount)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (id) do update set
         title = excluded.title,
         amount = excluded.amount,
         raw_amount = excluded.raw_amount,
         updated_at = now(),
         deleted_at = null`,
      [
        `price_checkout_${role.id}_${currency}`,
        `${role.title} 一次授权`,
        ids.priceSetId,
        currency,
        feeMajor,
        JSON.stringify(rawAmount(feeMajor)),
      ],
    );
  }
}

export default async function ensureAics293RoleCheckoutFixture(_args: ExecArgs) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const salesChannel = await client.query<{ id: string }>(
      "select id from sales_channel where deleted_at is null order by created_at asc limit 1",
    );
    const shippingProfile = await client.query<{ id: string }>(
      "select id from shipping_profile where deleted_at is null order by created_at asc limit 1",
    );
    const sellers = await client.query<{ id: string }>(
      "select id from seller where deleted_at is null order by created_at asc",
    );
    const stockLocation = await client.query<{ id: string }>(
      "select id from stock_location where deleted_at is null order by created_at asc limit 1",
    );
    const fulfillmentSet = await client.query<{ id: string; service_zone_id: string }>(
      `select fs.id, sz.id as service_zone_id
       from fulfillment_set fs
       join service_zone sz on sz.fulfillment_set_id = fs.id and sz.deleted_at is null
       where fs.deleted_at is null
       order by fs.created_at asc
       limit 1`,
    );
    const shippingOptions = await client.query<{ id: string }>(
      "select id from shipping_option where deleted_at is null order by created_at asc",
    );
    const context: CheckoutFixtureContext = {
      defaultSellerId: sellers.rows[0]?.id,
      sellerIds: new Set(sellers.rows.map((seller) => seller.id)),
      stockLocationId: stockLocation.rows[0]?.id,
      fulfillmentSetId: fulfillmentSet.rows[0]?.id,
      serviceZoneId: fulfillmentSet.rows[0]?.service_zone_id,
      shippingProfileId: shippingProfile.rows[0]?.id,
      shippingOptionIds: shippingOptions.rows.map((option) => option.id),
    };
    const regions = await client.query<{ currency_code: string }>(
      "select distinct lower(currency_code) as currency_code from region where deleted_at is null",
    );
    const currencies = Array.from(
      new Set([
        "cny",
        ...regions.rows.map((row) => row.currency_code).filter(Boolean),
      ]),
    );
    const roles = await client.query<RoleListingRow>(
      `select id, title, subtitle, description, usage_instructions, package_id, package_version,
              developer_ref, listing_owner_ref, billing_beneficiary_ref,
              capabilities, manifest_summary, pricing, role_token_pricing, scopes
       from dijie_role_listing
       where listing_status = 'published'
         and review_state = 'approved'
         and coalesce((pricing->>'authorizationFeeCents')::numeric, 0) > 0
         and deleted_at is null
       order by created_at asc`,
    );

    await client.query("begin");
    try {
      for (const role of roles.rows) {
        await ensureCheckoutProduct({
          client,
          role,
          salesChannelId: salesChannel.rows[0]?.id,
          context,
          currencies,
        });
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    console.log(`Ensured checkout fixtures for ${roles.rowCount} AICS role listings.`);
  } finally {
    await client.end();
  }
}
