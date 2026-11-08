import { z } from 'zod/v3';
export const rollVisualSchema = z.object({
  label: z.string().max(300), potential: z.number().finite(),
  outcome: z.enum(['failure', 'success', 'prowess', 'complication']),
  successes: z.number().finite().optional(), prowess: z.boolean().optional(),
  groupCount: z.number().int().min(1).max(20).optional(), groupSuccesses: z.number().int().min(0).max(20).optional(),
  dice: z.array(z.object({
    sides: z.union([z.literal(4),z.literal(6),z.literal(8),z.literal(10),z.literal(12),z.literal(20)]),
    value: z.number().int().min(1).max(20), kind: z.enum(['diff','destin','supernatural']),
    outcome: z.enum(['neutral','failure','success','prowess','complication','discarded']),
  }).refine(die => die.value <= die.sides)).max(32),
});
export type RollVisual = z.infer<typeof rollVisualSchema>;
