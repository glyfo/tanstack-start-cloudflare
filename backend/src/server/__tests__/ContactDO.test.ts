/**
 * Comprehensive tests for ContactDO
 *
 * Tests CRUD operations, validation, search, relationships,
 * activity logging, and bulk operations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock cloudflare:workers before importing ContactDO
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(public ctx: any, public env: any) {}
  },
}));

import { ContactDO, Contact } from "../durable-objects/ContactDO";

// Mock DurableObjectState with full SQL support
class MockDurableObjectState {
  private sqlData = {
    contacts: [] as any[],
    contact_activities: [] as any[],
    contact_relationships: [] as any[],
  };

  sql = {
    exec: (query: string, ...params: any[]) => {
      const trimmedQuery = query.trim().toUpperCase();

      // CREATE TABLE / CREATE INDEX
      if (trimmedQuery.startsWith("CREATE")) {
        return { toArray: () => [] };
      }

      // INSERT INTO contacts
      if (trimmedQuery.includes("INSERT INTO CONTACTS")) {
        const contact = {
          id: params[0],
          name: params[1],
          email: params[2],
          company: params[3],
          phone: params[4],
          job_title: params[5],
          notes: params[6],
          lead_score: params[7],
          tags: params[8],
          custom_fields: params[9],
          created_by: params[10],
          status: "active",
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        };
        this.sqlData.contacts.push(contact);
        return { toArray: () => [] };
      }

      // INSERT INTO contact_activities
      if (trimmedQuery.includes("INSERT INTO CONTACT_ACTIVITIES")) {
        const activity = {
          id: params[0],
          contact_id: params[1],
          activity_type: params[2],
          description: params[3],
          metadata: params[4],
          created_by: params[5],
          created_at: Math.floor(Date.now() / 1000),
        };
        this.sqlData.contact_activities.push(activity);
        return { toArray: () => [] };
      }

      // INSERT INTO contact_relationships
      if (trimmedQuery.includes("INSERT INTO CONTACT_RELATIONSHIPS")) {
        const relationship = {
          id: params[0],
          contact_a_id: params[1],
          contact_b_id: params[2],
          relationship_type: params[3],
          metadata: params[4],
          created_at: Math.floor(Date.now() / 1000),
        };
        this.sqlData.contact_relationships.push(relationship);
        return { toArray: () => [] };
      }

      // SELECT * FROM contacts WHERE id = ?
      if (trimmedQuery.includes("SELECT * FROM CONTACTS WHERE ID = ?")) {
        const contact = this.sqlData.contacts.find((c) => c.id === params[0]);
        return { toArray: () => (contact ? [contact] : []) };
      }

      // SELECT * FROM contacts WHERE email = ?
      if (trimmedQuery.includes("SELECT * FROM CONTACTS WHERE EMAIL = ?")) {
        const contact = this.sqlData.contacts.find(
          (c) => c.email.toLowerCase() === params[0].toLowerCase()
        );
        return { toArray: () => (contact ? [contact] : []) };
      }

      // SELECT id, name FROM contacts WHERE email = ?
      if (
        trimmedQuery.includes("SELECT ID, NAME FROM CONTACTS WHERE EMAIL = ?")
      ) {
        const contact = this.sqlData.contacts.find(
          (c) => c.email.toLowerCase() === params[0].toLowerCase()
        );
        return {
          toArray: () =>
            contact ? [{ id: contact.id, name: contact.name }] : [],
        };
      }

      // SELECT stats (must be before COUNT check since it includes COUNT)
      if (trimmedQuery.includes("SUM(CASE WHEN")) {
        const total = this.sqlData.contacts.length;
        const active = this.sqlData.contacts.filter(
          (c) => c.status === "active"
        ).length;
        const inactive = this.sqlData.contacts.filter(
          (c) => c.status === "inactive"
        ).length;
        const archived = this.sqlData.contacts.filter(
          (c) => c.status === "archived"
        ).length;
        const avgScore =
          active > 0
            ? this.sqlData.contacts
                .filter((c) => c.status === "active")
                .reduce((sum, c) => sum + c.lead_score, 0) / active
            : 0;

        return {
          toArray: () => [
            {
              total,
              active,
              inactive,
              archived,
              avg_lead_score: avgScore,
            },
          ],
        };
      }

      // COUNT queries (simpler queries)
      if (trimmedQuery.includes("COUNT(*)")) {
        if (
          trimmedQuery.includes("FROM CONTACTS") &&
          !trimmedQuery.includes("WHERE")
        ) {
          // COUNT(*) FROM contacts without WHERE - for listContacts total
          const count = this.sqlData.contacts.length;
          return { toArray: () => [{ count }] };
        } else if (trimmedQuery.includes("WHERE STATUS = ?")) {
          // COUNT with status filter
          const count = this.sqlData.contacts.filter(
            (c) => c.status === (params[0] || "active")
          ).length;
          return { toArray: () => [{ count }] };
        }
      }

      // SELECT top companies
      if (trimmedQuery.includes("GROUP BY COMPANY")) {
        const companyCounts = new Map<string, number>();
        this.sqlData.contacts
          .filter((c) => c.company && c.status === "active")
          .forEach((c) => {
            companyCounts.set(
              c.company,
              (companyCounts.get(c.company) || 0) + 1
            );
          });

        const limit = params[params.length - 1] || 10;
        const results = Array.from(companyCounts.entries())
          .map(([company, count]) => ({ company, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);

        return { toArray: () => results };
      }

      // SELECT activities
      if (trimmedQuery.includes("SELECT * FROM CONTACT_ACTIVITIES")) {
        const contactId = params[0];
        const limit = params[1] || 50;
        const offset = params[2] || 0;

        const activities = this.sqlData.contact_activities
          .filter((a) => a.contact_id === contactId)
          .sort((a, b) => b.created_at - a.created_at)
          .slice(offset, offset + limit);

        return { toArray: () => activities };
      }

      // SELECT relationships
      if (trimmedQuery.includes("SELECT * FROM CONTACT_RELATIONSHIPS")) {
        const contactId = params[0];
        const relationships = this.sqlData.contact_relationships.filter(
          (r) => r.contact_a_id === contactId || r.contact_b_id === contactId
        );

        return { toArray: () => relationships };
      }

      // UPDATE contacts
      if (trimmedQuery.includes("UPDATE CONTACTS SET")) {
        const contactId = params[params.length - 1];
        const contact = this.sqlData.contacts.find((c) => c.id === contactId);

        if (contact) {
          // Dynamically parse all field updates from bindings
          let paramIndex = 0;

          if (query.includes("name = ?")) {
            contact.name = params[paramIndex++];
          }
          if (query.includes("email = ?")) {
            contact.email = params[paramIndex++];
          }
          if (query.includes("company = ?")) {
            contact.company = params[paramIndex++];
          }
          if (query.includes("phone = ?")) {
            contact.phone = params[paramIndex++];
          }
          if (query.includes("job_title = ?")) {
            contact.job_title = params[paramIndex++];
          }
          if (query.includes("notes = ?")) {
            contact.notes = params[paramIndex++];
          }
          if (query.includes("lead_score = ?")) {
            contact.lead_score = params[paramIndex++];
          }
          if (query.includes("status = ?")) {
            contact.status = params[paramIndex++];
          }
          // Handle literal status values (for soft delete)
          if (query.includes("status = 'archived'")) {
            contact.status = "archived";
          }
        }

        return { run: () => ({}) };
      }

      // DELETE contact permanently
      if (trimmedQuery.includes("DELETE FROM CONTACTS WHERE ID = ?")) {
        const contactId = params[0];
        const index = this.sqlData.contacts.findIndex(
          (c) => c.id === contactId
        );
        if (index !== -1) {
          this.sqlData.contacts.splice(index, 1);
        }
        return { run: () => ({}) };
      }

      // Default list/search - SELECT * FROM contacts with various WHERE clauses
      if (trimmedQuery.includes("SELECT * FROM CONTACTS")) {
        let results = [...this.sqlData.contacts];

        // Extract parameters based on query structure
        let paramIndex = 0;

        // Apply status filter (most common)
        if (
          query.includes("WHERE status = ?") ||
          query.includes("AND status = ?")
        ) {
          const status = params[paramIndex++];
          results = results.filter((c) => c.status === status);
        }

        // Apply search filters
        if (
          query.includes("name LIKE ?") ||
          query.includes("email LIKE ?") ||
          query.includes("company LIKE ?")
        ) {
          const searchTerm = params[paramIndex++];
          if (searchTerm) {
            const term = searchTerm.replace(/%/g, "").toLowerCase();
            results = results.filter(
              (c) =>
                c.name.toLowerCase().includes(term) ||
                c.email.toLowerCase().includes(term) ||
                (c.company && c.company.toLowerCase().includes(term))
            );
          }
        }

        // Apply company filter
        if (query.includes("company = ?")) {
          const company = params[paramIndex++];
          results = results.filter((c) => c.company === company);
        }

        // Apply lead score filter
        if (query.includes("lead_score >= ?")) {
          const minScore = params[paramIndex++];
          results = results.filter((c) => c.lead_score >= minScore);
        }

        // Apply tags filter
        if (query.includes("tags LIKE ?")) {
          // Tags are filtered with LIKE pattern like %"vip"%
          // We need to extract all tag LIKE patterns from params
          const tagPatterns: string[] = [];
          for (let i = paramIndex; i < params.length - 2; i++) {
            // Stop when we reach LIMIT and OFFSET params
            const param = params[i];
            if (typeof param === "string" && param.includes('"')) {
              tagPatterns.push(param);
            } else if (typeof param === "number") {
              // Reached numeric params (LIMIT/OFFSET)
              break;
            }
          }

          if (tagPatterns.length > 0) {
            results = results.filter((c) => {
              const tags = JSON.parse(c.tags || "[]");
              return tagPatterns.every((pattern) => {
                // Extract tag from pattern like %"vip"%
                const match = pattern.match(/"([^"]+)"/);
                const searchTag = match ? match[1] : "";
                return tags.includes(searchTag);
              });
            });
          }
        }

        // Apply ORDER BY
        if (query.includes("ORDER BY created_at DESC")) {
          results.sort((a, b) => b.created_at - a.created_at);
        }

        // Skip LIMIT and OFFSET for now, they're at the end
        let limit: number | undefined;
        let offset: number | undefined;

        // Extract LIMIT and OFFSET from remaining params
        if (query.includes("LIMIT ?")) {
          limit = params[params.length - (query.includes("OFFSET ?") ? 2 : 1)];
        }
        if (query.includes("OFFSET ?")) {
          offset = params[params.length - 1];
        }

        // Apply pagination
        if (offset !== undefined && limit !== undefined) {
          results = results.slice(offset, offset + limit);
        } else if (limit !== undefined) {
          results = results.slice(0, limit);
        }

        return { toArray: () => results };
      }

      return { toArray: () => [] };
    },
  };

  id = {
    toString: () => "test-org-id",
  };

  storage = {
    sql: this.sql,
  };
}

describe("ContactDO", () => {
  let contactDO: ContactDO;
  let mockState: MockDurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    mockState = new MockDurableObjectState();
    mockEnv = {};
    contactDO = new ContactDO(mockState as any, mockEnv);
  });

  describe("Contact Creation", () => {
    it("should create a contact with all fields", async () => {
      const contact = await contactDO.createContact({
        name: "John Doe",
        email: "john.doe@example.com",
        company: "Acme Corp",
        phone: "555-1234",
        jobTitle: "CEO",
        notes: "Important client",
        leadScore: 80,
        tags: ["vip", "enterprise"],
        customFields: { industry: "Tech" },
        createdBy: "user123",
      });

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe("John Doe");
      expect(contact.email).toBe("john.doe@example.com");
      expect(contact.company).toBe("Acme Corp");
      expect(contact.leadScore).toBe(80);
      expect(contact.tags).toEqual(["vip", "enterprise"]);
      expect(contact.status).toBe("active");
    });

    it("should create a contact with minimal fields", async () => {
      const contact = await contactDO.createContact({
        name: "Jane Smith",
        email: "jane@example.com",
        createdBy: "user123",
      });

      expect(contact.name).toBe("Jane Smith");
      expect(contact.email).toBe("jane@example.com");
      expect(contact.leadScore).toBe(0);
      expect(contact.status).toBe("active");
    });

    it("should reject contact with invalid name", async () => {
      await expect(
        contactDO.createContact({
          name: "J",
          email: "j@example.com",
          createdBy: "user123",
        })
      ).rejects.toThrow("Name must be at least 2 characters");
    });

    it("should reject contact with invalid email", async () => {
      await expect(
        contactDO.createContact({
          name: "John Doe",
          email: "invalid-email",
          createdBy: "user123",
        })
      ).rejects.toThrow("Valid email is required");
    });

    it("should reject duplicate email", async () => {
      await contactDO.createContact({
        name: "John Doe",
        email: "john@example.com",
        createdBy: "user123",
      });

      await expect(
        contactDO.createContact({
          name: "Jane Doe",
          email: "john@example.com",
          createdBy: "user123",
        })
      ).rejects.toThrow("already exists");
    });

    it("should reject invalid lead score", async () => {
      await expect(
        contactDO.createContact({
          name: "John Doe",
          email: "john@example.com",
          leadScore: 150,
          createdBy: "user123",
        })
      ).rejects.toThrow("Lead score must be between 0 and 100");
    });

    it("should require createdBy field", async () => {
      await expect(
        contactDO.createContact({
          name: "John Doe",
          email: "john@example.com",
          createdBy: "",
        })
      ).rejects.toThrow("createdBy is required");
    });
  });

  describe("Contact Retrieval", () => {
    let testContact: Contact;

    beforeEach(async () => {
      testContact = await contactDO.createContact({
        name: "John Doe",
        email: "john@example.com",
        company: "Acme",
        createdBy: "user123",
      });
    });

    it("should get contact by ID", async () => {
      const contact = await contactDO.getContact(testContact.id);

      expect(contact).toBeDefined();
      expect(contact!.id).toBe(testContact.id);
      expect(contact!.name).toBe("John Doe");
    });

    it("should return null for non-existent contact", async () => {
      const contact = await contactDO.getContact("non-existent-id");
      expect(contact).toBeNull();
    });

    it("should get contact by email", async () => {
      const contact = await contactDO.getContactByEmail("john@example.com");

      expect(contact).toBeDefined();
      expect(contact!.email).toBe("john@example.com");
    });

    it("should get contact by email case-insensitively", async () => {
      const contact = await contactDO.getContactByEmail("JOHN@EXAMPLE.COM");

      expect(contact).toBeDefined();
      expect(contact!.email).toBe("john@example.com");
    });
  });

  describe("Contact Listing and Search", () => {
    beforeEach(async () => {
      // Create multiple contacts
      await contactDO.createContact({
        name: "Alice Johnson",
        email: "alice@techcorp.com",
        company: "TechCorp",
        leadScore: 90,
        tags: ["vip"],
        createdBy: "user123",
      });

      await contactDO.createContact({
        name: "Bob Smith",
        email: "bob@acme.com",
        company: "Acme",
        leadScore: 50,
        createdBy: "user123",
      });

      await contactDO.createContact({
        name: "Charlie Brown",
        email: "charlie@startup.com",
        company: "Startup Inc",
        leadScore: 30,
        createdBy: "user123",
      });
    });

    it("should list all contacts", async () => {
      const result = await contactDO.listContacts();

      expect(result.contacts.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("should list contacts with pagination", async () => {
      const result = await contactDO.listContacts({
        limit: 2,
        offset: 0,
      });

      expect(result.contacts.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it("should search contacts by query", async () => {
      const result = await contactDO.searchContacts({
        query: "Alice",
      });

      expect(result.contacts.length).toBe(1);
      expect(result.contacts[0].name).toBe("Alice Johnson");
    });

    it("should search contacts by company", async () => {
      const result = await contactDO.searchContacts({
        company: "Acme",
      });

      expect(result.contacts.length).toBe(1);
      expect(result.contacts[0].company).toBe("Acme");
    });

    it("should filter by lead score", async () => {
      const result = await contactDO.searchContacts({
        minLeadScore: 50,
      });

      expect(result.contacts.length).toBe(2); // Alice and Bob
      expect(result.contacts.every((c) => c.leadScore >= 50)).toBe(true);
    });

    it("should filter by tags", async () => {
      const result = await contactDO.searchContacts({
        tags: ["vip"],
      });

      expect(result.contacts.length).toBe(1);
      expect(result.contacts[0].name).toBe("Alice Johnson");
    });
  });

  describe("Contact Update", () => {
    let testContact: Contact;

    beforeEach(async () => {
      testContact = await contactDO.createContact({
        name: "John Doe",
        email: "john@example.com",
        company: "Acme",
        leadScore: 50,
        createdBy: "user123",
      });
    });

    it("should update contact name", async () => {
      const updated = await contactDO.updateContact(
        testContact.id,
        { name: "John Smith" },
        "user123"
      );

      expect(updated.name).toBe("John Smith");
    });

    it("should update contact email", async () => {
      const updated = await contactDO.updateContact(
        testContact.id,
        { email: "john.smith@example.com" },
        "user123"
      );

      expect(updated.email).toBe("john.smith@example.com");
    });

    it("should update lead score", async () => {
      const updated = await contactDO.updateContact(
        testContact.id,
        { leadScore: 75 },
        "user123"
      );

      expect(updated.leadScore).toBe(75);
    });

    it("should reject invalid lead score in update", async () => {
      await expect(
        contactDO.updateContact(testContact.id, { leadScore: 150 }, "user123")
      ).rejects.toThrow("Lead score must be between 0 and 100");
    });

    it("should return existing contact if no changes", async () => {
      const updated = await contactDO.updateContact(
        testContact.id,
        {},
        "user123"
      );

      expect(updated.id).toBe(testContact.id);
    });

    it("should reject update for non-existent contact", async () => {
      await expect(
        contactDO.updateContact("non-existent", { name: "Test" }, "user123")
      ).rejects.toThrow("not found");
    });
  });

  describe("Contact Deletion", () => {
    let testContact: Contact;

    beforeEach(async () => {
      testContact = await contactDO.createContact({
        name: "John Doe",
        email: "john@example.com",
        createdBy: "user123",
      });
    });

    it("should soft delete contact", async () => {
      const result = await contactDO.deleteContact(testContact.id, "user123");

      expect(result.success).toBe(true);

      const contact = await contactDO.getContact(testContact.id);
      expect(contact!.status).toBe("archived");
    });

    it("should permanently delete contact", async () => {
      const result = await contactDO.permanentlyDeleteContact(
        testContact.id,
        "user123"
      );

      expect(result.success).toBe(true);

      const contact = await contactDO.getContact(testContact.id);
      expect(contact).toBeNull();
    });
  });

  describe("Activity Logging", () => {
    let testContact: Contact;

    beforeEach(async () => {
      testContact = await contactDO.createContact({
        name: "John Doe",
        email: "john@example.com",
        createdBy: "user123",
      });
    });

    it("should log activity on contact creation", async () => {
      const activities = await contactDO.getActivities(testContact.id);

      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].type).toBe("created");
    });

    it("should log custom activity", async () => {
      await contactDO.logActivity({
        contactId: testContact.id,
        type: "email_sent",
        description: "Sent welcome email",
        createdBy: "user123",
        metadata: { subject: "Welcome!" },
      });

      const activities = await contactDO.getActivities(testContact.id);
      const emailActivity = activities.find((a) => a.type === "email_sent");

      expect(emailActivity).toBeDefined();
      expect(emailActivity!.description).toBe("Sent welcome email");
    });
  });

  describe("Contact Relationships", () => {
    let contact1: Contact;
    let contact2: Contact;

    beforeEach(async () => {
      contact1 = await contactDO.createContact({
        name: "Manager",
        email: "manager@example.com",
        createdBy: "user123",
      });

      contact2 = await contactDO.createContact({
        name: "Employee",
        email: "employee@example.com",
        createdBy: "user123",
      });
    });

    it("should add relationship between contacts", async () => {
      const relationship = await contactDO.addRelationship({
        contactAId: contact1.id,
        contactBId: contact2.id,
        relationshipType: "manager",
        metadata: { department: "Sales" },
      });

      expect(relationship.contactAId).toBe(contact1.id);
      expect(relationship.contactBId).toBe(contact2.id);
      expect(relationship.relationshipType).toBe("manager");
    });

    it("should get relationships for contact", async () => {
      await contactDO.addRelationship({
        contactAId: contact1.id,
        contactBId: contact2.id,
        relationshipType: "manager",
      });

      const relationships = await contactDO.getRelationships(contact1.id);

      expect(relationships.length).toBe(1);
      expect(relationships[0].relationshipType).toBe("manager");
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await contactDO.createContact({
        name: "Active 1",
        email: "active1@example.com",
        leadScore: 80,
        createdBy: "user123",
      });

      await contactDO.createContact({
        name: "Active 2",
        email: "active2@example.com",
        leadScore: 60,
        createdBy: "user123",
      });

      const archived = await contactDO.createContact({
        name: "Archived",
        email: "archived@example.com",
        createdBy: "user123",
      });

      await contactDO.deleteContact(archived.id, "user123");
    });

    it("should return contact statistics", async () => {
      const stats = await contactDO.getStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.archived).toBe(1);
      expect(stats.averageLeadScore).toBeGreaterThan(0);
    });

    it("should return top companies", async () => {
      await contactDO.createContact({
        name: "Acme 1",
        email: "acme1@example.com",
        company: "Acme",
        createdBy: "user123",
      });

      await contactDO.createContact({
        name: "Acme 2",
        email: "acme2@example.com",
        company: "Acme",
        createdBy: "user123",
      });

      const companies = await contactDO.getTopCompanies(5);

      expect(companies.length).toBeGreaterThan(0);
      expect(companies[0].company).toBe("Acme");
      expect(companies[0].count).toBe(2);
    });
  });

  describe("Bulk Import", () => {
    it("should import multiple contacts", async () => {
      const result = await contactDO.bulkImport(
        [
          { name: "Contact 1", email: "c1@example.com" },
          { name: "Contact 2", email: "c2@example.com" },
          { name: "Contact 3", email: "c3@example.com" },
        ],
        "user123"
      );

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("should handle partial import failure", async () => {
      const result = await contactDO.bulkImport(
        [
          { name: "Valid", email: "valid@example.com" },
          { name: "X", email: "invalid" }, // Invalid
          { name: "Another Valid", email: "valid2@example.com" },
        ],
        "user123"
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });
});
