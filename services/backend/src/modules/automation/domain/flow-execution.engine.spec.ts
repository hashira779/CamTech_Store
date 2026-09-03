import { FlowExecutionEngine } from './flow-execution.engine';
import type { FlowNode, FlowEdge } from '@mystore/contracts';

describe('FlowExecutionEngine', () => {
  it('executes a linear flow (Trigger -> Action) and records trace', async () => {
    const nodes: FlowNode[] = [
      {
        id: 'node_1',
        name: 'Manual Run',
        type: 'TRIGGER',
        subtype: 'manual_trigger',
        parameters: {},
        position: { x: 0, y: 0 },
      },
      {
        id: 'node_2',
        name: 'Dispatch Webhook',
        type: 'ACTION',
        subtype: 'http_request',
        parameters: { url: 'https://api.example.com/notify', message: 'Order {{trigger.orderId}}' },
        position: { x: 200, y: 0 },
      },
    ];

    const edges: FlowEdge[] = [
      { id: 'e1', sourceNodeId: 'node_1', targetNodeId: 'node_2' },
    ];

    const res = await FlowExecutionEngine.execute(nodes, edges, { orderId: 'ORD-9999' });

    expect(res.status).toBe('SUCCESS');
    expect(res.executionTrace).toHaveLength(2);
    expect(res.executionTrace[0].nodeId).toBe('node_1');
    expect(res.executionTrace[1].nodeId).toBe('node_2');
    expect(res.executionTrace[1].outputData?.params?.message).toBe('Order ORD-9999');
  });

  it('correctly branches through condition node (true vs false handle)', async () => {
    const nodes: FlowNode[] = [
      {
        id: 'node_trigger',
        name: 'Order Placed',
        type: 'TRIGGER',
        subtype: 'event_order_created',
        parameters: {},
        position: { x: 0, y: 0 },
      },
      {
        id: 'node_condition',
        name: 'Check High Value',
        type: 'CONDITION',
        subtype: 'if_condition',
        parameters: {
          field: '{{trigger.amount}}',
          operator: 'GREATER_THAN',
          value: 100,
        },
        position: { x: 200, y: 0 },
      },
      {
        id: 'node_vip_action',
        name: 'VIP Manager Telegram Alert',
        type: 'ACTION',
        subtype: 'send_telegram',
        parameters: { text: 'High value order: ${{trigger.amount}}' },
        position: { x: 400, y: -100 },
      },
      {
        id: 'node_regular_action',
        name: 'Standard Ticket',
        type: 'ACTION',
        subtype: 'create_ticket',
        parameters: { title: 'Standard order' },
        position: { x: 400, y: 100 },
      },
    ];

    const edges: FlowEdge[] = [
      { id: 'e_trig', sourceNodeId: 'node_trigger', targetNodeId: 'node_condition' },
      { id: 'e_true', sourceNodeId: 'node_condition', targetNodeId: 'node_vip_action', sourceHandle: 'true' },
      { id: 'e_false', sourceNodeId: 'node_condition', targetNodeId: 'node_regular_action', sourceHandle: 'false' },
    ];

    // Run 1: Amount = 250 (> 100) -> should run VIP action
    const resHigh = await FlowExecutionEngine.execute(nodes, edges, { amount: 250 });
    expect(resHigh.status).toBe('SUCCESS');
    expect(resHigh.executionTrace).toHaveLength(3);
    expect(resHigh.executionTrace[2].nodeId).toBe('node_vip_action');

    // Run 2: Amount = 50 (<= 100) -> should run Regular action
    const resLow = await FlowExecutionEngine.execute(nodes, edges, { amount: 50 });
    expect(resLow.status).toBe('SUCCESS');
    expect(resLow.executionTrace).toHaveLength(3);
    expect(resLow.executionTrace[2].nodeId).toBe('node_regular_action');
  });

  it('fails gracefully when flow has no trigger node', async () => {
    const res = await FlowExecutionEngine.execute([], [], {});
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('TRIGGER');
  });

  it('detects cyclic infinite loops and halts execution safely', async () => {
    const nodes: FlowNode[] = [
      {
        id: 'n_trig',
        name: 'Start',
        type: 'TRIGGER',
        subtype: 'manual_trigger',
        parameters: {},
        position: { x: 0, y: 0 },
      },
      {
        id: 'n_loop1',
        name: 'Loop 1',
        type: 'TRANSFORM',
        subtype: 'json_mapper',
        parameters: {},
        position: { x: 100, y: 0 },
      },
      {
        id: 'n_loop2',
        name: 'Loop 2',
        type: 'TRANSFORM',
        subtype: 'json_mapper',
        parameters: {},
        position: { x: 200, y: 0 },
      },
    ];

    // Create an infinite loop: n_trig -> n_loop1 -> n_loop2 -> n_loop1
    const edges: FlowEdge[] = [
      { id: 'e1', sourceNodeId: 'n_trig', targetNodeId: 'n_loop1' },
      { id: 'e2', sourceNodeId: 'n_loop1', targetNodeId: 'n_loop2' },
      { id: 'e3', sourceNodeId: 'n_loop2', targetNodeId: 'n_loop1' },
    ];

    const res = await FlowExecutionEngine.execute(nodes, edges, {});
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('potential cyclic graph');
    expect(res.executionTrace.length).toBe(50);
  });
});

