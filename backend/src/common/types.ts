export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  SUPERVISOR: 'supervisor',
  AGENT: 'agent',
  RESELLER: 'reseller',
} as const;

export interface JwtPayload {
  sub: number;
  email: string;
  organizationId: number;
  role: string;
}

export interface AuthedRequest {
  user: JwtPayload;
  ip: string;
}
