/* Datos ficticios para auditorías y capturas V7 con tests/firebase-mock.js. No son datos reales. */
const CREATOR={uid:'uid-creator',email:'t89886464@gmail.com',displayName:'Creadora'};
const people=[
 ['creator','Creadora','uid-creator','t89886464@gmail.com',540,'Fundadora'],
 ['alice','Alice','uid-alice','alice@test.local',320,'Speedrunner'],
 ['bob','Bob','uid-bob','bob@test.local',280,'Barista'],
 ['cora','Cora','uid-cora','cora@test.local',210,'Artista'],
 ['dex','Dex','uid-dex','dex@test.local',150,'Runner'],
 ['eli','Eli','uid-eli','eli@test.local',95,'Runner'],
 ['fen','Fen','uid-fen','fen@test.local',60,'Novata'],
 ['gus','Gus','uid-gus','gus@test.local',12,'Runner']
];
const users={},rings={};
for(const [id,name,uid,email,r,title] of people){
 users['user-'+id]={id:'user-'+id,name,username:name.toLowerCase(),nickname:'',title,description:`Perfil de prueba de ${name}.`,ownerUid:uid,ownerEmail:email,rings:r,level:1,xp:0};
 rings['user-'+id]=r;
}
const friend=(uid,name)=>({uid,displayName:name,avatar:'',acceptedAt:1730000000000});
const SEED={'speedy-friends-teams':{'speedy-friends':{
 users,rings,
 friends:{'uid-creator':{'uid-alice':friend('uid-alice','Alice'),'uid-bob':friend('uid-bob','Bob')},'uid-alice':{'uid-creator':friend('uid-creator','Creadora')},'uid-bob':{'uid-creator':friend('uid-creator','Creadora')}},
 friendRequests:{inbox:{'uid-creator':{'uid-cora':{requesterUid:'uid-cora',requesterName:'Cora',recipientUid:'uid-creator',status:'pending',createdAt:1730000500000}}},outbox:{'uid-cora':{'uid-creator':{requesterUid:'uid-cora',requesterName:'Cora',recipientUid:'uid-creator',status:'pending',createdAt:1730000500000}}}},
 cafeteria:{
  menu:{m1:{id:'m1',name:'Chili Latte',description:'Café especiado de prueba',price:20,active:true,category:'Café'},m2:{id:'m2',name:'Ring Frappé',description:'Frappé dorado de prueba',price:35,active:true,category:'Frío'},m3:{id:'m3',name:'Té Esmeralda',description:'Té verde de prueba',price:15,active:true,category:'Té'}},
  workers:{'uid-bob':{active:true,role:'worker',uid:'uid-bob'}},
  orders:{o1:{id:'o1',ownerUid:'uid-alice',ownerProfileId:'user-alice',username:'alice',itemId:'m1',itemName:'Chili Latte',unitPrice:20,qty:1,totalRings:20,status:'pendiente',statusChanges:0,createdAt:1730001000000,paidAt:0}}
 },
 fanarts:{
  f1:{id:'f1',title:'Neon Rush',description:'Fixture de prueba',ownerUid:'uid-bob',authorName:'Bob',category:'Digital',image:'assets/fanart-demo/neon-rush.svg',mediaType:'image',createdAt:3},
  f2:{id:'f2',title:'Arte de la creadora',description:'Fixture de prueba',ownerUid:'uid-creator',authorName:'Creadora',category:'Tradicional',image:'assets/fanart-demo/neon-rush.svg',mediaType:'image',createdAt:2}
 },
 news:{
  n1:{id:'n1',title:'Torneo de velocidad',summary:'Resumen de prueba del torneo.',body:'Cuerpo de prueba.',date:'2026-10-30',category:'EVENTO',published:true},
  n2:{id:'n2',title:'Nueva carta de cafetería',summary:'Resumen de prueba de la carta.',date:'2026-10-28',category:'INFO',published:true},
  n3:{id:'n3',title:'Borrador interno',summary:'No publicado.',date:'2026-10-27',category:'INFO',published:false}
 },
 activity:{a1:{title:'Alice se unió',detail:'Prueba',actorUid:'uid-alice',actorName:'Alice',type:'general',at:1730000000000}}
}}};
module.exports={SEED,CREATOR};
