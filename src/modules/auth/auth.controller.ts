import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ExchangeTokenDto } from './dtos/exchange-token.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenBlacklistService } from './services/token-blacklist.service';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  @Get('oauth/url')
  async getOAuthUrl() {
    const oauthUrl = await this.authService.getOauthUrl();
    return { url: oauthUrl };
  }

  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('exchange')
  async exchange(@Body() body: ExchangeTokenDto) {
    return this.authService.handleOAuthExchange(body.code, body.state);
  }

  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.handleRefreshToken(body.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = req.user;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No valid authorization token');
    }

    const token = authHeader.substring(7);

    const payload = this.authService.decodeToken(token);
    const expiresAt = this.authService.getTokenExpiration(token);

    if (!payload.jti) {
      throw new UnauthorizedException('Token missing required claims');
    }

    await this.tokenBlacklistService.blacklistToken(
      payload.jti,
      expiresAt,
      payload.sub,
      'User logout',
    );

    return { success: true, message: 'Logged out successfully' };
  }
}
