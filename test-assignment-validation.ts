import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketAssignmentValidatorService } from '../src/modules/ticket/ticket-assignment-validator.service';
import { TicketEntity } from '../src/common/database/entities';
import { UserEntity } from '../src/common/database/entities';
import { ProjectEntity } from '../src/common/database/entities';
import { ProjectMemberEntity } from '../src/common/database/entities';

// Mock repositories
const mockTicketRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockUserRepository = {
  findOne: jest.fn(),
};

const mockProjectRepository = {
  findOne: jest.fn(),
};

const mockProjectMemberRepository = {
  findOne: jest.fn(),
};

describe('Ticket Assignment Validation', () => {
  let service: TicketAssignmentValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketAssignmentValidatorService,
        {
          provide: getRepositoryToken(TicketEntity),
          useValue: mockTicketRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(ProjectMemberEntity),
          useValue: mockProjectMemberRepository,
        },
      ],
    }).compile();

    service = module.get<TicketAssignmentValidatorService>(TicketAssignmentValidatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAssignment', () => {
    it('should validate successful assignment', async () => {
      // Mock data
      const projectId = 'project-1';
      const ticketId = 'ticket-1';
      const assigneeUserId = 'user-1';

      mockProjectRepository.findOne.mockResolvedValue({ id: projectId });
      mockTicketRepository.findOne.mockResolvedValue({
        id: ticketId,
        projectId,
        assigneeUserId: null
      });
      mockUserRepository.findOne.mockResolvedValue({ id: assigneeUserId });
      mockProjectMemberRepository.findOne.mockResolvedValue({
        userId: assigneeUserId,
        projectId,
        status: 'ACTIVE'
      });

      const result = await service.validateAssignment(projectId, ticketId, assigneeUserId);

      expect(result.ticket.id).toBe(ticketId);
      expect(result.project.id).toBe(projectId);
      expect(result.isReassignment).toBe(false);
    });

    it('should validate successful reassignment', async () => {
      const projectId = 'project-1';
      const ticketId = 'ticket-1';
      const oldAssigneeId = 'user-1';
      const newAssigneeId = 'user-2';

      mockProjectRepository.findOne.mockResolvedValue({ id: projectId });
      mockTicketRepository.findOne.mockResolvedValue({
        id: ticketId,
        projectId,
        assigneeUserId: oldAssigneeId
      });
      mockUserRepository.findOne.mockResolvedValue({ id: newAssigneeId });
      mockProjectMemberRepository.findOne.mockResolvedValue({
        userId: newAssigneeId,
        projectId,
        status: 'ACTIVE'
      });

      const result = await service.validateAssignment(projectId, ticketId, newAssigneeId);

      expect(result.isReassignment).toBe(true);
      expect(result.oldAssigneeId).toBe(oldAssigneeId);
    });

    it('should throw error for non-existent project', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.validateAssignment('invalid-project', 'ticket-1', 'user-1'))
        .rejects.toThrow('Project invalid-project not found');
    });

    it('should throw error for non-existent ticket', async () => {
      mockProjectRepository.findOne.mockResolvedValue({ id: 'project-1' });
      mockTicketRepository.findOne.mockResolvedValue(null);

      await expect(service.validateAssignment('project-1', 'invalid-ticket', 'user-1'))
        .rejects.toThrow('Ticket #invalid-ticket not found in project project-1');
    });

    it('should throw error for non-existent user', async () => {
      mockProjectRepository.findOne.mockResolvedValue({ id: 'project-1' });
      mockTicketRepository.findOne.mockResolvedValue({
        id: 'ticket-1',
        projectId: 'project-1'
      });
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.validateAssignment('project-1', 'ticket-1', 'invalid-user'))
        .rejects.toThrow('User invalid-user not found');
    });

    it('should throw error for user not in project', async () => {
      mockProjectRepository.findOne.mockResolvedValue({ id: 'project-1' });
      mockTicketRepository.findOne.mockResolvedValue({
        id: 'ticket-1',
        projectId: 'project-1'
      });
      mockUserRepository.findOne.mockResolvedValue({ id: 'user-1' });
      mockProjectMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.validateAssignment('project-1', 'ticket-1', 'user-1'))
        .rejects.toThrow('User user-1 is not a member of project project-1');
    });

    it('should throw error for inactive project member', async () => {
      mockProjectRepository.findOne.mockResolvedValue({ id: 'project-1' });
      mockTicketRepository.findOne.mockResolvedValue({
        id: 'ticket-1',
        projectId: 'project-1'
      });
      mockUserRepository.findOne.mockResolvedValue({ id: 'user-1' });
      mockProjectMemberRepository.findOne.mockResolvedValue({
        userId: 'user-1',
        projectId: 'project-1',
        status: 'INACTIVE'
      });

      await expect(service.validateAssignment('project-1', 'ticket-1', 'user-1'))
        .rejects.toThrow('User user-1 is not a member of project project-1');
    });
  });
});