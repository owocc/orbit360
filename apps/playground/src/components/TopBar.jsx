export function TopBar({ title, hint, hintHidden }) {
  return (
    <header id="topbar">
      <div id="title" className="top-title" title={title}>{title}</div>
      <div id="hint" className={hintHidden ? 'hide' : undefined}>{hint}</div>
    </header>
  );
}
