import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable } from '../db/schema';
import { type CreateOrganizationInput } from '../schema';
import { createOrganization } from '../handlers/create_organization';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateOrganizationInput = {
  name: 'Test Organization',
  slug: 'test-org',
  description: 'A test organization',
  type: 'startup',
  logo_url: 'https://example.com/logo.png',
  website_url: 'https://example.com'
};

// Minimal input with only required fields
const minimalInput: CreateOrganizationInput = {
  name: 'Minimal Org',
  slug: 'minimal-org',
  type: 'enterprise'
};

describe('createOrganization', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an organization with all fields', async () => {
    const result = await createOrganization(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Organization');
    expect(result.slug).toEqual('test-org');
    expect(result.description).toEqual('A test organization');
    expect(result.type).toEqual('startup');
    expect(result.logo_url).toEqual('https://example.com/logo.png');
    expect(result.website_url).toEqual('https://example.com');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create an organization with minimal fields', async () => {
    const result = await createOrganization(minimalInput);

    expect(result.name).toEqual('Minimal Org');
    expect(result.slug).toEqual('minimal-org');
    expect(result.type).toEqual('enterprise');
    expect(result.description).toBeNull();
    expect(result.logo_url).toBeNull();
    expect(result.website_url).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save organization to database', async () => {
    const result = await createOrganization(testInput);

    // Query using proper drizzle syntax
    const organizations = await db.select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, result.id))
      .execute();

    expect(organizations).toHaveLength(1);
    expect(organizations[0].name).toEqual('Test Organization');
    expect(organizations[0].slug).toEqual('test-org');
    expect(organizations[0].description).toEqual('A test organization');
    expect(organizations[0].type).toEqual('startup');
    expect(organizations[0].logo_url).toEqual('https://example.com/logo.png');
    expect(organizations[0].website_url).toEqual('https://example.com');
    expect(organizations[0].created_at).toBeInstanceOf(Date);
    expect(organizations[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different organization types', async () => {
    const enterpriseInput: CreateOrganizationInput = {
      ...minimalInput,
      slug: 'enterprise-org',
      type: 'enterprise'
    };

    const nonprofitInput: CreateOrganizationInput = {
      ...minimalInput,
      slug: 'nonprofit-org',
      type: 'nonprofit'
    };

    const agencyInput: CreateOrganizationInput = {
      ...minimalInput,
      slug: 'agency-org',
      type: 'agency'
    };

    const enterpriseResult = await createOrganization(enterpriseInput);
    const nonprofitResult = await createOrganization(nonprofitInput);
    const agencyResult = await createOrganization(agencyInput);

    expect(enterpriseResult.type).toEqual('enterprise');
    expect(nonprofitResult.type).toEqual('nonprofit');
    expect(agencyResult.type).toEqual('agency');
  });

  it('should enforce unique slug constraint', async () => {
    // Create first organization
    await createOrganization(testInput);

    // Try to create another with same slug
    const duplicateInput: CreateOrganizationInput = {
      ...testInput,
      name: 'Different Name'
    };

    await expect(createOrganization(duplicateInput))
      .rejects.toThrow(/duplicate key value violates unique constraint|UNIQUE constraint failed/i);
  });

  it('should handle null optional fields correctly', async () => {
    const inputWithNulls: CreateOrganizationInput = {
      name: 'Null Fields Org',
      slug: 'null-fields-org',
      type: 'startup',
      description: null,
      logo_url: null,
      website_url: null
    };

    const result = await createOrganization(inputWithNulls);

    expect(result.description).toBeNull();
    expect(result.logo_url).toBeNull();
    expect(result.website_url).toBeNull();

    // Verify in database
    const saved = await db.select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, result.id))
      .execute();

    expect(saved[0].description).toBeNull();
    expect(saved[0].logo_url).toBeNull();
    expect(saved[0].website_url).toBeNull();
  });

  it('should set timestamps correctly', async () => {
    const beforeCreation = new Date();
    const result = await createOrganization(testInput);
    const afterCreation = new Date();

    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });
});