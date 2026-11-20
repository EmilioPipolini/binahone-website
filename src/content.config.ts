
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const services = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/services',
  }),

  schema: z.object({
    // Identification and publishing
    title: z.string(),
    description: z.string(),
    locale: z.enum(['en', 'pt-br']),
    translationKey: z.string(),
    order: z.number().int().nonnegative(),
    draft: z.boolean().default(true),

    // Service positioning
    headline: z.string(),
    objective: z.string(),

    // Business context
    capabilities: z.array(z.string()),
    businessChallenges: z.array(z.string()),
    businessOutcomes: z.array(z.string()),

    // Integration
    integratedApproach: z.string(),
  }),
});

export const collections = {
  services,
};
