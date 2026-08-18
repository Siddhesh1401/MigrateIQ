import { contextBridge, ipcRenderer } from 'electron';
import type { IPCResponse } from '@migrateiq/shared';

export const electronAPI = {
  invoke: async <T>(channel: string, data?: unknown): Promise<IPCResponse<T>> => {
    return ipcRenderer.invoke(channel, data);
  },
  on: (channel: string, callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, callback);
    return () => {
      ipcRenderer.removeListener(channel, callback);
    };
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
