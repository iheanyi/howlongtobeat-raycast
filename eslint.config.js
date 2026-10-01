import raycast from "@raycast/eslint-config";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-raycast/**",
      ".research/**",
      ".npm-cache/**",
      "output/**",
      "raycast-env.d.ts",
      "web/**",
      "vite.config.ts",
    ],
  },
  ...raycast,
];
