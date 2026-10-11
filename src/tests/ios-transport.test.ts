import { describe, it, expect, vi } from "vitest";
import { handleNativeOperation, nativeError, nativeResponse } from "../lib/ios/transport.server";
import { z } from "zod";
const req = (body: string, auth = "Bearer fixture", method = "POST") => new Request("https://example.test/api/ios/v1/operations/test", { method, headers: { "Content-Type": "application/json", Authorization: auth }, ...(method === "POST" ? { body } : {}) });
describe("native transport", () => {
  it("rejects an unlisted operation without invoking code", async () => { const fn = vi.fn(); expect((await handleNativeOperation(req("{}"), "__proto__", ["test"], fn)).status).toBe(404); expect(fn).not.toHaveBeenCalled(); });
  it.each(["", "Basic abc", "Bearer ", "Bearer a b"])("requires an explicit native bearer %s", async auth => { const fn = vi.fn(); expect((await handleNativeOperation(req("{}",auth), "test", ["test"], fn)).status).toBe(401); expect(fn).not.toHaveBeenCalled(); });
  it.each(["[]","null","5","{broken"])("rejects invalid object input %s", async body => { expect((await handleNativeOperation(req(body),"test",["test"],vi.fn())).status).toBe(422); });
  it("preserves exact input and request authorization for the validated handler", async () => { const fn = vi.fn(async (_name,data,headers) => { expect(headers.get("authorization")).toBe("Bearer fixture"); expect(data).toEqual({ code:"ABCD" }); return { status:"pending" }; }); const response = await handleNativeOperation(req('{"code":"ABCD"}'),"test",["test"],fn); expect(await response.json()).toEqual({data:{status:"pending"}}); expect(response.headers.get("cache-control")).toBe("no-store"); });
  it("does not expose database/provider details", async () => { const response = nativeError(new Error("SQL password=private peer maxSpend=5")); expect(JSON.stringify(await response.json())).not.toContain("private"); });
  it("returns field errors without invalid values", async () => { let error; try { z.object({code:z.string().min(3)}).parse({code:"x"}); } catch(e) {error=e;} const response = nativeError(error); expect(response.status).toBe(422); expect((await response.json()).error.field).toBe("code"); });
  it("does not silently serialize nonfinite numbers", () => { expect(() => nativeResponse({data:Infinity})).toThrow(); });
  it.each(["application/jsonblah", "text/plain", ""])('rejects incorrect media type %s', async contentType => {
    const request = new Request("https://example.test", {method:"POST",headers:{Authorization:"Bearer fixture","Content-Type":contentType},body:"{}"});
    const fn = vi.fn(); expect((await handleNativeOperation(request,"test",["test"],fn)).status).toBe(422); expect(fn).not.toHaveBeenCalled();
  });
  it("enforces the body limit even without Content-Length", async () => {
    const request = new Request("https://example.test", {method:"POST",headers:{Authorization:"Bearer fixture","Content-Type":"application/json"},body:"x".repeat(12 * 1024 * 1024 + 4097)});
    const fn = vi.fn(); expect((await handleNativeOperation(request,"test",["test"],fn)).status).toBe(413); expect(fn).not.toHaveBeenCalled();
  });
  it("rejects non-POST methods", async () => { expect((await handleNativeOperation(req("{}","Bearer fixture","GET"),"test",["test"],vi.fn())).status).toBe(405); });
});
