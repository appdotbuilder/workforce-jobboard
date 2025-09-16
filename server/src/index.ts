import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createOrganizationInputSchema,
  createJobRequisitionInputSchema,
  updateJobRequisitionInputSchema,
  createUserInputSchema,
  createJobApplicationInputSchema,
  updateApplicationStatusInputSchema,
  createSearchAlertInputSchema,
  createVendorInputSchema,
  jobSearchInputSchema
} from './schema';

// Import handlers
import { createOrganization } from './handlers/create_organization';
import { getOrganizations } from './handlers/get_organizations';
import { createJobRequisition } from './handlers/create_job_requisition';
import { 
  getJobRequisitions, 
  getJobRequisitionsByOrganization, 
  getJobRequisitionById 
} from './handlers/get_job_requisitions';
import { updateJobRequisition, publishJobRequisition } from './handlers/update_job_requisition';
import { searchJobs, getRecommendedJobs } from './handlers/search_jobs';
import { createUser, getUserById, getUserByEmail } from './handlers/create_user';
import { createJobApplication, calculateEligibilityScore, calculateReadinessScore } from './handlers/create_job_application';
import { 
  getJobApplicationsByUser, 
  getJobApplicationsByJob, 
  getJobApplicationById 
} from './handlers/get_job_applications';
import { updateApplicationStatus, bulkUpdateApplicationStatus } from './handlers/update_application_status';
import { createSearchAlert, processSearchAlerts, getSearchAlertsByUser } from './handlers/create_search_alert';
import { createVendor, getVendors, getVendorById } from './handlers/create_vendor';
import { 
  createNotification, 
  getNotificationsByUser, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from './handlers/create_notification';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Organization management (multi-tenant)
  createOrganization: publicProcedure
    .input(createOrganizationInputSchema)
    .mutation(({ input }) => createOrganization(input)),
  
  getOrganizations: publicProcedure
    .query(() => getOrganizations()),

  // Job Requisition management
  createJobRequisition: publicProcedure
    .input(createJobRequisitionInputSchema)
    .mutation(({ input }) => createJobRequisition(input)),

  getJobRequisitions: publicProcedure
    .query(() => getJobRequisitions()),

  getJobRequisitionsByOrganization: publicProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(({ input }) => getJobRequisitionsByOrganization(input.organizationId)),

  getJobRequisitionById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getJobRequisitionById(input.id)),

  updateJobRequisition: publicProcedure
    .input(updateJobRequisitionInputSchema)
    .mutation(({ input }) => updateJobRequisition(input)),

  publishJobRequisition: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => publishJobRequisition(input.id)),

  // Job search and recommendations
  searchJobs: publicProcedure
    .input(jobSearchInputSchema)
    .query(({ input }) => searchJobs(input)),

  getRecommendedJobs: publicProcedure
    .input(z.object({ userId: z.number(), limit: z.number().optional() }))
    .query(({ input }) => getRecommendedJobs(input.userId, input.limit)),

  // User/Candidate management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUserById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getUserById(input.id)),

  getUserByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(({ input }) => getUserByEmail(input.email)),

  // Job Applications with eligibility scoring
  createJobApplication: publicProcedure
    .input(createJobApplicationInputSchema)
    .mutation(({ input }) => createJobApplication(input)),

  getJobApplicationsByUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getJobApplicationsByUser(input.userId)),

  getJobApplicationsByJob: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(({ input }) => getJobApplicationsByJob(input.jobId)),

  getJobApplicationById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getJobApplicationById(input.id)),

  updateApplicationStatus: publicProcedure
    .input(updateApplicationStatusInputSchema)
    .mutation(({ input }) => updateApplicationStatus(input)),

  bulkUpdateApplicationStatus: publicProcedure
    .input(z.object({ 
      applicationIds: z.array(z.number()), 
      status: z.string() 
    }))
    .mutation(({ input }) => bulkUpdateApplicationStatus(input.applicationIds, input.status)),

  // Eligibility and readiness scoring
  calculateEligibilityScore: publicProcedure
    .input(z.object({ userId: z.number(), jobId: z.number() }))
    .query(({ input }) => calculateEligibilityScore(input.userId, input.jobId)),

  calculateReadinessScore: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => calculateReadinessScore(input.userId)),

  // Search alerts and notifications
  createSearchAlert: publicProcedure
    .input(createSearchAlertInputSchema)
    .mutation(({ input }) => createSearchAlert(input)),

  getSearchAlertsByUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getSearchAlertsByUser(input.userId)),

  processSearchAlerts: publicProcedure
    .mutation(() => processSearchAlerts()),

  // Vendor management (for vendor application path)
  createVendor: publicProcedure
    .input(createVendorInputSchema)
    .mutation(({ input }) => createVendor(input)),

  getVendors: publicProcedure
    .query(() => getVendors()),

  getVendorById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getVendorById(input.id)),

  // Notification system
  createNotification: publicProcedure
    .input(z.object({
      userId: z.number(),
      type: z.string(),
      title: z.string(),
      message: z.string(),
      relatedJobId: z.number().optional(),
      relatedApplicationId: z.number().optional()
    }))
    .mutation(({ input }) => createNotification(
      input.userId,
      input.type,
      input.title,
      input.message,
      input.relatedJobId,
      input.relatedApplicationId
    )),

  getNotificationsByUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getNotificationsByUser(input.userId)),

  markNotificationAsRead: publicProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(({ input }) => markNotificationAsRead(input.notificationId)),

  markAllNotificationsAsRead: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ input }) => markAllNotificationsAsRead(input.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`🚀 Workforce Management TRPC server listening at port: ${port}`);
  console.log('📋 Job Board/Marketplace API ready with:');
  console.log('   ✓ Multi-tenant organization support');
  console.log('   ✓ Transparency-first compensation display');
  console.log('   ✓ Eligibility and readiness scoring');
  console.log('   ✓ Multiple application paths (direct/vendor/consent-based)');
  console.log('   ✓ Advanced search and alerts system');
}

start();