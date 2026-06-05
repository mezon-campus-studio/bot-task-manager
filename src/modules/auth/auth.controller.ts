import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
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
    const oauthUrl = this.authService.getOauthUrl();
    return { url: oauthUrl };
  }

  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('exchange')
  async exchange(@Body() body: { code: string; state: string }) {
    return this.authService.handleOAuthExchange(body.code, body.state);
  }

  @Post('refresh')
  async refresh(
    @Body() body: { refresh_token: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.authService.handleRefreshToken(
        body.refresh_token,
      );

      return {
        tokens,
      };
    } catch (error) {
      res.status(401);
      return { success: false, message: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Request() req,
    @Body() body: { access_token?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      let token = body.access_token;

      // If no token provided in body, extract from Authorization header
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        res.status(400);
        return { success: false, message: 'No token provided' };
      }

      // Decode token to get jti and expiration
      const payload = this.authService.decodeToken(token);
      const expiresAt = this.authService.getTokenExpiration(token);

      // Add token to blacklist
      await this.tokenBlacklistService.blacklistToken(
        payload.jti || payload.sub, // Use jti if available, otherwise use sub (user ID)
        expiresAt,
        payload.sub,
        'User logout',
      );

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      res.status(400);
      return { success: false, message: error.message || 'Logout failed' };
    }
  }
}
