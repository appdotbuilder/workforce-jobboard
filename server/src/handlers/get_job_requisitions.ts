import { db } from '../db';
import { jobRequisitionsTable } from '../db/schema';
import { type JobRequisition } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export async function getJobRequisitions(): Promise<JobRequisition[]> {
  try {
    // Get all public and active job requisitions
    const results = await db.select()
      .from(jobRequisitionsTable)
      .where(and(
        eq(jobRequisitionsTable.visibility_level, 'public'),
        eq(jobRequisitionsTable.status, 'active')
      ))
      .execute();

    // Convert numeric fields back to numbers and properly type JSON fields
    return results.map(job => ({
      ...job,
      salary_min: job.salary_min ? parseFloat(job.salary_min) : null,
      salary_max: job.salary_max ? parseFloat(job.salary_max) : null,
      allowed_application_paths: job.allowed_application_paths as ('direct' | 'vendor' | 'consent_based')[]
    }));
  } catch (error) {
    console.error('Failed to fetch job requisitions:', error);
    throw error;
  }
}

export async function getJobRequisitionsByOrganization(organizationId: number): Promise<JobRequisition[]> {
  try {
    // Get all job requisitions for a specific organization
    const results = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.organization_id, organizationId))
      .execute();

    // Convert numeric fields back to numbers and properly type JSON fields
    return results.map(job => ({
      ...job,
      salary_min: job.salary_min ? parseFloat(job.salary_min) : null,
      salary_max: job.salary_max ? parseFloat(job.salary_max) : null,
      allowed_application_paths: job.allowed_application_paths as ('direct' | 'vendor' | 'consent_based')[]
    }));
  } catch (error) {
    console.error('Failed to fetch job requisitions by organization:', error);
    throw error;
  }
}

export async function getJobRequisitionById(id: number): Promise<JobRequisition | null> {
  try {
    const results = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const job = results[0];
    
    // Convert numeric fields back to numbers and properly type JSON fields
    return {
      ...job,
      salary_min: job.salary_min ? parseFloat(job.salary_min) : null,
      salary_max: job.salary_max ? parseFloat(job.salary_max) : null,
      allowed_application_paths: job.allowed_application_paths as ('direct' | 'vendor' | 'consent_based')[]
    };
  } catch (error) {
    console.error('Failed to fetch job requisition by id:', error);
    throw error;
  }
}