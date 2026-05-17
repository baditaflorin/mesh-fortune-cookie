import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-fortune-cookie",
  description: "Pool of fortunes, fair deterministic draw. Every peer agrees on the same cookie.",
  accentHex: "#ffd778",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
