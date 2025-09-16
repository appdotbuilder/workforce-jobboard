import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { searchAlertsTable, usersTable } from '../db/schema';
import { type CreateSearchAlertInput } from '../schema';
import { createSearchAlert } from '../handlers/create_search_alert';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '+1234567890',
  location: 'San Francisco, CA',
  preferred_locations: ['San Francisco, CA', 'New York, NY'],
  skills: ['JavaScript', 'React', 'Node.js'],
  experience_years: 5
};

// Simple test input with all required fields
const testInput: CreateSearchAlertInput = {
  user_id: 1,
  name: 'Software Engineer Jobs',
  keywords: ['javascript', 'react', 'frontend'],
  locations: ['San Francisco', 'Remote'],
  employment_types: ['full-time', 'contract'],
  salary_min: 100000,
  remote_allowed: true,
  frequency: 'daily'
};

describe('createSearchAlert', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a search alert with all fields', async () => {
    // Create prerequisite user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    
    const result = await createSearchAlert({
      ...testInput,
      user_id: userId
    });

    // Verify basic field values
    expect(result.user_id).toEqual(userId);
    expect(result.name).toEqual('Software Engineer Jobs');
    expect(result.keywords).toEqual(['javascript', 'react', 'frontend']);
    expect(result.locations).toEqual(['San Francisco', 'Remote']);
    expect(result.employment_types).toEqual(['full-time', 'contract']);
    expect(result.salary_min).toEqual(100000);
    expect(result.remote_allowed).toEqual(true);
    expect(result.frequency).toEqual('daily');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.last_sent).toBeNull();
  });

  it('should save search alert to database correctly', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    
    const result = await createSearchAlert({
      ...testInput,
      user_id: userId
    });

    // Query database to verify the record was saved
    const alerts = await db.select()
      .from(searchAlertsTable)
      .where(eq(searchAlertsTable.id, result.id))
      .execute();

    expect(alerts).toHaveLength(1);
    const savedAlert = alerts[0];
    
    expect(savedAlert.user_id).toEqual(userId);
    expect(savedAlert.name).toEqual('Software Engineer Jobs');
    expect(savedAlert.keywords).toEqual(['javascript', 'react', 'frontend']);
    expect(savedAlert.locations).toEqual(['San Francisco', 'Remote']);
    expect(savedAlert.employment_types).toEqual(['full-time', 'contract']);
    expect(parseFloat(savedAlert.salary_min!)).toEqual(100000);
    expect(savedAlert.remote_allowed).toEqual(true);
    expect(savedAlert.frequency).toEqual('daily');
    expect(savedAlert.is_active).toEqual(true);
    expect(savedAlert.created_at).toBeInstanceOf(Date);
  });

  it('should create search alert with optional fields as null', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    
    const minimalInput: CreateSearchAlertInput = {
      user_id: userId,
      name: 'Basic Alert',
      keywords: [],
      locations: [],
      employment_types: [],
      salary_min: null,
      remote_allowed: null,
      frequency: 'weekly'
    };

    const result = await createSearchAlert(minimalInput);

    expect(result.user_id).toEqual(userId);
    expect(result.name).toEqual('Basic Alert');
    expect(result.keywords).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.employment_types).toEqual([]);
    expect(result.salary_min).toBeNull();
    expect(result.remote_allowed).toBeNull();
    expect(result.frequency).toEqual('weekly');
    expect(result.is_active).toEqual(true);
  });

  it('should handle numeric conversion for salary_min correctly', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    
    const result = await createSearchAlert({
      ...testInput,
      user_id: userId,
      salary_min: 85000.50
    });

    // Verify numeric conversion
    expect(typeof result.salary_min).toBe('number');
    expect(result.salary_min).toEqual(85000.50);

    // Verify database storage and retrieval
    const alerts = await db.select()
      .from(searchAlertsTable)
      .where(eq(searchAlertsTable.id, result.id))
      .execute();

    const savedAlert = alerts[0];
    expect(parseFloat(savedAlert.salary_min!)).toEqual(85000.50);
  });

  it('should create multiple search alerts for same user', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create first alert
    const alert1 = await createSearchAlert({
      ...testInput,
      user_id: userId,
      name: 'Frontend Jobs'
    });

    // Create second alert
    const alert2 = await createSearchAlert({
      ...testInput,
      user_id: userId,
      name: 'Backend Jobs',
      keywords: ['node.js', 'python', 'backend']
    });

    expect(alert1.id).not.toEqual(alert2.id);
    expect(alert1.name).toEqual('Frontend Jobs');
    expect(alert2.name).toEqual('Backend Jobs');
    expect(alert2.keywords).toEqual(['node.js', 'python', 'backend']);

    // Verify both are saved in database
    const allAlerts = await db.select()
      .from(searchAlertsTable)
      .where(eq(searchAlertsTable.user_id, userId))
      .execute();

    expect(allAlerts).toHaveLength(2);
  });

  it('should handle different frequency values', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Test immediate frequency
    const immediateAlert = await createSearchAlert({
      ...testInput,
      user_id: userId,
      name: 'Immediate Alert',
      frequency: 'immediate'
    });

    expect(immediateAlert.frequency).toEqual('immediate');

    // Test weekly frequency
    const weeklyAlert = await createSearchAlert({
      ...testInput,
      user_id: userId,
      name: 'Weekly Alert',
      frequency: 'weekly'
    });

    expect(weeklyAlert.frequency).toEqual('weekly');
  });

  it('should throw error if user does not exist', async () => {
    const invalidInput = {
      ...testInput,
      user_id: 999999 // Non-existent user ID
    };

    await expect(createSearchAlert(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });
});