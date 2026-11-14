import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import studioCss from "../studio/index.css?url";
import { setupServiceWorker } from "../lib/pwa";

const StudioApp = lazy(() => import("../studio/App"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Artist Studio — capture, inventory & AI drafting" },
      { name: "description", content: "Mobile-first studio companion for artists: capture work, edit photos, track inventory and consignments, and draft copy with AI." },
      { property: "og:title", content: "Artist Studio — capture, inventory & AI drafting" },
      { property: "og:description", content: "Capture work, edit photos, track consignments, and draft titles, captions and concept images with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: studioCss }],
  }),
  component: Index,
});

const Loading = () => <div className="page"><p>Loading your studio…</p></div>;

function Index() {
  useEffect(() => {
    void setupServiceWorker().catch(() => undefined);
  }, []);
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <StudioApp />
      </Suspense>
    </ClientOnly>
  );
}
