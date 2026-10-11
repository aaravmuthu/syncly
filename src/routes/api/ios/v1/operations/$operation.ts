import { createFileRoute } from "@tanstack/react-router";
import { nativeOperation, nativeOperationNames } from "@/lib/ios/operations.server";
import { handleNativeOperation } from "@/lib/ios/transport.server";

export const Route = createFileRoute("/api/ios/v1/operations/$operation")({
  server: {
    handlers: {
      ANY: ({ request, params }) => handleNativeOperation(request, params.operation, nativeOperationNames, async (name, data, headers) => {
        const fn = nativeOperation(name);
        if (!fn) throw new Error("Unknown native operation");
        // The compiled public server function runs its original input validator,
        // JWT/MFA middleware and business handler in this request context.
        return fn({ data: data as never, headers });
      }),
    },
  },
});
