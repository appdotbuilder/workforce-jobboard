import { db } from '../db';
import { jobApplicationsTable, jobRequisitionsTable, usersTable, vendorsTable } from '../db/schema';
import { type CreateJobApplicationInput, type JobApplication } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export async function createJobApplication(input: CreateJobApplicationInput): Promise<JobApplication> {
  try {
    // Validate that the job exists and get job details
    const jobResults = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, input.job_id))
      .execute();

    if (jobResults.length === 0) {
      throw new Error('Job not found');
    }

    const job = jobResults[0];

    // Validate that the user exists
    const userResults = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userResults.length === 0) {
      throw new Error('User not found');
    }

    // Validate vendor if provided
    if (input.vendor_id) {
      const vendorResults = await db.select()
        .from(vendorsTable)
        .where(and(
          eq(vendorsTable.id, input.vendor_id),
          eq(vendorsTable.is_active, true)
        ))
        .execute();

      if (vendorResults.length === 0) {
        throw new Error('Vendor not found or inactive');
      }
    }

    // Check if application already exists
    const existingApplications = await db.select()
      .from(jobApplicationsTable)
      .where(and(
        eq(jobApplicationsTable.job_id, input.job_id),
        eq(jobApplicationsTable.user_id, input.user_id)
      ))
      .execute();

    if (existingApplications.length > 0) {
      throw new Error('Application already exists for this job');
    }

    // Validate application path permissions
    const allowedPaths = job.allowed_application_paths as string[];
    if (!allowedPaths.includes(input.application_path)) {
      throw new Error('Application path not allowed for this job');
    }

    // Calculate scores
    const eligibilityScore = await calculateEligibilityScore(input.user_id, input.job_id);
    const readinessScore = await calculateReadinessScore(input.user_id);
    const skillsMatchPercentage = await calculateSkillsMatch(input.user_id, input.job_id);

    // Set consent timestamp if consent is given
    const consentTimestamp = input.consent_given ? new Date() : null;

    // Create the application
    const result = await db.insert(jobApplicationsTable)
      .values({
        job_id: input.job_id,
        user_id: input.user_id,
        application_path: input.application_path,
        vendor_id: input.vendor_id || null,
        cover_letter: input.cover_letter || null,
        resume_url: input.resume_url || null,
        custom_responses: JSON.stringify(input.custom_responses),
        eligibility_score: eligibilityScore.toString(),
        readiness_score: readinessScore.toString(),
        skills_match_percentage: skillsMatchPercentage.toString(),
        consent_given: input.consent_given,
        consent_timestamp: consentTimestamp
      })
      .returning()
      .execute();

    const application = result[0];

    // Convert numeric fields back to numbers
    return {
      ...application,
      eligibility_score: parseFloat(application.eligibility_score),
      readiness_score: parseFloat(application.readiness_score),
      skills_match_percentage: parseFloat(application.skills_match_percentage),
      custom_responses: typeof application.custom_responses === 'string' 
        ? JSON.parse(application.custom_responses) 
        : application.custom_responses
    };
  } catch (error) {
    console.error('Job application creation failed:', error);
    throw error;
  }
}

export async function calculateEligibilityScore(userId: number, jobId: number): Promise<number> {
  try {
    // Get user and job details
    const userResults = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    const jobResults = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, jobId))
      .execute();

    if (userResults.length === 0 || jobResults.length === 0) {
      return 0;
    }

    const user = userResults[0];
    const job = jobResults[0];

    let score = 0;

    // Location matching (20 points max)
    const userLocation = user.location?.toLowerCase() || '';
    const jobLocation = job.location?.toLowerCase() || '';
    const preferredLocations = (user.preferred_locations as string[]) || [];
    
    if (job.remote_allowed) {
      score += 20; // Full points if remote is allowed
    } else if (userLocation && jobLocation && userLocation.includes(jobLocation)) {
      score += 20; // Full points if user location matches job location
    } else if (preferredLocations.some(loc => loc.toLowerCase().includes(jobLocation))) {
      score += 15; // Partial points if preferred location matches
    }

    // Experience matching (30 points max)
    const userExperience = user.experience_years || 0;
    // Basic experience scoring - could be enhanced with more sophisticated logic
    if (userExperience >= 5) {
      score += 30;
    } else if (userExperience >= 2) {
      score += 20;
    } else if (userExperience >= 1) {
      score += 10;
    }

    // Skills matching (40 points max)
    const userSkills = (user.skills as string[]) || [];
    const skillsMatchScore = await calculateSkillsMatch(userId, jobId);
    score += Math.round(skillsMatchScore * 0.4); // Convert percentage to points out of 40

    // Profile completeness bonus (10 points max)
    let completenessBonus = 0;
    if (user.resume_url) completenessBonus += 3;
    if (user.linkedin_url) completenessBonus += 2;
    if (user.portfolio_url) completenessBonus += 2;
    if (userSkills.length > 0) completenessBonus += 3;
    
    score += completenessBonus;

    // Ensure score is between 0 and 100
    return Math.min(Math.max(score, 0), 100);
  } catch (error) {
    console.error('Eligibility score calculation failed:', error);
    return 0;
  }
}

export async function calculateReadinessScore(userId: number): Promise<number> {
  try {
    const userResults = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (userResults.length === 0) {
      return 0;
    }

    const user = userResults[0];
    let score = 0;

    // Basic profile information (30 points max)
    if (user.first_name && user.last_name) score += 10;
    if (user.email) score += 10;
    if (user.phone) score += 10;

    // Professional details (40 points max)
    if (user.resume_url) score += 20;
    if (user.experience_years !== null) score += 10;
    if (user.location) score += 10;

    // Skills and preferences (20 points max)
    const userSkills = (user.skills as string[]) || [];
    const preferredLocations = (user.preferred_locations as string[]) || [];
    
    if (userSkills.length > 0) score += 10;
    if (preferredLocations.length > 0) score += 5;

    // Additional profile links (10 points max)
    if (user.linkedin_url) score += 5;
    if (user.portfolio_url) score += 5;

    // Ensure score is between 0 and 100
    return Math.min(Math.max(score, 0), 100);
  } catch (error) {
    console.error('Readiness score calculation failed:', error);
    return 0;
  }
}

async function calculateSkillsMatch(userId: number, jobId: number): Promise<number> {
  try {
    const userResults = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    const jobResults = await db.select()
      .from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.id, jobId))
      .execute();

    if (userResults.length === 0 || jobResults.length === 0) {
      return 0;
    }

    const user = userResults[0];
    const job = jobResults[0];

    const userSkills = ((user.skills as string[]) || []).map(skill => skill.toLowerCase().trim());
    
    if (userSkills.length === 0) {
      return 0;
    }

    // Extract skills from job requirements and description
    const jobText = `${job.requirements} ${job.description}`.toLowerCase();
    
    // Count matching skills
    let matchingSkills = 0;
    for (const skill of userSkills) {
      if (skill && jobText.includes(skill)) {
        matchingSkills++;
      }
    }

    // Calculate percentage
    const percentage = (matchingSkills / userSkills.length) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  } catch (error) {
    console.error('Skills match calculation failed:', error);
    return 0;
  }
}