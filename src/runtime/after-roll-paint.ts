/** Give the local dice a painted frame before room serialization and notifications begin. */
export function afterRollPaint(callback:()=>void) {
  let done=false,first=0,second=0;
  const finish=()=>{if(done)return;done=true;window.clearTimeout(timer);if(first)window.cancelAnimationFrame(first);if(second)window.cancelAnimationFrame(second);callback();};
  const timer=window.setTimeout(finish,100);
  if(typeof window.requestAnimationFrame==='function')first=window.requestAnimationFrame(()=>{second=window.requestAnimationFrame(finish);});
}
