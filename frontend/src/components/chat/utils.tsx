// --- Contact utilities ---

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatSource(source?: string): string {
  if (!source) return '';
  const labels: Record<string, string> = {
    website: 'Website', linkedin: 'LinkedIn', referral: 'Referral',
    email: 'Email', cold_call: 'Cold Call', event: 'Event',
    tiktok: 'TikTok', facebook: 'Facebook', instagram: 'Instagram',
    whatsapp: 'WhatsApp', chat: 'Chat', other: 'Other',
  };
  return labels[source] || source;
}

export const sourceColors: Record<string, string> = {
  tiktok: 'bg-stone-900 text-white',
  facebook: 'bg-blue-600 text-white',
  instagram: 'bg-pink-500 text-white',
  whatsapp: 'bg-green-600 text-white',
  linkedin: 'bg-blue-700 text-white',
  website: 'bg-sky-500 text-white',
  referral: 'bg-purple-500 text-white',
  email: 'bg-amber-500 text-white',
  chat: 'bg-stone-600 text-white',
};

export const avatarColors = [
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// --- Opportunity utilities ---

export const formatCurrency = (val?: number) => {
  if (!val) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

export const stageConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  new: { label: 'New', bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  qualification: { label: 'Qualification', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  proposal: { label: 'Proposal', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  negotiation: { label: 'Negotiation', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  closed_won: { label: 'Won', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'closed-won': { label: 'Won', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed_lost: { label: 'Lost', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  'closed-lost': { label: 'Lost', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  discovery: { label: 'Discovery', bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
};

export function getStageBadge(stage?: string) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, '_');
  const config = stageConfig[key] || { label: stage, bg: 'bg-stone-100', text: 'text-stone-600', dot: 'bg-stone-400' };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

export function getStageInfo(stage?: string) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, '_');
  return stageConfig[key] || { label: stage, bg: 'bg-stone-100', text: 'text-stone-600', dot: 'bg-stone-400' };
}
