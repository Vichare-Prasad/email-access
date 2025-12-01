const { sqliteTable, text, integer, real } = require("drizzle-orm/sqlite-core");

const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  statementId: text("statement_id").notNull(),
  date: integer("date", { mode: "timestamp" }),
  description: text("description"),
  amount: real("amount"),
  category: text("category"),
  type: text("type"), // 'credit' or 'debit'
  balance: real("balance"),
  entity: text("entity"),
});

module.exports = { transactions };
