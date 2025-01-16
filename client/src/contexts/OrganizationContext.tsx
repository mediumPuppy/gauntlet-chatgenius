import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: Date;
}

export interface OrganizationContextType {
  currentOrganization: Organization | null;
  isLoading: boolean;
  organizations: Organization[];
  userRole: string | null;
  setCurrentOrganization: (org: Organization | null) => void;
  createOrganization: (name: string) => Promise<Organization>;
  inviteMember: (email: string) => Promise<void>;
  joinOrganization: (inviteCode: string) => Promise<void>;
  updateOrganization: (orgId: string, data: { name: string }) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["organizations", user?.id],
    queryFn: async () => {
      if (!user || !token) return [];
      const response = await fetch("/api/organizations/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return data;
    },
    enabled: !!user && !!token,
  });

  useEffect(() => {
    if (organizations.length > 0 && !currentOrganization) {
      setCurrentOrganization(organizations[0]);
    }
  }, [organizations, currentOrganization]);

  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!token) throw new Error("Not authenticated");

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) throw new Error("Failed to create organization");

      const newOrg = await response.json();

      try {
        await fetch("/api/channels", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: "general",
            is_dm: false,
            organization_id: newOrg.id,
          }),
        });
      } catch (error) {
        console.error("Failed to create default channel:", error);
      }

      return newOrg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const joinOrgMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!token) throw new Error("Not authenticated");

      const response = await fetch("/api/organizations/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to join organization");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const inviteMember = async (email: string): Promise<void> => {
    if (!token || !currentOrganization)
      throw new Error("Not authenticated or no organization selected");

    const response = await fetch(
      `/api/organizations/${currentOrganization.id}/invite`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      },
    );

    if (!response.ok) throw new Error("Failed to invite member");
  };

  useEffect(() => {
    if (!user) {
      setCurrentOrganization(null);
    }
  }, [user]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentOrganization || !token) {
        setUserRole(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/organizations/${currentOrganization.id}/role`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch user role");

        const { role } = await response.json();
        setUserRole(role);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [currentOrganization, token]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        isLoading,
        organizations,
        userRole,
        setCurrentOrganization,
        createOrganization: createOrgMutation.mutateAsync,
        joinOrganization: joinOrgMutation.mutateAsync,
        inviteMember,
        updateOrganization: async (orgId: string, data: { name: string }) => {
          if (!token) throw new Error("Not authenticated");

          const response = await fetch(`/api/organizations/${orgId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) throw new Error("Failed to update organization");
        },
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider",
    );
  }
  return context;
};
