import { db } from '../db';
import { jobRequisitionsTable, usersTable, jobApplicationsTable } from '../db/schema';
import { type JobSearchInput, type JobRequisition } from '../schema';
import { and, eq, gte, lte, ilike, inArray, or, sql, desc, not } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

interface JobSearchResult {
  jobs: JobRequisition[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function searchJobs(input: JobSearchInput): Promise<JobSearchResult> {
  try {
    // Calculate offset for pagination
    const offset = (input.page - 1) * input.limit;

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Only show active and public jobs by default
    conditions.push(eq(jobRequisitionsTable.status, 'active'));
    conditions.push(eq(jobRequisitionsTable.visibility_level, 'public'));

    // Keywords search - search in title, description, requirements, and responsibilities
    if (input.keywords) {
      const keywordPattern = `%${input.keywords}%`;
      conditions.push(
        or(
          ilike(jobRequisitionsTable.title, keywordPattern),
          ilike(jobRequisitionsTable.description, keywordPattern),
          ilike(jobRequisitionsTable.requirements, keywordPattern),
          ilike(jobRequisitionsTable.responsibilities, keywordPattern)
        )!
      );
    }

    // Location filtering
    if (input.location) {
      conditions.push(ilike(jobRequisitionsTable.location, `%${input.location}%`));
    }

    // Remote work filtering
    if (input.remote_allowed !== undefined) {
      conditions.push(eq(jobRequisitionsTable.remote_allowed, input.remote_allowed));
    }

    // Employment type filtering
    if (input.employment_types && input.employment_types.length > 0) {
      conditions.push(inArray(jobRequisitionsTable.employment_type, input.employment_types));
    }

    // Salary range filtering
    if (input.salary_min !== undefined) {
      conditions.push(gte(jobRequisitionsTable.salary_max, input.salary_min.toString()));
    }

    if (input.salary_max !== undefined) {
      conditions.push(lte(jobRequisitionsTable.salary_min, input.salary_max.toString()));
    }

    // Organization filtering
    if (input.organization_id) {
      conditions.push(eq(jobRequisitionsTable.organization_id, input.organization_id));
    }

    // Skills matching - check if job requirements contain any of the specified skills
    if (input.skills && input.skills.length > 0) {
      const skillConditions = input.skills.map((skill: string) => 
        ilike(jobRequisitionsTable.requirements, `%${skill}%`)
      );
      conditions.push(or(...skillConditions)!);
    }

    // Build the where condition
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute search query
    const results = await db.select()
      .from(jobRequisitionsTable)
      .where(whereCondition)
      .orderBy(desc(jobRequisitionsTable.published_at))
      .limit(input.limit)
      .offset(offset)
      .execute();

    // Get total count for pagination
    const totalResult = await db.select({ count: sql<string>`count(*)` })
      .from(jobRequisitionsTable)
      .where(whereCondition)
      .execute();
    const total = parseInt(totalResult[0].count);

    // Convert numeric fields and handle JSONB arrays
    const jobs: JobRequisition[] = results.map(job => ({
      ...job,
      salary_min: job.salary_min ? parseFloat(job.salary_min) : null,
      salary_max: job.salary_max ? parseFloat(job.salary_max) : null,
      allowed_application_paths: Array.isArray(job.allowed_application_paths) 
        ? job.allowed_application_paths 
        : JSON.parse(JSON.stringify(job.allowed_application_paths || []))
    }));

    const hasMore = offset + results.length < total;

    return {
      jobs,
      total,
      page: input.page,
      limit: input.limit,
      hasMore
    };

  } catch (error) {
    console.error('Job search failed:', error);
    throw error;
  }
}

export async function getRecommendedJobs(userId: number, limit: number = 10): Promise<JobRequisition[]> {
  try {
    // Get user profile for personalization
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      return [];
    }

    const userProfile = user[0];
    const userSkills = Array.isArray(userProfile.skills) 
      ? userProfile.skills 
      : JSON.parse(JSON.stringify(userProfile.skills || []));
    const preferredLocations = Array.isArray(userProfile.preferred_locations)
      ? userProfile.preferred_locations 
      : JSON.parse(JSON.stringify(userProfile.preferred_locations || []));

    // Get jobs user has already applied to
    const appliedJobs = await db.select({ job_id: jobApplicationsTable.job_id })
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.user_id, userId))
      .execute();

    const appliedJobIds = appliedJobs.map(app => app.job_id);

    // Build recommendation conditions
    const conditions: SQL<unknown>[] = [];

    // Only show active and public jobs
    conditions.push(eq(jobRequisitionsTable.status, 'active'));
    conditions.push(eq(jobRequisitionsTable.visibility_level, 'public'));

    // Exclude already applied jobs
    if (appliedJobIds.length > 0) {
      conditions.push(not(inArray(jobRequisitionsTable.id, appliedJobIds)));
    }

    // Build recommendation scoring conditions - use more specific criteria
    let hasMatchingCriteria = false;

    // Skills matching - only include jobs that match user's skills
    if (userSkills.length > 0) {
      const skillMatches = userSkills.map((skill: string) => 
        ilike(jobRequisitionsTable.requirements, `%${skill}%`)
      );
      conditions.push(or(...skillMatches)!);
      hasMatchingCriteria = true;
    }

    // If no skills to match, use location-based recommendations
    if (!hasMatchingCriteria) {
      // Location matching - prioritize jobs in preferred locations
      if (preferredLocations.length > 0) {
        const locationMatches = preferredLocations.map((location: string) => 
          ilike(jobRequisitionsTable.location, `%${location}%`)
        );
        conditions.push(or(...locationMatches)!);
        hasMatchingCriteria = true;
      }

      // If user location is specified, include jobs in same location
      if (!hasMatchingCriteria && userProfile.location) {
        conditions.push(ilike(jobRequisitionsTable.location, `%${userProfile.location}%`));
        hasMatchingCriteria = true;
      }

      // Include remote jobs if user has no location restrictions
      if (!hasMatchingCriteria && (!userProfile.location || preferredLocations.length === 0)) {
        conditions.push(eq(jobRequisitionsTable.remote_allowed, true));
      }
    }

    // Build the where condition
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute query
    const results = await db.select()
      .from(jobRequisitionsTable)
      .where(whereCondition)
      .orderBy(desc(jobRequisitionsTable.published_at))
      .limit(limit)
      .execute();

    // Convert numeric fields and handle JSONB arrays
    const jobs: JobRequisition[] = results.map(job => ({
      ...job,
      salary_min: job.salary_min ? parseFloat(job.salary_min) : null,
      salary_max: job.salary_max ? parseFloat(job.salary_max) : null,
      allowed_application_paths: Array.isArray(job.allowed_application_paths) 
        ? job.allowed_application_paths 
        : JSON.parse(JSON.stringify(job.allowed_application_paths || []))
    }));

    return jobs;

  } catch (error) {
    console.error('Job recommendations failed:', error);
    throw error;
  }
}