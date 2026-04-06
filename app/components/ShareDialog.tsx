"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import UrlCombobox, { ComboboxOption } from "./shared/UrlCombobox";
import { FileItemData } from "./FileItem";
import { fetchUserContacts, Contact, addContactToProfile } from "../lib/helpers/contactUtils";
import { fetchAndParseProfile } from "../lib/helpers/profileUtils";
import { getResourceAccessList, removeAccessFromResource, type AccessResult } from "../lib/helpers/acpUtils";
import { UserIcon, MagnifyingGlassIcon, LockClosedIcon, XMarkIcon, CheckCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import LoadingSpinner from "./shared/LoadingSpinner";

export type AccessLevel = "Editor" | "Viewer";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItemData | null;
  onShare?: (webIds: string[], accessLevel: AccessLevel) => Promise<void>;
}

interface PersonChip {
  webId: string;
  name: string | null;
  email: string | null;
}

export default function ShareDialog({
  isOpen,
  onClose,
  file,
  onShare,
}: ShareDialogProps) {
  const [webIdInput, setWebIdInput] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel>("Editor");
  const [peopleChips, setPeopleChips] = useState<PersonChip[]>([]);
  const [isAddingWebId, setIsAddingWebId] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [isLoadingAccessList, setIsLoadingAccessList] = useState(false);
  const [removingWebId, setRemovingWebId] = useState<string | null>(null);

  // Fetch contacts and access list when dialog opens
  useEffect(() => {
    if (isOpen && file) {
      setIsLoadingContacts(true);
      fetchUserContacts()
        .then((fetchedContacts) => {
          setContacts(fetchedContacts);
          setIsLoadingContacts(false);
        })
        .catch((error) => {
          console.error("Failed to fetch contacts:", error);
          setIsLoadingContacts(false);
        });

      // Load current access list
      setIsLoadingAccessList(true);
      const resourceUrl = file.type === "folder" && !file.url.endsWith("/") ? file.url + "/" : file.url;
      getResourceAccessList(resourceUrl)
        .then((result) => {
          setAccessResult(result);
          setIsLoadingAccessList(false);
        })
        .catch((error) => {
          console.error("Failed to fetch access list:", error);
          setIsLoadingAccessList(false);
        });
    } else {
      // Reset state when dialog closes
      setWebIdInput("");
      setSelectedAccessLevel("Editor");
      setPeopleChips([]);
      setAccessResult(null);
      setRemovingWebId(null);
    }
  }, [isOpen, file]);

  const handleRemoveAccess = async (webIdToRemove: string) => {
    if (!file) return;

    setRemovingWebId(webIdToRemove);
    try {
      const resourceUrl = file.type === "folder" && !file.url.endsWith("/") ? file.url + "/" : file.url;
      await removeAccessFromResource(resourceUrl, webIdToRemove);
      
      // Refresh the access list
      const updatedResult = await getResourceAccessList(resourceUrl);
      setAccessResult(updatedResult);
    } catch (error) {
      console.error("Failed to remove access:", error);
    } finally {
      setRemovingWebId(null);
    }
  };

  // Convert contacts to ComboboxOptions
  const contactOptions: ComboboxOption[] = useMemo(() => {
    return contacts.map((contact) => ({
      label: contact.name || contact.email || contact.webId,
      value: contact.webId,
      secondaryLabel: contact.email && contact.name ? contact.email : undefined,
      icon: (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
          {contact.name ? (
            <span className="text-sm font-medium text-gray-700">
              {contact.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <UserIcon className="h-5 w-5 text-gray-500" />
          )}
        </div>
      ),
    }));
  }, [contacts]);

  const handleWebIdChange = (value: string) => {
    setWebIdInput(value);
  };

  const handleAddWebId = async (webIdToAdd?: string) => {
    const webId = (webIdToAdd || webIdInput.trim());
    if (!webId) {
      return;
    }

    // Check if person is already added
    if (peopleChips.some((p) => p.webId === webId)) {
      setWebIdInput("");
      return;
    }

    // Validate WebID format (basic check)
    if (!webId.startsWith("http")) {
      return;
    }

    setIsAddingWebId(true);

    try {
      // Fetch profile to get name and email 
      const { name, email } = await fetchAndParseProfile(webId);

      setPeopleChips([
        ...peopleChips,
        {
          webId,
          name,
          email,
        },
      ]);
      setWebIdInput("");
    } catch (error) {
      console.error("Failed to fetch profile for WebID:", error);
      // Add with just WebID if profile fetch fails
      setPeopleChips([
        ...peopleChips,
        {
          webId,
          name: null,
          email: null,
        },
      ]);
      setWebIdInput("");
    } finally {
      setIsAddingWebId(false);
    }
  };

  const handleSelectWebId = (option: ComboboxOption) => {
    // Automatically add the selected WebID when clicked from dropdown
    handleAddWebId(option.value);
  };

  const handleRemoveChip = (webId: string) => {
    setPeopleChips(peopleChips.filter((p) => p.webId !== webId));
  };

  const handleDone = async () => {
    if (onShare && peopleChips.length > 0) {
      setIsSharing(true);
      try {
        // Share with all people using the selected access level
        const webIds = peopleChips.map((chip) => chip.webId);
        await onShare(webIds, selectedAccessLevel);
        
        // After successful sharing, add new WebIDs to contacts if they're not already there
        const existingContactWebIds = new Set(contacts.map(c => c.webId));
        const newWebIds = webIds.filter(webId => !existingContactWebIds.has(webId));
        
        for (const webId of newWebIds) {
          try {
            await addContactToProfile(webId);
          } catch (error) {
            console.warn(`Failed to add ${webId} to contacts:`, error);
          }
        }
        
        // Refresh contacts list if we added any new ones
        if (newWebIds.length > 0) {
          try {
            const updatedContacts = await fetchUserContacts();
            setContacts(updatedContacts);
          } catch (error) {
            console.warn("Failed to refresh contacts list:", error);
          }
        }
        
        // Refresh access list after sharing
        if (file) {
          const resourceUrl = file.type === "folder" && !file.url.endsWith("/") ? file.url + "/" : file.url;
          const updatedResult = await getResourceAccessList(resourceUrl);
          setAccessResult(updatedResult);
        }
        
        onClose();
      } catch (error) {
        console.error("Failed to share:", error);
        // Error is handled by the parent component via toast
      } finally {
        setIsSharing(false);
      }
    } else {
      onClose();
    }
  };

  const getDisplayName = (chip: PersonChip) => {
    if (chip.name) return chip.name;
    if (chip.email) return chip.email;
    return chip.webId;
  };

  const getDisplayText = (chip: PersonChip) => {
    if (chip.name && chip.email) {
      return `${chip.name} (${chip.email})`;
    }
    return getDisplayName(chip);
  };

  const getInitial = (chip: PersonChip) => {
    if (chip.name) {
      return chip.name.charAt(0).toUpperCase();
    }
    if (chip.email) {
      return chip.email.charAt(0).toUpperCase();
    }
    return chip.webId.charAt(0).toUpperCase();
  };

  const footer = (
    <div className="flex justify-end">
      <Button onClick={handleDone} variant="primary" disabled={isSharing || peopleChips.length === 0}>
        {isSharing ? "Sharing..." : "Share"}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file ? `Share '${file.name}'` : "Share"}
      footer={footer}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Add people section */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Add a WebID
          </label>
          
          {/* Chips display */}
          {peopleChips.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {peopleChips.map((chip) => (
                <div
                  key={chip.webId}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-medium text-white">
                    {getInitial(chip)}
                  </div>
                  <span className="text-sm text-gray-700">
                    {getDisplayText(chip)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(chip.webId)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                    aria-label="Remove"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <UrlCombobox
            value={webIdInput}
            onChange={handleWebIdChange}
            onSelect={handleSelectWebId}
            onSubmit={handleAddWebId}
            options={contactOptions}
            placeholder="Add a WebID"
            disabled={isAddingWebId}
            leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
            showChevron={false}
            aria-label="Add a WebID"
            inputClassName="h-9"
          />
        </div>

        {/* General access section */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700">General access</h3>
          <div className="flex items-center gap-2">
            <LockClosedIcon className="h-5 w-5 text-gray-500" />
            <select
              value={selectedAccessLevel}
              onChange={(e) => setSelectedAccessLevel(e.target.value as AccessLevel)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#7B42F6] focus:outline-none focus:ring-1 focus:ring-[#7B42F6]"
            >
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        </div>

        {/* People with access section */}
        {accessResult && accessResult.entries.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">People with access</h3>
            <div className="space-y-2">
              {isLoadingAccessList ? (
                <div className="flex items-center justify-center py-2">
                  <LoadingSpinner />
                </div>
              ) : (
                accessResult.entries.map((access, index) => {
                  const hasWrite = access.modes.some((mode) => mode === "Write");
                  const accessLevel = hasWrite ? "Editor" : "Viewer";
                  const displayLabel = access.isPublic ? "Anyone (Public)" : access.isAuthenticated ? "Authenticated users" : access.agent;
                  const isRemoving = removingWebId === access.agent;

                  return (
                    <div
                      key={access.agent || index}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="text-sm text-gray-700 truncate">
                          {displayLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-gray-500">{accessLevel}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccess(access.agent)}
                          disabled={isRemoving}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Remove access for ${displayLabel}`}
                          title="Remove access"
                        >
                          {isRemoving ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {isLoadingContacts && (
          <div className="flex items-center justify-center py-4">
            <LoadingSpinner />
          </div>
        )}
      </div>
    </Modal>
  );
}

