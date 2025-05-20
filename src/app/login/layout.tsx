
// This layout is specifically for the /login route.
// It should not contain the AppHeader or other elements from the main app layout.
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
    </div>
  );
}
