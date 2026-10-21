/** Registering also checks for a newer worker; an immediate update() can race
 * the first worker's activation and reject with a misleading NotFoundError. */
export async function registerOffline(){
 if(!('serviceWorker' in navigator))return null;
 const workers=navigator.serviceWorker;
 const hadController=!!workers.controller;
 let reloading=false;
 const onControllerChange=()=>{
  if(hadController&&!reloading){reloading=true;location.reload();}
 };
 workers.addEventListener('controllerchange',onControllerChange);
 try{
  return await workers.register('./sw.js',{updateViaCache:'none'});
 }catch(error){
  workers.removeEventListener('controllerchange',onControllerChange);
  // Previously installed workers still serve the cache on an offline launch.
  if(navigator.onLine)console.warn('Offline cache unavailable',error);
  return null;
 }
}
