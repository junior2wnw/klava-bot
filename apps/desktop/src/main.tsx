import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { AppI18nProvider } from "./i18n/AppI18n";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppI18nProvider>
      <App />
    </AppI18nProvider>
  </React.StrictMode>,
);
