# Solid File Manager

A Google Drive-like file manager for Solid Pods, built with Next.js, React, and TypeScript.

## Overview

This application provides a user-friendly interface for managing files and folders in Solid Pods, with features similar to Google Drive:

- **File Management**: Browse, view, and organize files and folders
- **Permission Management**: Share files with others using ACP (Access Control Policies) with a Google Drive-like interface
- **Multiple Drives**: View and manage multiple storage roots/drives
- **Grid and List Views**: Toggle between grid and list views for file browsing
- **Search**: Search functionality for finding files quickly

## Features

### Current UI Features (Phase 1)

- ✅ Google Drive-like interface layout
- ✅ Left sidebar with drives list
- ✅ Main content area with file list
- ✅ Grid and list view toggle
- ✅ Breadcrumb navigation
- ✅ File item display with icons and metadata
- ✅ Permissions/sharing dialog (UI only)
- ✅ Minimal black, white, and light purple color scheme
- ✅ Semantic HTML for accessibility

### Planned Features (Phase 2 - Integration)

- [ ] Solid authentication (OIDC)
- [ ] File operations (create, read, update, delete)
- [ ] Folder navigation
- [ ] ACP permission management integration
- [ ] Storage root discovery from WebID
- [ ] File upload/download
- [ ] Real-time file updates

## Tech Stack

- **Framework**: Next.js 16
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **Solid SDK**: [@inrupt/solid-client-js](https://github.com/inrupt/solid-client-js) (to be integrated)

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

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
│   │   ├── Header.tsx       # Top header with search and actions
│   │   ├── Sidebar.tsx      # Left sidebar with drives list
│   │   ├── Breadcrumb.tsx   # Navigation breadcrumb
│   │   ├── FileList.tsx     # Main file list component
│   │   ├── FileItem.tsx     # Individual file/folder item
│   │   └── PermissionsDialog.tsx  # Sharing/permissions dialog
│   ├── page.tsx             # Main page component
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── public/                   # Static assets
└── README.md
```

## Solid Protocol Integration

This application will integrate with Solid using:

- **Solid Protocol**: [https://solidproject.org/TR/protocol#resources](https://solidproject.org/TR/protocol#resources)
- **ACP (Access Control Policies)**: [https://solid.github.io/authorization-panel/acp-specification/](https://solid.github.io/authorization-panel/acp-specification/)
- **Storage Root Discovery**: Using `pim:storage` predicate from WebID
- **SDK**: [@inrupt/solid-client-js](https://github.com/inrupt/solid-client-js)

## Design Principles

- **Minimal Design**: Black, white, and light purple color scheme with no gradients
- **Accessibility**: Semantic HTML and ARIA labels throughout
- **Code Splitting**: Components are split into reusable, focused modules
- **Type Safety**: Full TypeScript support for type safety

## Contributing

This project is currently in active development. The UI phase is complete, and Solid integration is the next step.

## License

[Add your license here]

## References

- [Solid Project](https://solidproject.org/)
- [Solid Protocol Specification](https://solidproject.org/TR/protocol)
- [ACP Specification](https://solid.github.io/authorization-panel/acp-specification/)
- [Inrupt Solid Client JS](https://github.com/inrupt/solid-client-js)
- [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer)

## Related Projects

- [nextfm](https://github.com/inrupt/nextfm)
- [Penny](https://penny.vincenttunru.com/)
- [PodPro](https://podpro.dev/)
- [solid-filemanager](https://otto-aa.github.io/solid-filemanager/)
