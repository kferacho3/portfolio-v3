declare module 'wrap-ansi' {
  const wrapAnsi: (
    input: string,
    columns: number,
    options?: { hard?: boolean; wordWrap?: boolean }
  ) => string;
  export default wrapAnsi;
}
