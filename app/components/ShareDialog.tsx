"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./shared/Modal";
import Button from "./shared/Button";
import Input from "./shared/Input";
import { FileItemData } from "./FileItem";
import { fetchUserContacts, Contact } from "../lib/helpers/contactUtils";
import { fetchAndParseProfile, extractNameAndEmail } from "../lib/helpers/profileUtils";
import { getResourceAccessList } from "../lib/helpers/acpUtils";
import { UserIcon, MagnifyingGlassIcon, LockClosedIcon, XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel>("Editor");
  const [peopleChips, setPeopleChips] = useState<PersonChip[]>([]);
  const [isAddingWebId, setIsAddingWebId] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [accessList, setAccessList] = useState<Array<{ webId: string; accessModes: string[] }> | null>(null);
  const [isLoadingAccessList, setIsLoadingAccessList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      setShowDropdown(false);
      setFilteredContacts([]);
      setSelectedAccessLevel("Editor");
      setPeopleChips([]);
      setAccessList(null);
    }
  }, [isOpen, file]);

  // Filter contacts based on input
  useEffect(() => {
    if (!webIdInput.trim()) {
      // When input is empty, show all contacts
      setFilteredContacts(contacts);
      return;
    }

    const query = webIdInput.toLowerCase().trim();
    const filtered = contacts.filter((contact) => {
      const nameMatch = contact.name?.toLowerCase().includes(query);
      const emailMatch = contact.email?.toLowerCase().includes(query);
      const webIdMatch = contact.webId.toLowerCase().includes(query);
      return nameMatch || emailMatch || webIdMatch;
    });

    setFilteredContacts(filtered);
  }, [webIdInput, contacts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebIdInput(e.target.value);
  };

  const handleContactSelect = (contact: Contact) => {
    // Populate the input with the selected contact's WebID
    setWebIdInput(contact.webId);
    setShowDropdown(false);
    // Focus back on input so user can press Enter to add
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleAddWebId = async () => {
    const webId = webIdInput.trim();
    if (!webId) {
      return;
    }

    // Check if person is already added
    if (peopleChips.some((p) => p.webId === webId)) {
      setWebIdInput("");
      setShowDropdown(false);
      return;
    }

    // Validate WebID format (basic check)
    if (!webId.startsWith("http")) {
      return;
    }

    setIsAddingWebId(true);

    try {
      // Fetch profile to get name and email 
      const { store, mainSubject } = await fetchAndParseProfile(webId);
      
      // Extract name and email using the shared helper
      const { name, email } = extractNameAndEmail(store, mainSubject);

      setPeopleChips([
        ...peopleChips,
        {
          webId,
          name,
          email,
        },
      ]);
      setWebIdInput("");
      setShowDropdown(false);
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
      setShowDropdown(false);
    } finally {
      setIsAddingWebId(false);
    }
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
    <div className="flex justify-end">
      <Button onClick={handleDone} variant="primary" disabled={isSharing || peopleChips.length === 0}>
        {isSharing ? "Sharing..." : "Done"}
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

          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Add a WebID"
              value={webIdInput}
              onChange={handleInputChange}
              onFocus={() => {
                // Show all contacts when input is focused
                if (contacts.length > 0) {
                  setShowDropdown(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && webIdInput.trim() && !isAddingWebId) {
                  e.preventDefault();
                  handleAddWebId();
                }
              }}
              leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
              className="w-full"
              disabled={isAddingWebId}
            />
            {showDropdown && filteredContacts.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto"
              >
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.webId}
                    type="button"
                    onClick={() => handleContactSelect(contact)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                      {contact.name ? (
                        <span className="text-sm font-medium text-gray-700">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <UserIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {contact.name || contact.email || contact.webId}
                      </div>
                      {contact.email && contact.name && (
                        <div className="text-xs text-gray-500 truncate">
                          {contact.email}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
        {accessList && accessList.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">People with access</h3>
            <div className="space-y-2">
              {isLoadingAccessList ? (
                <div className="flex items-center justify-center py-2">
                  <LoadingSpinner />
                </div>
              ) : (
                accessList.map((access, index) => {
                  const hasWrite = access.accessModes.some((mode) => mode.includes("Write"));
                  const accessLevel = hasWrite ? "Editor" : "Viewer";
                  
                  return (
                    <div
                      key={access.webId || index}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-700 truncate max-w-xs">
                          {access.webId}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{accessLevel}</span>
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

