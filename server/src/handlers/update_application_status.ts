import { db } from '../db';
import { jobApplicationsTable } from '../db/schema';
import { type UpdateApplicationStatusInput, type JobApplication } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateApplicationStatus(input: UpdateApplicationStatusInput): Promise<JobApplication | null> {
  try {
    // Update the application status
    const result = await db.update(jobApplicationsTable)
      .set({
        status: input.status,
        last_updated: new Date()
      })
      .where(eq(jobApplicationsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields and JSONB fields back to correct types before returning
    const application = result[0];
    return {
      ...application,
      eligibility_score: parseFloat(application.eligibility_score),
      readiness_score: parseFloat(application.readiness_score),
      skills_match_percentage: parseFloat(application.skills_match_percentage),
      custom_responses: application.custom_responses as Record<string, string>
    };
  } catch (error) {
    console.error('Application status update failed:', error);
    throw error;
  }
}

export async function bulkUpdateApplicationStatus(
  applicationIds: number[], 
  status: string
): Promise<JobApplication[]> {
  try {
    // Handle empty array case
    if (applicationIds.length === 0) {
      return [];
    }

    // For bulk updates, we'll do individual updates since Drizzle doesn't 
    // support IN clause for updates directly in a single query
    const updates = await Promise.all(
      applicationIds.map(id => 
        db.update(jobApplicationsTable)
          .set({
            status: status as any, // Cast to satisfy type system
            last_updated: new Date()
          })
          .where(eq(jobApplicationsTable.id, id))
          .returning()
          .execute()
      )
    );

    // Flatten results and convert numeric and JSONB fields
    const applications = updates.flat().map(application => ({
      ...application,
      eligibility_score: parseFloat(application.eligibility_score),
      readiness_score: parseFloat(application.readiness_score),
      skills_match_percentage: parseFloat(application.skills_match_percentage),
      custom_responses: application.custom_responses as Record<string, string>
    }));

    return applications;
  } catch (error) {
    console.error('Bulk application status update failed:', error);
    throw error;
  }
}