/** Crop the actual game atlas frame; never run an independent portrait animation. */
export function applyAgentPortrait(image, sprite = {}) {
  image.src = sprite.src || '';
  if (!image.style) return;
  const frame = sprite.frame;
  if (Number.isInteger(frame) && frame >= 0 && frame < 32) {
    Object.assign(image.style, {width:'64px',height:'64px',maxWidth:'none',objectFit:'none',
      objectPosition:`${-(frame%4)*64}px ${-Math.floor(frame/4)*64}px`,zoom:'0.625',imageRendering:'pixelated'});
  } else {
    for (const key of ['width','height','maxWidth','objectFit','objectPosition','zoom','imageRendering']) image.style[key]='';
  }
}
