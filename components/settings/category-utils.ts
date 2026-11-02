import { ApiError } from "@/lib/api/client";
import type { Category, CategoryTemplate } from "@/lib/api/types";

/** Deepest level: section › category › sub-category. */
export const MAX_LEVEL = 2;

export const LEVEL_LABEL = ["قسم رئيسي", "تصنيف", "تصنيف فرعي"] as const;

/** Categories API errors the admin can act on, in their words. */
const CATEGORY_ERRORS: Record<string, string> = {
  INVALID_PARENT: "مينفعش تنقل التصنيف تحت نفسه أو تحت تصنيف من اللي تحته.",
  TOO_DEEP: "الشجرة 3 مستويات بس (قسم › تصنيف › فرعي). اختار أب أعلى، أو انقل التصنيفات الفرعية الأول.",
  INVALID_TEMPLATE: "في مشكلة في قالب المنتج: كل مواصفة لازم يكون ليها مفتاح مختلف، والاختيار من قائمة محتاج اختيار واحد على الأقل.",
  HAS_CHILDREN: "التصنيف ده تحته تصنيفات فرعية. احذفها أو انقلها الأول.",
  DUPLICATE: "الرابط (slug) ده مستخدم لتصنيف تاني.",
  INVALID_CATEGORY: "التصنيف الأب مش موجود أو مخفي. فعّله الأول أو اختار أب تاني.",
};

/** Rethrows a categories API error with an Arabic message, so the usual error toast reads well. */
export function localizeCategoryError(e: unknown): never {
  if (e instanceof ApiError && CATEGORY_ERRORS[e.code]) throw new ApiError(e.status, e.code, CATEGORY_ERRORS[e.code], e.details);
  throw e;
}

/** Folds Arabic letter variants so "اكسسوارات" finds "إكسسوارات". */
export function normalizeSearch(s: string) {
  return s
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْـ]/g, "")
    .trim();
}

/** Children of each category id ("" = top level), in display order. */
export function childrenMap(cats: Category[]) {
  const ids = new Set(cats.map((c) => c._id));
  const map = new Map<string, Category[]>();
  for (const c of cats) {
    // A parent that is filtered out (or deleted) leaves its child at the top so nothing disappears.
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : "";
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
  return map;
}

/** "ملابس › رجالي" — the category's path from the top. */
export function pathName(c: Category, byId: Map<string, Category>) {
  return [...c.ancestors.map((id) => byId.get(id)?.nameAr ?? "…"), c.nameAr].join(" › ");
}

/** The top-level section a category belongs to (itself when top level). */
export function rootOf(c: Category, byId: Map<string, Category>) {
  return c.ancestors.length ? byId.get(c.ancestors[0]) ?? c : c;
}

/** Levels below a category (0 when it has none). */
export function subtreeDepth(id: string, cats: Category[]) {
  let depth = 0;
  for (const c of cats) {
    const at = c.ancestors.indexOf(id);
    if (at >= 0) depth = Math.max(depth, c.ancestors.length - at);
  }
  return depth;
}

function count(n: number, one: string, two: string, few: string, many: string) {
  return n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
}

/** Short summary of what a category's own template changes: "مقاس + 3 مواصفات". Null = nothing (inherits). */
export function templateSummary(t: CategoryTemplate | null | undefined) {
  if (!t) return null;
  const parts: string[] = [];
  if (t.size === null) parts.push("بدون مقاس");
  else if (t.size) parts.push(t.size.label);
  if (t.color === null) parts.push("بدون لون");
  else if (t.color) parts.push(t.color.label);
  if (t.specs?.length) parts.push(count(t.specs.length, "مواصفة", "مواصفتين", "مواصفات", "مواصفة"));
  if (t.units?.length) parts.push("وحدات بيع");
  if (t.sizeGuide) parts.push("دليل مقاسات");
  return parts.length ? parts.join(" + ") : null;
}
