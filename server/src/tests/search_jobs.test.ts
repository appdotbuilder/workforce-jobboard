import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, usersTable, jobRequisitionsTable, jobApplicationsTable } from '../db/schema';
import { type JobSearchInput, type CreateOrganizationInput, type CreateUserInput, type CreateJobRequisitionInput } from '../schema';
import { searchJobs, getRecommendedJobs } from '../handlers/search_jobs';
import { eq } from 'drizzle-orm';

// Test data
const testOrg: CreateOrganizationInput = {
  name: 'Test Company',
  slug: 'test-company',
  type: 'startup'
};

const testUser: CreateUserInput = {
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  location: 'San Francisco',
  preferred_locations: ['San Francisco', 'New York'],
  skills: ['JavaScript', 'React', 'Node.js']
};

const createTestJob = (overrides: Partial<CreateJobRequisitionInput> = {}): CreateJobRequisitionInput => ({
  organization_id: 1,
  title: 'Software Engineer',
  description: 'Build amazing web applications',
  requirements: 'JavaScript, React, 2+ years experience',
  responsibilities: 'Develop frontend components',
  location: 'San Francisco',
  remote_allowed: false,
  employment_type: 'full-time',
  salary_currency: 'USD',
  visibility_level: 'public',
  allowed_application_paths: ['direct'],
  created_by: 1,
  ...overrides
});

