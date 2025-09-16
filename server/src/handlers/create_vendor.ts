import { db } from '../db';
import { vendorsTable } from '../db/schema';
import { type CreateVendorInput, type Vendor } from '../schema';
import { eq } from 'drizzle-orm';

export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  try {
    // Insert vendor record
    const result = await db.insert(vendorsTable)
      .values({
        name: input.name,
        email: input.email,
        contact_person: input.contact_person || null,
        phone: input.phone || null,
        commission_rate: input.commission_rate ? input.commission_rate.toString() : null, // Convert number to string for numeric column
        is_active: true // Default to active
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const vendor = result[0];
    return {
      ...vendor,
      commission_rate: vendor.commission_rate ? parseFloat(vendor.commission_rate) : null // Convert string back to number
    };
  } catch (error) {
    console.error('Vendor creation failed:', error);
    throw error;
  }
}

export async function getVendors(): Promise<Vendor[]> {
  try {
    const results = await db.select()
      .from(vendorsTable)
      .where(eq(vendorsTable.is_active, true))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(vendor => ({
      ...vendor,
      commission_rate: vendor.commission_rate ? parseFloat(vendor.commission_rate) : null
    }));
  } catch (error) {
    console.error('Failed to fetch vendors:', error);
    throw error;
  }
}

export async function getVendorById(id: number): Promise<Vendor | null> {
  try {
    const results = await db.select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const vendor = results[0];
    return {
      ...vendor,
      commission_rate: vendor.commission_rate ? parseFloat(vendor.commission_rate) : null
    };
  } catch (error) {
    console.error('Failed to fetch vendor by ID:', error);
    throw error;
  }
}