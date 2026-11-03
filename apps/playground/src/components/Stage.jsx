export function Stage({ stageRef, canvasRef }) {
  return (
    <div id="stage" ref={stageRef}>
      <canvas id="view" ref={canvasRef} />
    </div>
  );
}
