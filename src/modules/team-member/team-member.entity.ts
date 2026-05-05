import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeamMemberStatus } from './enums/team-member-status.enum';

@Entity('team_members')
@Index('team_members_team_id_user_id_key', ['teamId', 'userId'], {
  unique: true,
})
export default class TeamMemberEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int' })
  teamId!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: TeamMemberStatus,
  })
  status!: TeamMemberStatus;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
