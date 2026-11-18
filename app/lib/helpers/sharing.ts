/**
 * Sharing, whichever access control the server uses: discovers it, then
 * hands over to the ACP (acpUtils) or WAC (wacUtils) implementation.
 */

import { discoverAccessControl, UnsupportedAccessControlError } from "./accessControl";
import {
  getResourceAccessList as getAcpAccessList,
  removeAccessFromResource as removeAcpAccess,
  shareResourceWithAcp,
  type AccessEntry,
  type AccessLevel,
} from "./acpUtils";
import { getWacAccessList, removeAccessWithWac, shareResourceWithWac } from "./wacUtils";

/** WAC's .acl, or null for ACP. Throws UnsupportedAccessControlError for anything else. */
async function wacDocument(resourceUrl: string, fetchFn: typeof fetch): Promise<string | null> {
  const accessControl = await discoverAccessControl(resourceUrl, fetchFn);
  if (accessControl?.kind === "wac") return accessControl.url;
  if (accessControl?.kind === "acp") return null;
  throw new UnsupportedAccessControlError(accessControl?.kind ?? "none");
}

export async function shareResource(
  resourceUrl: string,
  webIds: string[],
  accessLevel: AccessLevel,
  fetchFn: typeof fetch,
  ownWebId: string | undefined,
): Promise<void> {
  const aclUrl = await wacDocument(resourceUrl, fetchFn);
  if (aclUrl) return shareResourceWithWac(resourceUrl, aclUrl, webIds, accessLevel, fetchFn, ownWebId);
  return shareResourceWithAcp(resourceUrl, webIds, accessLevel, fetchFn, ownWebId);
}

/** Who has access, or null when it can't be read. */
export async function getAccessList(resourceUrl: string, fetchFn: typeof fetch): Promise<AccessEntry[] | null> {
  try {
    const aclUrl = await wacDocument(resourceUrl, fetchFn);
    return aclUrl ? await getWacAccessList(resourceUrl, aclUrl, fetchFn) : await getAcpAccessList(resourceUrl, fetchFn);
  } catch (error) {
    console.error("Failed to get resource access list:", error);
    return null;
  }
}

export async function removeAccess(
  resourceUrl: string,
  webIdToRemove: string,
  fetchFn: typeof fetch,
  ownWebId: string | undefined,
): Promise<void> {
  const aclUrl = await wacDocument(resourceUrl, fetchFn);
  if (aclUrl) return removeAccessWithWac(resourceUrl, aclUrl, webIdToRemove, fetchFn, ownWebId);
  return removeAcpAccess(resourceUrl, webIdToRemove, fetchFn, ownWebId);
}
