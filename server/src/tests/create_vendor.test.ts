import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { vendorsTable } from '../db/schema';
import { type CreateVendorInput } from '../schema';
import { createVendor, getVendors, getVendorById } from '../handlers/create_vendor';
import { eq } from 'drizzle-orm';

// Complete test input with all fields
const testInput: CreateVendorInput = {
  name: 'Test Recruitment Agency',
  email: 'contact@testrecruitment.com',
  contact_person: 'John Smith',
  phone: '+1-555-0123',
  commission_rate: 15.5
};

// Minimal test input
const minimalInput: CreateVendorInput = {
  name: 'Minimal Agency',
  email: 'minimal@agency.com'
};

describe('createVendor', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a vendor with all fields', async () => {
    const result = await createVendor(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Recruitment Agency');
    expect(result.email).toEqual('contact@testrecruitment.com');
    expect(result.contact_person).toEqual('John Smith');
    expect(result.phone).toEqual('+1-555-0123');
    expect(result.commission_rate).toEqual(15.5);
    expect(typeof result.commission_rate).toBe('number');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a vendor with minimal fields', async () => {
    const result = await createVendor(minimalInput);

    expect(result.name).toEqual('Minimal Agency');
    expect(result.email).toEqual('minimal@agency.com');
    expect(result.contact_person).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.commission_rate).toBeNull();
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
  });

  it('should save vendor to database', async () => {
    const result = await createVendor(testInput);

    // Query using proper drizzle syntax
    const vendors = await db.select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, result.id))
      .execute();

    expect(vendors).toHaveLength(1);
    expect(vendors[0].name).toEqual('Test Recruitment Agency');
    expect(vendors[0].email).toEqual('contact@testrecruitment.com');
    expect(vendors[0].contact_person).toEqual('John Smith');
    expect(vendors[0].phone).toEqual('+1-555-0123');
    expect(parseFloat(vendors[0].commission_rate!)).toEqual(15.5);
    expect(vendors[0].is_active).toEqual(true);
    expect(vendors[0].created_at).toBeInstanceOf(Date);
    expect(vendors[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle commission rate conversion correctly', async () => {
    const inputWithCommission: CreateVendorInput = {
      name: 'Commission Test Agency',
      email: 'commission@test.com',
      commission_rate: 25.75
    };

    const result = await createVendor(inputWithCommission);

    expect(result.commission_rate).toEqual(25.75);
    expect(typeof result.commission_rate).toBe('number');

    // Verify in database
    const vendors = await db.select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, result.id))
      .execute();

    expect(parseFloat(vendors[0].commission_rate!)).toEqual(25.75);
  });
});

describe('getVendors', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no vendors exist', async () => {
    const result = await getVendors();
    expect(result).toEqual([]);
  });

  it('should return all active vendors', async () => {
    // Create multiple vendors
    const vendor1 = await createVendor(testInput);
    const vendor2 = await createVendor(minimalInput);

    const result = await getVendors();

    expect(result).toHaveLength(2);
    
    // Check first vendor
    const foundVendor1 = result.find(v => v.id === vendor1.id);
    expect(foundVendor1).toBeDefined();
    expect(foundVendor1!.name).toEqual('Test Recruitment Agency');
    expect(foundVendor1!.commission_rate).toEqual(15.5);
    expect(typeof foundVendor1!.commission_rate).toBe('number');

    // Check second vendor
    const foundVendor2 = result.find(v => v.id === vendor2.id);
    expect(foundVendor2).toBeDefined();
    expect(foundVendor2!.name).toEqual('Minimal Agency');
    expect(foundVendor2!.commission_rate).toBeNull();
  });

  it('should only return active vendors', async () => {
    // Create active vendor
    const activeVendor = await createVendor(testInput);

    // Create inactive vendor directly in database
    await db.insert(vendorsTable)
      .values({
        name: 'Inactive Agency',
        email: 'inactive@agency.com',
        is_active: false
      })
      .execute();

    const result = await getVendors();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(activeVendor.id);
    expect(result[0].name).toEqual('Test Recruitment Agency');
  });
});

describe('getVendorById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return vendor when found', async () => {
    const created = await createVendor(testInput);

    const result = await getVendorById(created.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(created.id);
    expect(result!.name).toEqual('Test Recruitment Agency');
    expect(result!.email).toEqual('contact@testrecruitment.com');
    expect(result!.commission_rate).toEqual(15.5);
    expect(typeof result!.commission_rate).toBe('number');
    expect(result!.is_active).toEqual(true);
  });

  it('should return null when vendor not found', async () => {
    const result = await getVendorById(999);
    expect(result).toBeNull();
  });

  it('should return inactive vendor when found', async () => {
    // Create inactive vendor directly
    const insertResult = await db.insert(vendorsTable)
      .values({
        name: 'Inactive Test Agency',
        email: 'inactive@test.com',
        is_active: false
      })
      .returning()
      .execute();

    const result = await getVendorById(insertResult[0].id);

    expect(result).toBeDefined();
    expect(result!.name).toEqual('Inactive Test Agency');
    expect(result!.is_active).toEqual(false);
  });

  it('should handle null commission rate correctly', async () => {
    const created = await createVendor(minimalInput);

    const result = await getVendorById(created.id);

    expect(result).toBeDefined();
    expect(result!.commission_rate).toBeNull();
  });
});