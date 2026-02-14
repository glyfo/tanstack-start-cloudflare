import { useState } from 'react';

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

interface ContactFormCardProps {
  initialData?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  title?: string;
}

const sourceOptions = [
  'Website',
  'LinkedIn',
  'Referral',
  'Email',
  'Cold Call',
  'Event',
  'Other',
];

export function ContactFormCard({
  initialData = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  title = 'Create New Contact',
}: ContactFormCardProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: initialData.name || '',
    email: initialData.email || '',
    company: initialData.company || '',
    phone: initialData.phone || '',
    source: initialData.source || '',
    tags: initialData.tags || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const validateField = (name: string, value: string): string | null => {
    if (name === 'name' && !value.trim()) {
      return 'Name is required';
    }
    if (name === 'email') {
      if (!value.trim()) {
        return 'Email is required';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Invalid email format';
      }
    }
    return null;
  };

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Validate on change for better UX
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

    // Validate all required fields
    const newErrors: Record<string, string> = {};
    const nameError = validateField('name', formData.name);
    const emailError = validateField('email', formData.email);

    if (nameError) newErrors.name = nameError;
    if (emailError) newErrors.email = emailError;

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
        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      </div>

      {/* Required Fields */}
      <div className="space-y-3 mb-3">
        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="John Smith"
            disabled={isSubmitting}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed ${
              errors.name ? 'border-red-300 bg-red-50' : 'border-stone-300'
            }`}
          />
          {errors.name && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.name}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john@example.com"
            disabled={isSubmitting}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed ${
              errors.email ? 'border-red-300 bg-red-50' : 'border-stone-300'
            }`}
          />
          {errors.email && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.email}
            </p>
          )}
        </div>

        {/* Company Field */}
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

      {/* Toggle Optional Fields */}
      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 mb-3 font-medium"
        disabled={isSubmitting}
      >
        <svg
          className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-0' : 'rotate-0'}`}
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
          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-stone-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Source Field */}
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

          {/* Tags Field */}
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
              Create Contact
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
