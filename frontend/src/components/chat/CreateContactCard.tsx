/**
 * CreateContactCard - Wrapper for schema-driven contact form
 *
 * This is a thin wrapper that maintains backward compatibility
 * while using the new SchemaForm under the hood.
 */

import { ContactForm } from './SchemaForm';

// Re-export the type for backward compatibility
export interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

interface CreateContactCardProps {
  initialData?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => void;
  onCancel?: () => void;
  onContextUpdate?: (context: {
    type: string;
    formId: string;
    formState: Record<string, any>;
    action: string;
  }) => void;
}

export function CreateContactCard({
  initialData = {},
  onSubmit,
  onCancel,
  onContextUpdate,
}: CreateContactCardProps) {
  const handleSubmit = async (data: any) => {
    // Notify context update
    onContextUpdate?.({
      type: "form-submit",
      formId: "create-contact",
      formState: data,
      action: "submit",
    });

    // Map to legacy format and submit
    onSubmit({
      name: data.name,
      email: data.email,
      company: data.company,
      phone: data.phone,
      source: data.source,
      tags: data.tags,
    });
  };

  return (
    <ContactForm
      initialData={{
        name: initialData.name || '',
        email: initialData.email || '',
        company: initialData.company,
        phone: initialData.phone,
        source: initialData.source as any,
        tags: initialData.tags,
      }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}
