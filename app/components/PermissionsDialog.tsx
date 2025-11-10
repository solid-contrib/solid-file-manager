"use client";

import { useState } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${fileName}"`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
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
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-500 focus:border-[#7B42F6] focus:outline-none focus:ring-1 focus:ring-[#7B42F6]"
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
                  className="cursor-pointer flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-[#7B42F6] focus:outline-none focus:ring-1 focus:ring-[#7B42F6] sm:flex-initial"
                  aria-label="Permission role"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <Button
                  variant="primary"
                  onClick={handleAddPermission}
                  disabled={!shareInput.trim() || isAdding}
                  isLoading={isAdding}
                >
                  {isAdding ? "Adding..." : "Add"}
                </Button>
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
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F3EDFF] text-sm font-medium text-black">
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
                          className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-black focus:border-[#7B42F6] focus:outline-none focus:ring-1 focus:ring-[#7B42F6]"
                          aria-label={`Change permission for ${permission.name}`}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <Button
                          variant="icon"
                          onClick={() => onRemovePermission(permission.id)}
                          aria-label={`Remove ${permission.name}`}
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
    </Modal>
  );
}

