import fs from "node:fs/promises";
import type { ExecArgs } from "@medusajs/framework/types";
import {
  ApiKeyType,
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import { createSellerAccountWorkflow } from "@mercurjs/core/workflows";
import jwt from "jsonwebtoken";
import { Client } from "pg";
import Scrypt from "scrypt-kdf";

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

function rawAmount(value: number) {
  return { value: String(value), precision: 20 };
}

async function createPasswordHash() {
  return (await Scrypt.kdf("somepassword", { logN: 15, r: 8, p: 1 })).toString("base64");
}

function signActorToken(container: ExecArgs["container"], payload: Record<string, unknown>) {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
  const { jwtSecret, jwtOptions } = config.projectConfig.http;
  if (!jwtSecret) {
    throw new Error("jwtSecret is required to sign local smoke actor tokens.");
  }
  return jwt.sign(payload, jwtSecret, { expiresIn: "1d", ...jwtOptions });
}

async function createActors(container: ExecArgs["container"], stamp: number) {
  const authModule = container.resolve(Modules.AUTH);
  const userModule = container.resolve(Modules.USER);
  const customerModule = container.resolve(Modules.CUSTOMER);
  const apiKeyModule = container.resolve(Modules.API_KEY);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const password = await createPasswordHash();

  const adminEmail = `aics293-admin-${stamp}@example.test`;
  const vendorEmail = `aics293-vendor-${stamp}@example.test`;
  const buyerEmail = `aics293-buyer-${stamp}@example.test`;

  const adminUser = await userModule.createUsers({
    first_name: "AICS",
    last_name: "Admin",
    email: adminEmail,
  });
  const adminAuth = await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: "emailpass",
        entity_id: adminEmail,
        provider_metadata: { password },
      },
    ],
    app_metadata: { user_id: adminUser.id },
  });

  const vendorAuth = await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: "emailpass",
        entity_id: vendorEmail,
        provider_metadata: { password },
      },
    ],
  });
  const { result: seller } = await createSellerAccountWorkflow(container).run({
    input: {
      auth_identity_id: vendorAuth.id,
      member_email: vendorEmail,
      seller: {
        name: `AICS-293 Smoke Seller ${stamp}`,
        email: vendorEmail,
        currency_code: "cny",
      },
    },
  });
  const { data: members } = await query.graph({
    entity: "member",
    fields: ["id", "email"],
    filters: { email: vendorEmail },
  });
  const member = members[0] as { id: string };

  const buyerCustomer = await customerModule.createCustomers({
    first_name: "AICS",
    last_name: "Buyer",
    email: buyerEmail,
  });
  const buyerAuth = await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: "emailpass",
        entity_id: buyerEmail,
        provider_metadata: { password },
      },
    ],
    app_metadata: { customer_id: buyerCustomer.id },
  });

  const publishableKey = await apiKeyModule.createApiKeys({
    title: `AICS-293 local smoke publishable key ${stamp}`,
    type: ApiKeyType.PUBLISHABLE,
    created_by: adminUser.id,
  });

  return {
    admin: {
      email: adminEmail,
      userId: adminUser.id,
      token: signActorToken(container, {
        actor_id: adminUser.id,
        actor_type: "user",
        auth_identity_id: adminAuth.id,
      }),
    },
    vendor: {
      email: vendorEmail,
      sellerId: (seller as { id: string }).id,
      memberId: member.id,
      token: signActorToken(container, {
        actor_id: member.id,
        actor_type: "member",
        auth_identity_id: vendorAuth.id,
      }),
    },
    buyer: {
      email: buyerEmail,
      customerId: buyerCustomer.id,
      token: signActorToken(container, {
        actor_id: buyerCustomer.id,
        actor_type: "customer",
        auth_identity_id: buyerAuth.id,
      }),
    },
    publishableKey: {
      id: publishableKey.id,
      token: publishableKey.token,
    },
  };
}

async function grantAdminReviewRole(params: { userId: string; stamp: number }) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    await client.query(
      `insert into user_rbac_role (id, user_id, rbac_role_id, created_at, updated_at)
       values ($1, $2, 'role_super_admin', now(), now())
       on conflict do nothing`,
      [`usrbac_aics293_admin_${params.stamp}`, params.userId],
    );
  } finally {
    await client.end();
  }
}

