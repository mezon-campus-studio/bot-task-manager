import EventEntity from '@src/modules/event/event.entity';
import NoteEntity from '@src/modules/note/note.entity';
import PermissionEntity from '@src/modules/permission/permission.entity';
import ProjectEntity from '@src/modules/project/project.entity';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';
import RoleEntity from '@src/modules/role/role.entity';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import TaskEntity from '@src/modules/task/task.entity';
import TeamEntity from '@src/modules/team/team.entity';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import TicketEntity from '@src/modules/ticket/ticket.entity';
import UserEntity from '@src/modules/user/user.entity';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';

const entities = [
  UserEntity,
  ProjectEntity,
  ProjectMemberEntity,
  TeamEntity,
  TeamMemberEntity,
  RoleEntity,
  PermissionEntity,
  RolePermissionEntity,
  UserRoleAssignmentEntity,
  TaskEntity,
  TicketEntity,
  EventEntity,
  NoteEntity,
];
export default entities;
