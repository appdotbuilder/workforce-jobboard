import { db } from '../db';
import { jobRequisitionsTable, organizationsTable } from '../db/schema';
import { type UpdateJobRequisitionInput, type JobRequisition } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateJobRequisition(input: UpdateJobRequisitionInput): Promise<JobRequisition | null> {
  try {
    // First, check if the job requisition exists
    const existingJob = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, input.id))
      .execute();

    if (existingJob.length === 0) {
      return null;
    }

    // Build update values object, excluding undefined fields
    const updateValues: any = {};
    
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.requirements !== undefined) updateValues.requirements = input.requirements;
    if (input.responsibilities !== undefined) updateValues.responsibilities = input.responsibilities;
    if (input.location !== undefined) updateValues.location = input.location;
    if (input.remote_allowed !== undefined) updateValues.remote_allowed = input.remote_allowed;
    if (input.employment_type !== undefined) updateValues.employment_type = input.employment_type;
    if (input.department !== undefined) updateValues.department = input.department;
    if (input.salary_min !== undefined) updateValues.salary_min = input.salary_min?.toString();
    if (input.salary_max !== undefined) updateValues.salary_max = input.salary_max?.toString();
    if (input.salary_currency !== undefined) updateValues.salary_currency = input.salary_currency;
    if (input.compensation_details !== undefined) updateValues.compensation_details = input.compensation_details;
    if (input.benefits_summary !== undefined) updateValues.benefits_summary = input.benefits_summary;
    if (input.visibility_level !== undefined) updateValues.visibility_level = input.visibility_level;
    if (input.allowed_application_paths !== undefined) updateValues.allowed_application_paths = input.allowed_application_paths;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.application_deadline !== undefined) updateValues.application_deadline = input.application_deadline;

    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    // Update the job requisition
    const result = await db.update(jobRequisitionsTable)
      .set(updateValues)
      .where(eq(jobRequisitionsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    const updatedJob = result[0];

    // Convert numeric fields back to numbers - jsonb fields are already parsed by Drizzle
    return {
      ...updatedJob,
      salary_min: updatedJob.salary_min ? parseFloat(updatedJob.salary_min) : null,
      salary_max: updatedJob.salary_max ? parseFloat(updatedJob.salary_max) : null,
      allowed_application_paths: updatedJob.allowed_application_paths as ("direct" | "vendor" | "consent_based")[]
    };
  } catch (error) {
    console.error('Job requisition update failed:', error);
    throw error;
  }
}

export async function publishJobRequisition(id: number): Promise<JobRequisition | null> {
  try {
    // First, check if the job requisition exists and is in draft status
    const existingJobs = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, id))
      .execute();

    if (existingJobs.length === 0) {
      return null;
    }

    const existingJob = existingJobs[0];

    // Only allow publishing from draft status
    if (existingJob.status !== 'draft') {
      return null;
    }

    // Validate job completeness - basic required fields should be present
    if (!existingJob.title || !existingJob.description || !existingJob.requirements || !existingJob.responsibilities) {
      return null;
    }

    // Update to published status
    const result = await db.update(jobRequisitionsTable)
      .set({
        status: 'active',
        published_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(jobRequisitionsTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      return null;
    }

    const publishedJob = result[0];

    // Convert numeric fields back to numbers - jsonb fields are already parsed by Drizzle
    return {
      ...publishedJob,
      salary_min: publishedJob.salary_min ? parseFloat(publishedJob.salary_min) : null,
      salary_max: publishedJob.salary_max ? parseFloat(publishedJob.salary_max) : null,
      allowed_application_paths: publishedJob.allowed_application_paths as ("direct" | "vendor" | "consent_based")[]
    };
  } catch (error) {
    console.error('Job requisition publishing failed:', error);
    throw error;
  }
}