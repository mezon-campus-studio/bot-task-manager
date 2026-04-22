import { TeamMemberStatus } from '@src/modules/team-member/enums/team-member-status.enum';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import { Factory } from './factory';
import { team } from './team';
import { user } from './user';

export const teamMember = Factory.forEntity<TeamMemberEntity>(
  TeamMemberEntity,
  async (input) => {
    const teamId = input.teamId ?? (await team({})).id;
    const userId = input.userId ?? (await user({})).id;

    return {
      invitedByUserId: input.invitedByUserId ?? null,
      joinedAt: input.joinedAt ?? null,
      status: input.status ?? TeamMemberStatus.INVITED,
      teamId,
      userId,
      ...input,
    };
  },
);
