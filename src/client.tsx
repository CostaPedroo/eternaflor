import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { normalizeNetlifyHead } from "@/lib/normalize-netlify-head";

// TanStack discovers src/client.tsx automatically. Keep its default bootstrap;
// normalize only the known hosting separator before React claims the document.
normalizeNetlifyHead(document);
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
