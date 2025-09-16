import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  organizationsTable, 
  usersTable, 
  jobRequisitionsTable, 
  vendorsTable,
  jobApplicationsTable 
} from '../db/schema';
import { 
  type UpdateApplicationStatusInput,
  type CreateOrganizationInput,
  type CreateUserInput,
  type CreateJobRequisitionInput,
  type CreateJobApplicationInput,
  type CreateVendorInput
} from '../schema';
import { updateApplicationStatus, bulkUpdateApplicationStatus } from '../handlers/update_application_status';
import { eq } from 'drizzle-orm';

describe('updateApplicationStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testOrgId: number;
  let testUserId: number;
  let testJobId: number;
  let testVendorId: number;
  let testApplicationId: number;

  beforeEach(async () => {
    // Create test organization
    const orgInput: CreateOrganizationInput = {
      name: 'Test Company',
      slug: 'test-company',
      type: 'startup',
      description: 'A test company',
      logo_url: 'https://example.com/logo.png',
      website_url: 'https://example.com'
    };

    const orgResult = await db.insert(organizationsTable)
      .values(orgInput)
      .returning()
      .execute();
    testOrgId = orgResult[0].id;

    // Create test user
    const userInput: CreateUserInput = {
      email: 'candidate@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      phone: '+1234567890',
      location: 'San Francisco, CA',
      preferred_locations: ['San Francisco, CA', 'New York, NY'],
      skills: ['JavaScript', 'React', 'Node.js'],
      experience_years: 3
    };

    const userResult = await db.insert(usersTable)
      .values({
        ...userInput,
        preferred_locations: JSON.stringify(userInput.preferred_locations || []),
        skills: JSON.stringify(userInput.skills || [])
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test job
    const jobInput: CreateJobRequisitionInput = {
      organization_id: testOrgId,
      title: 'Software Engineer',
      description: 'A great software engineering position',
      requirements: 'Bachelor degree in CS',
      responsibilities: 'Write code and tests',
      location: 'San Francisco, CA',
      remote_allowed: true,
      employment_type: 'full-time',
      salary_currency: 'USD',
      visibility_level: 'public',
      allowed_application_paths: ['direct'],
      created_by: testUserId
    };

    const jobResult = await db.insert(jobRequisitionsTable)
      .values({
        ...jobInput,
        salary_min: jobInput.salary_min?.toString(),
        salary_max: jobInput.salary_max?.toString(),
        allowed_application_paths: JSON.stringify(jobInput.allowed_application_paths)
      })
      .returning()
      .execute();
    testJobId = jobResult[0].id;

    // Create test vendor
    const vendorInput: CreateVendorInput = {
      name: 'Test Recruiting Agency',
      email: 'vendor@example.com',
      contact_person: 'John Smith',
      commission_rate: 15.0
    };

    const vendorResult = await db.insert(vendorsTable)
      .values({
        ...vendorInput,
        commission_rate: vendorInput.commission_rate?.toString()
      })
      .returning()
      .execute();
    testVendorId = vendorResult[0].id;

    // Create test application
    const applicationInput: CreateJobApplicationInput = {
      job_id: testJobId,
      user_id: testUserId,
      application_path: 'direct',
      cover_letter: 'I am very interested in this position.',
      custom_responses: { question1: 'answer1' },
      consent_given: true
    };

    const applicationResult = await db.insert(jobApplicationsTable)
      .values({
        ...applicationInput,
        custom_responses: JSON.stringify(applicationInput.custom_responses),
        consent_timestamp: new Date()
      })
      .returning()
      .execute();
    testApplicationId = applicationResult[0].id;
  });

  it('should update application status successfully', async () => {
    const input: UpdateApplicationStatusInput = {
      id: testApplicationId,
      status: 'reviewing'
    };

    const result = await updateApplicationStatus(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(testApplicationId);
    expect(result!.status).toBe('reviewing');
    expect(result!.last_updated).toBeInstanceOf(Date);
    
    // Verify numeric fields are properly converted
    expect(typeof result!.eligibility_score).toBe('number');
    expect(typeof result!.readiness_score).toBe('number');
    expect(typeof result!.skills_match_percentage).toBe('number');
  });

  it('should save updated status to database', async () => {
    const input: UpdateApplicationStatusInput = {
      id: testApplicationId,
      status: 'interviewed'
    };

    await updateApplicationStatus(input);

    // Verify in database
    const applications = await db.select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.id, testApplicationId))
      .execute();

    expect(applications).toHaveLength(1);
    expect(applications[0].status).toBe('interviewed');
    expect(applications[0].last_updated).toBeInstanceOf(Date);
  });

  it('should return null for non-existent application', async () => {
    const input: UpdateApplicationStatusInput = {
      id: 99999,
      status: 'rejected'
    };

    const result = await updateApplicationStatus(input);

    expect(result).toBeNull();
  });

  it('should update application to accepted status', async () => {
    const input: UpdateApplicationStatusInput = {
      id: testApplicationId,
      status: 'accepted'
    };

    const result = await updateApplicationStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('accepted');
    expect(result!.job_id).toBe(testJobId);
    expect(result!.user_id).toBe(testUserId);
  });

  it('should update application to rejected status', async () => {
    const input: UpdateApplicationStatusInput = {
      id: testApplicationId,
      status: 'rejected'
    };

    const result = await updateApplicationStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('rejected');
  });

  it('should update application to withdrawn status', async () => {
    const input: UpdateApplicationStatusInput = {
      id: testApplicationId,
      status: 'withdrawn'
    };

    const result = await updateApplicationStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('withdrawn');
  });
});

