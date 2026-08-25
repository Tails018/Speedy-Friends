/* Speedy Friends — utilidades compartidas */
const safeParse = (value,fallback) => {
      try{return JSON.parse(value)}catch{return fallback}
    };

    const escapeHtml = value => String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

    const makeId = value => String(value || "runner")
      .trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g,"-")
      .replace(/[^a-z0-9-]/g,"")
      .slice(0,48) || `runner-${Date.now()}`;
