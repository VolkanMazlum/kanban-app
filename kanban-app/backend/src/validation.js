const { z } = require('zod');

// Validation schema for task creation
const taskSchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  description: z.string().optional(),
  topic: z.string().nullable().optional(),
  deadline: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)), {
      message: "Invalid date format"
    }),
  status: z.enum(['new', 'process', 'blocked', 'done']).default('new'),
  position: z.number().int().optional().default(0),
  assignee_ids: z.array(z.number().int().positive()).optional().default([])
});

// Validation schema for task updates
const taskUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").trim().optional(),
  description: z.string().optional(),
  topic: z.string().nullable().optional(),
  deadline: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)) || val === undefined, {
      message: "Invalid date format"
    }),
  status: z.enum(['new', 'process', 'blocked', 'done']).optional(),
  position: z.number().int().optional(),
  assignee_ids: z.array(z.number().int().positive()).optional()
}).partial();

// Validation schema for employee creation
const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").trim()
});

module.exports = {
  taskSchema,
  taskUpdateSchema,
  employeeSchema
};