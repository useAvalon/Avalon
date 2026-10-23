import { registerClientDirective } from "@useavalon/avalon/client";
import { runCountdownDirective } from "./countdown.ts";

registerClientDirective("on:countdown", runCountdownDirective);
