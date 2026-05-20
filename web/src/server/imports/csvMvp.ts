export type { CsvMvpRow } from "@/server/imports/csvMvpCore";

/** @deprecated Use `runImportacaoCsv` from `@/server/services/importacaoCsvService`. */
export { runImportacaoCsv as runCsvMvpImport } from "@/server/services/importacaoCsvService";