describe('bulkUpdateApplicationStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testOrgId: number;
  let testUserId: number;
  let testJobId: number;
  let testApplicationIds: number[];

  beforeEach(async () => {
    // Create test organization
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Company',
        slug: 'test-company-bulk',
        type: 'startup'
      })
      .returning()
      .execute();
    testOrgId = orgResult[0].id;

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'bulk-candidate@example.com',
        first_name: 'John',
        last_name: 'Doe',
        preferred_locations: JSON.stringify([]),
        skills: JSON.stringify(['Python', 'Django'])
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test job
    const jobResult = await db.insert(jobRequisitionsTable)
      .values({
        organization_id: testOrgId,
        title: 'Python Developer',
        description: 'Python development position',
        requirements: 'Python experience',
        responsibilities: 'Write Python code',
        location: 'Remote',
        remote_allowed: true,
        employment_type: 'full-time',
        salary_currency: 'USD',
        visibility_level: 'public',
        allowed_application_paths: JSON.stringify(['direct']),
        status: 'active',
        created_by: testUserId
      })
      .returning()
      .execute();
    testJobId = jobResult[0].id;

    // Create multiple test applications
    testApplicationIds = [];
    for (let i = 0; i < 3; i++) {
      const applicationResult = await db.insert(jobApplicationsTable)
        .values({
          job_id: testJobId,
          user_id: testUserId,
          application_path: 'direct',
          cover_letter: `Cover letter ${i + 1}`,
          custom_responses: JSON.stringify({}),
          consent_given: true,
          consent_timestamp: new Date()
        })
        .returning()
        .execute();
      testApplicationIds.push(applicationResult[0].id);
    }
  });

  it('should update multiple applications at once', async () => {
    const result = await bulkUpdateApplicationStatus(testApplicationIds, 'reviewing');

    expect(result).toHaveLength(3);
    result.forEach(application => {
      expect(application.status).toBe('reviewing');
      expect(application.last_updated).toBeInstanceOf(Date);
      expect(typeof application.eligibility_score).toBe('number');
      expect(typeof application.readiness_score).toBe('number');
      expect(typeof application.skills_match_percentage).toBe('number');
    });
  });

  it('should save bulk updates to database', async () => {
    await bulkUpdateApplicationStatus(testApplicationIds, 'rejected');

    // Verify all applications were updated in database
    for (const id of testApplicationIds) {
      const applications = await db.select()
        .from(jobApplicationsTable)
        .where(eq(jobApplicationsTable.id, id))
        .execute();

      expect(applications).toHaveLength(1);
      expect(applications[0].status).toBe('rejected');
      expect(applications[0].last_updated).toBeInstanceOf(Date);
    }
  });

  it('should handle empty application list', async () => {
    const result = await bulkUpdateApplicationStatus([], 'accepted');

    expect(result).toHaveLength(0);
  });

  it('should handle single application in bulk update', async () => {
    const result = await bulkUpdateApplicationStatus([testApplicationIds[0]], 'accepted');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('accepted');
    expect(result[0].id).toBe(testApplicationIds[0]);
  });
});