import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      workflowInstance: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      workflowStep: {
        create: jest.fn(),
        update: jest.fn(),
      },
      workflowLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new WorkflowService(mockPrisma, mockAudit);
  });

  it('submits a new workflow approval request with sequential steps', async () => {
    const fakeCreated = {
      id: 'inst_1',
      organizationId: 'org_1',
      entityType: 'PURCHASE_ORDER',
      entityId: 'po_123',
      title: 'Approve PO #123',
      status: 'PENDING',
      submittedById: 'user_1',
      currentStep: 1,
      totalSteps: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        { id: 's1', instanceId: 'inst_1', stepOrder: 1, name: 'Manager Review', status: 'PENDING' },
        { id: 's2', instanceId: 'inst_1', stepOrder: 2, name: 'Executive Approval', status: 'PENDING' },
      ],
      logs: [],
    };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        workflowInstance: {
          create: jest.fn().mockResolvedValue({ id: 'inst_1' }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(fakeCreated),
        },
        workflowStep: { create: jest.fn() },
        workflowLog: { create: jest.fn() },
      };
      return cb(tx);
    });

    const res = await service.submitApproval(
      'org_1',
      {
        entityType: 'PURCHASE_ORDER',
        entityId: 'po_123',
        title: 'Approve PO #123',
      },
      'user_1',
    );

    expect(res.id).toBe('inst_1');
    expect(res.status).toBe('PENDING');
    expect(res.steps).toHaveLength(2);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WORKFLOW_SUBMITTED' }),
    );
  });
});
