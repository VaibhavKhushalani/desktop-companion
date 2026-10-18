declare global {
  interface Window {
    electronAPI?: {
      openDirectoryDialog?: () => Promise<string[]>;
      validateRepository?: (folderPath: string) => Promise<boolean>;
      getBranch?: (folderPath: string) => Promise<string>;
      getLatestCommit?: (folderPath: string) => Promise<{
        hash: string;
        author: string;
        date: string;
        message: string;
      } | null>;
      moveCompanionWindow?: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => Promise<void>;
      repositionCompanion?: (position?: string) => Promise<{
        ok: boolean;
        x: number;
        y: number;
        width: number;
        height: number;
        position: string;
      }>;
      restoreCompanion?: (payload?: {
        position?: string;
        message?: {
          title?: string;
          text?: string;
          meta?: string;
          source?: string;
          priority?: number;
        };
      }) => Promise<{
        ok: boolean;
        x: number;
        y: number;
        width: number;
        height: number;
        position: string;
      }>;
      updateCompanionMessage?: (payload: {
        title?: string;
        text?: string;
        meta?: string;
        source?: string;
        priority?: number;
      }) => Promise<{ ok: boolean; message: string }>;
      onCompanionMessage?: (
        callback: (message: {
          title?: string;
          text?: string;
          meta?: string;
          source?: string;
          priority?: number;
        }) => void,
      ) => () => void;
      toggleDashboard?: () => Promise<boolean>;
      showDashboard?: () => Promise<void>;
      toggleCompanion?: () => Promise<boolean>;
      notify?: (message: string) => Promise<void>;
      showCompanion?: (payload?: { position?: string; message?: { title?: string; text?: string; meta?: string; source?: string; priority?: number } }) => Promise<{ ok: boolean; x: number; y: number; width: number; height: number; position: string }>;
    };
  }
}

export {};
