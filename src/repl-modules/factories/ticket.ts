import { TicketSeverity, TicketStatus } from '@src/modules/ticket/enums';
import TicketEntity from '@src/modules/ticket/ticket.entity';
import { Factory } from './factory';
import { project } from './project';
import { user } from './user';

export const ticket = Factory.forEntity<TicketEntity>(
  TicketEntity,
  async (input) => {
    const projectId = input.projectId ?? (await project({})).id;

    const reporterUserId = input.reporterUserId ?? (await user({})).id;

    const ensuredReporterUser =
      input.reporterUserId == null
        ? null
        : await user({ id: input.reporterUserId }).catch(() => null);

    const ensuredReporterUserId = ensuredReporterUser?.id ?? reporterUserId;

    const ensuredAssigneeUser =
      input.assigneeUserId == null
        ? null
        : await user({ id: input.assigneeUserId }).catch(() => null);

    return {
      ...input,
      assigneeUserId: ensuredAssigneeUser?.id ?? null,
      description: input.description ?? null,
      projectId,
      reporterUserId: ensuredReporterUserId,
      severity: input.severity ?? TicketSeverity.MEDIUM,
      status: input.status ?? TicketStatus.OPEN,
      teamId: input.teamId ?? null,
      title: input.title ?? 'Campus ticket',
    };
  },
);
