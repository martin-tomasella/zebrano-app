import { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

const { width: SW, height: SH } = Dimensions.get('window');
const SUPA_URL = 'https://xsciujuvkbubnhhnpcix.supabase.co';
const SUPA_KEY = 'sb_publishable_gI_zCp__hlMim3bIhXX7jg_QwY5MwzZ';
const C = { bg:'#0d0f0e',card:'#1a2020',raised:'#1f2826',gold:'#c9a84c',honey:'#e0b86a',amber:'#f0c97a',green:'#6bbf84',red:'#e06060',teak:'#8b5e3c',t1:'rgba(255,255,255,0.92)',t2:'rgba(255,255,255,0.55)',t3:'rgba(255,255,255,0.28)',border:'rgba(255,255,255,0.06)',borderGold:'rgba(201,168,76,0.25)' };

async function imageToBase64(uri) {
  const r = await fetch(uri); const blob = await r.blob();
  return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onloadend=()=>resolve(reader.result.split(',')[1]); reader.onerror=reject; reader.readAsDataURL(blob); });
}
async function transcribirAudio(uri) {
  try {
    const fd = new FormData();
    fd.append('file',{uri,type:'audio/m4a',name:'audio.m4a'});
    const r = await fetch(`${SUPA_URL}/functions/v1/zebrano-whisper`,{method:'POST',headers:{'Authorization':`Bearer ${SUPA_KEY}`},body:fd});
    const d = await r.json(); return d.text??null;
  } catch(e){console.error('Whisper:',e);return null;}
}
async function chatCotizador(params) {
  const r = await fetch(`${SUPA_URL}/functions/v1/zebrano-cotizador`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPA_KEY}`},body:JSON.stringify(params)});
  return r.json();
}

export default function CotizadorScreen() {
  const scrollRef=useRef(null); const recordingRef=useRef(null);
  const [sesionId,setSesionId]=useState(null); const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState(''); const [imgs,setImgs]=useState([]);
  const [loading,setLoading]=useState(false); const [grabando,setGrabando]=useState(false);
  const [transcribiendo,setTranscribiendo]=useState(false);
  const [resumen,setResumen]=useState(null); const [renderUrl,setRenderUrl]=useState(null);
  const [modalImg,setModalImg]=useState(null); const [aprobando,setAprobando]=useState(false);
  const [otCreada,setOtCreada]=useState(null);

  const scroll=()=>setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),150);

  const iniciarGrabacion=async()=>{
    try{
      const{status}=await Audio.requestPermissionsAsync();
      if(status!=='granted'){Alert.alert('Sin permiso de microfono');return;}
      await Audio.setAudioModeAsync({allowsRecordingIOS:true,playsInSilentModeIOS:true});
      const{recording}=await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current=recording; setGrabando(true);
    }catch(e){console.error('Grab:',e);}
  };
  const detenerGrabacion=async()=>{
    if(!recordingRef.current)return;
    setGrabando(false); setTranscribiendo(true);
    try{
      await recordingRef.current.stopAndUnloadAsync();
      const uri=recordingRef.current.getURI(); recordingRef.current=null;
      const texto=await transcribirAudio(uri);
      if(texto)setInput(prev=>prev?prev+' '+texto:texto);
      else Alert.alert('No se pudo transcribir','Intenta de nuevo o escribi el texto');
    }catch(e){console.error('Stop:',e);}
    setTranscribiendo(false);
  };

  const enviar=useCallback(async()=>{
    if(loading)return; if(!input.trim()&&imgs.length===0)return;
    setLoading(true);
    const localImgs=[...imgs]; const msgTxt=input; setInput(''); setImgs([]);
    setMsgs(p=>[...p,{id:Date.now().toString(),rol:'user',texto:msgTxt||'(imagenes)',imagenes:localImgs,timestamp:new Date().toISOString()}]);
    scroll();
    const b64s=[];
    for(const uri of localImgs){try{b64s.push(await imageToBase64(uri));}catch{}}
    try{
      const resp=await chatCotizador({sesion_id:sesionId??undefined,mensaje:msgTxt,imagenes_base64:b64s,origen:'app'});
      if(resp.ok){
        if(!sesionId)setSesionId(resp.sesion_id);
        if(resp.render_url)setRenderUrl(resp.render_url);
        if(resp.resumen?.listo_para_aprobar)setResumen(resp.resumen);
        setMsgs(p=>[...p,{id:(Date.now()+1).toString(),rol:'agent',texto:resp.respuesta,renderUrl:resp.render_url,timestamp:new Date().toISOString()}]);
      }
    }catch{setMsgs(p=>[...p,{id:Date.now().toString(),rol:'agent',texto:'Error de conexion.',timestamp:new Date().toISOString()}]);}
    setLoading(false); scroll();
  },[loading,input,imgs,sesionId]);

  const pedirCotas=async()=>{
    if(!sesionId||loading)return; setLoading(true);
    setMsgs(p=>[...p,{id:Date.now().toString(),rol:'user',texto:'Dame el render con cotas y dimensiones marcadas',timestamp:new Date().toISOString()}]);
    scroll();
    try{
      const resp=await chatCotizador({sesion_id:sesionId,mensaje:'Regenera el render con todas las cotas y dimensiones principales marcadas sobre el disenio. Incluye medidas de ancho, alto, profundidad y modulos.',origen:'app'});
      if(resp.ok){if(resp.render_url)setRenderUrl(resp.render_url);setMsgs(p=>[...p,{id:(Date.now()+1).toString(),rol:'agent',texto:resp.respuesta,renderUrl:resp.render_url,timestamp:new Date().toISOString()}]);}
    }catch{}
    setLoading(false); scroll();
  };

  const aprobar=useCallback(async()=>{
    if(!sesionId||aprobando)return;
    Alert.alert('Aprobar cotizacion',`Precio: $${resumen?.precioSugerido?.toLocaleString('es-AR')}\nGenerar Orden de Trabajo?`,
      [{text:'Cancelar',style:'cancel'},{text:'Aprobar y crear OT',onPress:async()=>{
        setAprobando(true);
        try{const resp=await chatCotizador({sesion_id:sesionId,aprobar_cotizacion:true});if(resp.ok&&resp.ot_creada){setOtCreada(resp.numero_ot);setResumen(null);setMsgs(p=>[...p,{id:Date.now().toString(),rol:'agent',texto:resp.respuesta,timestamp:new Date().toISOString()}]);scroll();}}catch{}
        setAprobando(false);
      }}]);
  },[sesionId,resumen,aprobando]);

  const pickImg=async()=>{const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.85,allowsMultipleSelection:true});if(!r.canceled)setImgs(p=>[...p,...r.assets.map(a=>a.uri)]);};
  const takePhoto=async()=>{const{status}=await ImagePicker.requestCameraPermissionsAsync();if(status!=='granted')return;const r=await ImagePicker.launchCameraAsync({quality:0.85});if(!r.canceled)setImgs(p=>[...p,r.assets[0].uri]);};

  const canSend=!loading&&(input.trim().length>0||imgs.length>0);

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={s.container}>
        <View style={s.header}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,flex:1}}>
            <View style={s.dot}/><Text style={s.agentLabel}>Zebrano AI</Text>
          </View>
          {renderUrl&&<><TouchableOpacity onPress={pedirCotas} style={[s.headerBtn,{borderColor:'#6bbf8440'}]}><Text style={{color:C.green,fontSize:10}}>Cotas</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setModalImg(renderUrl)} style={s.headerBtn}><Text style={{color:C.honey,fontSize:10}}>Render</Text></TouchableOpacity></>}
          <TouchableOpacity onPress={()=>{setSesionId(null);setMsgs([]);setResumen(null);setRenderUrl(null);setOtCreada(null);setInput('');setImgs([]);}} style={s.newBtn}><Text style={{color:C.t2,fontSize:11}}>+ Nueva</Text></TouchableOpacity>
        </View>
        {otCreada&&<View style={{backgroundColor:'#6bbf8415',padding:8}}><Text style={{color:C.green,fontSize:12,textAlign:'center'}}>Orden {otCreada} creada</Text></View>}
        <ScrollView ref={scrollRef} style={{flex:1}} contentContainerStyle={{padding:14,paddingBottom:24}}>
          {msgs.length===0&&(
            <View style={{alignItems:'center',paddingTop:50}}>
              <Text style={{fontSize:48,color:C.gold}}>◇</Text>
              <Text style={{fontSize:18,color:C.t1,fontWeight:'600',marginTop:8}}>Zebrano AI</Text>
              <Text style={{fontSize:13,color:C.t3,textAlign:'center',marginTop:6}}>Foto + descripcion = render inmediato{'\n'}Usa el microfono, escribi o subi una imagen</Text>
              {['Placard 2 cuerpos melamina blanco 2.4x2.2m','Cocina en L rovere 3x2.5m','Biblioteca living con escritorio'].map(ex=>(
                <TouchableOpacity key={ex} style={[s.exBtn,{marginTop:8,width:'100%'}]} onPress={()=>setInput(ex)}><Text style={{color:C.t2,fontSize:13,textAlign:'center'}}>{ex}</Text></TouchableOpacity>
              ))}
            </View>
          )}
          {msgs.map(m=>(
            <View key={m.id} style={[s.bubble,m.rol==='user'?s.bubbleUser:s.bubbleAgent]}>
              {m.rol==='agent'&&<Text style={{fontSize:9,color:C.gold,letterSpacing:1,marginBottom:4}}>ZEBRANO AI</Text>}
              {m.imagenes?.map((uri,i)=>(
                <TouchableOpacity key={i} onPress={()=>setModalImg(uri)} activeOpacity={0.85}>
                  <Image source={{uri}} style={{width:'100%',height:180,borderRadius:8,marginBottom:6}} resizeMode="cover"/>
                </TouchableOpacity>
              ))}
              <Text style={{color:m.rol==='user'?C.t1:C.t2,fontSize:14,lineHeight:20}}>{m.texto}</Text>
              {m.renderUrl&&(
                <View style={{marginTop:8}}>
                  <TouchableOpacity onPress={()=>setModalImg(m.renderUrl)} activeOpacity={0.85}>
                    <Image source={{uri:m.renderUrl}} style={{width:'100%',height:220,borderRadius:10}} resizeMode="cover"/>
                  </TouchableOpacity>
                  <View style={{flexDirection:'row',gap:8,marginTop:6}}>
                    <TouchableOpacity style={s.renderAction} onPress={()=>setModalImg(m.renderUrl)}><Text style={{color:C.gold,fontSize:11}}>Ampliar</Text></TouchableOpacity>
                    <TouchableOpacity style={[s.renderAction,{borderColor:'#6bbf8440'}]} onPress={pedirCotas}><Text style={{color:C.green,fontSize:11}}>Ver cotas</Text></TouchableOpacity>
                  </View>
                  <Text style={{color:C.t3,fontSize:10,marginTop:4}}>Render DALL-E 3</Text>
                </View>
              )}
              <Text style={{color:C.t3,fontSize:9,marginTop:6,alignSelf:'flex-end'}}>{new Date(m.timestamp).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</Text>
            </View>
          ))}
          {(loading||transcribiendo)&&(
            <View style={[s.bubbleAgent,{flexDirection:'row',alignItems:'center',gap:8}]}>
              <ActivityIndicator size="small" color={C.gold}/>
              <Text style={{color:C.t3,fontSize:13}}>{transcribiendo?'Transcribiendo audio...':'Generando render...'}</Text>
            </View>
          )}
          {resumen&&!otCreada&&(
            <View style={{backgroundColor:C.raised,borderRadius:14,padding:14,borderWidth:1,borderColor:C.borderGold,marginTop:8}}>
              <Text style={{color:C.amber,fontSize:13,fontWeight:'600',marginBottom:10}}>Cotizacion lista</Text>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}>
                <Text style={{color:C.t1,fontSize:15,fontWeight:'600'}}>Precio al cliente</Text>
                <Text style={{color:C.amber,fontSize:18,fontWeight:'700'}}>${resumen.precioSugerido?.toLocaleString('es-AR')}</Text>
              </View>
              <TouchableOpacity style={{backgroundColor:C.gold,borderRadius:10,padding:14,alignItems:'center',marginTop:12}} onPress={aprobar} disabled={aprobando}>
                {aprobando?<ActivityIndicator color={C.bg}/>:<Text style={{color:C.bg,fontSize:14,fontWeight:'700'}}>Aprobar y generar OT</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{backgroundColor:C.card,borderRadius:10,padding:12,alignItems:'center',marginTop:8,borderWidth:1,borderColor:C.border}} onPress={()=>setInput('Quiero modificar: ')}>
                <Text style={{color:C.t2,fontSize:13}}>Solicitar modificacion</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        {imgs.length>0&&(
          <ScrollView horizontal style={{maxHeight:90,backgroundColor:'#111714',borderTopWidth:1,borderTopColor:C.border}} contentContainerStyle={{gap:8,padding:8}}>
            {imgs.map((uri,i)=>(
              <View key={i} style={{position:'relative'}}>
                <Image source={{uri}} style={{width:72,height:72,borderRadius:8}}/>
                <TouchableOpacity style={{position:'absolute',top:2,right:2,backgroundColor:C.red,borderRadius:8,width:18,height:18,alignItems:'center',justifyContent:'center'}} onPress={()=>setImgs(p=>p.filter((_,idx)=>idx!==i))}>
                  <Text style={{color:'#fff',fontSize:10}}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={s.inputArea}>
          <TouchableOpacity onPress={takePhoto} style={s.iconBtn}><Text style={{fontSize:18}}>CAM</Text></TouchableOpacity>
          <TouchableOpacity onPress={pickImg} style={s.iconBtn}><Text style={{fontSize:18}}>IMG</Text></TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn,grabando&&{backgroundColor:'#e0606030',borderColor:C.red}]} onPress={grabando?detenerGrabacion:iniciarGrabacion} disabled={transcribiendo}>
            {transcribiendo?<ActivityIndicator size="small" color={C.gold}/>:<Text style={{fontSize:grabando?22:18}}>{grabando?'[.]':'MIC'}</Text>}
          </TouchableOpacity>
          <TextInput style={[s.input,grabando&&{borderColor:C.red}]} value={input} onChangeText={setInput} placeholder={grabando?'Grabando... toca [.] para detener':'Describí, hablá o subi fotos...'} placeholderTextColor={grabando?C.red:C.t3} multiline maxLength={2000}/>
          <TouchableOpacity style={[s.sendBtn,!canSend&&{opacity:0.35}]} onPress={enviar} disabled={!canSend}>
            {loading?<ActivityIndicator size="small" color={C.bg}/>:<Text style={{color:C.bg,fontSize:20,fontWeight:'700'}}>-></Text>}
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={!!modalImg} transparent animationType="fade" statusBarTranslucent>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.96)',justifyContent:'center',alignItems:'center'}}>
          {modalImg&&<Image source={{uri:modalImg}} style={{width:SW,height:SH*0.75}} resizeMode="contain"/>}
          <View style={{flexDirection:'row',gap:12,marginTop:16}}>
            <TouchableOpacity style={s.modalBtn} onPress={()=>{setModalImg(null);pedirCotas();}}><Text style={{color:C.green,fontSize:13}}>Ver con cotas</Text></TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn,{borderColor:C.border}]} onPress={()=>setModalImg(null)}><Text style={{color:C.t3,fontSize:13}}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const s=StyleSheet.create({
  container:{flex:1,backgroundColor:'#0d0f0e'},
  header:{flexDirection:'row',alignItems:'center',gap:6,padding:10,backgroundColor:'#111714',borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.06)'},
  dot:{width:10,height:10,borderRadius:5,backgroundColor:'#c9a84c'},
  agentLabel:{color:'#c9a84c',fontSize:13,fontWeight:'600'},
  headerBtn:{backgroundColor:'rgba(201,168,76,0.12)',borderRadius:8,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:'rgba(201,168,76,0.25)'},
  newBtn:{backgroundColor:'#1a2020',borderRadius:8,paddingHorizontal:8,paddingVertical:5,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  exBtn:{backgroundColor:'#1a2020',borderRadius:10,padding:12,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  bubble:{borderRadius:12,padding:12,marginBottom:8},
  bubbleUser:{backgroundColor:'rgba(139,94,60,0.35)',alignSelf:'flex-end',maxWidth:'88%',borderWidth:1,borderColor:'rgba(139,94,60,0.45)'},
  bubbleAgent:{backgroundColor:'#1a2020',alignSelf:'flex-start',maxWidth:'96%',borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  renderAction:{flex:1,backgroundColor:'#1a2020',borderRadius:8,padding:8,alignItems:'center',borderWidth:1,borderColor:'rgba(201,168,76,0.25)'},
  inputArea:{flexDirection:'row',alignItems:'flex-end',gap:5,padding:10,backgroundColor:'#111714',borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)'},
  iconBtn:{width:42,height:42,alignItems:'center',justifyContent:'center',backgroundColor:'#1a2020',borderRadius:8,borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  input:{flex:1,backgroundColor:'#1a2020',borderRadius:8,borderWidth:1,borderColor:'#2a2a2a',color:'rgba(255,255,255,0.92)',paddingHorizontal:10,paddingVertical:9,fontSize:13,maxHeight:100},
  sendBtn:{width:42,height:42,backgroundColor:'#c9a84c',borderRadius:8,alignItems:'center',justifyContent:'center'},
  modalBtn:{backgroundColor:'#1a2020',borderRadius:10,paddingHorizontal:16,paddingVertical:10,borderWidth:1,borderColor:'rgba(201,168,76,0.3)'},
});


