import { LocationEntity } from './location.entity';
import { BadRequestException } from '@nestjs/common';

describe('LocationEntity', () => {
  it('instantiates valid location entity', () => {
    const loc = new LocationEntity(
      'Downtown Supermarket',
      'BRANCH',
      'BR-DOWNTOWN',
      'parent-1',
      'org-1',
      'loc-1',
    );
    expect(loc.name).toBe('Downtown Supermarket');
    expect(loc.type).toBe('BRANCH');
    expect(loc.code).toBe('BR-DOWNTOWN');
  });

  it('rejects empty name', () => {
    expect(
      () => new LocationEntity('', 'BRANCH', 'BR-1', null, 'org-1'),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid code with special symbols', () => {
    expect(
      () => new LocationEntity('Store', 'BRANCH', 'BR#123!', null, 'org-1'),
    ).toThrow(BadRequestException);
  });

  it('rejects self-parenting on instantiation', () => {
    expect(
      () => new LocationEntity('Store', 'BRANCH', 'BR-1', 'loc-1', 'org-1', 'loc-1'),
    ).toThrow(BadRequestException);
  });

  describe('wouldCreateCycle', () => {
    const parentLookup = new Map<string, string | null>([
      ['loc-company', null],
      ['loc-branch', 'loc-company'],
      ['loc-dept', 'loc-branch'],
      ['loc-pos', 'loc-dept'],
    ]);

    it('returns false for valid non-circular parent change', () => {
      // Setting loc-pos's parent to loc-company is fine
      expect(
        LocationEntity.wouldCreateCycle('loc-pos', 'loc-company', parentLookup),
      ).toBe(false);
    });

    it('returns true if setting self as parent', () => {
      expect(
        LocationEntity.wouldCreateCycle('loc-branch', 'loc-branch', parentLookup),
      ).toBe(true);
    });

    it('returns true if setting descendant as parent (direct child)', () => {
      // Trying to make loc-company a child of loc-branch
      expect(
        LocationEntity.wouldCreateCycle('loc-company', 'loc-branch', parentLookup),
      ).toBe(true);
    });

    it('returns true if setting descendant as parent (deep descendant)', () => {
      // Trying to make loc-company a child of loc-pos
      expect(
        LocationEntity.wouldCreateCycle('loc-company', 'loc-pos', parentLookup),
      ).toBe(true);
    });
  });
});
