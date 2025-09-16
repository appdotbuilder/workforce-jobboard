import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, usersTable, jobRequisitionsTable, jobApplicationsTable, vendorsTable } from '../db/schema';
import { getJobApplicationsByUser, getJobApplicationsByJob, getJobApplicationById } from '../handlers/get_job_applications';
import { eq } from 'drizzle-orm';

// Test data
const testOrg = {
  name: 'Test Organization',
  slug: 'test-org',
  description: 'Test organization description',
  type: 'startup' as const,
  logo_url: null,
  website_url: 'https://testorg.com'
};

const testUser1 = {
  email: 'candidate1@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  resume_url: 'https://example.com/resume1.pdf',
  linkedin_url: 'https://linkedin.com/in/johndoe',
  portfolio_url: null,
  location: 'San Francisco, CA',
  preferred_locations: ['San Francisco, CA', 'New York, NY'],
  skills: ['JavaScript', 'TypeScript', 'React'],
  experience_years: 5
};

const testUser2 = {
  email: 'candidate2@example.com',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: '+0987654321',
  resume_url: 'https://example.com/resume2.pdf',
  linkedin_url: 'https://linkedin.com/in/janesmith',
  portfolio_url: 'https://janesmith.dev',
  location: 'New York, NY',
  preferred_locations: ['New York, NY', 'Boston, MA'],
  skills: ['Python', 'Django', 'PostgreSQL'],
  experience_years: 3
};

const testCreator = {
  email: 'creator@example.com',
  first_name: 'Job',
  last_name: 'Creator',
  phone: null,
  resume_url: null,
  linkedin_url: null,
  portfolio_url: null,
  location: null,
  preferred_locations: [],
  skills: [],
  experience_years: null
};

const testJob = {
  title: 'Software Engineer',
  description: 'Looking for a skilled software engineer',
  requirements: 'Bachelor degree in CS, 3+ years experience',
  responsibilities: 'Develop and maintain software applications',
  location: 'San Francisco, CA',
  remote_allowed: true,
  employment_type: 'full-time',
  department: 'Engineering',
  salary_min: 90000,
  salary_max: 130000,
  salary_currency: 'USD',
  compensation_details: 'Competitive salary with equity',
  benefits_summary: 'Health, dental, vision insurance',
  visibility_level: 'public' as const,
  allowed_application_paths: ['direct', 'vendor'],
  application_deadline: new Date('2024-12-31')
};

const testVendor = {
  name: 'Test Recruitment Agency',
  email: 'contact@testrecruit.com',
  contact_person: 'Agent Smith',
  phone: '+1111111111',
  commission_rate: 15.0,
  is_active: true
};

const testApplication1 = {
  application_path: 'direct' as const,
  vendor_id: null,
  cover_letter: 'I am very interested in this position...',
  resume_url: 'https://example.com/resume1.pdf',
  custom_responses: { question1: 'answer1', question2: 'answer2' },
  eligibility_score: 85.5,
  readiness_score: 92.0,
  skills_match_percentage: 78.5,
  status: 'pending' as const,
  consent_given: true,
  consent_timestamp: new Date()
};

const testApplication2 = {
  application_path: 'vendor' as const,
  cover_letter: 'Recommended by recruitment agency...',
  resume_url: 'https://example.com/resume2.pdf',
  custom_responses: { question1: 'different answer' },
  eligibility_score: 72.3,
  readiness_score: 88.5,
  skills_match_percentage: 65.0,
  status: 'reviewing' as const,
  consent_given: true,
  consent_timestamp: new Date()
};

