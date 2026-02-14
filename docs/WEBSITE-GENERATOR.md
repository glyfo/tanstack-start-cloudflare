# AI Website Generator - Future Feature

Auto-generate and publish customer websites from chat prompts.

---

## Overview

Users describe their business in chat, and the platform automatically generates and publishes a professional website - no technical knowledge required.

```
User: "Create a website for my plumbing business. We do repairs,
       installations, and emergency service in Miami. Phone: 305-555-1234"

AI: ✓ Generated website
    ✓ Published automatically
    🌐 Live at: miami-plumbing.superhuman.site
```

---

## Architecture

### Two Workers, Shared Data

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Account                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Worker 1: TanStack Start          Worker 2: Astro SSR      │
│  ────────────────────────          ─────────────────────    │
│  app.superhuman.site               *.superhuman.site        │
│                                                              │
│  • Dashboard                       • Customer websites       │
│  • Chat/AI                         • Landing pages           │
│  • Settings                        • Contact forms           │
│  • API endpoints                   • SEO optimized           │
│                                                              │
│         │                                   │                │
│         └───────────┬───────────────────────┘                │
│                     │                                        │
│                     ▼                                        │
│         ┌─────────────────────┐                              │
│         │   Shared Durable    │                              │
│         │   Objects           │                              │
│         │                     │                              │
│         │  • WebsiteDO        │                              │
│         │  • ContactDO        │                              │
│         │  • LeadsDO          │                              │
│         └─────────────────────┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why Two Workers?

| Aspect | TanStack Only | TanStack + Astro |
|--------|---------------|------------------|
| Website performance | Good | Excellent (zero JS) |
| SEO | Requires work | Built-in |
| Content sites | Overkill | Perfect fit |
| Dashboard/App | Perfect fit | Perfect fit |
| Deploy cycle | Coupled | Independent |

---

## User Flow

### 1. Create Website (Chat)

```
User: "Create a website for my bakery in Boston"

AI: I'll create a website for your bakery. Let me gather some details:
    • Business name?
    • Services/products?
    • Contact info?
    • Any specific style preference?

User: "Sweet Boston Bakery, we sell pastries, cakes, and coffee.
       123 Main St, Boston. Phone 617-555-0123. Modern and warm style."

AI: ✓ Website created!

    🌐 Live at: sweet-boston-bakery.superhuman.site

    Sections included:
    • Hero with bakery image
    • Menu/Products
    • About us
    • Contact form (leads come to your dashboard)
    • Location map

    [Preview] [Edit] [Share]
```

### 2. Edit Website (Chat)

```
User: "Add a catering section to my website"

AI: ✓ Added catering section with:
    • Service description
    • Menu options
    • Inquiry form

    Changes are live now.
```

### 3. View Leads (Dashboard)

Leads from website contact forms appear automatically in the chat dashboard.

---

## Data Model

### WebsiteDO Schema

```typescript
interface Website {
  id: string;
  orgId: string;
  slug: string;                    // URL slug

  // Business Info
  businessName: string;
  tagline?: string;
  description?: string;
  logo?: string;

  // Contact
  phone?: string;
  email?: string;
  address?: string;
  hours?: BusinessHours[];
  socialLinks?: SocialLink[];

  // Theme
  theme: {
    primaryColor: string;
    secondaryColor: string;
    style: 'modern' | 'classic' | 'minimal' | 'bold';
    font: string;
  };

  // Content Sections
  sections: WebsiteSection[];

  // Settings
  contactFormEnabled: boolean;
  analyticsEnabled: boolean;

  // Meta
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  status: 'draft' | 'published' | 'archived';
}

interface WebsiteSection {
  id: string;
  type: 'hero' | 'services' | 'about' | 'gallery' | 'testimonials' |
        'pricing' | 'team' | 'faq' | 'contact' | 'cta' | 'custom';
  order: number;
  visible: boolean;
  content: Record<string, any>;  // Section-specific content
}
```

### Example Stored Data

