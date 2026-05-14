import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";
import { _resetDBForTests } from "@/lib/db/db";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  _resetDBForTests();
});
afterAll(() => server.close());
