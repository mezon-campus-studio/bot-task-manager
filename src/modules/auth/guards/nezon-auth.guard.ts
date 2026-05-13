import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { NezonCommandContext } from '@src/libs/nezon/interfaces/command-context.interface';
import { UserService } from '@src/modules/user/user.service';

@Injectable()
export class NezonAuthGuard implements CanActivate {
  private readonly logger = new Logger(NezonAuthGuard.name);

  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'rpc') {
      return true;
    }

    const nezonContext = context.switchToRpc().getData<NezonCommandContext>();
    const senderId = nezonContext.message.sender_id;

    if (!senderId) {
      this.logger.warn('NezonAuthGuard: No sender_id found in message');
      return false;
    }

    const user = await this.userService.findByMezonId(senderId);
    if (!user) {
      this.logger.log(
        `NezonAuthGuard: User with mezonId ${senderId} not found, creating new user`,
      );
      // Create a basic user record for new users
      const newUser = await this.userService.upsertByMezonId(senderId, {
        name: `User_${senderId.slice(-8)}`, // Temporary name based on ID
      });
      (nezonContext as any).dbUser = newUser;
      return true;
    }

    // Attach the database user entity to the context for use in handlers
    (nezonContext as any).dbUser = user;

    return true;
  }
}
