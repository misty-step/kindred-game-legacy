import {
  forwardToBackend,
  type DurableObjectNamespaceLike,
} from "@parlor/cloudflare";
import nextWorker, { type OpenNextContext } from "open-next-worker";
import { BACKEND_BASE_PATH } from "./backend";
import { operatorAllowed } from "./access";
import { resolveRuntimeAttribution } from "../app/runtime-config";

export { KindredBackend } from "./backend";

type Env = Record<string, unknown> & {
  readonly KINDRED_BACKEND: DurableObjectNamespaceLike;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: OpenNextContext,
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith(`${BACKEND_BASE_PATH}/admin/`)) {
      if (
        !(await operatorAllowed(request, env["KINDRED_OPERATOR_ACCESS_CONFIG"]))
      )
        return new Response("Forbidden", { status: 403 });
    }
    if (path === "/api/health") {
      const checkedAt = new Date().toISOString();
      try {
        const attribution = resolveRuntimeAttribution(process.env);
        const healthUrl = new URL(
          `${BACKEND_BASE_PATH}/http/health`,
          request.url,
        );
        const response = await forwardToBackend(
          new Request(healthUrl),
          env.KINDRED_BACKEND,
          BACKEND_BASE_PATH,
        )!;
        const health = (await response.json()) as {
          status?: string;
          service?: string;
        };
        if (
          !response.ok ||
          health.status !== "ok" ||
          health.service !== "kindred-backend"
        )
          throw new Error("Backend unhealthy");
        return Response.json(
          {
            status: "ok",
            service: "kindred",
            ...attribution,
            checkedAt,
            dependencies: { backend: "ok" },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return Response.json(
          { status: "unhealthy", service: "kindred", checkedAt },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    // Preview-only deterministic dependency, physically separated from all
    // production state and credentials. It is never a semantic-judge proof.
    if (
      path === "/__qa/judge" &&
      env["PRODUCT_ENVIRONMENT"] === "test" &&
      env["KINDRED_SYNTHETIC_PREVIEW"] === "true" &&
      request.method === "POST"
    ) {
      const body = (await request.json()) as {
        questions?: Record<string, unknown>;
      };
      if (env["KINDRED_SYNTHETIC_JUDGE_UNAVAILABLE"] === "true")
        return Response.json({ status: "unavailable" }, { status: 503 });
      return Response.json({
        answers: Object.fromEntries(
          Object.keys(body.questions ?? {}).map((name) => [
            name,
            { type: "noul", noul: 0.01 },
          ]),
        ),
      });
    }
    return (
      forwardToBackend(request, env.KINDRED_BACKEND, BACKEND_BASE_PATH) ??
      nextWorker.fetch(request, env, ctx)
    );
  },
};
