import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const COURSE_STATUSES = ['Draft', 'Published', 'Review', 'Archived', 'Template'] as const;
export const COURSE_VISIBILITIES = ['Public', 'Private', 'Unlisted'] as const;
export const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'] as const;
export const CORE_LEARNING_SECTIONS = ['Grammar', 'Vocabulary', 'Writing', 'Reading', 'Speaking'] as const;

export type CourseStatus = typeof COURSE_STATUSES[number];
export type CourseVisibility = typeof COURSE_VISIBILITIES[number];
export type CourseLevel = typeof COURSE_LEVELS[number];
export type CoreLearningSection = typeof CORE_LEARNING_SECTIONS[number];

export type CourseModuleSummary = {
  moduleId: Types.ObjectId;
  title: string;
  slug: string;
  order: number;
  lessonCount: number;
  estimatedDurationMinutes: number;
  status: CourseStatus;
};

export interface ICourse extends Document {
  slug: string;
  title: string;
  description: string;
  summary: string;
  coreSection: CoreLearningSection;
  category: string;
  status: CourseStatus;
  level: CourseLevel;
  language: string;
  instructor: string;
  visibility: CourseVisibility;
  tags: string[];
  objectives: string[];
  prerequisites: string[];
  moduleSummaries: CourseModuleSummary[];
  modulesCount: number;
  lessonsCount: number;
  enrolledCount: number;
  completionRate: number;
  rating: number;
  durationMinutes: number;
  featuredImageUrl?: string;
  thumbnailUrl?: string;
  seoKeywords: string[];
  isFeatured: boolean;
  publishedAt?: Date;
  archivedAt?: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const moduleSummarySchema = new Schema<CourseModuleSummary>(
  {
    moduleId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'CourseModule',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    lessonCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    estimatedDurationMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: COURSE_STATUSES,
      required: true,
      default: 'Draft',
    },
  },
  { _id: false },
);

const courseSchema = new Schema<ICourse>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    coreSection: {
      type: String,
      enum: CORE_LEARNING_SECTIONS,
      required: true,
      default: 'Grammar',
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: COURSE_STATUSES,
      required: true,
      default: 'Draft',
      index: true,
    },
    level: {
      type: String,
      enum: COURSE_LEVELS,
      required: true,
      default: 'Beginner',
      index: true,
    },
    language: {
      type: String,
      required: true,
      trim: true,
      default: 'English',
    },
    instructor: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    visibility: {
      type: String,
      enum: COURSE_VISIBILITIES,
      required: true,
      default: 'Public',
      index: true,
    },
    tags: {
      type: [String],
      index: true,
      default: [],
    },
    objectives: {
      type: [String],
      default: [],
    },
    prerequisites: {
      type: [String],
      default: [],
    },
    moduleSummaries: {
      type: [moduleSummarySchema],
      default: [],
    },
    modulesCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lessonsCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    enrolledCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    completionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
      default: 0,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    featuredImageUrl: {
      type: String,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    seoKeywords: {
      type: [String],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    createdBy: {
      type: Types.ObjectId,
      index: true,
    },
    updatedBy: {
      type: Types.ObjectId,
      index: true,
    },
  },
  { timestamps: true },
);

courseSchema.index({ slug: 1 }, { unique: true });
courseSchema.index({ coreSection: 1, status: 1, category: 1, level: 1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ updatedAt: -1 });
courseSchema.index(
  {
    title: 'text',
    description: 'text',
    summary: 'text',
    tags: 'text',
    seoKeywords: 'text',
  },
  {
    weights: {
      title: 5,
      tags: 3,
      description: 2,
      summary: 1,
      seoKeywords: 1,
    },
    name: 'CourseTextSearchIndex',
  },
);

// Prevent overwrite model error in watch mode
export const Course: Model<ICourse> = mongoose.models.Course || mongoose.model<ICourse>('Course', courseSchema);
