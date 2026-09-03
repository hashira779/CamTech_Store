import type {
  WorkflowStatus,
  WorkflowStepStatus,
} from '@mystore/contracts';

export interface WorkflowStepState {
  id: string;
  stepOrder: number;
  name: string;
  status: WorkflowStepStatus;
  decisionBy?: string | null;
  decisionAt?: Date | null;
  comment?: string | null;
}

export interface WorkflowInstanceState {
  id: string;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  steps: WorkflowStepState[];
}

export class WorkflowStateMachine {
  /**
   * Applies a review decision (APPROVE | REJECT) to the current step.
   * Returns updated instance status, new current step, and updated steps.
   */
  static applyDecision(
    instance: WorkflowInstanceState,
    stepId: string,
    action: 'APPROVE' | 'REJECT',
    reviewerId: string,
    comment?: string,
  ): {
    instanceStatus: WorkflowStatus;
    currentStep: number;
    updatedSteps: WorkflowStepState[];
  } {
    if (instance.status !== 'PENDING') {
      throw new Error(`Cannot review workflow in ${instance.status} state`);
    }

    const targetStep = instance.steps.find((s) => s.id === stepId);
    if (!targetStep) {
      throw new Error(`Workflow step ${stepId} not found in instance`);
    }

    if (targetStep.status !== 'PENDING') {
      throw new Error(`Workflow step is already ${targetStep.status}`);
    }

    const now = new Date();
    const updatedSteps = instance.steps.map((s) => {
      if (s.id === stepId) {
        return {
          ...s,
          status: (action === 'APPROVE' ? 'APPROVED' : 'REJECTED') as WorkflowStepStatus,
          decisionBy: reviewerId,
          decisionAt: now,
          comment: comment || null,
        };
      }
      return s;
    });

    if (action === 'REJECT') {
      // Rejection immediately marks the whole workflow as REJECTED
      return {
        instanceStatus: 'REJECTED',
        currentStep: instance.currentStep,
        updatedSteps,
      };
    }

    // Check if there are further pending steps
    const pendingSteps = updatedSteps.filter((s) => s.status === 'PENDING');
    if (pendingSteps.length === 0) {
      // All steps approved!
      return {
        instanceStatus: 'APPROVED',
        currentStep: instance.totalSteps,
        updatedSteps,
      };
    }

    // Advance to next step order
    const nextStep = pendingSteps.sort((a, b) => a.stepOrder - b.stepOrder)[0];
    return {
      instanceStatus: 'PENDING',
      currentStep: nextStep.stepOrder,
      updatedSteps,
    };
  }
}
