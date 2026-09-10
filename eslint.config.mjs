import eslintConfigNext from "eslint-config-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const config = [
  ...eslintConfigNext,
  {
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
