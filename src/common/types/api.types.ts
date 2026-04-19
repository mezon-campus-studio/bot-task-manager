export interface ApiResponse<T> {
  statusCode: 200;
  data: T;
  message?: string;
}
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserAuth {
  id: string;
  mezonId: string;
  name: string;
  email: string;
  currentProjectId?: number | null;
  role?: number | null;
  roles?: number[];
  staffId?: number;
}
export interface AuthProfile {
  user: UserAuth;
  tokens: AuthTokens;
}
