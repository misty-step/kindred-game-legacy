import {
  forwardToBackend,
  type DurableObjectNamespaceLike,
} from "@parlor/cloudflare";
export { KindredBackend } from "../../cloudflare/backend";

/** Loopback-only integration fixture; never deployed by the application workflow. */
export default {
  fetch(
    request: Request,
    env: { KINDRED_BACKEND: DurableObjectNamespaceLike },
  ) {
    return (
      forwardToBackend(request, env.KINDRED_BACKEND, "/backend") ??
      new Response("Not found", { status: 404 })
    );
  },
};
