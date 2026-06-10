import { authenticate } from "@medusajs/framework";
import { parseCorsOrigins } from "@medusajs/framework/utils";
import { defineMiddlewares } from "@medusajs/medusa";
import cors from "cors";

import { findDijieRoleMetadataPrivacyIssues } from "../lib/dijie/role-product-metadata";

const asRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
};

const rejectPrivateDijieRoleMetadata = (req: any, res: any, next: any) => {
    const body = asRecord(req.body);
    const metadata = asRecord(body.metadata);
    const role = asRecord(metadata.dijieRole);

    if (!Object.keys(role).length) {
        return next();
    }

    const issues = findDijieRoleMetadataPrivacyIssues(role);
    if (issues.length > 0) {
        return res.status(400).json({
            message: "metadata.dijieRole contains private developer-mode or platform bridge fields.",
            issues,
        });
    }

    return next();
};

const dijieVendorCorsMiddleware = (req: any, res: any, next: any) => {
    const configModule = req.scope.resolve("configModule");
    return cors({
        origin: parseCorsOrigins(configModule.projectConfig.http.vendorCors),
        credentials: true,
    })(req, res, next);
};

export default defineMiddlewares({
    routes: [
        {
            matcher: "/admin/products",
            method: ["POST", "PUT", "PATCH"],
            middlewares: [rejectPrivateDijieRoleMetadata],
        },
        {
            matcher: "/admin/products/:id",
            method: ["POST", "PUT", "PATCH"],
            middlewares: [rejectPrivateDijieRoleMetadata],
        },
        {
            matcher: "/vendor/products",
            method: ["POST", "PUT", "PATCH"],
            middlewares: [rejectPrivateDijieRoleMetadata],
        },
        {
            matcher: "/vendor/products/:id",
            method: ["POST", "PUT", "PATCH"],
            middlewares: [rejectPrivateDijieRoleMetadata],
        },
        {
            matcher: "/admin/dijie/review-center",
            method: ["GET"],
            middlewares: [authenticate("user", ["session", "bearer"])],
        },
        {
            matcher: "/admin/dijie/dialog/messages",
            method: ["POST"],
            middlewares: [authenticate("user", ["session", "bearer"])],
        },
        {
            matcher: "/admin/dijie/reviews/:reviewId/evaluations",
            method: ["POST"],
            middlewares: [authenticate("user", ["session", "bearer"])],
        },
        {
            matcher: "/admin/dijie/reviews/:reviewId/finalize",
            method: ["POST"],
            middlewares: [authenticate("user", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/execution-token",
            method: ["POST"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/authorizations",
            method: ["POST"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/my-roles",
            method: ["GET"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/ledger/entries",
            method: ["GET"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/executions/:executionId",
            method: ["GET"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/executions",
            method: ["POST"],
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        {
            matcher: "/dijie/gateway/roles/read-model",
            method: ["GET"],
            middlewares: [
                authenticate(["customer", "member", "user"], ["session", "bearer"]),
            ],
        },
        {
            matcher: "/dijie/dialog/messages",
            middlewares: [dijieVendorCorsMiddleware],
        },
        {
            matcher: "/dijie/dialog/messages/stream",
            middlewares: [dijieVendorCorsMiddleware],
        },
        {
            matcher: "/dijie/dialog/sessions",
            middlewares: [dijieVendorCorsMiddleware],
        },
        {
            matcher: "/dijie/dialog/sessions/:sessionId",
            middlewares: [dijieVendorCorsMiddleware],
        },
        {
            matcher: "/dijie/dialog/messages",
            method: ["POST"],
            middlewares: [
                authenticate(["customer", "member", "user"], ["session", "bearer"]),
            ],
        },
        {
            matcher: "/dijie/dialog/messages/stream",
            method: ["POST"],
            middlewares: [
                authenticate(["customer", "member", "user"], ["session", "bearer"]),
            ],
        },
        {
            matcher: "/dijie/dialog/sessions",
            method: ["GET"],
            middlewares: [
                authenticate(["customer", "member", "user"], ["session", "bearer"]),
            ],
        },
        {
            matcher: "/dijie/dialog/sessions/:sessionId",
            method: ["GET"],
            middlewares: [
                authenticate(["customer", "member", "user"], ["session", "bearer"]),
            ],
        },
    ],
});
