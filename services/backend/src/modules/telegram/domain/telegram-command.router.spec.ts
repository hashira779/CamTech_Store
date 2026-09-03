import { TelegramCommandRouter, type TelegramCommandContext } from './telegram-command.router';

describe('TelegramCommandRouter', () => {
  const dummyCtx: TelegramCommandContext = {
    organizationName: 'CamTech Retail HQ',
    todaySalesTotal: 1540.5,
    todaySalesCount: 42,
    lowStockItemsCount: 3,
    topDepletedItemNames: ['USB Barcode Scanner', 'Thermal Receipt Paper'],
    pendingApprovalsCount: 2,
  };

  it('handles /sales command with revenue and transaction count', () => {
    const res = TelegramCommandRouter.handleCommand('/sales', dummyCtx);
    expect(res).toContain('Sales Performance Summary');
    expect(res).toContain('$1540.50');
    expect(res).toContain('42');
  });

  it('handles /stock command with low stock count and item list', () => {
    const res = TelegramCommandRouter.handleCommand('/stock', dummyCtx);
    expect(res).toContain('Inventory Health Report');
    expect(res).toContain('3');
    expect(res).toContain('USB Barcode Scanner');
  });

  it('handles /approve command with provided argument', () => {
    const res = TelegramCommandRouter.handleCommand('/approve wf_999', dummyCtx);
    expect(res).toContain('Approval submitted for workflow instance `wf_999`');
  });

  it('displays warning when /approve is called without argument', () => {
    const res = TelegramCommandRouter.handleCommand('/approve', dummyCtx);
    expect(res).toContain('Missing ID');
  });

  it('handles /help and displays command directory', () => {
    const res = TelegramCommandRouter.handleCommand('/help', dummyCtx);
    expect(res).toContain('/sales');
    expect(res).toContain('/stock');
    expect(res).toContain('/orders');
  });
});