```json
{
  "id": "web_abc123",
  "orgId": "org_xyz",
  "slug": "sweet-boston-bakery",
  "businessName": "Sweet Boston Bakery",
  "tagline": "Fresh pastries daily since 1985",
  "theme": {
    "primaryColor": "#8B4513",
    "secondaryColor": "#FFF8DC",
    "style": "warm",
    "font": "Playfair Display"
  },
  "sections": [
    {
      "id": "sec_1",
      "type": "hero",
      "order": 1,
      "visible": true,
      "content": {
        "title": "Fresh Baked Happiness",
        "subtitle": "Artisan pastries made with love",
        "backgroundImage": "https://...",
        "cta": { "text": "View Menu", "link": "#menu" }
      }
    },
    {
      "id": "sec_2",
      "type": "services",
      "order": 2,
      "visible": true,
      "content": {
        "title": "Our Specialties",
        "items": [
          { "name": "Croissants", "description": "Buttery, flaky perfection", "image": "..." },
          { "name": "Wedding Cakes", "description": "Custom designs", "image": "..." },
          { "name": "Coffee", "description": "Locally roasted", "image": "..." }
        ]
      }
    },
    {
      "id": "sec_3",
      "type": "contact",
      "order": 3,
      "visible": true,
      "content": {
        "title": "Visit Us",
        "showMap": true,
        "showForm": true,
        "formFields": ["name", "email", "phone", "message"]
      }
    }
  ],
  "contactFormEnabled": true,
  "status": "published"
}
```

---

## Repository Structure

### Monorepo Layout

```
superhuman/
├── apps/
│   ├── dashboard/                 # Current TanStack app
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── components/
│   │   │   └── server/
│   │   │       └── tools/
│   │   │           └── website-generator.ts  # AI tool
│   │   ├── wrangler.toml          # → app.superhuman.site
│   │   └── package.json
│   │
│   └── websites/                  # New Astro app
│       ├── src/
│       │   ├── pages/
│       │   │   ├── [...slug].astro        # Dynamic renderer
│       │   │   └── 404.astro
│       │   ├── components/
│       │   │   ├── sections/
│       │   │   │   ├── Hero.astro
│       │   │   │   ├── Services.astro
│       │   │   │   ├── About.astro
│       │   │   │   ├── Gallery.astro
│       │   │   │   ├── Testimonials.astro
│       │   │   │   ├── Pricing.astro
│       │   │   │   ├── Team.astro
│       │   │   │   ├── FAQ.astro
│       │   │   │   ├── Contact.astro
│       │   │   │   └── CTA.astro
│       │   │   ├── ContactForm.astro
│       │   │   ├── Header.astro
│       │   │   └── Footer.astro
│       │   └── layouts/
│       │       └── WebsiteLayout.astro
│       ├── astro.config.mjs
│       ├── wrangler.toml          # → *.superhuman.site
│       └── package.json
│
├── packages/
│   └── shared/                    # Shared code
│       ├── src/
│       │   ├── types/
│       │   │   └── website.ts
│       │   └── do-clients/
│       │       └── website-do.ts
│       └── package.json
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Implementation Components

### 1. AI Website Generator Tool

```typescript
// apps/dashboard/src/server/tools/website-generator.ts

export const websiteGeneratorTool = {
  name: "generateWebsite",
  description: "Generate a website from business description",
  parameters: {
    businessName: { type: "string", required: true },
    businessType: { type: "string", required: true },
    description: { type: "string", required: true },
    services: { type: "array", items: { type: "string" } },
    contactInfo: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" }
      }
    },
    style: { type: "string", enum: ["modern", "classic", "minimal", "bold"] }
  },

  async execute(params, context) {
    // 1. Generate slug from business name
    const slug = generateSlug(params.businessName);

    // 2. Use AI to generate section content
    const sections = await generateSections(params);

    // 3. Select theme based on style
    const theme = selectTheme(params.style, params.businessType);

    // 4. Create website in WebsiteDO
    const websiteDO = getWebsiteDO(context.env, context.orgId);
    const website = await websiteDO.createWebsite({
      slug,
      businessName: params.businessName,
      theme,
      sections,
      contactFormEnabled: true,
      status: 'published'
    });

    // 5. Return result
    return {
      success: true,
      url: `https://${slug}.superhuman.site`,
      websiteId: website.id
    };
  }
};
```

### 2. Astro Dynamic Renderer

```astro
---
// apps/websites/src/pages/[...slug].astro
import WebsiteLayout from '../layouts/WebsiteLayout.astro';
import Hero from '../components/sections/Hero.astro';
import Services from '../components/sections/Services.astro';
import About from '../components/sections/About.astro';
import Contact from '../components/sections/Contact.astro';
// ... other sections

