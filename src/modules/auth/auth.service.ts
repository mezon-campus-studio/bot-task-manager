import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '@src/common/shared/services/app-config.service';
import UserEntity from '@src/modules/user/user.entity';
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

  constructor(
    private appConfigService: AppConfigService,
    private userService: UserService,
    private jwtService: JwtService,
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

  getOauthUrl(): string {
    const oauthConfig = this.appConfigService.oauthConfig;
    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      response_type: 'code',
      scope: 'openid offline',
      state: crypto.randomUUID().substring(0, 10),
    });

    return `${oauthConfig.baseUri}/oauth2/auth?${params.toString()}`;
  }

  async handleOAuthExchange(code: string, state: string): Promise<any> {
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
    // Simple implementation for now: verify and resign
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.appConfigService.jwtConfig.refreshSecret,
      });
      return this.signToken(payload.sub, payload.email);
    } catch (e) {
      throw new BadRequestException('Invalid refresh token');
    }
  }

  async signToken(userId: string, email: string | null) {
    const payload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '1h',
        secret: this.appConfigService.jwtConfig.secret,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: this.appConfigService.jwtConfig.refreshSecret,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async validateUser(userId: string): Promise<UserEntity | null> {
    return this.userService.findById(userId);
  }
}
