import { relations } from "drizzle-orm/relations";
import { books, outlines, userSettings, inspirations } from "./schema";

export const booksRelations = relations(books, ({ many }) => ({
  outlines: many(outlines),
  userSettings: many(userSettings),
  inspirations: many(inspirations),
}));

export const outlinesRelations = relations(outlines, ({ one }) => ({
  book: one(books, {
    fields: [outlines.bookId],
    references: [books.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  book: one(books, {
    fields: [userSettings.bookId],
    references: [books.id],
  }),
}));

export const inspirationsRelations = relations(inspirations, ({ one }) => ({
  book: one(books, {
    fields: [inspirations.bookId],
    references: [books.id],
  }),
}));