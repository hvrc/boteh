// Grid drawing functionality
export function drawGrid(ctx, width, height, n, activeCells) {
  const cellWidth = width / n;
  const cellHeight = height / n;
  
  // Draw blue cells first
  ctx.fillStyle = 'rgba(0, 0, 255, 0.3)'; // Semi-transparent blue
  activeCells.forEach(cell => {
    ctx.fillRect(
      cell.x * cellWidth,
      cell.y * cellHeight,
      cellWidth,
      cellHeight
    );
  });

  // Draw grid lines
  ctx.beginPath();
  ctx.strokeStyle = 'lightgrey';
  ctx.lineWidth = 1;
  
  // Draw vertical lines
  for (let x = 0; x <= width; x += cellWidth) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  
  // Draw horizontal lines
  for (let y = 0; y <= height; y += cellHeight) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  
  ctx.stroke();
}
