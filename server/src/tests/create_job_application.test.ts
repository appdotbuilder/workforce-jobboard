import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  organizationsTable, 
  usersTable, 
  jobRequisitionsTable, 
  jobApplicationsTable,
  vendorsTable 
} from '../db/schema';
import { type CreateJobApplicationInput } from '../schema';
import { 
  createJobApplication, 
  calculateEligibilityScore, 
  calculateReadinessScore 
} from '../handlers/create_job_application';
import { eq, and } from 'drizzle-orm';

// Test data setup
let testOrg: any;
let testUser: any;
let testJob: any;
let testVendor: any;

const createTestData = async () => {
  // Create organization
  const orgResult = await db.insert(organizationsTable)
    .values({
      name: 'Test Company',
      slug: 'test-company',
      type: 'enterprise',
    })
    .returning()
    .execute();
  testOrg = orgResult[0];

  // Create user
  const userResult = await db.insert(usersTable)
    .values({
      email: 'candidate@example.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
      resume_url: 'https://example.com/resume.pdf',
      linkedin_url: 'https://linkedin.com/in/johndoe',
      location: 'New York, NY',
      preferred_locations: JSON.stringify(['New York, NY', 'San Francisco, CA']),
      skills: JSON.stringify(['JavaScript', 'React', 'Node.js']),
      experience_years: 3
    })
    .returning()
    .execute();
  testUser = userResult[0];

  // Create job
  const jobResult = await db.insert(jobRequisitionsTable)
    .values({
      organization_id: testOrg.id,
      title: 'Frontend Developer',
      description: 'Looking for a React developer with JavaScript experience',
      requirements: 'Must have React and JavaScript skills, 2+ years experience',
      responsibilities: 'Build user interfaces',
      location: 'New York, NY',
      remote_allowed: false,
      employment_type: 'full-time',
      salary_currency: 'USD',
      visibility_level: 'public',
      allowed_application_paths: JSON.stringify(['direct', 'vendor']),
      status: 'active',
      created_by: testUser.id
    })
    .returning()
    .execute();
  testJob = jobResult[0];

  // Create vendor
  const vendorResult = await db.insert(vendorsTable)
    .values({
      name: 'Test Recruitment Agency',
      email: 'vendor@example.com',
      is_active: true
    })
    .returning()
    .execute();
  testVendor = vendorResult[0];
};

const basicApplicationInput: CreateJobApplicationInput = {
  job_id: 0, // Will be set in tests
  user_id: 0, // Will be set in tests
  application_path: 'direct',
  cover_letter: 'I am excited about this opportunity...',
  custom_responses: { 'question1': 'answer1' },
  consent_given: true
};

describe('createJobApplication', () => {
  beforeEach(async () => {
    await createDB();
    await createTestData();
  });
  
  afterEach(resetDB);

  it('should create a job application with all fields', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id
    };

    const result = await createJobApplication(input);

    // Validate all fields
    expect(result.job_id).toBe(testJob.id);
    expect(result.user_id).toBe(testUser.id);
    expect(result.application_path).toBe('direct');
    expect(result.cover_letter).toBe('I am excited about this opportunity...');
    expect(result.custom_responses).toEqual({ 'question1': 'answer1' });
    expect(result.consent_given).toBe(true);
    expect(result.consent_timestamp).toBeInstanceOf(Date);
    expect(result.status).toBe('pending');
    expect(result.applied_at).toBeInstanceOf(Date);
    expect(result.last_updated).toBeInstanceOf(Date);
    expect(result.id).toBeDefined();

    // Validate calculated scores are numbers
    expect(typeof result.eligibility_score).toBe('number');
    expect(typeof result.readiness_score).toBe('number');
    expect(typeof result.skills_match_percentage).toBe('number');
    expect(result.eligibility_score).toBeGreaterThanOrEqual(0);
    expect(result.eligibility_score).toBeLessThanOrEqual(100);
    expect(result.readiness_score).toBeGreaterThanOrEqual(0);
    expect(result.readiness_score).toBeLessThanOrEqual(100);
  });

  it('should create application with vendor', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id,
      application_path: 'vendor',
      vendor_id: testVendor.id
    };

    const result = await createJobApplication(input);

    expect(result.vendor_id).toBe(testVendor.id);
    expect(result.application_path).toBe('vendor');
  });

  it('should save application to database', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id
    };

    const result = await createJobApplication(input);

    // Verify in database
    const applications = await db.select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.id, result.id))
      .execute();

    expect(applications).toHaveLength(1);
    expect(applications[0].job_id).toBe(testJob.id);
    expect(applications[0].user_id).toBe(testUser.id);
    expect(parseFloat(applications[0].eligibility_score)).toBeGreaterThan(0);
  });

  it('should handle consent_given false correctly', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id,
      consent_given: false
    };

    const result = await createJobApplication(input);

    expect(result.consent_given).toBe(false);
    expect(result.consent_timestamp).toBeNull();
  });

  it('should throw error for non-existent job', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: 99999,
      user_id: testUser.id
    };

    await expect(createJobApplication(input)).rejects.toThrow(/job not found/i);
  });

  it('should throw error for non-existent user', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: 99999
    };

    await expect(createJobApplication(input)).rejects.toThrow(/user not found/i);
  });

  it('should throw error for duplicate application', async () => {
    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id
    };

    // Create first application
    await createJobApplication(input);

    // Try to create duplicate
    await expect(createJobApplication(input)).rejects.toThrow(/application already exists/i);
  });

  it('should throw error for invalid application path', async () => {
    // Update job to only allow direct applications
    await db.update(jobRequisitionsTable)
      .set({ allowed_application_paths: JSON.stringify(['direct']) })
      .where(eq(jobRequisitionsTable.id, testJob.id))
      .execute();

    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id,
      application_path: 'vendor'
    };

    await expect(createJobApplication(input)).rejects.toThrow(/application path not allowed/i);
  });

  it('should throw error for inactive vendor', async () => {
    // Deactivate vendor
    await db.update(vendorsTable)
      .set({ is_active: false })
      .where(eq(vendorsTable.id, testVendor.id))
      .execute();

    const input: CreateJobApplicationInput = {
      ...basicApplicationInput,
      job_id: testJob.id,
      user_id: testUser.id,
      application_path: 'vendor',
      vendor_id: testVendor.id
    };

    await expect(createJobApplication(input)).rejects.toThrow(/vendor not found or inactive/i);
  });
});

