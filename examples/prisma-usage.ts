/**
 * Example: Using Prisma with Contact Skills
 *
 * This file demonstrates how to use the ContactRepository
 * and Prisma for CRUD operations in skills
 */

import { ContactRepository } from "@/server/db/contact-repository";

// ============================================
// EXAMPLE 1: Creating a Contact (in skill)
// ============================================

export async function exampleCreateContact(env: any) {
  const repo = new ContactRepository(env);

  const result = await repo.create({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "+1-555-123-4567",
    company: "Acme Corp",
    jobTitle: "Software Engineer",
    userId: "user_123",
  });

  if (result.success) {
    console.log("Contact created:", result.data);
    // {
    //   id: "550e8400-e29b-41d4-a716-446655440000",
    //   firstName: "John",
    //   email: "john@example.com",
    //   createdAt: "2025-12-26T10:30:00Z"
    // }
  } else {
    console.error("Failed:", result.error);
    // "Validation failed" or database error message
  }
}

// ============================================
// EXAMPLE 2: Fetching All Contacts
// ============================================

export async function exampleFetchContacts(env: any, userId: string) {
  const repo = new ContactRepository(env);

  const result = await repo.findByUserId(userId);

  if (result.success) {
    const contacts = result.data; // Contact[]
    console.log(`Found ${contacts.length} contacts`);

    // Display contacts
    contacts.forEach((contact, i) => {
      console.log(`${i + 1}. ${contact.firstName} ${contact.lastName}`);
      console.log(`   Email: ${contact.email}`);
      console.log(`   Phone: ${contact.phone}`);
    });
  }
}

// ============================================
// EXAMPLE 3: Finding a Specific Contact
// ============================================

export async function exampleFindContact(
  env: any,
  contactId: string,
  userId: string
) {
  const repo = new ContactRepository(env);

  const result = await repo.findById(contactId, userId);

  if (result.success && result.data) {
    console.log("Found contact:", result.data);
    console.log(`Name: ${result.data.firstName} ${result.data.lastName}`);
    console.log(`Email: ${result.data.email}`);
  } else {
    console.log("Contact not found");
  }
}

// ============================================
// EXAMPLE 4: Updating a Contact
// ============================================

export async function exampleUpdateContact(
  env: any,
  contactId: string,
  userId: string
) {
  const repo = new ContactRepository(env);

  const result = await repo.update(contactId, userId, {
    phone: "+1-555-999-8888",
    company: "New Company Inc",
    jobTitle: "Senior Engineer",
  });

  if (result.success) {
    console.log("Contact updated successfully");
  } else {
    console.error("Update failed:", result.error);
  }
}

// ============================================
// EXAMPLE 5: Deleting a Contact
// ============================================

export async function exampleDeleteContact(
  env: any,
  contactId: string,
  userId: string
) {
  const repo = new ContactRepository(env);

  const result = await repo.delete(contactId, userId);

  if (result.success) {
    console.log("Contact deleted successfully");
  } else {
    console.error("Delete failed:", result.error);
  }
}

// ============================================
// EXAMPLE 6: Error Handling
// ============================================

export async function exampleErrorHandling(env: any) {
  const repo = new ContactRepository(env);

  // Try to create contact with duplicate email
  const result = await repo.create({
    firstName: "Jane",
    lastName: "Smith",
    email: "john@example.com", // Duplicate!
    phone: "555-1234",
    userId: "user_456",
  });

  if (!result.success) {
    console.error("Error:", result.error);
    // Output: "Error: Unique constraint failed on the fields: (`email`)"

    // Handle specific error types
    if (result.error?.includes("Unique constraint")) {
      console.log("Email already exists");
    } else if (result.error?.includes("validation")) {
      console.log("Invalid data provided");
    } else {
      console.log("Database error");
    }
  }
}

// ============================================
// EXAMPLE 7: In Contact Workflow Skill
// ============================================

export async function exampleInWorkflowSkill(input: any, context: any) {
  const { firstName, lastName, email, phone, userId } = input;

  // Use repository in skill context
  const repo = new ContactRepository(context.env);

  const result = await repo.create({
    firstName,
    lastName,
    email,
    phone,
    userId: context.userId || userId,
  });

  if (result.success) {
    return {
      success: true,
      message: `✅ Contact saved: ${result.data.firstName} ${result.data.lastName}`,
      contactId: result.data.id,
    };
  } else {
    return {
      success: false,
      message: `❌ Failed: ${result.error}`,
    };
  }
}

// ============================================
// EXAMPLE 8: Batch Operations
// ============================================

export async function exampleBatchCreate(env: any) {
  const repo = new ContactRepository(env);
  const userId = "user_789";

  const contactsToCreate = [
    {
      firstName: "Alice",
      lastName: "Johnson",
      email: "alice@example.com",
      phone: "555-0001",
    },
    {
      firstName: "Bob",
      lastName: "Smith",
      email: "bob@example.com",
      phone: "555-0002",
    },
    {
      firstName: "Carol",
      lastName: "Williams",
      email: "carol@example.com",
      phone: "555-0003",
    },
  ];

  const results = [];

  for (const contact of contactsToCreate) {
    const result = await repo.create({
      ...contact,
      userId,
    });

    results.push({
      email: contact.email,
      success: result.success,
      id: result.data?.id,
      error: result.error,
    });
  }

  // Results:
  // [
  //   { email: "alice@example.com", success: true, id: "..." },
  //   { email: "bob@example.com", success: true, id: "..." },
  //   { email: "carol@example.com", success: true, id: "..." }
  // ]

  return results;
}

// ============================================
// EXAMPLE 9: Search and Filter
// ============================================

export async function exampleGetContactsByDomain(
  env: any,
  userId: string,
  domain: string
) {
  const repo = new ContactRepository(env);

  const result = await repo.findByUserId(userId);

  if (result.success) {
    // Filter in memory (or use Prisma with where clause for better performance)
    const filtered = result.data.filter((c) => c.email.endsWith(`@${domain}`));

    console.log(`Found ${filtered.length} contacts with domain: ${domain}`);
    return filtered;
  }

  return [];
}

// ============================================
// NOTES
// ============================================

/*
Key Benefits of Using Prisma:
1. Type Safety - Full TypeScript support
2. Less Code - No manual SQL strings
3. Performance - Automatic query optimization
4. Validation - Built-in field validation
5. Maintainability - Clear, readable operations
6. Scalability - Easy to add new models

Always handle errors gracefully by checking result.success
and providing user-friendly error messages.

For complex queries, you can extend the ContactRepository
with custom methods that use Prisma's query builder.
*/
