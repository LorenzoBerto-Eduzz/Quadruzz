export type Role = 'owner' | 'admin' | 'member';
export type AccessState = 'not_requested' | 'pending' | 'rejected' | 'onboarding' | 'approved';

export type PublicMember = {
  userId: string;
  displayName: string;
  role?: Role;
  joinOrder: number;
  online: boolean;
  imageUrl: string;
};

export type PendingRequest = { userId: string; email: string; requestedAt: number };

export type WorkspacePayload = {
  accessState: AccessState;
  currentUser: null | { userId: string; email: string; role?: Role; displayName?: string | null; imageUrl?: string | null };
  members: PublicMember[];
  requests: PendingRequest[];
  boardTitle: string;
  ownerConfigurationRequired?: boolean;
};
