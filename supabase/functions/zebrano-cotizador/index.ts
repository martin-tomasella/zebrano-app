import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const AK=Deno.env.get("ANTHROPIC_API_KEY")??"";
const OK=Deno.env.get("OPENAI_API_KEY")??"";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type","Content-Type":"application/json"};

async function render(p,cotas){
  if(!OK)return null;
  try{
    const pr=cotas
      ? "Photorealistic interior design render: "+p+". Straight front view, white studio background. Add dimension lines with mm measurements."
      : "Photorealistic interior design render of custom built-in furniture: "+p+". Straight flat FRONT VIEW only, white studio background, professional lighting. Show ONLY the furniture. NO room context.";
    const r=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+OK},body:JSON.stringify({model:"dall-e-3",prompt:pr,n:1,size:"1792x1024",quality:"standard",style:"natural"})});
    const d=await r.json();
    return d.data?.[0]?.url??null;
  }catch(e){console.error("DALLE",e);return null;}
}

function sys(pl,hr,diseno){
  return "Sos Zebrano AI de Zebrano carpinteria premium argentina.\nMATERIALES:\n"+pl+"\nHERRAJES:\n"+hr+"\n\nDISENO ACTUAL GUARDADO EN BASE DE DATOS:\n"+diseno+"\n\nINSTRUCCIONES CRITICAS:\n1. SIEMPRE lees el DISENO ACTUAL GUARDADO antes de responder\n2. Cuando el usuario pide ajustes -> modifica SOLO ese parametro, mantene TODO lo demas igual del diseno guardado\n3. NUNCA empieces desde cero si ya hay diseno guardado\n4. Con cualquier dato de un mueble -> genera render INMEDIATO sin preguntar\n5. NUNCA escribas codigo SVG en el texto de respuesta\n\nJSON render (nuevo o ajuste):\n{\"etapa\":\"render\",\"respuesta_texto\":\"[lo que entendiste]\",\"render_prompt\":\"[descripcion tecnica COMPLETA en ingles con TODOS los ajustes aplicados al diseno actual]\",\"con_cotas\":false,\"diseno_actualizado\":{\"ancho_mm\":2950,\"alto_mm\":2600,\"prof_mm\":600,\"modulos\":[{\"nombre\":\"Escritorio\",\"ancho_mm\":1000,\"alto_mm\":2600,\"material\":\"paraiso rovere\",\"detalles\":\"tapa 750mm, baulera 600mm techo, 2 estantes, varillado fondo\"},{\"nombre\":\"Placard\",\"ancho_mm\":1950,\"alto_mm\":2600,\"material\":\"blanco mate\",\"detalles\":\"4 puertas corredizas blancas piso a techo\"}]},\"datos_cliente\":{\"nombre\":\"\",\"telefono\":\"\",\"email\":\"\"}}\n\nJSON cotizacion (usuario aprueba render):\n{\"etapa\":\"cotizacion\",\"respuesta_texto\":\"[precio final]\",\"listo_para_cotizar\":true,\"datos\":{\"tipo_trabajo\":\"placard\",\"ambiente\":\"dormitorio\",\"piezas\":[{\"modulo\":\"A\",\"nombre\":\"Lateral\",\"material\":\"Melamina blanco mate 18mm\",\"largo_mm\":2600,\"ancho_mm\":580,\"cantidad\":2,\"canto_largo\":true,\"canto_ancho\":false}],\"herrajes\":[{\"nombre\":\"Bisagra cazoleta 35mm soft-close\",\"cantidad\":8,\"precio_unit\":680}],\"mano_obra\":[{\"operacion\":\"Corte y canto\",\"horas_estimadas\":4,\"operarios\":1,\"costo_hora_ref\":2333},{\"operacion\":\"Armado taller\",\"horas_estimadas\":3,\"operarios\":1,\"costo_hora_ref\":2333},{\"operacion\":\"Instalacion\",\"horas_estimadas\":4,\"operarios\":2,\"costo_hora_ref\":2333}],\"laqueado_m2\":0,\"horas_totales\":11}}\n\nCALCULO: hojas=ceil(m2/m2_placa), margen 35%, precio=costo/0.65, cliente no ve costos.";
}

