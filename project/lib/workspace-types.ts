export type Role = 'host' | 'member';
export type AccessState = 'not_requested' | 'pending' | 'rejected' | 'onboarding' | 'approved';

export type PublicMember = {
  userId: string;
  displayName: string;
  canRemove: boolean;
  joinOrder: number;
  extensionActive: boolean;
  imageUrl: string;
};

export type PendingRequest = { userId: string; email: string; requestedAt: number };
export type ActivityEntry = { id: number; message: string; createdAt: number };
export type NoteLogEntry = { id: number; displayName: string; note: string; createdAt: number };
export type RoleLogEntry = { id: number; displayName: string; oldRole: string; newRole: string; createdAt: number };
export type ErrorLogEntry = { id: number; message: string; createdAt: number };

export type WorkspacePayload = {
  accessState: AccessState;
  currentUser: null | { userId: string; email: string; role?: Role; displayName?: string | null; imageUrl?: string | null; pendingImageReceived?: boolean };
  members: PublicMember[];
  requests: PendingRequest[];
  activity: ActivityEntry[];
  noteLog: NoteLogEntry[];
  roleLog: RoleLogEntry[];
  errorLog: ErrorLogEntry[];
  roleStatuses: string[];
  boardTitle: string;
  hostConfigurationRequired?: boolean;
  extensionEverSeen?: boolean;
  installedExtensionVersion?: string | null;
  availableExtensionVersion?: string;
};
