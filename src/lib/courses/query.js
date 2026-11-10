const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const difficultyValues = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const priceValues = new Set(["all", "free", "paid"]);
const sortValues = new Set(["newest", "alphabetical", "price-asc", "price-desc"]);

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCourseFilters(params = {}) {
  const query = String(firstValue(params.q) || "").trim().slice(0, 100);
  const language = String(firstValue(params.language) || "").trim().slice(0, 80);
  const rawDifficulty = String(firstValue(params.difficulty) || "").toUpperCase();
  const rawPrice = String(firstValue(params.price) || "all");
  const rawSort = String(firstValue(params.sort) || "newest");
  const rawCategory = String(firstValue(params.category) || "");
  const rawPage = Number.parseInt(firstValue(params.page), 10);

  return {
    query,
    language: language || "",
    difficulty: difficultyValues.has(rawDifficulty) ? rawDifficulty : "",
    price: priceValues.has(rawPrice) ? rawPrice : "all",
    sort: sortValues.has(rawSort) ? rawSort : "newest",
    category: uuidPattern.test(rawCategory) ? rawCategory : "",
    categoryId: uuidPattern.test(rawCategory) ? rawCategory : null,
    page: Number.isInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, 834)
      : 1,
  };
}

export function createCoursePageHref(pathname, filters, page) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.language) params.set("language", filters.language);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.price !== "all") params.set("price", filters.price);
  if (filters.category) params.set("category", filters.category);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}
