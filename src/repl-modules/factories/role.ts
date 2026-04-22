import { randomUUID } from 'node:crypto';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import RoleEntity from '@src/modules/role/role.entity';
import { Factory } from './factory';

export const role = Factory.forEntity<RoleEntity>(
  RoleEntity,
  async (input, repository, _dataSource, _appModule, store) => {
    const generatedKeys = (store.roleKeys ??= new Set<string>());

    let key = input.key;
    if (!key) {
      do {
        key = `role-${randomUUID().slice(0, 8)}`;
      } while (generatedKeys.has(key));
    }

    generatedKeys.add(key);

    const existingRole = await repository.findOne({
      where: { key },
    });

    if (existingRole != null) {
      return existingRole;
    }

    return {
      description: input.description ?? null,
      isSystem: input.isSystem ?? false,
      key,
      name: input.name ?? key.replace(/-/g, ' '),
      scopeType: input.scopeType ?? RoleScopeType.PROJECT,
      ...input,
    };
  },
);
