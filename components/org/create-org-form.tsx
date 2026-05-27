"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    router.push(`/org/${data.org.slug}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="org-name" className="text-sm font-medium">
          Workspace name
        </label>
        <input
          id="org-name"
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My Coaching Business"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="org-slug" className="text-sm font-medium">
          URL slug
        </label>
        <div className="flex items-center rounded-md border overflow-hidden focus-within:ring-2 focus-within:ring-ring">
          <span className="bg-muted px-3 py-2 text-sm text-muted-foreground border-r select-none">
            coachos.app/org/
          </span>
          <input
            id="org-slug"
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="my-coaching-biz"
            pattern="[a-z0-9-]+"
            className="flex-1 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name || !slug}
        className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? "Creating..." : "Create workspace"}
      </button>
    </form>
  );
}
