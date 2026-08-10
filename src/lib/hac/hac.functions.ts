import { createServerFn } from "@tanstack/react-start";
import { syncHacHandler } from "./hac-sync.server";

export const syncHac = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => syncHacHandler(data));