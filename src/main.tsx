import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
const query = new URLSearchParams(location.search);
const path = location.pathname.replace(/\/+$/, "");
const App =
  query.get("demo") === "legacy"
    ? lazy(() => import("./App"))
    : query.get("scene") === "beach" || path.endsWith("/beach")
      ? lazy(() => import("./beach/BeachReview"))
      : lazy(() => import("./game/MapReview"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<p>正在加载地图…</p>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
