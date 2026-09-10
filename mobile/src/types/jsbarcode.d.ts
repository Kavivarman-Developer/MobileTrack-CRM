declare module "jsbarcode/src/barcodes" {
  const barcodes: Record<string, new (value: string, options: Record<string, unknown>) => { valid(): boolean; encode(): unknown }>;
  export default barcodes;
}
