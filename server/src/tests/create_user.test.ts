import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser, getUserById, getUserByEmail } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields and some optional ones
const testInput: CreateUserInput = {
  email: 'john.doe@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1-555-123-4567',
  resume_url: 'https://example.com/resume.pdf',
  linkedin_url: 'https://linkedin.com/in/johndoe',
  portfolio_url: 'https://johndoe.dev',
  location: 'San Francisco, CA',
  preferred_locations: ['San Francisco, CA', 'New York, NY', 'Remote'],
  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
  experience_years: 5
};

// Minimal input with only required fields
const minimalInput: CreateUserInput = {
  email: 'jane.smith@example.com',
  first_name: 'Jane',
  last_name: 'Smith',
  preferred_locations: [],
  skills: []
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Verify all fields are correctly set
    expect(result.email).toEqual('john.doe@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.phone).toEqual('+1-555-123-4567');
    expect(result.resume_url).toEqual('https://example.com/resume.pdf');
    expect(result.linkedin_url).toEqual('https://linkedin.com/in/johndoe');
    expect(result.portfolio_url).toEqual('https://johndoe.dev');
    expect(result.location).toEqual('San Francisco, CA');
    expect(result.preferred_locations).toEqual(['San Francisco, CA', 'New York, NY', 'Remote']);
    expect(result.skills).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
    expect(result.experience_years).toEqual(5);
    
    // Verify generated fields
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a user with minimal fields', async () => {
    const result = await createUser(minimalInput);

    // Verify required fields
    expect(result.email).toEqual('jane.smith@example.com');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    
    // Verify optional fields are null or default values
    expect(result.phone).toBeNull();
    expect(result.resume_url).toBeNull();
    expect(result.linkedin_url).toBeNull();
    expect(result.portfolio_url).toBeNull();
    expect(result.location).toBeNull();
    expect(result.experience_years).toBeNull();
    expect(result.preferred_locations).toEqual([]);
    expect(result.skills).toEqual([]);
    
    // Verify generated fields
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query database directly to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.email).toEqual('john.doe@example.com');
    expect(savedUser.first_name).toEqual('John');
    expect(savedUser.last_name).toEqual('Doe');
    expect(savedUser.phone).toEqual('+1-555-123-4567');
    expect(savedUser.location).toEqual('San Francisco, CA');
    expect(savedUser.experience_years).toEqual(5);
    
    // Verify JSONB fields are stored correctly
    const storedPreferredLocations = Array.isArray(savedUser.preferred_locations)
      ? savedUser.preferred_locations
      : JSON.parse(savedUser.preferred_locations as string);
    expect(storedPreferredLocations).toEqual(['San Francisco, CA', 'New York, NY', 'Remote']);
    
    const storedSkills = Array.isArray(savedUser.skills)
      ? savedUser.skills
      : JSON.parse(savedUser.skills as string);
    expect(storedSkills).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
  });

  it('should throw error for duplicate email', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create another user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      first_name: 'Jane',
      last_name: 'Smith'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/email already exists/i);
  });

  it('should handle empty arrays correctly', async () => {
    const inputWithEmptyArrays: CreateUserInput = {
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      preferred_locations: [],
      skills: []
    };

    const result = await createUser(inputWithEmptyArrays);
    
    expect(result.preferred_locations).toEqual([]);
    expect(result.skills).toEqual([]);
  });
});

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve user by ID', async () => {
    // Create a user first
    const createdUser = await createUser(testInput);

    // Retrieve the user by ID
    const result = await getUserById(createdUser.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.email).toEqual('john.doe@example.com');
    expect(result!.first_name).toEqual('John');
    expect(result!.last_name).toEqual('Doe');
    expect(result!.preferred_locations).toEqual(['San Francisco, CA', 'New York, NY', 'Remote']);
    expect(result!.skills).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
  });

  it('should return null for non-existent user ID', async () => {
    const result = await getUserById(99999);
    expect(result).toBeNull();
  });

  it('should handle JSONB arrays correctly', async () => {
    // Create user with arrays
    const createdUser = await createUser(testInput);

    // Retrieve and verify arrays are properly parsed
    const result = await getUserById(createdUser.id);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.preferred_locations)).toBe(true);
    expect(Array.isArray(result!.skills)).toBe(true);
    expect(result!.preferred_locations).toEqual(['San Francisco, CA', 'New York, NY', 'Remote']);
    expect(result!.skills).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
  });
});

describe('getUserByEmail', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve user by email', async () => {
    // Create a user first
    await createUser(testInput);

    // Retrieve the user by email
    const result = await getUserByEmail('john.doe@example.com');

    expect(result).not.toBeNull();
    expect(result!.email).toEqual('john.doe@example.com');
    expect(result!.first_name).toEqual('John');
    expect(result!.last_name).toEqual('Doe');
    expect(result!.phone).toEqual('+1-555-123-4567');
    expect(result!.preferred_locations).toEqual(['San Francisco, CA', 'New York, NY', 'Remote']);
    expect(result!.skills).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
  });

  it('should return null for non-existent email', async () => {
    const result = await getUserByEmail('nonexistent@example.com');
    expect(result).toBeNull();
  });

  it('should be case sensitive for email lookup', async () => {
    await createUser(testInput);

    // Try with different case - should not find user
    const result = await getUserByEmail('JOHN.DOE@EXAMPLE.COM');
    expect(result).toBeNull();
  });

  it('should handle users with minimal data', async () => {
    // Create user with minimal data
    await createUser(minimalInput);

    // Retrieve by email
    const result = await getUserByEmail('jane.smith@example.com');

    expect(result).not.toBeNull();
    expect(result!.email).toEqual('jane.smith@example.com');
    expect(result!.first_name).toEqual('Jane');
    expect(result!.last_name).toEqual('Smith');
    expect(result!.phone).toBeNull();
    expect(result!.resume_url).toBeNull();
    expect(result!.preferred_locations).toEqual([]);
    expect(result!.skills).toEqual([]);
  });
});