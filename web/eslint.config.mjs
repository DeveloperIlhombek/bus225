import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * ESLint flat config. `eslint-config-next` 16-versiyadan boshlab flat
 * konfiguratsiyani to'g'ridan-to'g'ri eksport qiladi — FlatCompat ko'prigi
 * kerak emas.
 */
const config = [
  { ignores: [".next/**", "out/**", "node_modules/**", "public/**"] },
  ...coreWebVitals,
  ...typescriptConfig,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
