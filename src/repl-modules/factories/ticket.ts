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

    return {
      ...input,
      assigneeUserId: input.assigneeUserId ?? null,
      description: input.description ?? null,
      projectId,
      reporterUserId,
      severity: input.severity ?? TicketSeverity.MEDIUM,
      status: input.status ?? TicketStatus.OPEN,
      teamId: input.teamId ?? null,
      title: input.title ?? 'Campus ticket',
    };
  },
);
