export const metadata = {
  title: "Antonina Osteria",
  description: "Reservas de mesa e eventos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