function calcH(pz,cfg){
  const a={};
  for(const p of pz)a[p.material]=(a[p.material]??0)+(p.largo_mm/1000)*(p.ancho_mm/1000)*p.cantidad;
  const r={};
  for(const[m,m2]of Object.entries(a)){const c=cfg[m]??{largo_mm:2800,ancho_mm:1600,precio_unidad:10200};const h=Math.ceil(m2/((c.largo_mm/1000)*(c.ancho_mm/1000)));r[m]={m2_neto:Math.round(m2*100)/100,hojas_reales:h,precio_hoja:c.precio_unidad,subtotal:h*c.precio_unidad};}
  return r;
}

async function callClaude(msgs,system){
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":AK,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,system,messages:msgs})});
  const d=await r.json();
  const raw=d.content?.[0]?.text??"";
  let p=null;
  try{const m=raw.match(/\{[\s\S]*\}/);if(m)p=JSON.parse(m[0]);}catch{}
  return{raw,parsed:p};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:CORS});
  const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
  try{
    const body=await req.json();
    const{sesion_id,mensaje,imagenes_base64=[],origen="app",aprobar_cotizacion=false}=body;
    const[{data:PR},{data:HR},{data:PIN}]=await Promise.all([sb.from("config_placas").select("*").eq("activo",true).order("material"),sb.from("config_herrajes").select("*").eq("activo",true).order("nombre"),sb.from("config_pintura").select("*").eq("activo",true)]);
    const pcfg={};
    for(const p of(PR??[]))pcfg[p.material]={largo_mm:p.largo_mm,ancho_mm:p.ancho_mm,precio_unidad:p.precio_unidad};
    const pstr=(PR??[]).map(p=>"- "+p.material+": "+p.largo_mm+"x"+p.ancho_mm+"x"+p.espesor_mm+"mm $"+p.precio_unidad+"/placa").join("\n");
    const hstr=(HR??[]).map(h=>"- "+h.nombre+": $"+h.precio_unit+"/"+h.unidad).join("\n");

    let sid=sesion_id;
    if(!sid){const{data:n}=await sb.from("cotizacion_sesiones").insert({origen,estado:"iniciada",imagenes_urls:[]}).select("id").single();sid=n?.id;}

    // Cargar diseno guardado - clave para mantener coherencia
    const{data:disenoActual}=await sb.from("cotizacion_diseno").select("*").eq("sesion_id",sid).maybeSingle();
    const disenoStr=disenoActual
      ? "Version "+disenoActual.version+". Modulos: "+JSON.stringify(disenoActual.modulos)+". Render prompt guardado: "+disenoActual.render_prompt_actual
      : "Sin diseno guardado. Primer mensaje de esta sesion.";

    if(aprobar_cotizacion&&sid){
      const{data:s}=await sb.from("cotizacion_sesiones").select("tipo_trabajo").eq("id",sid).single();
      const yr=new Date().getFullYear();
      const{count}=await sb.from("ordenes_trabajo").select("*",{count:"exact",head:true});
      const n="OT-"+yr+"-"+String((count??0)+1).padStart(3,"0");
      await sb.from("ordenes_trabajo").insert({numero_ot:n,sesion_cotizacion_id:sid,tipo_trabajo:s?.tipo_trabajo??"custom",estado:"pendiente",avance_pct:0,horas_reales:0});
      await sb.from("cotizacion_sesiones").update({estado:"aprobada"}).eq("id",sid);
      return new Response(JSON.stringify({ok:true,sesion_id:sid,respuesta:"Orden "+n+" creada.",ot_creada:true,numero_ot:n}),{headers:CORS});
    }

    const iu=[];
    for(let i=0;i<imagenes_base64.length;i++){try{const b=Uint8Array.from(atob(imagenes_base64[i]),c=>c.charCodeAt(0));const pt="sesiones/"+sid+"/img_"+Date.now()+"_"+i+".jpg";const{error}=await sb.storage.from("zebrano-proyectos").upload(pt,b,{contentType:"image/jpeg",upsert:true});if(!error){const{data:u}=sb.storage.from("zebrano-proyectos").getPublicUrl(pt);iu.push(u.publicUrl);}}catch{}}
    if(mensaje||imagenes_base64.length>0){await sb.from("cotizacion_mensajes").insert({sesion_id:sid,rol:"user",contenido:mensaje??"(imagenes)",imagenes:iu});if(iu.length>0){const{data:s}=await sb.from("cotizacion_sesiones").select("imagenes_urls").eq("id",sid).single();await sb.from("cotizacion_sesiones").update({imagenes_urls:[...(s?.imagenes_urls??[]),...iu]}).eq("id",sid);}}

    const{data:hist}=await sb.from("cotizacion_mensajes").select("rol,contenido,created_at").eq("sesion_id",sid).order("created_at",{ascending:true}).limit(50);
    const msgs=[];
    for(const m of(hist??[])){if(m.rol==="system")continue;const role=m.rol==="agent"?"assistant":"user";const last=msgs[msgs.length-1];if(last&&last.role===role&&typeof last.content==="string")last.content=last.content+"\n\n"+m.contenido;else msgs.push({role,content:m.contenido});}
    if(imagenes_base64.length>0){const c=imagenes_base64.map(b=>({type:"image",source:{type:"base64",media_type:"image/jpeg",data:b}}));if(mensaje)c.push({type:"text",text:mensaje});const last=msgs[msgs.length-1];if(last&&last.role==="user")last.content=c;else msgs.push({role:"user",content:c});}
    if(msgs.length===0)msgs.push({role:"user",content:mensaje??"Hola"});

    const{raw,parsed}=await callClaude(msgs,sys(pstr,hstr,disenoStr));
    const etapa=parsed?.etapa??"conv";
    let texto=parsed?.respuesta_texto??raw;
    let ru=null;let rc=null;

    if(etapa==="render"&&parsed?.render_prompt){
      ru=await render(parsed.render_prompt,parsed.con_cotas===true);
      if(parsed.diseno_actualizado){
        const du=parsed.diseno_actualizado;
        const version=(disenoActual?.version??0)+1;
        await sb.from("cotizacion_diseno").upsert({sesion_id:sid,ancho_mm:Number(du.ancho_mm)||null,alto_mm:Number(du.alto_mm)||null,prof_mm:Number(du.prof_mm)||null,modulos:du.modulos??[],render_prompt_actual:parsed.render_prompt,render_url_actual:ru??null,version,updated_at:new Date().toISOString()},{onConflict:"sesion_id"});
      }
      if(parsed.datos_cliente){const dc=parsed.datos_cliente;await sb.from("cotizacion_sesiones").update({cliente_nombre:dc.nombre||null,cliente_telefono:dc.telefono||null,cliente_email:dc.email||null,estado:"procesando"}).eq("id",sid);}
      if(ru){await sb.from("cotizacion_resumen").upsert({sesion_id:sid,render_url:ru,costo_materiales:0,costo_herrajes:0,costo_mano_obra:0,costo_laqueado:0,costo_total_interno:0,margen_pct:35,precio_sugerido:0},{onConflict:"sesion_id"});texto+="\n\nRender actualizado. Decime si queres otro ajuste o lo aprobas para calcular el presupuesto.";}
    }

    if(etapa==="cotizacion"&&parsed?.listo_para_cotizar&&parsed?.datos){
      const dat=parsed.datos;const pz=dat.piezas??[];
      await sb.from("cotizacion_sesiones").update({tipo_trabajo:String(dat.tipo_trabajo??"custom"),ambiente:String(dat.ambiente??""),estado:"borrador",procesado_at:new Date().toISOString()}).eq("id",sid);
      if(pz.length>0){await sb.from("cotizacion_piezas").delete().eq("sesion_id",sid);await sb.from("cotizacion_piezas").insert(pz.map((p,i)=>({sesion_id:sid,modulo_nombre:String(p.modulo??"General"),nombre_pieza:String(p.nombre??""),material:String(p.material??"Melamina blanco mate 18mm"),largo_mm:Number(p.largo_mm)||0,ancho_mm:Number(p.ancho_mm)||0,cantidad:Number(p.cantidad)||1,con_canto_largo:Boolean(p.canto_largo),con_canto_ancho:Boolean(p.canto_ancho),orden:i+1})));}
      const h=calcH(pz.map(p=>({largo_mm:Number(p.largo_mm)||0,ancho_mm:Number(p.ancho_mm)||0,cantidad:Number(p.cantidad)||1,material:String(p.material??"Melamina blanco mate 18mm")})),pcfg);
      await sb.from("cotizacion_hojas").delete().eq("sesion_id",sid);
      await sb.from("cotizacion_hojas").insert(Object.entries(h).map(([mat,hh])=>({sesion_id:sid,material:mat,m2_neto:hh.m2_neto,hojas_teoricas:hh.m2_neto/((pcfg[mat]?.largo_mm??2800)/1000*(pcfg[mat]?.ancho_mm??1600)/1000),hojas_reales:hh.hojas_reales,precio_hoja:hh.precio_hoja,subtotal:hh.subtotal})));
      const hj=dat.herrajes??[];if(hj.length>0){await sb.from("cotizacion_herrajes").delete().eq("sesion_id",sid);await sb.from("cotizacion_herrajes").insert(hj.map(hh=>({sesion_id:sid,nombre:String(hh.nombre??""),cantidad:Number(hh.cantidad)||1,precio_unit:Number(hh.precio_unit)||0,subtotal:(Number(hh.cantidad)||1)*(Number(hh.precio_unit)||0)})));}
      const mo=dat.mano_obra??[];if(mo.length>0){await sb.from("cotizacion_mano_obra").delete().eq("sesion_id",sid);await sb.from("cotizacion_mano_obra").insert(mo.map(m=>({sesion_id:sid,operacion:String(m.operacion??""),horas_estimadas:Number(m.horas_estimadas)||0,operarios:Number(m.operarios)||1,costo_hora_ref:Number(m.costo_hora_ref)||2333,subtotal:(Number(m.horas_estimadas)||0)*(Number(m.operarios)||1)*(Number(m.costo_hora_ref)||2333)})));}
      const lq=Number(dat.laqueado_m2)||0;const pp=(PIN??[])[0]?.precio_m2_aplicado??8500;const cl=lq>0?lq*pp:0;
      const cm=Object.values(h).reduce((a,hh)=>a+hh.subtotal,0);const ch=hj.reduce((a,hh)=>a+(Number(hh.cantidad)||1)*(Number(hh.precio_unit)||0),0);const cmo=mo.reduce((a,m)=>a+(Number(m.horas_estimadas)||0)*(Number(m.operarios)||1)*(Number(m.costo_hora_ref)||2333),0);
      const ct=cm+ch+cmo+cl;const ps=Math.round(ct/0.65);
      const{data:re}=await sb.from("cotizacion_resumen").select("render_url").eq("sesion_id",sid).single();
      await sb.from("cotizacion_resumen").upsert({sesion_id:sid,costo_materiales:cm,costo_herrajes:ch,costo_mano_obra:cmo,costo_laqueado:cl,costo_total_interno:ct,margen_pct:35,precio_sugerido:ps,horas_totales_est:Number(dat.horas_totales)||null,render_url:re?.render_url??null},{onConflict:"sesion_id"});
      rc={costoTotal:ct,precioSugerido:ps,margen:35,listo_para_aprobar:true,hojas:h};
    }

    await sb.from("cotizacion_mensajes").insert({sesion_id:sid,rol:"agent",contenido:texto,imagenes:ru?[ru]:[],metadata:parsed??{}});
    return new Response(JSON.stringify({ok:true,sesion_id:sid,respuesta:texto,render_url:ru,listo_para_cotizar:etapa==="cotizacion"&&!!parsed?.listo_para_cotizar,resumen:rc}),{headers:CORS});
  }catch(e){const msg=e instanceof Error?e.message:String(e);return new Response(JSON.stringify({ok:false,error:msg}),{status:500,headers:CORS});}
});
