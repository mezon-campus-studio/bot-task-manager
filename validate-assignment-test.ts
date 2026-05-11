// Simple validation test script
// Test the assignment validation logic without full DB setup

interface MockEntity {
  id: string | number;
  name?: string;
  title?: string;
  projectId?: number;
  assigneeUserId?: string | null;
  userId?: string;
  status?: string;
}

class MockRepository<T extends MockEntity> {
  private data: T[] = [];

  constructor(initialData: T[] = []) {
    this.data = initialData;
  }

  async findOne(options: { where: Partial<T> }): Promise<T | null> {
    const { where } = options;
    return this.data.find(item =>
      Object.entries(where).every(([key, value]) => item[key as keyof T] === value)
    ) || null;
  }

  add(item: T) {
    this.data.push(item);
  }
}

// Mock data
const projects = new MockRepository([
  { id: 1, name: 'Project Alpha' },
  { id: 2, name: 'Project Beta' }
]);

const tickets = new MockRepository([
  { id: 1, title: 'Fix login bug', projectId: 1, assigneeUserId: null },
  { id: 2, title: 'Add new feature', projectId: 1, assigneeUserId: 'user-1' },
  { id: 3, title: 'Update docs', projectId: 2, assigneeUserId: null }
]);

const users = new MockRepository([
  { id: 'user-1', name: 'John Doe' },
  { id: 'user-2', name: 'Jane Smith' },
  { id: 'user-3', name: 'Bob Wilson' }
]);

const projectMembers = new MockRepository([
  { id: 1, projectId: 1, userId: 'user-1', status: 'ACTIVE' },
  { id: 2, projectId: 1, userId: 'user-2', status: 'ACTIVE' },
  { id: 3, projectId: 2, userId: 'user-3', status: 'ACTIVE' },
  { id: 4, projectId: 1, userId: 'user-3', status: 'INACTIVE' } // Inactive member
]);

// Validation functions
async function validateProjectExists(projectId: number) {
  const project = await projects.findOne({ where: { id: projectId } });
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  return project;
}

async function validateTicketExists(projectId: number, ticketId: number) {
  const ticket = await tickets.findOne({ where: { id: ticketId, projectId } });
  if (!ticket) {
    throw new Error(`Ticket #${ticketId} not found in project ${projectId}`);
  }
  return ticket;
}

async function validateUserExists(userId: string) {
  const user = await users.findOne({ where: { id: userId } });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return user;
}

async function validateProjectMembership(projectId: number, userId: string) {
  const member = await projectMembers.findOne({ where: { projectId, userId } });
  if (!member || member.status !== 'ACTIVE') {
    throw new Error(`User ${userId} is not a member of project ${projectId}`);
  }
  return member;
}

async function validateAssignment(projectId: number, ticketId: number, assigneeUserId: string) {
  console.log(`🔍 Validating assignment: project=${projectId}, ticket=${ticketId}, user=${assigneeUserId}`);

  // 1. Check project exists
  const project = await validateProjectExists(projectId);
  console.log(`✅ Project exists: ${project.name}`);

  // 2. Check ticket exists in project
  const ticket = await validateTicketExists(projectId, ticketId);
  console.log(`✅ Ticket exists: ${ticket.title}`);

  // 3. Check user exists
  const user = await validateUserExists(assigneeUserId);
  console.log(`✅ User exists: ${user.name}`);

  // 4. Check user is active member of project
  const member = await validateProjectMembership(projectId, assigneeUserId);
  console.log(`✅ User is active project member`);

  // 5. Check if reassignment
  const isReassignment = ticket.assigneeUserId !== null && ticket.assigneeUserId !== assigneeUserId;
  console.log(`ℹ️  Is reassignment: ${isReassignment}`);

  return { project, ticket, user, member, isReassignment };
}

// Test cases
async function runTests() {
  console.log('🧪 Running Assignment Validation Tests\n');

  const testCases = [
    {
      name: '✅ Valid assignment (new assignment)',
      projectId: 1,
      ticketId: 1,
      userId: 'user-1',
      expectSuccess: true
    },
    {
      name: '✅ Valid reassignment',
      projectId: 1,
      ticketId: 2,
      userId: 'user-2',
      expectSuccess: true
    },
    {
      name: '❌ Invalid project',
      projectId: 999,
      ticketId: 1,
      userId: 'user-1',
      expectSuccess: false
    },
    {
      name: '❌ Ticket not in project',
      projectId: 2,
      ticketId: 1,
      userId: 'user-3',
      expectSuccess: false
    },
    {
      name: '❌ User not found',
      projectId: 1,
      ticketId: 1,
      userId: 'user-999',
      expectSuccess: false
    },
    {
      name: '❌ User not project member',
      projectId: 2,
      ticketId: 3,
      userId: 'user-1',
      expectSuccess: false
    },
    {
      name: '❌ User inactive in project',
      projectId: 1,
      ticketId: 1,
      userId: 'user-3',
      expectSuccess: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    try {
      await validateAssignment(
        testCase.projectId,
        testCase.ticketId,
        testCase.userId
      );
      if (testCase.expectSuccess) {
        console.log('✅ PASSED');
      } else {
        console.log('❌ FAILED - Expected error but got success');
      }
    } catch (error) {
      if (!testCase.expectSuccess) {
        console.log(`✅ PASSED - Expected error: ${error.message}`);
      } else {
        console.log(`❌ FAILED - Unexpected error: ${error.message}`);
      }
    }
  }

  console.log('\n🎉 Test completed!');
}

// Run tests
runTests().catch(console.error);