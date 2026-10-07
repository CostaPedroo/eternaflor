import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

// Route matching does not run queries or authentication, so no backend config is needed.
vi.mock("@/integrations/external/client", () => ({ supabase: {} }));

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("places settings inside the existing gated admin layout", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/admin/definicoes");

    expect(matches.map((match) => match.routeId)).toEqual([
      rootRouteId,
      "/admin",
      "/admin/definicoes",
    ]);
  });
});