const { slug } = Astro.params;

// Get website data from Durable Object
const websiteDO = getWebsiteDO(Astro.locals.runtime.env, slug);
const website = await websiteDO.getBySlug(slug);

if (!website || website.status !== 'published') {
  return Astro.redirect('/404');
}

// Map section types to components
const sectionComponents = {
  hero: Hero,
  services: Services,
  about: About,
  gallery: Gallery,
  testimonials: Testimonials,
  pricing: Pricing,
  team: Team,
  faq: FAQ,
  contact: Contact,
  cta: CTA
};
---

<WebsiteLayout website={website}>
  {website.sections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order)
    .map(section => {
      const Component = sectionComponents[section.type];
      return Component ? <Component data={section.content} theme={website.theme} /> : null;
    })
  }
</WebsiteLayout>
```

### 3. WebsiteDO (Durable Object)

```typescript
// packages/shared/src/do-clients/website-do.ts

export class WebsiteDO extends DurableObject {
  private db: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.db = state.storage.sql;
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS websites (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        data JSON NOT NULL,
        status TEXT DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_slug ON websites(slug);
      CREATE INDEX IF NOT EXISTS idx_org ON websites(org_id);
    `);
  }

  async createWebsite(website: CreateWebsiteInput): Promise<Website> { ... }
  async getBySlug(slug: string): Promise<Website | null> { ... }
  async updateWebsite(id: string, updates: Partial<Website>): Promise<Website> { ... }
  async deleteWebsite(id: string): Promise<void> { ... }
}
```

### 4. Contact Form Handler

```typescript
// Contact form submissions go to existing ContactDO/LeadsDO

// In Astro contact form:
<form action={`https://app.superhuman.site/api/websites/${website.id}/leads`} method="POST">
  <input name="name" required />
  <input name="email" type="email" required />
  <textarea name="message"></textarea>
  <button type="submit">Send Message</button>
</form>

// API endpoint in dashboard app:
// POST /api/websites/:websiteId/leads
// Creates lead in ContactDO, triggers notification
```

---

## Routing Configuration

### Cloudflare DNS

```
app.superhuman.site      → Dashboard Worker (TanStack)
*.superhuman.site        → Websites Worker (Astro)
```

### Wrangler Configs

```toml
# apps/dashboard/wrangler.toml
name = "superhuman-dashboard"
routes = [
  { pattern = "app.superhuman.site", custom_domain = true }
]

# apps/websites/wrangler.toml
name = "superhuman-websites"
routes = [
  { pattern = "*.superhuman.site", custom_domain = true }
]
```

---

## Future Enhancements

### Phase 1 (MVP)
- [ ] Basic website generation from prompt
- [ ] 5-6 section types (hero, services, about, contact, etc.)
- [ ] 3-4 theme presets
- [ ] Contact form → leads integration
- [ ] Subdomain hosting (slug.superhuman.site)

### Phase 2
- [ ] More section types (gallery, testimonials, pricing, team, FAQ)
- [ ] Custom color picker
- [ ] Image upload/library
- [ ] Edit via chat ("change the hero title")
- [ ] Preview before publish

### Phase 3
- [ ] Custom domain support
- [ ] Analytics dashboard
- [ ] A/B testing
- [ ] Multi-page websites
- [ ] Blog/news section
- [ ] E-commerce integration

### Phase 4
- [ ] Template marketplace
- [ ] White-label option
- [ ] Multi-language support
- [ ] Advanced SEO tools
- [ ] Form builder (custom fields)

---

## Custom Domain Support (Future)

```
┌─────────────────────────────────────────────────────────────┐
│  Custom Domain Flow                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User adds domain: www.mybakery.com                       │
│                                                              │
│  2. System provides DNS records:                             │
│     CNAME: www → websites.superhuman.site                    │
│     TXT: _verify → abc123                                    │
│                                                              │
│  3. User configures DNS at their registrar                   │
│                                                              │
│  4. System verifies & provisions SSL (Cloudflare auto)       │
│                                                              │
│  5. Website live at custom domain                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [Platform Setup Guide](./PLATFORM-SETUP.md) - OAuth & webhook configuration
- [Durable Objects](../src/server/durable-objects/) - Existing DO implementations
