/* Progressive enhancement: every group and rule remains readable without JS. */
(() => {
  const search=document.getElementById('group-search');
  const cards=[...document.querySelectorAll('.community-card')];
  const filters=[...document.querySelectorAll('[data-filter]')];
  if(!search||!cards.length)return;
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  let category='Todos';
  const index=new Map(cards.map(card=>[card,normalize(card.textContent)]));
  const update=()=>{
    const query=normalize(search.value);
    let count=0;
    cards.forEach(card=>{
      const visible=(category==='Todos'||card.dataset.category===category)&&index.get(card).includes(query);
      card.hidden=!visible;
      if(visible)count++;
    });
    document.getElementById('group-count').textContent=`${count} ${count===1?'espacio':'espacios'} para explorar`;
    document.getElementById('group-empty').hidden=count!==0;
  };
  search.addEventListener('input',update);
  filters.forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.filter;
    filters.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    update();
  }));
  document.querySelector('.community-tools').hidden=false;
  update();
})();
