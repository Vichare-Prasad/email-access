const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");

const statements = sqliteTable("statements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull(),
  accountNumber: text("account_number"),
  customerName: text("customer_name"),
  ifscCode: text("ifsc_code"),
  bankName: text("bank_name"),
  filePath: text("file_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

module.exports = { statements };
