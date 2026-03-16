const { z } = require('zod');

// Validation schema for task creation
const dateField = z.string().nullable().optional()
  .transform(val => val === "" ? null : val)
  .refine(val => val === null || val === undefined || !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  });

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  description: z.string().optional(),
  topics: z.array(z.string()).optional().default([]),
  deadline: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)), {
      message: "Invalid date format"
    }),
  planned_start: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)), {
      message: "Invalid date format"
    }),
  planned_end: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)), {
      message: "Invalid date format"
    }),
  actual_start: dateField, 
  actual_end: dateField,
  status: z.enum(['new', 'process', 'blocked', 'done']).default('new'),
  position: z.number().int().optional().default(0),
  assignee_ids: z.array(z.number().int().positive()).optional().default([]),
  estimated_hours: z.preprocess(
    v => (v === "" || v === null || v === undefined) ? null : Number(v),
    z.number().nullable().optional()
  ),
  label: z.string().optional().default(null)
});

// Validation schema for task updates
const taskUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").trim().optional(),
  description: z.string().optional(),
  topics: z.array(z.string()).optional().default([]),
  deadline: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)) || val === undefined, {
      message: "Invalid date format"
    }),
  planned_start: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)) || val === undefined, {
      message: "Invalid date format"
    }),
  planned_end: z.string().nullable().optional()
    .refine(val => val === null || !isNaN(Date.parse(val)) || val === undefined, {
      message: "Invalid date format"
    }),
  actual_start: dateField,
  actual_end:dateField,
  status: z.enum(['new', 'process', 'blocked', 'done']).optional(),
  position: z.number().int().optional(),
  assignee_ids: z.array(z.number().int().positive()).optional(),
  estimated_hours: z.preprocess(
    v => (v === "" || v === null || v === undefined) ? null : Number(v),
    z.number().nullable().optional()
  ),
  label: z.string().optional().default(null)
}).partial();

// Validation schema for employee creation
const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").trim()
});

module.exports = {
  taskSchema,
  taskUpdateSchema,
  employeeSchema,
};
