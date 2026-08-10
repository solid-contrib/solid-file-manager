import type { FileItemData } from "../../FileItem";

/** UI commands dispatched from file rows, menus or context menus */
export type FileAction =
  | { type: "rename"; file: FileItemData }
  | { type: "preview"; file: FileItemData }
  | { type: "copy"; file: FileItemData }
  | { type: "move"; file: FileItemData }
  | { type: "download"; file: FileItemData }
  | { type: "delete"; file: FileItemData }
  | { type: "share"; file: FileItemData }
  | { type: "openNewFolder" }
  | { type: "triggerFileUpload" }
  | { type: "triggerFolderUpload" };
