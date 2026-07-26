// ============================================================================
//  CITY: Paris — Lumière · La Ville Lumière
//  Terrain city: the Seine carved as a real curving channel with Île de la Cité
//  and Île Saint-Louis in it, the Montmartre butte, twelve avenues radiating
//  from the Étoile, Haussmann perimeter blocks that form continuous street
//  walls, and ~28 landmarks. Load with  index.html?city=paris
//
//  Paris is the inverse of a skyline city: its character is UNIFORMITY. Almost
//  every building in the core is the same cream limestone, the same six
//  storeys, the same zinc mansard. So the generator's job here is not variety
//  for its own sake — it is holding a consistent cornice line down a whole
//  street while varying bay width, roof pitch and balcony rhythm enough that
//  the eye doesn't read a repeating texture.
// ============================================================================

export const CITY = {
  id:'paris',
  name:'LUMIÈRE',
  subtitle:'PARIS · LA SEINE · GOLDEN HOUR',
  tagline:'3D PARIS · FREE DRIVE · CONDUITE LIBRE',
  seed:1789,
  tiltToGround:true, slopeGravity:true, safeMinY:0.6,

  theme:{
    exposure:1.20, background:0xf3b184, fogColor:0xe9a582, fog:0.00082,
    carColor:0x1c3f7a,                                    // dark French blue
    sunPos:[-520,150,120], sunColor:0xffc189, sunInt:2.9, // sun setting down the Seine, WNW
    sky:{top:0x2b4a8e, mid:0xe8956a, bot:0xffd7a4},
    hemiSky:0xffe2be, hemiGround:0x584a42, hemiInt:1.15,
    ambColor:0xffdcb4, ambInt:0.32,
    fillColor:0x8ea6e8, fillInt:0.32, fillPos:[300,140,-240],
    ground:0x4a4239,
    env:{stops:[[0,'#2c4a8c'],[0.44,'#e2915f'],[0.63,'#ffd096'],[1,'#6a5040']],sun:[46,44,48]},
    bloom:[0.58,0.70,0.80],
  },

  // exactly on the Champs-Élysées centreline, 90 units down from the Étoile,
  // facing Concorde — the avenue runs at 42°, so this has to be computed, not eyeballed
  start:{x:-271.1, z:-77.8, heading:0.837},
  bounds:{x0:-700, x1:660, z0:-560, z1:600},

  districts(x,z){
    if(x<-560&&z<-90)return'LA DÉFENSE';
    if(z<-300)return x<-140?'MONTMARTRE 18ᵉ':x<160?'LA CHAPELLE 18ᵉ':'BELLEVILLE 20ᵉ';
    if(z<-150)return x<-260?'BATIGNOLLES 17ᵉ':x<20?'OPÉRA 9ᵉ':'RÉPUBLIQUE 10ᵉ';
    if(z<40){
      if(x<-380)return'TROCADÉRO 16ᵉ';
      if(x<-190)return'CHAMPS-ÉLYSÉES 8ᵉ';
      if(x<110)return'LOUVRE 1ᵉʳ';
      if(x<300)return'LE MARAIS 4ᵉ';
      return'NATION 11ᵉ';
    }
    if(z<160){
      if(x<-330)return'CHAMP DE MARS 7ᵉ';
      if(x<-120)return'INVALIDES 7ᵉ';
      if(x<120)return'ÎLE DE LA CITÉ 4ᵉ';
      return'BERCY 12ᵉ';
    }
    if(z<330)return x<-140?'MONTPARNASSE 14ᵉ':x<140?'QUARTIER LATIN 5ᵉ':'GARE DE LYON 12ᵉ';
    return'LES PORTES · PÉRIPHÉRIQUE';
  },

  build(api){
    const {THREE,scene,rand,rr,pick,clamp,lerp,buildCar,registerBeacon}=api;
    // deep link:  #at=<x>,<z>[,<heading>]  — spawn anywhere (used for screenshots too)
    {const m=/at=(-?[\d.]+),(-?[\d.]+)(?:,(-?[\d.]+))?/.exec(location.hash||'');
      if(m)CITY.start={x:+m[1],z:+m[2],heading:m[3]!==undefined?+m[3]:CITY.start.heading};}
    const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
    const gauss2=(x,z,cx,cz,h,sx,sz)=>h*Math.exp(-((x-cx)**2/(2*sx*sx)+(z-cz)**2/(2*sz*sz)));
    const WATER_Y=0, PLAIN=7;                 // Seine surface, and the height of flat Paris

    const DEG=Math.PI/180;
    const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];};
    const tex=c=>{const t=new THREE.CanvasTexture(c);t.anisotropy=8;return t;};

    // ======================================================================
    //  1. THE SEINE — a real curving channel, not a straight cut
    // ======================================================================
    //  Everything on the water is positioned by `bank(t, side, offset)` rather
    //  than by absolute coordinates, so the Eiffel Tower and the Palais de
    //  Chaillot genuinely face each other across the river however the
    //  centreline is retuned. side: +1 = Left Bank (rive gauche), -1 = Right.
    const SEINE_CTRL=[
      [ 610, 372],[ 528, 330],[ 448, 292],[ 372, 256],[ 296, 224],[ 224, 196],
      [ 156, 172],[  92, 152],[  34, 138],[ -22, 126],[ -78, 116],[-134, 106],
      [-188,  94],[-238,  78],[-282,  58],[-320,  32],[-352,   0],[-378, -38],
      [-402, -84],[-428,-136],[-458,-196],[-492,-262],[-534,-336],
    ];
    // Catmull-Rom resample so the banks and quais are smooth, not faceted
    const SEINE=(()=>{
      const c=new THREE.CatmullRomCurve3(SEINE_CTRL.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'catmullrom',0.5);
      const n=280, pts=c.getSpacedPoints(n), out=[];
      let acc=0;
      for(let i=0;i<=n;i++){
        if(i>0)acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
        out.push({x:pts[i].x,z:pts[i].z,s:acc});
      }
      const L=acc;for(const p of out)p.t=p.s/L;
      return {pts:out,length:L};
    })();
    const seineIdx=t=>clamp(Math.round(clamp(t,0,1)*(SEINE.pts.length-1)),0,SEINE.pts.length-1);
    const seineAt=t=>SEINE.pts[seineIdx(t)];
    function seineTan(t){
      const i=seineIdx(t), a=SEINE.pts[Math.max(0,i-1)], b=SEINE.pts[Math.min(SEINE.pts.length-1,i+1)];
      const dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz)||1;return{x:dx/L,z:dz/L};
    }
    /** left of the downstream direction is (fz,-fx) with +y up — rive gauche */
    function bank(t,side,off){
      const p=seineAt(t), f=seineTan(t);
      return {x:p.x+f.z*off*side, z:p.z-f.x*off*side};
    }
    /** nearest-point query against the river: {d: distance, t: parameter, side} */
    const SEINE_CELL=64, seineHash=new Map();
    (function hashSeine(){
      for(let i=0;i<SEINE.pts.length;i++){
        const p=SEINE.pts[i], gx=Math.floor(p.x/SEINE_CELL), gz=Math.floor(p.z/SEINE_CELL);
        for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
          const k=(gx+a)+','+(gz+b);let l=seineHash.get(k);if(!l)seineHash.set(k,l=[]);l.push(i);
        }
      }
    })();
    function seineNear(x,z){
      const k=Math.floor(x/SEINE_CELL)+','+Math.floor(z/SEINE_CELL);
      const list=seineHash.get(k);
      let bd=1e9,bi=0;
      if(list){for(const i of list){const p=SEINE.pts[i],d=(p.x-x)**2+(p.z-z)**2;if(d<bd){bd=d;bi=i;}}}
      else{for(let i=0;i<SEINE.pts.length;i+=4){const p=SEINE.pts[i],d=(p.x-x)**2+(p.z-z)**2;if(d<bd){bd=d;bi=i;}}}
      const p=SEINE.pts[bi], f=seineTan(p.t);
      const side=Math.sign((x-p.x)*f.z-(z-p.z)*f.x)||1;
      return {d:Math.sqrt(bd), t:p.t, side};
    }
    // the river narrows upstream and widens through the bend below the Eiffel
    const seineHalf=t=>26+10*smoothstep(0.15,0.75,t);

    // The two islands. Both sit IN the channel, so they're defined in river
    // parameter space and then lifted back out of the water.
    //  Both islands are given as the two ends of their long axis and converted
    //  into river parameters, because guessing arc-length t by eye does not work
    //  — the same mistake put the Eiffel Tower out at La Défense on the first try.
    const ILES=[
      {a:[ 74,148], b:[-28,126], off:-2, hw:19, name:'cite'},    // Île de la Cité
      {a:[126,160], b:[ 80,150], off: 1, hw:12, name:'stlouis'}, // Île Saint-Louis
    ].map(I=>{
      const ta=seineNear(I.a[0],I.a[1]).t, tb=seineNear(I.b[0],I.b[1]).t;
      return {...I,t0:Math.min(ta,tb),t1:Math.max(ta,tb)};
    });
    function ileLift(x,z,near){
      let best=0;
      for(const I of ILES){
        if(near.t<I.t0-0.02||near.t>I.t1+0.02)continue;
        const along=smoothstep(I.t0-0.018,I.t0+0.012,near.t)*(1-smoothstep(I.t1-0.012,I.t1+0.018,near.t));
        const across=1-smoothstep(I.hw*0.62,I.hw,Math.abs(near.d*near.side-I.off));
        best=Math.max(best,along*across);
      }
      return best;
    }

    // ======================================================================
    //  2. TERRAIN — flat Paris, the buttes, and the river cut
    // ======================================================================
    function reliefH(x,z){
      let h=PLAIN;
      h+=gauss2(x,z,-70,-352,104,86,74);      // the Montmartre butte
      h+=gauss2(x,z,272,-286, 52,110,86);     // Belleville / Ménilmontant
      h+=gauss2(x,z, 66, 226, 26, 74,62);     // Montagne Sainte-Geneviève (Panthéon)
      h+=gauss2(x,z,-452,-108, 22, 66,58);    // Colline de Chaillot
      h+=gauss2(x,z, 24, 372, 16,130,80);     // the southern slope out to the Porte d'Orléans
      h+=1.1*Math.sin(x*0.021)*Math.cos(z*0.018);
      return h;
    }
    function terrainRaw(x,z){
      const near=seineNear(x,z);
      const half=seineHalf(near.t);
      let h=reliefH(x,z);
      // carve the channel: full depth mid-stream, easing up over the last 14 units
      const cut=1-smoothstep(half-14,half+6,near.d);
      if(cut>0)h=lerp(h,-9,cut);
      // then lift the two islands back out of it
      const lift=ileLift(x,z,near);
      if(lift>0)h=lerp(h,PLAIN-0.6,lift);
      return h;
    }
    const surfaceH=terrainRaw;

    // ======================================================================
    //  3. TERRAIN MESH
    // ======================================================================
    const MESH={W:1520,D:1340,SX:266,SZ:236,CX:-20,CZ:20};
    {const geo=new THREE.PlaneGeometry(MESH.W,MESH.D,MESH.SX,MESH.SZ);geo.rotateX(-Math.PI/2);
      const pos=geo.attributes.position,colors=new Float32Array(pos.count*3),c=new THREE.Color();
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i)+MESH.CX,z=pos.getZ(i)+MESH.CZ,h=surfaceH(x,z);
        pos.setX(i,x);pos.setY(i,h);pos.setZ(i,z);
        const e=2.6,slope=Math.hypot(surfaceH(x+e,z)-surfaceH(x-e,z),surfaceH(x,z+e)-surfaceH(x,z-e))/(2*e);
        c.setRGB(0.30+0.03*rand(),0.285+0.03*rand(),0.255+0.025*rand());       // Paris stone-grey ground
        if(h>34)c.lerp(new THREE.Color(0.20,0.26,0.15),smoothstep(34,86,h));   // the green buttes
        if(slope>0.7)c.lerp(new THREE.Color(0.30,0.27,0.23),0.7*smoothstep(0.7,1.3,slope));
        if(h>0.4&&h<5.2)c.lerp(new THREE.Color(0.44,0.40,0.33),0.8);           // the quais, at the waterline
        if(h<-0.5)c.setRGB(0.055,0.075,0.085);
        colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
      }
      geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();
      const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,envMapIntensity:0.16}));
      m.receiveShadow=true;scene.add(m);}

    // ======================================================================
    //  4. THE WATER
    // ======================================================================
    const SUN_DIR=new THREE.Vector3(-0.90,0.24,0.22).normalize();
    const waterMat=new THREE.ShaderMaterial({fog:true,
      uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0},sunDir:{value:SUN_DIR}}]),
      vertexShader:`
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorld=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader:`
        #include <fog_pars_fragment>
        varying vec3 vWorld;uniform float time;uniform vec3 sunDir;
        void main(){vec3 p=vWorld;float t=time;
          // a river is calmer than a harbour — smaller, slower, more directional ripples
          vec3 n=normalize(vec3(sin(p.x*0.10+t*0.75)*0.030+sin(p.x*0.26+p.z*0.11+t*1.25)*0.020,1.0,
                                sin(p.z*0.095+t*0.62)*0.030+sin((p.z-p.x)*0.20+t*0.95)*0.017));
          vec3 V=normalize(cameraPosition-p);float fres=pow(1.0-max(dot(V,n),0.0),3.0);vec3 refDir=reflect(-V,n);
          vec3 skyRef=mix(vec3(0.86,0.52,0.30),vec3(0.16,0.22,0.42),clamp(refDir.y*2.2,0.0,1.0));
          vec3 deep=vec3(0.055,0.072,0.078);vec3 col=mix(deep,skyRef,0.20+0.56*fres);
          vec3 H=normalize(V+sunDir);vec3 ns=normalize(n*vec3(2.2,1.0,1.1));
          col+=vec3(1.30,0.80,0.44)*pow(max(dot(H,ns),0.0),150.0)*2.1;
          col+=vec3(1.0,0.62,0.34)*pow(max(dot(H,ns),0.0),22.0)*0.30;
          gl_FragColor=vec4(col,1.0);
        #include <fog_fragment>
        }`});
    {const w=new THREE.Mesh(new THREE.PlaneGeometry(3200,3200,1,1),waterMat);
      w.rotation.x=-Math.PI/2;w.position.set(-20,WATER_Y,20);scene.add(w);}

    // ======================================================================
    //  5. ROAD NETWORK — radial, not a grid
    // ======================================================================
    const ROAD_W=15, AVE_W=22, CHAMPS_W=32, LIFT=0.14;
    const boxes=[], bldgPts=[], lanes=[];
    const addBox=(x,z,hw,hd,h)=>{boxes.push({x,z,hw,hd,h});};

    // the great places. Paris is organised around these, and every avenue is a
    // chord between two of them.
    const PL={
      etoile:    {x:-338,z:-138,r:34},
      concorde:  {x:-186,z:  30,r:30},
      madeleine: {x:-166,z: -26,r:16},
      opera:     {x:-104,z: -54,r:16},
      chatelet:  {x:  36,z:  74,r:14},
      bastille:  {x: 206,z:  56,r:22},
      republique:{x: 138,z: -84,r:22},
      nation:    {x: 396,z:  34,r:24},
      trocadero: {x:-300,z: -92,r:22},
      invalides: {x:-268,z: 132,r:20},
      denfert:   {x: -46,z: 300,r:18},
      italie:    {x: 150,z: 350,r:20},
      clichy:    {x:-142,z:-292,r:16},
      pigalle:   {x: -76,z:-296,r:14},
      defense:   {x:-618,z:-206,r:26},
      alma:      {x:-344,z: -58,r:14},
      ternes:    {x:-402,z:-176,r:14},
      villette:  {x: 210,z:-292,r:16},
      gobelins:  {x:  96,z: 292,r:14},
      vosges:    {x: 158,z:  36,r:12},
    };

    const roadPolys=[];              // every road centreline, for the building placer
    function seg(a,b,w,name){        // straight avenue between two places
      const A=PL[a]||a, B=PL[b]||b;
      const n=Math.max(2,Math.ceil(Math.hypot(B.x-A.x,B.z-A.z)/5));
      const pts=[];for(let i=0;i<=n;i++)pts.push({x:lerp(A.x,B.x,i/n),z:lerp(A.z,B.z,i/n)});
      roadPolys.push({pts,w:w||ROAD_W,name});return pts;
    }
    function arc(cx,cz,r,a0,a1,w,name){   // ring boulevards
      const n=Math.max(8,Math.ceil(Math.abs(a1-a0)*r/6)),pts=[];
      for(let i=0;i<=n;i++){const a=lerp(a0,a1,i/n);pts.push({x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*r});}
      roadPolys.push({pts,w:w||ROAD_W,name});return pts;
    }
    function riverRoad(side,off,t0,t1,w,name){  // quais, following the water
      const n=180,pts=[];
      for(let i=0;i<=n;i++){const t=lerp(t0,t1,i/n);pts.push(bank(t,side,seineHalf(t)+off));}
      roadPolys.push({pts,w:w||ROAD_W,name});return pts;
    }

    // --- the twelve avenues of the Étoile ---------------------------------
    //  Named where the real ones are; the rest run out to the ring. This is
    //  the one piece of Paris a grid absolutely cannot fake.
    const ETOILE_SPOKES=[];
    {const E=PL.etoile;
      const named=[
        [ 42,178,'CHAMPS-ÉLYSÉES'],[222,150,'GRANDE ARMÉE'],[132,150,'WAGRAM'],
        [312,150,'KLÉBER'],[ 87,140,'FRIEDLAND'],[267,140,'CARNOT'],
        [177,120,'MAC-MAHON'],[357,130,'MARCEAU'],[ 12,130,'HOCHE'],
        [197, 96,'NIEL'],[292,120,'VICTOR-HUGO'],[152, 96,'FOCH'],
      ];
      for(const[deg,len,nm]of named){
        const a=deg*DEG, B={x:E.x+Math.cos(a)*len, z:E.z+Math.sin(a)*len};
        ETOILE_SPOKES.push(seg('etoile',B,deg===42?CHAMPS_W:deg===222?AVE_W:ROAD_W,nm));
      }
    }
    // --- the great axes ----------------------------------------------------
    seg('concorde','chatelet',AVE_W,'RIVOLI');                 // Concorde → Louvre → Châtelet
    seg('chatelet','bastille',ROAD_W,'RIVOLI E');
    seg('concorde','madeleine',ROAD_W,'ROYALE');
    seg('madeleine','opera',ROAD_W,'CAPUCINES');
    seg('opera','republique',ROAD_W,'GRANDS BOULEVARDS');
    seg('republique','bastille',ROAD_W,'BEAUMARCHAIS');
    seg('republique','nation',ROAD_W,'VOLTAIRE');
    seg('bastille','nation',ROAD_W,'FAUBOURG ST-ANTOINE');
    seg('etoile','trocadero',ROAD_W,'IÉNA');
    seg('trocadero','alma',ROAD_W,'PRÉSIDENT-WILSON');
    seg('alma','concorde',ROAD_W,'COURS LA REINE');
    seg('etoile','ternes',ROAD_W,'TERNES');
    seg('ternes','clichy',ROAD_W,'BATIGNOLLES');
    seg('clichy','pigalle',ROAD_W,'BOULEVARD DE CLICHY');
    seg('pigalle','villette',ROAD_W,'ROCHECHOUART');
    seg('villette','republique',ROAD_W,'MAGENTA');
    seg('pigalle','opera',ROAD_W,'CHAUSSÉE-D\'ANTIN');
    seg('invalides','denfert',ROAD_W,'RASPAIL');
    seg('denfert','italie',ROAD_W,'ARAGO');
    seg('italie','gobelins',ROAD_W,'GOBELINS');
    seg('gobelins','bastille',ROAD_W,'LEDRU-ROLLIN');
    seg('invalides',{x:-470,z:74},ROAD_W,'BOSQUET');
    seg('denfert','gobelins',ROAD_W,'DENFERT');
    seg('bastille','vosges',ROAD_W,'VOSGES');
    seg('vosges','chatelet',ROAD_W,'ST-ANTOINE');
    seg('defense','etoile',AVE_W,'LA DÉFENSE AXIS');           // the Axe Historique, out west
    // Left-Bank spine: Boulevard Saint-Germain is a long shallow arc
    arc(60,-140,300,118*DEG,52*DEG,ROAD_W,'SAINT-GERMAIN');
    // Champ de Mars / École Militaire approach
    seg({x:-398,z:36},{x:-336,z:132},ROAD_W,'CHAMP DE MARS');
    // --- the quais ---------------------------------------------------------
    riverRoad( 1,11,0.06,0.96,ROAD_W,'QUAI RIVE GAUCHE');
    riverRoad(-1,11,0.06,0.96,ROAD_W,'QUAI RIVE DROITE');
    // --- the Périphérique --------------------------------------------------
    arc(-20,20,560,0,Math.PI*2,AVE_W,'PÉRIPHÉRIQUE');

    // --- bridges -----------------------------------------------------------
    //  Each is a deck carried over the channel on piers, with its own collision
    //  parapets, so the crossings are genuinely drivable rather than fords.
    const BRIDGES=[
      {t:0.145,name:'PONT DE BERCY'},      {t:0.245,name:'PONT D\'AUSTERLITZ'},
      {t:0.330,name:'PONT DE SULLY'},      {t:0.470,name:'PONT MARIE'},
      {t:0.545,name:'PONT LOUIS-PHILIPPE'},{t:0.600,name:'PONT NOTRE-DAME'},
      {t:0.660,name:'PONT NEUF'},          {t:0.715,name:'PONT DU CARROUSEL'},
      {t:0.775,name:'PONT DE LA CONCORDE'},{t:0.815,name:'PONT ALEXANDRE III',grand:true},
      {t:0.862,name:'PONT DE L\'ALMA'},    {t:0.910,name:'PONT D\'IÉNA'},
    ];
    const bridgeDecks=[];
    for(const B of BRIDGES){
      const half=seineHalf(B.t), reach=half+26;
      const a=bank(B.t, 1,reach), b=bank(B.t,-1,reach);
      const pts=[];const n=18;
      for(let i=0;i<=n;i++)pts.push({x:lerp(a.x,b.x,i/n),z:lerp(a.z,b.z,i/n)});
      B.a=a;B.b=b;B.half=half;B.pts=pts;
      bridgeDecks.push(B);
      roadPolys.push({pts,w:B.grand?20:ROAD_W,name:B.name,bridge:true});
    }
    /** deck height over the water, and whether (x,z) is on a bridge at all */
    const BRIDGE_Y=4.6;
    function onBridge(x,z){
      for(const B of bridgeDecks){
        const dx=B.b.x-B.a.x, dz=B.b.z-B.a.z, L2=dx*dx+dz*dz;
        let u=((x-B.a.x)*dx+(z-B.a.z)*dz)/L2; if(u<0||u>1)continue;
        const px=B.a.x+dx*u, pz=B.a.z+dz*u;
        if(Math.hypot(x-px,z-pz)<(B.grand?10.5:8))return B;
      }
      return null;
    }
    function groundH(x,z){
      const B=onBridge(x,z);
      if(B)return Math.max(surfaceH(x,z),BRIDGE_Y);
      return surfaceH(x,z);
    }
    // drown-and-respawn anywhere in the channel that isn't a bridge
    function inWater(x,z){return surfaceH(x,z)<-1.4&&!onBridge(x,z);}

    // ======================================================================
    //  6. ROAD SURFACES
    // ======================================================================
    const lampSpots=[], dashMats=[];
    const roadDrivable=(x,z)=>onBridge(x,z)?true:surfaceH(x,z)>1.2;
    {const posArr=[],colArr=[],idxArr=[];
      const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(1,1,1),_up=new THREE.Vector3(0,0,1);
      function addRibbon(pts,width){
        const base=posArr.length/3;
        for(let i=0;i<pts.length;i++){
          const p=pts[i],q0=pts[Math.max(i-1,0)],q=pts[Math.min(i+1,pts.length-1)];
          let dx=q.x-q0.x,dz=q.z-q0.z;const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;
          for(const s of[-0.5,0.5]){const vx=p.x-dz*width*s,vz=p.z+dx*width*s;
            posArr.push(vx,groundH(vx,vz)+LIFT,vz);
            const g=0.062+0.013*rand();colArr.push(g,g*0.99,g*1.04+0.005);}
          if(i>0){const a=base+(i-1)*2,b=a+1,c2=base+i*2,d=c2+1;idxArr.push(a,b,c2,b,d,c2);}
        }
      }
      function decorate(pts,lampEvery){
        let acc=0,lampAcc=20,side=1;
        for(let i=1;i<pts.length;i++){
          const p0=pts[i-1],p1=pts[i],dx=p1.x-p0.x,dz=p1.z-p0.z,L=Math.hypot(dx,dz);acc+=L;lampAcc+=L;
          if(acc>9){acc=0;const y0=groundH(p0.x,p0.z),y1=groundH(p1.x,p1.z);
            _q.setFromUnitVectors(_up,new THREE.Vector3(dx,y1-y0,dz).normalize());
            _m.compose(new THREE.Vector3(p1.x,groundH(p1.x,p1.z)+LIFT+0.03,p1.z),_q,_s);dashMats.push(_m.clone());}
          if(lampAcc>(lampEvery||34)){lampAcc=0;side*=-1;
            lampSpots.push({x:p1.x-dz/L*8.4*side,z:p1.z+dx/L*8.4*side});}
        }
      }
      for(const R of roadPolys){
        let run=[];
        const flush=()=>{if(run.length>2){addRibbon(run,R.w);decorate(run,R.bridge?24:34);}run=[];};
        for(const p of R.pts){if(roadDrivable(p.x,p.z))run.push(p);else flush();}
        flush();
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(posArr,3));
      geo.setAttribute('color',new THREE.Float32BufferAttribute(colArr,3));
      geo.setIndex(idxArr);geo.computeVertexNormals();
      const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.93,envMapIntensity:0.2}));
      m.receiveShadow=true;scene.add(m);}

    // lane dashes + the cast-iron street lamps Paris is named for
    {const g=new THREE.PlaneGeometry(0.9,4.4);g.rotateX(-Math.PI/2);
      const inst=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:0xd8d2c2,emissive:0x2a2418,roughness:0.7}),dashMats.length);
      dashMats.forEach((m,i)=>inst.setMatrixAt(i,m));scene.add(inst);}
    {const postG=new THREE.CylinderGeometry(0.17,0.28,7.4,6), headG=new THREE.SphereGeometry(0.62,8,7);
      const postM=new THREE.MeshStandardMaterial({color:0x1e2226,roughness:0.55,metalness:0.5});
      const headM=new THREE.MeshBasicMaterial({color:0xffeaba});
      const pi=new THREE.InstancedMesh(postG,postM,lampSpots.length);
      const hi=new THREE.InstancedMesh(headG,headM,lampSpots.length);
      const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1);
      lampSpots.forEach((p,i)=>{const y=groundH(p.x,p.z);
        m.compose(new THREE.Vector3(p.x,y+3.7,p.z),q,s);pi.setMatrixAt(i,m);
        m.compose(new THREE.Vector3(p.x,y+7.7,p.z),q,s);hi.setMatrixAt(i,m);});
      pi.castShadow=true;scene.add(pi);scene.add(hi);}

    // ======================================================================
    //  6b. LANDMARK TABLE — positions first, so the street walls keep clear
    // ======================================================================
    //  Anything on the river is placed with bank(t, side, offset) rather than
    //  absolute coordinates: side +1 is the Rive Gauche (south), -1 the Rive
    //  Droite (north). That's what guarantees the Eiffel Tower and the Palais de
    //  Chaillot end up genuinely facing each other across the water.
    /** Snap an approximate anchor onto the river and step `off` onto one bank.
     *  Writing a rough position and letting the river place it is the only way
     *  that survives retuning the centreline — hand-picked t values do not. */
    function B_(ax,az,side,off){
      const t=seineNear(ax,az).t, p=bank(t,side,off);
      return {x:p.x, z:p.z, t};
    }
    const LM=[
      {k:'etoile',    ...PL.etoile,               r:44, name:'ARC DE TRIOMPHE',            s:'ARC'},
      {k:'champs',    x:-262,z:-56,               r:18, name:'LES CHAMPS-ÉLYSÉES',         s:'CE'},
      {k:'grandpalais',...B_(-292, 56,-1,50),     r:34, name:'GRAND PALAIS',               s:'GP'},
      {k:'concorde',  ...PL.concorde,             r:34, name:'PLACE DE LA CONCORDE',       s:'CONC'},
      {k:'madeleine', ...PL.madeleine,            r:22, name:'LA MADELEINE',               s:'MAD'},
      {k:'opera',     ...PL.opera,                r:26, name:'OPÉRA GARNIER',              s:'OPÉRA'},
      {k:'louvre',    ...B_( -78,118,-1,74),      r:62, name:'LE LOUVRE · LA PYRAMIDE',    s:'LOUVRE'},
      {k:'pompidou',  x:72, z:26,                 r:24, name:'CENTRE POMPIDOU',            s:'CP'},
      {k:'hoteldeville',...B_(  34,140,-1,44),    r:26, name:'HÔTEL DE VILLE',             s:'HDV'},
      {k:'notredame', ...B_(  40,142, 1, 1),      r:32, name:'NOTRE-DAME DE PARIS',        s:'ND'},
      {k:'conciergerie',...B_( -14,130,-1, 7),    r:22, name:'LA CONCIERGERIE',            s:'CONC.'},
      {k:'bastille',  ...PL.bastille,             r:26, name:'PLACE DE LA BASTILLE',       s:'BAST'},
      {k:'nation',    ...PL.nation,               r:26, name:'PLACE DE LA NATION',         s:'NAT'},
      {k:'republique',...PL.republique,           r:26, name:'PLACE DE LA RÉPUBLIQUE',     s:'RÉP'},
      {k:'garedunord',x:22, z:-236,               r:34, name:'GARE DU NORD',               s:'GDN'},
      {k:'moulinrouge',x:-92,z:-300,              r:18, name:'MOULIN ROUGE',               s:'MR'},
      {k:'sacrecoeur',x:-70, z:-352,              r:44, name:'SACRÉ-CŒUR · MONTMARTRE',    s:'SC'},
      {k:'orsay',     ...B_(-152,100, 1,40),      r:28, name:"MUSÉE D'ORSAY",              s:'ORSAY'},
      {k:'invalides', ...PL.invalides,            r:40, name:'LES INVALIDES',              s:'INV'},
      {k:'eiffel',    ...B_(-372,-24, 1,62),      r:64, name:'LA TOUR EIFFEL',             s:'EIFFEL'},
      {k:'trocadero', ...B_(-372,-24,-1,46),      r:36, name:'PALAIS DE CHAILLOT',         s:'TROC'},
      {k:'ecolemil',  ...B_(-372,-24, 1,152),     r:34, name:'ÉCOLE MILITAIRE',            s:'EM'},
      {k:'stgermain', ...B_( -62,124, 1,74),      r:20, name:'SAINT-GERMAIN-DES-PRÉS',     s:'SG'},
      {k:'luxembourg',x:4,  z:212,                r:48, name:'JARDIN DU LUXEMBOURG',       s:'LUX'},
      {k:'pantheon',  x:76, z:226,                r:28, name:'LE PANTHÉON',                s:'PANT'},
      {k:'montparnasse',x:-44,z:288,              r:34, name:'TOUR MONTPARNASSE',          s:'TM'},
      {k:'defense',   ...PL.defense,              r:54, name:'LA GRANDE ARCHE',            s:'ARCHE'},
      {k:'perelachaise',x:330,z:-118,             r:44, name:'PÈRE-LACHAISE',              s:'PL'},
    ];
    const SCENERY=[
      {k:'carrousel', ...B_(-114,110,-1,62), r:16},
      {k:'palaisroyal',x:-14,z:6,            r:18},
      {k:'vosges',    ...PL.vosges,          r:20},
      {k:'tuileries', ...B_(-160, 96,-1,56), r:40},
      {k:'champdemars',...B_(-372,-24,1,112),r:38},
    ];
    const CLEAR=[...LM.filter(o=>o.r>0),...SCENERY].map(o=>({x:o.x,z:o.z,r:o.r}));
    const LMX={};for(const o of LM)LMX[o.k]=o;for(const o of SCENERY)LMX[o.k]=o;
    // Half the landmarks are positioned off the river parameter rather than by
    // literal coordinates, so #debug prints where they actually landed.
    if(/debug/.test(location.hash)){
      console.log('PARIS debug — landmarks '+JSON.stringify(
        LM.map(o=>[o.k,Math.round(o.x),Math.round(o.z)])));
      // A place or a landmark standing in the Seine is the failure mode this
      // layout invites, so it is checked rather than eyeballed.
      const wet=[];
      for(const o of[...LM,...SCENERY])if(surfaceH(o.x,o.z)<3.2)wet.push(o.k+' @'+Math.round(surfaceH(o.x,o.z)));
      for(const k in PL)if(surfaceH(PL[k].x,PL[k].z)<3.2)wet.push('place:'+k+' @'+Math.round(surfaceH(PL[k].x,PL[k].z)));
      console.log('PARIS debug — in the water: '+(wet.length?wet.join(', '):'none'));
      // Two landmarks whose keep-outs overlap will fight for the same ground and
      // the HUD will name the wrong one — worth catching numerically.
      const clash=[];
      for(let i=0;i<LM.length;i++)for(let j=i+1;j<LM.length;j++){
        const a=LM[i],b=LM[j];if(!a.r||!b.r)continue;
        const d=Math.hypot(a.x-b.x,a.z-b.z);
        if(d<(a.r+b.r)*0.78)clash.push(`${a.k}~${b.k} ${Math.round(d)}<${Math.round(a.r+b.r)}`);
      }
      console.log('PARIS debug — landmark clashes: '+(clash.length?clash.join(', '):'none'));
    }

    // ======================================================================
    //  7. ROAD PROXIMITY FIELD — what makes the street walls possible
    // ======================================================================
    //  A Paris block is a continuous wall of facades around a hidden courtyard.
    //  Rather than model blocks, buildings are placed in the BAND just behind
    //  each kerb: near enough to the road to form the wall, and nothing deeper,
    //  so the courtyards stay empty on their own.
    const RCELL=26, roadHash=new Map();
    (function hashRoads(){
      for(const R of roadPolys){
        for(let i=1;i<R.pts.length;i++){
          const a=R.pts[i-1],b=R.pts[i];
          const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);
          for(let gx=Math.floor(x0/RCELL);gx<=Math.floor(x1/RCELL);gx++)
            for(let gz=Math.floor(z0/RCELL);gz<=Math.floor(z1/RCELL);gz++){
              const k=gx+','+gz;let l=roadHash.get(k);if(!l)roadHash.set(k,l=[]);l.push({a,b,w:R.w});
            }
        }
      }
    })();
    /** distance to the nearest kerb, plus the road's direction there */
    function nearRoad(x,z){
      let bd=1e9,bt=null,bw=ROAD_W,bpx=x,bpz=z;
      const gx=Math.floor(x/RCELL),gz=Math.floor(z/RCELL);
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
        const l=roadHash.get((gx+a)+','+(gz+b));if(!l)continue;
        for(const s of l){
          const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,L2=dx*dx+dz*dz||1;
          let u=((x-s.a.x)*dx+(z-s.a.z)*dz)/L2;u=u<0?0:u>1?1:u;
          const px=s.a.x+dx*u,pz=s.a.z+dz*u,d=Math.hypot(x-px,z-pz);
          if(d<bd){bd=d;bt={x:dx,z:dz,L:Math.sqrt(L2)};bw=s.w;bpx=px;bpz=pz;}
        }
      }
      return {d:bd,tan:bt,w:bw,px:bpx,pz:bpz};
    }
    // Dev aid: with #debug, expose the road query so a headless harness can park
    // the camera on an actual carriageway. With ~2,000 street-wall blocks, picking
    // viewpoints by eye lands you inside a building more often than not.
    if(/debug/.test(location.hash))
      window.__paris={nearRoad,surfaceH,onBridge:(x,z)=>!!onBridge(x,z)};

    // ======================================================================
    //  8. HAUSSMANN STREET WALLS
    // ======================================================================
    //  Facade texture: the whole point is a consistent cornice line, so the
    //  storey bands are drawn at fixed heights and only the bay rhythm and the
    //  balcony floors vary. Balconies land on the 2nd and 5th floors — the
    //  "étages nobles" — which is the single most recognisable Paris detail.
    function haussmannTex(kind){
      const H=512,W=128,[c,g]=cv(W,H),[e,ge]=cv(W,H);
      const stone=kind==='faubourg'?'#c3b49a':kind==='belleEpoque'?'#ddd0b6':'#d6c9ad';
      g.fillStyle=stone;g.fillRect(0,0,W,H);ge.fillStyle='#000';ge.fillRect(0,0,W,H);
      const floors=7, fh=H/floors, bays=kind==='faubourg'?3:4, bw=W/bays;
      for(let f=0;f<floors;f++){
        const y=H-(f+1)*fh;
        // ground floor: shopfronts, with the mezzanine above it
        if(f===0){
          for(let b=0;b<bays;b++){
            const x=b*bw+2.5;
            g.fillStyle='#4a4038';g.fillRect(x,y+fh*0.30,bw-5,fh*0.62);
            if(rand()<0.62){ge.fillStyle=pick(['#ffe0a8','#ffd08c','#ffeccb']);ge.fillRect(x+1.5,y+fh*0.34,bw-8,fh*0.5);}
            g.fillStyle=pick(['#6d2a2a','#22402f','#2a3550','#5a4626']);   // the painted shop fascia
            g.fillRect(x-1,y+fh*0.14,bw-3,fh*0.16);
          }
        }else{
          for(let b=0;b<bays;b++){
            const x=b*bw+bw*0.24;
            const wh=fh*(f===floors-1?0.44:0.60), ww=bw*0.52;
            g.fillStyle='#3a3a3c';g.fillRect(x,y+fh*0.20,ww,wh);           // tall shuttered window
            if(rand()<0.34){ge.fillStyle=pick(['#ffe6b4','#ffd79a','#fff1d2']);ge.fillRect(x+1,y+fh*0.22,ww-2,wh-3);}
            g.fillStyle='#9c8f76';g.fillRect(x-1.2,y+fh*0.17,ww+2.4,2);     // stone lintel over the window
            // wrought-iron balcony rail on the étages nobles
            if(f===1||f===4){
              g.fillStyle='#1b1d1f';g.fillRect(b*bw+1,y+fh*0.72,bw-2,fh*0.16);
              g.fillStyle='#2a2d30';
              for(let k=0;k<7;k++)g.fillRect(b*bw+2+k*(bw-4)/7,y+fh*0.70,1.1,fh*0.20);
            }
          }
          // the string course between storeys
          g.fillStyle='rgba(255,255,255,0.10)';g.fillRect(0,y+fh*0.94,W,2);
          g.fillStyle='rgba(0,0,0,0.10)';g.fillRect(0,y+fh*0.965,W,1.4);
        }
      }
      return {map:tex(c),em:tex(e)};
    }

    // La Défense and the Montparnasse slab are the two places Paris let towers
    // happen, and they are deliberately NOT limestone — that contrast is the
    // whole reason both are controversial, so they get their own curtain wall.
    function modernTex(){
      const H=512,W=128,[c,g]=cv(W,H),[e,ge]=cv(W,H);
      g.fillStyle='#5c6470';g.fillRect(0,0,W,H);ge.fillStyle='#000';ge.fillRect(0,0,W,H);
      const rows=34,cols=8,rh=H/rows,cw=W/cols;
      for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
        const x=k*cw+1.4,y=r*rh+1.2,w=cw-2.8,h=rh-2.2;
        g.fillStyle=r%8===7?'#767d88':'#2b3440';g.fillRect(x,y,w,h);
        if(rand()<0.30){ge.fillStyle=pick(['#dfeaff','#cfe0f6','#fff0cc','#bcd4f2']);ge.fillRect(x,y,w,h);}
      }
      return {map:tex(c),em:tex(e)};
    }
    const FACADES={
      haussmann:  haussmannTex('haussmann'),
      belleEpoque:haussmannTex('belleEpoque'),
      faubourg:   haussmannTex('faubourg'),
      modern:     modernTex(),
    };
    function facadeMats(f,zincRoof){
      const side=new THREE.MeshStandardMaterial({map:f.map,emissiveMap:f.em,emissive:0xffffff,
        emissiveIntensity:0.85,roughness:0.82,metalness:0.04,envMapIntensity:0.26});
      const top=new THREE.MeshStandardMaterial({color:zincRoof?0x55585c:0x6a625a,roughness:0.7,metalness:0.25});
      return[side,side,top,top,side,side];
    }

    // typology by where you are — Paris changes character by arrondissement
    function typology(x,z,h){
      if(x<-548&&z<-110)return'defense';                       // the office towers, outside the walls
      if(Math.hypot(x+40,z-286)<52)return'tower';              // Tour Montparnasse's slab neighbours
      if(h>34)return'butte';                                   // Montmartre's low village houses
      if(Math.hypot(x-140,z-46)<118||Math.hypot(x-60,z-190)<110)return'faubourg';  // Marais, Latin Quarter
      if(Math.abs(x+20)>430||Math.abs(z-20)>360)return'faubourg';                  // the outer arrondissements
      return'haussmann';
    }

    const TYPO={
      haussmann:  {fac:'haussmann',  storeys:[6,6], bay:[9,15], depth:[16,22], mansard:true,  zinc:true },
      belleEpoque:{fac:'belleEpoque',storeys:[6,7], bay:[10,16],depth:[17,23], mansard:true,  zinc:true },
      faubourg:   {fac:'faubourg',   storeys:[4,5], bay:[7,12], depth:[12,18], mansard:true,  zinc:true },
      butte:      {fac:'faubourg',   storeys:[3,4], bay:[6,10], depth:[10,15], mansard:true,  zinc:true },
      tower:      {fac:'modern',     storeys:[9,14],bay:[14,20],depth:[18,26], mansard:false, zinc:false},
      defense:    {fac:'modern',     storeys:[18,34],bay:[20,30],depth:[20,32],mansard:false, zinc:false},
    };
    const STOREY=4.2;                                          // one Paris storey, in world units

    const mansards=[], chimneys=[];
    {const parts={};for(const k in FACADES)parts[k]=[];
      let placed=0;
      // Walk a fine lattice; keep only what falls in the band just behind a kerb.
      for(let x=-660;x<640;x+=7)for(let z=-540;z<580;z+=7){
        const bx=x+rr(-2.2,2.2), bz=z+rr(-2.2,2.2);
        const h0=surfaceH(bx,bz); if(h0<3.2)continue;          // not in the river
        if(Math.hypot(bx+20,bz-20)>552)continue;               // inside the Périphérique
        const R=nearRoad(bx,bz);
        const kerb=R.w/2+2.2;
        if(R.d<kerb||R.d>kerb+9)continue;                      // THE street-wall band
        let skip=false;for(const c of CLEAR)if(Math.hypot(bx-c.x,bz-c.z)<c.r){skip=true;break;}
        if(skip)continue;
        const ty=typology(bx,bz,h0), T=TYPO[ty];
        // face the building square to the street it stands on
        const rot=Math.atan2(R.tan.x,R.tan.z)+Math.PI/2;
        const bayW=rr(T.bay[0],T.bay[1]), depth=rr(T.depth[0],T.depth[1]);
        const st=Math.round(rr(T.storeys[0],T.storeys[1]+0.49));
        const H=st*STOREY;
        // Push the body back so its FRONT sits on the building line rather than
        // its centre — that's what makes the facades line up into a wall. The
        // outward normal is simply the direction from the kerb to this point.
        const nx=(bx-R.px)/(R.d||1), nz=(bz-R.pz)/(R.d||1);
        const cx=bx+nx*(depth/2-1.4), cz=bz+nz*(depth/2-1.4);
        parts[T.fac].push({x:cx,z:cz,w:bayW,d:depth,h:H,rot});
        addBox(cx,cz,bayW/2+0.5,depth/2+0.5,H);
        if(bldgPts.length<620&&rand()<0.4)bldgPts.push({x:cx,z:cz});
        if(T.mansard)mansards.push({x:cx,z:cz,y:h0+H,w:bayW,d:depth,rot,st});
        if(rand()<0.7)chimneys.push({x:cx,z:cz,y:h0+H,w:bayW,d:depth,rot});
        placed++;
      }
      for(const k in parts){
        const list=parts[k];if(!list.length)continue;
        const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
          facadeMats(FACADES[k],true),list.length);
        inst.castShadow=true;inst.receiveShadow=true;
        const m=new THREE.Matrix4(),q=new THREE.Quaternion(),eu=new THREE.Euler();
        // Only a shallow sink here: the facade texture's bottom band IS the
        // shopfront row, so burying the box deeply (as a skyline city can) would
        // hide the single most street-level-legible part of a Paris block.
        list.forEach((b,i)=>{eu.set(0,b.rot,0);q.setFromEuler(eu);
          const y0=surfaceH(b.x,b.z);
          m.compose(new THREE.Vector3(b.x,y0+(b.h-1.2)/2,b.z),q,new THREE.Vector3(b.w,b.h+1.2,b.d));
          inst.setMatrixAt(i,m);});
        scene.add(inst);
      }
      if(/debug/.test(location.hash))console.log('PARIS debug — street-wall buildings '+placed);
    }

    // the zinc mansard roofs and the chimney stacks — the Paris roofscape
    {const zinc=new THREE.MeshStandardMaterial({color:0x5c6064,roughness:0.52,metalness:0.42,envMapIntensity:0.5});
      const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),zinc,mansards.length);
      const m=new THREE.Matrix4(),q=new THREE.Quaternion(),eu=new THREE.Euler();
      mansards.forEach((r,i)=>{eu.set(0,r.rot,0);q.setFromEuler(eu);
        m.compose(new THREE.Vector3(r.x,r.y+1.7,r.z),q,new THREE.Vector3(r.w*0.94,3.4,r.d*0.86));
        inst.setMatrixAt(i,m);});
      inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);}
    {const pot=new THREE.MeshStandardMaterial({color:0x8a6b58,roughness:0.95});
      const inst=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32,0.36,2.2,5),pot,chimneys.length*3);
      const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1);let i=0;
      for(const c of chimneys){
        const nx=Math.cos(c.rot),nz=-Math.sin(c.rot);
        for(let k=-1;k<=1;k++){
          m.compose(new THREE.Vector3(c.x+nx*k*c.w*0.26,c.y+4.4,c.z+nz*k*c.w*0.26),q,s);
          inst.setMatrixAt(i++,m);
        }
      }
      inst.count=i;inst.castShadow=true;scene.add(inst);}

    // ======================================================================
    //  9. LANDMARKS
    // ======================================================================
    const LG=new THREE.Group();scene.add(LG);
    const anim=[];
    const add=m=>{LG.add(m);return m;};
    const G=(x,z)=>surfaceH(x,z);
    const M=o=>new THREE.MeshStandardMaterial(o);
    const limestone =c=>M({color:c||0xe0d5bb,roughness:0.86});
    const paleStone =M({color:0xeee6d2,roughness:0.8});
    const zincM     =M({color:0x5c6064,roughness:0.5,metalness:0.45,envMapIntensity:0.6});
    const ironM     =M({color:0x3a3226,roughness:0.62,metalness:0.55,envMapIntensity:0.5});
    const goldM     =M({color:0xd8a93a,roughness:0.28,metalness:0.9,envMapIntensity:1.2,emissive:0x3a2807,emissiveIntensity:0.55});
    const copperM   =M({color:0x4e8f7a,roughness:0.66,metalness:0.35});
    const glassM    =M({color:0xa8c4d8,roughness:0.12,metalness:0.5,envMapIntensity:1.1,
                        transparent:true,opacity:0.55,emissive:0x24303c,emissiveIntensity:0.5});
    const slateM    =M({color:0x3c4046,roughness:0.72});
    function box(w,h,d,mat,x,y,z,ry){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      m.position.set(x,y,z);if(ry)m.rotation.y=ry;m.castShadow=true;m.receiveShadow=true;return add(m);}
    function cyl(rt,rb,h,seg,mat,x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
      m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return add(m);}
    function cone(r,h,seg,mat,x,y,z){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,seg),mat);
      m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return add(m);}
    function dome(r,mat,x,y,z,squash){const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,14,0,Math.PI*2,0,Math.PI/2),mat);
      m.position.set(x,y,z);m.scale.y=squash||1;m.castShadow=true;m.receiveShadow=true;return add(m);}
    function colonnade(x,z,y,n,radius,ch,mat,cr){
      for(let i=0;i<n;i++){const a=i/n*Math.PI*2;
        cyl(cr||0.85,cr||0.85,ch,8,mat,x+Math.cos(a)*radius,y+ch/2,z+Math.sin(a)*radius);}
    }
    function colRow(x,z,y,n,dx,dz,ch,mat,cr){
      for(let i=0;i<n;i++)cyl(cr||0.9,cr||0.9,ch,8,mat,x+dx*(i-(n-1)/2),y+ch/2,z+dz*(i-(n-1)/2));
    }
    function beacon(x,y,z,r,col){const b=new THREE.Mesh(new THREE.SphereGeometry(r||1.2,8,8),
      new THREE.MeshBasicMaterial({color:col||0xffe9a8}));b.position.set(x,y,z);add(b);registerBeacon(b);}
    // bilingual street plaque, same idea as the HK map — a landmark is only
    // named within 95 units, and several of these read from much further out
    function plaqueTex(fr,en){
      const[c,g]=cv(512,150);
      g.fillStyle='rgba(16,14,12,0.9)';g.fillRect(0,0,512,150);
      g.strokeStyle='#e8cf9a';g.lineWidth=5;g.strokeRect(5,5,502,140);
      g.textAlign='center';g.textBaseline='middle';
      g.fillStyle='#f4e4c2';g.font='600 46px Georgia,serif';g.fillText(fr,256,58);
      g.fillStyle='#d8c39c';g.font='400 26px -apple-system,Helvetica,Arial,sans-serif';g.fillText(en,256,110);
      return tex(c);
    }
    function plaque(x,z,y,ry,fr,en,w){
      const t=plaqueTex(fr,en);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*150/512),
        M({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:0.85,transparent:true,side:THREE.DoubleSide}));
      m.position.set(x,y+w*0.30,z);m.rotation.y=ry;add(m);
      // two posts, set out along the plaque's own face rather than at its centre
      for(const s of[-1,1])cyl(0.16,0.2,w*0.30,6,ironM,
        x+Math.cos(ry)*s*w*0.42, y+w*0.15, z-Math.sin(ry)*s*w*0.42);
      return m;
    }

    const BUILD={
      // ---- LA TOUR EIFFEL --------------------------------------------------
      //  Four splayed lattice legs meeting at the first platform, a second
      //  platform, then the tapering upper tower and the spire. You drive
      //  underneath it: only the four piers carry collision.
      eiffel(o){
        const y=G(o.x,o.z), H=196, SPREAD=27;
        const P1=0.20*H, P2=0.40*H;                       // the two platforms
        const legM=M({color:0x7a5a3e,roughness:0.62,metalness:0.5,envMapIntensity:0.55});
        // profile of the tower's silhouette — the famous exponential flare
        const halfAt=t=>SPREAD*Math.pow(1-t,1.85)+1.5;
        // each leg is a stack of short lattice segments following that profile
        for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){
          const N=26;
          for(let i=0;i<N;i++){
            const t0=i/N*0.62, t1=(i+1)/N*0.62;
            const h0=halfAt(t0),h1=halfAt(t1);
            const x0=o.x+sx*h0, z0=o.z+sz*h0, x1=o.x+sx*h1, z1=o.z+sz*h1;
            const y0=y+t0*H, y1=y+t1*H;
            const mid=new THREE.Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
            const dir=new THREE.Vector3(x1-x0,y1-y0,z1-z0);
            const len=dir.length();
            const m=new THREE.Mesh(new THREE.BoxGeometry(2.3,len,2.3),legM);
            m.position.copy(mid);
            m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
            m.castShadow=true;add(m);
            // the cross-bracing that makes it read as lattice and not as a pole
            if(i%2===0){
              const br=new THREE.Mesh(new THREE.BoxGeometry(0.55,len*1.5,0.55),legM);
              br.position.copy(mid);br.rotation.set(0,0,0.5);add(br);
            }
          }
          // pier + arch springing at the base
          cyl(3.4,4.6,5,8,limestone(0xbfae90),o.x+sx*SPREAD,y+2.5,o.z+sz*SPREAD);
          addBox(o.x+sx*SPREAD,o.z+sz*SPREAD,5,5,10);
        }
        // the great arches between the legs, at first-platform level
        for(const[ax,az,rot]of[[0,-SPREAD,0],[0,SPREAD,0],[-SPREAD,0,Math.PI/2],[SPREAD,0,Math.PI/2]]){
          const arch=new THREE.Mesh(new THREE.TorusGeometry(SPREAD*0.82,1.5,8,20,Math.PI),legM);
          arch.position.set(o.x+ax,y+P1*0.42,o.z+az);arch.rotation.y=rot;add(arch);
        }
        // platforms
        for(const[py,ph,pw]of[[P1,2.6,halfAt(0.20)*2+9],[P2,2.2,halfAt(0.40)*2+6]]){
          box(pw,ph,pw,legM,o.x,y+py,o.z);
          const rail=new THREE.Mesh(new THREE.BoxGeometry(pw+0.6,1.5,pw+0.6),
            M({color:0x6b4f36,roughness:0.7,metalness:0.4,transparent:true,opacity:0.72}));
          rail.position.set(o.x,y+py+2,o.z);add(rail);
        }
        // upper tower: a tapering stack above the second platform
        {const N=22;
          for(let i=0;i<N;i++){
            const t0=0.40+i/N*0.52, t1=0.40+(i+1)/N*0.52;
            const w0=halfAt(t0)*2, w1=halfAt(t1)*2;
            const m=new THREE.Mesh(new THREE.CylinderGeometry(w1*0.5,w0*0.5,(t1-t0)*H,4),legM);
            m.position.set(o.x,y+(t0+t1)/2*H,o.z);m.rotation.y=Math.PI/4;m.castShadow=true;add(m);
          }
        }
        // the lantern and the spire
        box(7,5,7,limestone(0xd8c9a8),o.x,y+0.93*H,o.z);
        cyl(0.5,1.6,H*0.055,8,legM,o.x,y+0.96*H,o.z);
        cyl(0.16,0.4,9,6,legM,o.x,y+H+3,o.z);
        beacon(o.x,y+H+8.5,o.z,1.5,0xfff0c0);
        // the golden-hour floodlighting the tower is famous for
        for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]])
          beacon(o.x+sx*(SPREAD+3),y+2,o.z+sz*(SPREAD+3),0.9,0xffd684);
        plaque(o.x,o.z+SPREAD+16,y,0,'LA TOUR EIFFEL','1889 · GUSTAVE EIFFEL',22);
      },

      // ---- ARC DE TRIOMPHE, at the centre of the Étoile ---------------------
      etoile(o){
        const y=G(o.x,o.z), W=30, D=17, H=27;
        // the roundabout island it stands on
        const isle=new THREE.Mesh(new THREE.CylinderGeometry(30,31,1.2,40),M({color:0x53504a,roughness:1}));
        isle.position.set(o.x,y+0.6,o.z);isle.receiveShadow=true;add(isle);
        const st=limestone(0xe6dcc2);
        // piers, leaving the great vault open through the middle
        for(const sx of[-1,1])box(W*0.29,H,D,st,o.x+sx*W*0.355,y+H/2,o.z);
        for(const sz of[-1,1])box(W*0.29,H*0.62,D*0.30,st,o.x,y+H*0.31,o.z+sz*D*0.35);
        // the barrel vault
        {const v=new THREE.Mesh(new THREE.CylinderGeometry(W*0.21,W*0.21,D+0.3,20,1,true,0,Math.PI),st);
          v.rotation.set(Math.PI/2,0,0);v.position.set(o.x,y+H*0.60,o.z);add(v);}
        box(W,H*0.30,D,st,o.x,y+H*0.85,o.z);                    // attic storey
        box(W+1.6,1.6,D+1.6,st,o.x,y+H+0.8,o.z);                // cornice
        // the sculpted reliefs, suggested as recessed panels
        for(const sx of[-1,1])for(const sz of[-1,1])
          box(W*0.19,H*0.30,0.5,M({color:0xcbbf9f,roughness:0.9}),
            o.x+sx*W*0.355,y+H*0.44,o.z+sz*(D/2+0.2));
        for(let i=0;i<6;i++)box(W*0.9/6-0.5,2.6,0.6,M({color:0xd2c6a6,roughness:0.9}),
          o.x-W*0.45+W*0.9/6*(i+0.5),y+H*0.80,o.z+D/2+0.3);
        addBox(o.x,o.z,W/2+1,D/2+1,H);
        plaque(o.x,o.z+D/2+13,y,0,'ARC DE TRIOMPHE',"PLACE CHARLES-DE-GAULLE · L'ÉTOILE",24);
      },

      // ---- NOTRE-DAME DE PARIS, on the Île de la Cité -----------------------
      notredame(o){
        const y=G(o.x,o.z);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);          // aligned with the island
        const st=limestone(0xded2b6);
        const cos=Math.cos(ry),sin=Math.sin(ry);
        const P=(u,v)=>({x:o.x+u*cos+v*sin, z:o.z-u*sin+v*cos});  // local → world
        // nave and choir, running the length of the island
        {const p=P(0,0);box(17,20,52,st,p.x,y+10,p.z,ry);}
        {const p=P(0,-4);box(27,13,34,st,p.x,y+6.5,p.z,ry);}     // the side aisles
        // the two west towers
        for(const u of[-6.6,6.6]){const p=P(u,-27);
          box(9.6,34,9.6,st,p.x,y+17,p.z,ry);
          box(10.6,1.4,10.6,st,p.x,y+34.4,p.z,ry);
          for(let i=0;i<2;i++){const q=P(u,-27);
            box(1.1,7,1.1,st,q.x+Math.cos(ry+i*Math.PI/2)*3.6,y+38,q.z-Math.sin(ry+i*Math.PI/2)*3.6,ry);}
        }
        // the rose window, facing west down the island
        {const p=P(0,-27.2);
          const rose=new THREE.Mesh(new THREE.CircleGeometry(4.6,24),
            M({color:0x2a3550,emissive:0xffcf8a,emissiveIntensity:1.5,side:THREE.DoubleSide}));
          rose.position.set(p.x,y+22,p.z);rose.rotation.y=ry+Math.PI/2;add(rose);
          box(20,4,1.2,st,p.x,y+13,p.z,ry);                      // the gallery of kings
        }
        // flying buttresses down the apse — the detail that says Gothic
        for(let i=0;i<6;i++)for(const s of[-1,1]){
          const p=P(s*12.5,-8+i*7);
          const b=new THREE.Mesh(new THREE.BoxGeometry(9,1.5,1.4),st);
          b.position.set(p.x,y+15.5,p.z);b.rotation.set(0,ry,s*0.42);b.castShadow=true;add(b);
          const q=P(s*16.5,-8+i*7);cyl(1.1,1.4,13,6,st,q.x,y+6.5,q.z);
        }
        // the spire over the crossing
        {const p=P(0,2);
          cone(3.4,17,8,slateM,p.x,y+28,p.z);
          cyl(0.14,0.3,5,5,goldM,p.x,y+39,p.z);
          box(11,7,11,slateM,p.x,y+22.5,p.z,ry);
        }
        addBox(o.x,o.z,16,30,34);
        {const p=P(0,-34);plaque(p.x,p.z,y,ry+Math.PI,'NOTRE-DAME DE PARIS','ÎLE DE LA CITÉ · 1163',22);}
      },

      // ---- SACRÉ-CŒUR, on the Montmartre butte ------------------------------
      sacrecoeur(o){
        const y=G(o.x,o.z);
        const white=M({color:0xf2ece0,roughness:0.74});
        box(40,15,30,white,o.x,y+7.5,o.z);                       // the body
        // the great central dome on its drum, plus the four lesser domes
        cyl(9,9.6,13,20,white,o.x,y+21,o.z);
        colonnade(o.x,o.z,y+15,16,10.6,10,white,0.6);
        dome(9,white,o.x,y+27.5,o.z,1.30);
        cyl(1.1,1.6,5,10,white,o.x,y+39,o.z);
        beacon(o.x,y+43,o.z,1.1,0xfff2cc);
        for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){
          const dx=o.x+sx*14, dz=o.z+sz*10.5;
          cyl(4.2,4.6,8,14,white,dx,y+19,dz);
          dome(4.2,white,dx,y+23,dz,1.22);
          cyl(0.5,0.8,2.6,8,white,dx,y+28,dz);
        }
        // the campanile behind
        {const bx=o.x+24,bz=o.z+2;box(7,40,7,white,bx,y+20,bz);dome(3.6,white,bx,y+40,bz,0.9);}
        // the terrace and the long stair down the butte — the classic approach
        box(52,3,10,white,o.x,y+1.5,o.z-19);
        for(let i=0;i<22;i++)box(30-i*0.35,1.1,2.6,M({color:0xd9d2c4,roughness:0.95}),
          o.x,y-0.3-i*1.35,o.z-22-i*2.6);
        addBox(o.x,o.z,22,17,42);
        plaque(o.x,o.z-27,y,Math.PI,'SACRÉ-CŒUR','BASILIQUE · MONTMARTRE',24);
      },

      // ---- LE LOUVRE + LA PYRAMIDE -----------------------------------------
      louvre(o){
        const y=G(o.x,o.z), st=limestone(0xdcd0b4);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        const cos=Math.cos(ry),sin=Math.sin(ry);
        const P=(u,v)=>({x:o.x+u*cos+v*sin, z:o.z-u*sin+v*cos});
        // three wings around an open cour — the U that the pyramid sits in
        const wing=(u,v,w,d)=>{const p=P(u,v);
          box(w,19,d,st,p.x,y+9.5,p.z,ry);
          box(w+1.4,2.2,d+1.4,st,p.x,y+19.5,p.z,ry);             // cornice
          box(w*0.98,4.4,d*0.98,slateM,p.x,y+22.8,p.z,ry);       // mansard
          addBox(p.x,p.z,Math.max(w,d)/2,Math.min(w,d)/2+2,24);
        };
        wing(0,-34,86,16);                                       // the north wing
        wing(0, 34,86,16);                                       // the south wing, along the river
        wing(-46,0,16,68);                                       // the west range
        // pavilions at the corners, with their steeper roofs
        for(const[u,v]of[[-46,-34],[-46,34],[40,-34],[40,34]]){const p=P(u,v);
          box(19,23,19,st,p.x,y+11.5,p.z,ry);
          const r=new THREE.Mesh(new THREE.ConeGeometry(13.5,11,4),slateM);
          r.rotation.y=ry+Math.PI/4;r.position.set(p.x,y+28.5,p.z);r.castShadow=true;add(r);
        }
        // the pyramid, in the middle of the cour
        {const p=P(0,0);
          const pyr=new THREE.Mesh(new THREE.ConeGeometry(15,17,4),glassM);
          pyr.rotation.y=ry+Math.PI/4;pyr.position.set(p.x,y+8.5,p.z);add(pyr);
          const edge=new THREE.Mesh(new THREE.ConeGeometry(15.1,17.1,4,1,true),
            M({color:0x6f6a5e,roughness:0.5,metalness:0.6,wireframe:true}));
          edge.rotation.y=ry+Math.PI/4;edge.position.set(p.x,y+8.5,p.z);add(edge);
          beacon(p.x,y+18.5,p.z,0.8,0xffe6b0);
          for(const[du,dv]of[[-24,0],[24,0],[0,-24],[0,24]]){const q=P(du,dv);
            const s=new THREE.Mesh(new THREE.ConeGeometry(4,4.6,4),glassM);
            s.rotation.y=ry+Math.PI/4;s.position.set(q.x,y+2.3,q.z);add(s);}
          // the basins around it
          for(const[du,dv]of[[-26,-14],[26,-14],[-26,14],[26,14]]){const q=P(du,dv);
            const b=new THREE.Mesh(new THREE.BoxGeometry(16,0.7,9),
              M({color:0x4a6b78,roughness:0.16,metalness:0.4,envMapIntensity:1.1}));
            b.position.set(q.x,y+0.5,q.z);b.rotation.y=ry;add(b);}
        }
        {const p=P(-58,0);plaque(p.x,p.z,y,ry+Math.PI/2,'LE LOUVRE','MUSÉE · LA PYRAMIDE 1989',24);}
      },

      // ---- LES INVALIDES ----------------------------------------------------
      invalides(o){
        const y=G(o.x,o.z), st=limestone(0xe2d7bd);
        box(64,15,26,st,o.x,y+7.5,o.z+16);                       // the long front court
        box(30,20,30,st,o.x,y+10,o.z);                           // the church below the dome
        colRow(o.x-11,o.z-16,y,4,7.3,0,13,st,1.0);               // portico
        box(32,3,4,st,o.x,y+14.5,o.z-16);
        cyl(13,14,15,24,st,o.x,y+27.5,o.z);                      // the drum
        colonnade(o.x,o.z,y+21,20,14.6,11,st,0.7);
        dome(12.6,goldM,o.x,y+35,o.z,1.42);                      // the gilded dome
        cyl(1.2,2.2,7,10,goldM,o.x,y+50,o.z);
        cyl(0.2,0.5,7,6,goldM,o.x,y+56,o.z);
        beacon(o.x,y+60,o.z,1.1,0xffe3a0);
        // the esplanade with its rows of cannon
        for(let i=0;i<10;i++){const cx=o.x-27+i*6;
          cyl(0.42,0.5,4.4,7,ironM,cx,y+1.4,o.z+31);}
        addBox(o.x,o.z,18,18,52);addBox(o.x,o.z+16,32,13,16);
        plaque(o.x,o.z+38,y,0,'LES INVALIDES','HÔTEL · DÔME DORÉ',24);
      },

      // ---- OPÉRA GARNIER ----------------------------------------------------
      opera(o){
        const y=G(o.x,o.z), st=limestone(0xe8dcc0);
        box(38,17,26,st,o.x,y+8.5,o.z);
        colRow(o.x-14,o.z-13.4,y+8,7,4.7,0,9,st,0.85);           // the loggia
        box(40,2.4,2.4,st,o.x,y+18.4,o.z-13.4);
        // the green copper cupola over the auditorium
        cyl(9,10,7,18,st,o.x,y+21,o.z+2);
        dome(8.8,copperM,o.x,y+24.5,o.z+2,0.9);
        cyl(0.9,1.4,4,8,goldM,o.x,y+33,o.z+2);
        // the gilded figures on the roofline
        for(const sx of[-15,15]){cyl(1.5,1.8,4,6,st,o.x+sx,y+20,o.z-11);
          const fig=new THREE.Mesh(new THREE.CapsuleGeometry(0.75,2.1,4,8),goldM);
          fig.position.set(o.x+sx,y+24,o.z-11);add(fig);}
        box(34,7,16,copperM,o.x,y+21,o.z+11);                    // the stage-house roof
        addBox(o.x,o.z,20,14,28);
        plaque(o.x,o.z-17,y,Math.PI,'OPÉRA GARNIER','PALAIS GARNIER · 1875',22);
      },

      // ---- PLACE DE LA CONCORDE --------------------------------------------
      concorde(o){
        const y=G(o.x,o.z);
        const pav=new THREE.Mesh(new THREE.CylinderGeometry(30,30,0.8,40),M({color:0x5b564d,roughness:1}));
        pav.position.set(o.x,y+0.4,o.z);pav.receiveShadow=true;add(pav);
        // the Luxor obelisk
        box(4.4,3.2,4.4,limestone(0xc9bb9a),o.x,y+1.6,o.z);
        {const ob=new THREE.Mesh(new THREE.CylinderGeometry(0.95,1.7,25,4),M({color:0xc0a878,roughness:0.7}));
          ob.rotation.y=Math.PI/4;ob.position.set(o.x,y+15.7,o.z);ob.castShadow=true;add(ob);
          const cap=new THREE.Mesh(new THREE.ConeGeometry(1.35,2.6,4),goldM);
          cap.rotation.y=Math.PI/4;cap.position.set(o.x,y+29.4,o.z);add(cap);}
        // the two fountains
        for(const sz of[-17,17]){
          cyl(7,7.4,1.1,20,M({color:0x6a6256,roughness:0.9}),o.x,y+0.9,o.z+sz);
          cyl(6.2,6.2,0.5,20,M({color:0x4a6b78,roughness:0.15,metalness:0.4,envMapIntensity:1.1}),o.x,y+1.5,o.z+sz);
          cyl(0.7,1.0,4.2,10,M({color:0x2f4a3a,roughness:0.6,metalness:0.4}),o.x,y+3.4,o.z+sz);
          cyl(3.0,3.4,0.6,16,M({color:0x2f4a3a,roughness:0.6,metalness:0.4}),o.x,y+5.4,o.z+sz);
          beacon(o.x,y+7,o.z+sz,0.6,0xbfe6ff);
        }
        // the rostral columns and lamps around the rim
        for(let i=0;i<8;i++){const a=i/8*Math.PI*2;
          const lx=o.x+Math.cos(a)*25, lz=o.z+Math.sin(a)*25;
          cyl(0.6,0.8,7,8,ironM,lx,y+3.5,lz);beacon(lx,y+7.6,lz,0.55,0xffe2a0);}
        addBox(o.x,o.z,4,4,30);
        plaque(o.x+30,o.z,y,-Math.PI/2,'PLACE DE LA CONCORDE',"OBÉLISQUE DE LOUQSOR",22);
      },

      // ---- LA MADELEINE, a Greek temple in the middle of Paris --------------
      madeleine(o){
        const y=G(o.x,o.z), st=limestone(0xded2b4);
        box(30,4,54,st,o.x,y+2,o.z);                             // the podium
        for(let i=0;i<8;i++)for(const sz of[-25,25])
          cyl(1.5,1.6,17,12,st,o.x-12.5+i*3.6,y+12.5,o.z+sz);
        for(let i=0;i<14;i++)for(const sx of[-13,13])
          cyl(1.5,1.6,17,12,st,o.x+sx,y+12.5,o.z-23+i*3.6);
        box(32,4,56,st,o.x,y+23,o.z);                            // the entablature
        {const r=new THREE.Mesh(new THREE.BoxGeometry(28,3,52),slateM);r.position.set(o.x,y+26.5,o.z);add(r);}
        for(const sz of[-27.5,27.5]){                            // the pediments
          const p=new THREE.Mesh(new THREE.CylinderGeometry(0.1,16,4,3),st);
          p.rotation.set(Math.PI/2,0,0);p.position.set(o.x,y+26,o.z+sz);add(p);}
        addBox(o.x,o.z,16,28,28);
        plaque(o.x,o.z-32,y,Math.PI,'LA MADELEINE','ÉGLISE SAINTE-MARIE-MADELEINE',22);
      },

      // ---- LE PANTHÉON ------------------------------------------------------
      pantheon(o){
        const y=G(o.x,o.z), st=limestone(0xe4d9c0);
        box(34,17,50,st,o.x,y+8.5,o.z);
        for(let i=0;i<6;i++)for(let r=0;r<2;r++)                  // the deep portico
          cyl(1.5,1.6,16,12,st,o.x-11+i*4.4,y+8,o.z-25-r*5);
        {const p=new THREE.Mesh(new THREE.CylinderGeometry(0.1,17,5,3),st);
          p.rotation.set(Math.PI/2,0,0);p.position.set(o.x,y+19,o.z-27.5);add(p);}
        cyl(11,11.6,11,22,st,o.x,y+23,o.z+4);                     // the drum
        colonnade(o.x,o.z+4,y+18,22,12.6,10,st,0.62);
        dome(10.6,M({color:0xc9c2b0,roughness:0.7}),o.x,y+28.5,o.z+4,1.24);
        cyl(2.2,3,5,12,st,o.x,y+41,o.z+4);
        cyl(0.5,0.9,4,8,goldM,o.x,y+46,o.z+4);
        addBox(o.x,o.z,18,26,44);
        plaque(o.x,o.z-32,y,Math.PI,'LE PANTHÉON','AUX GRANDS HOMMES',22);
      },

      // ---- GRAND PALAIS, the glass barrel vault ----------------------------
      grandpalais(o){
        const y=G(o.x,o.z), st=limestone(0xe6dbc2);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        box(70,17,34,st,o.x,y+8.5,o.z,ry);
        {const v=new THREE.Mesh(new THREE.CylinderGeometry(15,15,58,22,1,true,0,Math.PI),glassM);
          v.rotation.set(Math.PI/2,0,ry);v.position.set(o.x,y+18,o.z);add(v);
          const rib=new THREE.Mesh(new THREE.CylinderGeometry(15.2,15.2,58,16,6,true,0,Math.PI),
            M({color:0x4a5560,roughness:0.5,metalness:0.7,wireframe:true}));
          rib.rotation.set(Math.PI/2,0,ry);rib.position.set(o.x,y+18,o.z);add(rib);}
        colRow(o.x,o.z,y+17,10,Math.cos(ry)*6.6,-Math.sin(ry)*6.6,0.1,st,0.1);
        // the bronze quadrigas at the corners
        for(const s of[-1,1]){
          const qx=o.x+Math.cos(ry)*s*31, qz=o.z-Math.sin(ry)*s*31;
          box(7,4,5,M({color:0x3f5f4e,roughness:0.55,metalness:0.5}),qx,y+21,qz,ry);
        }
        addBox(o.x,o.z,35,18,34);
        plaque(o.x,o.z+22,y,0,'GRAND PALAIS','NEF · 1900',22);
      },

      // ---- MUSÉE D'ORSAY, a railway station ---------------------------------
      orsay(o){
        const y=G(o.x,o.z), st=limestone(0xdfd3b8);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        box(62,20,26,st,o.x,y+10,o.z,ry);
        {const v=new THREE.Mesh(new THREE.CylinderGeometry(11,11,54,18,1,true,0,Math.PI),
          M({color:0x8a8574,roughness:0.6,metalness:0.3}));
          v.rotation.set(Math.PI/2,0,ry);v.position.set(o.x,y+20,o.z);add(v);}
        // the two great station clocks
        for(const s of[-1,1]){
          const cx=o.x+Math.cos(ry)*s*15+Math.sin(ry)*13, cz=o.z-Math.sin(ry)*s*15+Math.cos(ry)*13;
          const c=new THREE.Mesh(new THREE.CircleGeometry(4.2,22),
            M({color:0xf0e6cc,emissive:0xffdca0,emissiveIntensity:0.8,side:THREE.DoubleSide}));
          c.position.set(cx,y+15,cz);c.rotation.y=ry+Math.PI/2;add(c);
          const rim=new THREE.Mesh(new THREE.TorusGeometry(4.3,0.36,8,24),ironM);
          rim.position.set(cx,y+15,cz);rim.rotation.y=ry+Math.PI/2;add(rim);
        }
        addBox(o.x,o.z,32,14,24);
        plaque(o.x,o.z+16,y,0,"MUSÉE D'ORSAY",'GARE · 1900',20);
      },

      // ---- PALAIS DE CHAILLOT, facing the tower across the water ------------
      trocadero(o){
        const y=G(o.x,o.z), st=limestone(0xe8ddc4);
        const E=LMX.eiffel, ry=Math.atan2(E.x-o.x,E.z-o.z);      // it looks AT the Eiffel Tower
        for(const s of[-1,1]){                                   // the two curved wings
          for(let i=0;i<7;i++){
            const a=s*(0.30+i*0.15);
            const wx=o.x+Math.sin(ry+a)*44, wz=o.z+Math.cos(ry+a)*44;
            box(13,15,17,st,wx,y+7.5,wz,ry+a);
            colRow(wx,wz,y+15,1,0,0,0.1,st,0.1);
          }
        }
        // the esplanade between them, looking over the river
        box(40,3,26,st,o.x+Math.sin(ry)*20,y+1.5,o.z+Math.cos(ry)*20,ry);
        for(let i=0;i<8;i++){const gx=o.x+Math.sin(ry)*20+Math.cos(ry)*(i-3.5)*4.6,
                             gz=o.z+Math.cos(ry)*20-Math.sin(ry)*(i-3.5)*4.6;
          const fig=new THREE.Mesh(new THREE.CapsuleGeometry(0.6,1.9,4,8),goldM);
          fig.position.set(gx,y+4.6,gz);add(fig);}
        addBox(o.x,o.z,32,26,18);
        plaque(o.x,o.z,y,ry,'PALAIS DE CHAILLOT','TROCADÉRO',22);
      },

      // ---- TOUR MONTPARNASSE, the slab Paris regretted ----------------------
      montparnasse(o){
        const y=G(o.x,o.z), H=178;
        const dark=M({color:0x2b2f36,roughness:0.35,metalness:0.55,envMapIntensity:0.8,
                      emissive:0x171c22,emissiveIntensity:0.5});
        const t=FACADES.modern;
        const glass=new THREE.MeshStandardMaterial({map:t.map,emissiveMap:t.em,emissive:0xffffff,
          emissiveIntensity:0.7,roughness:0.3,metalness:0.6,envMapIntensity:0.9,color:0x6b7280});
        const m=new THREE.Mesh(new THREE.BoxGeometry(34,H,20),[glass,glass,dark,dark,glass,glass]);
        m.position.set(o.x,y+H/2,o.z);m.castShadow=true;m.receiveShadow=true;add(m);
        box(40,5,26,M({color:0x4a4a50,roughness:0.8}),o.x,y+2.5,o.z);
        box(30,2.5,17,dark,o.x,y+H+1.2,o.z);
        beacon(o.x,y+H+5,o.z,1.3,0xff4030);
        addBox(o.x,o.z,20,13,H);
        plaque(o.x,o.z+18,y,0,'TOUR MONTPARNASSE','210 M · 1973',20);
      },

      // ---- LA GRANDE ARCHE DE LA DÉFENSE ------------------------------------
      defense(o){
        const y=G(o.x,o.z), S=62, T=9;
        const marble=M({color:0xe4e2dc,roughness:0.32,metalness:0.2,envMapIntensity:0.8});
        box(S,T,T+14,marble,o.x,y+S-T/2,o.z);                    // the lintel
        for(const sx of[-1,1])box(T,S-T,T+14,marble,o.x+sx*(S/2-T/2),y+(S-T)/2,o.z);
        box(S-T*2,T,T+14,marble,o.x,y+T/2,o.z);                  // the sill
        {const w=new THREE.Mesh(new THREE.BoxGeometry(S-T*2,S-T*2,1),glassM);
          w.position.set(o.x,y+S/2,o.z);add(w);}
        box(S+10,2,S+10,M({color:0x9b978e,roughness:0.9}),o.x,y+1,o.z);
        for(const sx of[-1,1])addBox(o.x+sx*(S/2-T/2),o.z,T/2+1,T/2+8,S);
        beacon(o.x,y+S+4,o.z,1.2,0xffd9a0);
        plaque(o.x,o.z+S/2+14,y,0,'LA GRANDE ARCHE','LA DÉFENSE · 1989',24);
      },

      // ---- MOULIN ROUGE -----------------------------------------------------
      moulinrouge(o){
        const y=G(o.x,o.z);
        const red=M({color:0xa32222,roughness:0.72,emissive:0x3a0a0a,emissiveIntensity:0.6});
        box(24,15,16,red,o.x,y+7.5,o.z);
        cyl(4.2,4.6,7,14,red,o.x,y+18,o.z-2);                    // the mill tower
        // the sails, which turn
        {const hub=new THREE.Group();hub.position.set(o.x,y+20,o.z-9);add(hub);
          for(let i=0;i<4;i++){
            const s=new THREE.Mesh(new THREE.BoxGeometry(1.5,15,0.5),
              M({color:0xd9333a,emissive:0x5a0d10,emissiveIntensity:0.9,roughness:0.6}));
            s.position.set(0,0,0);s.rotation.z=i*Math.PI/2;
            const arm=new THREE.Group();arm.add(s);s.position.y=0;hub.add(arm);arm.rotation.z=i*Math.PI/2;
            const blade=new THREE.Mesh(new THREE.BoxGeometry(2.4,14,0.4),
              M({color:0xe23a40,emissive:0x6a1014,emissiveIntensity:1.0,roughness:0.6}));
            blade.position.y=7.5;arm.add(blade);
          }
          for(let i=0;i<12;i++){const a=i/12*Math.PI*2;
            beacon(o.x+Math.cos(a)*7.6,y+20+Math.sin(a)*7.6,o.z-8.6,0.42,0xffd23a);}
          anim.push(dt=>{hub.rotation.z-=dt*0.55;});}
        // the sign
        {const[c,g]=cv(512,128);
          g.fillStyle='#12080a';g.fillRect(0,0,512,128);
          g.fillStyle='#ff3b46';g.font='bold 74px Georgia,serif';g.textAlign='center';g.textBaseline='middle';
          g.shadowColor='#ff3b46';g.shadowBlur=26;g.fillText('MOULIN ROUGE',256,68);
          const t=tex(c);
          const m=new THREE.Mesh(new THREE.PlaneGeometry(22,5.5),
            M({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:2.0,transparent:true,side:THREE.DoubleSide}));
          m.position.set(o.x,y+17.5,o.z+8.2);add(m);}
        addBox(o.x,o.z,12,8,16);
      },

      // ---- the great places: Bastille, République, Nation -------------------
      bastille(o){
        const y=G(o.x,o.z);
        const isle=new THREE.Mesh(new THREE.CylinderGeometry(19,20,1,32),M({color:0x55514a,roughness:1}));
        isle.position.set(o.x,y+0.5,o.z);isle.receiveShadow=true;add(isle);
        box(7,5,7,limestone(0xcdbf9e),o.x,y+3.4,o.z);
        cyl(2.0,2.4,34,16,M({color:0x3d4a3f,roughness:0.5,metalness:0.55}),o.x,y+23,o.z);
        cyl(3.0,3.0,2,16,goldM,o.x,y+41,o.z);
        {const g=new THREE.Mesh(new THREE.CapsuleGeometry(1.2,3.2,5,10),goldM);   // le Génie de la Liberté
          g.position.set(o.x,y+44.5,o.z);add(g);
          const wing=new THREE.Mesh(new THREE.BoxGeometry(6.5,0.35,2.2),goldM);
          wing.position.set(o.x,y+45.6,o.z);wing.rotation.z=0.28;add(wing);}
        beacon(o.x,y+48,o.z,0.9,0xffe0a0);
        addBox(o.x,o.z,4,4,42);
        plaque(o.x,o.z+22,y,0,'PLACE DE LA BASTILLE','COLONNE DE JUILLET',20);
      },
      republique(o){
        const y=G(o.x,o.z);
        const isle=new THREE.Mesh(new THREE.CylinderGeometry(18,19,1,32),M({color:0x55514a,roughness:1}));
        isle.position.set(o.x,y+0.5,o.z);isle.receiveShadow=true;add(isle);
        box(11,9,11,limestone(0xcfc1a2),o.x,y+5.5,o.z);
        box(7,7,7,limestone(0xdccfae),o.x,y+13.5,o.z);
        {const s=new THREE.Mesh(new THREE.CapsuleGeometry(1.5,5,5,10),copperM);
          s.position.set(o.x,y+21,o.z);add(s);
          const arm=new THREE.Mesh(new THREE.CapsuleGeometry(0.4,4,4,8),copperM);
          arm.position.set(o.x+1.2,y+24.5,o.z);arm.rotation.z=-0.9;add(arm);}
        for(let i=0;i<3;i++){const a=i/3*Math.PI*2;
          const f=new THREE.Mesh(new THREE.CapsuleGeometry(0.8,2.4,4,8),copperM);
          f.position.set(o.x+Math.cos(a)*6.5,y+11.5,o.z+Math.sin(a)*6.5);add(f);}
        addBox(o.x,o.z,7,7,26);
        plaque(o.x,o.z+21,y,0,'PLACE DE LA RÉPUBLIQUE','MARIANNE',20);
      },
      nation(o){
        const y=G(o.x,o.z);
        const isle=new THREE.Mesh(new THREE.CylinderGeometry(20,21,1,32),M({color:0x54504a,roughness:1}));
        isle.position.set(o.x,y+0.5,o.z);isle.receiveShadow=true;add(isle);
        box(10,8,10,limestone(0xcabd9d),o.x,y+5,o.z);
        {const g=new THREE.Mesh(new THREE.BoxGeometry(7,2.6,4),copperM);g.position.set(o.x,y+10.5,o.z);add(g);
          for(let i=0;i<2;i++){const h=new THREE.Mesh(new THREE.CapsuleGeometry(0.9,2.6,4,8),copperM);
            h.position.set(o.x-2+i*4,y+13.5,o.z);add(h);}}
        for(const sx of[-24,24]){cyl(1.7,2.0,22,14,limestone(0xd6c9a8),o.x+sx,y+11,o.z-4);
          const fig=new THREE.Mesh(new THREE.CapsuleGeometry(1,2.6,4,8),copperM);
          fig.position.set(o.x+sx,y+24,o.z-4);add(fig);}
        addBox(o.x,o.z,7,7,15);
        plaque(o.x,o.z+23,y,0,'PLACE DE LA NATION','TRIOMPHE DE LA RÉPUBLIQUE',20);
      },

      // ---- the rest, at a lighter level of detail ---------------------------
      hoteldeville(o){
        const y=G(o.x,o.z), st=limestone(0xe2d7bc);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        box(54,20,24,st,o.x,y+10,o.z,ry);
        box(56,3,26,st,o.x,y+21,o.z,ry);
        box(52,6,22,slateM,o.x,y+24.5,o.z,ry);
        for(const s of[-1,1]){const px=o.x+Math.cos(ry)*s*23, pz=o.z-Math.sin(ry)*s*23;
          box(13,26,15,st,px,y+13,pz,ry);
          const r=new THREE.Mesh(new THREE.ConeGeometry(9.5,10,4),slateM);
          r.rotation.y=ry+Math.PI/4;r.position.set(px,y+31,pz);add(r);}
        {const bx=o.x,bz=o.z;box(12,30,12,st,bx,y+15,bz,ry);
          const r=new THREE.Mesh(new THREE.ConeGeometry(9,12,4),slateM);
          r.rotation.y=ry+Math.PI/4;r.position.set(bx,y+36,bz);add(r);
          cyl(0.2,0.4,5,6,goldM,bx,y+44,bz);}
        addBox(o.x,o.z,28,13,32);
        plaque(o.x,o.z+18,y,0,'HÔTEL DE VILLE','MAIRIE DE PARIS',22);
      },
      conciergerie(o){
        const y=G(o.x,o.z), st=limestone(0xd8ccb0);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        box(40,17,16,st,o.x,y+8.5,o.z,ry);
        for(const[u,rr2]of[[-15,5.2],[-6,4.4],[6,4.4],[16,5.0]]){
          const px=o.x+Math.cos(ry)*u, pz=o.z-Math.sin(ry)*u;
          cyl(rr2,rr2,23,14,st,px,y+11.5,pz);
          cone(rr2+0.9,9,14,slateM,px,y+27.5,pz);}
        // Sainte-Chapelle's spire, just behind
        {const px=o.x+Math.sin(ry)*11, pz=o.z+Math.cos(ry)*11;
          box(9,20,16,st,px,y+10,pz,ry);cone(3.2,16,8,slateM,px,y+28,pz);
          cyl(0.14,0.3,4,5,goldM,px,y+38,pz);}
        addBox(o.x,o.z,21,10,26);
        plaque(o.x,o.z,y,ry+Math.PI,'LA CONCIERGERIE','SAINTE-CHAPELLE',20);
      },
      pompidou(o){
        const y=G(o.x,o.z);
        const frame=M({color:0xd8d4cc,roughness:0.5,metalness:0.5});
        box(38,26,26,M({color:0x9aa0a6,roughness:0.5,metalness:0.4}),o.x,y+13,o.z);
        // the exposed structural frame and the coloured service ducts
        for(let i=0;i<6;i++)for(const sz of[-13.4,13.4])
          cyl(0.6,0.6,26,8,frame,o.x-16+i*6.4,y+13,o.z+sz);
        for(let i=0;i<5;i++)box(40,0.7,0.7,frame,o.x,y+3+i*5.4,o.z-13.4);
        const ducts=[0x2f6fd0,0x3aa564,0xe8c23a,0xd23b3b];
        for(let i=0;i<4;i++)cyl(1.5,1.5,24,10,M({color:ducts[i],roughness:0.5,metalness:0.3}),
          o.x-13+i*8.6,y+12,o.z+15.2);
        // the caterpillar escalator up the front face
        {const e=new THREE.Mesh(new THREE.BoxGeometry(3.6,32,3.6),glassM);
          e.position.set(o.x,y+14,o.z+16.6);e.rotation.x=-0.42;add(e);}
        addBox(o.x,o.z,20,15,26);
        plaque(o.x,o.z+21,y,0,'CENTRE POMPIDOU','BEAUBOURG · 1977',20);
      },
      garedunord(o){
        const y=G(o.x,o.z), st=limestone(0xdfd4b9);
        box(58,20,22,st,o.x,y+10,o.z);
        {const v=new THREE.Mesh(new THREE.CylinderGeometry(14,14,52,20,1,true,0,Math.PI),
          M({color:0x7e8a90,roughness:0.55,metalness:0.35}));
          v.rotation.set(Math.PI/2,0,0);v.position.set(o.x,y+20,o.z+12);add(v);}
        for(let i=0;i<9;i++)cyl(1.2,1.3,20,10,st,o.x-24+i*6,y+10,o.z-11.4);
        box(60,3.4,3.4,st,o.x,y+21.5,o.z-11.4);
        for(let i=0;i<5;i++){const fx=o.x-20+i*10;
          const fig=new THREE.Mesh(new THREE.CapsuleGeometry(0.85,2.6,4,8),M({color:0xcdc0a2,roughness:0.9}));
          fig.position.set(fx,y+25,o.z-11.4);add(fig);}
        {const c=new THREE.Mesh(new THREE.CircleGeometry(3.4,20),
          M({color:0xf2e8cc,emissive:0xffd79a,emissiveIntensity:0.9,side:THREE.DoubleSide}));
          c.position.set(o.x,y+16,o.z-11.8);add(c);}
        addBox(o.x,o.z,30,14,24);
        plaque(o.x,o.z-16,y,Math.PI,'GARE DU NORD','1864',22);
      },
      luxembourg(o){
        const y=G(o.x,o.z), st=limestone(0xdccfb2);
        // the palace, on the north side
        box(46,17,20,st,o.x,y+8.5,o.z-28);
        box(48,4,22,slateM,o.x,y+19,o.z-28);
        for(const sx of[-1,1])box(14,21,16,st,o.x+sx*22,y+10.5,o.z-28);
        {const d=dome(6.5,slateM,o.x,y+19,o.z-28,1.1);d.castShadow=true;}
        // the grand basin, the gravel and the chestnut allées
        cyl(15,15.4,1,32,M({color:0x8e8676,roughness:1}),o.x,y+0.5,o.z+6);
        cyl(13.6,13.6,0.6,32,M({color:0x4a6b78,roughness:0.14,metalness:0.4,envMapIntensity:1.1}),o.x,y+1.1,o.z+6);
        cyl(0.5,0.7,3,8,M({color:0x39514a,roughness:0.6,metalness:0.4}),o.x,y+2.6,o.z+6);
        for(let i=0;i<26;i++){const a=i/26*Math.PI*2, R=30+((i%3)*4);
          const tx=o.x+Math.cos(a)*R, tz=o.z+6+Math.sin(a)*R*0.7;
          cyl(0.5,0.7,6,6,M({color:0x5a4632,roughness:1}),tx,y+3,tz);
          const cr=new THREE.Mesh(new THREE.SphereGeometry(3.6,9,7),M({color:0x39602c,roughness:1}));
          cr.position.set(tx,y+8.5,tz);cr.scale.y=0.8;cr.castShadow=true;add(cr);}
        addBox(o.x,o.z-28,24,11,22);
        plaque(o.x,o.z+26,y,0,'JARDIN DU LUXEMBOURG','PALAIS & GRAND BASSIN',22);
      },
      ecolemil(o){
        const y=G(o.x,o.z), st=limestone(0xe0d5b9);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        box(58,17,22,st,o.x,y+8.5,o.z,ry);
        box(60,4,24,slateM,o.x,y+19,o.z,ry);
        colRow(o.x,o.z,y+8,8,Math.cos(ry)*5.4,-Math.sin(ry)*5.4,14,st,1.0);
        {box(20,24,20,st,o.x,y+12,o.z,ry);
          const r=new THREE.Mesh(new THREE.ConeGeometry(14,10,4),slateM);
          r.rotation.y=ry+Math.PI/4;r.position.set(o.x,y+29,o.z);add(r);}
        addBox(o.x,o.z,30,13,28);
        plaque(o.x,o.z-16,y,Math.PI,'ÉCOLE MILITAIRE','1750',20);
      },
      stgermain(o){
        const y=G(o.x,o.z), st=limestone(0xd6caae);
        box(20,15,32,st,o.x,y+7.5,o.z);
        box(11,26,11,st,o.x,y+13,o.z-18);
        cone(7.6,11,8,slateM,o.x,y+31,o.z-18);
        cyl(0.14,0.3,4,5,goldM,o.x,y+38,o.z-18);
        addBox(o.x,o.z,11,17,28);
        plaque(o.x,o.z+18,y,0,'SAINT-GERMAIN-DES-PRÉS','ABBAYE · 990',18);
      },
      perelachaise(o){
        const y=G(o.x,o.z);
        // a hillside of tombs under the plane trees, walled in
        const stoneM=M({color:0xbdb4a2,roughness:0.95});
        const tomb=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),stoneM,240);
        const m=new THREE.Matrix4(),q=new THREE.Quaternion(),eu=new THREE.Euler();let i=0;
        for(let k=0;k<240;k++){
          const a=rand()*Math.PI*2, R=rr(6,40);
          const tx=o.x+Math.cos(a)*R, tz=o.z+Math.sin(a)*R;
          eu.set(0,rand()*0.6,0);q.setFromEuler(eu);
          const h=rr(1.6,4.4);
          m.compose(new THREE.Vector3(tx,G(tx,tz)+h/2,tz),q,new THREE.Vector3(rr(1.2,2.2),h,rr(1.2,2.6)));
          tomb.setMatrixAt(i++,m);
        }
        tomb.count=i;tomb.castShadow=true;tomb.receiveShadow=true;add(tomb);
        for(let k=0;k<16;k++){const a=k/16*Math.PI*2;
          const tx=o.x+Math.cos(a)*42, tz=o.z+Math.sin(a)*42, ty=G(tx,tz);
          cyl(0.55,0.8,7,6,M({color:0x4e3f2e,roughness:1}),tx,ty+3.5,tz);
          const cr=new THREE.Mesh(new THREE.SphereGeometry(4.2,9,7),M({color:0x2f5227,roughness:1}));
          cr.position.set(tx,ty+9.5,tz);cr.scale.y=0.78;cr.castShadow=true;add(cr);}
        plaque(o.x,o.z-46,y,Math.PI,'PÈRE-LACHAISE','CIMETIÈRE · 1804',20);
      },
      // scenery
      carrousel(o){
        const y=G(o.x,o.z), st=limestone(0xdccfb0);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        for(const sx of[-1,1])box(3.6,10,7,st,o.x+Math.cos(ry)*sx*6.4,y+5,o.z-Math.sin(ry)*sx*6.4,ry);
        box(17,4,7.6,st,o.x,y+12,o.z,ry);
        box(9,3.4,6,st,o.x,y+15.6,o.z,ry);
        for(const sx of[-1,1])cyl(0.55,0.55,10,10,M({color:0xc0a06a,roughness:0.5,metalness:0.6}),
          o.x+Math.cos(ry)*sx*6.4,y+5,o.z-Math.sin(ry)*sx*6.4+0.1);
        addBox(o.x,o.z,9,4,16);
      },
      palaisroyal(o){
        const y=G(o.x,o.z), st=limestone(0xded1b4);
        for(const[dx,dz,w,d]of[[0,-16,44,10],[0,16,44,10],[-19,0,10,34],[19,0,10,34]])
          {box(w,15,d,st,o.x+dx,y+7.5,o.z+dz);addBox(o.x+dx,o.z+dz,w/2,d/2,16);}
        // Buren's striped columns in the cour d'honneur
        for(let i=0;i<5;i++)for(let k=0;k<5;k++)
          cyl(0.9,0.9,rr(1.2,4.4),10,M({color:(i+k)%2?0xf0ece2:0x24262a,roughness:0.8}),
            o.x-9+i*4.5,y+1.6,o.z-9+k*4.5);
      },
      vosges(o){
        const y=G(o.x,o.z);
        const brick=M({color:0xa8624a,roughness:0.9});
        // the square: uniform brick-and-stone pavilions on all four sides
        for(let s=0;s<4;s++){
          const a=s*Math.PI/2;
          for(let i=0;i<5;i++){
            const u=(i-2)*8.6;
            const bx=o.x+Math.cos(a)*17-Math.sin(a)*u, bz=o.z+Math.sin(a)*17+Math.cos(a)*u;
            box(8,15,10,brick,bx,y+7.5,bz,-a);
            box(8,5,10,slateM,bx,y+17.5,bz,-a);
            addBox(bx,bz,4,5,20);
          }
        }
        cyl(11,11,0.5,26,M({color:0x53704a,roughness:1}),o.x,y+0.3,o.z);
      },
      tuileries(o){
        const y=G(o.x,o.z);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        cyl(28,28.4,0.6,36,M({color:0x8f8674,roughness:1}),o.x,y+0.3,o.z);
        cyl(9,9,0.7,26,M({color:0x4a6b78,roughness:0.14,metalness:0.4,envMapIntensity:1.1}),o.x,y+0.8,o.z);
        for(let i=0;i<22;i++){const a=i/22*Math.PI*2, R=22+(i%2)*6;
          const tx=o.x+Math.cos(a)*R, tz=o.z+Math.sin(a)*R*0.72;
          cyl(0.5,0.7,6,6,M({color:0x5a4632,roughness:1}),tx,y+3,tz);
          const cr=new THREE.Mesh(new THREE.SphereGeometry(3.4,9,7),M({color:0x3d6630,roughness:1}));
          cr.position.set(tx,y+8,tz);cr.scale.y=0.78;cr.castShadow=true;add(cr);}
      },
      champdemars(o){
        const y=G(o.x,o.z);
        const f=seineTan(o.t), ry=Math.atan2(f.x,f.z);
        const lawn=new THREE.Mesh(new THREE.PlaneGeometry(58,120),M({color:0x466b30,roughness:1}));
        lawn.rotation.x=-Math.PI/2;lawn.rotation.z=-ry;lawn.position.set(o.x,y+0.14,o.z);
        lawn.receiveShadow=true;add(lawn);
        for(let i=0;i<20;i++)for(const s of[-1,1]){
          const u=s*27, v=(i-9.5)*6.2;
          const tx=o.x+Math.cos(ry)*u+Math.sin(ry)*v, tz=o.z-Math.sin(ry)*u+Math.cos(ry)*v;
          cyl(0.42,0.62,6,6,M({color:0x5a4632,roughness:1}),tx,y+3,tz);
          const cr=new THREE.Mesh(new THREE.SphereGeometry(3.1,8,6),M({color:0x38602b,roughness:1}));
          cr.position.set(tx,y+8,tz);cr.scale.y=0.8;cr.castShadow=true;add(cr);}
      },
      champs(){},
    };
    for(const o of[...LM,...SCENERY]){
      const fn=BUILD[o.k];if(!fn)continue;
      if(/debug/.test(location.hash)){
        const before=LG.children.length;
        fn(o);
        // measure just this landmark's own children, so a silhouette that never
        // grew (or grew in the wrong place) shows up as a number, not a guess
        const bb=new THREE.Box3();
        for(let i=before;i<LG.children.length;i++)bb.expandByObject(LG.children[i]);
        if(!bb.isEmpty())console.log(`PARIS lm ${o.k}: top y=${bb.max.y.toFixed(0)} `+
          `x[${bb.min.x.toFixed(0)},${bb.max.x.toFixed(0)}] z[${bb.min.z.toFixed(0)},${bb.max.z.toFixed(0)}]`);
      }else fn(o);
    }

    // Pont Alexandre III gets its gilded columns, since it's a landmark in its
    // own right rather than just a way across.
    {const B=BRIDGES.find(b=>b.grand);
      if(B){
        for(const[end,pt]of[['a',B.a],['b',B.b]]){
          const f=seineTan(B.t);
          for(const s of[-1,1]){
            const cx=pt.x+f.x*s*9, cz=pt.z+f.z*s*9, cy=G(cx,cz);
            cyl(1.5,1.8,17,12,limestone(0xdccfae),cx,Math.max(cy,BRIDGE_Y)+8.5,cz);
            const fig=new THREE.Mesh(new THREE.CapsuleGeometry(1.0,2.8,5,10),goldM);
            fig.position.set(cx,Math.max(cy,BRIDGE_Y)+19,cz);add(fig);
            beacon(cx,Math.max(cy,BRIDGE_Y)+22,cz,0.7,0xffe0a4);
          }
        }
      }
    }

    // ======================================================================
    //  10. LIVING DETAIL — the things that say Paris at street level
    // ======================================================================
    //  All instanced: the street furniture is repeated thousands of times, so
    //  each kind costs one draw call rather than one per object.
    const DG=new THREE.Group();scene.add(DG);

    // --- plane trees along the boulevards ---------------------------------
    //  Pollarded Paris planes: a pale mottled trunk under a hard-clipped crown.
    {const spots=[];
      for(const R of roadPolys){
        if(R.bridge)continue;
        let acc=0;
        for(let i=1;i<R.pts.length;i++){
          const a=R.pts[i-1],b=R.pts[i];
          const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz);acc+=L;
          if(acc<13)continue;acc=0;
          if(!roadDrivable(b.x,b.z))continue;
          for(const s of[-1,1]){
            const tx=b.x-dz/L*(R.w/2+4.6)*s, tz=b.z+dx/L*(R.w/2+4.6)*s;
            if(surfaceH(tx,tz)<3.4)continue;
            if(nearRoad(tx,tz).d<R.w/2+2.4)continue;
            spots.push({x:tx,z:tz,s:rr(0.85,1.2)});
          }
        }
      }
      const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34,0.5,6.4,6),
        M({color:0x9d9482,roughness:0.95}),spots.length);
      const crown=new THREE.InstancedMesh(new THREE.SphereGeometry(3.1,8,6),
        M({color:0x41692f,roughness:1}),spots.length);
      const m=new THREE.Matrix4(),q=new THREE.Quaternion(),eu=new THREE.Euler();
      spots.forEach((p,i)=>{const y=surfaceH(p.x,p.z);
        eu.set(0,rand()*6.28,0);q.setFromEuler(eu);
        m.compose(new THREE.Vector3(p.x,y+3.2*p.s,p.z),q,new THREE.Vector3(p.s,p.s,p.s));
        trunk.setMatrixAt(i,m);
        m.compose(new THREE.Vector3(p.x,y+7.6*p.s,p.z),q,new THREE.Vector3(p.s*1.05,p.s*0.74,p.s*1.05));
        crown.setMatrixAt(i,m);});
      trunk.castShadow=true;crown.castShadow=true;crown.receiveShadow=true;
      DG.add(trunk);DG.add(crown);
      if(/debug/.test(location.hash))console.log('PARIS debug — plane trees '+spots.length);}

    // --- Métro entrances, Wallace fountains, Morris columns, kiosks --------
    {const guimard=[],wallace=[],morris=[],terrace=[];
      const cand=[];
      for(const R of roadPolys){
        if(R.bridge)continue;
        for(let i=6;i<R.pts.length-6;i+=9){
          const p=R.pts[i];if(!roadDrivable(p.x,p.z))continue;
          const a=R.pts[i-1],b=R.pts[i+1];
          const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz)||1;
          const s=rand()<0.5?1:-1;
          const px=p.x-dz/L*(R.w/2+3.4)*s, pz=p.z+dx/L*(R.w/2+3.4)*s;
          if(surfaceH(px,pz)<3.4)continue;
          cand.push({x:px,z:pz,ry:Math.atan2(dx,dz)});
        }
      }
      for(const c of cand){
        const r=rand();
        if(r<0.10)guimard.push(c);else if(r<0.18)wallace.push(c);
        else if(r<0.26)morris.push(c);else if(r<0.42)terrace.push(c);
      }
      // Guimard Métro entrance — green iron stalks and the amber lamp
      for(const c of guimard){
        const y=surfaceH(c.x,c.z), grn=M({color:0x24503c,roughness:0.55,metalness:0.45});
        for(const s of[-1,1]){
          const bx=c.x+Math.cos(c.ry)*s*2.1, bz=c.z-Math.sin(c.ry)*s*2.1;
          cyl(0.16,0.2,4.2,6,grn,bx,y+2.1,bz);
          const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.46,8,7),
            new THREE.MeshBasicMaterial({color:0xffb648}));
          lamp.position.set(bx,y+4.5,bz);DG.add(lamp);
        }
        const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.9),
          M({color:0x1d3f30,emissive:0xf0c040,emissiveIntensity:0.55,side:THREE.DoubleSide}));
        sign.position.set(c.x,y+3.5,c.z);sign.rotation.y=c.ry+Math.PI/2;DG.add(sign);
        box(4.4,0.5,2.4,M({color:0x2a2c2a,roughness:0.9}),c.x,y+0.25,c.z,c.ry);
        const rail=new THREE.Mesh(new THREE.BoxGeometry(4.4,1.1,0.16),grn);
        rail.position.set(c.x,y+0.8,c.z+1.2);rail.rotation.y=c.ry;DG.add(rail);
      }
      // Wallace fountain — dark green, four caryatids under a little dome
      for(const c of wallace){
        const y=surfaceH(c.x,c.z), grn=M({color:0x1f4a33,roughness:0.6,metalness:0.4});
        cyl(0.62,0.78,0.9,8,grn,c.x,y+0.45,c.z);
        for(let k=0;k<4;k++){const a=k/4*Math.PI*2;
          const f=new THREE.Mesh(new THREE.CapsuleGeometry(0.19,1.5,4,7),grn);
          f.position.set(c.x+Math.cos(a)*0.5,y+1.85,c.z+Math.sin(a)*0.5);DG.add(f);}
        cyl(0.9,0.78,0.28,8,grn,c.x,y+2.8,c.z);
        const dm=new THREE.Mesh(new THREE.SphereGeometry(0.82,10,7,0,Math.PI*2,0,Math.PI/2),grn);
        dm.position.set(c.x,y+2.9,c.z);DG.add(dm);
        cyl(0.08,0.1,0.5,5,grn,c.x,y+3.9,c.z);
      }
      // Morris column — the cylindrical playbill kiosk
      for(const c of morris){
        const y=surfaceH(c.x,c.z);
        cyl(1.28,1.34,0.32,14,M({color:0x2c2e2c,roughness:0.9}),c.x,y+0.16,c.z);
        cyl(1.2,1.2,4.2,14,M({color:0x1f3d2f,roughness:0.72,
          emissive:0x2a1408,emissiveIntensity:0.5}),c.x,y+2.4,c.z);
        const dm=new THREE.Mesh(new THREE.SphereGeometry(1.3,12,8,0,Math.PI*2,0,Math.PI/2),
          M({color:0x24503c,roughness:0.6,metalness:0.35}));
        dm.position.set(c.x,y+4.5,c.z);DG.add(dm);
        cyl(0.1,0.14,0.7,5,M({color:0x24503c,roughness:0.6,metalness:0.35}),c.x,y+5.2,c.z);
      }
      // café terrace — awning, rattan chairs, a couple of round tables
      for(const c of terrace){
        const y=surfaceH(c.x,c.z);
        const col=pick([0x8c1f28,0x1d4a2e,0x2a3f6b,0x6b4a1c]);
        const aw=new THREE.Mesh(new THREE.BoxGeometry(7.2,0.28,3.0),
          M({color:col,roughness:0.82}));
        aw.position.set(c.x,y+3.5,c.z);aw.rotation.set(0,c.ry,0.10);
        aw.castShadow=true;DG.add(aw);
        for(const s of[-1,1])cyl(0.07,0.07,3.4,5,M({color:0x30302c,roughness:0.7,metalness:0.4}),
          c.x+Math.cos(c.ry)*s*3.3,y+1.7,c.z-Math.sin(c.ry)*s*3.3);
        for(let k=0;k<3;k++){
          const tx=c.x+Math.cos(c.ry)*(k-1)*2.3, tz=c.z-Math.sin(c.ry)*(k-1)*2.3;
          cyl(0.06,0.06,0.72,5,M({color:0x2a2a26,roughness:0.7}),tx,y+0.36,tz);
          cyl(0.44,0.44,0.06,10,M({color:0xd8cdb4,roughness:0.75}),tx,y+0.74,tz);
          for(const s of[-1,1]){
            const chx=tx+Math.sin(c.ry)*s*0.85, chz=tz+Math.cos(c.ry)*s*0.85;
            box(0.52,0.1,0.52,M({color:0xa8894e,roughness:0.85}),chx,y+0.44,chz,c.ry);
            box(0.52,0.62,0.09,M({color:0xa8894e,roughness:0.85}),chx,y+0.78,chz+0.22,c.ry);
          }
        }
      }
      if(/debug/.test(location.hash))
        console.log(`PARIS debug — métro ${guimard.length}, wallace ${wallace.length}, `+
                    `morris ${morris.length}, terrasses ${terrace.length}`);}

    // --- bouquinistes: the green boxes along the quai parapets -------------
    {const boxes2=[];
      for(const side of[1,-1])for(let t=0.42;t<0.80;t+=0.0055){
        const p=bank(t,side,seineHalf(t)+3.4);
        if(surfaceH(p.x,p.z)<2.2)continue;
        boxes2.push({x:p.x,z:p.z,ry:Math.atan2(seineTan(t).x,seineTan(t).z)});
      }
      const g=new THREE.BoxGeometry(2.4,0.9,1.0);
      const inst=new THREE.InstancedMesh(g,M({color:0x1e4a34,roughness:0.78}),boxes2.length);
      const m=new THREE.Matrix4(),q=new THREE.Quaternion(),eu=new THREE.Euler();
      boxes2.forEach((b,i)=>{eu.set(0,b.ry,0);q.setFromEuler(eu);
        m.compose(new THREE.Vector3(b.x,surfaceH(b.x,b.z)+1.5,b.z),q,new THREE.Vector3(1,1,1));
        inst.setMatrixAt(i,m);});
      inst.castShadow=true;DG.add(inst);}

    // ======================================================================
    //  11. TRAFFIC — and the boats
    // ======================================================================
    //  France drives on the RIGHT, so lane offsets are mirrored from the
    //  Hong Kong map's.
    const traffic=[], paths=[];
    {for(const R of roadPolys){
        // resample with cumulative arc length so cars move at a constant speed
        const pts=[];let L=0;
        for(let i=0;i<R.pts.length;i++){
          const p=R.pts[i];
          if(!roadDrivable(p.x,p.z)){if(pts.length>6)paths.push({pts:[...pts],len:L,w:R.w});pts.length=0;L=0;continue;}
          if(pts.length)L+=Math.hypot(p.x-pts[pts.length-1].x,p.z-pts[pts.length-1].z);
          pts.push({x:p.x,z:p.z,s:L});
        }
        if(pts.length>6)paths.push({pts,len:L,w:R.w});
      }
      const usable=paths.filter(p=>p.len>70);
      const CARS=[0x1b1b1e,0xd8d4cc,0x8a2b2b,0x24405e,0x4a4a50,0x6b6f63,0xb8b2a4];
      function pathAt(P,s){
        const t=clamp(s,0,P.len);
        let lo=0,hi=P.pts.length-1;
        while(lo<hi-1){const mid=(lo+hi)>>1;if(P.pts[mid].s<t)lo=mid;else hi=mid;}
        const a=P.pts[lo],b=P.pts[hi],seg=Math.max(1e-4,b.s-a.s),u=(t-a.s)/seg;
        return {x:lerp(a.x,b.x,u),z:lerp(a.z,b.z,u),dx:b.x-a.x,dz:b.z-a.z};
      }
      for(let i=0;i<64&&usable.length;i++){
        const P=pick(usable), dir=rand()<0.5?1:-1;
        const kind=rand();
        let car;
        if(kind<0.14){                                  // a Paris bus, in city green
          car=buildCar(0x2f5f4a);car.group.scale.set(1.25,1.45,2.3);
        }else if(kind<0.24){                            // a taxi, roof sign lit
          car=buildCar(0x101014);
          const s=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.32,0.34),
            new THREE.MeshBasicMaterial({color:0xffd24a}));
          s.position.set(0,1.5,0);car.group.add(s);
        }else car=buildCar(pick(CARS));
        scene.add(car.group);
        traffic.push({car,P,dir,speed:rr(9,19),s:rr(0,P.len),
          off:(P.w/2-3.6)});
      }
      // bateaux-mouches on the Seine
      const boats=[];
      for(let i=0;i<4;i++){
        const g=new THREE.Group();
        const hull=new THREE.Mesh(new THREE.BoxGeometry(6.4,2.0,26),
          M({color:0x2a2f34,roughness:0.6,metalness:0.3}));
        hull.position.y=0.4;g.add(hull);
        const roof=new THREE.Mesh(new THREE.BoxGeometry(6.0,1.9,21),glassM);
        roof.position.y=2.2;g.add(roof);
        const deck=new THREE.Mesh(new THREE.BoxGeometry(6.2,0.24,21.4),
          M({color:0xd8cfbc,roughness:0.8}));
        deck.position.y=3.2;g.add(deck);
        for(let k=-2;k<=2;k++){
          const l=new THREE.Mesh(new THREE.SphereGeometry(0.32,7,6),
            new THREE.MeshBasicMaterial({color:0xffe4ae}));
          l.position.set(0,3.6,k*5);g.add(l);
        }
        scene.add(g);
        boats.push({g,t:rand(),dir:rand()<0.5?1:-1,speed:rr(0.006,0.011)});
      }

      anim.push(dt=>{
        for(const T of traffic){
          T.s+=T.dir*T.speed*dt;
          if(T.s>T.P.len)T.s-=T.P.len; if(T.s<0)T.s+=T.P.len;
          const p=pathAt(T.P,T.s);
          const L=Math.hypot(p.dx,p.dz)||1, nx=-p.dz/L, nz=p.dx/L;
          // keep right: the offset flips with the direction of travel
          const ox=nx*T.off*T.dir, oz=nz*T.off*T.dir;
          const gx=p.x+ox, gz=p.z+oz;
          T.car.group.position.set(gx,groundH(gx,gz)+0.05,gz);
          T.car.group.rotation.y=Math.atan2(p.dx*T.dir,p.dz*T.dir);
        }
        for(const B of boats){
          B.t+=B.dir*B.speed*dt;
          if(B.t>0.98){B.t=0.98;B.dir=-1;} if(B.t<0.06){B.t=0.06;B.dir=1;}
          const p=seineAt(B.t), f=seineTan(B.t);
          B.g.position.set(p.x,WATER_Y+0.2,p.z);
          B.g.rotation.y=Math.atan2(f.x*B.dir,f.z*B.dir);
        }
      });
      if(/debug/.test(location.hash))
        console.log(`PARIS debug — traffic ${traffic.length} on ${usable.length} paths, boats ${boats.length}`);
    }

    // Collision goes through a spatial hash, not a linear scan — the street-wall
    // placer produces thousands of small facade blocks rather than a few hundred
    // towers, so a per-frame loop over all of them is not affordable.
    const BCELL=40, bhash=new Map();
    for(const b of boxes){
      for(let gx=Math.floor((b.x-b.hw)/BCELL);gx<=Math.floor((b.x+b.hw)/BCELL);gx++)
        for(let gz=Math.floor((b.z-b.hd)/BCELL);gz<=Math.floor((b.z+b.hd)/BCELL);gz++){
          const k=gx+','+gz;let l=bhash.get(k);if(!l)bhash.set(k,l=[]);l.push(b);
        }
    }
    return {
      collide(nx,nz){
        const l=bhash.get(Math.floor(nx/BCELL)+','+Math.floor(nz/BCELL));
        if(l)for(const b of l)if(Math.abs(nx-b.x)<b.hw+1.4&&Math.abs(nz-b.z)<b.hd+1.4)return b;
        return null;
      },
      groundH,
      onVoid:(x,z)=>inWater(x,z),
      landmarks:LM.filter(o=>o.r>0).map(o=>({x:o.x,z:o.z,name:o.name,short:o.s})),
      minimapBlocks:bldgPts,
      trafficPoints:()=>traffic.map(t=>({x:t.car.group.position.x,z:t.car.group.position.z})),
      size:1340,
      update(dt){
        waterMat.uniforms.time.value+=dt;
        for(const f of anim)f(dt);
      },
    };
  }
};
export default CITY;
