import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useOrganization } from "../../contexts/OrganizationContext";
import { OrganizationDialog } from "./OrganizationDialog";

export const OrganizationSwitcher: React.FC = () => {
  const { currentOrganization, userRole } = useOrganization();
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const isAdmin = userRole === "owner" || userRole === "admin";

  if (!currentOrganization) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 px-4 py-2 text-white hover:bg-primary-600 rounded-md transition-colors"
      >
        <span>{currentOrganization.name}</span>
        <svg
          className={`w-5 h-5 transition-transform ${showDropdown ? "transform rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button
              onClick={() => {
                setShowOrgDialog(true);
                setShowDropdown(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Switch Organization
            </button>

            {isAdmin && (
              <Link
                to="/organization/settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setShowDropdown(false)}
              >
                Organization Settings
              </Link>
            )}
          </div>
        </div>
      )}

      <OrganizationDialog
        open={showOrgDialog}
        onClose={() => setShowOrgDialog(false)}
      />
    </div>
  );
};
