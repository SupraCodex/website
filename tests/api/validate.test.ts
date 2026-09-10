import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vString,
  vEmail,
  vUuid,
  vEnum,
  vPagination,
  vPlainObject,
  LIMIT_MAX,
} from "../../src/lib/api/validate.ts";
import { ApiError } from "../../src/lib/api/errors.ts";

function issueOf(fn: () => unknown): { code: string; field?: string } {
  try {
    fn();
    assert.fail("devait lever");
  } catch (e) {
    const err = e as ApiError;
    assert.ok(err instanceof ApiError);
    return { code: err.code, field: err.details?.[0]?.field };
  }
}

test("vString : longueurs bornées", () => {
  assert.equal(vString("  ok  ", "f", { max: 10 }), "ok");
  assert.equal(issueOf(() => vString("x".repeat(11), "f", { max: 10 })).field, "f");
  assert.equal(issueOf(() => vString("", "f", { required: true })).code, "VALIDATION_ERROR");
});

test("vEmail : normalisation et refus", () => {
  assert.equal(vEmail("  User@Example.INVALID ", "email"), "user@example.invalid");
  assert.equal(issueOf(() => vEmail("pas-un-email", "email")).field, "email");
  assert.equal(issueOf(() => vEmail("a..b@x.com", "email")).code, "VALIDATION_ERROR");
});

test("vUuid : format strict", () => {
  const u = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(vUuid(u, "id"), u);
  assert.equal(issueOf(() => vUuid("abc", "id")).code, "VALIDATION_ERROR");
});

test("vEnum : liste fermée", () => {
  assert.equal(vEnum("draft", "status", ["draft", "review"] as const), "draft");
  assert.equal(issueOf(() => vEnum("published", "status", ["draft"] as const)).code, "VALIDATION_ERROR");
});

test("vPagination : bornes 1..50", () => {
  assert.deepEqual(vPagination(new URLSearchParams("page=2&limit=10")), { page: 2, limit: 10, offset: 10 });
  assert.equal(issueOf(() => vPagination(new URLSearchParams("limit=999"))).field, "limit");
  assert.equal(issueOf(() => vPagination(new URLSearchParams("page=0"))).field, "page");
  assert.equal(LIMIT_MAX, 50);
});

test("vPlainObject : refuse tableau et scalaire", () => {
  assert.deepEqual(vPlainObject({ a: 1 }), { a: 1 });
  assert.equal(issueOf(() => vPlainObject([1, 2])).code, "VALIDATION_ERROR");
  assert.equal(issueOf(() => vPlainObject("x")).code, "VALIDATION_ERROR");
});
