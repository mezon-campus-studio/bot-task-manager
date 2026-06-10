import { randomBytes, randomUUID } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { AppConfigService } from '@src/common/shared/services/app-config.service';
import UserEntity from '@src/modules/user/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { UserService } from '../user/user.service';

export interface ExchangeCodeData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface UserInfoData {
  avatar: string;
  display_name: string;
  email: string;
  user_id: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly OAUTH_STATE_PREFIX = 'oauth_state:';
  private readonly OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    private appConfigService: AppConfigService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async exchangeCode(code: string, state: string): Promise<ExchangeCodeData> {
    const oauthConfig = this.appConfigService.oauthConfig;
    const res = await fetch(`${oauthConfig.baseUri}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        state,
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        redirect_uri: oauthConfig.redirectUri,
        scope: 'openid offline',
      }),
    });

    if (!res.ok) {
      this.logger.error(`Failed to exchange code: ${await res.text()}`);
      throw new BadRequestException('Failed to exchange code for token');
    }

    const data: ExchangeCodeData = await res.json();
    return data;
  }

  async userInfo(accessToken: string): Promise<UserInfoData> {
    const oauthConfig = this.appConfigService.oauthConfig;
    const userRes = await fetch(`${oauthConfig.baseUri}/userinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        access_token: accessToken,
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        redirect_uri: oauthConfig.redirectUri,
      }),
    });

    if (!userRes.ok) {
      this.logger.error(`Failed to fetch user info: ${await userRes.text()}`);
      throw new BadRequestException('Failed to fetch user info');
    }

    const data: UserInfoData = await userRes.json();
    return data;
  }

  async getOauthUrl(): Promise<string> {
    const oauthConfig = this.appConfigService.oauthConfig;
    const state = randomBytes(16).toString('hex');

    await this.cacheManager.set(
      `${this.OAUTH_STATE_PREFIX}${state}`,
      true,
      this.OAUTH_STATE_TTL_MS,
    );

    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      response_type: 'code',
      scope: 'openid offline',
      state,
    });

    return `${oauthConfig.baseUri}/oauth2/auth?${params.toString()}`;
  }

  async handleOAuthExchange(code: string, state: string): Promise<any> {
    const stateKey = `${this.OAUTH_STATE_PREFIX}${state}`;
    const storedState = await this.cacheManager.get(stateKey);

    if (!storedState) {
      throw new BadRequestException(
        'Invalid or expired OAuth state. Please try again.',
      );
    }

    await this.cacheManager.del(stateKey);

    const tokenData = await this.exchangeCode(code, state);
    const userInfo = await this.userInfo(tokenData.access_token);

    const user = await this.userService.upsertByMezonId(userInfo.user_id, {
      name: userInfo.display_name,
      email: userInfo.email,
    });

    const tokens = await this.signToken(user.id, user.email);

    return {
      user,
      ...tokens,
    };
  }

  async handleRefreshToken(refreshToken: string): Promise<any> {
    if (!refreshToken) {
      throw new BadRequestException('No refresh token provided');
    }
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.appConfigService.jwtConfig.refreshSecret,
      });

      if (payload.jti) {
        const isBlacklisted =
          await this.tokenBlacklistService.isTokenBlacklisted(payload.jti);
        if (isBlacklisted) {
          throw new UnauthorizedException('Refresh token has been revoked');
        }
      }

      return this.signToken(payload.sub, payload.email);
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new BadRequestException('Invalid refresh token');
    }
  }

  async signToken(userId: string, email: string | null) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, jti: accessJti },
        {
          expiresIn: '1h',
          secret: this.appConfigService.jwtConfig.secret,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, jti: refreshJti },
        {
          expiresIn: '7d',
          secret: this.appConfigService.jwtConfig.refreshSecret,
        },
      ),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async validateUser(userId: string): Promise<UserEntity | null> {
    return this.userService.findById(userId);
  }

  decodeToken(token: string): any {
    try {
      return this.jwtService.decode(token);
    } catch (error) {
      this.logger.error('Failed to decode token:', error);
      throw new BadRequestException('Invalid token format');
    }
  }

  getTokenExpiration(token: string): Date {
    const payload = this.decodeToken(token);
    if (!payload.exp) {
      throw new BadRequestException('Token has no expiration');
    }
    return new Date(payload.exp * 1000);
  }
}
