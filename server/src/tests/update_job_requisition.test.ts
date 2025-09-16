import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { jobRequisitionsTable, organizationsTable, usersTable } from '../db/schema';
import { type UpdateJobRequisitionInput } from '../schema';
import { updateJobRequisition, publishJobRequisition } from '../handlers/update_job_requisition';
import { eq } from 'drizzle-orm';

describe('updateJobRequisition', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create test data
  const createTestData = async () => {
    // Create organization
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Company',
        slug: 'test-company',
        type: 'startup'
      })
      .returning()
      .execute();
    const organization = orgResult[0];

    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'creator@test.com',
        first_name: 'John',
        last_name: 'Creator'
      })
      .returning()
      .execute();
    const user = userResult[0];

    // Create job requisition
    const jobResult = await db.insert(jobRequisitionsTable)
      .values({
        organization_id: organization.id,
        title: 'Software Engineer',
        description: 'A great job',
        requirements: 'Experience with TypeScript',
        responsibilities: 'Build software',
        location: 'Remote',
        remote_allowed: true,
        employment_type: 'full-time',
        salary_currency: 'USD',
        visibility_level: 'public',
        allowed_application_paths: ['direct'],
        status: 'draft',
        created_by: user.id
      })
      .returning()
      .execute();
    
    return { organization, user, job: jobResult[0] };
  };

  it('should update basic job fields', async () => {
    const { job } = await createTestData();

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      title: 'Senior Software Engineer',
      description: 'An even better job',
      location: 'San Francisco',
      employment_type: 'contract'
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(job.id);
    expect(result!.title).toEqual('Senior Software Engineer');
    expect(result!.description).toEqual('An even better job');
    expect(result!.location).toEqual('San Francisco');
    expect(result!.employment_type).toEqual('contract');
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.updated_at > job.updated_at).toBe(true);
  });

  it('should update salary fields with proper numeric conversion', async () => {
    const { job } = await createTestData();

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      salary_min: 80000,
      salary_max: 120000,
      salary_currency: 'EUR',
      compensation_details: 'Includes equity'
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeDefined();
    expect(result!.salary_min).toEqual(80000);
    expect(result!.salary_max).toEqual(120000);
    expect(typeof result!.salary_min).toBe('number');
    expect(typeof result!.salary_max).toBe('number');
    expect(result!.salary_currency).toEqual('EUR');
    expect(result!.compensation_details).toEqual('Includes equity');
  });

  it('should update visibility and application paths', async () => {
    const { job } = await createTestData();

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      visibility_level: 'internal',
      allowed_application_paths: ['direct', 'vendor']
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeDefined();
    expect(result!.visibility_level).toEqual('internal');
    expect(result!.allowed_application_paths).toEqual(['direct', 'vendor']);
    expect(Array.isArray(result!.allowed_application_paths)).toBe(true);
  });

  it('should update status and deadline', async () => {
    const { job } = await createTestData();
    const deadline = new Date('2024-06-01');

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      status: 'active',
      application_deadline: deadline
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeDefined();
    expect(result!.status).toEqual('active');
    expect(result!.application_deadline).toEqual(deadline);
  });

  it('should handle null values for optional fields', async () => {
    const { job } = await createTestData();

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      department: null,
      salary_min: null,
      benefits_summary: null,
      application_deadline: null
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeDefined();
    expect(result!.department).toBeNull();
    expect(result!.salary_min).toBeNull();
    expect(result!.benefits_summary).toBeNull();
    expect(result!.application_deadline).toBeNull();
  });

  it('should persist changes to database', async () => {
    const { job } = await createTestData();

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      title: 'Updated Title',
      salary_min: 75000
    };

    await updateJobRequisition(updateInput);

    // Query database directly to verify persistence
    const savedJobs = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, job.id))
      .execute();

    expect(savedJobs).toHaveLength(1);
    expect(savedJobs[0].title).toEqual('Updated Title');
    expect(parseFloat(savedJobs[0].salary_min!)).toEqual(75000);
  });

  it('should return null for non-existent job', async () => {
    const updateInput: UpdateJobRequisitionInput = {
      id: 99999,
      title: 'Non-existent Job'
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeNull();
  });

  it('should handle partial updates without affecting other fields', async () => {
    const { job } = await createTestData();
    const originalTitle = job.title;

    const updateInput: UpdateJobRequisitionInput = {
      id: job.id,
      description: 'Updated description only'
    };

    const result = await updateJobRequisition(updateInput);

    expect(result).toBeDefined();
    expect(result!.title).toEqual(originalTitle); // Should remain unchanged
    expect(result!.description).toEqual('Updated description only');
  });
});

