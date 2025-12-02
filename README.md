# Solid File Manager

A file manager application for managing Solid Pods, built on Solid, with Next.js, React, and TypeScript.

## Overview

This application provides a user-friendly interface for managing files and folders in Solid Pods, with features similar to Google Drive:

- **File Management**: Browse, view, and organize files and folders
- **Permission Management**: Share files with others using ACP (Access Control Policies) with a Google Drive-like interface
- **Multiple Drives**: View and manage multiple storage roots/drives
- **Grid and List Views**: Toggle between grid and list views for file browsing
- **Search**: Search functionality for finding files quickly

## Features

### Core Functionality

- **Solid Authentication (OIDC)**: Full OIDC authentication with session management and persistence
- **Storage Root Discovery**: Automatically discovers and displays all storage roots from WebID profile using `pim:storage` and `solid:storage` predicates
- **File & Folder Navigation**: Browse through folders with double-click navigation and breadcrumb support
- **Grid and List Views**: Toggle between grid and list views for file browsing
- **Breadcrumb Navigation**: Navigate through folder hierarchy with clickable breadcrumbs
- **URL State Management**: Browser URL and sessionStorage synchronization for persistent navigation
- **Optimized Browsing**: Uses RDF metadata from container listings to avoid unnecessary HTTP requests

### File Operations

- **Create Folders**: Create new folders with custom names
- **Rename Files/Folders**: Rename resources using URL-based renaming (recreate with new name, delete old) to preserve resource URIs
- **Copy Files/Folders**: Copy files and folders with automatic name collision handling (e.g., "Copy of file", "Copy of file (1)")
- **Move Files**: Move files between folders within the same storage (fetch → put in new location → delete old)
- **Delete Files/Folders**: Delete resources from your Pod with confirmation dialog
- **Download Files/Folders**: Download individual files or folders as ZIP archives
- **File Upload**: Upload files to your Pod via file picker or drag-and-drop
- **Folder Upload**: Upload entire folders with preserved structure via folder picker or drag-and-drop (using File System Access API)
- **Drag-and-Drop Upload**: Drag and drop files or folders directly into the file manager (folder support in Chrome/Edge)
- **File Preview**: Preview various file types using content-type headers:
  - Images (displayed in modal)
  - PDFs (opened in new tab)
  - Word documents (.doc, .docx - opened in new tab)
  - Text files (displayed in modal)
  - Binary files detected and handled appropriately

### User Interface

- **Google Drive-like Interface**: Clean, modern interface with familiar UX patterns
- **Left Sidebar**: Displays all available file manager menus
- **File Item Display**: Shows files and folders with appropriate icons, metadata, and context menus
- **Context Menus**: Hover on folder/file and click the menu button to access the file operations menu dropdown (Rename, Copy, Move, Delete, Preview, Download)
- **Modals & Dialogs**: 
  - Rename dialog for renaming resources
  - Move dialog for selecting destination folder
  - Preview modal for viewing files
  - Permissions dialog (UI ready)
- **Loading States**: Loading spinners and error displays throughout
- **Toast Notifications**: User feedback for all operations
- **Minimal Design**: Black, white, and light purple color scheme
- **Semantic HTML**: Accessible markup with ARIA labels

### Technical Features

- **Session Management**: Centralized session utilities for authentication
- **Profile Utilities**: WebID profile fetching and parsing utilities
- **URL Utilities**: URL state management, encoding/decoding, and path resolution
- **Binary File Detection**: Automatic detection of binary/system files (e.g., `.DS_Store`) to prevent unnecessary RDF conversion attempts
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript support throughout
- **Cache-Busting**: Automatic cache-busting for container listings after uploads/deletes to ensure fresh data

## Tech Stack

