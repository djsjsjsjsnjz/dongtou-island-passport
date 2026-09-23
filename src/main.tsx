import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
const App =
  new URLSearchParams(location.search).get("demo") === "legacy"
    ? lazy(() => import("./App"))
    : lazy(() => import("./game/MapReview"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<p>正在加载地图…</p>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
