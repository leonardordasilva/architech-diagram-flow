export const DATABASE_COLORS: Record<string, string> = {
  Oracle: '#FBD982',
  Redis: '#DC382C',
  PostgreSQL: '#336791',
  MySQL: '#4479A1',
  'SQL Server': '#CC2927',
  MongoDB: '#47A248',
  DynamoDB: '#4053D6',
  Cassandra: '#1287B1',
  Elasticsearch: '#FEC514',
  MariaDB: '#003545',
  Memcached: '#6DB33F',
  Firebase: '#FFCA28',
  CockroachDB: '#6933FF',
};

export const DATABASE_TYPES = Object.keys(DATABASE_COLORS);

export const DEFAULT_DB_COLOR = 'hsl(142, 71%, 45%)';

export function getDbColor(subType?: string): string {
  if (!subType) return DEFAULT_DB_COLOR;
  return DATABASE_COLORS[subType] ?? DEFAULT_DB_COLOR;
}
