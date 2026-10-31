/* Optional local development adapter; do not load on the real Firebase project. */
(function(){
  'use strict';
  if(!['localhost','127.0.0.1'].includes(location.hostname) ||
      !window.firebase?.app || firebase.app()?.options?.projectId!=='demo-speedy-integration' ||
      typeof firebase.functions!=='function') {
    throw new Error('La cafetería de prueba requiere el proyecto demo y Firebase Functions.');
  }
  const functions=firebase.functions();
  functions.useEmulator('127.0.0.1',15001);
  const serve=functions.httpsCallable('serveCafeOrder');
  window.SpeedyCafeEmulator={enabled:true,async serveOrder(orderId){
    const response=await serve({orderId});
    if(!['settled','already-settled'].includes(response?.data?.status)) throw new Error('No se pudo confirmar el cobro.');
    return response.data;
  }};
})();
