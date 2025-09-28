import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^~/(.*)": "<rootDir>/$1"
  }
};

export default config;
