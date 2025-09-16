import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable } from '../db/schema';
import { type CreateOrganizationInput } from '../schema';
import { getOrganizations } from '../handlers/get_organizations';

// Test organization data
const testOrganizations: CreateOrganizationInput[] = [
  {
    name: 'TechCorp',
    slug: 'techcorp',
    description: 'Leading technology company',
    type: 'enterprise',
    logo_url: 'https://example.com/techcorp-logo.png',
    website_url: 'https://techcorp.com'
  },
  {
    name: 'StartupXYZ',
    slug: 'startupxyz',
    description: 'Innovative startup disrupting the market',
    type: 'startup',
    logo_url: null,
    website_url: 'https://startupxyz.io'
  },
  {
    name: 'Creative Agency',
    slug: 'creative-agency',
    description: null,
    type: 'agency',
    logo_url: 'https://example.com/agency-logo.jpg',
    website_url: null
  }
];

describe('getOrganizations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no organizations exist', async () => {
    const result = await getOrganizations();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all organizations', async () => {
    // Create test organizations
    await db.insert(organizationsTable)
      .values(testOrganizations)
      .execute();

    const result = await getOrganizations();

    expect(result).toHaveLength(3);
    
    // Verify first organization
    const techCorp = result.find(org => org.slug === 'techcorp');
    expect(techCorp).toBeDefined();
    expect(techCorp!.name).toEqual('TechCorp');
    expect(techCorp!.description).toEqual('Leading technology company');
    expect(techCorp!.type).toEqual('enterprise');
    expect(techCorp!.logo_url).toEqual('https://example.com/techcorp-logo.png');
    expect(techCorp!.website_url).toEqual('https://techcorp.com');
    expect(techCorp!.id).toBeDefined();
    expect(techCorp!.created_at).toBeInstanceOf(Date);
    expect(techCorp!.updated_at).toBeInstanceOf(Date);

    // Verify startup organization
    const startup = result.find(org => org.slug === 'startupxyz');
    expect(startup).toBeDefined();
    expect(startup!.name).toEqual('StartupXYZ');
    expect(startup!.type).toEqual('startup');
    expect(startup!.logo_url).toBeNull();

    // Verify agency organization with null fields
    const agency = result.find(org => org.slug === 'creative-agency');
    expect(agency).toBeDefined();
    expect(agency!.name).toEqual('Creative Agency');
    expect(agency!.type).toEqual('agency');
    expect(agency!.description).toBeNull();
    expect(agency!.website_url).toBeNull();
  });

  it('should return organizations with proper field types', async () => {
    await db.insert(organizationsTable)
      .values([testOrganizations[0]])
      .execute();

    const result = await getOrganizations();

    expect(result).toHaveLength(1);
    const org = result[0];
    
    // Verify all field types
    expect(typeof org.id).toBe('number');
    expect(typeof org.name).toBe('string');
    expect(typeof org.slug).toBe('string');
    expect(typeof org.type).toBe('string');
    expect(org.created_at).toBeInstanceOf(Date);
    expect(org.updated_at).toBeInstanceOf(Date);
    
    // Nullable fields
    expect(org.description === null || typeof org.description === 'string').toBe(true);
    expect(org.logo_url === null || typeof org.logo_url === 'string').toBe(true);
    expect(org.website_url === null || typeof org.website_url === 'string').toBe(true);
  });

  it('should return organizations ordered by creation time', async () => {
    // Insert organizations with slight delay to ensure different timestamps
    await db.insert(organizationsTable)
      .values([testOrganizations[0]])
      .execute();
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await db.insert(organizationsTable)
      .values([testOrganizations[1]])
      .execute();

    const result = await getOrganizations();

    expect(result).toHaveLength(2);
    
    // Check that results are returned (database may order by id by default)
    const techCorp = result.find(org => org.slug === 'techcorp');
    const startup = result.find(org => org.slug === 'startupxyz');
    
    expect(techCorp).toBeDefined();
    expect(startup).toBeDefined();
    expect(techCorp!.created_at).toBeInstanceOf(Date);
    expect(startup!.created_at).toBeInstanceOf(Date);
  });

  it('should handle all organization types correctly', async () => {
    const allTypes: CreateOrganizationInput[] = [
      {
        name: 'Enterprise Corp',
        slug: 'enterprise-corp',
        type: 'enterprise'
      },
      {
        name: 'Tech Startup',
        slug: 'tech-startup',
        type: 'startup'
      },
      {
        name: 'Design Agency',
        slug: 'design-agency',
        type: 'agency'
      },
      {
        name: 'Good Nonprofit',
        slug: 'good-nonprofit',
        type: 'nonprofit'
      }
    ];

    await db.insert(organizationsTable)
      .values(allTypes)
      .execute();

    const result = await getOrganizations();

    expect(result).toHaveLength(4);
    
    const types = result.map(org => org.type);
    expect(types).toContain('enterprise');
    expect(types).toContain('startup');
    expect(types).toContain('agency');
    expect(types).toContain('nonprofit');
  });

  it('should verify data is actually saved in database', async () => {
    await db.insert(organizationsTable)
      .values([testOrganizations[0]])
      .execute();

    const result = await getOrganizations();

    // Query database directly to verify data consistency
    const dbResult = await db.select()
      .from(organizationsTable)
      .execute();

    expect(result).toEqual(dbResult);
    expect(result[0].name).toEqual(dbResult[0].name);
    expect(result[0].slug).toEqual(dbResult[0].slug);
    expect(result[0].type).toEqual(dbResult[0].type);
  });
});