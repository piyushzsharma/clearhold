import { z } from 'zod'

export const publicRegistrationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').transform((email) => email.toLowerCase()),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  role: z.enum(['CLIENT', 'MERCHANT']).default('CLIENT'),
}).strict()
