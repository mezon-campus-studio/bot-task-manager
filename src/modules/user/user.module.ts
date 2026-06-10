import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import UserEntity from '@src/modules/user/user.entity';
import { UserCommandHandler } from './user-command.handler';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    forwardRef(() => AuthModule),
  ],
  providers: [UserService, UserCommandHandler, PendingDeletionService],
  exports: [UserService],
})
export class UserModule {}
