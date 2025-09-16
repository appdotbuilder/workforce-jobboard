import { db } from '../db';
import { organizationsTable } from '../db/schema';
import { type CreateOrganizationInput, type Organization } from '../schema';

export const createOrganization = async (input: CreateOrganizationInput): Promise<Organization> => {
  try {
    // Insert organization record
    const result = await db.insert(organizationsTable)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        type: input.type,
        logo_url: input.logo_url || null,
        website_url: input.website_url || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Organization creation failed:', error);
    throw error;
  }
};