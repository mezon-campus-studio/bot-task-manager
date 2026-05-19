import { ClsServiceManager } from 'nestjs-cls';
import { UserAuth } from '../types/api.types';

export class ContextProvider {
  private static readonly nameSpace = 'request';

  private static readonly authUserKey = 'user_key';

  private static readonly currentProjectIdKey = 'current_project_id_key';

  private static readonly languageKey = 'language_key';

  private static get<T>(key: string) {
    const store = ClsServiceManager.getClsService();

    return store.get<T>(ContextProvider.getKeyWithNamespace(key));
  }

  private static set(key: string, value: any): void {
    const store = ClsServiceManager.getClsService();

    store.set(ContextProvider.getKeyWithNamespace(key), value);
  }

  private static getKeyWithNamespace(key: string): string {
    return `${ContextProvider.nameSpace}.${key}`;
  }

  static setAuthUser(user: UserAuth): void {
    ContextProvider.set(ContextProvider.authUserKey, user);
    ContextProvider.setCurrentProjectId(user?.currentProjectId ?? null);
  }

  static getAuthUser(): UserAuth | undefined {
    return ContextProvider.get<UserAuth>(ContextProvider.authUserKey);
  }

  static setCurrentProjectId(currentProjectId: number | null): void {
    ContextProvider.set(ContextProvider.currentProjectIdKey, currentProjectId);
  }

  static getCurrentProjectId(): number | null | undefined {
    return ContextProvider.get<number | null>(
      ContextProvider.currentProjectIdKey,
    );
  }

  static setLanguage(language: string): void {
    ContextProvider.set(ContextProvider.languageKey, language);
  }
}
