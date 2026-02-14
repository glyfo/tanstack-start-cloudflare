/**
 * WhatsApp Conversation Card Component
 *
 * Displays WhatsApp conversation with message history
 * Shows contact info, message status, and 24-hour window
 */

export interface WhatsAppMessage {
  id: string;
  messageId: string;
  direction: 'inbound' | 'outbound';
  type: string;
  content: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: number;
  metadata?: any;
}

export interface WhatsAppConversationData {
  waId: string;
  contactName?: string;
  phoneNumber: string;
  messageCount: number;
  lastInboundMessageTime?: number;
  lastOutboundMessageTime?: number;
  withinWindow: boolean;
  messages: WhatsAppMessage[];
}

// MCP Apps pattern - Tool invocation result
interface ToolInvokeResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface WhatsAppConversationCardProps {
  conversation: WhatsAppConversationData;
  onSendMessage?: (waId: string, message: string) => void;
  onSendTemplate?: (waId: string, templateName: string) => void;
  onViewDetails?: (waId: string) => void;
  // MCP Apps pattern - direct tool invocation
  onInvokeTool?: (toolId: string, params: Record<string, any>) => Promise<ToolInvokeResult>;
}

export function WhatsAppConversationCard({
  conversation,
  onSendMessage,
  onSendTemplate,
  onViewDetails,
  onInvokeTool,
}: WhatsAppConversationCardProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // MCP Apps pattern - handle send message with direct tool invocation
  const handleSendMessage = async () => {
    const message = prompt('Enter message:');
    if (!message) return;

    if (onInvokeTool) {
      try {
        await onInvokeTool('server.sendWhatsAppMessage', {
          waId: conversation.waId,
          phoneNumber: conversation.phoneNumber,
          message,
        });
      } catch (error) {
        console.error('Failed to send WhatsApp message:', error);
      }
    } else if (onSendMessage) {
      onSendMessage(conversation.waId, message);
    }
  };

  // MCP Apps pattern - handle send template with direct tool invocation
  const handleSendTemplate = async (templateName: string = 'welcome_message') => {
    if (onInvokeTool) {
      try {
        await onInvokeTool('server.sendWhatsAppTemplate', {
          waId: conversation.waId,
          phoneNumber: conversation.phoneNumber,
          templateName,
        });
      } catch (error) {
        console.error('Failed to send WhatsApp template:', error);
      }
    } else if (onSendTemplate) {
      onSendTemplate(conversation.waId, templateName);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'sent':
        return 'text-stone-400';
      case 'delivered':
        return 'text-sky-500';
      case 'read':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-stone-400';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">
              {conversation.contactName || conversation.phoneNumber}
            </h3>
            <p className="text-sm text-stone-500">
              {conversation.phoneNumber}
            </p>
          </div>
        </div>

        {/* Window Status */}
        <div className="flex items-center gap-2">
          {conversation.withinWindow ? (
            <span className="px-2 py-1 rounded border border-green-200 text-xs font-medium bg-green-100 text-green-700">
              Active Window
            </span>
          ) : (
            <span className="px-2 py-1 rounded border border-orange-200 text-xs font-medium bg-orange-100 text-orange-700">
              Template Required
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 max-h-96 overflow-y-auto space-y-3">
        {conversation.messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No messages yet
          </div>
        ) : (
          conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  message.direction === 'outbound'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                  <span>{formatTime(message.timestamp)}</span>
                  {message.direction === 'outbound' && message.status && (
                    <svg
                      className={`w-4 h-4 ${getStatusColor(message.status)}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      {message.status === 'read' ? (
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      ) : (
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" />
                      )}
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          {conversation.withinWindow && (onSendMessage || onInvokeTool) && (
            <button
              onClick={handleSendMessage}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-md transition-colors"
            >
              Send Message
            </button>
          )}

          {!conversation.withinWindow && (onSendTemplate || onInvokeTool) && (
            <button
              onClick={() => handleSendTemplate('welcome_message')}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors"
            >
              Send Template
            </button>
          )}

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(conversation.waId)}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Details
            </button>
          )}
        </div>

        {/* Window Info */}
        {conversation.lastInboundMessageTime && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last message:{' '}
            {formatTime(conversation.lastInboundMessageTime)}
            {!conversation.withinWindow && (
              <span className="ml-2 text-orange-600 dark:text-orange-400">
                (24-hour window expired - use template to re-engage)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * WhatsApp Conversation List Component
 */
interface WhatsAppConversationListProps {
  conversations: WhatsAppConversationData[];
  onSendMessage?: (waId: string, message: string) => void;
  onSendTemplate?: (waId: string, templateName: string) => void;
  onViewDetails?: (waId: string) => void;
  emptyMessage?: string;
}

export function WhatsAppConversationList({
  conversations,
  onSendMessage,
  onSendTemplate,
  onViewDetails,
  emptyMessage = 'No WhatsApp conversations yet',
}: WhatsAppConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {emptyMessage}
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conversations.map((conversation) => (
        <WhatsAppConversationCard
          key={conversation.waId}
          conversation={conversation}
          onSendMessage={onSendMessage}
          onSendTemplate={onSendTemplate}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
