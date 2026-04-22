import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class AbstractAuditEntity {
  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  createdBy!: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  updatedBy!: string | null;
}

export abstract class AbstractEntity extends AbstractAuditEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;
}

export abstract class AbstractUuidEntity extends AbstractAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
}
