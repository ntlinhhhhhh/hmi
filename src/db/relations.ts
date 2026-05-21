// File: src/db/relations.ts
import { relations } from "drizzle-orm/relations";
import {
  users,
  passwordResetCodes,
  childProfiles,
  preferences,
  emotionLogs,
  contents,
  lectures,
  quizzes,
  game,
  unlockContent,
  contentSessions,
  pets,
  childPets,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  childProfiles: many(childProfiles),
  contents: many(contents),
  passwordResetCodes: many(passwordResetCodes),
}));

export const passwordResetCodesRelations = relations(passwordResetCodes, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetCodes.userId],
    references: [users.id],
  }),
}));

export const childProfilesRelations = relations(childProfiles, ({ one, many }) => ({
  parent: one(users, {
    fields: [childProfiles.parentId],
    references: [users.id],
  }),
  preferences: one(preferences, {
    fields: [childProfiles.id],
    references: [preferences.childId],
  }),
  emotionLogs: many(emotionLogs),
  unlockContents: many(unlockContent),
  contentSessions: many(contentSessions),
  childPets: many(childPets),
}));

export const preferencesRelations = relations(preferences, ({ one }) => ({
  childProfile: one(childProfiles, {
    fields: [preferences.childId],
    references: [childProfiles.id],
  }),
}));

export const emotionLogsRelations = relations(emotionLogs, ({ one }) => ({
  childProfile: one(childProfiles, {
    fields: [emotionLogs.childId],
    references: [childProfiles.id],
  }),
}));

export const contentsRelations = relations(contents, ({ one, many }) => ({
  creator: one(users, {
    fields: [contents.createdBy],
    references: [users.id],
  }),
  lecture: one(lectures, {
    fields: [contents.id],
    references: [lectures.id],
  }),
  quiz: one(quizzes, {
    fields: [contents.id],
    references: [quizzes.id],
  }),
  game: one(game, {
    fields: [contents.id],
    references: [game.id],
  }),
  unlockContents: many(unlockContent),
}));

export const lecturesRelations = relations(lectures, ({ one }) => ({
  content: one(contents, {
    fields: [lectures.id],
    references: [contents.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one }) => ({
  content: one(contents, {
    fields: [quizzes.id],
    references: [contents.id],
  }),
}));

export const gameRelations = relations(game, ({ one }) => ({
  content: one(contents, {
    fields: [game.id],
    references: [contents.id],
  }),
}));

export const unlockContentRelations = relations(unlockContent, ({ one, many }) => ({
  childProfile: one(childProfiles, {
    fields: [unlockContent.childId],
    references: [childProfiles.id],
  }),
  content: one(contents, {
    fields: [unlockContent.contentId],
    references: [contents.id],
  }),
  contentSessions: many(contentSessions),
}));

export const contentSessionsRelations = relations(contentSessions, ({ one }) => ({
  childProfile: one(childProfiles, {
    fields: [contentSessions.childId],
    references: [childProfiles.id],
  }),
  unlockContent: one(unlockContent, {
    fields: [contentSessions.unlockContentId],
    references: [unlockContent.id],
  }),
}));

export const petsRelations = relations(pets, ({ many }) => ({
  childPets: many(childPets),
}));

export const childPetsRelations = relations(childPets, ({ one }) => ({
  childProfile: one(childProfiles, {
    fields: [childPets.childId],
    references: [childProfiles.id],
  }),
  pet: one(pets, {
    fields: [childPets.petId],
    references: [pets.id],
  }),
}));