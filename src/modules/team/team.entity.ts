import { Column, DeleteDateColumn, Entity, Index, OneToMany } from 'typeorm';
import { AbstractEntity } from '#src/common/database/abstract.entity.js';
import { TeamStatus } from './enum/team-status.enum';
import TeamMemberEntity from '../team-member/team-member.entity';

@Entity('teams')
@Index('teams_project_id_slug_key', ['projectId', 'slug'], { unique: true })
@Index('teams_project_id_name_key', ['projectId', 'name'], { unique: true })
export default class TeamEntity extends AbstractEntity {
  @Column({ type: 'int' })
  projectId!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_teams_leader_id')
  leaderId!: string | null;

  @OneToMany(() => TeamMemberEntity, (member) => member.team)
  members?: TeamMemberEntity[];

  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({
    type: 'enum',
    enum: TeamStatus,
    default: TeamStatus.ACTIVE,
  })
  status!: TeamStatus;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
