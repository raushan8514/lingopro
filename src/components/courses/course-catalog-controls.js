"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Filter, LoaderCircle, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form-controls";

const standardLanguages = [
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Italian",
];

const difficulties = [
  ["", "All levels"],
  ["BEGINNER", "Beginner"],
  ["INTERMEDIATE", "Intermediate"],
  ["ADVANCED", "Advanced"],
];

const prices = [
  ["all", "Any price"],
  ["free", "Free"],
  ["paid", "Paid"],
];

const sortOptions = [
  ["newest", "Newest"],
  ["alphabetical", "A–Z"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
];

function FilterFields({
  filters,
  languages,
  categories,
  lockedCategory,
  onChange,
}) {
  const isLockedCategory = Boolean(lockedCategory);
  const availableLanguages = [...new Set([...standardLanguages, ...languages])]
    .sort((left, right) => left.localeCompare(right));

  return (
    <div className="market-filter-fields">
      <Select
        label="Language"
        value={filters.language}
        onChange={(event) => onChange("language", event.target.value)}
      >
        <option value="">All languages</option>
        {availableLanguages.map((language) => (
          <option value={language} key={language}>{language}</option>
        ))}
      </Select>
      <Select
        label="Level"
        value={filters.difficulty}
        onChange={(event) => onChange("difficulty", event.target.value)}
      >
        {difficulties.map(([value, label]) => (
          <option value={value} key={value || "all"}>{label}</option>
        ))}
      </Select>
      <Select
        label="Price"
        value={filters.price}
        onChange={(event) => onChange("price", event.target.value)}
      >
        {prices.map(([value, label]) => (
          <option value={value} key={value}>{label}</option>
        ))}
      </Select>
      {isLockedCategory ? (
        <div className="market-locked-category">
          <span className="ui-label">Category</span>
          <div className="market-locked-category-value">
            <Badge variant="success">{lockedCategory.name}</Badge>
          </div>
        </div>
      ) : (
        <Select
          label="Category"
          value={filters.category}
          onChange={(event) => onChange("category", event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.name} ({category.course_count})
            </option>
          ))}
        </Select>
      )}
      <Select
        label="Sort by"
        value={filters.sort}
        onChange={(event) => onChange("sort", event.target.value)}
      >
        {sortOptions.map(([value, label]) => (
          <option value={value} key={value}>{label}</option>
        ))}
      </Select>
    </div>
  );
}

export default function CourseCatalogControls({
  filters,
  languages,
  categories,
  lockedCategory = null,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchPending = query !== filters.query;

  const navigateWithParam = useCallback((name, value, { replace = false } = {}) => {
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    const suffix = params.toString();
    const href = suffix ? `${pathname}?${suffix}` : pathname;

    startTransition(() => {
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }, [pathname, query, router]);

  useEffect(() => {
    if (!searchPending) return undefined;

    const timeout = window.setTimeout(() => {
      navigateWithParam("q", query, { replace: true });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [navigateWithParam, query, searchPending]);

  function resetFilters() {
    setQuery("");
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasFilters =
    Boolean(filters.query || filters.language || filters.difficulty || filters.category) ||
    filters.price !== "all" ||
    filters.sort !== "newest";

  return (
    <>
      <div className={`market-catalog-toolbar${isPending || searchPending ? " is-pending" : ""}`}>
      <div className="market-search-field">
        <Search size={19} aria-hidden="true" />
        <Input
          id="course-search"
          type="search"
          label="Search courses"
          value={query}
          placeholder="Try “French conversation”"
          onChange={(event) => setQuery(event.target.value)}
          className="market-search-input"
        />
        {searchPending || isPending ? (
          <LoaderCircle className="market-search-spinner" size={17} aria-label="Updating courses" />
        ) : query ? (
          <button
            className="market-search-clear"
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="market-mobile-filter-trigger">
        <Button
          variant="outline"
          type="button"
          leftIcon={<Filter size={16} aria-hidden="true" />}
          onClick={() => setFilterDialogOpen(true)}
        >
          Filters
          {hasFilters && <span className="market-filter-dot" aria-label="Filters active" />}
        </Button>
      </div>

      <span className="market-search-status" aria-live="polite">
        {searchPending || isPending ? "Updating courses" : ""}
      </span>

      <Dialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        title="Refine your search"
        description="Choose the course details that matter to you."
        className="market-filter-dialog"
        footer={
          <>
            {hasFilters && (
              <Button variant="ghost" type="button" onClick={resetFilters}>
                Reset
              </Button>
            )}
            <Button type="button" onClick={() => setFilterDialogOpen(false)}>
              Show courses
            </Button>
          </>
        }
      >
        <FilterFields
          filters={filters}
          languages={languages}
          categories={categories}
          lockedCategory={lockedCategory}
          onChange={navigateWithParam}
        />
      </Dialog>
      </div>

      <aside className="market-filter-sidebar" aria-label="Course filters">
        <div className="market-desktop-filter-fields">
        <FilterFields
          filters={filters}
          languages={languages}
          categories={categories}
          lockedCategory={lockedCategory}
          onChange={navigateWithParam}
        />
        </div>

        {hasFilters && (
          <Button
            className="market-reset-filters"
            variant="ghost"
            size="sm"
            type="button"
            onClick={resetFilters}
          >
            Reset filters
          </Button>
        )}
      </aside>
    </>
  );
}
