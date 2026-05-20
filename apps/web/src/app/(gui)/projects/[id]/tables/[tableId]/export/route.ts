import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { loadTablePageDataForUser } from "../actions";
import { createTableCsvStream, tableCsvHeaders } from "./csv";

export const runtime = "nodejs";

export const GET = async (
  _request: Request,
  props: {
    params: Promise<{
      tableId: string;
    }>;
  },
) => {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const { tableId } = await props.params;
  const data = await loadTablePageDataForUser(user.id, tableId).catch(
    () => null,
  );

  if (!data) {
    return new Response("Not Found", {
      status: 404,
    });
  }

  return new Response(
    Readable.toWeb(createTableCsvStream(data)) as ReadableStream,
    {
      headers: tableCsvHeaders(data.table.name),
    },
  );
};
