/// <reference types="vite/client" />

import type { IPCResponse } from '@migrateiq/shared';

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    electronAPI: {
      invoke<T>(channel: string, data?: unknown): Promise<IPCResponse<T>>;
      on(channel: string, callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void): () => void;
    };
  }
}

export {};
