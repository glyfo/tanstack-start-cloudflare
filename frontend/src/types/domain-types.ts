/**
 * Domain Configuration Types
 * Defines domain structure and available domains
 */

export interface DomainConfig {
  name: string;
  description: string;
}

export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  sales: {
    name: "sales",
    description: "Sales domain - contact management and lead qualification",
  },
  "customer-service": {
    name: "customer-service",
    description:
      "Customer Service domain - refunds, returns, and customer support",
  },
  support: {
    name: "support",
    description: "Support domain - ticket creation and knowledge base",
  },
};

/**
 * Get all available domain names
 */
export const getDomainNames = (): string[] => Object.keys(DOMAIN_CONFIGS);
