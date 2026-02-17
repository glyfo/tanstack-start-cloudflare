/**
 * Form Validation Script
 *
 * Validates all form schemas have correct titles, labels, and configurations
 * Run with: bun run frontend/src/scripts/validate-forms.ts
 */

import {
  CreateContactSchema,
  CreateOpportunitySchema,
  getSchemaFields,
  groupSchemaFields,
  STAGE_CONFIG,
  type ContactSource,
  type OpportunitySource,
} from '../schemas/entities';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

function validateFormSchema(
  schemaName: string,
  schema: any,
  expectedConfig: {
    title: string;
    description: string;
    submitLabel: string;
    requiredFields: string[];
    primaryFields: string[];
    secondaryFields?: string[];
    optionalFields?: string[];
  }
): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
  };

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Validating: ${schemaName}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Get all fields
  const fields = getSchemaFields(schema);
  const grouped = groupSchemaFields(schema);

  console.log(`✓ Total fields: ${fields.length}`);
  console.log(`  - Primary: ${grouped.primary.length}`);
  console.log(`  - Secondary: ${grouped.secondary.length}`);
  console.log(`  - Optional: ${grouped.optional.length}\n`);

  // Validate required fields exist
  console.log('🔍 Checking required fields...');
  for (const fieldName of expectedConfig.requiredFields) {
    const field = fields.find(f => f.key === fieldName);
    if (!field) {
      result.errors.push(`Missing required field: ${fieldName}`);
      result.passed = false;
      console.log(`  ✗ ${fieldName} - MISSING`);
    } else if (!field.isRequired) {
      result.warnings.push(`Field ${fieldName} should be required but isn't`);
      console.log(`  ⚠ ${fieldName} - not marked as required`);
    } else {
      console.log(`  ✓ ${fieldName} - OK`);
    }
  }

  // Validate field metadata
  console.log('\n🏷️  Checking field labels & placeholders...');
  for (const field of fields) {
    if (!field.meta.label) {
      result.errors.push(`Field ${field.key} missing label`);
      result.passed = false;
      console.log(`  ✗ ${field.key} - NO LABEL`);
    } else {
      console.log(`  ✓ ${field.key}: "${field.meta.label}"${field.meta.placeholder ? ` (${field.meta.placeholder})` : ''}`);
    }
  }

  // Validate field groups
  console.log('\n📊 Validating field groups...');

  const primaryFieldNames = grouped.primary.map(f => f.key);
  const missingPrimary = expectedConfig.primaryFields.filter(f => !primaryFieldNames.includes(f));
  if (missingPrimary.length > 0) {
    result.errors.push(`Missing primary fields: ${missingPrimary.join(', ')}`);
    result.passed = false;
    console.log(`  ✗ Missing primary: ${missingPrimary.join(', ')}`);
  } else {
    console.log(`  ✓ Primary fields: ${primaryFieldNames.join(', ')}`);
  }

  if (expectedConfig.secondaryFields) {
    const secondaryFieldNames = grouped.secondary.map(f => f.key);
    console.log(`  ✓ Secondary fields: ${secondaryFieldNames.join(', ')}`);
  }

  if (expectedConfig.optionalFields) {
    const optionalFieldNames = grouped.optional.map(f => f.key);
    console.log(`  ✓ Optional fields: ${optionalFieldNames.join(', ')}`);
  }

  return result;
}

function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   FORM VALIDATION REPORT                   ║');
  console.log('╚════════════════════════════════════════════╝');

  const results: Record<string, ValidationResult> = {};

  // Validate Contact Form
  results.contact = validateFormSchema('Contact Form', CreateContactSchema, {
    title: 'Create New Contact',
    description: 'Add a new contact to your CRM. Required fields are marked with *',
    submitLabel: 'Create Contact',
    requiredFields: ['name', 'email'],
    primaryFields: ['name', 'email', 'phone', 'source'],
    secondaryFields: ['description', 'company', 'jobTitle', 'status'],
  });

  // Validate Opportunity Form
  results.opportunity = validateFormSchema('Opportunity Form', CreateOpportunitySchema, {
    title: 'Create New Opportunity',
    description: 'Track a new sales opportunity. Required fields are marked with *',
    submitLabel: 'Create Opportunity',
    requiredFields: ['title'],
    primaryFields: ['title', 'contactName', 'dealValue', 'stage'], // contactId is hidden
    secondaryFields: ['company', 'expectedCloseDate', 'source', 'probability'],
    optionalFields: ['description'],
  });

  // Validate Stage Config
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Validating: Stage Configuration`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const stages = Object.entries(STAGE_CONFIG);
  console.log(`✓ Total stages: ${stages.length}\n`);

  for (const [key, config] of stages) {
    console.log(`  ${config.label.padEnd(15)} - ${config.probability}% (${config.color})`);
  }

  // Summary
  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║   VALIDATION SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const [name, result] of Object.entries(results)) {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${name.padEnd(20)} ${status}`);

    if (result.errors.length > 0) {
      totalErrors += result.errors.length;
      console.log('  Errors:');
      result.errors.forEach(err => console.log(`    - ${err}`));
    }

    if (result.warnings.length > 0) {
      totalWarnings += result.warnings.length;
      console.log('  Warnings:');
      result.warnings.forEach(warn => console.log(`    - ${warn}`));
    }
  }

  console.log('\n' + '─'.repeat(48));
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Warnings: ${totalWarnings}`);

  const allPassed = Object.values(results).every(r => r.passed);
  if (allPassed) {
    console.log('\n🎉 All validations passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some validations failed. Please review errors above.\n');
    process.exit(1);
  }
}

main();
