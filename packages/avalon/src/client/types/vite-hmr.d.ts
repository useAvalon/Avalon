/**
 * Type definitions for Vite HMR API
 */

declare module 'vite/types/hmrPayload' {
  export interface HMRPayload {
    type: 'update' | 'full-reload' | 'prune' | 'error' | 'connected' | 'custom';
    updates?: Update[];
    timestamp?: number;
    path?: string;
    err?: Error;
    data?: any;
    event?: string;
  }

  export interface Update {
    type: 'js-update' | 'css-update';
    path: string;
    acceptedPath: string;
    timestamp: number;
    explicitImportRequired?: boolean;
  }
}

declare global {
  interface ImportMeta {
    hot?: {
      accept(): void;
      accept(cb: (mod: any) => void): void;
      accept(dep: string, cb: (mod: any) => void): void;
      accept(deps: readonly string[], cb: (mods: any[]) => void): void;
      
      dispose(cb: (data: any) => void): void;
      decline(): void;
      invalidate(): void;
      
      on(event: string, cb: (payload: any) => void): void;
      off(event: string, cb: (payload: any) => void): void;
      send(event: string, data?: any): void;
      
      data: any;
    };
  }
}

export {};
