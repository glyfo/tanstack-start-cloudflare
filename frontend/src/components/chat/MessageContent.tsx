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
import { SuccessCard, SuccessNotification } from "./SuccessCard";
// Form cards (CreateContactCard, CreateOpportunityCard, etc.) are now only rendered via state-driven pattern in ChatEngine

// Message Content Renderer - Detects and renders structured data as cards
// Form-related props are kept for backward compatibility but are no longer used in inline rendering
export interface MessageContentProps {
  content: string;
  onContactCreate?: (data: any) => void;
  onContactCancel?: () => void;
  onOpportunityCreate?: (data: any) => void;
  onOpportunityCancel?: () => void;
  onContextUpdate?: (context: any) => void;
  onContactSelected?: (contact: { contactId: string; contactName: string; contactEmail: string; company?: string }) => void;
  onSearchContacts?: (query: string) => Promise<Array<{ id: string; name: string; email: string; company?: string }>>;
}

function MessageContent({ content, onContactCreate, onContactCancel, onOpportunityCreate, onOpportunityCancel, onContextUpdate, onContactSelected, onSearchContacts }: MessageContentProps) {
  // Try to detect structured data blocks in the format: ```json:card-type\n{data}\n```
  // Memoized to avoid re-running regex parsing on every render
  // NOTE: Form cards (create-contact-form, create-opportunity-form, etc.) are excluded from inline rendering
  // They should only be rendered via state-driven cards (agentState.ui.activeCard) to prevent duplicate handlers
  const parts = useMemo(() => {
    const cardRegex = /```json:(contact|contact-list|opportunity|opportunity-list|action|tiktok-lead|facebook-lead|instagram-lead|whatsapp-conversation|success|notification)\n([\s\S]*?)```/g;
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
