export interface MigrationEntry {
  component: string;
  breaking: boolean;
  description: string;
  autoFixable?: boolean;
  codemod?: string;
  searchPattern?: string;
  migrationGuide?: string;
  before?: string;
  after?: string;
}

export interface MigrationSet {
  /** Source major version, e.g. "5". */
  from: string;
  /** Target major version, e.g. "6". */
  to: string;
  entries: MigrationEntry[];
}