describe('searchJobs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty results when no jobs exist', async () => {
    const searchInput: JobSearchInput = {
      page: 1,
      limit: 20
    };

    const result = await searchJobs(searchInput);

    expect(result.jobs).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.hasMore).toBe(false);
  });

  it('should return active public jobs', async () => {
    // Create test organization
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create active job
    const activeJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Active Job'
    });

    await db.insert(jobRequisitionsTable)
      .values({
        ...activeJob,
        status: 'active' as const,
        published_at: new Date(),
        salary_min: activeJob.salary_min?.toString(),
        salary_max: activeJob.salary_max?.toString()
      })
      .execute();

    // Create draft job (should not appear)
    const draftJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Draft Job'
    });

    await db.insert(jobRequisitionsTable)
      .values({
        ...draftJob,
        status: 'draft' as const,
        salary_min: draftJob.salary_min?.toString(),
        salary_max: draftJob.salary_max?.toString()
      })
      .execute();

    const searchInput: JobSearchInput = {
      page: 1,
      limit: 20
    };

    const result = await searchJobs(searchInput);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Active Job');
    expect(result.jobs[0].status).toBe('active');
    expect(result.total).toBe(1);
  });

  it('should filter by keywords', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create jobs with different titles and requirements
    const reactJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'React Developer Position',
      description: 'Work with React framework and build UIs',
      requirements: 'React experience required, TypeScript preferred'
    });

    const pythonJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Python Backend Engineer',
      description: 'Work with Python language and Django',
      requirements: 'Python experience required, Django preferred'
    });

    await db.insert(jobRequisitionsTable)
      .values([
        { 
          ...reactJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: reactJob.salary_min?.toString(),
          salary_max: reactJob.salary_max?.toString()
        },
        { 
          ...pythonJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: pythonJob.salary_min?.toString(),
          salary_max: pythonJob.salary_max?.toString()
        }
      ])
      .execute();

    const searchInput: JobSearchInput = {
      keywords: 'React',
      page: 1,
      limit: 20
    };

    const result = await searchJobs(searchInput);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('React Developer Position');
  });

  it('should filter by location', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const sfJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      location: 'San Francisco, CA'
    });

    const nyJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      location: 'New York, NY'
    });

    await db.insert(jobRequisitionsTable)
      .values([
        { 
          ...sfJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: sfJob.salary_min?.toString(),
          salary_max: sfJob.salary_max?.toString()
        },
        { 
          ...nyJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: nyJob.salary_min?.toString(),
          salary_max: nyJob.salary_max?.toString()
        }
      ])
      .execute();

    const searchInput: JobSearchInput = {
      location: 'San Francisco',
      page: 1,
      limit: 20
    };

    const result = await searchJobs(searchInput);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].location).toContain('San Francisco');
  });

  it('should filter by remote work option', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const remoteJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Remote Job',
      remote_allowed: true
    });

    const onsiteJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Onsite Job',
      remote_allowed: false
    });

    await db.insert(jobRequisitionsTable)
      .values([
        { 
          ...remoteJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: remoteJob.salary_min?.toString(),
          salary_max: remoteJob.salary_max?.toString()
        },
        { 
          ...onsiteJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: onsiteJob.salary_min?.toString(),
          salary_max: onsiteJob.salary_max?.toString()
        }
      ])
      .execute();

    const searchInput: JobSearchInput = {
      remote_allowed: true,
      page: 1,
      limit: 20
    };

    const result = await searchJobs(searchInput);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Remote Job');
    expect(result.jobs[0].remote_allowed).toBe(true);
  });

  it('should filter by salary range', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const highPayJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'High Pay Job',
      salary_min: 100000,
      salary_max: 150000
    });

    const lowPayJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Low Pay Job',
      salary_min: 50000,
      salary_max: 70000
    });

    await db.insert(jobRequisitionsTable)
      .values([
        { 
          ...highPayJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: highPayJob.salary_min?.toString(),
          salary_max: highPayJob.salary_max?.toString()
        },
        { 
          ...lowPayJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: lowPayJob.salary_min?.toString(),
          salary_max: lowPayJob.salary_max?.toString()
        }
      ])
      .execute();

    const searchInput: JobSearchInput = {
      salary_min: 80000,
      page: 1,
      limit: 20
    };

    const result = await searchJobs(searchInput);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('High Pay Job');
    expect(result.jobs[0].salary_max).toBe(150000);
  });

  it('should handle pagination correctly', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create 5 jobs
    const jobs = Array.from({ length: 5 }, (_, i) => 
      createTestJob({
        organization_id: orgResult[0].id,
        created_by: userResult[0].id,
        title: `Job ${i + 1}`
      })
    );

    await db.insert(jobRequisitionsTable)
      .values(jobs.map(job => ({ 
        ...job, 
        status: 'active' as const, 
        published_at: new Date(),
        salary_min: job.salary_min?.toString(),
        salary_max: job.salary_max?.toString()
      })))
      .execute();

    // Test first page
    const firstPage = await searchJobs({ page: 1, limit: 2 });
    expect(firstPage.jobs).toHaveLength(2);
    expect(firstPage.total).toBe(5);
    expect(firstPage.hasMore).toBe(true);

    // Test second page
    const secondPage = await searchJobs({ page: 2, limit: 2 });
    expect(secondPage.jobs).toHaveLength(2);
    expect(secondPage.total).toBe(5);
    expect(secondPage.hasMore).toBe(true);

    // Test last page
    const lastPage = await searchJobs({ page: 3, limit: 2 });
    expect(lastPage.jobs).toHaveLength(1);
    expect(lastPage.total).toBe(5);
    expect(lastPage.hasMore).toBe(false);
  });
});

