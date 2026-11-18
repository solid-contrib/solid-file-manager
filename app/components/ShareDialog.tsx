"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import UrlCombobox, { ComboboxOption } from "./shared/UrlCombobox";
import { FileItemData } from "./FileItem";
import { fetchUserContacts, Contact } from "../lib/helpers/contactUtils";
import { fetchAndParseProfile } from "../lib/helpers/profileUtils";
import type { AccessEntry } from "../lib/helpers/acpUtils";
import { getAccessList, removeAccess } from "../lib/helpers/sharing";
import { discoverAccessControl, type AccessControlKind } from "../lib/helpers/accessControl";
import { useSolidAuth } from "@ldo/solid-react";
import { useSolidFetch } from "./providers/SolidFetchProvider";
import { User, Search, Lock, X, CheckCircle, Trash2 } from "lucide-react";

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
  const fetchFn = useSolidFetch();
  const { session } = useSolidAuth();
  const [webIdInput, setWebIdInput] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel>("Editor");
  const [peopleChips, setPeopleChips] = useState<PersonChip[]>([]);
  const [isAddingWebId, setIsAddingWebId] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [accessList, setAccessList] = useState<AccessEntry[] | null>(null);
  const [isLoadingAccessList, setIsLoadingAccessList] = useState(false);
  // What the server supports for which resource: sharing works with ACP and WAC.
  const [checked, setChecked] = useState<{ url: string; kind: AccessControlKind | "none" | "error" } | null>(null);
  const [removingWebId, setRemovingWebId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Fetch contacts and access list when dialog opens
  useEffect(() => {
    if (isOpen && file) {
      setIsLoadingContacts(true);
      fetchUserContacts(session.webId, fetchFn)
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
      getAccessList(resourceUrl, fetchFn)
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
      setRemoveError(null);
    }
  }, [isOpen, file, session.webId, fetchFn]);

  const resourceUrlForCheck = file ? (file.type === "folder" && !file.url.endsWith("/") ? file.url + "/" : file.url) : null;

  useEffect(() => {
    if (!isOpen || !resourceUrlForCheck) {
      setChecked(null); // a later reopen must check again, not reuse this result
      return;
    }
    let current = true;
    discoverAccessControl(resourceUrlForCheck, fetchFn)
      .then((info) => current && setChecked({ url: resourceUrlForCheck, kind: info?.kind ?? "none" }))
      .catch(() => current && setChecked({ url: resourceUrlForCheck, kind: "error" }));
    return () => {
      current = false;
    };
  }, [isOpen, resourceUrlForCheck, fetchFn]);

  // Only a result for the item shown counts; until then we're still checking.
  const accessControl = checked && checked.url === resourceUrlForCheck ? checked.kind : "checking";
  const canShare = accessControl === "acp" || accessControl === "wac";
  const sharingUnsupported = !canShare && accessControl !== "checking";
  const sharingNotice: Record<string, string> = {
    restricted: "You don't have permission to manage sharing for this item.",
    none: "This server doesn't offer sharing for this item.",
    error: "Couldn't check whether this item can be shared. Please try again.",
  };

  const handleRemoveAccess = async (webIdToRemove: string) => {
    if (!file) return;

    setRemovingWebId(webIdToRemove);
    setRemoveError(null);
    try {
      const resourceUrl = file.type === "folder" && !file.url.endsWith("/") ? file.url + "/" : file.url;
      await removeAccess(resourceUrl, webIdToRemove, fetchFn, session.webId);

      // Refresh the access list
      const updatedList = await getAccessList(resourceUrl, fetchFn);
      setAccessList(updatedList);
    } catch (error) {
      console.error("Failed to remove access:", error);
      setRemoveError(error instanceof Error ? error.message : "Couldn't remove access. Please try again.");
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
      const { name, email } = await fetchAndParseProfile(webId, fetchFn);

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
          const updatedList = await getAccessList(resourceUrl, fetchFn);
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

  const footer = sharingUnsupported ? (
    <Button onClick={onClose} variant="default">
      Close
    </Button>
  ) : (
    <Button
      onClick={handleDone}
      variant="default"
      disabled={isSharing || peopleChips.length === 0 || !canShare}
    >
      {isSharing ? "Sharing..." : accessControl === "checking" ? "Checking…" : "Share"}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          {file ? (
            <DialogDescription className="truncate">
              {file.name}
            </DialogDescription>
          ) : null}
        </DialogHeader>
      {sharingUnsupported ? (
        <p role="status" className="text-sm text-muted-foreground">
          {sharingNotice[accessControl]}
        </p>
      ) : (
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
                  <Spinner className="size-5" />
                </div>
              ) : (
                accessList.map((access, index) => {
                  const accessLevel = access.accessModes.includes("Control")
                    ? "Full control"
                    : access.accessModes.includes("Write")
                      ? "Editor"
                      : "Viewer";
                  const isRemoving = removingWebId === access.webId;
                  const canRemove = access.canRemove && access.webId !== session.webId;

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
                        {canRemove && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAccess(access.webId)}
                          disabled={isRemoving}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Remove access for ${access.webId}`}
                          title="Remove access"
                        >
                          {isRemoving ? (
                            <Spinner className="size-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {removeError && (
          <p role="alert" className="text-sm text-destructive">
            {removeError}
          </p>
        )}

        {isLoadingContacts && (
          <div className="flex items-center justify-center py-4">
            <Spinner className="size-5" />
          </div>
        )}
      </div>
      )}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

