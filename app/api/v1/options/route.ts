import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from 'next/cache';

/**
 * Generic endpoint for fetching options from database tables
 * Query params:
 * - table: table name (required)
 * - valueColumn: column name for value (default: "id")
 * - labelColumn: column name for label (default: "name")
 * - searchColumn: column name for search (default: same as labelColumn)
 * - search: search query (optional)
 * - filters: JSON stringified filters object (optional)
 */
export async function GET(req: NextRequest) {
  noStore();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const table = searchParams.get("table");
    const valueColumn = searchParams.get("valueColumn") || "id";
    const labelColumn = searchParams.get("labelColumn") || "name";
    const searchColumn = searchParams.get("searchColumn") || labelColumn;
    const search = searchParams.get("search");
    const filtersParam = searchParams.get("filters");

    if (!table) {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 },
      );
    }

    let query = supabase.from(table).select(`${valueColumn}, ${labelColumn}`);

    // Apply filters if provided
    if (filtersParam) {
      try {
        const filters = JSON.parse(filtersParam);
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });
      } catch (e) {
        console.warn("Failed to parse filters:", e);
      }
    }

    // Apply search if provided
    if (search && search.trim().length > 0) {
      query = query.ilike(searchColumn, `%${search.trim()}%`);
    }

    // Limit results
    query = query.limit(100);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching options:", error);
      return NextResponse.json(
        { error: "Failed to fetch options", details: error.message },
        { status: 500 },
      );
    }

    // Transform to options format
    const options =
      data?.map((row: any) => ({
        value: String(row[valueColumn] || ""),
        label: String(row[labelColumn] || ""),
      })) || [];

    return NextResponse.json({ options });
  } catch (error) {
    console.error("Error in options endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
