import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "dist/**",
      ".astro/**",
      "node_modules/**",
      "**/*.d.ts",
      ".vercel/**",
      ".netlify/**",
      "src/pages/**/*.astro",
      "src/layouts/**/*.astro",
      "src/components/**/*.astro",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.js", "**/*.mjs"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        document: "readonly",
        window: "readonly",
        Event: "readonly",
        fetch: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Add your custom rules here
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Add Astro support if needed
];
