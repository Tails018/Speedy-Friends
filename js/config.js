/* Speedy Friends — configuración compartida.
 * Separado del HTML durante la primera etapa de modularización.
 * La configuración del cliente de Firebase no sustituye a las Firebase Rules.
 */
const STORAGE_KEY = "speedy-friends-steam-ui-v1";

    /*
      SINCRONIZACIÓN EN TIEMPO REAL DEL TEAM
      1) Crea un proyecto en Firebase.
      2) Activa Authentication > Sign-in method > Google.
      3) Activa Realtime Database.
      4) Usa Google para que cada integrante tenga una cuenta identificable.
      5) Aplica las reglas recomendadas que están comentadas al final del archivo.

      TEAM_ID separa los equipos aunque compartan el mismo proyecto Firebase.
    */
    const REALTIME_CONFIG = {
      enabled:true,
      teamId:"speedy-friends",
      // Solo esta cuenta puede ver y usar el panel de Administración.
      adminEmail:"t89886464@gmail.com",
      firebaseConfig:{
        apiKey:"AIzaSyByNbNOCihZVwzR7r8w_aIN1breCxUZ1aU",
        authDomain:"speedy-friends.firebaseapp.com",
        databaseURL:"https://speedy-friends-default-rtdb.firebaseio.com",
        projectId:"speedy-friends",
        appId:"1:1045569751260:web:5cea2a6505025db5b28c19",
        storageBucket:"speedy-friends.firebasestorage.app"
      }
    };

    // OST COMPARTIDO: Cloudinary almacena el audio y Firebase guarda solo la URL.
    // Este preset debe ser UNSIGNED. No pongas aquí API Secret ni API Key.
    const CLOUDINARY_CONFIG = {
      cloudName: "qgf6z2er",
      uploadPreset: "speedy_friends_ost"
    };
