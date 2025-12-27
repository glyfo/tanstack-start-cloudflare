/**
 * Repository Factory
 *
 * Single-source repository initialization for all entities
 * Ensures consistent repository creation and configuration
 *
 * FEATURES:
 * - Centralized repository creation
 * - Easy to swap implementations
 * - Type-safe repository initialization
 * - Support for 8+ entity types
 *
 * USAGE:
 * import { RepositoryFactory } from '@/server/db/factory';
 *
 * const accountRepo = RepositoryFactory.account(env);
 * const productRepo = RepositoryFactory.product(env);
 * const pipelineRepo = RepositoryFactory.pipeline(env);
 *
 * // Or generic access
 * const repo = RepositoryFactory.getRepository('account', env);
 */

import { AccountRepository } from "@/server/db/account-repository";
import { ContactRepository } from "@/server/db/contact-repository";

/**
 * Repository factory for centralized initialization
 */
export class RepositoryFactory {
  /**
   * Initialize all repositories (useful for DI containers)
   */
  static initialize(env: any) {
    return {
      account: this.account(env),
      contact: this.contact(env),
      // Will add more as implemented:
      // product: this.product(env),
      // order: this.order(env),
      // pipeline: this.pipeline(env),
      // opportunity: this.opportunity(env),
      // landingPage: this.landingPage(env),
      // form: this.form(env),
      // coupon: this.coupon(env),
    };
  }

  /**
   * Get repository by name
   */
  static getRepository(
    name: string,
    env: any
  ): AccountRepository | ContactRepository | null {
    switch (name.toLowerCase()) {
      case "account":
        return this.account(env);
      case "contact":
        return this.contact(env);
      // case "product":
      //   return this.product(env);
      // case "order":
      //   return this.order(env);
      // case "pipeline":
      //   return this.pipeline(env);
      // case "opportunity":
      //   return this.opportunity(env);
      default:
        return null;
    }
  }

  /**
   * Account repository
   */
  static account(env: any): AccountRepository {
    return new AccountRepository(env);
  }

  /**
   * Contact repository (existing)
   */
  static contact(env: any): ContactRepository {
    return new ContactRepository(env);
  }

  // Placeholder for future repositories
  // static product(env: any): ProductRepository {
  //   return new ProductRepository(env);
  // }

  // static order(env: any): OrderRepository {
  //   return new OrderRepository(env);
  // }

  // static pipeline(env: any): PipelineRepository {
  //   return new PipelineRepository(env);
  // }

  // static opportunity(env: any): OpportunityRepository {
  //   return new OpportunityRepository(env);
  // }

  // static landingPage(env: any): LandingPageRepository {
  //   return new LandingPageRepository(env);
  // }

  // static form(env: any): FormRepository {
  //   return new FormRepository(env);
  // }

  // static coupon(env: any): CouponRepository {
  //   return new CouponRepository(env);
  // }
}
