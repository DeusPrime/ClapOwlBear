// A wider inward fade preserves the centre while removing the visible frame.
export const WATERMARK_EDGE_MM = 10;
export function watermarkAlpha(distanceMm: number, edgeMm = WATERMARK_EDGE_MM): number {
  const t = Math.max(0, Math.min(1, distanceMm / Math.max(0.1, edgeMm)));
  return t * t * (3 - 2 * t);
}
// Signed inward distance to a rounded frame. The fade follows the corner arc.
export function watermarkFrameDistance(x: number, y: number, width: number, height: number, edgeMm: number): number {
  const radius = Math.min(edgeMm * .75, width / 4, height / 4);
  const qx = Math.abs(x - width / 2) - (width / 2 - radius);
  const qy = Math.abs(y - height / 2) - (height / 2 - radius);
  return radius - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
}
export const filmWatermarkCss = '.book-page .book-watermark-image{mask-image:none;-webkit-mask-image:none}';
export function featherWatermark(image: HTMLImageElement, widthMm: number, edgeMm = WATERMARK_EDGE_MM): HTMLCanvasElement {
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const w=canvas.width,h=canvas.height;
  // Distance to the actual transparent silhouette, rather than only the frame.
  const distance=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    distance[i]=pixels.data[i*4+3]<16?0:Math.min(x+1,y+1,w-x,h-y);
  }
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);
    if(y)distance[i]=Math.min(distance[i],distance[i-w]+1);
    if(x&&y)distance[i]=Math.min(distance[i],distance[i-w-1]+Math.SQRT2);
    if(x<w-1&&y)distance[i]=Math.min(distance[i],distance[i-w+1]+Math.SQRT2);
  }
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
    const i=y*w+x;
    if(x<w-1)distance[i]=Math.min(distance[i],distance[i+1]+1);
    if(y<h-1)distance[i]=Math.min(distance[i],distance[i+w]+1);
    if(x<w-1&&y<h-1)distance[i]=Math.min(distance[i],distance[i+w+1]+Math.SQRT2);
    if(x&&y<h-1)distance[i]=Math.min(distance[i],distance[i+w-1]+Math.SQRT2);
    const mmPerPixel = widthMm / w;
    const rounded = watermarkFrameDistance((x + .5) * mmPerPixel, (y + .5) * mmPerPixel, widthMm, h * mmPerPixel, edgeMm);
    const inward = Math.min(Math.max(0,distance[i]-.5)*mmPerPixel, rounded);
    pixels.data[i*4+3]*=watermarkAlpha(inward, edgeMm);
  }
  ctx.putImageData(pixels,0,0);return canvas;
}
