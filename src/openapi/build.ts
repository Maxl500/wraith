import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { getOhlcRefreshIntervalMs } from "../ohlcConfig";
import {
  addressPathSchema,
  booleanOkResponseSchema,
  candlesParamsSchema,
  candlesQuerySchema,
  candlesResponseSchema,
  errorResponseSchema,
  healthzResponseSchema,
  hostFnQuerySchema,
  hostFnLogsResponseSchema,
  hostFnParamsSchema,
  nftOwnerParamsSchema,
  nftOwnerResponseSchema,
  nftTransfersQuerySchema,
  nftTransfersResponseSchema,
  popularAssetsQuerySchema,
  popularAssetsResponseSchema,
  readyzQuerySchema,
  readyzResponseSchema,
  searchQuerySchema,
  searchResponseSchema,
  statusQuerySchema,
  statusResponseSchema,
  summaryQuerySchema,
  summaryResponseSchema,
  transferListResponseSchema,
  transferQuerySchema,
  txHashParamsSchema,
  txTransfersResponseSchema,
  webhookCreateBodySchema,
  webhookCreatedResponseSchema,
  webhookDeleteParamsSchema,
  webhookDeliveriesParamsSchema,
  webhookDeliveriesQuerySchema,
  webhookDeliveriesResponseSchema,
  webhookSubscriptionsResponseSchema,
  accountBalanceResponseSchema,
  tokensQuerySchema,
  tokensResponseSchema,
  transferExportQuerySchema,
  binaryExportResponseSchema,
  linqWebhookAckResponseSchema,
  offrampAvailabilityResponseSchema,
  offrampRateQuerySchema,
  offrampRateResponseSchema,
  offrampVerifyBankBodySchema,
  offrampVerifiedBankSchema,
  offrampTrustlineQuerySchema,
  offrampTrustlineResponseSchema,
  offrampOrderBodySchema,
  offrampOrderResponseSchema,
  offrampOrderParamsSchema,
  offrampOrderStatusResponseSchema,
  offrampErrorResponseSchema,
  ngnCustomerStatusQuerySchema,
  ngnCustomerStatusResponseSchema,
  feesQuerySchema,
  feesResponseSchema,
} from "./schemas";

const registry = new OpenAPIRegistry();

const commonErrorResponses = {
  400: { description: "Bad Request", content: { "application/json": { schema: errorResponseSchema } } },
  404: { description: "Not Found", content: { "application/json": { schema: errorResponseSchema } } },
  500: { description: "Internal Server Error", content: { "application/json": { schema: errorResponseSchema } } },
};

const transferQueryOnlySchema = transferQuerySchema.omit({ address: true });
const summaryQueryOnlySchema = summaryQuerySchema.omit({ address: true });

const transferListResponses = {
  200: { description: "OK", content: { "application/json": { schema: transferListResponseSchema } } },
  ...commonErrorResponses,
};

