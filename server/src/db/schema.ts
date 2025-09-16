import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  jsonb,
  pgEnum,
  index,
  varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const jobStatusEnum = pgEnum('job_status', ['draft', 'active', 'paused', 'closed', 'archived']);
export const visibilityLevelEnum = pgEnum('visibility_level', ['public', 'internal', 'restricted', 'private']);
export const applicationPathEnum = pgEnum('application_path', ['direct', 'vendor', 'consent_based']);
export const applicationStatusEnum = pgEnum('application_status', ['pending', 'reviewing', 'interviewed', 'rejected', 'accepted', 'withdrawn']);
export const notificationTypeEnum = pgEnum('notification_type', ['new_job_alert', 'application_update', 'job_match', 'application_deadline']);
export const tenantTypeEnum = pgEnum('tenant_type', ['enterprise', 'startup', 'agency', 'nonprofit']);

// Organizations table (multi-tenant support)
export const organizationsTable = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  type: tenantTypeEnum('type').notNull(),
  logo_url: text('logo_url'),
  website_url: text('website_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  slugIdx: index('org_slug_idx').on(table.slug),
}));

// Users table (candidates)
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  resume_url: text('resume_url'),
  linkedin_url: text('linkedin_url'),
  portfolio_url: text('portfolio_url'),
  location: text('location'),
  preferred_locations: jsonb('preferred_locations').default('[]'), // Array of strings
  skills: jsonb('skills').default('[]'), // Array of strings
  experience_years: integer('experience_years'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  emailIdx: index('user_email_idx').on(table.email),
  skillsIdx: index('user_skills_idx').on(table.skills),
}));

// Job Requisitions table (core job postings)
export const jobRequisitionsTable = pgTable('job_requisitions', {
  id: serial('id').primaryKey(),
  organization_id: integer('organization_id').notNull().references(() => organizationsTable.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requirements: text('requirements').notNull(),
  responsibilities: text('responsibilities').notNull(),
  location: text('location').notNull(),
  remote_allowed: boolean('remote_allowed').default(false).notNull(),
  employment_type: varchar('employment_type', { length: 50 }).notNull(), // full-time, part-time, contract, internship
  department: varchar('department', { length: 100 }),
  
  // Compensation details (transparency-first)
  salary_min: numeric('salary_min', { precision: 12, scale: 2 }),
  salary_max: numeric('salary_max', { precision: 12, scale: 2 }),
  salary_currency: varchar('salary_currency', { length: 3 }).default('USD').notNull(),
  compensation_details: text('compensation_details'),
  benefits_summary: text('benefits_summary'),
  
  // Visibility and access control
  visibility_level: visibilityLevelEnum('visibility_level').default('public').notNull(),
  allowed_application_paths: jsonb('allowed_application_paths').default('["direct"]'), // Array of application_path enum values
  
  // Status and lifecycle
  status: jobStatusEnum('status').default('draft').notNull(),
  published_at: timestamp('published_at'),
  application_deadline: timestamp('application_deadline'),
  
  // Metadata
  external_id: varchar('external_id', { length: 100 }),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  orgIdx: index('job_org_idx').on(table.organization_id),
  statusIdx: index('job_status_idx').on(table.status),
  locationIdx: index('job_location_idx').on(table.location),
  publishedIdx: index('job_published_idx').on(table.published_at),
  titleIdx: index('job_title_idx').on(table.title),
}));

