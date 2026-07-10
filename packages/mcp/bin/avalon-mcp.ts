#!/usr/bin/env node
/**
 * Entry point for the `avalon-mcp` binary.
 *
 * Starts the Avalon Model Context Protocol server on stdio. Configure your MCP
 * client to launch this command; see the package README for examples.
 */

import { runStdio } from "../src/server.ts";

runStdio();
