import type { CategoryConfig } from '../types';
import { SubscriptionCategory } from '../types';

export const SUBSCRIPTION_CATEGORIES: CategoryConfig[] = [
  {
    category: SubscriptionCategory.STREAMING,
    displayName: 'Streaming',
    icon: '🎬',
    color: '#FF6B6B',
    description: 'Video and music streaming services'
  },
  {
    category: SubscriptionCategory.PRODUCTIVITY,
    displayName: 'Productivity',
    icon: '⚡',
    color: '#4ECDC4',
    description: 'Tools for work and productivity'
  },
  {
    category: SubscriptionCategory.CLOUD_STORAGE,
    displayName: 'Cloud Storage',
    icon: '☁️',
    color: '#45B7D1',
    description: 'File storage and backup services'
  },
  {
    category: SubscriptionCategory.MUSIC,
    displayName: 'Music',
    icon: '🎵',
    color: '#96CEB4',
    description: 'Music streaming and audio services'
  },
  {
    category: SubscriptionCategory.GAMING,
    displayName: 'Gaming',
    icon: '🎮',
    color: '#FECA57',
    description: 'Gaming platforms and services'
  },
  {
    category: SubscriptionCategory.FITNESS,
    displayName: 'Fitness',
    icon: '💪',
    color: '#FF9FF3',
    description: 'Health and fitness applications'
  },
  {
    category: SubscriptionCategory.EDUCATION,
    displayName: 'Education',
    icon: '📚',
    color: '#54A0FF',
    description: 'Learning platforms and courses'
  },
  {
    category: SubscriptionCategory.SECURITY,
    displayName: 'Security',
    icon: '🔒',
    color: '#5F27CD',
    description: 'Security and privacy tools'
  },
  {
    category: SubscriptionCategory.DEVELOPMENT,
    displayName: 'Development',
    icon: '💻',
    color: '#00D2D3',
    description: 'Software development tools'
  },
  {
    category: SubscriptionCategory.DESIGN,
    displayName: 'Design',
    icon: '🎨',
    color: '#FF9F43',
    description: 'Design and creative tools'
  },
  {
    category: SubscriptionCategory.MARKETING,
    displayName: 'Marketing',
    icon: '📈',
    color: '#EE5A24',
    description: 'Marketing and analytics tools'
  },
  {
    category: SubscriptionCategory.COMMUNICATION,
    displayName: 'Communication',
    icon: '💬',
    color: '#0652DD',
    description: 'Communication and collaboration tools'
  },
  {
    category: SubscriptionCategory.ENTERTAINMENT,
    displayName: 'Entertainment',
    icon: '🎭',
    color: '#833471',
    description: 'Entertainment and media services'
  },
  {
    category: SubscriptionCategory.LIFESTYLE,
    displayName: 'Lifestyle',
    icon: '🌟',
    color: '#F368E0',
    description: 'Lifestyle and personal services'
  },
  {
    category: SubscriptionCategory.UTILITIES,
    displayName: 'Utilities',
    icon: '🔧',
    color: '#A4B0BE',
    description: 'Essential utility services'
  },
  {
    category: SubscriptionCategory.OTHER,
    displayName: 'Other',
    icon: '📦',
    color: '#95A5A6',
    description: 'Other subscription services'
  }
];

export const getCategoryConfig = (category: SubscriptionCategory): CategoryConfig | undefined => {
  return SUBSCRIPTION_CATEGORIES.find(config => config.category === category);
};

export const getAllCategories = (): CategoryConfig[] => {
  return SUBSCRIPTION_CATEGORIES;
};

export const getCategoryIcon = (category: SubscriptionCategory): string => {
  const config = getCategoryConfig(category);
  return config?.icon || '📦';
};

export const getCategoryColor = (category: SubscriptionCategory): string => {
  const config = getCategoryConfig(category);
  return config?.color || '#95A5A6';
};

export const getCategoryDisplayName = (category: SubscriptionCategory): string => {
  const config = getCategoryConfig(category);
  return config?.displayName || category;
};

export const getCategoriesByType = (type: 'popular' | 'all'): CategoryConfig[] => {
  if (type === 'popular') {
    return SUBSCRIPTION_CATEGORIES.filter(cat =>
      [SubscriptionCategory.STREAMING, SubscriptionCategory.PRODUCTIVITY,
       SubscriptionCategory.CLOUD_STORAGE, SubscriptionCategory.MUSIC,
       SubscriptionCategory.FITNESS, SubscriptionCategory.EDUCATION].includes(cat.category)
    );
  }
  return SUBSCRIPTION_CATEGORIES;
};