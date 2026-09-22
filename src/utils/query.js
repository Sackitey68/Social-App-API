/**
 * Parse pagination params from a request query.
 * Defaults: page=1, limit=20 (requirement #22), max limit 100.
 */
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build a sort object from a query param.
 * Accepts comma-separated fields with optional "-" prefix for desc.
 * Whitelist: only allow fields we control (prevents injection & surprises).
 */
const buildSort = (sortParam, allowed, fallback = '-timestamp') => {
  if (!sortParam) {
    return parseSortString(fallback, allowed);
  }
  return parseSortString(sortParam, allowed);
};

const parseSortString = (str, allowed) => {
  const sort = {};
  str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((field) => {
      const desc = field.startsWith('-');
      const key = desc ? field.slice(1) : field;
      if (allowed.includes(key)) {
        sort[key] = desc ? -1 : 1;
      }
    });
    
  // If nothing valid was provided, fall back to newest first
  return Object.keys(sort).length ? sort : { timestamp: -1 };
};

module.exports = { getPagination, buildSort };