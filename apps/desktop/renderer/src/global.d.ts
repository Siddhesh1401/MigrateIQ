import type { IPCResponse } from '@migrateiq/shared';

declare global {
  interface Window {
    electronAPI: {
      invoke<T>(channel: string, data?: unknown): Promise<IPCResponse<T>>;
      on(channel: string, callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void): () => void;
    };
  }
}

export {};
