import { z } from 'zod';

// Enums for various status and type fields
export const jobStatusEnum = z.enum(['draft', 'active', 'paused', 'closed', 'archived']);
export const visibilityLevelEnum = z.enum(['public', 'internal', 'restricted', 'private']);
export const applicationPathEnum = z.enum(['direct', 'vendor', 'consent_based']);
export const applicationStatusEnum = z.enum(['pending', 'reviewing', 'interviewed', 'rejected', 'accepted', 'withdrawn']);
export const notificationTypeEnum = z.enum(['new_job_alert', 'application_update', 'job_match', 'application_deadline']);
export const tenantTypeEnum = z.enum(['enterprise', 'startup', 'agency', 'nonprofit']);

// Organization/Tenant schema
export const organizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  type: tenantTypeEnum,
  logo_url: z.string().nullable(),
  website_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Organization = z.infer<typeof organizationSchema>;

// Job Requisition schema - core entity for job postings
export const jobRequisitionSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  title: z.string(),
  description: z.string(),
  requirements: z.string(),
  responsibilities: z.string(),
  location: z.string(),
  remote_allowed: z.boolean(),
  employment_type: z.string(), // full-time, part-time, contract, internship
  department: z.string().nullable(),
  
  // Compensation details (transparency-first)
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string(),
  compensation_details: z.string().nullable(),
  benefits_summary: z.string().nullable(),
  
  // Visibility and access control
  visibility_level: visibilityLevelEnum,
  allowed_application_paths: z.array(applicationPathEnum),
  
  // Status and lifecycle
  status: jobStatusEnum,
  published_at: z.coerce.date().nullable(),
  application_deadline: z.coerce.date().nullable(),
  
  // Metadata
  external_id: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type JobRequisition = z.infer<typeof jobRequisitionSchema>;

// User/Candidate schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  resume_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  portfolio_url: z.string().nullable(),
  location: z.string().nullable(),
  preferred_locations: z.array(z.string()),
  skills: z.array(z.string()),
  experience_years: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Job Application schema
export const jobApplicationSchema = z.object({
  id: z.number(),
  job_id: z.number(),
  user_id: z.number(),
  application_path: applicationPathEnum,
  vendor_id: z.number().nullable(), // For vendor applications
  
  // Application details
  cover_letter: z.string().nullable(),
  resume_url: z.string().nullable(),
  custom_responses: z.record(z.string()), // JSON object for custom questions
  
  // Eligibility and readiness metrics
  eligibility_score: z.number(), // 0-100 score based on requirements match
  readiness_score: z.number(), // 0-100 score based on profile completeness
  skills_match_percentage: z.number(),
  
  // Status tracking
  status: applicationStatusEnum,
  applied_at: z.coerce.date(),
  last_updated: z.coerce.date(),
  
  // Consent and privacy
  consent_given: z.boolean(),
  consent_timestamp: z.coerce.date().nullable()
});

export type JobApplication = z.infer<typeof jobApplicationSchema>;

// Search Alert schema for candidate notifications
export const searchAlertSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  
  // Search criteria
  keywords: z.array(z.string()),
  locations: z.array(z.string()),
  employment_types: z.array(z.string()),
  salary_min: z.number().nullable(),
  remote_allowed: z.boolean().nullable(),
  
  // Alert settings
  is_active: z.boolean(),
  frequency: z.enum(['immediate', 'daily', 'weekly']),
  last_sent: z.coerce.date().nullable(),
  
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type SearchAlert = z.infer<typeof searchAlertSchema>;

// Notification schema
export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  related_job_id: z.number().nullable(),
  related_application_id: z.number().nullable(),
  read: z.boolean(),
  sent_at: z.coerce.date(),
  read_at: z.coerce.date().nullable()
});

export type Notification = z.infer<typeof notificationSchema>;

// Vendor schema for third-party recruitment agencies
export const vendorSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  contact_person: z.string().nullable(),
  phone: z.string().nullable(),
  commission_rate: z.number().nullable(), // Percentage
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Vendor = z.infer<typeof vendorSchema>;

// Input schemas for creating entities

export const createOrganizationInputSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  type: tenantTypeEnum,
  logo_url: z.string().nullable().optional(),
  website_url: z.string().nullable().optional()
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

export const createJobRequisitionInputSchema = z.object({
  organization_id: z.number(),
  title: z.string(),
  description: z.string(),
  requirements: z.string(),
  responsibilities: z.string(),
  location: z.string(),
  remote_allowed: z.boolean(),
  employment_type: z.string(),
  department: z.string().nullable().optional(),
  
  // Compensation
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().default('USD'),
  compensation_details: z.string().nullable().optional(),
  benefits_summary: z.string().nullable().optional(),
  
  // Visibility
  visibility_level: visibilityLevelEnum,
  allowed_application_paths: z.array(applicationPathEnum),
  
  // Deadline
  application_deadline: z.coerce.date().nullable().optional(),
  
  created_by: z.number()
});

export type CreateJobRequisitionInput = z.infer<typeof createJobRequisitionInputSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable().optional(),
  resume_url: z.string().nullable().optional(),
  linkedin_url: z.string().nullable().optional(),
  portfolio_url: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  preferred_locations: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  experience_years: z.number().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createJobApplicationInputSchema = z.object({
  job_id: z.number(),
  user_id: z.number(),
  application_path: applicationPathEnum,
  vendor_id: z.number().nullable().optional(),
  cover_letter: z.string().nullable().optional(),
  resume_url: z.string().nullable().optional(),
  custom_responses: z.record(z.string()).default({}),
  consent_given: z.boolean().default(true)
});

export type CreateJobApplicationInput = z.infer<typeof createJobApplicationInputSchema>;

export const createSearchAlertInputSchema = z.object({
  user_id: z.number(),
  name: z.string(),
  keywords: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  employment_types: z.array(z.string()).default([]),
  salary_min: z.number().nullable().optional(),
  remote_allowed: z.boolean().nullable().optional(),
  frequency: z.enum(['immediate', 'daily', 'weekly']).default('daily')
});

export type CreateSearchAlertInput = z.infer<typeof createSearchAlertInputSchema>;

export const createVendorInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  contact_person: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  commission_rate: z.number().nullable().optional()
});

export type CreateVendorInput = z.infer<typeof createVendorInputSchema>;

// Search and filter schemas
export const jobSearchInputSchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  remote_allowed: z.boolean().optional(),
  employment_types: z.array(z.string()).optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  organization_id: z.number().optional(),
  skills: z.array(z.string()).optional(),
  page: z.number().default(1),
  limit: z.number().default(20)
});

export type JobSearchInput = z.infer<typeof jobSearchInputSchema>;

// Update schemas
export const updateJobRequisitionInputSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  location: z.string().optional(),
  remote_allowed: z.boolean().optional(),
  employment_type: z.string().optional(),
  department: z.string().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().optional(),
  compensation_details: z.string().nullable().optional(),
  benefits_summary: z.string().nullable().optional(),
  visibility_level: visibilityLevelEnum.optional(),
  allowed_application_paths: z.array(applicationPathEnum).optional(),
  status: jobStatusEnum.optional(),
  application_deadline: z.coerce.date().nullable().optional()
});

export type UpdateJobRequisitionInput = z.infer<typeof updateJobRequisitionInputSchema>;

export const updateApplicationStatusInputSchema = z.object({
  id: z.number(),
  status: applicationStatusEnum
});

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusInputSchema>;