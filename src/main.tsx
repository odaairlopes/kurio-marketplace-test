import "@fontsource/roboto-mono/latin-400.css";
import "@fontsource/roboto-mono/latin-500.css";
import "@fontsource/roboto-mono/latin-700.css";
import "./index.css";
import { markMocksReady } from "@/lib/mocks-ready";

async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS === "true") {
    const { startMocks } = await import("./mocks/browser");
    await startMocks();
  }
  markMocksReady();
}

// A aplicação pinta primeiro (layout, hero, skeletons); o MSW sobe em seguida.
// Requisições e o socket aguardam o portão `mocksReady` (ver lib/mocks-ready.ts).
const app = import("./app").then(({ mountApp }) => mountApp());
const mocks = app.then(enableMocks, enableMocks);

void Promise.all([mocks, app]).then(() => {
  (window as unknown as { __KURIO_READY__: boolean }).__KURIO_READY__ = true;
});
