import { db } from '../db';
import { jobApplicationsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type JobApplication } from '../schema';

export async function getJobApplicationsByUser(userId: number): Promise<JobApplication[]> {
  try {
    const results = await db.select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.user_id, userId))
      .execute();

    // Convert numeric fields back to numbers and cast JSON fields
    return results.map(application => ({
      ...application,
      custom_responses: application.custom_responses as Record<string, string>,
      eligibility_score: parseFloat(application.eligibility_score),
      readiness_score: parseFloat(application.readiness_score),
      skills_match_percentage: parseFloat(application.skills_match_percentage)
    }));
  } catch (error) {
    console.error('Failed to fetch applications by user:', error);
    throw error;
  }
}

export async function getJobApplicationsByJob(jobId: number): Promise<JobApplication[]> {
  try {
    const results = await db.select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.job_id, jobId))
      .execute();

    // Convert numeric fields back to numbers and cast JSON fields
    return results.map(application => ({
      ...application,
      custom_responses: application.custom_responses as Record<string, string>,
      eligibility_score: parseFloat(application.eligibility_score),
      readiness_score: parseFloat(application.readiness_score),
      skills_match_percentage: parseFloat(application.skills_match_percentage)
    }));
  } catch (error) {
    console.error('Failed to fetch applications by job:', error);
    throw error;
  }
}

export async function getJobApplicationById(id: number): Promise<JobApplication | null> {
  try {
    const results = await db.select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const application = results[0];
    // Convert numeric fields back to numbers and cast JSON fields
    return {
      ...application,
      custom_responses: application.custom_responses as Record<string, string>,
      eligibility_score: parseFloat(application.eligibility_score),
      readiness_score: parseFloat(application.readiness_score),
      skills_match_percentage: parseFloat(application.skills_match_percentage)
    };
  } catch (error) {
    console.error('Failed to fetch application by id:', error);
    throw error;
  }
}