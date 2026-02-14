import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ContactCard } from "./ContactCard";
import { ContactList } from "./ContactList";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityList } from "./OpportunityList";
import { ActionCard } from "./ActionCard";
import { TikTokLeadCard } from "./TikTokLeadCard";
import { FacebookLeadCard } from "./FacebookLeadCard";
import { InstagramLeadCard } from "./InstagramLeadCard";
import { WhatsAppConversationCard } from "./WhatsAppConversationCard";
import { CreateContactCard } from "./CreateContactCard";
import { CreateOpportunityCard, type OpportunityFormData } from "./CreateOpportunityCard";
import { OpportunityFormWithContact, type OpportunityFormData as OpportunityFormWithContactData } from "./OpportunityFormWithContact";
import { ContactSelectorCard } from "./ContactSelectorCard";
import { SuccessCard, SuccessNotification } from "./SuccessCard";

// Context update type for MCP Apps pattern
interface FormContextUpdate {
  type: string;
  formId: string;
  formState: Record<string, any>;
  action: string;
}

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

// Message Content Renderer - Detects and renders structured data as cards
export interface MessageContentProps {
  content: string;
  onContactCreate?: (data: ContactFormData) => void;
  onContactCancel?: () => void;
  onOpportunityCreate?: (data: OpportunityFormData) => void;
  onOpportunityCancel?: () => void;
  onContextUpdate?: (context: FormContextUpdate) => void;
  onContactSelected?: (contact: { contactId: string; contactName: string; contactEmail: string; company?: string }) => void;
  onSearchContacts?: (query: string) => Promise<Array<{ id: string; name: string; email: string; company?: string }>>;
}

function MessageContent({ content, onContactCreate, onContactCancel, onOpportunityCreate, onOpportunityCancel, onContextUpdate, onContactSelected, onSearchContacts }: MessageContentProps) {
  // Try to detect structured data blocks in the format: ```json:card-type\n{data}\n```
  // Memoized to avoid re-running regex parsing on every render
  const parts = useMemo(() => {
    const cardRegex = /```json:(contact|contact-list|opportunity|opportunity-list|action|tiktok-lead|facebook-lead|instagram-lead|whatsapp-conversation|create-contact-form|create-opportunity-form|opportunity-form-with-contact|contact-selector|success|notification)\n([\s\S]*?)```/g;
    const result: Array<{ type: 'text' | 'card'; content: string; cardType?: string; data?: Record<string, unknown> }> = [];

    let lastIndex = 0;
    let match;

    while ((match = cardRegex.exec(content)) !== null) {
      // Add text before the card
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add the card
      try {
        const cardType = match[1];
        const data = JSON.parse(match[2]) as Record<string, unknown>;
        result.push({
          type: 'card',
          content: match[0],
          cardType,
          data,
        });
      } catch {
        // If JSON parsing fails, treat as regular text
        result.push({
          type: 'text',
          content: match[0],
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    return result;
  }, [content]);

  // If no structured data found, render as regular markdown
  if (parts.length === 0) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return (
            <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
              {part.content}
            </ReactMarkdown>
          );
        } else if (part.type === 'card' && part.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = part.data as any;
          if (part.cardType === 'contact') {
            return <ContactCard key={idx} contact={data} action={data.action} />;
          } else if (part.cardType === 'contact-list') {
            return <ContactList key={idx} contacts={data.contacts || data} />;
          } else if (part.cardType === 'opportunity-list') {
            return <OpportunityList key={idx} opportunities={data.opportunities || data} />;
          } else if (part.cardType === 'opportunity') {
            return <OpportunityCard key={idx} opportunity={data} action={data.action} />;
          } else if (part.cardType === 'action') {
            return (
              <ActionCard
                key={idx}
                title={data.title}
                description={data.description}
                actionType={data.actionType}
              >
                {data.content && (
                  <div className="text-sm text-gray-700">{String(data.content)}</div>
                )}
              </ActionCard>
            );
          } else if (part.cardType === 'tiktok-lead') {
            return <TikTokLeadCard key={idx} lead={data} />;
          } else if (part.cardType === 'facebook-lead') {
            return <FacebookLeadCard key={idx} lead={data} />;
          } else if (part.cardType === 'instagram-lead') {
            return <InstagramLeadCard key={idx} lead={data} />;
          } else if (part.cardType === 'whatsapp-conversation') {
            return <WhatsAppConversationCard key={idx} conversation={data} />;
          } else if (part.cardType === 'create-contact-form') {
            return (
              <CreateContactCard
                key={idx}
                initialData={data}
                onSubmit={onContactCreate || (() => { })}
                onCancel={onContactCancel}
                onContextUpdate={onContextUpdate}
              />
            );
          } else if (part.cardType === 'create-opportunity-form') {
            return (
              <CreateOpportunityCard
                key={idx}
                initialData={data}
                onSubmit={onOpportunityCreate || (() => { })}
                onCancel={onOpportunityCancel}
                onContextUpdate={onContextUpdate}
                onSearchContacts={onSearchContacts}
              />
            );
          } else if (part.cardType === 'opportunity-form-with-contact') {
            return (
              <OpportunityFormWithContact
                key={idx}
                initialData={data as Partial<OpportunityFormWithContactData>}
                onSubmit={onOpportunityCreate || (() => { })}
                onCancel={onOpportunityCancel}
                onContextUpdate={onContextUpdate}
                onSearchContacts={onSearchContacts}
              />
            );
          } else if (part.cardType === 'contact-selector') {
            return (
              <ContactSelectorCard
                key={idx}
                initialData={data}
                onContactSelected={onContactSelected || (() => { })}
                onCancel={onContactCancel}
                onContextUpdate={onContextUpdate}
                onSearch={onSearchContacts}
              />
            );
          } else if (part.cardType === 'success') {
            return (
              <SuccessCard
                key={idx}
                type={data.type || 'contact'}
                action={data.action || 'created'}
                title={data.title || 'Success'}
                subtitle={data.subtitle}
                details={data.details}
              />
            );
          } else if (part.cardType === 'notification') {
            return (
              <SuccessNotification
                key={idx}
                message={data.message || ''}
                type={data.type || 'success'}
              />
            );
          }
        }
        return null;
      })}
    </>
  );
}

export default MessageContent;
