export type Role = 'host' | 'member';
export type AccessState = 'not_requested' | 'pending' | 'rejected' | 'onboarding' | 'approved';

export type PublicMember = {
  userId: string;
  displayName: string;
  canRemove: boolean;
  joinOrder: number;
  online: boolean;
  imageUrl: string;
};

export type PendingRequest = { userId: string; email: string; requestedAt: number };
export type ActivityEntry = { id: number; message: string; createdAt: number };

export type WorkspacePayload = {
  accessState: AccessState;
  currentUser: null | { userId: string; email: string; role?: Role; displayName?: string | null; imageUrl?: string | null; pendingImageReceived?: boolean };
  members: PublicMember[];
  requests: PendingRequest[];
  activity: ActivityEntry[];
  boardTitle: string;
  hostConfigurationRequired?: boolean;
};
