export interface DatabaseMigration {
  version: number;
  description: string;
  isBreaking: boolean;
  sql: string;
}
