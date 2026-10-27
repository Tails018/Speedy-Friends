/* Small shared helpers. Existing Firebase/profile/admin implementations remain authoritative. */
(() => {
  'use strict';
  const ready = () => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    document.querySelectorAll('.sf-socials button').forEach(button=>button.addEventListener('click',()=>{
      const toast=document.getElementById('toast');if(!toast)return;
      toast.textContent=`El enlace oficial de ${button.getAttribute('aria-label')||'esta red'} todavía no está configurado.`;
      toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4500);
    }));
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(field=>{
      if(field.getAttribute('aria-label')||field.getAttribute('aria-labelledby')||field.closest('label')||(field.id&&document.querySelector(`label[for="${CSS.escape(field.id)}"]`)))return;
      field.setAttribute('aria-label',field.getAttribute('placeholder'));
    });
    // Make existing clickable ranking/OST rows operable with a keyboard.
    const enhanceRows = () => document.querySelectorAll('.ost-row,.ost-custom-row,.rank-row,.creator-rank-card').forEach(row => {
      if (row.matches('a,button') || row.dataset.sfKeyboard) return;
      row.dataset.sfKeyboard = 'true'; row.tabIndex = 0; row.setAttribute('role','button');
      row.addEventListener('keydown', event => {
        if (event.target !== row || !['Enter',' '].includes(event.key)) return;
        event.preventDefault(); row.click();
      });
    });
    let rowFrame;
    const observer = new MutationObserver(records => {
      if (records.some(r => r.addedNodes.length)) {
        cancelAnimationFrame(rowFrame); rowFrame=requestAnimationFrame(enhanceRows);
      }
    });
    observer.observe(document.body,{childList:true,subtree:true}); enhanceRows();
    // Keyboard containment for existing custom dialogs, including the required login gate.
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"],.is-hidden');
    document.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const dialogs=[...document.querySelectorAll('[role="dialog"][aria-modal="true"],dialog[open]')].filter(visible);
      const active=dialogs.at(-1); if(!active) return;
      const items=[...active.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(visible);
      if (!items.length) return;
      const first=items[0],last=items.at(-1);
      if (!active.contains(document.activeElement) || (event.shiftKey && document.activeElement===first)) {event.preventDefault();(event.shiftKey?last:first).focus();}
      else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
    });
    // Shared asset failures degrade to existing local artwork once, without retry loops.
    document.addEventListener('error', event => {
      const img=event.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.sfFallback || !img.getAttribute('src')) return;
      img.dataset.sfFallback='true'; img.removeAttribute('srcset');
      img.src='assets/optimized/1cdfd07e95f6-640.webp';
    },true);
    if (!document.querySelector('[data-action="rings"],[data-action="cart"]')) return;
    const shell=document.createElement('dialog'); shell.className='sf-tools-dialog'; shell.setAttribute('aria-labelledby','sf-tools-title');
    shell.innerHTML='<div class="sf-tools-heading"><h2 id="sf-tools-title"></h2><button type="button" data-tool-close aria-label="Cerrar panel">×</button></div><div id="sf-tools-content"></div><p class="sf-tools-status" role="status" aria-live="polite"></p>';
    document.body.append(shell);
    const title=shell.querySelector('h2'),content=shell.querySelector('#sf-tools-content'),status=shell.querySelector('[role=status]');
    let opener,view='rings',showCatalog=false,unsubscribe=()=>{};
    const KEY='speedy-friends-steam-ui-v1'; // Same saved-product IDs as the original legacy catalog.
    const read=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
    const cart=()=>Array.isArray(read().cart)?read().cart.filter(id=>typeof id==='string'):[];
    const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const number=value=>new Intl.NumberFormat('es-PE').format(Number.isFinite(Number(value))?Number(value):0);
    const catalog=window.SFStoreCatalog||[];
    const price=p=>Math.round(p.price*(1-(p.discount||0)));
    const save=ids=>{
      try{localStorage.setItem(KEY,JSON.stringify({...read(),cart:ids}));}
      catch{status.textContent='No pudimos guardar el carrito. Habilita el almacenamiento del navegador y vuelve a intentar.';return false;}
      syncCount();return true;
    };
    function syncCount(){const count=document.querySelector('#quick-cart-count');if(count)count.textContent=String(cart().length);}
    function renderRings(){
      const sf=window.SpeedyFirebase,current=sf?.current;
      const amount=current?.uid ? number(current.rings) : '—';
      title.textContent='Tus Rings';
      content.innerHTML=`<p class="sf-tools-muted">${current?.uid?'Saldo de tu cuenta':'Inicia sesión para consultar tu saldo'}</p><p class="sf-ring-total">${amount} <span aria-hidden="true">◉</span></p><p>Los Rings de tu perfil se actualizan con la cuenta del portal.</p><a class="sf-tools-primary" href="ranking.html">Ver ranking ↗</a>`;
    }
    function renderCart(){
      title.textContent='Tu carrito';const ids=cart();
      const selected=ids.map(id=>catalog.find(p=>p.id===id)||{id,name:id,price:null});
      const total=selected.reduce((sum,p)=>sum+(p.price===null?0:price(p)),0);
      content.innerHTML=`<p class="sf-tools-muted">Productos guardados en este navegador. Guardar no descuenta Rings.</p><div class="sf-cart-list">${selected.length?selected.map(p=>`<article class="sf-cart-item"><div><h3>${esc(p.name)}</h3><p>${p.price===null?'Producto del catálogo anterior':number(price(p))+' Rings'}</p></div><button type="button" data-cart-remove="${esc(p.id)}" aria-label="Quitar ${esc(p.name)}">Quitar</button></article>`).join(''):'<p>Aún no has guardado productos. Explora el catálogo para añadir tus favoritos.</p>'}</div><div class="sf-tools-footer"><strong>Total estimado: ${number(total)} Rings</strong><button type="button" class="sf-tools-primary" data-catalog-toggle>${showCatalog?'Ocultar catálogo':'Explorar catálogo'}</button></div>${showCatalog?`<div class="sf-catalog">${catalog.map(p=>`<article><span class="sf-product-mark" aria-hidden="true">${esc(p.emoji||'◈')}</span><h3>${esc(p.name)}</h3><p class="sf-tools-muted">${esc(p.description)}</p><strong>${number(price(p))} Rings</strong><button type="button" data-cart-add="${esc(p.id)}" ${ids.includes(p.id)?'disabled':''}>${ids.includes(p.id)?'Guardado ✓':'Guardar en carrito'}</button></article>`).join('')}</div>`:''}`;
    }
    function renderInventory(){
      title.textContent='Tu inventario local';
      const ids=Array.isArray(read().inventory)?read().inventory.filter(id=>typeof id==='string'):[];
      content.innerHTML='<p class="sf-tools-muted">Colección guardada en este navegador. Se conserva tu inventario anterior.</p><div class="sf-cart-list">'+(ids.length?ids.map(id=>{const product=catalog.find(p=>p.id===id);return `<article class="sf-cart-item"><div><h3>${esc(product?.name||id)}</h3><p>${esc(product?.description||'Producto del inventario anterior')}</p></div></article>`;}).join(''):'<p>Aún no hay productos guardados en tu inventario local.</p>')+'</div>';
    }
    function watchRings(){
      unsubscribe();unsubscribe=()=>{};
      const sf=window.SpeedyFirebase,state=sf?.current;
      if(!state?.uid||!state.profileId||!sf.refs?.rings)return;
      const ref=sf.refs.rings.child(state.profileId);
      const update=snap=>{if(snap.exists()){state.rings=Number(snap.val())||0;const count=document.querySelector('#quick-rings');if(count)count.textContent=number(state.rings);if(shell.open&&view==='rings')renderRings();}};
      ref.on('value',update,()=>{if(shell.open&&view==='rings')status.textContent='No se pudo actualizar el saldo. Vuelve a abrir el panel para reintentar.';});
      unsubscribe=()=>ref.off('value',update);
    }
    document.addEventListener('click',event=>{
      const trigger=event.target.closest('[data-action="rings"],[data-action="cart"],[data-action="inventory"]');
      if(!trigger||trigger.dataset.authBusy==='true')return;
      event.preventDefault();opener=trigger;view=trigger.dataset.action;status.textContent='';
      if(trigger.hasAttribute('data-open-catalog'))showCatalog=true;
      view==='rings'?renderRings():view==='inventory'?renderInventory():renderCart();if(!shell.open)shell.showModal();
      if(view==='rings')watchRings();
    },true);
    shell.addEventListener('click',event=>{
      if(event.target.closest('[data-tool-close]'))shell.close();
      const add=event.target.closest('[data-cart-add]'),remove=event.target.closest('[data-cart-remove]');
      if(add||remove){const id=add?.dataset.cartAdd||remove.dataset.cartRemove;const ids=cart();
        if(save(add?[...new Set([...ids,id])]:ids.filter(x=>x!==id))){renderCart();status.textContent=add?'Producto guardado.':'Producto eliminado del carrito.';content.querySelector('[data-catalog-toggle]')?.focus();}
      }
      if(event.target.closest('[data-catalog-toggle]')){showCatalog=!showCatalog;renderCart();content.querySelector('[data-catalog-toggle]')?.focus();}
      if(event.target===shell){const r=shell.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)shell.close();}
    });
    shell.addEventListener('close',()=>{unsubscribe();opener?.focus();});
    window.addEventListener('pagehide',()=>unsubscribe());
    window.addEventListener('storage',event=>{if(event.key===KEY){syncCount();if(shell.open&&view==='cart')renderCart();}});
    document.addEventListener('speedy:firebase-ready',()=>{if(shell.open&&view==='rings'){renderRings();watchRings();}});
    syncCount();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
