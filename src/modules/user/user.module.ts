import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import UserEntity from '@src/modules/user/user.entity';
import { UserCommandHandler } from './user-command.handler';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    forwardRef(() => AuthModule),
  ],
  providers: [UserService, UserCommandHandler],
  exports: [UserService],
})
export class UserModule {}