// Vendors table (third-party recruitment agencies)
export const vendorsTable = pgTable('vendors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  contact_person: varchar('contact_person', { length: 200 }),
  phone: varchar('phone', { length: 20 }),
  commission_rate: numeric('commission_rate', { precision: 5, scale: 2 }), // Percentage
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Job Applications table
export const jobApplicationsTable = pgTable('job_applications', {
  id: serial('id').primaryKey(),
  job_id: integer('job_id').notNull().references(() => jobRequisitionsTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  application_path: applicationPathEnum('application_path').notNull(),
  vendor_id: integer('vendor_id').references(() => vendorsTable.id), // For vendor applications
  
  // Application details
  cover_letter: text('cover_letter'),
  resume_url: text('resume_url'),
  custom_responses: jsonb('custom_responses').default('{}'), // JSON object for custom questions
  
  // Eligibility and readiness metrics
  eligibility_score: numeric('eligibility_score', { precision: 5, scale: 2 }).default('0').notNull(), // 0-100 score
  readiness_score: numeric('readiness_score', { precision: 5, scale: 2 }).default('0').notNull(), // 0-100 score
  skills_match_percentage: numeric('skills_match_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  
  // Status tracking
  status: applicationStatusEnum('status').default('pending').notNull(),
  applied_at: timestamp('applied_at').defaultNow().notNull(),
  last_updated: timestamp('last_updated').defaultNow().notNull(),
  
  // Consent and privacy
  consent_given: boolean('consent_given').default(false).notNull(),
  consent_timestamp: timestamp('consent_timestamp')
}, (table) => ({
  jobIdx: index('app_job_idx').on(table.job_id),
  userIdx: index('app_user_idx').on(table.user_id),
  statusIdx: index('app_status_idx').on(table.status),
  appliedIdx: index('app_applied_idx').on(table.applied_at),
}));

// Search Alerts table for candidate notifications
export const searchAlertsTable = pgTable('search_alerts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  name: varchar('name', { length: 200 }).notNull(),
  
  // Search criteria stored as JSON arrays/objects
  keywords: jsonb('keywords').default('[]'), // Array of strings
  locations: jsonb('locations').default('[]'), // Array of strings
  employment_types: jsonb('employment_types').default('[]'), // Array of strings
  salary_min: numeric('salary_min', { precision: 12, scale: 2 }),
  remote_allowed: boolean('remote_allowed'),
  
  // Alert settings
  is_active: boolean('is_active').default(true).notNull(),
  frequency: varchar('frequency', { length: 20 }).default('daily').notNull(), // immediate, daily, weekly
  last_sent: timestamp('last_sent'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdx: index('alert_user_idx').on(table.user_id),
  activeIdx: index('alert_active_idx').on(table.is_active),
}));

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  related_job_id: integer('related_job_id').references(() => jobRequisitionsTable.id),
  related_application_id: integer('related_application_id').references(() => jobApplicationsTable.id),
  read: boolean('read').default(false).notNull(),
  sent_at: timestamp('sent_at').defaultNow().notNull(),
  read_at: timestamp('read_at')
}, (table) => ({
  userIdx: index('notif_user_idx').on(table.user_id),
  readIdx: index('notif_read_idx').on(table.read),
  typeIdx: index('notif_type_idx').on(table.type),
}));

// Define relations for better query building
export const organizationsRelations = relations(organizationsTable, ({ many }) => ({
  jobRequisitions: many(jobRequisitionsTable),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  jobApplications: many(jobApplicationsTable),
  searchAlerts: many(searchAlertsTable),
  notifications: many(notificationsTable),
  createdJobs: many(jobRequisitionsTable),
}));

export const jobRequisitionsRelations = relations(jobRequisitionsTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [jobRequisitionsTable.organization_id],
    references: [organizationsTable.id],
  }),
  creator: one(usersTable, {
    fields: [jobRequisitionsTable.created_by],
    references: [usersTable.id],
  }),
  applications: many(jobApplicationsTable),
}));

export const vendorsRelations = relations(vendorsTable, ({ many }) => ({
  applications: many(jobApplicationsTable),
}));

export const jobApplicationsRelations = relations(jobApplicationsTable, ({ one }) => ({
  job: one(jobRequisitionsTable, {
    fields: [jobApplicationsTable.job_id],
    references: [jobRequisitionsTable.id],
  }),
  user: one(usersTable, {
    fields: [jobApplicationsTable.user_id],
    references: [usersTable.id],
  }),
  vendor: one(vendorsTable, {
    fields: [jobApplicationsTable.vendor_id],
    references: [vendorsTable.id],
  }),
}));

export const searchAlertsRelations = relations(searchAlertsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [searchAlertsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.user_id],
    references: [usersTable.id],
  }),
  relatedJob: one(jobRequisitionsTable, {
    fields: [notificationsTable.related_job_id],
    references: [jobRequisitionsTable.id],
  }),
  relatedApplication: one(jobApplicationsTable, {
    fields: [notificationsTable.related_application_id],
    references: [jobApplicationsTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  organizations: organizationsTable,
  users: usersTable,
  jobRequisitions: jobRequisitionsTable,
  vendors: vendorsTable,
  jobApplications: jobApplicationsTable,
  searchAlerts: searchAlertsTable,
  notifications: notificationsTable,
};