async function createMarketplaceFacts(params: {
  buyerCustomerId: string;
  sellerId: string;
  stamp: number;
}) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const productId = `prod_aics293_smoke_${params.stamp}`;
  const orderGroupId = `ordgrp_aics293_smoke_${params.stamp}`;
  const orderId = `order_aics293_smoke_${params.stamp}`;
  const lineItemId = `ordli_aics293_smoke_${params.stamp}`;
  const orderItemId = `orditem_aics293_smoke_${params.stamp}`;
  const paymentCollectionId = `paycol_aics293_smoke_${params.stamp}`;

  const roleMetadata = {
    kind: "role_product",
    protocolVersion: "2026-05",
    packageId: "pkg_image_review_role",
    packageVersion: "1.0.0",
    developerRef: params.sellerId,
    listingOwnerRef: params.sellerId,
    billingBeneficiaryRef: params.sellerId,
    listingStatus: "published",
    reviewState: "approved",
    title: "商品图检查岗位",
    subtitle: "检查商品图片清晰度、主体完整性和基础合规风险。",
    description: "用于商城商品上架前的图片质量检查，输出可复核的问题摘要和处理建议。",
    capabilities: ["商品图片质量检查", "基础合规提示", "脱敏审计回读"],
    manifestSummary: {
      entrypoint: "role-package:image-review-role",
      requiredCapabilities: ["image.review", "audit.write"],
      permissions: ["workspace.read"],
      sandbox: "readonly",
      inputs: ["商品图片", "商品标题", "商品类目"],
      outputs: ["问题摘要", "处理建议", "审核结论"],
      secretsRequired: [],
    },
    pricing: {
      kind: "one_time_authorization",
      authorizationFeeCents: 0,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 0,
    },
    roleTokenPricing,
    scopes: ["role.execute", "audit.write"],
  };

  await client.query("begin");
  try {
    await client.query(
      `insert into product (id, title, handle, subtitle, description, status, metadata)
       values ($1, $2, $3, $4, $5, 'published', $6::jsonb)`,
      [
        productId,
        "商品图检查岗位",
        `aics293-smoke-image-review-role-${params.stamp}`,
        "检查商品图片清晰度、主体完整性和基础合规风险。",
        "用于商城商品上架前的图片质量检查，输出可复核的问题摘要和处理建议。",
        JSON.stringify({ dijieRole: roleMetadata }),
      ],
    );
    await client.query(
      `insert into product_product_seller_seller (id, product_id, seller_id)
       values ($1, $2, $3)`,
      [`prod_seller_aics293_${params.stamp}`, productId, params.sellerId],
    );
    await client.query(
      `insert into order_group (id, customer_id, cart_id)
       values ($1, $2, $3)`,
      [orderGroupId, params.buyerCustomerId, `cart_aics293_smoke_${params.stamp}`],
    );
    await client.query(
      `insert into "order" (id, customer_id, status, currency_code, email)
       values ($1, $2, 'completed', 'cny', $3)`,
      [orderId, params.buyerCustomerId, `aics293-buyer-${params.stamp}@example.test`],
    );
    await client.query(
      `insert into order_group_order (id, order_group_id, order_id)
       values ($1, $2, $3)`,
      [`ordgrp_order_aics293_${params.stamp}`, orderGroupId, orderId],
    );
    await client.query(
      `insert into order_line_item
       (id, title, product_id, product_title, product_handle, requires_shipping, unit_price, raw_unit_price, metadata)
       values ($1, $2, $3, $4, $5, false, 0, $6::jsonb, $7::jsonb)`,
      [
        lineItemId,
        "商品图检查岗位",
        productId,
        "商品图检查岗位",
        `aics293-smoke-image-review-role-${params.stamp}`,
        JSON.stringify(rawAmount(0)),
        JSON.stringify({ dijieRoleListingId: productId }),
      ],
    );
    await client.query(
      `insert into order_item
       (id, order_id, version, item_id, quantity, raw_quantity, fulfilled_quantity, shipped_quantity,
        return_requested_quantity, return_received_quantity, return_dismissed_quantity,
        written_off_quantity, delivered_quantity, unit_price, raw_unit_price, metadata)
       values ($1, $2, 1, $3, 1, $4::jsonb, 0, 0, 0, 0, 0, 0, 0, 0, $5::jsonb, $6::jsonb)`,
      [
        orderItemId,
        orderId,
        lineItemId,
        JSON.stringify(rawAmount(1)),
        JSON.stringify(rawAmount(0)),
        JSON.stringify({ dijieRoleListingId: productId }),
      ],
    );
    await client.query("update order_line_item set totals_id = $1 where id = $2", [
      orderItemId,
      lineItemId,
    ]);
    await client.query(
      `insert into payment_collection
       (id, currency_code, amount, raw_amount, captured_amount, raw_captured_amount, completed_at, status)
       values ($1, 'cny', 0, $2::jsonb, 0, $3::jsonb, now(), 'completed')`,
      [paymentCollectionId, JSON.stringify(rawAmount(0)), JSON.stringify(rawAmount(0))],
    );
    await client.query(
      `insert into order_payment_collection (id, order_id, payment_collection_id)
       values ($1, $2, $3)`,
      [`order_paycol_aics293_${params.stamp}`, orderId, paymentCollectionId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  return {
    roleListingId: productId,
    entitlementId: orderGroupId,
    orderId,
  };
}

export default async function createAics293LocalSmokeFixture({ container }: ExecArgs) {
  const stamp = Date.now();
  const actors = await createActors(container, stamp);
  await grantAdminReviewRole({ userId: actors.admin.userId, stamp });
  const facts = await createMarketplaceFacts({
    buyerCustomerId: actors.buyer.customerId,
    sellerId: actors.vendor.sellerId,
    stamp,
  });

  await fs.writeFile(
    "/private/tmp/aics293-local-smoke.json",
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        ...actors,
        ...facts,
        deviceId: "device_aics293_local_smoke",
        workspaceRef: "workspace_aics293_local_smoke",
        localGatewayId: "gateway_aics293_local_smoke",
      },
      null,
      2,
    ),
  );
}
