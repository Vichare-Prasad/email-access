const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");

const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

module.exports = { cases };
