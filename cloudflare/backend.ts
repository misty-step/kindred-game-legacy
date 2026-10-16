import { createConvexBackend } from "@parlor/cloudflare";
import crons from "../convex/crons";
import schema from "../convex/schema";

export const BACKEND_BASE_PATH = "/backend";

/** Reuse the game's function modules; never duplicate its rules in the adapter. */
export const KindredBackend = createConvexBackend({
  app: {
    schema,
    crons,
    modules: {
      game: () => import("../convex/game"),
      jev: () => import("../convex/jev"),
      maintenance: () => import("../convex/maintenance"),
      productEvents: () => import("../convex/productEvents"),
      rooms: () => import("../convex/rooms"),
    },
    http: async () => (await import("../convex/http")).default,
  },
  basePath: BACKEND_BASE_PATH,
  adminKeyBinding: "KINDRED_BACKEND_ADMIN_KEY",
  redactErrors: () => true,
  deploymentName: "kindred",
});
