export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Slater Street Candles. All rights reserved.</p>
      </div>
    </footer>
  );
}
