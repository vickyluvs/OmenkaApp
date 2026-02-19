import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AppShell from "./AppShell";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
