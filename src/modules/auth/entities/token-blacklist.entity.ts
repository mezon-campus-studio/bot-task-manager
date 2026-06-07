import { Column, Entity, Index } from 'typeorm';
import { AbstractUuidEntity } from '@src/common/database/abstract.entity';

@Entity('token_blacklist')
@Index('IDX_token_blacklist_jti', ['jti'], { unique: true })
@Index('IDX_token_blacklist_expires_at', ['expiresAt'])
export class TokenBlacklistEntity extends AbstractUuidEntity {
  @Column({ type: 'varchar' })
  jti!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  userId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;
}
