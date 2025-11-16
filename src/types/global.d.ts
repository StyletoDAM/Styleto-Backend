// Ambient declarations to allow linting/type-checking in environments
// without installed node_modules/@types.
declare module '*';

declare const process: {
  env: Record<string, string | undefined>;
};


