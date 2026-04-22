import { DataSource } from 'typeorm';

import TicketEntity from
  '@src/modules/ticket/ticket.entity';

import {
  TicketSeverity,
  TicketStatus,
} from
  '@src/modules/ticket/enums';

export async function seedTickets(
  dataSource: DataSource,
) {
  const repository =
    dataSource.getRepository(
      TicketEntity,
    );

  const items = [
    {
      projectId: 1,
      teamId: 1,
      assigneeUserId: null,
      reporterUserId:
        '11111111-1111-1111-1111-111111111111',
      title: 'Login page bug',
      description:
        'Cannot login with Google',
      status: TicketStatus.OPEN,
      severity:
        TicketSeverity.HIGH,
    },
    {
      projectId: 1,
      teamId: 1,
      assigneeUserId:
        '22222222-2222-2222-2222-222222222222',
      reporterUserId:
        '11111111-1111-1111-1111-111111111111',
      title: 'Fix UI dashboard',
      description:
        'Broken responsive layout',
      status:
        TicketStatus.IN_PROGRESS,
      severity:
        TicketSeverity.MEDIUM,
    },
    {
      projectId: 2,
      teamId: 2,
      assigneeUserId:
        '33333333-3333-3333-3333-333333333333',
      reporterUserId:
        '11111111-1111-1111-1111-111111111111',
      title: 'Payment error',
      description:
        'Stripe webhook failed',
      status:
        TicketStatus.RESOLVED,
      severity:
        TicketSeverity.HIGH,
    },
  ];

  await repository.save(items);
}