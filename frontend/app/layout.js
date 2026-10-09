import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "PO Finance Platform",
  description: "Purchase order financing platform for suppliers and administrators.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