describe('publishJobRequisition', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create test data
  const createTestData = async (status: 'draft' | 'active' | 'paused' = 'draft') => {
    // Create organization
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Company',
        slug: 'test-company',
        type: 'startup'
      })
      .returning()
      .execute();
    const organization = orgResult[0];

    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'creator@test.com',
        first_name: 'John',
        last_name: 'Creator'
      })
      .returning()
      .execute();
    const user = userResult[0];

    // Create job requisition
    const jobResult = await db.insert(jobRequisitionsTable)
      .values({
        organization_id: organization.id,
        title: 'Software Engineer',
        description: 'A complete job description',
        requirements: 'Experience with TypeScript',
        responsibilities: 'Build amazing software',
        location: 'Remote',
        remote_allowed: true,
        employment_type: 'full-time',
        salary_currency: 'USD',
        visibility_level: 'public',
        allowed_application_paths: ['direct'],
        status,
        created_by: user.id
      })
      .returning()
      .execute();
    
    return { organization, user, job: jobResult[0] };
  };

  it('should publish a draft job requisition', async () => {
    const { job } = await createTestData('draft');

    const result = await publishJobRequisition(job.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(job.id);
    expect(result!.status).toEqual('active');
    expect(result!.published_at).toBeInstanceOf(Date);
    expect(result!.published_at).not.toBeNull();
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.updated_at > job.updated_at).toBe(true);
  });

  it('should persist published status to database', async () => {
    const { job } = await createTestData('draft');

    await publishJobRequisition(job.id);

    // Query database directly to verify persistence
    const savedJobs = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, job.id))
      .execute();

    expect(savedJobs).toHaveLength(1);
    expect(savedJobs[0].status).toEqual('active');
    expect(savedJobs[0].published_at).toBeInstanceOf(Date);
    expect(savedJobs[0].published_at).not.toBeNull();
  });

  it('should not publish job that is not in draft status', async () => {
    const { job } = await createTestData('active');

    const result = await publishJobRequisition(job.id);

    expect(result).toBeNull();

    // Verify status unchanged in database
    const savedJobs = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, job.id))
      .execute();

    expect(savedJobs[0].status).toEqual('active');
  });

  it('should return null for non-existent job', async () => {
    const result = await publishJobRequisition(99999);

    expect(result).toBeNull();
  });

  it('should not publish incomplete job with missing required fields', async () => {
    const { organization, user } = await createTestData();

    // Create incomplete job (missing description)
    const incompleteJobResult = await db.insert(jobRequisitionsTable)
      .values({
        organization_id: organization.id,
        title: 'Incomplete Job',
        description: '', // Empty description
        requirements: 'Some requirements',
        responsibilities: 'Some responsibilities',
        location: 'Remote',
        remote_allowed: true,
        employment_type: 'full-time',
        salary_currency: 'USD',
        visibility_level: 'public',
        allowed_application_paths: ['direct'],
        status: 'draft',
        created_by: user.id
      })
      .returning()
      .execute();

    const incompleteJob = incompleteJobResult[0];

    const result = await publishJobRequisition(incompleteJob.id);

    expect(result).toBeNull();

    // Verify status unchanged in database
    const savedJobs = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, incompleteJob.id))
      .execute();

    expect(savedJobs[0].status).toEqual('draft');
  });

  it('should preserve all existing data when publishing', async () => {
    const { job } = await createTestData('draft');

    const result = await publishJobRequisition(job.id);

    expect(result).toBeDefined();
    expect(result!.title).toEqual(job.title);
    expect(result!.description).toEqual(job.description);
    expect(result!.organization_id).toEqual(job.organization_id);
    expect(result!.created_by).toEqual(job.created_by);
    expect(result!.visibility_level).toEqual(job.visibility_level);
    expect(result!.allowed_application_paths).toEqual(['direct']);
    expect(result!.created_at).toEqual(job.created_at);
  });
});