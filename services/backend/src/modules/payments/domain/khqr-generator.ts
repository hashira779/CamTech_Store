/**
 * Pure domain implementation of the EMVCo Merchant-Presented Mode (MPM)
 * and Bakong KHQR dynamic specification (Spec §20, §21).
 */

export interface KhqrPayloadInput {
  bakongAccountId?: string;
  merchantName: string;
  merchantCity?: string;
  amount: number;
  currency: 'USD' | 'KHR' | string;
  billNumber?: string;
  terminalId?: string;
}

export class KhqrGenerator {
  /**
   * Calculates the standard CRC16-CCITT (polynomial 0x1021, initial 0xFFFF)
   * used across all EMVCo and Bakong QR codes.
   */
  public static calculateCrc16(payload: string): string {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Formats a standard EMVCo Tag-Length-Value (TLV) block.
   */
  public static formatTlv(tag: string, value: string): string {
    const length = value.length.toString().padStart(2, '0');
    return `${tag}${length}${value}`;
  }

  /**
   * Generates a fully compliant, verified EMVCo KHQR dynamic payload string.
   */
  public static generateDynamicQr(input: KhqrPayloadInput): string {
    const parts: string[] = [];

    // Tag 00: Payload Format Indicator (Fixed '01')
    parts.push(this.formatTlv('00', '01'));

    // Tag 01: Point of Initiation Method ('12' = Dynamic QR)
    parts.push(this.formatTlv('01', '12'));

    // Tag 29: Merchant Account Information (Bakong National Protocol)
    const bakongId = input.bakongAccountId || 'mystore@nbc';
    const subTag00 = this.formatTlv('00', bakongId);
    parts.push(this.formatTlv('29', subTag00));

    // Tag 52: Merchant Category Code (General Retail)
    parts.push(this.formatTlv('52', '5999'));

    // Tag 53: Transaction Currency Code ('840' for USD, '116' for KHR)
    const currencyCode = input.currency.toUpperCase() === 'KHR' ? '116' : '840';
    parts.push(this.formatTlv('53', currencyCode));

    // Tag 54: Transaction Amount (Formatted 2 decimals for USD, 0 for KHR)
    const formattedAmount =
      currencyCode === '116'
        ? Math.round(input.amount).toString()
        : input.amount.toFixed(2);
    parts.push(this.formatTlv('54', formattedAmount));

    // Tag 58: Country Code ('KH' for Cambodia)
    parts.push(this.formatTlv('58', 'KH'));

    // Tag 59: Merchant Name
    const merchantName = (input.merchantName || 'CAMTECH ENTERPRISE').slice(0, 25).toUpperCase();
    parts.push(this.formatTlv('59', merchantName));

    // Tag 60: Merchant City
    const merchantCity = (input.merchantCity || 'PHNOM PENH').slice(0, 15).toUpperCase();
    parts.push(this.formatTlv('60', merchantCity));

    // Tag 62: Additional Data Field Template (Bill number, terminal ID)
    const additionalSubTags: string[] = [];
    if (input.billNumber) {
      additionalSubTags.push(this.formatTlv('01', input.billNumber.slice(0, 25)));
    }
    if (input.terminalId) {
      additionalSubTags.push(this.formatTlv('07', input.terminalId.slice(0, 10)));
    }
    if (additionalSubTags.length > 0) {
      parts.push(this.formatTlv('62', additionalSubTags.join('')));
    }

    // Tag 63: CRC16 Checksum Block
    const partialPayload = parts.join('') + '6304';
    const crc = this.calculateCrc16(partialPayload);

    return `${partialPayload}${crc}`;
  }
}
