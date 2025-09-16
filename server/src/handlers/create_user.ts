import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Check if email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Insert new user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone ?? null,
        resume_url: input.resume_url ?? null,
        linkedin_url: input.linkedin_url ?? null,
        portfolio_url: input.portfolio_url ?? null,
        location: input.location ?? null,
        preferred_locations: JSON.stringify(input.preferred_locations),
        skills: JSON.stringify(input.skills),
        experience_years: input.experience_years ?? null
      })
      .returning()
      .execute();

    // Convert JSONB fields back to arrays and return user
    const user = result[0];
    return {
      ...user,
      preferred_locations: Array.isArray(user.preferred_locations) 
        ? user.preferred_locations 
        : JSON.parse(user.preferred_locations as string || '[]'),
      skills: Array.isArray(user.skills) 
        ? user.skills 
        : JSON.parse(user.skills as string || '[]')
    };
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    if (users.length === 0) {
      return null;
    }

    // Convert JSONB fields back to arrays
    const user = users[0];
    return {
      ...user,
      preferred_locations: Array.isArray(user.preferred_locations) 
        ? user.preferred_locations 
        : JSON.parse(user.preferred_locations as string || '[]'),
      skills: Array.isArray(user.skills) 
        ? user.skills 
        : JSON.parse(user.skills as string || '[]')
    };
  } catch (error) {
    console.error('User lookup by ID failed:', error);
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .execute();

    if (users.length === 0) {
      return null;
    }

    // Convert JSONB fields back to arrays
    const user = users[0];
    return {
      ...user,
      preferred_locations: Array.isArray(user.preferred_locations) 
        ? user.preferred_locations 
        : JSON.parse(user.preferred_locations as string || '[]'),
      skills: Array.isArray(user.skills) 
        ? user.skills 
        : JSON.parse(user.skills as string || '[]')
    };
  } catch (error) {
    console.error('User lookup by email failed:', error);
    throw error;
  }
}