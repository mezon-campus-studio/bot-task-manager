import { BadRequestException } from '@nestjs/common';
import {
  createTestingModule,
  factory,
  mockFetchJsonOnce,
  mockedFetch,
  testingModule,
} from '#jest';
import { AuthService } from '@src/modules/auth/auth.service';

describe(AuthService.name, () => {
  beforeAll(createTestingModule);

  it('uses mocked fetch to exchange an oauth code', async () => {
    mockFetchJsonOnce({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 900,
      token_type: 'Bearer',
    });

    const authService = testingModule!.get(AuthService);

    await expect(
      authService.exchangeCode('code-1', 'state-1'),
    ).resolves.toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 900,
      token_type: 'Bearer',
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://oauth.example.test/oauth2/token',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const request = mockedFetch.mock.calls[0]?.[1] as RequestInit;
    const body = request.body as URLSearchParams;

    expect(body.toString()).toBe(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'code-1',
        state: 'state-1',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/auth/callback',
        scope: 'openid offline',
      }).toString(),
    );
  });

  it('fails fast when a third-party oauth call is not successful', async () => {
    mockFetchJsonOnce(
      {
        error: 'invalid_request',
      },
      {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      },
    );

    const authService = testingModule!.get(AuthService);

    await authService.userInfo('bad-token').then(
      () => {
        throw new Error('Expected userInfo to reject for a failed oauth call');
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Failed to fetch user info',
        );
      },
    );
  });

  it('returns the configured oauth url with the expected query params', () => {
    const authService = testingModule!.get(AuthService);

    const oauthUrl = authService.getOauthUrl();
    const parsedUrl = new URL(oauthUrl);

    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe(
      'https://oauth.example.test/oauth2/auth',
    );
    expect(parsedUrl.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/auth/callback',
    );
    expect(parsedUrl.searchParams.get('response_type')).toBe('code');
    expect(parsedUrl.searchParams.get('scope')).toBe('openid offline');
    expect(parsedUrl.searchParams.get('state')).toHaveLength(10);
  });

  it('fetches user info with the encoded access token payload', async () => {
    mockFetchJsonOnce({
      avatar: 'https://avatar.example.test/user.png',
      display_name: 'Sample User',
      email: 'sample.user@example.com',
      user_id: 'user-123',
    });

    const authService = testingModule!.get(AuthService);

    await expect(authService.userInfo('token with spaces/+')).resolves.toEqual({
      avatar: 'https://avatar.example.test/user.png',
      display_name: 'Sample User',
      email: 'sample.user@example.com',
      user_id: 'user-123',
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://oauth.example.test/userinfo',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const request = mockedFetch.mock.calls[0]?.[1] as RequestInit;
    const body = request.body as URLSearchParams;

    expect(body.toString()).toBe(
      new URLSearchParams({
        access_token: encodeURIComponent('token with spaces/+'),
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/auth/callback',
      }).toString(),
    );
  });

  it('rejects refresh requests when no refresh token is provided', async () => {
    const authService = testingModule!.get(AuthService);

    await expect(authService.handleRefreshToken('')).rejects.toThrow(
      'No refresh token provided',
    );
  });

  it('validates a persisted user by mezon id', async () => {
    const authService = testingModule!.get(AuthService);
    const user = await factory.user({
      email: 'auth-validate@example.com',
      mezonId: 'auth-validate-user',
      name: 'Auth Validate User',
    });

    const validatedUser = await authService.validateUser(user.mezonId);

    expect(validatedUser).toMatchObject({
      email: 'auth-validate@example.com',
      mezonId: 'auth-validate-user',
      name: 'Auth Validate User',
    });
  });
});
