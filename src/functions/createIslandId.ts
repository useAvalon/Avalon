import type { IslandId } from '../schemas/core.ts';

export const createIslandId = (): IslandId => `island-${crypto.randomUUID()}`;
