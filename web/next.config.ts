import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mantém alguns pacotes como "externals" no server bundle.
  // Isso evita que o Turbopack trace caminhos errados para assets internos (ex.: pdfkit *.afm).
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
