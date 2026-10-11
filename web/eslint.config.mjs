import coreWebVitals from "eslint-config-next/core-web-vitals";

/** Flat config: Next 16 removed `next lint`, so lint runs through the ESLint CLI. */
const config = [
  {
    ignores: [".next/**", "dist/**", ".wrangler/**", "node_modules/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  {
    // eslint-plugin-react-hooks 7 (bundled with eslint-config-next 16) adds
    // React Compiler readiness rules. The app does not use the compiler, so
    // they stay off and the upgrade changes no behaviour.
    rules: {
      "react-hooks/error-boundaries": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default config;
