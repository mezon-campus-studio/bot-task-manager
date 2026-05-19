import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeamMemberStatus } from './enums/team-member-status.enum';
import UserEntity from '../user/user.entity';

@Entity('team_members')
@Index('team_members_team_id_user_id_key', ['teamId', 'userId'], {
  unique: true,
})
export default class TeamMemberEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int' })
  teamId!: number;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

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
