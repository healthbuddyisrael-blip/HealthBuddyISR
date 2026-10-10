import { Pagination } from "@/components/shared/pagination";
import Link from "next/link";
import Form from "next/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalyticsRange } from "@/lib/admin/model";
import { NavigationPending } from "@/components/shared/navigation-pending";

export function analyticsHref(
  path: string,
  range: AnalyticsRange,
  page = 1,
  search = "",
  week?: string,
) {
  const params = new URLSearchParams({ range: String(range) });
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);
  if (week) params.set("week", week);
  return `${path}?${params}`;
}
export function RangeControls({
  path,
  range,
  search = "",
  week,
}: {
  path: string;
  range: AnalyticsRange;
  search?: string;
  week?: string;
}) {
  return (
    <nav aria-label="טווח נתונים" className="flex gap-2">
      {([7, 30] as const).map((value) => (
        <Button
          key={value}
          asChild
          variant={range === value ? "default" : "outline"}
        >
          <Link
            href={analyticsHref(path, value, 1, search, week)}
            aria-current={range === value ? "page" : undefined}
          >
            {value} ימים
            <NavigationPending />
          </Link>
        </Button>
      ))}
    </nav>
  );
}
export function AnalyticsSearch({
  path,
  range,
  search,
  label,
}: {
  path: string;
  range: AnalyticsRange;
  search: string;
  label: string;
}) {
  return (
    <Form
      key={`${path}:${search}`}
      action={path}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="range" value={range} />
      <div className="min-w-40 flex-1">
        <label
          htmlFor="analytics-search"
          className="mb-2 block text-sm font-semibold"
        >
          {label}
        </label>
        <Input
          id="analytics-search"
          type="search"
          name="q"
          defaultValue={search}
          maxLength={200}
        />
      </div>
      <Button type="submit" variant="outline">
        חיפוש
      </Button>
    </Form>
  );
}
export function AnalyticsPagination({
  path,
  range,
  search,
  page,
  total,
}: {
  path: string;
  range: AnalyticsRange;
  search: string;
  page: number;
  total: number;
}) {
  return (
    <Pagination
      previous={
        page > 1 ? analyticsHref(path, range, page - 1, search) : undefined
      }
      next={
        total > page * 25
          ? analyticsHref(path, range, page + 1, search)
          : undefined
      }
    />
  );
}
