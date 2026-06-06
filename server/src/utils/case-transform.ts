/**
 * Convert snake_case object keys to camelCase recursively.
 * Useful for transforming Supabase/Postgres responses to frontend-friendly format.
 */
export function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      result[camelKey] = toCamelCase(value);
    }
    return result;
  }
  return obj;
}

/**
 * Convert camelCase object keys to snake_case recursively.
 * Useful for transforming frontend data to Supabase-friendly format.
 */
export function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(value);
    }
    return result;
  }
  return obj;
}
/**
 * 仅转换对象的顶层键为 snake_case，不递归转换嵌套对象
 * 用于数据库更新操作，避免 JSONB 字段内部结构被意外转换
 */
export function toSnakeCaseTopLevel(obj: Record<string, any>): Record<string, any> {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    result[snakeKey] = value; // 注意：value 保持不变，不递归转换
  }
  return result;
}
