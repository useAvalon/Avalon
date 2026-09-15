/** @jsxImportSource preact */

import { redirectPage } from "../redirect.tsx";

export const layoutConfig = {
	skipLayouts: ["_layout"],
};

export default redirectPage("/docs/guides/data-loading", "Data loading");
