export function Loader({ progress, error, done }) {
  return (
    <div id="loader" className={done ? "done" : undefined}>
      <div className="loadwrap">
        <p>{error ? `加载失败：${error}（需 HTTP 服务，勿用 file://）` : "载入环绕帧"}</p>
        <div className={`bar${error ? " error" : ""}`}>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
