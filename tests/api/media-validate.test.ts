import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMediaUpload,
  vFilename,
  vMimeType,
  vFileSize,
  isMimeExtensionConsistent,
  MEDIA_LIMITS,
} from "../../src/lib/api/admin/media-validate.ts";
import { ApiError } from "../../src/lib/api/errors.ts";

test("vFilename : refuse les chemins et caractères dangereux", () => {
  assert.throws(() => vFilename("../../etc/passwd"), (e) => e instanceof ApiError && e.code === "VALIDATION_ERROR");
  assert.throws(() => vFilename("file\\windows.png"), (e) => e instanceof ApiError);
  assert.throws(() => vFilename("file\0.png"), (e) => e instanceof ApiError);
  assert.throws(() => vFilename("script.exe"), (e) => e instanceof ApiError && e.code === "VALIDATION_ERROR");
  assert.equal(vFilename("photo-2026.png"), "photo-2026.png");
});

test("vMimeType : refuse les types non autorisés", () => {
  assert.throws(() => vMimeType("application/x-php"), (e) => e instanceof ApiError && e.code === "VALIDATION_ERROR");
  assert.throws(() => vMimeType("text/html"), (e) => e instanceof ApiError);
  assert.equal(vMimeType("image/png"), "image/png");
  assert.equal(vMimeType("application/pdf"), "application/pdf");
});

test("vFileSize : refuse taille excessive et nulle", () => {
  assert.throws(() => vFileSize(0), (e) => e instanceof ApiError);
  assert.throws(() => vFileSize(-1), (e) => e instanceof ApiError);
  assert.throws(() => vFileSize(MEDIA_LIMITS.maxFileSize + 1), (e) => e instanceof ApiError && e.code === "VALIDATION_ERROR");
  assert.equal(vFileSize(1024), 1024);
});

test("isMimeExtensionConsistent : détecte les incohérences", () => {
  assert.equal(isMimeExtensionConsistent("photo.png", "image/png"), true);
  assert.equal(isMimeExtensionConsistent("photo.jpg", "image/jpeg"), true);
  assert.equal(isMimeExtensionConsistent("photo.png", "image/jpeg"), false); // MIME falsifié
  assert.equal(isMimeExtensionConsistent("photo.exe", "image/png"), false);
});

test("validateMediaUpload : alt obligatoire si non décoratif", () => {
  assert.throws(
    () => validateMediaUpload({ logicalName: "Test", mimeType: "image/png", sizeBytes: 1000, isDecorative: false, altText: null, visibility: "public" }),
    (e) => e instanceof ApiError && e.code === "VALIDATION_ERROR",
  );
});

test("validateMediaUpload : alt optionnel si décoratif", () => {
  const r = validateMediaUpload({ logicalName: "Test", mimeType: "image/png", sizeBytes: 1000, isDecorative: true, altText: null, visibility: "public" });
  assert.equal(r.isDecorative, true);
  assert.equal(r.altText, null);
});

test("validateMediaUpload : valide avec alt fourni", () => {
  const r = validateMediaUpload({ logicalName: "Test", mimeType: "image/png", sizeBytes: 1000, isDecorative: false, altText: "Texte alternatif", visibility: "public" });
  assert.equal(r.altText, "Texte alternatif");
  assert.equal(r.visibility, "public");
});

test("validateMediaUpload : refuse visibilité invalide", () => {
  assert.throws(
    () => validateMediaUpload({ logicalName: "Test", mimeType: "image/png", sizeBytes: 1000, isDecorative: true, visibility: "secret" }),
    (e) => e instanceof ApiError,
  );
});
