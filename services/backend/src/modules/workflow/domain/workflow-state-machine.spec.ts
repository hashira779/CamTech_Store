import { WorkflowStateMachine, type WorkflowInstanceState } from './workflow-state-machine';

describe('WorkflowStateMachine', () => {
  const initialInstance: WorkflowInstanceState = {
    id: 'wf_1',
    status: 'PENDING',
    currentStep: 1,
    totalSteps: 2,
    steps: [
      { id: 's1', stepOrder: 1, name: 'Manager Approval', status: 'PENDING' },
      { id: 's2', stepOrder: 2, name: 'Finance Review', status: 'PENDING' },
    ],
  };

  it('advances currentStep when Step 1 is approved', () => {
    const res = WorkflowStateMachine.applyDecision(
      initialInstance,
      's1',
      'APPROVE',
      'user_mgr',
      'Looks good',
    );

    expect(res.instanceStatus).toBe('PENDING');
    expect(res.currentStep).toBe(2);
    expect(res.updatedSteps[0].status).toBe('APPROVED');
    expect(res.updatedSteps[0].decisionBy).toBe('user_mgr');
  });

  it('marks workflow as APPROVED when the final step is approved', () => {
    const midInstance: WorkflowInstanceState = {
      ...initialInstance,
      currentStep: 2,
      steps: [
        { id: 's1', stepOrder: 1, name: 'Manager Approval', status: 'APPROVED' },
        { id: 's2', stepOrder: 2, name: 'Finance Review', status: 'PENDING' },
      ],
    };

    const res = WorkflowStateMachine.applyDecision(
      midInstance,
      's2',
      'APPROVE',
      'user_fin',
      'Payment verified',
    );

    expect(res.instanceStatus).toBe('APPROVED');
    expect(res.updatedSteps[1].status).toBe('APPROVED');
  });

  it('immediately marks workflow as REJECTED when any step is rejected', () => {
    const res = WorkflowStateMachine.applyDecision(
      initialInstance,
      's1',
      'REJECT',
      'user_mgr',
      'Budget exceeded',
    );

    expect(res.instanceStatus).toBe('REJECTED');
    expect(res.updatedSteps[0].status).toBe('REJECTED');
  });
});
