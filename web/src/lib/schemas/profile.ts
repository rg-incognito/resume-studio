import { z } from "zod";

// Plain-text resumes almost always write links as bare domains
// ("linkedin.com/in/x", "github.com/x") rather than full URLs — normalize by
// adding a scheme before validating, instead of rejecting them outright.
function normalizeUrl(val: unknown): unknown {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const requiredUrl = z.preprocess(normalizeUrl, z.string().url());
const optionalUrl = z.preprocess(normalizeUrl, z.string().url().optional().or(z.literal("")));

export const profileLinkSchema = z.object({
  label: z.string().min(1).max(60),
  url: requiredUrl,
});

export const personalInfoSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().default(""),
  location: z.string().max(120).optional().default(""),
  linkedin: optionalUrl,
  links: z.array(profileLinkSchema).default([]),
});

export const workExperienceItemSchema = z.object({
  company: z.string().min(1).max(160),
  role: z.string().min(1).max(160),
  location: z.string().max(160).optional().default(""),
  startDate: z.string().max(40),
  endDate: z.string().max(40),
  bullets: z.array(z.string().min(1)).default([]),
});

export const educationItemSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  location: z.string().max(160).optional().default(""),
  startDate: z.string().max(40),
  endDate: z.string().max(40),
});

export const skillGroupSchema = z.object({
  label: z.string().min(1).max(120),
  items: z.array(z.string().min(1)).default([]),
});

export const projectItemSchema = z.object({
  name: z.string().min(1).max(160),
  stack: z.string().max(200).optional().default(""),
  startDate: z.string().max(40).optional().default(""),
  endDate: z.string().max(40).optional().default(""),
  bullets: z.array(z.string().min(1)).default([]),
});

export const certificationItemSchema = z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().max(160).optional().default(""),
  date: z.string().max(40).optional().default(""),
});

export const profileSchema = z.object({
  personalInfo: personalInfoSchema,
  workExperience: z.array(workExperienceItemSchema).default([]),
  education: z.array(educationItemSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  projects: z.array(projectItemSchema).default([]),
  certifications: z.array(certificationItemSchema).default([]),
  achievements: z.array(z.string().min(1)).default([]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
