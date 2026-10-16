// Applies the saved (or system) theme to <html> BEFORE first paint, so there's
// no light-mode flash on load. Inlined in <head> as a blocking script.
export default function ThemeScript({ nonce }: { nonce?: string }) {
  const js = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: js }} />;
}
