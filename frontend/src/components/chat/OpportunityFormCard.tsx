import { useState } from 'react';

interface OpportunityFormData {
  title: string;
  contactId?: string;
  contactName?: string;
  company?: string;
  value?: number;
  stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability?: number;
  expectedCloseDate?: string;
  description?: string;
  source?: string;
  tags?: string[];
}

interface OpportunityFormCardProps {
  initialData?: Partial<OpportunityFormData>;
  onSubmit: (data: OpportunityFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  title?: string;
}

const stageOptions = [
  { value: 'lead', label: 'Lead', probability: 10 },
  { value: 'qualified', label: 'Qualified', probability: 25 },
  { value: 'proposal', label: 'Proposal', probability: 50 },
  { value: 'negotiation', label: 'Negotiation', probability: 75 },
  { value: 'closed-won', label: 'Closed Won', probability: 100 },
  { value: 'closed-lost', label: 'Closed Lost', probability: 0 },
];

const sourceOptions = [
  'Website',
  'LinkedIn',
  'Referral',
  'Email',
  'Cold Call',
  'Event',
  'Partner',
  'Other',
];

export function OpportunityFormCard({
  initialData = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  title = 'Create New Opportunity',
}: OpportunityFormCardProps) {
  const [formData, setFormData] = useState<OpportunityFormData>({
    title: initialData.title || '',
    contactId: initialData.contactId || '',
    contactName: initialData.contactName || '',
    company: initialData.company || '',
    value: initialData.value,
    stage: initialData.stage || 'lead',
    probability: initialData.probability,
    expectedCloseDate: initialData.expectedCloseDate || '',
    description: initialData.description || '',
    source: initialData.source || '',
    tags: initialData.tags || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const validateField = (name: string, value: any): string | null => {
    if (name === 'title' && !value?.trim()) {
      return 'Title is required';
    }
    if (name === 'value' && value !== undefined && value < 0) {
      return 'Value must be positive';
    }
    if (name === 'probability' && value !== undefined) {
      if (value < 0 || value > 100) {
        return 'Probability must be between 0-100';
      }
    }
    return null;
  };

  const handleChange = (field: keyof OpportunityFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-set probability based on stage
    if (field === 'stage') {
      const selectedStage = stageOptions.find((s) => s.value === value);
      if (selectedStage && formData.probability === undefined) {
        setFormData((prev) => ({ ...prev, probability: selectedStage.probability }));
      }
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Validate on change
    const error = validateField(field, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    const titleError = validateField('title', formData.title);

    if (titleError) newErrors.title = titleError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-4 mb-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      </div>

      {/* Required Fields */}
      <div className="space-y-3 mb-3">
        {/* Title Field */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Opportunity Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enterprise Platform Deal"
            disabled={isSubmitting}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed ${
              errors.title ? 'border-red-300 bg-red-50' : 'border-stone-300'
            }`}
          />
          {errors.title && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.title}
            </p>
          )}
        </div>

        {/* Company/Contact Field */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Contact
            </label>
            <input
              type="text"
              value={formData.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              placeholder="John Smith"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Acme Corp"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Value and Stage */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Deal Value ($)
            </label>
            <input
              type="number"
              value={formData.value || ''}
              onChange={(e) => handleChange('value', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="50000"
              min="0"
              step="100"
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed ${
                errors.value ? 'border-red-300 bg-red-50' : 'border-stone-300'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Stage
            </label>
            <select
              value={formData.stage}
              onChange={(e) => handleChange('stage', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
            >
              {stageOptions.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Probability (auto-filled based on stage) */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Probability (%)
          </label>
          <input
            type="number"
            value={formData.probability || ''}
            onChange={(e) => handleChange('probability', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="75"
            min="0"
            max="100"
            disabled={isSubmitting}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed ${
              errors.probability ? 'border-red-300 bg-red-50' : 'border-stone-300'
            }`}
          />
          {errors.probability && (
            <p className="text-xs text-red-600 mt-1">{errors.probability}</p>
          )}
        </div>
      </div>

      {/* Toggle Optional Fields */}
      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 mb-3 font-medium"
        disabled={isSubmitting}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={showOptional ? 'M20 12H4' : 'M12 4v16m8-8H4'}
          />
        </svg>
        {showOptional ? 'Hide optional fields' : 'Add more details'}
      </button>

      {/* Optional Fields */}
      {showOptional && (
        <div className="space-y-3 mb-3 pb-3 border-t border-stone-100 pt-3">
          {/* Expected Close Date */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Expected Close Date
            </label>
            <input
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => handleChange('expectedCloseDate', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the opportunity..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Source
            </label>
            <select
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
            >
              <option value="">Select source</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag"
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={isSubmitting || !tagInput.trim()}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-100 text-stone-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-stone-100 text-stone-700 rounded"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={isSubmitting}
                      className="hover:text-red-600 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-stone-100">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Create Opportunity
            </>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-100 text-stone-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-stone-500 text-center mt-3">
        <span className="text-red-500">*</span> Required fields
      </p>
    </form>
  );
}
