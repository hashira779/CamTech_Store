import { BadRequestException } from '@nestjs/common';
import type { LocationType } from '@mystore/contracts';

export class LocationEntity {
  constructor(
    public readonly name: string,
    public readonly type: LocationType,
    public readonly code: string | null,
    public readonly parentId: string | null,
    public readonly organizationId: string,
    public readonly id?: string,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new BadRequestException('Location name cannot be empty');
    }
    if (this.name.trim().length > 100) {
      throw new BadRequestException('Location name cannot exceed 100 characters');
    }
    if (this.code) {
      const codeRegex = /^[A-Za-z0-9_-]+$/;
      if (!codeRegex.test(this.code)) {
        throw new BadRequestException(
          'Location code may only contain alphanumeric characters, hyphens, and underscores',
        );
      }
    }
    if (this.id && this.parentId && this.id === this.parentId) {
      throw new BadRequestException('A location cannot be its own parent');
    }
  }

  /**
   * Detects whether setting `newParentId` would create a circular reference in the tree.
   * `allLocations` is a map of id -> { id, parentId }.
   */
  public static wouldCreateCycle(
    locationId: string,
    newParentId: string | null,
    parentLookup: Map<string, string | null>,
  ): boolean {
    if (!newParentId) return false;
    if (locationId === newParentId) return true;

    let current: string | null = newParentId;
    const visited = new Set<string>();

    while (current) {
      if (current === locationId) {
        return true; // Cycle detected: locationId is an ancestor of newParentId!
      }
      if (visited.has(current)) {
        return true; // Malformed tree loop detected
      }
      visited.add(current);
      current = parentLookup.get(current) ?? null;
    }

    return false;
  }
}
