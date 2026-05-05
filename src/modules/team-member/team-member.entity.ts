import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '#src/common/database/abstract.entity.js';
import { TeamMemberStatus } from './enums/team-member-status.enum';
import TeamEntity from '../team/team.entity';
import UserEntity from '../user/user.entity';

@Entity('team_members')
@Index('team_members_team_id_user_id_key', ['teamId', 'userId'], {
  unique: true,
})
export default class TeamMemberEntity extends AbstractEntity {
  @Column({ type: 'int' })
  teamId!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => TeamEntity, (team) => team.members)
  @JoinColumn({ name: 'teamId' })
  team!: TeamEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'invitedByUserId' })
  invitedBy?: UserEntity;

  @Column({
    type: 'enum',
    enum: TeamMemberStatus,
    default: TeamMemberStatus.INVITED,
  })
  status!: TeamMemberStatus;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt!: Date | null;
}
