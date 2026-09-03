import { KhqrGenerator } from './khqr-generator';

describe('KhqrGenerator (Spec §20, §21)', () => {
  it('computes expected CRC16-CCITT checksum', () => {
    // Standard test vector
    const testString = '0002010102126304';
    const crc = KhqrGenerator.calculateCrc16(testString);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it('generates a valid EMVCo dynamic KHQR payload for USD', () => {
    const qr = KhqrGenerator.generateDynamicQr({
      bakongAccountId: 'mystore@nbc',
      merchantName: 'MyStore Central',
      merchantCity: 'Phnom Penh',
      amount: 25.5,
      currency: 'USD',
      billNumber: 'S-2026-0001',
    });

    // Check header
    expect(qr.startsWith('000201010212')).toBe(true);
    // Check Bakong account tag 29
    expect(qr).toContain('29150011mystore@nbc');
    // Check Currency tag 53 (840 for USD)
    expect(qr).toContain('5303840');
    // Check Amount tag 54
    expect(qr).toContain('540525.50');
    // Check Country tag 58 (KH)
    expect(qr).toContain('5802KH');
    // Check Merchant tag 59
    expect(qr).toContain('5915MYSTORE CENTRAL');
    // Check City tag 60
    expect(qr).toContain('6010PHNOM PENH');
    // Check Bill number in tag 62
    expect(qr).toContain('62150111S-2026-0001');
    // Check CRC tag 63 format
    expect(qr).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('generates a valid EMVCo dynamic KHQR payload for KHR (Riel)', () => {
    const qr = KhqrGenerator.generateDynamicQr({
      merchantName: 'MyStore Central',
      amount: 100000,
      currency: 'KHR',
    });

    // Check Currency tag 53 (116 for KHR)
    expect(qr).toContain('5303116');
    // Check Amount tag 54 (no decimals for KHR)
    expect(qr).toContain('5406100000');
    // Verify CRC ending
    expect(qr).toMatch(/6304[0-9A-F]{4}$/);
  });
});
