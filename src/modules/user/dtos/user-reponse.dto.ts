export class UserReponseDto {
  mezonId: string;
  name: string | null;
  email: string | null;
  avatar?: string | null;
  status: string | null;
  currentProjectId: string | null;
  creatAt: Date | null;
  updatedAt: Date | null;
  lastActiveAt: Date | null;
  deletedAt: Date | null;
}
