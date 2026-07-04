import { z } from "zod";

export const languageSchema = z.enum(["en", "he"]);
export const themeSchema = z.enum(["light", "dark", "system"]);

export const settingsSchema = z.object({
  language: languageSchema,
  theme: themeSchema,
  mock_mode: z.boolean(),
  local_only_mode: z.boolean(),
  telemetry_enabled: z.boolean(),
  startup_behavior: z.enum(["dashboard", "last_view", "devices"]),
  default_device_view: z.string().min(1),
  onboarding_completed: z.boolean(),
  experimental_modules: z.boolean(),
  detailed_command_logs: z.boolean(),
  data_retention_days: z.number().int().min(0).max(3650),
  backup_folder: z.string(),
  export_folder: z.string(),
  reports_folder: z.string(),
  logs_folder: z.string(),
});

export const reportTypeSchema = z.enum([
  "basic",
  "technical",
  "pre_service",
  "backup_summary",
]);

export const generateReportSchema = z.object({
  udid: z.string().min(1),
  reportType: reportTypeSchema,
  notes: z.string().max(4000).default(""),
});

export const createBackupSchema = z.object({
  udid: z.string().min(1),
  encrypted: z.boolean().default(false),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
export type CreateBackupInput = z.infer<typeof createBackupSchema>;