describe('getJobApplications handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get applications by user ID', async () => {
    // Create prerequisite data
    const [org] = await db.insert(organizationsTable).values(testOrg).returning().execute();
    const [user1] = await db.insert(usersTable).values(testUser1).returning().execute();
    const [user2] = await db.insert(usersTable).values(testUser2).returning().execute();
    const [creator] = await db.insert(usersTable).values(testCreator).returning().execute();
    
    const [job] = await db.insert(jobRequisitionsTable).values({
      ...testJob,
      organization_id: org.id,
      created_by: creator.id,
      salary_min: testJob.salary_min.toString(),
      salary_max: testJob.salary_max.toString()
    }).returning().execute();

    // Create applications for user1
    const [app1] = await db.insert(jobApplicationsTable).values({
      ...testApplication1,
      job_id: job.id,
      user_id: user1.id,
      eligibility_score: testApplication1.eligibility_score.toString(),
      readiness_score: testApplication1.readiness_score.toString(),
      skills_match_percentage: testApplication1.skills_match_percentage.toString()
    }).returning().execute();

    // Create application for user2 (should not be returned)
    await db.insert(jobApplicationsTable).values({
      ...testApplication2,
      job_id: job.id,
      user_id: user2.id,
      vendor_id: null,
      eligibility_score: testApplication2.eligibility_score.toString(),
      readiness_score: testApplication2.readiness_score.toString(),
      skills_match_percentage: testApplication2.skills_match_percentage.toString()
    }).returning().execute();

    const result = await getJobApplicationsByUser(user1.id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(app1.id);
    expect(result[0].user_id).toEqual(user1.id);
    expect(result[0].job_id).toEqual(job.id);
    expect(result[0].application_path).toEqual('direct');
    expect(result[0].cover_letter).toEqual(testApplication1.cover_letter);
    expect(result[0].status).toEqual('pending');
    
    // Verify numeric conversions
    expect(typeof result[0].eligibility_score).toBe('number');
    expect(result[0].eligibility_score).toEqual(85.5);
    expect(typeof result[0].readiness_score).toBe('number');
    expect(result[0].readiness_score).toEqual(92.0);
    expect(typeof result[0].skills_match_percentage).toBe('number');
    expect(result[0].skills_match_percentage).toEqual(78.5);
    
    expect(result[0].consent_given).toBe(true);
    expect(result[0].applied_at).toBeInstanceOf(Date);
    expect(result[0].last_updated).toBeInstanceOf(Date);
  });

  it('should get applications by job ID', async () => {
    // Create prerequisite data
    const [org] = await db.insert(organizationsTable).values(testOrg).returning().execute();
    const [user1] = await db.insert(usersTable).values(testUser1).returning().execute();
    const [user2] = await db.insert(usersTable).values(testUser2).returning().execute();
    const [creator] = await db.insert(usersTable).values(testCreator).returning().execute();
    const [vendor] = await db.insert(vendorsTable).values({
      ...testVendor,
      commission_rate: testVendor.commission_rate.toString()
    }).returning().execute();
    
    const [job] = await db.insert(jobRequisitionsTable).values({
      ...testJob,
      organization_id: org.id,
      created_by: creator.id,
      salary_min: testJob.salary_min.toString(),
      salary_max: testJob.salary_max.toString()
    }).returning().execute();

    // Create applications from different users for the same job
    const [app1] = await db.insert(jobApplicationsTable).values({
      ...testApplication1,
      job_id: job.id,
      user_id: user1.id,
      eligibility_score: testApplication1.eligibility_score.toString(),
      readiness_score: testApplication1.readiness_score.toString(),
      skills_match_percentage: testApplication1.skills_match_percentage.toString()
    }).returning().execute();

    const [app2] = await db.insert(jobApplicationsTable).values({
      ...testApplication2,
      job_id: job.id,
      user_id: user2.id,
      vendor_id: vendor.id,
      eligibility_score: testApplication2.eligibility_score.toString(),
      readiness_score: testApplication2.readiness_score.toString(),
      skills_match_percentage: testApplication2.skills_match_percentage.toString()
    }).returning().execute();

    const result = await getJobApplicationsByJob(job.id);

    expect(result).toHaveLength(2);
    
    // Find applications by ID to verify order doesn't matter
    const application1 = result.find(app => app.id === app1.id);
    const application2 = result.find(app => app.id === app2.id);
    
    expect(application1).toBeDefined();
    expect(application1!.user_id).toEqual(user1.id);
    expect(application1!.application_path).toEqual('direct');
    expect(application1!.vendor_id).toBeNull();
    expect(application1!.eligibility_score).toEqual(85.5);
    expect(application1!.status).toEqual('pending');
    
    expect(application2).toBeDefined();
    expect(application2!.user_id).toEqual(user2.id);
    expect(application2!.application_path).toEqual('vendor');
    expect(application2!.vendor_id).toEqual(vendor.id);
    expect(application2!.eligibility_score).toEqual(72.3);
    expect(application2!.status).toEqual('reviewing');

    // Verify all numeric fields are converted properly
    result.forEach(app => {
      expect(typeof app.eligibility_score).toBe('number');
      expect(typeof app.readiness_score).toBe('number');
      expect(typeof app.skills_match_percentage).toBe('number');
    });
  });

  it('should get application by ID', async () => {
    // Create prerequisite data
    const [org] = await db.insert(organizationsTable).values(testOrg).returning().execute();
    const [user] = await db.insert(usersTable).values(testUser1).returning().execute();
    const [creator] = await db.insert(usersTable).values(testCreator).returning().execute();
    
    const [job] = await db.insert(jobRequisitionsTable).values({
      ...testJob,
      organization_id: org.id,
      created_by: creator.id,
      salary_min: testJob.salary_min.toString(),
      salary_max: testJob.salary_max.toString()
    }).returning().execute();

    const [app] = await db.insert(jobApplicationsTable).values({
      ...testApplication1,
      job_id: job.id,
      user_id: user.id,
      eligibility_score: testApplication1.eligibility_score.toString(),
      readiness_score: testApplication1.readiness_score.toString(),
      skills_match_percentage: testApplication1.skills_match_percentage.toString()
    }).returning().execute();

    const result = await getJobApplicationById(app.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(app.id);
    expect(result!.user_id).toEqual(user.id);
    expect(result!.job_id).toEqual(job.id);
    expect(result!.application_path).toEqual('direct');
    expect(result!.cover_letter).toEqual(testApplication1.cover_letter);
    expect(result!.custom_responses).toEqual(testApplication1.custom_responses);
    
    // Verify numeric conversions
    expect(typeof result!.eligibility_score).toBe('number');
    expect(result!.eligibility_score).toEqual(85.5);
    expect(typeof result!.readiness_score).toBe('number');
    expect(result!.readiness_score).toEqual(92.0);
    expect(typeof result!.skills_match_percentage).toBe('number');
    expect(result!.skills_match_percentage).toEqual(78.5);
    
    expect(result!.status).toEqual('pending');
    expect(result!.consent_given).toBe(true);
    expect(result!.applied_at).toBeInstanceOf(Date);
    expect(result!.consent_timestamp).toBeInstanceOf(Date);
  });

  it('should return null for non-existent application ID', async () => {
    const result = await getJobApplicationById(99999);
    expect(result).toBeNull();
  });

  it('should return empty array for user with no applications', async () => {
    // Create a user but no applications
    const [user] = await db.insert(usersTable).values(testUser1).returning().execute();
    
    const result = await getJobApplicationsByUser(user.id);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for job with no applications', async () => {
    // Create prerequisite data
    const [org] = await db.insert(organizationsTable).values(testOrg).returning().execute();
    const [creator] = await db.insert(usersTable).values(testCreator).returning().execute();
    
    const [job] = await db.insert(jobRequisitionsTable).values({
      ...testJob,
      organization_id: org.id,
      created_by: creator.id,
      salary_min: testJob.salary_min.toString(),
      salary_max: testJob.salary_max.toString()
    }).returning().execute();

    const result = await getJobApplicationsByJob(job.id);
    expect(result).toHaveLength(0);
  });

  it('should verify database consistency after queries', async () => {
    // Create prerequisite data
    const [org] = await db.insert(organizationsTable).values(testOrg).returning().execute();
    const [user] = await db.insert(usersTable).values(testUser1).returning().execute();
    const [creator] = await db.insert(usersTable).values(testCreator).returning().execute();
    
    const [job] = await db.insert(jobRequisitionsTable).values({
      ...testJob,
      organization_id: org.id,
      created_by: creator.id,
      salary_min: testJob.salary_min.toString(),
      salary_max: testJob.salary_max.toString()
    }).returning().execute();

    const [app] = await db.insert(jobApplicationsTable).values({
      ...testApplication1,
      job_id: job.id,
      user_id: user.id,
      eligibility_score: testApplication1.eligibility_score.toString(),
      readiness_score: testApplication1.readiness_score.toString(),
      skills_match_percentage: testApplication1.skills_match_percentage.toString()
    }).returning().execute();

    // Verify data exists in database with proper types
    const dbResult = await db.select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.id, app.id))
      .execute();

    expect(dbResult).toHaveLength(1);
    expect(dbResult[0].id).toEqual(app.id);
    // In database, numeric fields are stored as strings
    expect(typeof dbResult[0].eligibility_score).toBe('string');
    expect(parseFloat(dbResult[0].eligibility_score)).toEqual(85.5);
    expect(dbResult[0].applied_at).toBeInstanceOf(Date);
  });
});