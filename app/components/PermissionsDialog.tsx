"use client";

import { useState } from "react";

export interface Permission {
  id: string;
  type: "user" | "group";
  webId: string;
  name: string;
  email?: string;
  role: "viewer" | "editor" | "owner";
}

interface PermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  permissions: Permission[];
  onAddPermission: (webId: string, role: "viewer" | "editor") => void;
  onRemovePermission: (permissionId: string) => void;
  onUpdatePermission: (permissionId: string, role: "viewer" | "editor") => void;
}

export default function PermissionsDialog({
  isOpen,
  onClose,
  fileName,
  permissions,
  onAddPermission,
  onRemovePermission,
  onUpdatePermission,
}: PermissionsDialogProps) {
  const [shareInput, setShareInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "editor">("viewer");
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAddPermission = async () => {
    if (!shareInput.trim()) return;
    setIsAdding(true);
    try {
      await onAddPermission(shareInput.trim(), selectedRole);
      setShareInput("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-10 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="permissions-dialog-title"
    >
      <div
        className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl sm:h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <h2 id="permissions-dialog-title" className="text-base font-medium text-black sm:text-lg">
              Share "{fileName}"
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md p-1 text-gray-600 hover:bg-gray-100"
              aria-label="Close dialog"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Add People Section */}
          <div className="mb-6">
            <label htmlFor="share-input" className="mb-2 block text-sm font-medium text-black">
              Add people or groups
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="share-input"
                type="text"
                value={shareInput}
                onChange={(e) => setShareInput(e.target.value)}
                placeholder="Enter WebID or email"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddPermission();
                  }
                }}
              />
              <div className="flex gap-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as "viewer" | "editor")}
                  className="cursor-pointer flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 sm:flex-initial"
                  aria-label="Permission role"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddPermission}
                  disabled={!shareInput.trim() || isAdding}
                  className="cursor-pointer rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {isAdding ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>

          {/* Permissions List */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-black">People with access</h3>
            <div className="space-y-2">
              {permissions.map((permission) => (
                <div
                  key={permission.id}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-black">
                      {permission.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-black">{permission.name}</p>
                      {permission.email && (
                        <p className="truncate text-xs text-gray-600">{permission.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {permission.role === "owner" ? (
                      <span className="text-sm text-gray-600">Owner</span>
                    ) : (
                      <>
                        <select
                          value={permission.role}
                          onChange={(e) =>
                            onUpdatePermission(
                              permission.id,
                              e.target.value as "viewer" | "editor"
                            )
                          }
                          className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-black focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          aria-label={`Change permission for ${permission.name}`}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onRemovePermission(permission.id)}
                          className="cursor-pointer rounded-md p-1 text-gray-600 hover:bg-gray-100"
                          aria-label={`Remove ${permission.name}`}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50 sm:w-auto"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

