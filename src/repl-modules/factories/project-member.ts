import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';
import { Factory } from './factory';
import { project } from './project';
import { user } from './user';

export const projectMember = Factory.forEntity<ProjectMemberEntity>(
  ProjectMemberEntity,
  async (input) => {
    const projectId = input.projectId ?? (await project({})).id;
    const memberUserId = input.userId ?? (await user({})).id;
    const invitedByUserId = input.invitedByUserId ?? null;

    return {
      invitedByUserId: input.invitedByUserId ?? null,
      joinedAt: input.joinedAt ?? null,
      invitedByUser:
        invitedByUserId == null ? null : ({ id: invitedByUserId } as never),
      project: { id: projectId } as never,
      projectId,
      status: input.status ?? ProjectMemberStatus.INVITED,
      user: { id: memberUserId } as never,
      userId: memberUserId,
      ...input,
    };
  },
);
