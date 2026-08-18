import type { FileItemData } from "../../FileItem";

/** Menu/dialog actions that target a specific file — defined once. */
export type FileDialogAction =
  | { type: "rename"; file: FileItemData }
  | { type: "preview"; file: FileItemData }
  | { type: "move"; file: FileItemData }
  | { type: "delete"; file: FileItemData }
  | { type: "share"; file: FileItemData };

/** Opens the new-folder dialog (no file target). */
export type NewFolderAction = { type: "newFolder" };

/** UI commands dispatched from file rows, menus or context menus. */
export type FileAction =
  | FileDialogAction
  | { type: "copy"; file: FileItemData }
  | { type: "download"; file: FileItemData }
  | NewFolderAction
  | { type: "triggerFileUpload" }
  | { type: "triggerFolderUpload" };

/** Which modal is open. Only one at a time. */
export type ActiveDialog =
  | FileDialogAction
  | NewFolderAction
  | { type: "shareSuccess"; resourceUrl: string; resourceName: string };

export function isDialog<T extends ActiveDialog["type"]>(
  active: ActiveDialog | null,
  type: T,
): active is Extract<ActiveDialog, { type: T }> {
  return active?.type === type;
}
