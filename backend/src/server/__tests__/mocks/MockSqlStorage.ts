/**
 * MockSqlStorage - Realistic DO SQL simulation for testing
 *
 * Simulates Cloudflare Durable Object SQL behavior:
 * - CREATE TABLE
 * - INSERT INTO
 * - UPDATE
 * - SELECT
 * - Proper parameter binding
 * - Return value simulation
 */

export class MockSqlStorage implements SqlStorage {
  private tables: Map<string, Array<Record<string, any>>> = new Map();
  private schemas: Map<string, string> = new Map();

  exec(query: string, ...params: any[]): { toArray(): any[] } {
    const trimmedQuery = query.trim().toLowerCase();

    // CREATE TABLE
    if (trimmedQuery.startsWith('create table')) {
      return this.handleCreateTable(query);
    }

    // INSERT INTO
    if (trimmedQuery.startsWith('insert into')) {
      return this.handleInsert(query, params);
    }

    // UPDATE
    if (trimmedQuery.startsWith('update')) {
      return this.handleUpdate(query, params);
    }

    // SELECT
    if (trimmedQuery.startsWith('select')) {
      return this.handleSelect(query, params);
    }

    // CREATE INDEX (ignore)
    if (trimmedQuery.startsWith('create index')) {
      return { toArray: () => [] };
    }

    // Default: return empty
    return { toArray: () => [] };
  }

  private handleCreateTable(query: string): { toArray(): any[] } {
    // Extract table name
    const match = query.match(/create table if not exists (\w+)/i);
    if (match) {
      const tableName = match[1];
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
        this.schemas.set(tableName, query);
      }
    }
    return { toArray: () => [] };
  }

  private handleInsert(query: string, params: any[]): { toArray(): any[] } {
    // Extract table name
    const match = query.match(/insert into (\w+)/i);
    if (!match) return { toArray: () => [] };

    const tableName = match[1];
    const table = this.tables.get(tableName) || [];

    // Extract column names
    const columnsMatch = query.match(/\(([^)]+)\)/);
    if (!columnsMatch) return { toArray: () => [] };

    const columns = columnsMatch[1].split(',').map(c => c.trim());

    // Build row object
    const row: Record<string, any> = {};
    columns.forEach((col, index) => {
      if (params[index] !== undefined) {
        row[col] = params[index];
      } else {
        // Set defaults based on column name
        if (col.includes('timestamp') || col.includes('_at')) {
          row[col] = Date.now();
        } else if (col === 'id' && !params[index]) {
          row[col] = this.generateId();
        } else {
          row[col] = null;
        }
      }
    });

    table.push(row);
    this.tables.set(tableName, table);

    return { toArray: () => [] };
  }

  private handleUpdate(query: string, params: any[]): { toArray(): any[] } {
    // Extract table name
    const match = query.match(/update (\w+)/i);
    if (!match) return { toArray: () => [] };

    const tableName = match[1];
    const table = this.tables.get(tableName);
    if (!table) return { toArray: () => [] };

    // Extract SET clause
    const setMatch = query.match(/set\s+(.+?)(?:\s+where|$)/is);
    if (!setMatch) return { toArray: () => [] };

    const setClause = setMatch[1];
    const assignments = setClause.split(',').map(a => a.trim());

    // Extract WHERE clause
    const whereMatch = query.match(/where\s+(.+?)$/is);
    let whereCondition: string | null = null;
    if (whereMatch) {
      whereCondition = whereMatch[1].trim();
    }

    // Parse assignments
    const updates: Record<string, any> = {};
    let paramIndex = 0;

    assignments.forEach(assignment => {
      const [col, _value] = assignment.split('=').map(s => s.trim());
      if (_value === '?') {
        updates[col] = params[paramIndex++];
      } else if (_value.includes('+') || _value.includes('-')) {
        // Handle expressions like "count + 1"
        const exprMatch = _value.match(/(\w+)\s*([+-])\s*(\d+)/);
        if (exprMatch) {
          const [, field, op, num] = exprMatch;
          // Will be applied per row
          updates[col] = { expr: field, op, num: parseInt(num) };
        }
      } else {
        updates[col] = _value.replace(/'/g, '');
      }
    });

    // Apply updates
    table.forEach(row => {
      // Check WHERE condition
      if (whereCondition) {
        if (!this.evaluateWhere(row, whereCondition, params.slice(paramIndex))) {
          return;
        }
      }

      // Apply updates
      Object.entries(updates).forEach(([col, value]) => {
        if (value && typeof value === 'object' && value.expr) {
          // Handle expressions
          const currentValue = row[value.expr] || 0;
          row[col] = value.op === '+'
            ? currentValue + value.num
            : currentValue - value.num;
        } else {
          row[col] = value;
        }
      });

      // Update timestamp fields
      if ('updated_at' in row) {
        row.updated_at = Math.floor(Date.now() / 1000);
      }
    });

    return { toArray: () => [] };
  }

  private handleSelect(query: string, params: any[]): { toArray(): any[] } {
    // Extract table name
    const match = query.match(/from (\w+)/i);
    if (!match) return { toArray: () => [] };

    const tableName = match[1];
    let table = this.tables.get(tableName);
    if (!table) return { toArray: () => [] };

    // Clone to avoid mutations
    let results = table.map(row => ({ ...row }));

    // Extract WHERE clause
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order|\s+limit|$)/is);
    if (whereMatch) {
      const whereCondition = whereMatch[1].trim();
      results = results.filter(row =>
        this.evaluateWhere(row, whereCondition, params)
      );
    }

    // Extract ORDER BY
    const orderMatch = query.match(/order by\s+(.+?)(?:\s+limit|$)/is);
    if (orderMatch) {
      const orderClause = orderMatch[1].trim();
      const [col, dir] = orderClause.split(/\s+/);
      const direction = dir?.toLowerCase() === 'desc' ? -1 : 1;

      results.sort((a, b) => {
        if (a[col] < b[col]) return -1 * direction;
        if (a[col] > b[col]) return 1 * direction;
        return 0;
      });
    }

    // Extract LIMIT
    const limitMatch = query.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      results = results.slice(0, limit);
    }

    return { toArray: () => results };
  }

  private evaluateWhere(
    row: Record<string, any>,
    condition: string,
    params: any[]
  ): boolean {
    // Simple WHERE evaluation
    // Supports: col = ?, col = 'value', col > ?, etc.

    let paramIndex = 0;
    let conditionStr = condition;

    // Replace ? with actual values
    conditionStr = conditionStr.replace(/\?/g, () => {
      const value = params[paramIndex++];
      return typeof value === 'string' ? `'${value}'` : String(value);
    });

    // Replace column names with values
    Object.entries(row).forEach(([col, value]) => {
      const regex = new RegExp(`\\b${col}\\b`, 'g');
      const replacement = typeof value === 'string'
        ? `'${value}'`
        : value === null
        ? 'null'
        : String(value);
      conditionStr = conditionStr.replace(regex, replacement);
    });

    try {
      // Simple evaluation (unsafe but OK for tests)
      return eval(conditionStr.replace(/=/g, '==='));
    } catch {
      return true; // Default to including row on error
    }
  }

  private generateId(): string {
    return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Helper: Get table data for inspection
   */
  getTable(tableName: string): any[] {
    return this.tables.get(tableName) || [];
  }

  /**
   * Helper: Clear all tables
   */
  clear(): void {
    this.tables.clear();
    this.schemas.clear();
  }

  /**
   * Helper: Reset specific table
   */
  clearTable(tableName: string): void {
    this.tables.delete(tableName);
  }
}
