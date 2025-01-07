export interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: Date;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: Date;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  invited_by: string;
  token: string;
  expires_at: Date;
  created_at: Date;
} 