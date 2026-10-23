import { useState, type ReactNode } from "react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";

/** Router context for isolated component/SSR tests; full navigation has separate integration coverage. */
export function ModalTestRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() }),
  );
  return <RouterContextProvider router={router}>{children}</RouterContextProvider>;
}
