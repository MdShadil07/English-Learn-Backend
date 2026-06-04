import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { COURSE_STATUSES } from './Course.js';

export const LESSON_TYPES = ['Video', 'Article', 'Audio', 'Quiz', 'Assignment', 'Interactive'] as const;

export type LessonType = typeof LESSON_TYPES[number];

export interface LessonResource {
  label: string;
  url: string;
  type: string;
  sectionId?: string;
}

export interface LessonProgress {
  viewCount: number;
  completionCount: number;
  averageScore: number;
}

export interface LessonContentBlock {
  id?: string;
  type: string;
  title?: string;
  text?: string;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
  children?: LessonContentBlock[];
}

export interface ILesson extends Document {
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  contentType: LessonType;
  contentBlocks: LessonContentBlock[];
  order: number;
  durationMinutes: number;
  isPublished: boolean;
  status: typeof COURSE_STATUSES[number];
  visibility: 'Public' | 'Private' | 'Unlisted';
  difficultyLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  coverImage?: string;
  resources: LessonResource[];
  progress: LessonProgress;
  releasedAt?: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  contentBlocksLastUpdated?: Date;
}

const resourceSchema = new Schema<LessonResource>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    sectionId: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const progressSchema = new Schema<LessonProgress>(
  {
    viewCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    completionCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    averageScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: false },
);

const contentBlockSchema = new Schema<LessonContentBlock>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    text: {
      type: String,
      trim: true,
    },
    mediaUrl: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

contentBlockSchema.add({
  id: { type: String, trim: true },
  children: { type: [contentBlockSchema], default: [] }
});

const lessonSchema = new Schema<ILesson>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'CourseModule',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    contentType: {
      type: String,
      enum: LESSON_TYPES,
      required: true,
      default: 'Article',
    },
    contentBlocks: {
      type: [contentBlockSchema],
      default: [],
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: COURSE_STATUSES,
      required: true,
      default: 'Draft',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['Public', 'Private', 'Unlisted'],
      required: true,
      default: 'Public',
      index: true,
    },
    difficultyLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
      default: 'Intermediate',
    },
    coverImage: {
      type: String,
      trim: true,
    },
    resources: {
      type: [resourceSchema],
      default: [],
    },
    progress: {
      type: progressSchema,
      default: () => ({ viewCount: 0, completionCount: 0, averageScore: 0 }),
    },
    releasedAt: {
      type: Date,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: 'AdminUser',
      index: true,
    },
    updatedBy: {
      type: Types.ObjectId,
      ref: 'AdminUser',
      index: true,
    },
  },
  { timestamps: true },
);

lessonSchema.index({ courseId: 1, moduleId: 1, order: 1 }, { unique: true });
lessonSchema.index({ moduleId: 1, slug: 1 }, { unique: true });
lessonSchema.index({ courseId: 1, title: 'text', description: 'text' });

export const Lesson: Model<ILesson> = mongoose.model<ILesson>('Lesson', lessonSchema);
