"use client";

interface Drive {
  id: string;
  name: string;
  url: string;
}

interface SidebarProps {
  drives: Drive[];
  selectedDriveId?: string;
  onDriveSelect: (driveId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  drives,
  selectedDriveId,
  onDriveSelect,
  isOpen = true,
  onClose,
}: SidebarProps) {
  // On desktop (lg+), sidebar is always visible, so isOpen doesn't matter
  // On mobile, use isOpen state
  const isMobileOpen = isOpen;

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-64 border-r border-gray-200 bg-white shadow-lg transition-transform lg:relative lg:top-0 lg:z-auto lg:h-full lg:shadow-none lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <nav className="p-2" aria-label="Drives navigation">
          <div className="mb-2 flex items-center justify-between px-3 py-2 lg:block">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Drives
            </h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-md p-1 text-gray-600 hover:bg-gray-100 lg:hidden"
                aria-label="Close sidebar"
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
            )}
          </div>
          <ul className="space-y-1" role="list">
            {drives.map((drive) => (
              <li key={drive.id}>
                <button
                  type="button"
                  onClick={() => {
                    onDriveSelect(drive.id);
                    if (onClose) {
                      onClose();
                    }
                  }}
                  className={`cursor-pointer w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedDriveId === drive.id
                      ? "bg-purple-100 text-black"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-current={selectedDriveId === drive.id ? "page" : undefined}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span className="truncate">{drive.name}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}

