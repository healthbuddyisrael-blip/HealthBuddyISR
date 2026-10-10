import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";

// SSR layout fixtures supply navigation context only. Authentication, database
// access, and server actions are never stubbed.
const router: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "calendar-layout-fixture",
};
export function renderWithRouter(element: ReactNode) {
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router }, element),
  );
}
