import type {
  AccountType,
  JournalEntryStatus,
  JournalSourceType,
} from '@mystore/contracts';

export interface JournalLineItemProps {
  id?: string;
  accountId: string;
  debit: number;
  credit: number;
  memo?: string | null;
}

export interface JournalEntryProps {
  id?: string;
  organizationId: string;
  entryNumber: string;
  postingDate: Date;
  sourceType: JournalSourceType;
  sourceId?: string | null;
  description: string;
  status: JournalEntryStatus;
  periodId?: string | null;
  lines: JournalLineItemProps[];
}

export class JournalEntryEntity {
  private readonly props: JournalEntryProps;

  constructor(props: JournalEntryProps) {
    this.validate(props);
    this.props = { ...props };
  }

  static create(
    data: Omit<JournalEntryProps, 'status'> & { status?: JournalEntryStatus },
  ): JournalEntryEntity {
    return new JournalEntryEntity({
      ...data,
      status: data.status ?? 'DRAFT',
    });
  }

  private validate(props: JournalEntryProps): void {
    if (!props.organizationId) {
      throw new Error('Journal entry must belong to an organization');
    }
    if (!props.description || props.description.trim().length === 0) {
      throw new Error('Journal entry requires a non-empty description');
    }
    if (!props.lines || props.lines.length < 2) {
      throw new Error('Journal entry must contain at least two line items (debit & credit)');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of props.lines) {
      if (!line.accountId) {
        throw new Error('Every journal line must specify a valid accountId');
      }
      if (line.debit < 0 || line.credit < 0) {
        throw new Error('Debit and credit amounts cannot be negative');
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error('A single line item cannot contain both debit and credit amounts');
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new Error('A line item must specify either a non-zero debit or credit amount');
      }

      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.0001) {
      throw new Error(
        `Journal entry is unbalanced: total debits ($${totalDebit.toFixed(2)}) must equal total credits ($${totalCredit.toFixed(2)})`,
      );
    }
  }

  post(): void {
    if (this.props.status === 'POSTED') {
      throw new Error('Journal entry is already posted');
    }
    if (this.props.status === 'VOID') {
      throw new Error('Cannot post a voided journal entry');
    }
    this.props.status = 'POSTED';
  }

  void(): void {
    if (this.props.status === 'VOID') {
      throw new Error('Journal entry is already voided');
    }
    this.props.status = 'VOID';
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get entryNumber(): string {
    return this.props.entryNumber;
  }

  get postingDate(): Date {
    return this.props.postingDate;
  }

  get sourceType(): JournalSourceType {
    return this.props.sourceType;
  }

  get sourceId(): string | null | undefined {
    return this.props.sourceId;
  }

  get description(): string {
    return this.props.description;
  }

  get status(): JournalEntryStatus {
    return this.props.status;
  }

  get lines(): JournalLineItemProps[] {
    return [...this.props.lines];
  }

  get totalDebit(): number {
    return Number(this.props.lines.reduce((acc, l) => acc + l.debit, 0).toFixed(2));
  }

  get totalCredit(): number {
    return Number(this.props.lines.reduce((acc, l) => acc + l.credit, 0).toFixed(2));
  }
}