describe('getRecommendedJobs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for non-existent user', async () => {
    const recommendations = await getRecommendedJobs(999);
    expect(recommendations).toHaveLength(0);
  });

  it('should recommend jobs based on user skills', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    // Create user with specific skills
    const skillsUser = await db.insert(usersTable)
      .values({
        ...testUser,
        skills: ['React', 'JavaScript']
      })
      .returning()
      .execute();

    // Create jobs - one matching user skills, one not matching
    const reactJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: skillsUser[0].id,
      title: 'React Developer',
      requirements: 'React and JavaScript experience required'
    });

    const javaJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: skillsUser[0].id,
      title: 'Java Developer',
      requirements: 'Java and Spring Boot experience only'
    });

    await db.insert(jobRequisitionsTable)
      .values([
        { 
          ...reactJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: reactJob.salary_min?.toString(),
          salary_max: reactJob.salary_max?.toString()
        },
        { 
          ...javaJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: javaJob.salary_min?.toString(),
          salary_max: javaJob.salary_max?.toString()
        }
      ])
      .execute();

    const recommendations = await getRecommendedJobs(skillsUser[0].id);

    // Should only return React job due to skills match
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].title).toBe('React Developer');
  });

  it('should recommend jobs in preferred locations', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const locationUser = await db.insert(usersTable)
      .values({
        ...testUser,
        location: null, // Clear current location
        preferred_locations: ['New York'], // Only prefer NY
        skills: [] // Clear skills to avoid skills-based matching
      })
      .returning()
      .execute();

    const nyJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: locationUser[0].id,
      title: 'NY Developer',
      location: 'New York, NY',
      requirements: 'General development experience'
    });

    const laJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: locationUser[0].id,
      title: 'LA Developer',
      location: 'Los Angeles, CA',
      requirements: 'General development experience'
    });

    await db.insert(jobRequisitionsTable)
      .values([
        { 
          ...nyJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: nyJob.salary_min?.toString(),
          salary_max: nyJob.salary_max?.toString()
        },
        { 
          ...laJob, 
          status: 'active' as const, 
          published_at: new Date(),
          salary_min: laJob.salary_min?.toString(),
          salary_max: laJob.salary_max?.toString()
        }
      ])
      .execute();

    const recommendations = await getRecommendedJobs(locationUser[0].id);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].title).toBe('NY Developer');
  });

  it('should exclude already applied jobs', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const testJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userResult[0].id,
      title: 'Applied Job'
    });

    const jobResult = await db.insert(jobRequisitionsTable)
      .values({
        ...testJob,
        status: 'active' as const,
        published_at: new Date(),
        salary_min: testJob.salary_min?.toString(),
        salary_max: testJob.salary_max?.toString()
      })
      .returning()
      .execute();

    // Create application
    await db.insert(jobApplicationsTable)
      .values({
        job_id: jobResult[0].id,
        user_id: userResult[0].id,
        application_path: 'direct',
        eligibility_score: '75',
        readiness_score: '80',
        skills_match_percentage: '70',
        consent_given: true
      })
      .execute();

    const recommendations = await getRecommendedJobs(userResult[0].id);

    expect(recommendations).toHaveLength(0);
  });

  it('should recommend remote jobs for users without location preferences', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userWithoutLocation = await db.insert(usersTable)
      .values({
        ...testUser,
        location: null,
        preferred_locations: []
      })
      .returning()
      .execute();

    const remoteJob = createTestJob({
      organization_id: orgResult[0].id,
      created_by: userWithoutLocation[0].id,
      title: 'Remote Developer',
      remote_allowed: true
    });

    await db.insert(jobRequisitionsTable)
      .values({
        ...remoteJob,
        status: 'active' as const,
        published_at: new Date(),
        salary_min: remoteJob.salary_min?.toString(),
        salary_max: remoteJob.salary_max?.toString()
      })
      .execute();

    const recommendations = await getRecommendedJobs(userWithoutLocation[0].id);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].title).toBe('Remote Developer');
    expect(recommendations[0].remote_allowed).toBe(true);
  });

  it('should respect limit parameter', async () => {
    // Create test data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrg)
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create 5 jobs
    const jobs = Array.from({ length: 5 }, (_, i) => 
      createTestJob({
        organization_id: orgResult[0].id,
        created_by: userResult[0].id,
        title: `Job ${i + 1}`,
        requirements: 'JavaScript, React' // Matches user skills
      })
    );

    await db.insert(jobRequisitionsTable)
      .values(jobs.map(job => ({ 
        ...job, 
        status: 'active' as const, 
        published_at: new Date(),
        salary_min: job.salary_min?.toString(),
        salary_max: job.salary_max?.toString()
      })))
      .execute();

    const recommendations = await getRecommendedJobs(userResult[0].id, 3);

    expect(recommendations).toHaveLength(3);
  });
});