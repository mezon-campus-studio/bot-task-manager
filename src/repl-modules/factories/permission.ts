import { randomUUID } from 'node:crypto';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { Factory } from './factory';

export const permission = Factory.forEntity<PermissionEntity>(
  PermissionEntity,
  async (input, repository, _dataSource, _appModule, store) => {
    const generatedKeys = (store.permissionKeys ??= new Set<string>());

    let key = input.key;
    if (!key) {
      do {
        key = `permission-${randomUUID().slice(0, 8)}`;
      } while (generatedKeys.has(key));
    }

    generatedKeys.add(key);

    const existingPermission = await repository.findOne({
      where: { key },
    });

    if (existingPermission != null) {
      return existingPermission;
    }

    return {
      action: input.action ?? 'read',
      description: input.description ?? null,
      key,
      resource: input.resource ?? 'project',
      ...input,
    };
  },
);
