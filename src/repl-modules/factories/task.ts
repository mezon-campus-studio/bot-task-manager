import { TaskPriority, TaskStatus } from '@src/modules/task/enums';
import TaskEntity from '@src/modules/task/task.entity';
import { Factory } from './factory';
import { project } from './project';
import { user } from './user';

export const task = Factory.forEntity<TaskEntity>(TaskEntity, async (input) => {
  const projectId = input.projectId ?? (await project({})).id;
  const reporterUserId = input.reporterUserId ?? (await user({})).id;
  const assigneeUserId = input.assigneeUserId ?? null;

  return {
    ...input,
    assigneeUserId,
    description: input.description ?? null,
    dueAt: input.dueAt ?? null,
    priority: input.priority ?? TaskPriority.MEDIUM,
    projectId,
    reporterUserId,
    status: input.status ?? TaskStatus.TODO,
    teamId: input.teamId ?? null,
    title: input.title ?? 'Campus task',
  };
});
