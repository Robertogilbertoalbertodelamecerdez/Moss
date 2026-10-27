import "./globals.css";

export const metadata = {
  title: "MOSS CRM",
  description: "Sistema de Control de Suscripciones y Stock",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Limpiador automático contra extensiones (Bitdefender / Adblock) que rompen Next.js */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const limpiarAtributosBasura = () => {
                  document.querySelectorAll('[bis_skin_checked], [bis_register]').forEach(el => {
                    el.removeAttribute('bis_skin_checked');
                    el.removeAttribute('bis_register');
                  });
                };
                limpiarAtributosBasura();
                const obs = new MutationObserver(limpiarAtributosBasura);
                obs.observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ['bis_skin_checked', 'bis_register'] });
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}