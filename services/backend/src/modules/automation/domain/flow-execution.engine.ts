import type {
  FlowNode,
  FlowEdge,
  NodeExecutionTraceDto,
  FlowNodeSubtype,
} from '@mystore/contracts';

export interface FlowActionDispatcher {
  dispatchAction(
    subtype: FlowNodeSubtype,
    parameters: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>>;
}

export interface FlowExecutionResult {
  status: 'SUCCESS' | 'FAILED';
  executionTrace: NodeExecutionTraceDto[];
  output: Record<string, any>;
  error?: string;
}

export class FlowExecutionEngine {
  /**
   * Executes a directed flow graph starting from the trigger node.
   */
  static async execute(
    nodes: FlowNode[],
    edges: FlowEdge[],
    initialPayload: Record<string, any>,
    dispatcher?: FlowActionDispatcher,
  ): Promise<FlowExecutionResult> {
    const trace: NodeExecutionTraceDto[] = [];
    const context: Record<string, any> = {
      trigger: { ...initialPayload },
      $json: { ...initialPayload },
      steps: {},
    };

    // 1. Locate the Trigger node
    const triggerNode = nodes.find((n) => n.type === 'TRIGGER');
    if (!triggerNode) {
      return {
        status: 'FAILED',
        executionTrace: trace,
        output: {},
        error: 'Flow contains no TRIGGER node',
      };
    }

    let currentNode: FlowNode | undefined = triggerNode;
    let currentInput = { ...initialPayload };
    const MAX_STEPS = 50;

    while (currentNode) {
      if (trace.length >= MAX_STEPS) {
        return {
          status: 'FAILED',
          executionTrace: trace,
          output: context.$json,
          error: `Execution halted: Maximum step limit (${MAX_STEPS}) exceeded (potential cyclic graph)`,
        };
      }

      const startTime = Date.now();
      const node: FlowNode = currentNode;
      let nodeOutput: Record<string, any> = {};
      let nodeError: string | null = null;
      let branchHandle: 'true' | 'false' | 'default' = 'default';

      try {
        switch (node.type) {
          case 'TRIGGER':
            nodeOutput = { ...currentInput, triggeredAt: new Date().toISOString() };
            break;

          case 'CONDITION':
            if (node.subtype === 'if_condition') {
              const { field, operator, value } = node.parameters;
              const resolvedLeft = this.resolveValue(field, context);
              const isMatch = this.evaluateCondition(resolvedLeft, operator, value);
              branchHandle = isMatch ? 'true' : 'false';
              nodeOutput = {
                conditionMet: isMatch,
                fieldEvaluated: field,
                value: resolvedLeft,
                branch: branchHandle,
              };
            }
            break;

          case 'TRANSFORM':
            if (node.subtype === 'json_mapper') {
              const mapping = node.parameters?.mapping || {};
              const mapped: Record<string, any> = {};
              for (const [key, expr] of Object.entries(mapping)) {
                mapped[key] = this.resolveValue(expr as string, context);
              }
              nodeOutput = mapped;
            } else {
              nodeOutput = { ...currentInput, transformed: true };
            }
            break;

          case 'ACTION':
            const interpolatedParams = this.interpolateObject(node.parameters, context);
            if (dispatcher) {
              nodeOutput = await dispatcher.dispatchAction(node.subtype, interpolatedParams, context);
            } else {
              // Simulated action execution
              nodeOutput = {
                executed: true,
                subtype: node.subtype,
                params: interpolatedParams,
              };
            }
            break;

          default:
            nodeOutput = { ...currentInput };
        }
      } catch (err: any) {
        nodeError = err.message || 'Node execution failed';
      }

      const durationMs = Math.max(1, Date.now() - startTime);
      const isNodeFailed = Boolean(nodeError);

      trace.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        subtype: node.subtype,
        status: isNodeFailed ? 'FAILED' : 'SUCCESS',
        inputData: currentInput,
        outputData: isNodeFailed ? null : nodeOutput,
        errorMessage: nodeError,
        durationMs,
      });

      if (isNodeFailed) {
        return {
          status: 'FAILED',
          executionTrace: trace,
          output: context.$json,
          error: nodeError || undefined,
        };
      }

      // Update execution context
      context.steps[node.id] = { output: nodeOutput };
      context.$json = { ...context.$json, ...nodeOutput };
      currentInput = { ...nodeOutput };

      // Determine next node
      const matchingEdges = edges.filter((e) => e.sourceNodeId === node.id);
      let nextEdge: FlowEdge | undefined;

      if (node.type === 'CONDITION') {
        // Find edge specifically labeled with branch outcome ('true' or 'false')
        nextEdge = matchingEdges.find((e) => e.sourceHandle === branchHandle) || matchingEdges[0];
      } else {
        nextEdge = matchingEdges[0];
      }

      currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge!.targetNodeId) : undefined;
    }

    return {
      status: 'SUCCESS',
      executionTrace: trace,
      output: context.$json,
    };
  }

  /**
   * Resolves template values like {{trigger.orderId}} or literal values.
   */
  static resolveValue(expression: string | any, context: Record<string, any>): any {
    if (typeof expression !== 'string') return expression;
    const match = expression.match(/^\{\{([\w$.]+)\}\}$/);
    if (!match) return expression;

    const path = match[1].split('.');
    let curr: any = context;
    for (const seg of path) {
      if (curr == null) return undefined;
      curr = curr[seg];
    }
    return curr;
  }

  /**
   * Interpolates all string values in an object with context parameters.
   */
  static interpolateObject(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (typeof v === 'string') {
        res[k] = v.replace(/\{\{([\w$.]+)\}\}/g, (_, key) => {
          const resolved = this.resolveValue(`{{${key}}}`, context);
          return resolved !== undefined ? String(resolved) : '';
        });
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        res[k] = this.interpolateObject(v, context);
      } else {
        res[k] = v;
      }
    }
    return res;
  }

  /**
   * Evaluates standard boolean conditions.
   */
  static evaluateCondition(left: any, operator: string, right: any): boolean {
    switch (operator) {
      case 'EQUALS':
        return String(left) === String(right);
      case 'NOT_EQUALS':
        return String(left) !== String(right);
      case 'GREATER_THAN':
        return Number(left) > Number(right);
      case 'LESS_THAN':
        return Number(left) < Number(right);
      case 'CONTAINS':
        return String(left).toLowerCase().includes(String(right).toLowerCase());
      default:
        return Boolean(left);
    }
  }
}