- **Framework**: Next.js 16
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **Solid SDK**: [@inrupt/solid-client-js](https://github.com/inrupt/solid-client-js)
- **Icons**: [@heroicons/react](https://heroicons.com/)
- **Notifications**: [react-hot-toast](https://react-hot-toast.com/)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd solid-file-manager
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## Development Setup

### Local CSS (Community Solid Server)

For development, you'll need to run a local Community Solid Server (CSS). The app is configured to work with a CSS instance running on `http://localhost:3001/`.

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# The URI of the Solid container used by the demo Community Solid Server
# Default for local dev (Community Solid Server started by `npm run start:css`)
NEXT_PUBLIC_BASE_URI="http://localhost:3001/"

# The manifest resource file used by the app (relative to the container root)
NEXT_PUBLIC_MANIFEST_RESOURCE_URI="resource.ttl"

# Admin WebID used for booting the demo (replace with your WebID)
NEXT_PUBLIC_ADMIN_WEBID="https://id.inrupt.com/your-webid"

NEXT_PUBLIC_OIDC_ISSUER="https://login.inrupt.com"
```

## Project Structure

```
solid-file-manager/
├── app/
│   ├── components/          # React components
│   │   ├── AuthWrapper.tsx  # Authentication wrapper
│   │   ├── FileManager.tsx  # Main file manager component
│   │   ├── Header.tsx       # Top header with search and actions
│   │   ├── Sidebar.tsx      # Left sidebar with drives list
│   │   ├── Breadcrumb.tsx   # Navigation breadcrumb
│   │   ├── FileList.tsx     # Main file list component
│   │   ├── FileItem.tsx     # Individual file/folder item
│   │   ├── FileItemMenu.tsx # Context menu for file operations
│   │   ├── NewFolderDialog.tsx # Dialog for creating folders
│   │   ├── RenameDialog.tsx  # Dialog for renaming resources
│   │   ├── MoveDialog.tsx   # Dialog for moving files
│   │   ├── PreviewModal.tsx # Modal for previewing files
│   │   ├── FileUploadHandler.tsx # File upload component
│   │   ├── ProfileIcon.tsx  # User profile icon and logout
│   │   ├── LoginPage.tsx   # Login page
│   │   └── shared/         # Shared/reusable components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useSolidStorages.ts # Hook for discovering storages
│   │   │   ├── useBrowseStorage.ts # Hook for browsing containers
│   │   │   └── useUserProfile.ts   # Hook for user profile
│   │   └── helpers/         # Utility functions
│   │       ├── sessionUtils.ts    # Session management
│   │       ├── profileUtils.ts    # WebID profile utilities
│   │       ├── copyUtils.ts       # Copy and move operations
│   │       ├── deleteUtils.ts     # Delete operations
│   │       ├── downloadUtils.ts   # Download operations (files and ZIP)
│   │       ├── uploadUtils.ts     # File and folder upload operations
│   │       ├── dragDropUtils.ts   # Drag-and-drop file/folder handling
│   │       ├── urlStateUtils.ts   # URL state management
│   │       ├── urlUtils.ts        # URL utilities and binary file detection
│   │       ├── fileTypeUtils.ts   # File type detection
│   │       └── ...
│   ├── page.tsx             # Main page component
│   ├── layout.tsx           # Root layout
│   └── globals.css           # Global styles
├── public/                   # Static assets
└── README.md
```

## Solid Protocol Integration

This application integrates with Solid using:

- **Solid Protocol**: [https://solidproject.org/TR/protocol#resources](https://solidproject.org/TR/protocol#resources)
- **ACP (Access Control Policies)**: [https://solid.github.io/authorization-panel/acp-specification/](https://solid.github.io/authorization-panel/acp-specification/) (UI ready, full integration pending)
- **Storage Root Discovery**: 
  - Uses `pim:storage` predicate from WebID profile
  - Uses `solid:storage` predicate as fallback
  - Supports hierarchical traversal for storage discovery
- **Container Browsing**: 
  - Uses RDF metadata from container listings to determine file/folder types
  - Optimized to avoid individual HTTP requests per resource
  - Reads `ldp:Container` and `ldp:BasicContainer` types from container metadata
- **Resource Operations**: 
  - URL-based renaming (recreate with new name, delete old) to preserve resource URIs
  - Recursive folder operations for copy, move, and delete
  - Automatic handling of binary files and system files
- **SDK**: [@inrupt/solid-client-js](https://github.com/inrupt/solid-client-js)

## Design Principles

- **Minimal Design**: Black, white, and light purple color scheme with no gradients
- **Accessibility**: Semantic HTML and ARIA labels throughout
- **Code Splitting**: Components are split into reusable, focused modules
- **Type Safety**: Full TypeScript support for type safety

## References

- [Solid Project](https://solidproject.org/)
- [Solid Protocol Specification](https://solidproject.org/TR/protocol)
- [ACP Specification](https://solid.github.io/authorization-panel/acp-specification/)
- [Inrupt Solid Client JS](https://github.com/inrupt/solid-client-js)
- [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer)

## License

This work is dual-licensed under MIT and Apache 2.0. You can choose between one of them if you use this work.

SPDX-License-Identifier: MIT OR Apache-2.0