/** @jsxImportSource preact */

import { redirectPage } from "../redirect.tsx";

export const layoutConfig = {
	skipLayouts: ["_layout"],
};

export default redirectPage("/docs/islands-architecture", "Islands architecture");
