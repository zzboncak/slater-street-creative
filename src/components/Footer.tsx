export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex justify-between items-center">
          <p>© {new Date().getFullYear()} Slater Street Creative. All rights reserved.</p>
          <a 
            href="mailto:info@slaterstreetcreative.com"
            className="hover:text-foreground transition-colors ml-8"
          >
            info@slaterstreetcreative.com
          </a>
        </div>
      </div>
    </footer>
  );
}