registry.registerPath({
  method: "get",
  path: "/healthz",
  summary: "Liveness probe",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: healthzResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/readyz",
  summary: "Readiness probe",
  request: { query: readyzQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: readyzResponseSchema } } },
    503: { description: "Service Unavailable", content: { "application/json": { schema: readyzResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/version",
  summary: "Running commit",
  description:
    "The git commit SHA this build was produced from, injected at build time from " +
    "the CI environment (GIT_COMMIT / RENDER_GIT_COMMIT / VERCEL_GIT_COMMIT_SHA). " +
    "Lets a maintainer tell a deployed instance from a merged-but-undeployed one " +
    "without shelling into the host. `commit` is `unknown` when the build did not " +
    "record one.",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              commit: { type: "string" as const },
              shortCommit: { type: "string" as const },
              builtAt: { type: "string" as const },
            },
            required: ["commit", "shortCommit", "builtAt"],
          },
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/ngn/customers/status",
  summary: "Is this customer reference verified?",
  description:
    "Read-only check against the naira provider. Creating nothing is the point: the " +
    "only previous way to ask was to provision a customer and read `verified` off the " +
    "reply, which needed a full set of personal details to answer a yes/no question " +
    "about a reference the caller already held. Rate-limited, because a reference is " +
    "derived from a wallet address and an unthrottled answer would be an oracle.",
  request: { query: ngnCustomerStatusQuerySchema },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: ngnCustomerStatusResponseSchema } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/metrics",
  summary: "Prometheus metrics",
  description:
    "Indexer and process metrics in Prometheus text exposition format. Served from " +
    "in-process counters only — no database or RPC call — so it keeps answering while " +
    "the subsystems it reports on are down.",
  responses: {
    200: {
      description: "Prometheus text exposition format",
      content: { "text/plain": { schema: { type: "string" as const } } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/status",
  summary: "Indexer status",
  request: { query: statusQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: statusResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/transfers/incoming/{address}",
  summary: "Incoming transfers",
  request: {
    params: addressPathSchema,
    query: transferQueryOnlySchema,
  },
  responses: transferListResponses,
});

registry.registerPath({
  method: "get",
  path: "/transfers/outgoing/{address}",
  summary: "Outgoing transfers",
  request: {
    params: addressPathSchema,
    query: transferQueryOnlySchema,
  },
  responses: transferListResponses,
});

registry.registerPath({
  method: "get",
  path: "/transfers/address/{address}",
  summary: "All transfers for address",
  request: {
    params: addressPathSchema,
    query: transferQueryOnlySchema,
  },
  responses: transferListResponses,
});

registry.registerPath({
  method: "get",
  path: "/transfers/address/{address}/export.csv",
  summary: "Export transfers to CSV",
  request: {
    params: addressPathSchema,
    query: transferQueryOnlySchema.omit({ limit: true, offset: true, cursor: true, $filter: true, $select: true }),
  },
  responses: {
    200: {
      description: "CSV export",
      content: {
        "text/csv": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/transfers/tx/{txHash}",
  summary: "Transfers by transaction",
  request: { params: txHashParamsSchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: txTransfersResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/summary/{address}",
  summary: "Token summary",
  request: {
    params: addressPathSchema,
    query: summaryQueryOnlySchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: summaryResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/accounts/{address}/summary",
  summary: "Token summary",
  request: {
    params: addressPathSchema,
    query: summaryQueryOnlySchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: summaryResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/accounts/{address}/balance",
  summary: "Derived token balances",
  description:
    "Per-token balance for an address, derived by summing indexed transfers — not " +
    "a read from chain. Excludes any history before the indexer's start ledger, so " +
    "an address that held a token before then reads low.",
  request: {
    params: addressPathSchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: accountBalanceResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/accounts/{address}/transfers",
  summary: "Account transfers",
  request: {
    params: addressPathSchema,
    query: transferQueryOnlySchema,
  },
  responses: transferListResponses,
});

registry.registerPath({
  method: "post",
  path: "/webhooks",
  summary: "Create a webhook subscription",
  request: {
    body: {
      content: {
        "application/json": {
          schema: webhookCreateBodySchema,
        },
      },
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: webhookCreatedResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/webhooks",
  summary: "List webhook subscriptions",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: webhookSubscriptionsResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/webhooks/{id}",
  summary: "Delete a webhook subscription",
  request: {
    params: webhookDeleteParamsSchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: booleanOkResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/webhooks/{id}/deliveries",
  summary: "Webhook delivery log",
  request: {
    params: webhookDeliveriesParamsSchema,
    query: webhookDeliveriesQuerySchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: webhookDeliveriesResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/host-fn/{contractId}",
  summary: "Host function logs",
  request: {
    params: hostFnParamsSchema,
    query: hostFnQuerySchema.omit({ contractId: true }),
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: hostFnLogsResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/nfts/transfers",
  summary: "NFT transfers",
  request: {
    query: nftTransfersQuerySchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: nftTransfersResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/nfts/owners/{contract}/{token_id}",
  summary: "NFT owner lookup",
  request: {
    params: nftOwnerParamsSchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: nftOwnerResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/assets/popular",
  summary: "Popular assets",
  request: {
    query: popularAssetsQuerySchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: popularAssetsResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/search",
  summary: "Fuzzy search across accounts, assets, and contracts",
  request: {
    query: searchQuerySchema,
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: searchResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/tokens",
  summary: "Cached token metadata",
  description:
    "All tokens the indexer has encountered and cached, on the selected network. " +
    "Served from the in-memory token cache — a token appears here once the indexer " +
    "has seen a transfer of it and resolved its symbol, name and decimals.",
  request: { query: tokensQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: tokensResponseSchema } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/fees",
  summary: "Veil platform fee",
  description:
    "What the wallet should charge on a send, and where to pay it, per asset. The fee " +
    "is collected on-chain in the same transaction as the send; this only tells the " +
    "client the amount, so it can change without shipping an app. Unauthenticated and " +
    "served with `Cache-Control: no-store`, because a stale fee is one the user was " +
    "shown but did not agree to. `enabled: false` means no fee is configured today.",
  request: { query: feesQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: feesResponseSchema } } },
    ...commonErrorResponses,
  },
});
