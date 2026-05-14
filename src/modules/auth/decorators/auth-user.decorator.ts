import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Assuming the JWT payload is attached to request.user by the JwtAuthGuard
    // The payload usually contains { sub: userId, email: string }
    return request.user?.sub;
  },
);
