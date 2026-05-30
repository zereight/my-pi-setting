/**
 * Entry-point lab (learning step 4)
 *
 * Pi auto-discovers: ~/.pi/agent/extensions/entry-point-lab/index.ts
 * Loader (jiti) imports this file and invokes the default export once at startup/reload.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function entryPointLab(_pi: ExtensionAPI) {
	// Factory body runs once per load. Commands and event hooks go in later steps.
}
