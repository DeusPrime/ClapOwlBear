import { z } from 'zod/v3';
import { imageEditingSchema } from './dataValidation';

// Both individual .clap sheets and complete .clapStudio archives must keep
// the editable front, rather than only its placeholder image.
export const textCardMetadataShape = {
  kind: z.literal('text').optional(),
  text: z.string().max(100000).optional(),
  textFontSize: z.number().min(6).max(20).optional(),
  textVerticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  textFont: z.enum(['courier-prime', 'anton', 'typewriter', 'sans', 'serif', 'mono']).optional(),
  frontEditing: imageEditingSchema.optional(),
};
