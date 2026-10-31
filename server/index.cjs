'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { settleOrder } = require('./settle-order.cjs');

// Local integration only. This guard intentionally prevents the endpoint from
// connecting to a real project, even when accidentally deployed or misconfigured.
exports.serveCafeOrder = onCall(async request => {
  if (process.env.FUNCTIONS_EMULATOR !== 'true' ||
      process.env.GCLOUD_PROJECT !== 'demo-speedy-integration' ||
      process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:19000') {
    throw new HttpsError('failed-precondition', 'Disponible solamente en el emulador aislado.');
  }
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  if (!request.data || typeof request.data !== 'object' || Array.isArray(request.data) ||
      Object.keys(request.data).length !== 1 || typeof request.data.orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'Solicitud inválida.');
  }
  if (!getApps().length) initializeApp({databaseURL:'https://demo-speedy-integration-default-rtdb.firebaseio.com'});
  const team = getDatabase().ref('speedy-friends-teams/speedy-friends');
  try {
    const result = await settleOrder({
      actorUid: request.auth.uid,
      creatorUid: 'emulator-creator',
      orderId: request.data.orderId,
      runTransaction: update => team.transaction(update, undefined, false)
    });
    return { status:result.status };
  } catch (error) {
    const codes={ 'permission-denied':'permission-denied', 'invalid-argument':'invalid-argument',
      'insufficient-rings':'failed-precondition', 'invalid-order-state':'failed-precondition',
      'invalid-owner':'failed-precondition', 'invalid-product':'failed-precondition',
      'invalid-quantity':'failed-precondition', 'invalid-order':'failed-precondition',
      'invalid-balance':'failed-precondition', 'missing-team':'failed-precondition',
      'ledger-conflict':'failed-precondition' };
    if (codes[error.code]) throw new HttpsError(codes[error.code], error.code);
    throw new HttpsError('internal', 'No se pudo procesar el pedido.');
  }
});
