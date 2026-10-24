import { setupWorker } from "msw/browser";
import { accountHandlers } from "./handlers/account";
import { authHandlers } from "./handlers/auth";
import { cartHandlers } from "./handlers/cart";
import { catalogHandlers } from "./handlers/catalog";
import { devHandlers } from "./handlers/dev";
import { orderHandlers, resumePendingOrders } from "./handlers/orders";
import { realtimeHandler } from "./realtime";
import { applyPresetFromUrl } from "./scenario";

export const handlers = [
  ...devHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  realtimeHandler,
];

export async function startMocks() {
  applyPresetFromUrl();
  const worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: { url: "/mockServiceWorker.js" },
    onUnhandledRequest: "bypass",
    quiet: import.meta.env.PROD,
  });
  resumePendingOrders();
  return worker;
}
