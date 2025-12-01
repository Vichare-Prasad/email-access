const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");

const failedStatements = sqliteTable("failed_statements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull(),
  data: text("data"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

module.exports = { failedStatements };
