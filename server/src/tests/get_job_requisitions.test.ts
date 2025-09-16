import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, usersTable, jobRequisitionsTable } from '../db/schema';
import { 
  getJobRequisitions, 
  getJobRequisitionsByOrganization, 
  getJobRequisitionById 
} from '../handlers/get_job_requisitions';

describe('getJobRequisitions handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  async function createTestData() {
    // Create test organizations
    const organizations = await db.insert(organizationsTable)
      .values([
        {
          name: 'Tech Corp',
          slug: 'tech-corp',
          description: 'Technology company',
          type: 'enterprise',
          logo_url: 'https://example.com/logo1.png',
          website_url: 'https://techcorp.com'
        },
        {
          name: 'Startup Inc',
          slug: 'startup-inc',
          description: 'Innovative startup',
          type: 'startup',
          logo_url: null,
          website_url: null
        }
      ])
      .returning()
      .execute();

    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'recruiter@example.com',
        first_name: 'John',
        last_name: 'Recruiter',
        phone: '+1234567890',
        resume_url: null,
        linkedin_url: null,
        portfolio_url: null,
        location: 'San Francisco',
        preferred_locations: ['San Francisco', 'New York'],
        skills: ['recruiting', 'hr'],
        experience_years: 5
      })
      .returning()
      .execute();

    // Create test job requisitions with various statuses and visibility levels
    const jobs = await db.insert(jobRequisitionsTable)
      .values([
        {
          organization_id: organizations[0].id,
          title: 'Senior Software Engineer',
          description: 'We are looking for a senior software engineer...',
          requirements: 'Bachelor degree in CS, 5+ years experience',
          responsibilities: 'Design and implement software solutions',
          location: 'San Francisco, CA',
          remote_allowed: true,
          employment_type: 'full-time',
          department: 'Engineering',
          salary_min: '120000.00',
          salary_max: '180000.00',
          salary_currency: 'USD',
          compensation_details: 'Competitive salary with equity',
          benefits_summary: 'Health, dental, vision, 401k',
          visibility_level: 'public',
          allowed_application_paths: ['direct', 'vendor'],
          status: 'active',
          published_at: new Date(),
          application_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          external_id: 'EXT-001',
          created_by: users[0].id
        },
        {
          organization_id: organizations[0].id,
          title: 'Product Manager',
          description: 'Product management role...',
          requirements: 'MBA or equivalent, product experience',
          responsibilities: 'Lead product strategy and development',
          location: 'New York, NY',
          remote_allowed: false,
          employment_type: 'full-time',
          department: 'Product',
          salary_min: '100000.00',
          salary_max: '150000.00',
          salary_currency: 'USD',
          compensation_details: null,
          benefits_summary: null,
          visibility_level: 'internal',
          allowed_application_paths: ['direct'],
          status: 'active',
          published_at: new Date(),
          application_deadline: null,
          external_id: null,
          created_by: users[0].id
        },
        {
          organization_id: organizations[1].id,
          title: 'Frontend Developer',
          description: 'Frontend development position...',
          requirements: 'React, TypeScript, 3+ years experience',
          responsibilities: 'Build user interfaces',
          location: 'Remote',
          remote_allowed: true,
          employment_type: 'contract',
          department: 'Engineering',
          salary_min: null,
          salary_max: null,
          salary_currency: 'USD',
          compensation_details: 'Hourly rate: $50-80/hour',
          benefits_summary: null,
          visibility_level: 'public',
          allowed_application_paths: ['direct'],
          status: 'draft',
          published_at: null,
          application_deadline: null,
          external_id: null,
          created_by: users[0].id
        },
        {
          organization_id: organizations[1].id,
          title: 'Data Scientist',
          description: 'Data science role...',
          requirements: 'PhD in related field, ML experience',
          responsibilities: 'Analyze data and build models',
          location: 'Austin, TX',
          remote_allowed: true,
          employment_type: 'full-time',
          department: 'Data',
          salary_min: '90000.00',
          salary_max: '130000.00',
          salary_currency: 'USD',
          compensation_details: null,
          benefits_summary: 'Standard benefits package',
          visibility_level: 'public',
          allowed_application_paths: ['direct', 'consent_based'],
          status: 'active',
          published_at: new Date(),
          application_deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
          external_id: 'DATA-001',
          created_by: users[0].id
        }
      ])
      .returning()
      .execute();

    return { organizations, users, jobs };
  }

  describe('getJobRequisitions', () => {
    it('should return only public and active job requisitions', async () => {
      await createTestData();

      const result = await getJobRequisitions();

      // Should return 2 jobs: Senior Software Engineer and Data Scientist
      expect(result).toHaveLength(2);
      
      // Check that all returned jobs are public and active
      result.forEach(job => {
        expect(job.visibility_level).toEqual('public');
        expect(job.status).toEqual('active');
      });

      // Verify specific jobs are returned
      const titles = result.map(job => job.title).sort();
      expect(titles).toEqual(['Data Scientist', 'Senior Software Engineer']);
    });

    it('should convert numeric salary fields correctly', async () => {
      await createTestData();

      const result = await getJobRequisitions();

      const engineerJob = result.find(job => job.title === 'Senior Software Engineer');
      expect(engineerJob).toBeDefined();
      expect(typeof engineerJob!.salary_min).toBe('number');
      expect(typeof engineerJob!.salary_max).toBe('number');
      expect(engineerJob!.salary_min).toEqual(120000);
      expect(engineerJob!.salary_max).toEqual(180000);

      const dataScientistJob = result.find(job => job.title === 'Data Scientist');
      expect(dataScientistJob).toBeDefined();
      expect(typeof dataScientistJob!.salary_min).toBe('number');
      expect(typeof dataScientistJob!.salary_max).toBe('number');
      expect(dataScientistJob!.salary_min).toEqual(90000);
      expect(dataScientistJob!.salary_max).toEqual(130000);
    });

    it('should handle null salary values correctly', async () => {
      const { users } = await createTestData();

      // Create a job with null salary values but public/active
      const orgs = await db.select().from(organizationsTable).execute();
      
      await db.insert(jobRequisitionsTable)
        .values({
          organization_id: orgs[0].id,
          title: 'Internship',
          description: 'Internship position',
          requirements: 'Student status',
          responsibilities: 'Learn and contribute',
          location: 'San Francisco, CA',
          remote_allowed: false,
          employment_type: 'internship',
          department: 'Engineering',
          salary_min: null,
          salary_max: null,
          salary_currency: 'USD',
          compensation_details: 'Stipend provided',
          benefits_summary: null,
          visibility_level: 'public',
          allowed_application_paths: ['direct'],
          status: 'active',
          published_at: new Date(),
          application_deadline: null,
          external_id: null,
          created_by: users[0].id
        })
        .execute();

      const result = await getJobRequisitions();
      const internshipJob = result.find(job => job.title === 'Internship');
      
      expect(internshipJob).toBeDefined();
      expect(internshipJob!.salary_min).toBeNull();
      expect(internshipJob!.salary_max).toBeNull();
    });

    it('should return empty array when no public active jobs exist', async () => {
      // Create only draft or internal jobs
      const { organizations, users } = await createTestData();
      
      // Clear existing jobs and create only non-public or non-active jobs
      await db.delete(jobRequisitionsTable).execute();
      
      await db.insert(jobRequisitionsTable)
        .values([
          {
            organization_id: organizations[0].id,
            title: 'Draft Job',
            description: 'Draft job description',
            requirements: 'Requirements',
            responsibilities: 'Responsibilities',
            location: 'San Francisco, CA',
            remote_allowed: false,
            employment_type: 'full-time',
            department: 'Engineering',
            salary_min: null,
            salary_max: null,
            salary_currency: 'USD',
            compensation_details: null,
            benefits_summary: null,
            visibility_level: 'public',
            allowed_application_paths: ['direct'],
            status: 'draft',
            published_at: null,
            application_deadline: null,
            external_id: null,
            created_by: users[0].id
          },
          {
            organization_id: organizations[0].id,
            title: 'Internal Job',
            description: 'Internal job description',
            requirements: 'Requirements',
            responsibilities: 'Responsibilities',
            location: 'New York, NY',
            remote_allowed: false,
            employment_type: 'full-time',
            department: 'HR',
            salary_min: null,
            salary_max: null,
            salary_currency: 'USD',
            compensation_details: null,
            benefits_summary: null,
            visibility_level: 'internal',
            allowed_application_paths: ['direct'],
            status: 'active',
            published_at: new Date(),
            application_deadline: null,
            external_id: null,
            created_by: users[0].id
          }
        ])
        .execute();

      const result = await getJobRequisitions();
      expect(result).toHaveLength(0);
    });
  });

  describe('getJobRequisitionsByOrganization', () => {
    it('should return all jobs for a specific organization', async () => {
      const { organizations } = await createTestData();

      const result = await getJobRequisitionsByOrganization(organizations[0].id);

      // Should return 2 jobs for Tech Corp (both active and internal)
      expect(result).toHaveLength(2);
      
      result.forEach(job => {
        expect(job.organization_id).toEqual(organizations[0].id);
      });

      const titles = result.map(job => job.title).sort();
      expect(titles).toEqual(['Product Manager', 'Senior Software Engineer']);
    });

    it('should return jobs with all visibility levels and statuses', async () => {
      const { organizations } = await createTestData();

      const result = await getJobRequisitionsByOrganization(organizations[1].id);

      // Should return 2 jobs for Startup Inc (draft and active)
      expect(result).toHaveLength(2);
      
      const statuses = result.map(job => job.status).sort();
      expect(statuses).toEqual(['active', 'draft']);

      const visibilityLevels = result.map(job => job.visibility_level);
      expect(visibilityLevels).toContain('public');
    });

    it('should return empty array for organization with no jobs', async () => {
      await createTestData();
      
      // Create a new organization with no jobs
      const newOrg = await db.insert(organizationsTable)
        .values({
          name: 'Empty Corp',
          slug: 'empty-corp',
          description: 'No jobs here',
          type: 'startup',
          logo_url: null,
          website_url: null
        })
        .returning()
        .execute();

      const result = await getJobRequisitionsByOrganization(newOrg[0].id);
      expect(result).toHaveLength(0);
    });

    it('should convert numeric fields correctly', async () => {
      const { organizations } = await createTestData();

      const result = await getJobRequisitionsByOrganization(organizations[0].id);

      const engineerJob = result.find(job => job.title === 'Senior Software Engineer');
      expect(engineerJob).toBeDefined();
      expect(typeof engineerJob!.salary_min).toBe('number');
      expect(typeof engineerJob!.salary_max).toBe('number');
      expect(engineerJob!.salary_min).toEqual(120000);
      expect(engineerJob!.salary_max).toEqual(180000);
    });
  });

  describe('getJobRequisitionById', () => {
    it('should return a specific job requisition by id', async () => {
      const { jobs } = await createTestData();
      const targetJob = jobs[0]; // Senior Software Engineer

      const result = await getJobRequisitionById(targetJob.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(targetJob.id);
      expect(result!.title).toEqual('Senior Software Engineer');
      expect(result!.description).toEqual('We are looking for a senior software engineer...');
      expect(result!.location).toEqual('San Francisco, CA');
      expect(result!.remote_allowed).toBe(true);
    });

    it('should convert numeric salary fields correctly', async () => {
      const { jobs } = await createTestData();
      const targetJob = jobs[0]; // Senior Software Engineer with salary

      const result = await getJobRequisitionById(targetJob.id);

      expect(result).toBeDefined();
      expect(typeof result!.salary_min).toBe('number');
      expect(typeof result!.salary_max).toBe('number');
      expect(result!.salary_min).toEqual(120000);
      expect(result!.salary_max).toEqual(180000);
    });

    it('should handle null salary values correctly', async () => {
      const { jobs } = await createTestData();
      const targetJob = jobs[2]; // Frontend Developer with null salaries

      const result = await getJobRequisitionById(targetJob.id);

      expect(result).toBeDefined();
      expect(result!.salary_min).toBeNull();
      expect(result!.salary_max).toBeNull();
    });

    it('should return null for non-existent job id', async () => {
      await createTestData();

      const result = await getJobRequisitionById(99999);
      expect(result).toBeNull();
    });

    it('should include all job requisition fields', async () => {
      const { jobs } = await createTestData();
      const targetJob = jobs[0];

      const result = await getJobRequisitionById(targetJob.id);

      expect(result).toBeDefined();
      
      // Verify all required fields are present
      expect(result!.id).toBeDefined();
      expect(result!.organization_id).toBeDefined();
      expect(result!.title).toBeDefined();
      expect(result!.description).toBeDefined();
      expect(result!.requirements).toBeDefined();
      expect(result!.responsibilities).toBeDefined();
      expect(result!.location).toBeDefined();
      expect(result!.remote_allowed).toBeDefined();
      expect(result!.employment_type).toBeDefined();
      expect(result!.salary_currency).toBeDefined();
      expect(result!.visibility_level).toBeDefined();
      expect(result!.allowed_application_paths).toBeDefined();
      expect(result!.status).toBeDefined();
      expect(result!.created_by).toBeDefined();
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);

      // Verify optional fields can be null
      expect(result!.department).toEqual('Engineering');
      expect(result!.compensation_details).toEqual('Competitive salary with equity');
      expect(result!.benefits_summary).toEqual('Health, dental, vision, 401k');
      expect(result!.published_at).toBeInstanceOf(Date);
      expect(result!.application_deadline).toBeInstanceOf(Date);
      expect(result!.external_id).toEqual('EXT-001');
    });
  });
});