"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import UrlCombobox, { ComboboxOption } from "./shared/UrlCombobox";
import { FileItemData } from "./FileItem";
import { fetchUserContacts, Contact } from "../lib/helpers/contactUtils";
import { fetchAndParseProfile } from "../lib/helpers/profileUtils";
import { getResourceAccessList, removeAccessFromResource } from "../lib/helpers/acpUtils";
import { User, Search, Lock, X, CheckCircle, Trash2 } from "lucide-react";
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
  const [accessList, setAccessList] = useState<Array<{ webId: string; accessModes: string[] }> | null>(null);
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
        .then((list) => {
          setAccessList(list);
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
      setAccessList(null);
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
      const updatedList = await getResourceAccessList(resourceUrl);
      setAccessList(updatedList);
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
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          {contact.name ? (
            <span className="text-sm font-medium text-foreground">
              {contact.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User className="h-5 w-5 text-muted-foreground" />
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

        // Refresh access list after sharing
        if (file) {
          const resourceUrl = file.type === "folder" && !file.url.endsWith("/") ? file.url + "/" : file.url;
          const updatedList = await getResourceAccessList(resourceUrl);
          setAccessList(updatedList);
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
    <Button onClick={handleDone} variant="default" disabled={isSharing || peopleChips.length === 0}>
      {isSharing ? "Sharing..." : "Share"}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{file ? `Share '${file.name}'` : "Share"}</DialogTitle>
        </DialogHeader>
      <div className="space-y-6">
        {/* Add people section */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Add a WebID
          </label>

          {/* Chips display */}
          {peopleChips.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {peopleChips.map((chip) => (
                <div
                  key={chip.webId}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {getInitial(chip)}
                  </div>
                  <span className="text-sm text-foreground">
                    {getDisplayText(chip)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(chip.webId)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
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
            leftIcon={<Search className="h-5 w-5" />}
            showChevron={false}
            aria-label="Add a WebID"
            inputClassName="h-9"
          />
        </div>

        {/* General access section */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">General access</h3>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <NativeSelect
              value={selectedAccessLevel}
              onChange={(e) => setSelectedAccessLevel(e.target.value as AccessLevel)}
              aria-label="Access level"
            >
              <NativeSelectOption value="Editor">Editor</NativeSelectOption>
              <NativeSelectOption value="Viewer">Viewer</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>

        {/* People with access section */}
        {accessList && accessList.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">People with access</h3>
            <div className="space-y-2">
              {isLoadingAccessList ? (
                <div className="flex items-center justify-center py-2">
                  <LoadingSpinner />
                </div>
              ) : (
                accessList.map((access, index) => {
                  const hasWrite = access.accessModes.some((mode) => mode.includes("Write"));
                  const accessLevel = hasWrite ? "Editor" : "Viewer";
                  const isRemoving = removingWebId === access.webId;

                  return (
                    <div
                      key={access.webId || index}
                      className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {access.webId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">{accessLevel}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccess(access.webId)}
                          disabled={isRemoving}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Remove access for ${access.webId}`}
                          title="Remove access"
                        >
                          {isRemoving ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
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
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

