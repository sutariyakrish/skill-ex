import { setState, state } from "./state.js";
import { getRoutePath } from "../utils/helpers.js";

const ROUTES = new Set(["dashboard", "marketplace", "create-listing", "trades", "messages", "profile"]);

export function getRouteFromLocation() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.has(hash) ? hash : "dashboard";
}

export function initRouter() {
  window.addEventListener("hashchange", () => {
    setState({ route: getRouteFromLocation() }, { scope: "full" });
  });

  let route = getRouteFromLocation();
  
  if (!window.location.hash) {
    window.location.hash = getRoutePath(route);
  }

  setState({ route }, { scope: "full" });
}

export function navigate(route, { replace = false } = {}) {
  const safeRoute = ROUTES.has(route) ? route : "dashboard";
  const path = getRoutePath(safeRoute);

  if (window.location.hash !== path) {
    if (replace) {
      window.location.replace(window.location.pathname + window.location.search + path);
    } else {
      window.location.hash = path;
    }
  }

  if (state.route !== safeRoute) {
    setState({ route: safeRoute }, { scope: "full" });
  }
}