describe('calculateEligibilityScore', () => {
  beforeEach(async () => {
    await createDB();
    await createTestData();
  });
  
  afterEach(resetDB);

  it('should calculate high score for well-matched candidate', async () => {
    const score = await calculateEligibilityScore(testUser.id, testJob.id);
    
    expect(score).toBeGreaterThan(50); // Should be high due to location match and skills
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should calculate lower score for remote job when candidate prefers location', async () => {
    // Create remote job
    const remoteJobResult = await db.insert(jobRequisitionsTable)
      .values({
        organization_id: testOrg.id,
        title: 'Remote Developer',
        description: 'Remote React position',
        requirements: 'React experience required',
        responsibilities: 'Remote development work',
        location: 'Remote',
        remote_allowed: true,
        employment_type: 'full-time',
        salary_currency: 'USD',
        visibility_level: 'public',
        allowed_application_paths: JSON.stringify(['direct']),
        status: 'active',
        created_by: testUser.id
      })
      .returning()
      .execute();

    const score = await calculateEligibilityScore(testUser.id, remoteJobResult[0].id);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return 0 for non-existent user or job', async () => {
    const score1 = await calculateEligibilityScore(99999, testJob.id);
    const score2 = await calculateEligibilityScore(testUser.id, 99999);
    
    expect(score1).toBe(0);
    expect(score2).toBe(0);
  });
});

describe('calculateReadinessScore', () => {
  beforeEach(async () => {
    await createDB();
    await createTestData();
  });
  
  afterEach(resetDB);

  it('should calculate high score for complete profile', async () => {
    const score = await calculateReadinessScore(testUser.id);
    
    expect(score).toBeGreaterThan(80); // Complete profile should score high
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should calculate lower score for incomplete profile', async () => {
    // Create user with minimal profile
    const incompleteUserResult = await db.insert(usersTable)
      .values({
        email: 'incomplete@example.com',
        first_name: 'Jane',
        last_name: 'Smith'
        // Missing many optional fields
      })
      .returning()
      .execute();

    const score = await calculateReadinessScore(incompleteUserResult[0].id);
    
    expect(score).toBeLessThan(50); // Incomplete profile should score lower
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should return 0 for non-existent user', async () => {
    const score = await calculateReadinessScore(99999);
    expect(score).toBe(0);
  });

  it('should give proper scores for different completeness levels', async () => {
    // User with basic info only
    const basicUserResult = await db.insert(usersTable)
      .values({
        email: 'basic@example.com',
        first_name: 'Basic',
        last_name: 'User'
      })
      .returning()
      .execute();

    // User with professional details
    const profUserResult = await db.insert(usersTable)
      .values({
        email: 'prof@example.com',
        first_name: 'Professional',
        last_name: 'User',
        phone: '+1234567890',
        resume_url: 'https://example.com/resume.pdf',
        experience_years: 5,
        location: 'San Francisco, CA'
      })
      .returning()
      .execute();

    const basicScore = await calculateReadinessScore(basicUserResult[0].id);
    const profScore = await calculateReadinessScore(profUserResult[0].id);
    
    expect(profScore).toBeGreaterThan(basicScore);
    expect(basicScore).toBeGreaterThan(0);
  });
});